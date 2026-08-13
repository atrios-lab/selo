import type {
  DomainStatus,
  EmailStatus,
  SuppressionReason,
} from "@/generated/prisma/enums";

export type Tone = "ok" | "bad" | "warn" | "mute" | "idle";

export const DOMAIN_LABEL: Record<DomainStatus, [string, Tone]> = {
  FAILED: ["Falhou", "bad"],
  VERIFYING: ["Verificando", "warn"],
  PENDING: ["Pendente", "mute"],
  VERIFIED: ["Verificado", "ok"],
};

export const EMAIL_LABEL: Record<EmailStatus, [string, Tone]> = {
  SENT: ["Enviado", "mute"],
  DELIVERED: ["Entregue", "ok"],
  BOUNCED: ["Devolvido", "bad"],
  COMPLAINED: ["Marcado como spam", "bad"],
  SUPPRESSED: ["Bloqueado", "mute"],
  REJECTED: ["Recusado", "bad"],
};

export const SUPPRESSION_LABEL: Record<SuppressionReason, [string, Tone]> = {
  HARD_BOUNCE: ["devolvido", "bad"],
  COMPLAINT: ["spam", "bad"],
  MANUAL: ["manual", "mute"],
};

/** Por que o endereço foi bloqueado, em uma frase — o modal de remoção usa isto. */
export const SUPPRESSION_REASON_TEXT: Record<SuppressionReason, string> = {
  HARD_BOUNCE: "devolução definitiva (endereço não existe)",
  COMPLAINT: "marcação de spam pelo destinatário",
  MANUAL: "bloqueio manual",
};

/** Ordem da lista de domínios: problema primeiro, saudável por último. */
/**
 * `FAILED` cobre dois casos bem diferentes, e o banco já sabe distinguir: se o
 * domínio um dia chegou a `verifiedAt`, ele parou de funcionar — não é o mesmo
 * que nunca ter autenticado. Sem estado novo, sem migration.
 */
export function domainLabel(d: {
  status: DomainStatus;
  verifiedAt: Date | null;
}): readonly [string, Tone] {
  if (d.status === "FAILED" && d.verifiedAt)
    return ["Parou de autenticar", "bad"] as const;
  return DOMAIN_LABEL[d.status];
}

export const DOMAIN_ORDER: Record<DomainStatus, number> = {
  FAILED: 0,
  VERIFYING: 1,
  PENDING: 2,
  VERIFIED: 3,
};

/** "há 3 h", "há 42 d" — o painel fala em idade, não em timestamp. */
export function since(date: Date | null | undefined, now = Date.now()) {
  if (!date) return "—";
  const s = Math.max(0, (now - date.getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

export const dateBR = (d: Date) =>
  d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export const dateTimeBR = (d: Date) =>
  d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

export const timeBR = (d: Date) =>
  d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

export const pct = (n: number) =>
  `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export const num = (n: number) => n.toLocaleString("pt-BR");
