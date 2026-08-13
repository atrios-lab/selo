## Why

O onboarding de domínio já funciona pelo caminho manual: `provisionDomain` cria a identity com Easy DKIM e o tenant no SES, `expectedRecords`/`checkRecords` conferem os 5 registros contra resolvers públicos, e as telas de Domínios e Domínio detalhe já mostram o diff e o botão "verificar agora".

O que falta é o que torna isso operável em escala de ~100 empresas, e três lacunas são de risco, não de conveniência:

- **Nada reconfere sozinho.** Sem cron, um domínio só muda de estado se o operador abrir a tela e clicar. Um domínio que perde um registro de DKIM depois de verificado continua marcado como `VERIFIED` indefinidamente — e passa a enviar sem assinatura alinhada sem ninguém saber.
- **Retentar um provisionamento que falhou no meio quebra.** `CreateEmailIdentity` e `CreateTenant` não tratam `AlreadyExistsException`, então qualquer falha parcial (identity criada, tenant não) deixa o domínio travado: tentar de novo falha na primeira chamada.
- **As automated reputation policies nunca são ativadas.** O tenant é criado e associado, mas sem a política gerenciada — que é justamente o mecanismo de isolamento de reputação que motivou usar tenant por empresa.

E a publicação automática via Cloudflare, ainda ausente, é o que evita digitar 500 registros DNS à mão.

## What Changes

- **Publicação automática via Cloudflare**: detectar a zona do domínio, criar ou corrigir os 5 registros de forma idempotente, reportar resultado por registro, e degradar para o caminho manual quando a zona não estiver na conta.
- **Verificação periódica**: rota de cron protegida por segredo, chamada a cada 15 minutos, que reconfere domínios não verificados **e** os já verificados, para detectar regressão.
- **Provisionamento idempotente**: tratar identity e tenant já existentes como caminho normal, lendo o estado atual em vez de falhar, para que "tentar de novo" sempre funcione.
- **Automated reputation policies**: aplicar a política gerenciada do SES ao tenant no provisionamento, e configurar a supressão do tenant já na criação.
- Ajustes de painel decorrentes: ação de publicação automática no Domínio detalhe e sinalização de regressão na lista.

## Capabilities

### New Capabilities

- `domain-onboarding`: cadastro do domínio remetente, provisionamento da identity e do tenant no SES, derivação dos 5 registros DNS esperados, e o ciclo de vida de status (`PENDING` → `VERIFYING` → `VERIFIED` | `FAILED`). Parcialmente implementado; esta change fecha idempotência e reputation policies.
- `domain-verification`: conferência do publicado contra o esperado, registro a registro, sob demanda e por cron de 15 minutos; transições de status, detecção de regressão e o diagnóstico exibido no painel.
- `dns-autopublish`: publicação dos registros na zona do cliente via API da Cloudflare, incluindo detecção de zona, idempotência e degradação para o caminho manual.

### Modified Capabilities

Nenhuma — `openspec/specs/` está vazio, esta é a primeira change do projeto.

## Impact

**Código existente que muda**
- `src/lib/ses.ts`: `provisionDomain` passa a tolerar identity/tenant existentes, a criar o tenant já com `SuppressionAttributes` e a aplicar a política de reputação via `UpdateReputationEntityPolicy`.
- `src/app/(painel)/dominios/[id]/page.tsx` e `actions.ts`: ação de publicação automática, com o resultado por registro.
- `src/app/(painel)/dominios/page.tsx`: sinalizar domínio verificado que regrediu.

**Código novo**
- `src/lib/cloudflare.ts`: cliente REST mínimo (achar zona, listar/criar/corrigir registro).
- `src/app/api/cron/verify-domains/route.ts`: rota de cron autenticada por segredo.

**Dependências**
- Nenhuma nova: Cloudflare é REST via `fetch`, e a conferência DNS já usa `node:dns/promises`.
- Novos segredos de servidor: token da API da Cloudflare e o segredo do cron.

**Riscos**
- O token da Cloudflare tem poder de escrita no DNS de ~100 clientes.
- A conta SES ainda está em sandbox; o provisionamento funciona, mas o envio real depende do production access.

## Non-goals

- Nenhuma tela self-service para a empresa cliente — o operador é o único usuário.
- Nenhum provedor de DNS além da Cloudflare; qualquer outro usa o caminho manual.
- Sem remoção ou descadastro de domínio nesta change.
