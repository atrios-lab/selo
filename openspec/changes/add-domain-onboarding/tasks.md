> Ordem: primeiro o que reduz risco (idempotência, reputação), depois o que detecta
> problema sozinho (cron), e por último a Cloudflare — a única parte cujo caminho
> alternativo, o manual, já cobre o fluxo inteiro hoje.

## 1. Provisionamento idempotente no adapter SES

- [x] 1.1 Fazer `provisionDomain` absorver `AlreadyExistsException` no `CreateEmailIdentity`, caindo para `GetEmailIdentity` e lendo os `DkimAttributes.Tokens` de lá
- [x] 1.2 Fazer `CreateTenant` e `CreateTenantResourceAssociation` absorverem o tenant/associação já existentes como caminho normal
- [x] 1.3 Passar `SuppressionAttributes` (BOUNCE e COMPLAINT) direto no `CreateTenant`, dispensando chamada separada
- [x] 1.4 Teste: provisionar duas vezes o mesmo domínio devolve os mesmos tokens sem lançar erro

## 2. Automated reputation policies

- [x] 2.1 Confirmar na doc atual da AWS o formato do ARN do tenant e o valor da política gerenciada
- [x] 2.2 Aplicar `UpdateReputationEntityPolicy` com `ReputationEntityType: "RESOURCE"` e o ARN do tenant, ao final do provisionamento
- [x] 2.3 Garantir que falha ao aplicar a política não derruba o provisionamento — registra e segue, já que identity e tenant já estão de pé

## 3. Cron de verificação

- [x] 3.1 Adicionar `SELO_CRON_SECRET` ao `.env.example` com instrução de geração
- [x] 3.2 Criar `GET /api/cron/verify-domains` autenticada por header, comparando o segredo com `timingSafeEqual`
- [x] 3.3 Reconferir **todos** os domínios (inclusive `VERIFIED`), combinando `domainStatus` do SES com `checkRecords` do DNS
- [x] 3.4 Atualizar `status`, `verifiedAt` e `lastCheckedAt`; falha de resolução preserva o status anterior e só registra a tentativa
- [x] 3.5 Rebaixar domínio `VERIFIED` cujo DNS deixou de bater, apenas com evidência conclusiva (ausente ou divergente, nunca timeout)
- [x] 3.6 Teste: a decisão de transição de status é função pura sobre (status atual, resultado SES, resultado DNS) — cobrir regressão, propagação pendente e timeout

## 4. Cliente Cloudflare

- [x] 4.1 Adicionar `CLOUDFLARE_API_TOKEN` ao `.env.example`, com nota sobre escopo restrito a edição de DNS
- [x] 4.2 Criar `src/lib/cloudflare.ts` com busca de zona por nome (`GET /zones?name=`)
- [x] 4.3 Implementar publicação idempotente por registro: lista por tipo+nome, então cria (`POST`), corrige (`PATCH`) ou não faz nada
- [x] 4.4 Garantir que erro da Cloudflare nunca carrega o token na mensagem que sobe para o painel
- [x] 4.5 Teste: a decisão criar/corrigir/ignorar é função pura sobre (registro esperado, registros encontrados)

## 5. Publicação automática no painel

- [x] 5.1 Server Action de publicação que devolve resultado **por registro**, não agregado — conferir a doc local do Next antes, a versão tem breaking changes
- [x] 5.2 Botão "publicar automaticamente" no Domínio detalhe, indisponível com razão explícita quando a zona não está na conta
- [x] 5.3 Exibir cada registro publicado, já correto, ou falho com motivo; retry age só sobre os que faltaram
- [x] 5.4 Disparar a verificação logo após uma publicação bem-sucedida
- [x] 5.5 Manter os 5 registros copiáveis em fonte mono em todos os casos, inclusive quando a automação falha

## 6. Sinalização de regressão

- [x] 6.1 Decidir se domínio regredido usa `FAILED` ou estado próprio (ver Open Questions do design)
- [x] 6.2 Mostrar `lastCheckedAt` no painel — é o que denuncia cron morto
- [x] 6.3 Ordenar a lista de Domínios com regressão junto dos problemas, antes dos saudáveis

## 7. Fechamento

- [x] 7.1 `pnpm test`, `npx tsc --noEmit` e `pnpm lint` limpos
- [x] 7.2 Exercitar o fluxo completo num domínio real: cadastrar, publicar pela Cloudflare, verificar, e confirmar que chega a `VERIFIED`
- [ ] 7.3 Confirmar que remover um registro no DNS faz o domínio voltar a aparecer como problema no ciclo seguinte
