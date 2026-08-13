"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { entrar, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    entrar,
    {},
  );

  return (
    <form action={action} className="space-y-3.5">
      {state.erro && (
        <p className="rounded-lg bg-bad-bg px-3 py-2.5 text-[12.5px] leading-snug text-bad-fg">
          {state.erro}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-xs font-bold">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="voce@selo.app"
          aria-invalid={!!state.erro}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="senha" className="text-xs font-bold">
          Senha
        </Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          aria-invalid={!!state.erro}
        />
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="w-full bg-brand font-extrabold text-ink shadow-[0_4px_14px_rgba(245,196,0,.25)] hover:bg-brand/90"
      >
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
