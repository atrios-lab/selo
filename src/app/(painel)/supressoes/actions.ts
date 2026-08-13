"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { sesProvider as provider } from "@/lib/ses";
import { requireOperator } from "@/lib/session";

/**
 * Desbloqueia um endereço. Só o operador faz isso, e só com confirmação:
 * reenviar para um endereço que devolve é o caminho mais curto pra queimar
 * a reputação do cliente.
 */
export async function removerSupressao(id: string) {
  await requireOperator();

  const sup = await prisma.suppressedAddress.findUniqueOrThrow({
    where: { id },
    include: { sendingDomain: { select: { sesTenantName: true } } },
  });

  // Primeiro no SES: se falhar, a linha continua no banco e o envio segue barrado.
  await provider.unsuppress(sup.address, sup.sendingDomain.sesTenantName);
  await prisma.suppressedAddress.delete({ where: { id } });

  revalidatePath("/supressoes");
}
