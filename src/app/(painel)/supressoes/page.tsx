import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { prisma } from "@/lib/db";
import {
  dateBR,
  num,
  SUPPRESSION_LABEL,
  SUPPRESSION_REASON_TEXT,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Remover } from "./remover";

const COLUNAS =
  "grid min-w-[700px] grid-cols-[minmax(170px,1.6fr)_minmax(80px,1fr)_110px_86px_92px_74px] items-center gap-x-3 px-4.5";

const CONCENTRACAO = 10;

export default async function Supressoes({
  searchParams,
}: PageProps<"/supressoes">) {
  const sp = await searchParams;
  const dominioId = typeof sp.dominio === "string" ? sp.dominio : "";

  const [supressoes, recentes] = await Promise.all([
    prisma.suppressedAddress.findMany({
      where: dominioId ? { sendingDomainId: dominioId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        sendingDomain: { select: { id: true, clientName: true } },
      },
    }),
    // Concentração em 30 dias: lista suja é o risco nº 1 de reputação.
    prisma.suppressedAddress.groupBy({
      by: ["sendingDomainId"],
      where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      _count: true,
      having: { sendingDomainId: { _count: { gte: CONCENTRACAO } } },
    }),
  ]);

  const clientes = new Map(
    supressoes.map((s) => [s.sendingDomain.id, s.sendingDomain.clientName]),
  );
  // O alerta de concentração pode citar um cliente que o filtro atual esconde.
  for (const d of await prisma.sendingDomain.findMany({
    where: {
      id: { in: [...recentes.map((r) => r.sendingDomainId), dominioId] },
    },
    select: { id: true, clientName: true },
  })) {
    clientes.set(d.id, d.clientName);
  }

  return (
    <>
      <h1 className="mb-4 text-[21px] font-extrabold tracking-[-0.4px]">
        Supressões
      </h1>

      {recentes.map((r) => (
        <div
          key={r.sendingDomainId}
          className="mb-4 flex items-center gap-2.5 rounded-[10px] border border-warn-dot/40 bg-warn-bg px-4 py-3 text-[12.5px] text-warn-fg"
        >
          <span className="font-extrabold whitespace-nowrap">
            ⚠ Concentração:
          </span>
          <span>
            <b>{clientes.get(r.sendingDomainId) ?? r.sendingDomainId}</b>{" "}
            acumulou {num(r._count)} supressões em 30 dias. Possível lista de
            emails suja — risco à reputação de envio.
          </span>
          <Link
            href={`/envios?dominio=${r.sendingDomainId}`}
            className="ml-auto rounded-[7px] bg-ink px-3 py-1.5 text-xs font-bold whitespace-nowrap text-white no-underline"
          >
            Investigar envios
          </Link>
        </div>
      ))}

      {dominioId && (
        <p className="mb-3 text-xs text-faint">
          Filtrado por {clientes.get(dominioId) ?? dominioId} ·{" "}
          <Link href="/supressoes">ver todas</Link>
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <div
          className={cn(
            COLUNAS,
            "border-b py-2.5 text-[10.5px] font-bold uppercase tracking-[.6px] whitespace-nowrap text-fainter",
          )}
        >
          <span>Endereço</span>
          <span>Cliente</span>
          <span>Motivo</span>
          <span>Data</span>
          <span>Origem</span>
          <span />
        </div>

        {supressoes.length === 0 && (
          <p className="px-4.5 py-6 text-faint">
            Nenhum endereço bloqueado — lista limpa.
          </p>
        )}

        {supressoes.map((s) => {
          const [rotulo, tom] = SUPPRESSION_LABEL[s.reason];
          const origem = s.reason === "MANUAL" ? "manual" : "automática";
          return (
            <div key={s.id} className={cn(COLUNAS, "border-t py-2.5")}>
              <span className="font-mono text-[11.5px] text-mono">
                {s.address}
              </span>
              <span className="truncate font-semibold">
                {s.sendingDomain.clientName}
              </span>
              <span>
                <StatusPill tone={tom}>{rotulo}</StatusPill>
              </span>
              <span className="tabular-nums text-faint">
                {dateBR(s.createdAt)}
              </span>
              <span className="text-faint">{origem}</span>
              <span className="text-right">
                <Remover
                  id={s.id}
                  email={s.address}
                  cliente={s.sendingDomain.clientName}
                  data={dateBR(s.createdAt)}
                  motivo={SUPPRESSION_REASON_TEXT[s.reason]}
                  origem={origem}
                />
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
