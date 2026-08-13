import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { checkRecords, expectedRecords } from "@/lib/dns";
import { requireEnv } from "@/lib/env";
import { sesProvider as provider } from "@/lib/ses";
import { proximoStatus } from "@/lib/verificacao";

/** Hash dos dois lados: iguala o tamanho e mantém a comparação em tempo constante. */
function autorizado(req: NextRequest): boolean {
  const enviado =
    req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const sha = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(sha(enviado), sha(requireEnv("SELO_CRON_SECRET")));
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return new Response("não autorizado", { status: 401 });

  // Reconfere TODOS, inclusive os VERIFIED: sem isso o cron seria só um
  // acelerador do happy path, e regressão nenhuma apareceria.
  const dominios = await prisma.sendingDomain.findMany({
    select: {
      id: true,
      domain: true,
      status: true,
      dkimTokens: true,
      mailFromDomain: true,
    },
  });

  let conferidos = 0;
  const falhas: string[] = [];

  for (const dominio of dominios) {
    try {
      const [ses, registros] = await Promise.all([
        provider.domainStatus(dominio.domain),
        checkRecords(expectedRecords(dominio)),
      ]);

      const status = proximoStatus({ ses, registros });

      await prisma.sendingDomain.update({
        where: { id: dominio.id },
        data: {
          status,
          lastCheckedAt: new Date(),
          // Só na transição — reescrever faria "verificado há" mentir.
          ...(status === "VERIFIED" && dominio.status !== "VERIFIED"
            ? { verifiedAt: new Date() }
            : {}),
        },
      });
      conferidos++;
    } catch (error) {
      // SES fora do ar ou credencial recusada: preserva o status e o
      // lastCheckedAt antigos. Um lastCheckedAt velho no painel é justamente o
      // sinal de que a conferência parou de acontecer.
      falhas.push(dominio.domain);
      console.error("Falha ao verificar domínio", {
        domain: dominio.domain,
        error,
      });
    }
  }

  return Response.json({ total: dominios.length, conferidos, falhas });
}
