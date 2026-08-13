import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateProduct } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireEnv } from "@/lib/env";
import { withinRateLimit } from "@/lib/rate-limit";
import { sesProvider as provider } from "@/lib/ses";

const sendSchema = z.object({
  from: z.email(),
  fromName: z.string().max(120).optional(),
  // v1: um destinatário só.
  to: z.email(),
  replyTo: z.email().optional(),
  subject: z.string().min(1).max(200),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
  tag: z.string().max(100).optional(),
  idempotencyKey: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.json()).optional(),
});

function apiError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  const product = await authenticateProduct(req);
  if (!product) {
    return apiError(
      401,
      "UNAUTHORIZED",
      "Token ausente, inválido ou produto inativo.",
    );
  }

  if (!withinRateLimit(product.id)) {
    return apiError(
      429,
      "RATE_LIMITED",
      "Limite de envios por minuto excedido para este produto.",
    );
  }

  const parsed = sendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const onRecipient = parsed.error.issues.some((i) => i.path[0] === "to");
    return apiError(
      422,
      onRecipient ? "INVALID_RECIPIENT" : "INVALID_REQUEST",
      z.prettifyError(parsed.error),
    );
  }
  const body = parsed.data;
  const to = body.to.toLowerCase();
  const from = body.from.toLowerCase();

  const domain = await prisma.sendingDomain.findUnique({
    where: { domain: from.split("@")[1] },
  });
  if (!domain) {
    return apiError(
      422,
      "UNKNOWN_DOMAIN",
      `O domínio "${from.split("@")[1]}" não está cadastrado no Selo.`,
    );
  }

  const suppressed = await prisma.suppressedAddress.findUnique({
    where: {
      sendingDomainId_address: { sendingDomainId: domain.id, address: to },
    },
  });
  if (suppressed) {
    await prisma.emailLog.create({
      data: {
        productId: product.id,
        sendingDomainId: domain.id,
        from,
        to,
        subject: body.subject,
        tag: body.tag,
        metadata: body.metadata,
        idempotencyKey: body.idempotencyKey,
        status: "SUPPRESSED",
        errorDetail: `Endereço suprimido (${suppressed.reason}) em ${suppressed.createdAt.toISOString()}`,
      },
    });
    return apiError(
      422,
      "SUPPRESSED",
      `${to} está na lista de supressão de ${domain.domain} (${suppressed.reason}).`,
    );
  }

  // DNS pendente nunca derruba o envio: sai pelo domínio do Selo com Reply-To original.
  const usedFallback = domain.fallbackOnly || domain.status !== "VERIFIED";

  // ponytail: a linha é criada como SENT antes do SES responder — é a reserva que
  // torna a idempotencyKey atômica (unique em productId+idempotencyKey). Falha vira
  // REJECTED logo abaixo. Sem fila, a janela é de um round-trip.
  let log: { id: string };
  try {
    log = await prisma.emailLog.create({
      data: {
        productId: product.id,
        sendingDomainId: domain.id,
        from,
        to,
        subject: body.subject,
        tag: body.tag,
        metadata: body.metadata,
        idempotencyKey: body.idempotencyKey,
        status: "SENT",
        usedFallback,
      },
      select: { id: true },
    });
  } catch {
    // Colisão de idempotencyKey: devolve o resultado original, não reenvia.
    const original = body.idempotencyKey
      ? await prisma.emailLog.findUnique({
          where: {
            productId_idempotencyKey: {
              productId: product.id,
              idempotencyKey: body.idempotencyKey,
            },
          },
        })
      : null;

    if (!original) throw new Error("Falha ao registrar o envio");

    return Response.json({
      messageId: original.sesMessageId ?? original.id,
      status: original.status,
      usedFallback: original.usedFallback,
    });
  }

  try {
    const { messageId } = await provider.send({
      from: usedFallback
        ? `noreply@${requireEnv("SELO_FALLBACK_DOMAIN")}`
        : from,
      fromName: body.fromName,
      to,
      replyTo: body.replyTo ?? (usedFallback ? from : undefined),
      subject: body.subject,
      htmlBody: body.htmlBody,
      textBody: body.textBody,
      tag: body.tag,
      // O fallback não pertence ao tenant do cliente.
      tenant: usedFallback ? undefined : domain.sesTenantName,
    });

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { sesMessageId: messageId },
    });

    return Response.json({ messageId, status: "SENT", usedFallback });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "REJECTED", errorDetail: detail },
    });
    return apiError(502, "PROVIDER_ERROR", `O SES recusou o envio: ${detail}`);
  }
}
