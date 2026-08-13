"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { verificarAgora } from "../actions";

export function Verificar({ id }: { id: string }) {
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        onClick={() =>
          startTransition(async () => {
            setErro(null);
            try {
              await verificarAgora(id);
            } catch (e) {
              setErro(
                e instanceof Error ? e.message : "Falha ao consultar o SES.",
              );
            }
          })
        }
        disabled={pendente}
      >
        {pendente ? "Verificando…" : "Verificar agora"}
      </Button>
      {erro && <span className="text-[11px] text-destructive">{erro}</span>}
    </div>
  );
}
