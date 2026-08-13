"use server";

import { redirect } from "next/navigation";
import { checkCredentials } from "@/lib/password";
import { withinRateLimit } from "@/lib/rate-limit";
import { startSession } from "@/lib/session";

export type LoginState = { erro?: string };

export async function entrar(
  _prev: LoginState,
  form: FormData,
): Promise<LoginState> {
  const email = String(form.get("email") ?? "");
  const senha = String(form.get("senha") ?? "");

  // Rota pública: 5 tentativas por 15 min. Sem isto, o scrypt vira alvo de força bruta.
  if (!withinRateLimit("login", { max: 5, windowMs: 15 * 60_000 })) {
    return {
      erro: "Muitas tentativas. O acesso fica bloqueado por 15 minutos.",
    };
  }

  if (!checkCredentials(email, senha)) {
    return { erro: "Email ou senha incorretos." };
  }

  await startSession();
  redirect("/");
}
