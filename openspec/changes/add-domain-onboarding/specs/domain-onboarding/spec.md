## ADDED Requirements

### Requirement: Cadastro de domínio remetente

O operador SHALL cadastrar um domínio remetente informando o nome da empresa cliente e o domínio. O sistema MUST rejeitar domínio já cadastrado e MUST normalizar o domínio para minúsculas antes de gravar.

#### Scenario: Cadastro de um domínio novo
- **WHEN** o operador cadastra a empresa "Acme" com o domínio `acme.com.br`
- **THEN** o sistema cria um `SendingDomain` com status `PENDING` e exibe a tela de detalhe com os 5 registros DNS a publicar

#### Scenario: Domínio duplicado
- **WHEN** o operador tenta cadastrar um domínio que já existe
- **THEN** o sistema recusa o cadastro e informa qual empresa já usa aquele domínio

#### Scenario: Domínio com maiúsculas ou espaços
- **WHEN** o operador informa ` ACME.com.br `
- **THEN** o sistema grava `acme.com.br`

### Requirement: Provisionamento da identity com Easy DKIM

Ao cadastrar o domínio, o sistema SHALL criar uma Email Identity no SES com Easy DKIM e MUST persistir os 3 tokens de DKIM retornados.

#### Scenario: Identity criada com sucesso
- **WHEN** o cadastro é confirmado
- **THEN** o sistema chama o SES para criar a identity com Easy DKIM, grava os 3 tokens em `dkimTokens` e move o status para `VERIFYING`

#### Scenario: SES recusa a criação
- **WHEN** o SES retorna erro ao criar a identity
- **THEN** o domínio fica com status `FAILED`, o painel mostra a mensagem do SES e a ação sugerida, e o operador pode tentar de novo sem recadastrar

#### Scenario: Identity já existe no SES
- **WHEN** o domínio já tem identity no SES de um cadastro anterior
- **THEN** o sistema reaproveita a identity existente e lê os tokens de DKIM dela, em vez de falhar

### Requirement: Tenant de reputação por empresa cliente

O sistema SHALL criar um tenant SES por empresa cliente e MUST associar a identity do domínio a esse tenant. As automated reputation policies do tenant MUST ser ativadas no provisionamento.

#### Scenario: Tenant criado e associado
- **WHEN** o domínio de uma empresa nova é provisionado
- **THEN** o sistema cria o tenant, associa a identity a ele, ativa as políticas automáticas de reputação e grava o nome do tenant em `sesTenantName`

#### Scenario: Empresa que já tem tenant
- **WHEN** a empresa já possui um tenant de um domínio anterior
- **THEN** o sistema associa a nova identity ao tenant existente em vez de criar outro

### Requirement: Custom MAIL FROM

O sistema SHALL configurar o custom MAIL FROM como `mail.<dominio>` para alinhar o SPF, e MUST persistir esse subdomínio.

#### Scenario: MAIL FROM configurado
- **WHEN** a identity de `acme.com.br` é provisionada
- **THEN** o sistema configura o MAIL FROM como `mail.acme.com.br` e grava em `mailFromDomain`

### Requirement: Registros DNS esperados

O sistema SHALL derivar e exibir exatamente 5 registros DNS por domínio: 3 CNAMEs de DKIM, 1 MX e 1 TXT de SPF para o subdomínio de MAIL FROM. Cada registro MUST ser exibido com tipo, nome, valor e status individual, em fonte mono e copiável.

#### Scenario: Os cinco registros de um domínio
- **WHEN** o operador abre o detalhe de `acme.com.br`
- **THEN** o painel lista `<token>._domainkey.acme.com.br` CNAME para cada um dos 3 tokens, `mail.acme.com.br` MX apontando para o endpoint SES da região, e `mail.acme.com.br` TXT com `v=spf1 include:amazonses.com ~all`

#### Scenario: Registro individual copiável
- **WHEN** o operador clica em copiar num registro
- **THEN** o valor exato do registro vai para a área de transferência, sem formatação do painel

### Requirement: Ciclo de vida do status do domínio

O status do domínio SHALL ser um de `PENDING`, `VERIFYING`, `VERIFIED` ou `FAILED`. O sistema MUST tratar o SES como fonte da verdade da autenticação e MUST registrar quando a verificação foi conferida pela última vez.

#### Scenario: Progressão normal
- **WHEN** o domínio é cadastrado, provisionado e os registros são publicados e propagados
- **THEN** o status caminha de `PENDING` para `VERIFYING` e depois para `VERIFIED`, e `verifiedAt` é gravado

#### Scenario: Domínio marcado como fallbackOnly
- **WHEN** o domínio tem `fallbackOnly` ligado
- **THEN** o envio usa o domínio de fallback do Selo mesmo que o status seja `VERIFIED`

### Requirement: Lista de domínios com problemas primeiro

A tela de Domínios SHALL ordenar a lista de forma que domínios com problema apareçam antes dos saudáveis. Cada estado MUST ser comunicado por cor e rótulo, nunca só por cor.

#### Scenario: Ordenação por urgência
- **WHEN** o operador abre a tela de Domínios com domínios em `FAILED`, `VERIFYING` e `VERIFIED`
- **THEN** os `FAILED` aparecem primeiro, depois os `VERIFYING`, e os `VERIFIED` por último

#### Scenario: Nenhum domínio com problema
- **WHEN** todos os domínios estão `VERIFIED`
- **THEN** a tela mostra um estado de sucesso explícito em vez de uma lista sem contexto
