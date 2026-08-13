"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type PublicarState, publicarNaCloudflare } from "../actions";

const DESFECHO = {
  criado: ["publicado ✓", "text-ok-fg"],
  corrigido: ["corrigido ✓", "text-ok-fg"],
  "ja-existia": ["já estava lá", "text-fainter"],
  falhou: ["falhou ✗", "text-destructive"],
} as const;

export function Publicar({ id }: { id: string }) {
  const [pendente, startTransition] = useTransition();
  const [state, setState] = useState<PublicarState | null>(null);

  const falhas = state?.registros?.filter((r) => r.desfecho === "falhou") ?? [];

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        size="sm"
        variant="outline"
        disabled={pendente}
        onClick={() =>
          startTransition(async () => {
            setState(null);
            try {
              setState(await publicarNaCloudflare(id));
            } catch (e) {
              setState({
                erro:
                  e instanceof Error
                    ? e.message
                    : "Falha ao falar com a Cloudflare.",
              });
            }
          })
        }
      >
        {pendente
          ? "Publicando…"
          : falhas.length
            ? `Tentar de novo (${falhas.length})`
            : "Publicar na Cloudflare"}
      </Button>

      {state?.erro && (
        <span className="max-w-[420px] text-right text-[11px] text-destructive">
          {state.erro}
        </span>
      )}

      {/* Por registro, nunca agregado: publicação parcial é o caso comum. */}
      {state?.registros && (
        <ul className="max-w-[460px] space-y-0.5 text-right text-[11px]">
          {state.registros.map((r) => {
            const [texto, cor] = DESFECHO[r.desfecho];
            return (
              <li key={r.type + r.name}>
                <span className="font-mono text-fainter">
                  {r.type} {r.name}
                </span>{" "}
                <span className={cn("font-bold", cor)}>{texto}</span>
                {r.motivo && (
                  <span className="block text-fainter">{r.motivo}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
