import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { requireEnv } from "./env.ts";
import { safeEqual } from "./password.ts";

// ponytail: operador único — sessão é um cookie assinado, sem tabela nem lib de auth.
const COOKIE = "selo_session";
const TTL_MS = 12 * 60 * 60 * 1000;

function sign(payload: string) {
  return createHmac("sha256", requireEnv("SELO_SESSION_SECRET"))
    .update(payload)
    .digest("base64url");
}

export async function startSession() {
  const exp = String(Date.now() + TTL_MS);
  const store = await cookies();
  store.set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function hasSession() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
}

/** Toda action do painel chama isto — renderizar a tela não é fronteira de segurança. */
export async function requireOperator() {
  if (!(await hasSession()))
    throw new Error("Sessão expirada — entre de novo.");
}
