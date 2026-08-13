"use server";

import { revalidatePath } from "next/cache";
import { acharZona, publicarRegistros } from "@/lib/cloudflare";
import { prisma } from "@/lib/db";
import { expectedRecords } from "@/lib/dns";
import { sesProvider as provider } from "@/lib/ses";
import { requireOperator } from "@/lib/session";

const FORMATO = /^([a-z0-9-]+\.)+[a-z]{2,}$/;

export type AddState = { erro?: string; ok?: { id: string; domain: string } };

/** Nome do tenant SES: só alfanumérico, `-` e `_`. */
const tenantDe = (domain: string) => domain.replace(/[^a-z0-9]/g, "-");

export async function adicionarDominio(
  _prev: AddState,
  form: FormData,
): Promise<AddState> {
  await requireOperator();

  const clientName = String(form.get("cliente") ?? "").trim();
  const domain = String(form.get("dominio") ?? "")
    .trim()
    .toLowerCase();

  if (!clientName) return { erro: "Informe o nome do cliente." };
  if (!FORMATO.test(domain)) {
    return {
      erro: "Formato inválido — informe só o domínio, sem @ ou https://.",
    };
  }

  const existente = await prisma.sendingDomain.findUnique({
    where: { domain },
    select: { clientName: true },
  });
  if (existente) {
    return {
      erro: `Este domínio já está cadastrado (${existente.clientName}).`,
    };
  }

  const sesTenantName = tenantDe(domain);
  let provisionado: { dkimTokens: string[]; mailFromDomain: string };
  try {
    provisionado = await provider.provisionDomain(domain, sesTenantName);
  } catch (error) {
    const detalhe = error instanceof Error ? error.message : String(error);
    return {
      erro: `O SES recusou o cadastro de ${domain}: ${detalhe}. Confira as credenciais e se a identidade já não existe na conta.`,
    };
  }

  // Nasce PENDENTE: os envios saem pelo fallback até o DNS ser publicado.
  const criado = await prisma.sendingDomain.create({
    data: {
      clientName,
      domain,
      sesTenantName,
      status: "PENDING",
      dkimTokens: provisionado.dkimTokens,
      mailFromDomain: provisionado.mailFromDomain,
    },
    select: { id: true, domain: true },
  });

  revalidatePath("/dominios");
  return { ok: criado };
}

/** "Verificar agora": relê o estado no SES e grava. O DNS é conferido na renderização. */
export async function verificarAgora(id: string) {
  await requireOperator();

  const dominio = await prisma.sendingDomain.findUniqueOrThrow({
    where: { id },
    select: { domain: true, status: true },
  });

  const status = await provider.domainStatus(dominio.domain);
  const virouVerificado =
    status === "VERIFIED" && dominio.status !== "VERIFIED";

  await prisma.sendingDomain.update({
    where: { id },
    data: {
      status,
      lastCheckedAt: new Date(),
      // Só carimba na transição — reescrever a data faria "no estado há" mentir.
      ...(virouVerificado ? { verifiedAt: new Date() } : {}),
    },
  });

  revalidatePath(`/dominios/${id}`);
  revalidatePath("/dominios");
}

export type PublicarState = {
  erro?: string;
  registros?: {
    type: string;
    name: string;
    desfecho: "criado" | "corrigido" | "ja-existia" | "falhou";
    motivo?: string;
  }[];
};

/**
 * Publica os 5 registros na zona do cliente. Idempotente: reclicar não duplica
 * nada e age só sobre o que ainda falta, então o retry de uma publicação
 * parcial é o mesmo botão.
 */
export async function publicarNaCloudflare(id: string): Promise<PublicarState> {
  await requireOperator();

  const dominio = await prisma.sendingDomain.findUniqueOrThrow({
    where: { id },
    select: { domain: true, dkimTokens: true, mailFromDomain: true },
  });

  const zona = await acharZona(dominio.domain);
  if (!zona) {
    return {
      erro: `${dominio.domain} não está nesta conta Cloudflare. Publique os 5 registros manualmente — eles seguem copiáveis abaixo.`,
    };
  }

  const registros = await publicarRegistros(zona, expectedRecords(dominio));

  // Escreveu algo: relê o SES na hora, pra tela já refletir o passo seguinte.
  if (
    registros.some((r) => r.desfecho === "criado" || r.desfecho === "corrigido")
  ) {
    await verificarAgora(id);
  }

  revalidatePath(`/dominios/${id}`);
  return { registros };
}
