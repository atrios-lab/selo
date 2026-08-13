# Selo

Serviço standalone de entrega de email transacional — um "Postmark próprio", de operador único. Outros produtos do dono chamam a API do Selo para enviar emails transacionais em nome de ~100 empresas clientes, cada uma com seu próprio domínio remetente (DKIM/SPF alinhados).

O Selo não decide quando/o que enviar e não renderiza templates — recebe HTML pronto via API. Responsabilidades: autenticar domínios (SES), entregar, tratar bounces/complaints, manter supressão por cliente, e oferecer o painel de operação.

Contexto completo do produto, premissas, arquitetura SES, modelo de dados e contrato da API v1 estão em [AGENTS.md](AGENTS.md) — leia antes de mexer no código.

## Stack

- Next.js (App Router) fullstack: API + painel no mesmo deploy
- Postgres + Drizzle
- Amazon SES v2 (`us-east-1`) para envio, SNS para eventos (bounce/complaint/delivery)
- shadcn/ui (Radix + Tailwind) no painel

## Regras de ouro (resumo — detalhes em [AGENTS.md](AGENTS.md))

1. Rota `POST /api/webhooks/sns` sempre valida assinatura SNS + TopicArn.
2. Corpo de email (`htmlBody`) nunca é persistido nem logado.
3. Nunca enviar para endereço suprimido sem remoção explícita.
4. Credenciais AWS só em env vars de servidor.
5. Adapter SES fica atrás da interface `EmailProvider`.
6. YAGNI: sem filas, sem webhooks de saída no v1, sem multi-destinatário, sem templates.

## Getting Started

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).
