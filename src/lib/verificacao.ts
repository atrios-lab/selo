import type { CheckedRecord } from "./dns.ts";
import type { DomainStatus } from "./email-provider.ts";

/**
 * Decide o status a gravar. Sem IO de propósito: é a regra que o cron aplica a
 * cada domínio, e a única parte dele que dá pra testar sem AWS e sem DNS.
 *
 * O SES é a fonte da verdade da autenticação — ele é quem decide se assina. O
 * DNS que conferimos por conta própria serve para pegar regressão *antes* de o
 * SES perceber, e só isso.
 */
export function proximoStatus(args: {
  ses: DomainStatus;
  registros: CheckedRecord[];
}): DomainStatus {
  if (args.ses !== "VERIFIED") return args.ses;

  // Só rebaixa com evidência: registro ausente por resposta do DNS, ou publicado
  // com valor errado. Timeout e SERVFAIL não provam nada — manter VERIFIED é a
  // leitura conservadora, e o SES ainda está dizendo que está tudo certo.
  const quebrado = args.registros.some(
    (r) => r.state !== "ok" && !r.inconclusive,
  );

  return quebrado ? "FAILED" : "VERIFIED";
}
