@AGENTS.md

# CLAUDE.md — Selo

## O que é este projeto

**Selo** é um serviço standalone de entrega de email transacional — um "Postmark próprio", de operador único. Outros produtos do dono (hoje um SaaS principal; futuros também) chamam a API do Selo para enviar emails transacionais (convite de conta, reenvio de convite, reset de senha) **em nome de ~100 empresas clientes, cada uma com seu próprio domínio remetente** (ex: convite da "Acme" sai de `noreply@acme.com.br` com DKIM/SPF alinhados).

O Selo NÃO decide quando/o que enviar e NÃO renderiza templates — recebe HTML pronto via API ("SMTP com esteroides"). Responsabilidades do Selo: autenticar domínios (DKIM/SPF via SES), entregar (SES por tenant), tratar bounces/complaints, manter supressão por cliente, e oferecer o painel de operação.

## Premissas que moldam decisões

- **Operador único**: o dono é o ÚNICO usuário do painel. Perfil técnico. Nada de onboarding didático, multi-usuário, permissões ou telas self-service para clientes. O painel é um cockpit denso: "tem algo quebrado? onde? qual a ação?"
- **Volume baixo**: 2–5 mil emails/mês. NÃO adicionar filas (SQS), cache ou otimizações prematuras — o desenho atual aguenta 100x isso. Processar webhooks direto na rota.
- O operador tem acesso ao DNS dos clientes → o onboarding de domínio deve suportar **publicação automática de registros via API do provedor DNS** (Cloudflare primeiro) além do caminho manual copiável.
- Os clientes finais só veem os emails em si (que pertencem aos produtos consumidores, não ao Selo).

## Stack

- **Next.js fullstack** (App Router): API + painel no mesmo deploy. Banco próprio (Postgres + Prisma).
- **Amazon SES v2** (região única `us-east-1`), SDK AWS v3.
- Painel: **shadcn/ui** (Radix + Tailwind). Identidade: paleta base branco/preto/amarelo (ver briefing de design); dados técnicos (domínios, emails, IDs, registros DNS) sempre em fonte mono; estados sempre cor + rótulo.
- Eventos: SES → Configuration Set → **SNS** → rota `POST /api/webhooks/sns` (validar assinatura SNS + TopicArn SEMPRE — rota pública).

## Arquitetura SES (multi-tenant)

- 1 **Email Identity** por domínio de cliente: Easy DKIM (3 CNAMEs) + custom MAIL FROM `mail.<dominio>` (1 MX + 1 TXT) = 5 registros DNS por domínio.
- 1 **Tenant SES por empresa cliente** — isolamento de reputação e supressão. TODO envio passa o tenant. Ativar automated reputation policies. (Recurso recente do SES — conferir nomes exatos das operações na doc atual antes de usar.)
- **Domínio fallback** do próprio Selo, verificado desde o início: se o domínio do `from` não está VERIFIED, enviar pelo fallback com remetente original como Reply-To e retornar `usedFallback: true`. Envio NUNCA falha por DNS pendente.
- NÃO contratar IP dedicado. Conta nova nasce em sandbox — pedir production access cedo.

## Modelo de dados (essência)

- `Product` — consumidor da API (nome, apiKeyHash exibida 1x, webhookUrl RESERVADO pro v2, active)
- `SendingDomain` — clientName, domain, sesTenantName, status (PENDING|VERIFYING|VERIFIED|FAILED), dkimTokens, mailFromDomain, fallbackOnly
- `EmailLog` — productId, from/to, subject, tag livre, idempotencyKey, sesMessageId, status (SENT|DELIVERED|BOUNCED|COMPLAINED|SUPPRESSED|REJECTED), usedFallback, errorDetail. **NUNCA persistir o corpo (htmlBody) do email** — resets carregam tokens sensíveis; só metadados.
- `SuppressedAddress` — por sendingDomainId + address, reason (HARD_BOUNCE|COMPLAINT|MANUAL)

## API v1 (contrato)

Auth: `Authorization: Bearer <token do Product>` (hash no banco).

- `POST /v1/send` — { from, fromName?, to (1 destinatário no v1), replyTo?, subject, htmlBody, textBody?, tag?, idempotencyKey?, metadata? } → { messageId, status, usedFallback }
- Erros são FLUXO, não exceção: 422 `SUPPRESSED` (destinatário suprimido), 422 `INVALID_RECIPIENT`, 422 `UNKNOWN_DOMAIN`, 429 `RATE_LIMITED` (rate limit por cliente protege reputação), 401 `UNAUTHORIZED`.
- `GET /v1/messages/{id}`, `GET /v1/messages?to=&tag=&status=&since=`, `GET/DELETE /v1/suppressions`
- Idempotência: mesma idempotencyKey → retorna resultado original, não reenvia.
- **Webhooks pro produto: v2** — campo webhookUrl já existe mas NÃO dispara no v1. Não implementar antes.

## Pipeline de eventos (SNS)

Bounce permanente → suprimir (HARD_BOUNCE) + log BOUNCED. Complaint → suprimir + log COMPLAINED. Delivery → log DELIVERED. Bounce transiente → só logar (SES re-tenta sozinho). Espelhar supressão no nível de tenant do SES quando aplicável.

## Painel (telas do v1)

1. **Dashboard "farol"**: 4 indicadores + fila de ação (bounce novo / domínio FALHOU / % entrega caindo). Fila vazia = estado de sucesso.
2. **Domínios** (lista, problemas primeiro) e **Domínio detalhe**: 5 registros DNS com status individual e diff "encontrado vs. esperado"; botão "publicar automaticamente" (Cloudflare API) + caminho manual copiável; polling de verificação (cron 15 min) + "verificar agora".
3. **Envios**: log filtrável (produto, domínio, tag, status, período), linha expandível com timeline. Sem corpo de email.
4. **Supressões**: por cliente; remoção com modal de confirmação; alerta quando um cliente concentra supressões (lista suja = risco nº 1).
5. **Produtos**: cadastrar consumidor → token exibido UMA vez; revogar.

## Regras de ouro

1. Segurança da rota SNS não é opcional (assinatura + TopicArn).
2. Corpo de email nunca no banco, nunca em log.
3. Bounce rate < 5% e complaint rate < 0,1% são limites da AWS — a supressão automática existe pra isso; nunca criar caminho que envie para endereço suprimido sem remoção explícita.
4. Credenciais AWS só em env vars de servidor (nunca `NEXT_PUBLIC_`).
5. Toda falha exibida no painel vem com diagnóstico + ação, nunca só "erro".
6. Manter o adapter SES atrás de uma interface (`EmailProvider`) — trocar de provedor deve ser escrever um adapter novo.
7. YAGNI agressivo: v1 sem webhooks de saída, sem filas, sem multi-destinatário, sem templates, sem métricas de abertura/clique.

## Custos de referência

SES: US$ 0,10/mil emails (free tier: 3 mil/mês grátis no 1º ano). Custo total esperado: ~US$ 1/mês. Qualquer decisão que adicione custo fixo relevante (IP dedicado, VDM) está errada neste volume.
