import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { enviosPorDia, filaDeAcao, indicadores } from "@/lib/farol";
import { dateBR, num } from "@/lib/labels";
import { cn } from "@/lib/utils";

export default async function Farol() {
  const [stats, fila, barras] = await Promise.all([
    indicadores(),
    filaDeAcao(),
    enviosPorDia(),
  ]);

  const pico = Math.max(1, ...barras.map((b) => b.total));
  const total30d = barras.reduce((s, b) => s + b.total, 0);

  return (
    <>
      <header className="mb-5 flex items-baseline justify-between">
        <h1 className="text-[21px] font-extrabold tracking-[-0.4px]">Farol</h1>
        <span className="font-mono text-xs text-fainter">
          {dateBR(new Date())}
        </span>
      </header>

      <div className="mb-5.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.rotulo} className="rounded-[10px] border bg-card p-4.5">
            <div
              className={cn(
                "text-[26px] font-extrabold tabular-nums tracking-[-0.5px]",
                s.alerta && "text-destructive",
              )}
            >
              {s.valor}
            </div>
            <div className="mt-0.5 text-xs text-faint">{s.rotulo}</div>
            {s.sub && (
              <div className="mt-0.5 font-mono text-[11px] text-fainter">
                {s.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-[.3px]">
          Fila de ação
        </h2>
        <span className="text-xs text-fainter">
          {fila.length > 0 &&
            `${fila.length} pendência${fila.length > 1 ? "s" : ""}`}
        </span>
      </div>

      {fila.length === 0 ? (
        <div className="mb-6 flex flex-col items-start gap-5 rounded-xl border bg-card p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-11">
          <div className="carimbo shrink-0 text-sm">Tudo em ordem</div>
          <div>
            <div className="text-base font-extrabold">Nada exige sua ação.</div>
            <div className="text-faint">
              Sem devoluções novas, domínios saudáveis, entrega estável. Pode
              fechar o painel.
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 divide-y rounded-xl border bg-card">
          {fila.map((f) => (
            <div
              key={f.tag + f.mono}
              className="flex items-center gap-3.5 px-4.5 py-3"
            >
              <StatusPill tone={f.tone} className="shrink-0">
                {f.tag}
              </StatusPill>
              <span className="min-w-0 flex-1 text-mono">
                {f.pre}
                <span className="rounded bg-line px-1.5 font-mono text-xs">
                  {f.mono}
                </span>
                {f.post}
              </span>
              <Link
                href={f.href}
                className="shrink-0 rounded-[7px] bg-ink px-3 py-1.5 text-xs font-bold text-white"
              >
                {f.acao}
              </Link>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2.5 text-sm font-extrabold uppercase tracking-[.3px] text-faint">
        Envios · 30 dias
      </h2>
      <div className="rounded-xl border bg-card px-4.5 pt-4.5 pb-3">
        <div
          role="img"
          aria-label={
            total30d === 0
              ? "Nenhum envio nos últimos 30 dias."
              : `Envios por dia nos últimos 30 dias: ${num(total30d)} no total, pico de ${num(pico)} em um dia, ${num(barras[29].total)} hoje.`
          }
          className="flex h-16 items-end gap-1"
        >
          {barras.map((b) => (
            <div
              key={b.dia.toISOString()}
              title={`${dateBR(b.dia)}: ${num(b.total)}`}
              style={{ height: `${Math.max(2, (b.total / pico) * 100)}%` }}
              className={cn(
                "flex-1 rounded-t-[2px]",
                b.hoje ? "bg-brand" : "bg-[#DDD9CD]",
              )}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-ghost">
          <span>{dateBR(barras[0].dia)}</span>
          <span>hoje · {num(total30d)} em 30 d</span>
        </div>
      </div>
    </>
  );
}
