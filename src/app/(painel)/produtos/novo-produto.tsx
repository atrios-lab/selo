"use client";

import { useActionState, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarProduto, type NovoProdutoState } from "./actions";

export function NovoProduto() {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [state, action, pending] = useActionState<NovoProdutoState, FormData>(
    criarProduto,
    {},
  );

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) setCopiado(false);
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-brand font-extrabold text-ink hover:bg-brand/90">
          + Novo produto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[460px]">
        {state.token ? (
          <>
            <DialogHeader>
              <DialogTitle>Token gerado</DialogTitle>
              <DialogDescription>
                Copie e guarde agora.{" "}
                <b>Este token não será mostrado de novo</b> — se perder, será
                preciso revogar e criar outro produto.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 rounded-lg bg-ink px-3.5 py-3">
              <span className="flex-1 break-all font-mono text-xs text-brand">
                {state.token}
              </span>
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(state.token ?? "");
                  setCopiado(true);
                }}
                className="bg-brand font-extrabold text-ink hover:bg-brand/90"
              >
                {copiado ? "copiado ✓" : "copiar"}
              </Button>
            </div>

            <DialogFooter>
              <Button
                disabled={!copiado}
                onClick={() => setAberto(false)}
                title={copiado ? undefined : "Copie o token antes de concluir"}
              >
                Já copiei e salvei — concluir
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form action={action}>
            <DialogHeader>
              <DialogTitle>Novo produto</DialogTitle>
              <DialogDescription>
                Um produto é um consumidor da API — cada um com seu token.
              </DialogDescription>
            </DialogHeader>

            <div className="my-5 space-y-1.5">
              <Label htmlFor="nome" className="text-xs font-bold">
                Nome do produto
              </Label>
              <Input
                id="nome"
                name="nome"
                placeholder="ex: Portal do Cliente"
                aria-invalid={!!state.erro}
                required
              />
              {state.erro && (
                <p className="text-xs text-destructive">{state.erro}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAberto(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={pending}
                className="bg-brand font-extrabold text-ink hover:bg-brand/90"
              >
                Criar e gerar token
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
