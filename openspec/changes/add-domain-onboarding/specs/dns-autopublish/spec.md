## ADDED Requirements

### Requirement: Publicação automática na Cloudflare

O operador SHALL poder publicar os 5 registros na zona do cliente com uma ação no painel, usando a API da Cloudflare. O sistema MUST reportar o resultado por registro, não apenas um resultado agregado.

#### Scenario: Publicação completa
- **WHEN** o operador clica em "publicar automaticamente" e a zona está na Cloudflare
- **THEN** o sistema cria os 5 registros e mostra cada um como publicado, disparando a verificação em seguida

#### Scenario: Publicação parcial
- **WHEN** 3 registros são criados e 2 falham
- **THEN** o painel mostra quais foram publicados e quais falharam, com o motivo de cada falha, e permite tentar de novo só os que faltaram

### Requirement: Detecção da zona do cliente

O sistema SHALL localizar a zona correspondente ao domínio na conta Cloudflare configurada antes de tentar publicar.

#### Scenario: Zona encontrada
- **WHEN** o domínio `acme.com.br` corresponde a uma zona da conta
- **THEN** o sistema usa o ID daquela zona para criar os registros

#### Scenario: Zona ausente da conta
- **WHEN** o domínio não tem zona na conta Cloudflare configurada
- **THEN** o botão de publicação automática fica indisponível com a razão explícita, e o caminho manual segue disponível

### Requirement: Publicação idempotente

Republicar SHALL ser seguro. O sistema MUST NOT duplicar um registro que já existe com o valor esperado, e MUST atualizar um registro existente cujo valor divergiu.

#### Scenario: Registro já publicado corretamente
- **WHEN** o operador publica de novo e um CNAME já existe com o valor esperado
- **THEN** o sistema deixa o registro como está e o reporta como já publicado

#### Scenario: Registro existente com valor errado
- **WHEN** o TXT de MAIL FROM existe com valor divergente
- **THEN** o sistema atualiza o registro para o valor esperado em vez de criar um segundo

### Requirement: Caminho manual sempre disponível

O caminho manual copiável SHALL estar disponível para todo domínio, independentemente de a publicação automática ser possível. A falha da automação MUST NOT bloquear o onboarding.

#### Scenario: Cliente fora da Cloudflare
- **WHEN** a zona do cliente está em outro provedor de DNS
- **THEN** o painel mostra os 5 registros copiáveis e explica que a publicação automática não se aplica àquele domínio

#### Scenario: API da Cloudflare fora do ar
- **WHEN** a chamada à Cloudflare falha
- **THEN** o painel informa a falha com o motivo e mantém os registros copiáveis para publicação manual

### Requirement: Credencial da Cloudflare restrita ao servidor

O token da API da Cloudflare SHALL viver apenas em variável de ambiente de servidor. O sistema MUST NOT expor o token ao navegador nem incluí-lo em mensagens de erro exibidas no painel.

#### Scenario: Erro da Cloudflare exibido no painel
- **WHEN** a Cloudflare retorna erro de autenticação
- **THEN** o painel mostra que a credencial foi recusada, sem imprimir o token
