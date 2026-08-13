## Context

O caminho manual do onboarding já está de pé no repo: `sesProvider.provisionDomain` cria identity com Easy DKIM, configura o custom MAIL FROM com `BehaviorOnMxFailure: USE_DEFAULT_VALUE` e associa o tenant; `src/lib/dns.ts` deriva os 5 registros esperados e os confere contra `1.1.1.1`/`8.8.8.8`; as telas de Domínios e Domínio detalhe mostram o diff e o "verificar agora".

Esta change fecha as lacunas que sobraram — e três delas só aparecem quando algo dá errado, que é exatamente quando não dá pra descobrir que faltavam.

Restrições que continuam moldando o desenho: operador único de perfil técnico, ~100 domínios com 5 registros cada, e YAGNI agressivo (sem fila, sem cache, sem estado derivado persistido).

## Goals / Non-Goals

**Goals:**
- Publicar os 5 registros na Cloudflare com uma ação, sem nunca tirar o caminho manual da mesa.
- Reconferir domínios sozinho, inclusive os já verificados, para pegar regressão.
- Tornar "tentar de novo" seguro em qualquer ponto do provisionamento.
- Ativar o isolamento de reputação que o tenant por empresa deveria estar dando.

**Non-Goals:**
- Provedores de DNS além da Cloudflare.
- Remoção ou descadastro de domínio.
- Qualquer superfície voltada à empresa cliente.
- Warm-up de IP, VDM, ou qualquer coisa com custo fixo relevante.

## Decisions

### 1. Provisionamento idempotente por absorção de `AlreadyExists`

Hoje `provisionDomain` assume que nada existe. Se o `CreateTenant` falhar depois de a identity já ter sido criada, o domínio fica travado: a retentativa morre logo no `CreateEmailIdentity`.

A correção é tratar `AlreadyExistsException` como caminho normal em cada uma das criações, caindo para `GetEmailIdentity` (que devolve os mesmos `DkimAttributes.Tokens`) e seguindo adiante. `CreateTenantResourceAssociation` idem — reassociar o que já está associado não é erro de negócio.

*Alternativa considerada:* checar antes com `Get`/`List` e só então criar. Rejeitada: é uma chamada a mais em todo provisionamento e ainda tem corrida entre o check e o create. Absorver a exceção é menos código e mais correto.

### 2. Reputation policy aplicada ao tenant como recurso

`UpdateReputationEntityPolicy` com `ReputationEntityType: "RESOURCE"` e o ARN do tenant em `ReputationEntityReference`. É a operação que a doc do SDK descreve para políticas gerenciadas pela AWS — o tenant sozinho não traz a política.

A supressão do tenant passa a ser configurada direto no `CreateTenant` via `SuppressionAttributes`, em vez de um `PutTenantSuppressionAttributes` separado: uma chamada a menos e um ponto de falha parcial a menos.

### 3. Cron como rota protegida por segredo

`GET /api/cron/verify-domains`, autenticada por header com segredo comparado em **tempo constante** (`timingSafeEqual`). Vercel Cron, GitHub Actions ou um `curl` num crontab chamam a mesma rota — nada amarra a change a um host.

A rota reconfere **todos** os domínios, não só os pendentes. Domínio `VERIFIED` que perdeu um registro precisa voltar a aparecer como problema, e isso é a diferença entre o cron ser um detector de regressão ou só um acelerador do happy path. A 100 domínios, conferir todos custa 500 consultas DNS a cada 15 minutos — trivial.

*Trade-off:* o `domainStatus` do SES é uma chamada de API por domínio. A 100 domínios por ciclo isso está muito abaixo de qualquer limite do SES.

### 4. Regressão vira `FAILED`, mas só com evidência conclusiva

Um domínio `VERIFIED` cujo DNS deixou de bater não pode continuar `VERIFIED`. Mas timeout de resolver não é evidência de nada: falha de rede mantém o status anterior e registra a tentativa. Só resposta DNS conclusiva (registro ausente ou divergente) somada ao que o SES reporta move o estado.

Isso mantém a promessa do spec de que falha de rede nunca marca domínio saudável como quebrado.

### 5. Cloudflare via `fetch`, sem SDK

Duas etapas: `GET /zones?name=<domínio>` para achar a zona, e por registro um `GET /zones/{id}/dns_records?type=&name=` seguido de `POST` (criar) ou `PATCH` (corrigir divergente). O SDK oficial traria centenas de operações para usar três.

A idempotência exigida pelo spec cai fora naturalmente desse "lista antes de escrever": existe com o valor certo → não faz nada; existe divergente → corrige; não existe → cria.

*Trade-off:* mais um round-trip por registro. A 5 registros numa ação manual do operador, irrelevante.

### 6. Resultado da publicação é por registro, nunca agregado

Publicação parcial é o caso comum de verdade (um registro conflita, os outros vão). Um "falhou" agregado obriga o operador a ir ao DNS descobrir o que aconteceu — o oposto da regra 5. Cada registro volta com seu próprio desfecho e motivo, e o retry age só sobre os que faltaram.

### 7. Zona ausente não é erro

Domínio fora da conta Cloudflare é o caso esperado, não excepcional — parte dos ~100 clientes usa outro provedor. A ação some com a razão explícita, e o caminho manual segue como está hoje. Falha da API da Cloudflare cai no mesmo lugar.

## Risks / Trade-offs

**Token da Cloudflare com escrita no DNS de ~100 clientes** → Só em env var de servidor, nunca em mensagem de erro do painel, e o token deve ser criado com escopo restrito a edição de DNS nas zonas envolvidas.

**Cron marcando domínio saudável como quebrado por falha de rede** → Decisão 4: só evidência conclusiva move status; timeout preserva o estado anterior.

**Cron sem execução silenciosa** → Se o agendador parar de chamar a rota, tudo continua parecendo saudável porque nada muda. `lastCheckedAt` visível no painel é o que denuncia — um domínio conferido pela última vez há dois dias é sinal de cron morto, não de domínio estável.

**`PATCH` da Cloudflare sobrescrevendo registro legítimo do cliente** → Só registros nos nomes que o Selo controla (`<token>._domainkey.<domínio>` e `mail.<domínio>`) são tocados, e o diff mostra o valor encontrado antes de qualquer escrita.

**Conta SES em sandbox** → Provisionamento e verificação funcionam normalmente; só o envio para endereços não verificados é bloqueado. Pedir production access cedo.

## Migration Plan

Nada a migrar: nenhum campo novo é necessário — `status`, `verifiedAt` e `lastCheckedAt` já existem em `SendingDomain`.

Ordem de implantação, do que reduz risco para o que reduz trabalho: idempotência e reputation policy no adapter SES → cron de verificação → Cloudflare por último, porque é a única parte cujo caminho alternativo (manual) já cobre o fluxo inteiro hoje.

## Open Questions

- Quem dispara o cron em produção depende de onde o Selo vai rodar — ainda não decidido.
- O ARN do tenant para a reputation policy: confirmar o formato exato (`arn:aws:ses:<região>:<conta>:tenant/<nome>`) na doc atual antes de implementar, já que o recurso é recente.
- Um domínio que regride: `FAILED` ou um estado próprio? `FAILED` reaproveita o que a lista já ordena primeiro, mas mistura "nunca verificou" com "parou de funcionar" no mesmo rótulo.
