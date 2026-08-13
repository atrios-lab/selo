import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import type { EmailStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { dateTimeBR, EMAIL_LABEL, timeBR } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { BuscaEnvios } from "./busca-envios";

const FILTROS = [
  ["todos", "todos"],
  ["DELIVERED", "entregue"],
  ["BOUNCED", "devolvido"],
  ["SENT", "enviado"],
  ["COMPLAINED", "spam"],
  ["SUPPRESSED", "bloqueado"],
  ["REJECTED", "recusado"],
] as const;

const COLUNAS =
  "grid min-w-[720px] grid-cols-[96px_minmax(180px,1.7fr)_minmax(110px,1fr)_96px_130px] gap-x-3 px-4.5";

const JANELA_MS = 7 * 86_400_000;

export default async function Envios({ searchParams }: PageProps<"/envios">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "todos";
  const dominio = typeof sp.dominio === "string" ? sp.dominio : "";
  const aberto = typeof sp.id === "string" ? sp.id : "";

  // A janela de 7 dias sai do caminho quando o operador está atrás de algo específico.
  const janela = q || aberto ? undefined : new Date(Date.now() - JANELA_MS);

  const logs = await prisma.emailLog.findMany({
    where: {
      createdAt: janela ? { gte: janela } : undefined,
      status: status === "todos" ? undefined : (status as EmailStatus),
      sendingDomainId: dominio || undefined,
      ...(q ? { to: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      from: true,
      to: true,
      subject: true,
      tag: true,
      status: true,
      errorDetail: true,
      usedFallback: true,
      sesMessageId: true,
      createdAt: true,
      deliveredAt: true,
    },
  });

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, status, dominio, ...patch })) {
      if (v && v !== "todos") p.set(k, v);
    }
    const s = p.toString();
    return s ? `/envios?${s}` : "/envios";
  };

  return (
    <>
      <h1 className="mb-4 text-[21px] font-extrabold tracking-[-0.4px]">
        Envios
      </h1>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <BuscaEnvios inicial={q} />
        {FILTROS.map(([valor, rotulo]) => (
          <Link
            key={valor}
            href={href({ status: valor, id: "" })}
            aria-current={status === valor ? "true" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              status === valor
                ? "border-ink bg-ink text-white"
                : "bg-card text-body",
            )}
          >
            {rotulo}
          </Link>
        ))}
        <span className="ml-auto font-mono text-[11.5px] text-fainter">
          {janela ? "últimos 7 dias" : "busca em todo o histórico"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <div
          className={cn(
            COLUNAS,
            "border-b py-2.5 text-[10.5px] font-bold uppercase tracking-[.6px] whitespace-nowrap text-fainter",
          )}
        >
          <span>Data/hora</span>
          <span>De → Para</span>
          <span>Assunto</span>
          <span>Tag</span>
          <span>Status</span>
        </div>

        {logs.length === 0 && (
          <p className="px-4.5 py-6 text-faint">Nenhum envio neste filtro.</p>
        )}

        {logs.map((l) => {
          const [rotulo, tom] = EMAIL_LABEL[l.status];
          const expandido = aberto === l.id;
          return (
            <div key={l.id}>
              <Link
                href={href({ id: expandido ? "" : l.id })}
                scroll={false}
                className={cn(
                  COLUNAS,
                  "items-center border-t py-2.5 text-[12.5px] hover:bg-background",
                  expandido && "bg-background",
                )}
              >
                <span className="font-mono text-[11.5px] text-fainter">
                  {dateTimeBR(l.createdAt)}
                </span>
                <span className="min-w-0 truncate font-mono text-[11.5px] text-mono">
                  {l.from} → {l.to}
                </span>
                <span className="min-w-0 truncate text-body">{l.subject}</span>
                <span>
                  {l.tag && (
                    <span className="rounded bg-line px-2 py-0.5 font-mono text-[10.5px] text-body">
                      {l.tag}
                    </span>
                  )}
                </span>
                <span>
                  <StatusPill tone={tom}>{rotulo}</StatusPill>
                </span>
              </Link>

              {expandido && (
                <div className="border-t border-dashed bg-background py-3 pr-4.5 pl-[126px]">
                  <Evento
                    quando={timeBR(l.createdAt)}
                    ponto="bg-ink"
                    nome="enviado"
                    info={
                      l.usedFallback
                        ? "pelo domínio de fallback do Selo"
                        : "pelo domínio do cliente"
                    }
                  />
                  {l.deliveredAt && (
                    <Evento
                      quando={timeBR(l.deliveredAt)}
                      ponto="bg-ok-dot"
                      nome="entregue"
                      info="aceito pelo servidor do destinatário"
                    />
                  )}
                  {l.errorDetail && (
                    <Evento
                      quando=""
                      ponto="bg-bad-dot"
                      nome={rotulo.toLowerCase()}
                      info={l.errorDetail}
                    />
                  )}
                  <p className="mt-1.5 text-[11px] text-ghost">
                    Conteúdo não armazenado — apenas metadados.{" "}
                    <span className="font-mono">
                      id {l.id}
                      {l.sesMessageId && ` · ses ${l.sesMessageId}`}
                    </span>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Evento({
  quando,
  ponto,
  nome,
  info,
}: {
  quando: string;
  ponto: string;
  nome: string;
  info: string;
}) {
  return (
    <div className="flex items-baseline gap-2.5 py-1 text-xs">
      <span className={cn("size-[7px] shrink-0 rounded-full", ponto)} />
      <span className="w-[110px] shrink-0 font-bold">{nome}</span>
      <span className="font-mono text-[11.5px] text-faint">
        {quando && `${quando} · `}
        {info}
      </span>
    </div>
  );
}
