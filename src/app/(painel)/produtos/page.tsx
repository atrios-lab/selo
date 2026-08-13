import { StatusPill } from "@/components/status-pill";
import { prisma } from "@/lib/db";
import { dateBR, since } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { NovoProduto } from "./novo-produto";
import { Revogar } from "./revogar";

const COLUNAS =
  "grid min-w-[620px] grid-cols-[minmax(140px,1.5fr)_96px_104px_110px_84px] items-center gap-x-3 px-4.5";

export default async function Produtos() {
  const produtos = await prisma.product.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      active: true,
      createdAt: true,
      emailLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  return (
    <>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-[21px] font-extrabold tracking-[-0.4px]">
          Produtos
        </h1>
        <NovoProduto />
      </header>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <div
          className={cn(
            COLUNAS,
            "border-b py-2.5 text-[10.5px] font-bold uppercase tracking-[.6px] whitespace-nowrap text-fainter",
          )}
        >
          <span>Nome</span>
          <span>Status</span>
          <span>Criado em</span>
          <span>Último uso</span>
          <span />
        </div>

        {produtos.length === 0 && (
          <p className="px-4.5 py-6 text-faint">
            Nenhum produto ainda — sem token, ninguém envia pela API.
          </p>
        )}

        {produtos.map((p) => (
          <div
            key={p.id}
            className={cn(COLUNAS, "border-t py-3 text-[12.5px]")}
          >
            <span className="font-bold">{p.name}</span>
            <span>
              <StatusPill tone={p.active ? "ok" : "mute"}>
                {p.active ? "ativo" : "revogado"}
              </StatusPill>
            </span>
            <span className="tabular-nums text-faint">
              {dateBR(p.createdAt)}
            </span>
            <span className="font-mono text-[11.5px] tabular-nums text-faint">
              {since(p.emailLogs[0]?.createdAt)}
            </span>
            <span className="text-right">
              {p.active && <Revogar id={p.id} nome={p.name} />}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
