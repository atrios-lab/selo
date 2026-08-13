"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
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
import { type AddState, adicionarDominio } from "./actions";

export function AdicionarDominio() {
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState<AddState, FormData>(
    adicionarDominio,
    {},
  );
  const router = useRouter();

  // Cadastrou: vai direto pros registros DNS, que é o próximo passo real.
  useEffect(() => {
    if (state.ok) {
      setAberto(false);
      router.push(`/dominios/${state.ok.id}`);
    }
  }, [state.ok, router]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button className="bg-brand font-extrabold text-ink hover:bg-brand/90">
          + Adicionar domínio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[460px]">
        <form action={action}>
          <DialogHeader>
            <DialogTitle>Adicionar domínio</DialogTitle>
            <DialogDescription>
              O domínio nasce em <b>Pendente</b> — os envios do cliente saem
              pelo fallback até a autenticação concluir.
            </DialogDescription>
          </DialogHeader>

          <div className="my-5 space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="cliente" className="text-xs font-bold">
                Cliente
              </Label>
              <Input
                id="cliente"
                name="cliente"
                placeholder="ex: Acme"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dominio" className="text-xs font-bold">
                Domínio remetente
              </Label>
              <Input
                id="dominio"
                name="dominio"
                placeholder="acme.com.br"
                className="font-mono"
                aria-invalid={!!state.erro}
                required
              />
            </div>
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
              {pending ? "Criando identidade no SES…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
