## ADDED Requirements

### Requirement: Conferência registro a registro

O sistema SHALL conferir cada um dos 5 registros DNS esperados contra o que está publicado no DNS, e MUST exibir, por registro, se ele está correto, ausente ou divergente. Para registro divergente o painel MUST mostrar o valor encontrado ao lado do esperado.

#### Scenario: Todos os registros publicados
- **WHEN** os 3 CNAMEs, o MX e o TXT estão publicados com os valores esperados
- **THEN** cada registro aparece como correto e o domínio fica apto a ser marcado `VERIFIED`

#### Scenario: Registro ausente
- **WHEN** um dos CNAMEs de DKIM não resolve
- **THEN** aquele registro aparece como ausente, com o valor esperado copiável e a ação "publicar"

#### Scenario: Registro com valor divergente
- **WHEN** o TXT de `mail.acme.com.br` resolve para `v=spf1 include:_spf.google.com ~all`
- **THEN** o painel mostra "encontrado" e "esperado" lado a lado, deixando explícito qual é a diferença

#### Scenario: Registro duplicado no DNS
- **WHEN** o nome esperado resolve para mais de um valor e um deles é o esperado
- **THEN** o registro é considerado correto, e o painel sinaliza os valores extras encontrados

### Requirement: Verificação periódica por cron

O sistema SHALL reconferir os domínios não verificados a cada 15 minutos e MUST atualizar status e `lastCheckedAt`. Domínios já `VERIFIED` MUST continuar sendo reconferidos para detectar regressão.

#### Scenario: Domínio propagou entre dois ciclos
- **WHEN** o cron roda e o SES já reporta a identity como verificada
- **THEN** o status vira `VERIFIED`, `verifiedAt` é gravado e o domínio sai da fila de ação do dashboard

#### Scenario: Registro removido depois de verificado
- **WHEN** um domínio `VERIFIED` perde um registro de DKIM no DNS do cliente
- **THEN** o sistema detecta a regressão na próxima passada e sinaliza o domínio como problema no painel

#### Scenario: Falha de rede na conferência
- **WHEN** a consulta DNS falha por timeout
- **THEN** o sistema mantém o status anterior, registra a falha da tentativa e reconfere no ciclo seguinte, sem marcar o domínio como `FAILED`

### Requirement: Verificar agora

O operador SHALL poder disparar a verificação de um domínio sob demanda, sem esperar o ciclo do cron.

#### Scenario: Verificação manual bem-sucedida
- **WHEN** o operador clica em "verificar agora" logo depois de publicar os registros
- **THEN** o sistema reconfere na hora e atualiza a tela com o resultado de cada registro

#### Scenario: Verificação manual ainda pendente
- **WHEN** o operador clica em "verificar agora" e o DNS ainda não propagou
- **THEN** o painel informa que a propagação pode levar tempo e mostra quando foi a última conferência, em vez de sugerir que algo quebrou

### Requirement: Diagnóstico acionável em toda falha

Toda falha de verificação exibida no painel SHALL vir acompanhada do diagnóstico e da ação correspondente. O painel MUST NOT exibir uma falha apenas como "erro".

#### Scenario: Falha com causa conhecida
- **WHEN** o MX de MAIL FROM aponta para a região errada do SES
- **THEN** o painel nomeia a causa e oferece o valor correto para publicar

#### Scenario: Falha sem causa identificada
- **WHEN** o SES reporta a identity como falha sem detalhe utilizável
- **THEN** o painel mostra a mensagem crua do SES e sugere o próximo passo de investigação
