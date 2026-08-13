import { type DnsRecord, norm } from "./dns.ts";
import { requireEnv } from "./env.ts";

const API = "https://api.cloudflare.com/client/v4";

/** Registro como a Cloudflare devolve. */
export type RegistroCF = {
  id: string;
  type: string;
  name: string;
  content: string;
  priority?: number;
};

export type Acao =
  | { tipo: "criar" }
  | { tipo: "corrigir"; id: string }
  | { tipo: "nada" };

/** O MX esperado vem como "10 host" — a Cloudflare quer prioridade e host separados. */
export function partesMx(value: string): { priority: number; content: string } {
  const [prioridade, ...resto] = value.split(/\s+/);
  return { priority: Number(prioridade), content: resto.join(" ") };
}

function conteudoEsperado(r: DnsRecord): string {
  return r.type === "MX" ? partesMx(r.value).content : r.value;
}

/**
 * Republicar precisa ser seguro: existe certo não mexe, existe errado corrige,
 * não existe cria. É o que impede a ação de duplicar registro a cada clique.
 */
export function decidirAcao(
  esperado: DnsRecord,
  encontrados: RegistroCF[],
): Acao {
  const doMesmoNome = encontrados.filter(
    (e) =>
      e.type === esperado.type &&
      norm(e.name).toLowerCase() === norm(esperado.name).toLowerCase(),
  );

  const alvo = conteudoEsperado(esperado);
  const bate = (e: RegistroCF) =>
    norm(e.content).toLowerCase() === norm(alvo).toLowerCase() &&
    (esperado.type !== "MX" ||
      e.priority === partesMx(esperado.value).priority);

  if (doMesmoNome.some(bate)) return { tipo: "nada" };
  if (doMesmoNome.length) return { tipo: "corrigir", id: doMesmoNome[0].id };
  return { tipo: "criar" };
}

/** Mensagem da Cloudflare sem nunca carregar o token — ele só vive no header. */
async function chamar(
  caminho: string,
  init?: RequestInit,
): Promise<{ result?: unknown; erro?: string }> {
  let res: Response;
  try {
    res = await fetch(`${API}${caminho}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${requireEnv("CLOUDFLARE_API_TOKEN")}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    return { erro: "não foi possível falar com a Cloudflare" };
  }

  const corpo = (await res.json().catch(() => null)) as {
    success?: boolean;
    result?: unknown;
    errors?: { message?: string }[];
  } | null;

  if (!res.ok || !corpo?.success) {
    const detalhe = corpo?.errors
      ?.map((e) => e.message)
      .filter(Boolean)
      .join("; ");
    if (res.status === 401 || res.status === 403) {
      return { erro: "a Cloudflare recusou a credencial configurada" };
    }
    return { erro: detalhe || `a Cloudflare respondeu ${res.status}` };
  }

  return { result: corpo.result };
}

/** Sem token, a publicação automática simplesmente não é oferecida. */
export const cloudflareConfigurada = () =>
  Boolean(process.env.CLOUDFLARE_API_TOKEN);

/** null = o domínio não está nesta conta. Caso esperado, não é erro. */
export async function acharZona(domain: string): Promise<string | null> {
  const { result } = await chamar(`/zones?name=${encodeURIComponent(domain)}`);
  const zonas = (result as { id: string }[] | undefined) ?? [];
  return zonas[0]?.id ?? null;
}

export type Desfecho = "criado" | "corrigido" | "ja-existia" | "falhou";
export type ResultadoRegistro = DnsRecord & {
  desfecho: Desfecho;
  motivo?: string;
};

async function publicarUm(
  zoneId: string,
  esperado: DnsRecord,
): Promise<ResultadoRegistro> {
  const busca = await chamar(
    `/zones/${zoneId}/dns_records?type=${esperado.type}&name.exact=${encodeURIComponent(esperado.name)}`,
  );
  if (busca.erro) {
    return { ...esperado, desfecho: "falhou", motivo: busca.erro };
  }

  const acao = decidirAcao(esperado, (busca.result as RegistroCF[]) ?? []);
  if (acao.tipo === "nada") return { ...esperado, desfecho: "ja-existia" };

  const corpo = JSON.stringify({
    type: esperado.type,
    name: esperado.name,
    content: conteudoEsperado(esperado),
    ttl: 1,
    ...(esperado.type === "MX"
      ? { priority: partesMx(esperado.value).priority }
      : {}),
  });

  const escrita =
    acao.tipo === "criar"
      ? await chamar(`/zones/${zoneId}/dns_records`, {
          method: "POST",
          body: corpo,
        })
      : await chamar(`/zones/${zoneId}/dns_records/${acao.id}`, {
          method: "PATCH",
          body: corpo,
        });

  if (escrita.erro) {
    return { ...esperado, desfecho: "falhou", motivo: escrita.erro };
  }
  return {
    ...esperado,
    desfecho: acao.tipo === "criar" ? "criado" : "corrigido",
  };
}

/**
 * Resultado por registro, nunca agregado: publicação parcial é o caso comum, e
 * um "falhou" só faria o operador ir ao DNS descobrir o quê.
 */
export function publicarRegistros(
  zoneId: string,
  registros: DnsRecord[],
): Promise<ResultadoRegistro[]> {
  return Promise.all(registros.map((r) => publicarUm(zoneId, r)));
}
