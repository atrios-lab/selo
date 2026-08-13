"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { endSession, requireOperator } from "@/lib/session";

export async function sair() {
  await endSession();
  redirect("/login");
}

export type Achado = { tipo: string; rotulo: string; href: string };

/** Busca global (tecla `/`): domínio, cliente, destinatário ou id de mensagem. */
export async function buscar(termo: string): Promise<Achado[]> {
  await requireOperator();
  const q = termo.trim();
  if (q.length < 2) return [];

  const [dominios, envios, produtos] = await Promise.all([
    prisma.sendingDomain.findMany({
      where: {
        OR: [
          { domain: { contains: q, mode: "insensitive" } },
          { clientName: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
      select: { id: true, domain: true, clientName: true },
    }),
    prisma.emailLog.findMany({
      where: {
        OR: [
          { to: { contains: q, mode: "insensitive" } },
          { id: q },
          { sesMessageId: q },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, to: true, subject: true },
    }),
    prisma.product.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      take: 3,
      select: { id: true, name: true },
    }),
  ]);

  return [
    ...dominios.map((d) => ({
      tipo: "domínio",
      rotulo: `${d.domain} · ${d.clientName}`,
      href: `/dominios/${d.id}`,
    })),
    ...envios.map((e) => ({
      tipo: "email",
      rotulo: `${e.to} · ${e.subject}`,
      href: `/envios?id=${e.id}`,
    })),
    ...produtos.map((p) => ({
      tipo: "produto",
      rotulo: p.name,
      href: "/produtos",
    })),
  ];
}
