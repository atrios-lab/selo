/**
 * Contrato do provedor de entrega. Trocar de provedor = escrever outro adapter
 * (ver src/lib/ses.ts) e mudar a linha que exporta `provider`.
 */

export type SendArgs = {
  from: string;
  fromName?: string;
  to: string;
  replyTo?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  tag?: string;
  /** Tenant de reputação/supressão do cliente. Ausente = nível da conta (fallback). */
  tenant?: string;
};

export type SendResult = { messageId: string };

export type SuppressionReason = "HARD_BOUNCE" | "COMPLAINT" | "MANUAL";

export type ProvisionResult = {
  dkimTokens: string[];
  mailFromDomain: string;
};

export type DomainStatus = "PENDING" | "VERIFYING" | "VERIFIED" | "FAILED";

export interface EmailProvider {
  send(args: SendArgs): Promise<SendResult>;
  /** Cria a identidade do domínio + o tenant de reputação do cliente. */
  provisionDomain(domain: string, tenant: string): Promise<ProvisionResult>;
  /** Estado da autenticação do domínio no provedor (fonte da verdade). */
  domainStatus(domain: string): Promise<DomainStatus>;
  /** Espelha a supressão no provedor, no escopo do tenant quando houver. */
  suppress(
    address: string,
    reason: SuppressionReason,
    tenant?: string,
  ): Promise<void>;
  unsuppress(address: string, tenant?: string): Promise<void>;
}
