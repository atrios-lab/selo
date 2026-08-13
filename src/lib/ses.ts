import {
  AlreadyExistsException,
  CreateEmailIdentityCommand,
  CreateTenantCommand,
  CreateTenantResourceAssociationCommand,
  DeleteSuppressedDestinationCommand,
  GetEmailIdentityCommand,
  GetTenantCommand,
  PutEmailIdentityMailFromAttributesCommand,
  PutSuppressedDestinationCommand,
  SESv2Client,
  SendEmailCommand,
  UpdateReputationEntityPolicyCommand,
} from "@aws-sdk/client-sesv2";
import type {
  DomainStatus,
  EmailProvider,
  ProvisionResult,
  SendArgs,
  SendResult,
  SuppressionReason,
} from "./email-provider.ts";
import { requireEnv } from "./env.ts";

const region = process.env.AWS_REGION ?? "us-east-1";
const client = new SESv2Client({ region });

/** SES aceita só alfanumérico, `-` e `_` em EmailTags. A tag livre vai crua pro banco. */
export function sesTagValue(tag: string) {
  return tag.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 256);
}

export function formatFrom(address: string, name?: string) {
  if (!name) return address;
  return `"${name.replace(/["\\]/g, "")}" <${address}>`;
}

/**
 * Absorve "já existe" devolvendo null. Provisionar é uma sequência de criações:
 * se a terceira falha, a retentativa precisa atravessar as duas primeiras em vez
 * de morrer nelas.
 */
export async function seNovo<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (error) {
    if (error instanceof AlreadyExistsException) return null;
    throw error;
  }
}

const identityArn = (domain: string) =>
  `arn:aws:ses:${region}:${requireEnv("AWS_ACCOUNT_ID")}:identity/${domain}`;

/**
 * Pausa o envio do tenant sozinho quando bounce/complaint passam do limite —
 * é o que dá sentido a ter um tenant por empresa. A conta `aws` no ARN é
 * literal: a política é gerenciada pela AWS, não pela nossa conta.
 * `standard` porque `strict` pausa cedo demais pro volume do Selo.
 */
async function aplicarPoliticaDeReputacao(tenantArn: string) {
  await client.send(
    new UpdateReputationEntityPolicyCommand({
      ReputationEntityType: "RESOURCE",
      ReputationEntityReference: tenantArn,
      ReputationEntityPolicy: `arn:aws:ses:${region}:aws:reputation-policy/standard`,
    }),
  );
}

export const sesProvider: EmailProvider = {
  async send(args: SendArgs): Promise<SendResult> {
    const res = await client.send(
      new SendEmailCommand({
        FromEmailAddress: formatFrom(args.from, args.fromName),
        Destination: { ToAddresses: [args.to] },
        ReplyToAddresses: args.replyTo ? [args.replyTo] : undefined,
        ConfigurationSetName: requireEnv("SES_CONFIGURATION_SET"),
        TenantName: args.tenant,
        EmailTags: args.tag
          ? [{ Name: "tag", Value: sesTagValue(args.tag) }]
          : undefined,
        Content: {
          Simple: {
            Subject: { Data: args.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: args.htmlBody, Charset: "UTF-8" },
              ...(args.textBody
                ? { Text: { Data: args.textBody, Charset: "UTF-8" } }
                : {}),
            },
          },
        },
      }),
    );

    if (!res.MessageId)
      throw new Error("SES aceitou o envio mas não retornou MessageId");
    return { messageId: res.MessageId };
  },

  async provisionDomain(
    domain: string,
    tenant: string,
  ): Promise<ProvisionResult> {
    const mailFromDomain = `mail.${domain}`;

    const criada = await seNovo(
      client.send(
        new CreateEmailIdentityCommand({
          EmailIdentity: domain,
          ConfigurationSetName: requireEnv("SES_CONFIGURATION_SET"),
        }),
      ),
    );

    // Identity que já existia devolve os mesmos tokens pelo Get.
    const dkimTokens = (
      criada ??
      (await client.send(
        new GetEmailIdentityCommand({ EmailIdentity: domain }),
      ))
    ).DkimAttributes?.Tokens;

    if (!dkimTokens?.length)
      throw new Error(`SES não devolveu tokens de DKIM para ${domain}`);

    await client.send(
      new PutEmailIdentityMailFromAttributesCommand({
        EmailIdentity: domain,
        MailFromDomain: mailFromDomain,
        // Enquanto o MX não estiver publicado, o SES usa o MAIL FROM dele:
        // o envio não pode falhar por DNS pendente.
        BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
      }),
    );

    // Tenant por empresa cliente: isola reputação e supressão. A supressão vai
    // já na criação — uma chamada a menos e um ponto de falha parcial a menos.
    const tenantCriado = await seNovo(
      client.send(
        new CreateTenantCommand({
          TenantName: tenant,
          SuppressionAttributes: { SuppressedReasons: ["BOUNCE", "COMPLAINT"] },
        }),
      ),
    );

    await seNovo(
      client.send(
        new CreateTenantResourceAssociationCommand({
          TenantName: tenant,
          ResourceArn: identityArn(domain),
        }),
      ),
    );

    // O ARN do tenant carrega um id gerado pela AWS — não dá pra montar pelo nome.
    const tenantArn =
      tenantCriado?.TenantArn ??
      (await client.send(new GetTenantCommand({ TenantName: tenant }))).Tenant
        ?.TenantArn;

    if (tenantArn) {
      // Identity e tenant já estão de pé: falhar aqui desfaria um provisionamento
      // válido por causa de um ajuste que a retentativa reaplica.
      try {
        await aplicarPoliticaDeReputacao(tenantArn);
      } catch (error) {
        console.error("Falha ao aplicar política de reputação", {
          tenant,
          error,
        });
      }
    }

    return { dkimTokens, mailFromDomain };
  },

  async domainStatus(domain: string): Promise<DomainStatus> {
    const identity = await client.send(
      new GetEmailIdentityCommand({ EmailIdentity: domain }),
    );

    if (identity.VerifiedForSendingStatus) return "VERIFIED";

    switch (identity.DkimAttributes?.Status) {
      case "SUCCESS":
        return "VERIFIED";
      case "FAILED":
        return "FAILED";
      case "PENDING":
        return "VERIFYING";
      default:
        return "PENDING";
    }
  },

  async suppress(address: string, reason: SuppressionReason, tenant?: string) {
    await client.send(
      new PutSuppressedDestinationCommand({
        EmailAddress: address,
        Reason: reason === "COMPLAINT" ? "COMPLAINT" : "BOUNCE",
        TenantName: tenant,
      }),
    );
  },

  async unsuppress(address: string, tenant?: string) {
    await client.send(
      new DeleteSuppressedDestinationCommand({
        EmailAddress: address,
        TenantName: tenant,
      }),
    );
  },
};
