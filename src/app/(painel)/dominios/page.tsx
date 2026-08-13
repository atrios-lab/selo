import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { prisma } from "@/lib/db";
import { entregaPorDominio } from "@/lib/farol";
import { DOMAIN_ORDER, domainLabel, num, pct, since } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { AdicionarDominio } from "./adicionar-dominio";

const FILTROS = [
  ["todos", "todos"],
  ["problemas", "problemas"],
  ["PENDING", "pendente"],
  ["VERIFYING", "verificando"],
  ["VERIFIED", "verificado"],
  ["fallback", "fallback"],
] as const;

const COLUNAS =
  "grid min-w-[720px] grid-cols-[minmax(90px,1fr)_minmax(150px,1.5fr)_130px_92px_88px_84px] gap-x-3 px-4.5";

export default async function Dominios({
  searchParams,
}: PageProps<"/dominios">) {
  const { estado = "todos" } = await searchParams;
  const filtro = String(estado);

  const [dominios, entrega] = await Promise.all([
    prisma.sendingDomain.findMany({
      select: {
        id: true,
        clientName: true,
        domain: true,
        status: true,
        fallbackOnly: true,
        createdAt: true,
        verifiedAt: true,
        lastCheckedAt: true,
      },
    }),
    entregaPorDominio(new Date(Date.now() - 30 * 86_400_000)),
  ]);

  // Problema primeiro: a lista existe pra mostrar o que precisa de ação.
  const linhas = dominios
    .map((d) => {
      const stats = entrega.get(d.id);
      const taxa = stats?.total ? stats.entregues / stats.total : null;
      return {
        ...d,
        enviados: stats?.total ?? 0,
        taxa,
        caindo: taxa !== null && taxa < 0.95 && (stats?.total ?? 0) >= 20,
      };
    })
    .filter((d) => {
      if (filtro === "todos") return true;
      if (filtro === "fallback") return d.fallbackOnly;
      if (filtro === "problemas") return d.status === "FAILED" || d.caindo;
      return d.status === filtro;
    })
    .sort(
      (a, b) =>
        DOMAIN_ORDER[a.status] -
        (a.caindo ? 3 : 0) -
        (DOMAIN_ORDER[b.status] - (b.caindo ? 3 : 0)),
    );

  return (
    <>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-[21px] font-extrabold tracking-[-0.4px]">
          Domínios
        </h1>
        <AdicionarDominio />
      </header>

      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {FILTROS.map(([valor, rotulo]) => (
          <Link
            key={valor}
            href={valor === "todos" ? "/dominios" : `/dominios?estado=${valor}`}
            aria-current={filtro === valor ? "true" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              filtro === valor
                ? "border-ink bg-ink text-white"
                : "bg-card text-body",
            )}
          >
            {rotulo}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <div
          className={cn(
            COLUNAS,
            "border-b py-2.5 text-[10.5px] font-bold uppercase tracking-[.6px] whitespace-nowrap text-fainter",
          )}
        >
          <span>Cliente</span>
          <span>Domínio</span>
          <span>Estado</span>
          <span>No estado há</span>
          <span>Entrega 30d</span>
          <span>Enviados 30d</span>
        </div>

        {linhas.length === 0 && (
          <p className="px-4.5 py-6 text-faint">Nenhum domínio neste filtro.</p>
        )}

        {linhas.map((d) => {
          const [rotulo, tom] = d.fallbackOnly
            ? (["Fallback", "idle"] as const)
            : domainLabel(d);
          return (
            <Link
              key={d.id}
              href={`/dominios/${d.id}`}
              className={cn(
                COLUNAS,
                "items-center border-t py-2.5 hover:bg-background",
              )}
            >
              <span className="truncate font-bold">{d.clientName}</span>
              <span className="truncate font-mono text-xs text-mono">
                {d.domain}
              </span>
              <span>
                <StatusPill tone={tom}>{rotulo}</StatusPill>
              </span>
              <span className="tabular-nums text-faint">
                {since(d.verifiedAt ?? d.createdAt)}
                {/* Conferência velha em todos = cron parado, não domínio estável. */}
                <span className="block text-[10.5px] text-ghost">
                  conferido {since(d.lastCheckedAt)}
                </span>
              </span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  d.caindo && "text-warn-fg",
                  d.taxa === null && "text-ghost",
                )}
              >
                {d.taxa === null ? "—" : pct(d.taxa)}
                {d.caindo && (
                  <span className="block text-[10.5px] font-bold">
                    ↓ caindo
                  </span>
                )}
              </span>
              <span className="tabular-nums text-faint">{num(d.enviados)}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
