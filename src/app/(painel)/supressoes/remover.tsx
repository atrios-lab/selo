"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { removerSupressao } from "./actions";

export function Remover({
  id,
  email,
  cliente,
  data,
  motivo,
  origem,
}: {
  id: string;
  email: string;
  cliente: string;
  data: string;
  motivo: string;
  origem: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-auto px-2.5 py-1 text-[11.5px] text-fainter hover:border-bad-bg hover:text-bad-fg"
        >
          remover
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Remover bloqueio de {email}?</DialogTitle>
          <DialogDescription>
            Este endereço foi bloqueado em <b>{data}</b> por <b>{motivo}</b> (
            {origem}). O Selo parou de aceitar envios para ele para proteger a
            reputação do cliente.
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-lg bg-bad-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-bad-fg">
          Se este endereço continuar devolvendo emails, a reputação de envio de{" "}
          <b>{cliente}</b> — e a entrega de todos os emails dele — pode ser
          prejudicada. Remova apenas se tiver confirmação de que a caixa voltou
          a funcionar.
        </p>
        {erro && <p className="text-xs text-destructive">{erro}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={pendente}
            onClick={() =>
              startTransition(async () => {
                setErro(null);
                try {
                  await removerSupressao(id);
                  setAberto(false);
                } catch (e) {
                  setErro(
                    e instanceof Error
                      ? e.message
                      : "Falha ao remover no SES — o bloqueio continua ativo.",
                  );
                }
              })
            }
          >
            Entendo o risco — remover bloqueio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
