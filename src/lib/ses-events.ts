import type { EmailStatus, SuppressionReason } from "@/generated/prisma/enums";

/** Payload que o SES publica no SNS. Só os campos que o Selo usa. */
export type SesEvent = {
  /** Config Set event destination usa `eventType`; notificação de identidade usa `notificationType`. */
  eventType?: string;
  notificationType?: string;
  mail?: {
    messageId?: string;
    source?: string;
  };
  bounce?: {
    bounceType?: string;
    bounceSubType?: string;
    bouncedRecipients?: { emailAddress?: string; diagnosticCode?: string }[];
  };
  complaint?: {
    complainedRecipients?: { emailAddress?: string }[];
    complaintFeedbackType?: string;
  };
  delivery?: { timestamp?: string };
};

export type EventAction = {
  /** Ausente = não mexe no status do log (caso do bounce transiente). */
  status?: EmailStatus;
  deliveredAt?: Date;
  detail?: string;
  suppress: { address: string; reason: SuppressionReason }[];
};

function addressesOf(recipients?: { emailAddress?: string }[]): string[] {
  return (recipients ?? [])
    .map((r) => r.emailAddress?.toLowerCase())
    .filter((a): a is string => Boolean(a));
}

/**
 * Traduz o evento do SES na ação a aplicar. Sem IO — a rota é quem grava.
 * Retorna null pros eventos que o v1 ignora (Send, DeliveryDelay, Open, Click).
 */
export function classifySesEvent(event: SesEvent): EventAction | null {
  const type = event.eventType ?? event.notificationType;

  if (type === "Bounce") {
    const addresses = addressesOf(event.bounce?.bouncedRecipients);
    const diagnostic = event.bounce?.bouncedRecipients?.[0]?.diagnosticCode;
    const subType = event.bounce?.bounceSubType;

    // Transiente: caixa cheia, servidor fora do ar. O SES re-tenta sozinho —
    // suprimir aqui queimaria um destinatário que ainda é válido.
    if (event.bounce?.bounceType !== "Permanent") {
      return {
        detail: `Bounce transiente (${subType ?? "sem subtipo"}): ${diagnostic ?? "sem diagnóstico"}`,
        suppress: [],
      };
    }

    return {
      status: "BOUNCED",
      detail: `Bounce permanente (${subType ?? "sem subtipo"}): ${diagnostic ?? "sem diagnóstico"}`,
      suppress: addresses.map((address) => ({
        address,
        reason: "HARD_BOUNCE" as const,
      })),
    };
  }

  if (type === "Complaint") {
    const feedback = event.complaint?.complaintFeedbackType;
    return {
      status: "COMPLAINED",
      detail: `Reclamação de spam${feedback ? ` (${feedback})` : ""}`,
      suppress: addressesOf(event.complaint?.complainedRecipients).map(
        (address) => ({
          address,
          reason: "COMPLAINT" as const,
        }),
      ),
    };
  }

  if (type === "Delivery") {
    const timestamp = event.delivery?.timestamp;
    const parsed = timestamp ? new Date(timestamp) : null;
    return {
      status: "DELIVERED",
      deliveredAt:
        parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(),
      suppress: [],
    };
  }

  if (type === "Reject") {
    return {
      status: "REJECTED",
      detail: "SES recusou a mensagem",
      suppress: [],
    };
  }

  return null;
}
