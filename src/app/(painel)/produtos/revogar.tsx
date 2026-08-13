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
import { revogarProduto } from "./actions";

export function Revogar({ id, nome }: { id: string; nome: string }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, startTransition] = useTransition();

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-auto px-2.5 py-1 text-[11.5px] text-fainter hover:border-bad-bg hover:text-bad-fg"
        >
          revogar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Revogar {nome}?</DialogTitle>
          <DialogDescription>
            O token deixa de funcionar <b>imediatamente</b>. Todo envio feito
            por este produto passará a falhar com 401 até um novo token ser
            configurado.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={pendente}
            onClick={() =>
              startTransition(async () => {
                await revogarProduto(id);
                setAberto(false);
              })
            }
          >
            Revogar token
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
