import { Resolver } from "node:dns/promises";

export type DnsRecord = {
  type: "CNAME" | "MX" | "TXT";
  name: string;
  value: string;
};

export type CheckedRecord = DnsRecord & {
  /** `ok` publicado e correto · `bad` publicado com valor diferente · `wait` ausente. */
  state: "ok" | "bad" | "wait";
  found?: string;
  /**
   * A consulta não deu resposta utilizável (timeout, SERVFAIL, rede). O painel
   * exibe como `wait` mesmo, mas o cron não pode ler isso como "registro sumiu"
   * e rebaixar um domínio saudável por causa de uma falha de rede.
   */
  inconclusive?: boolean;
};

/** Os 5 registros que o cliente precisa publicar: 3 CNAME de DKIM + MX e TXT do MAIL FROM. */
export function expectedRecords(domain: {
  domain: string;
  dkimTokens: string[];
  mailFromDomain: string | null;
}): DnsRecord[] {
  const region = process.env.AWS_REGION ?? "us-east-1";
  const mailFrom = domain.mailFromDomain ?? `mail.${domain.domain}`;

  return [
    ...domain.dkimTokens.map(
      (token): DnsRecord => ({
        type: "CNAME",
        name: `${token}._domainkey.${domain.domain}`,
        value: `${token}.dkim.amazonses.com`,
      }),
    ),
    {
      type: "MX",
      name: mailFrom,
      value: `10 feedback-smtp.${region}.amazonses.com`,
    },
    { type: "TXT", name: mailFrom, value: "v=spf1 include:amazonses.com ~all" },
  ];
}

/** Aspas do TXT e ponto final do FQDN são ruído de formatação, não diferença. */
export const norm = (v: string) =>
  v.trim().replace(/^"|"$/g, "").replace(/\.$/, "");

/** Só estes dois significam "o DNS respondeu e o registro não está lá". */
const AUSENTE = new Set(["ENOTFOUND", "ENODATA"]);

type Lookup = { values: string[]; inconclusive: boolean };

async function lookup(resolver: Resolver, r: DnsRecord): Promise<Lookup> {
  try {
    if (r.type === "CNAME")
      return {
        values: await resolver.resolveCname(r.name),
        inconclusive: false,
      };
    if (r.type === "MX")
      return {
        values: (await resolver.resolveMx(r.name)).map(
          (m) => `${m.priority} ${m.exchange}`,
        ),
        inconclusive: false,
      };
    // Um TXT pode vir fatiado em vários pedaços — o SPF é a junção deles.
    return {
      values: (await resolver.resolveTxt(r.name)).map((chunks) =>
        chunks.join(""),
      ),
      inconclusive: false,
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "";
    return { values: [], inconclusive: !AUSENTE.has(code) };
  }
}

/**
 * Consulta o DNS público de verdade — é o que alimenta o diff "encontrado vs.
 * esperado" da tela do domínio. O status oficial continua vindo do SES.
 */
export async function checkRecords(
  records: DnsRecord[],
): Promise<CheckedRecord[]> {
  const resolver = new Resolver({ timeout: 3000, tries: 2 });
  // Resolvers públicos: o cache do resolver local mente por horas depois de uma troca.
  resolver.setServers(["1.1.1.1", "8.8.8.8"]);

  return Promise.all(
    records.map(async (r) => {
      const { values, inconclusive } = await lookup(resolver, r);
      const relevant =
        r.type === "TXT"
          ? values.filter((f) => f.startsWith("v=spf1"))
          : values;

      if (relevant.some((f) => norm(f) === norm(r.value)))
        return { ...r, state: "ok" as const };
      if (relevant.length)
        return { ...r, state: "bad" as const, found: relevant[0] };
      return { ...r, state: "wait" as const, inconclusive };
    }),
  );
}
