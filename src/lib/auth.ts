import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db.ts";

/** Token de alta entropia: sha256 basta, não precisa de KDF lento. */
export function hashApiKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Exibido UMA vez no painel; só o hash vai pro banco. */
export function generateApiKey(): string {
  return `selo_${randomBytes(32).toString("base64url")}`;
}

export async function authenticateProduct(req: Request) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice(7).trim();
  if (!token) return null;

  return prisma.product.findFirst({
    where: { apiKeyHash: hashApiKey(token), active: true },
  });
}
