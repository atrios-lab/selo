import type { EmailStatus } from "@/generated/prisma/enums";
import { prisma } from "./db.ts";
import { num, pct } from "./labels.ts";

export type Tone = "bad" | "warn";

export type ItemFila = {
  tag: string;
  tone: Tone;
  /** O texto quebra em três pedaços porque o do meio é dado técnico (mono). */
  pre: string;
  mono: string;
  post: string;
  acao: string;
  href: string;
};

const DIA = 86_400_000;
/** Tentativas de entrega — supressão não chega a sair, não conta contra a taxa. */
const TENTATIVAS: EmailStatus[] = [
  "SENT",
  "DELIVERED",
  "BOUNCED",
  "COMPLAINED",
  "REJECTED",
];
const ENTREGA_MINIMA = 0.95;
const AMOSTRA_MINIMA = 20;
const SUPRESSOES_DEMAIS = 10;

/** Taxa de entrega por domínio numa janela. */
export async function entregaPorDominio(desde: Date) {
  const linhas = await prisma.emailLog.groupBy({
    by: ["sendingDomainId", "status"],
    where: { createdAt: { gte: desde }, status: { in: TENTATIVAS } },
    _count: true,
  });

  const acc = new Map<string, { total: number; entregues: number }>();
  for (const l of linhas) {
    if (!l.sendingDomainId) continue;
    const cur = acc.get(l.sendingDomainId) ?? { total: 0, entregues: 0 };
    cur.total += l._count;
    if (l.status === "DELIVERED") cur.entregues += l._count;
    acc.set(l.sendingDomainId, cur);
  }
  return acc;
}

/**
 * A fila de ação do farol. Tudo aqui é derivado dos dados — não há "marcar como
 * tratado": o item some quando o problema sai da janela ou é resolvido.
 * ponytail: sem tabela de dispensa, add quando o operador reclamar de ruído.
 */
export async function filaDeAcao(): Promise<ItemFila[]> {
  const agora = Date.now();
  const [devolvidos, quebrados, entrega30d, supressoes] = await Promise.all([
    prisma.emailLog.findMany({
      where: {
        createdAt: { gte: new Date(agora - DIA) },
        status: { in: ["BOUNCED", "COMPLAINED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, to: true, status: true, errorDetail: true },
    }),
    prisma.sendingDomain.findMany({
      where: { status: "FAILED" },
      select: { id: true, domain: true },
    }),
    entregaPorDominio(new Date(agora - 30 * DIA)),
    prisma.suppressedAddress.groupBy({
      by: ["sendingDomainId"],
      where: { createdAt: { gte: new Date(agora - 30 * DIA) } },
      _count: true,
      having: { sendingDomainId: { _count: { gte: SUPRESSOES_DEMAIS } } },
    }),
  ]);

  const idsCitados = [
    ...entrega30d.keys(),
    ...supressoes.map((s) => s.sendingDomainId),
  ];
  const dominios = new Map(
    (
      await prisma.sendingDomain.findMany({
        where: { id: { in: idsCitados } },
        select: { id: true, domain: true, clientName: true },
      })
    ).map((d) => [d.id, d]),
  );

  return [
    ...devolvidos.map((e): ItemFila => {
      const spam = e.status === "COMPLAINED";
      return {
        tag: spam ? "Marcado como spam" : "Devolução nova",
        tone: "bad",
        pre: spam ? "reclamação de spam de " : "email devolvido para ",
        mono: e.to,
        post: spam ? "" : ` — ${e.errorDetail ?? "sem detalhe do provedor"}`,
        acao: "Ver detalhes",
        href: `/envios?id=${e.id}`,
      };
    }),
    ...quebrados.map(
      (d): ItemFila => ({
        tag: "Domínio com falha",
        tone: "bad",
        pre: "",
        mono: d.domain,
        post: ": a autenticação falhou — confira os registros DNS",
        acao: "Ver diagnóstico",
        href: `/dominios/${d.id}`,
      }),
    ),
    ...[...entrega30d]
      .filter(
        ([, v]) =>
          v.total >= AMOSTRA_MINIMA && v.entregues / v.total < ENTREGA_MINIMA,
      )
      .map(([id, v]): ItemFila => {
        const d = dominios.get(id);
        return {
          tag: "Entrega caindo",
          tone: "warn",
          pre: `${d?.clientName ?? id}: `,
          mono: pct(v.entregues / v.total),
          post: ` de entrega em 30 d (${num(v.total)} envios)`,
          acao: "Investigar",
          href: `/envios?dominio=${id}`,
        };
      }),
    ...supressoes.map((s): ItemFila => {
      const d = dominios.get(s.sendingDomainId);
      return {
        tag: "Supressões concentradas",
        tone: "warn",
        pre: `${d?.clientName ?? s.sendingDomainId}: `,
        mono: String(s._count),
        post: " novas supressões em 30 d — possível lista suja",
        acao: "Ver supressões",
        href: `/supressoes?dominio=${s.sendingDomainId}`,
      };
    }),
  ];
}

/** Indicadores do topo do farol. */
export async function indicadores() {
  const agora = Date.now();
  const [naoEntregues24h, naoEntregues7d, comProblema, supressoes7d, mes] =
    await Promise.all([
      prisma.emailLog.count({
        where: {
          createdAt: { gte: new Date(agora - DIA) },
          status: { in: ["BOUNCED", "COMPLAINED", "REJECTED"] },
        },
      }),
      prisma.emailLog.count({
        where: {
          createdAt: { gte: new Date(agora - 7 * DIA) },
          status: { in: ["BOUNCED", "COMPLAINED", "REJECTED"] },
        },
      }),
      prisma.sendingDomain.count({ where: { status: "FAILED" } }),
      prisma.suppressedAddress.count({
        where: { createdAt: { gte: new Date(agora - 7 * DIA) } },
      }),
      prisma.emailLog.count({
        where: { createdAt: { gte: new Date(agora - 30 * DIA) } },
      }),
    ]);

  return [
    {
      valor: num(naoEntregues24h),
      rotulo: "não entregues · 24 h",
      sub: `${num(naoEntregues7d)} em 7 dias`,
      alerta: naoEntregues24h > 0,
    },
    {
      valor: num(comProblema),
      rotulo: "domínios com problema",
      sub: null,
      alerta: comProblema > 0,
    },
    {
      valor: num(supressoes7d),
      rotulo: "supressões novas · 7 d",
      sub: null,
      alerta: supressoes7d > 0,
    },
    { valor: num(mes), rotulo: "enviados em 30 d", sub: null, alerta: false },
  ];
}

/** Envios por dia nos últimos 30 dias, pro gráfico de barras. */
export async function enviosPorDia() {
  const linhas = await prisma.$queryRaw<{ dia: Date; total: bigint }[]>`
    -- Dias em UTC dos dois lados: o eixo do gráfico é montado em UTC no JS.
    SELECT date_trunc('day', "createdAt") AS dia,
           count(*) AS total
    FROM "EmailLog"
    WHERE "createdAt" >= now() - interval '30 days'
    GROUP BY dia
    ORDER BY dia
  `;

  const porDia = new Map(
    linhas.map((l) => [l.dia.toISOString().slice(0, 10), Number(l.total)]),
  );
  const hoje = new Date();

  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(hoje.getTime() - (29 - i) * DIA);
    return {
      dia: d,
      total: porDia.get(d.toISOString().slice(0, 10)) ?? 0,
      hoje: i === 29,
    };
  });
}
