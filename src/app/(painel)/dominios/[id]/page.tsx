import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Copiavel } from "@/components/copiavel";
import { StatusPill } from "@/components/status-pill";
import { acharZona, cloudflareConfigurada } from "@/lib/cloudflare";
import { prisma } from "@/lib/db";
import { checkRecords, expectedRecords } from "@/lib/dns";
import { entregaPorDominio } from "@/lib/farol";
import {
  domainLabel,
  EMAIL_LABEL,
  num,
  pct,
  since,
  timeBR,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Publicar } from "./publicar";
import { Verificar } from "./verificar";

const ESTADO_REGISTRO = {
  ok: ["encontrado ✓", "text-ok-fg", "bg-ok-dot"],
  bad: ["incorreto ✗", "text-destructive", "bg-bad-dot"],
  wait: ["aguardando", "text-fainter", "bg-idle-dot"],
} as const;

const COLUNAS =
  "grid min-w-[680px] grid-cols-[64px_1.1fr_1.2fr_210px] gap-x-3 px-4.5";

export default async function DominioDetalhe({
  params,
}: PageProps<"/dominios/[id]">) {
  const { id } = await params;

  const dominio = await prisma.sendingDomain.findUnique({
    where: { id },
    include: {
      _count: { select: { suppressions: true } },
      emailLogs: {
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, to: true, status: true, createdAt: true },
      },
    },
  });
  if (!dominio) notFound();

  const entrega = await entregaPorDominio(
    new Date(Date.now() - 30 * 86_400_000),
  );

  const stats = entrega.get(dominio.id);
  const taxa = stats?.total ? stats.entregues / stats.total : null;
  const [rotulo, tom] = dominio.fallbackOnly
    ? (["Fallback", "idle"] as const)
    : domainLabel(dominio);

  return (
    <>
      <Link href="/dominios" className="text-[12.5px] font-semibold">
        ← Domínios
      </Link>

      <div className="mt-4 mb-1 flex flex-wrap items-center gap-3.5">
        <h1 className="text-[21px] font-extrabold tracking-[-0.4px]">
          {dominio.clientName}
        </h1>
        <span className="font-mono text-[15px] text-mono">
          {dominio.domain}
        </span>
        <StatusPill tone={tom}>{rotulo}</StatusPill>
        <div className="flex-1" />
        <span className="font-mono text-xs text-fainter">
          entrega 30d: {taxa === null ? "—" : pct(taxa)} · verificado{" "}
          {since(dominio.lastCheckedAt)}
        </span>
        <Suspense fallback={null}>
          <PublicarSlot id={dominio.id} domain={dominio.domain} />
        </Suspense>
        <Verificar id={dominio.id} />
      </div>

      {dominio.status === "VERIFIED" && (
        <div className="carimbo my-2 text-xs">Autenticado</div>
      )}

      {dominio.status !== "VERIFIED" && (
        <p className="mt-3 rounded-[10px] border border-warn-bg bg-warn-bg px-4 py-3 text-[12.5px] text-warn-fg">
          Enquanto o DNS não conclui, os envios de {dominio.clientName} saem
          pelo domínio de fallback do Selo com o remetente original em Reply-To
          — nenhum email é perdido.
        </p>
      )}

      <h2 className="mt-5.5 mb-2.5 text-sm font-extrabold uppercase tracking-[.3px]">
        Registros DNS
      </h2>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <div
          className={cn(
            COLUNAS,
            "border-b py-2.5 text-[10.5px] font-bold uppercase tracking-[.6px] whitespace-nowrap text-fainter",
          )}
        >
          <span>Tipo</span>
          <span>Nome</span>
          <span>Valor</span>
          <span>Status</span>
        </div>

        {/* A consulta ao DNS leva segundos — o resto da tela não espera por ela. */}
        <Suspense fallback={<RegistrosCarregando dominio={dominio} />}>
          <Registros dominio={dominio} />
        </Suspense>
      </div>
      <p className="mt-2 text-[11px] text-ghost">
        A coluna Status vem de uma consulta ao DNS público (1.1.1.1) feita
        agora. O estado do domínio acima é o que o SES reporta.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <h2 className="mb-2.5 text-sm font-extrabold uppercase tracking-[.3px] text-faint">
            Últimos envios
          </h2>
          <div className="divide-y overflow-x-auto rounded-xl border bg-card">
            {dominio.emailLogs.length === 0 && (
              <p className="px-4 py-3 text-xs text-faint">
                Nenhum envio ainda.
              </p>
            )}
            {dominio.emailLogs.map((e) => {
              const [rot, tone] = EMAIL_LABEL[e.status];
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-3 px-4 py-2.5 text-xs"
                >
                  <span className="shrink-0 font-mono text-fainter">
                    {timeBR(e.createdAt)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {e.to}
                  </span>
                  <StatusPill tone={tone} className="shrink-0">
                    {rot}
                  </StatusPill>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="mb-2.5 text-sm font-extrabold uppercase tracking-[.3px] text-faint">
            Supressões do cliente
          </h2>
          <div className="rounded-xl border bg-card px-4 py-3.5 text-[12.5px] text-faint">
            {dominio._count.suppressions === 0
              ? "Nenhum endereço bloqueado. "
              : `${num(dominio._count.suppressions)} endereço(s) bloqueado(s). `}
            <Link href={`/supressoes?dominio=${dominio.id}`}>
              ver supressões
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * A publicação automática só aparece quando é possível de verdade. Sem token ou
 * com a zona fora da conta, o operador vê o porquê — e o caminho manual abaixo
 * continua sendo o caminho.
 */
async function PublicarSlot({ id, domain }: { id: string; domain: string }) {
  if (!cloudflareConfigurada()) return null;

  const zona = await acharZona(domain);
  if (!zona) {
    return (
      <span className="max-w-[240px] text-right text-[11px] text-fainter">
        {domain} não está nesta conta Cloudflare — publique os registros à mão.
      </span>
    );
  }

  return <Publicar id={id} />;
}

type DominioDns = {
  domain: string;
  dkimTokens: string[];
  mailFromDomain: string | null;
};

function RegistrosCarregando({ dominio }: { dominio: DominioDns }) {
  return (
    <>
      {expectedRecords(dominio).map((r) => (
        <div
          key={r.type + r.name}
          className={cn(COLUNAS, "items-start border-t py-3 text-[12.5px]")}
        >
          <span className="font-mono text-[11.5px] font-semibold">
            {r.type}
          </span>
          <Copiavel valor={r.name} className="pr-3" />
          <Copiavel valor={r.value} className="pr-3" />
          <span className="text-[11.5px] font-bold text-fainter">
            consultando…
          </span>
        </div>
      ))}
    </>
  );
}

async function Registros({ dominio }: { dominio: DominioDns }) {
  const registros = await checkRecords(expectedRecords(dominio));

  return (
    <>
      {registros.map((r) => {
        const [texto, cor, ponto] = ESTADO_REGISTRO[r.state];
        return (
          <div
            key={r.type + r.name}
            className={cn(COLUNAS, "items-start border-t py-3 text-[12.5px]")}
          >
            <span className="font-mono text-[11.5px] font-semibold">
              {r.type}
            </span>
            <Copiavel valor={r.name} className="pr-3" />
            <Copiavel valor={r.value} className="pr-3" />
            <span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-[11.5px] font-bold",
                  cor,
                )}
              >
                <i className={cn("size-1.5 rounded-full", ponto)} />
                {texto}
              </span>
              {r.state === "bad" && (
                <span className="mt-1.5 block text-[11px] leading-relaxed">
                  <span className="block text-bad-fg">
                    encontrado:{" "}
                    <span className="break-all rounded-[3px] bg-bad-bg px-1 font-mono">
                      {r.found}
                    </span>
                  </span>
                  <span className="block text-ok-fg">
                    esperado:{" "}
                    <span className="break-all rounded-[3px] bg-ok-bg px-1 font-mono">
                      {r.value}
                    </span>
                  </span>
                </span>
              )}
            </span>
          </div>
        );
      })}
    </>
  );
}
