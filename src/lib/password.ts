import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { requireEnv } from "./env.ts";

// ponytail: operador único — a "base de usuários" são duas env vars.

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Formato do SELO_OPERATOR_PASSWORD_HASH: `<salt-hex>:<scrypt-hex>`. */
export function hashPassword(password: string, salt = randomBytes(16)) {
  const derived = scryptSync(password.normalize("NFKC"), salt, 32);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [saltHex, expected] = stored.split(":");
  if (!saltHex || !expected) return false;
  const [, actual] = hashPassword(password, Buffer.from(saltHex, "hex")).split(
    ":",
  );
  return safeEqual(actual, expected);
}

export function checkCredentials(email: string, password: string) {
  const okEmail = safeEqual(
    email.trim().toLowerCase(),
    requireEnv("SELO_OPERATOR_EMAIL").trim().toLowerCase(),
  );
  // Sempre roda o scrypt: senha errada e email errado levam o mesmo tempo.
  const okPassword = verifyPassword(
    password,
    requireEnv("SELO_OPERATOR_PASSWORD_HASH"),
  );
  return okEmail && okPassword;
}
