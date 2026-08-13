"use server";

import { revalidatePath } from "next/cache";
import { generateApiKey, hashApiKey } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/session";

export type NovoProdutoState = { erro?: string; token?: string };

/** Cria o consumidor da API e devolve o token — a única vez que ele existe em claro. */
export async function criarProduto(
  _prev: NovoProdutoState,
  form: FormData,
): Promise<NovoProdutoState> {
  await requireOperator();

  const name = String(form.get("nome") ?? "").trim();
  if (!name) return { erro: "Informe o nome do produto." };

  const token = generateApiKey();
  try {
    await prisma.product.create({
      data: { name, apiKeyHash: hashApiKey(token) },
    });
  } catch {
    return { erro: `Já existe um produto chamado "${name}".` };
  }

  revalidatePath("/produtos");
  return { token };
}

/**
 * Revogar = desativar. A linha fica, porque os EmailLog dela apontam pra cá e
 * o histórico do envio precisa continuar legível.
 */
export async function revogarProduto(id: string) {
  await requireOperator();
  await prisma.product.update({ where: { id }, data: { active: false } });
  revalidatePath("/produtos");
}
