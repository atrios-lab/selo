"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Valor técnico + botão de copiar — o operador cola isto no painel do DNS. */
export function Copiavel({
  valor,
  className,
}: {
  valor: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  return (
    <span className={cn("flex min-w-0 items-baseline gap-1.5", className)}>
      <span className="break-all font-mono text-[11.5px] text-mono">
        {valor}
      </span>
      <button
        type="button"
        title={`copiar ${valor}`}
        aria-label={copiado ? `${valor} copiado` : `copiar ${valor}`}
        onClick={() => {
          navigator.clipboard.writeText(valor);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1600);
        }}
        className="shrink-0 text-ghost hover:text-ink"
      >
        {copiado ? (
          <Check className="size-3 text-ok-fg" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    </span>
  );
}
