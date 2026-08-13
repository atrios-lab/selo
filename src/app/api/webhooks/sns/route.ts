import type { NextRequest } from "next/server";
import MessageValidator from "sns-validator";
import { prisma } from "@/lib/db";
import { requireEnv } from "@/lib/env";
import { sesProvider as provider } from "@/lib/ses";
import { classifySesEvent, type SesEvent } from "@/lib/ses-events";

// O validator já checa por padrão que o certificado veio de sns.<região>.amazonaws.com.
const validator = new MessageValidator();

function validateSignature(payload: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    validator.validate(payload, (err) => (err ? reject(err) : resolve()));
  });
}

/** Confirma a inscrição no tópico. Só roda depois de assinatura + TopicArn validados. */
async function confirmSubscription(subscribeUrl: unknown): Promise<Response> {
  if (typeof subscribeUrl !== "string") {
    return new Response("SubscribeURL ausente", { status: 400 });
  }

  const url = new URL(subscribeUrl);
  if (
    !/^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(url.hostname) ||
    url.protocol !== "https:"
  ) {
    return new Response("SubscribeURL fora do domínio da AWS", { status: 403 });
  }

  const res = await fetch(url);
  if (!res.ok)
    return new Response("Falha ao confirmar a inscrição", { status: 502 });

  return new Response("inscrição confirmada");
}

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(await req.text());
  } catch {
    return new Response("payload não é JSON", { status: 400 });
  }

  // Rota pública: TopicArn primeiro (barato), assinatura depois (custa I/O do certificado).
  if (payload.TopicArn !== requireEnv("SNS_TOPIC_ARN")) {
    return new Response("TopicArn desconhecido", { status: 403 });
  }

  try {
    await validateSignature(payload);
  } catch {
    return new Response("assinatura inválida", { status: 403 });
  }

  if (payload.Type === "SubscriptionConfirmation") {
    return confirmSubscription(payload.SubscribeURL);
  }

  if (payload.Type !== "Notification") {
    return new Response("ok");
  }

  let event: SesEvent;
  try {
    event = JSON.parse(String(payload.Message));
  } catch {
    return new Response("Message não é JSON", { status: 400 });
  }

  const action = classifySesEvent(event);
  if (!action) return new Response("ok");

  const sesMessageId = event.mail?.messageId;
  const log = sesMessageId
    ? await prisma.emailLog.findFirst({
        where: { sesMessageId },
        include: { sendingDomain: true },
      })
    : null;

  if (log) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        // Bounce transiente não mexe no status — o SES ainda vai re-tentar.
        ...(action.status ? { status: action.status } : {}),
        ...(action.deliveredAt ? { deliveredAt: action.deliveredAt } : {}),
        ...(action.detail ? { errorDetail: action.detail } : {}),
      },
    });
  }

  // O log pode não existir ainda (evento chegou antes de gravarmos o sesMessageId).
  // A supressão é crítica demais pra depender disso: cai pro domínio do remetente.
  const sourceDomain = event.mail?.source?.toLowerCase().split("@")[1];
  const domain =
    log?.sendingDomain ??
    (sourceDomain
      ? await prisma.sendingDomain.findUnique({
          where: { domain: sourceDomain },
        })
      : null);

  if (domain) {
    for (const { address, reason } of action.suppress) {
      // SNS entrega pelo menos uma vez — upsert pra reprocessar sem duplicar.
      await prisma.suppressedAddress.upsert({
        where: {
          sendingDomainId_address: { sendingDomainId: domain.id, address },
        },
        create: {
          sendingDomainId: domain.id,
          address,
          reason,
          detail: action.detail,
        },
        update: {},
      });

      // Espelhar no SES é otimização de reputação; a lista do Selo é a que /v1/send
      // consulta, então uma falha aqui não pode derrubar o webhook (SNS re-tentaria
      // e re-suprimiria à toa).
      try {
        await provider.suppress(address, reason, domain.sesTenantName);
      } catch (error) {
        console.error("Falha ao espelhar supressão no SES", { address, error });
      }
    }
  }

  return new Response("ok");
}
