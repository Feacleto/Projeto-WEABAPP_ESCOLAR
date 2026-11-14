# Passo a passo do console — o que só o dono pode fazer

Escrito em 14/11/2026 para quem NÃO é programador. Quatro tarefas, em ordem de
urgência. Cada uma diz **para que serve**, **os cliques**, **como saber que deu
certo**, **quanto custa** e **de onde veio a informação**.

> **Como ler as marcas.** ✅ = confirmado em documentação oficial na data acima.
> ⚠️ = **não consegui confirmar**: confira na tela antes de confiar. Os menus do
> Google mudam de nome com frequência; se o nome na sua tela for diferente, o
> caminho é o mesmo, só o rótulo mudou.

Duas "casas" diferentes, e é fácil se perder entre elas:
- **Console do Firebase** (`console.firebase.google.com`) — projeto `alobuzinou-be81f`.
- **Console do Google Cloud** (`console.cloud.google.com`) — o MESMO projeto, com as
  ferramentas de alerta, backup e reCAPTCHA. Os dois usam a mesma conta Google.

Hoje o único alerta ligado é o de orçamento (R$ 5, em `deploy.md`), que avisa
de **custo** — não de **falha**. As tarefas 1 e 2 fecham isso.

---

## 1. Alerta de erro: o aviso que chega quando algo quebra

**Para que serve.** Se uma função agendada falhar de madrugada (a fatura que não
saiu, o aviso que não foi), ninguém fica sabendo. Este alerta manda um e-mail
quando o sistema registra um **ERRO**. Sem ele, o primeiro aviso é um motorista
ligando.

**Antes, defina o destino.** Um e-mail que você lê todo dia (✅ e-mail é um
"canal de notificação" aceito). ⚠️ O Google não tem canal de WhatsApp. Há outros
canais (SMS, aplicativo do Google Cloud no celular, Slack), mas **não confirmei**
quais estão disponíveis na sua conta — comece pelo e-mail.

**Os cliques (Console do Google Cloud):**
1. Menu ☰ → **Logging** → **Logs Explorer**.
2. Na caixa de consulta, cole **exatamente**:
   ```
   severity>=ERROR
   (resource.type="cloud_run_revision" OR resource.type="cloud_function")
   ```
   e clique em **Run query**. (Pode aparecer vazio — é o bom sinal — ou mostrar
   erros antigos.)
3. Menu **Actions** (ou "Ações") → **Create log alert** / "Criar alerta de log".
4. Nome: `Alô Buzinou — erro nas functions`. Avance.
5. **Notification rate limit** ("limite de frequência de notificações"): escolha
   **1 hora**. ✅ Este campo é obrigatório em alertas de log, e é ele que impede
   a sua caixa de entrada de receber 300 e-mails se o mesmo erro se repetir.
6. **Notification channel**: **Manage notification channels** → **Email** → seu
   e-mail → salvar → selecione-o.
7. **Save**.

**Como saber que deu certo (o teste que vale).** Escrever um erro de mentira:
no terminal com o `gcloud` instalado e logado no projeto, rode
```
gcloud logging write teste-do-alerta "Teste do alerta - pode ignorar" --severity=ERROR
```
⚠️ (comando do gcloud; não o verifiquei nesta pesquisa). Esse log NÃO aparece na
consulta acima, porque não vem de uma function. Para o teste, edite o alerta e
troque temporariamente a consulta por `severity>=ERROR AND logName:"teste-do-alerta"`,
dispare o comando, espere até ~10 minutos, **confirme que o e-mail chegou**, e
volte a consulta original. Se o e-mail não chegar, procure o motivo em Logs
Explorer com `log_id("monitoring.googleapis.com/notification_channel_events")`
(✅ é onde o Google registra falhas de envio).

**O que este alerta NÃO pega.** Uma função agendada que simplesmente **não
rodou** não escreve erro nenhum — silêncio não é erro. Isso precisa de outro
tipo de alerta (ausência de execução) e está pedido à parte.

**Custo.** ⚠️ Não confirmei a tabela de preços de alertas de log; para o volume
deste projeto o esperado é desprezível, mas confira em *Preços do Cloud
Monitoring/Logging*.

**Fontes (consultadas em 14/11/2026):**
[Configure log-based alerting policies](https://docs.cloud.google.com/logging/docs/alerting/log-based-alerts) ·
[Create and manage notification channels](https://docs.cloud.google.com/monitoring/support/notification-options) ·
[Troubleshoot missing notifications](https://docs.cloud.google.com/monitoring/alerts/troubleshoot-missing-notifications)

---

## 2. Cópia de segurança do banco (PITR + backup diário)

**Para que serve.** Hoje, se um dado for apagado ou corrompido (por um defeito
nosso, um deploy errado, um clique), **não existe como recuperar**. Duas redes,
que se completam:
- **PITR** (recuperação a um instante): volta o banco a qualquer minuto dos
  **últimos 7 dias** ✅. É o que salva de um erro de ontem.
- **Backup agendado**: uma cópia por dia, guardada por quanto tempo você
  escolher (até 14 semanas ✅). É o que salva de um erro descoberto tarde.

### 2a. Ligar o PITR
1. **Console do Firebase** → **Firestore Database** → **Disaster Recovery**
   ("Recuperação de desastres") → **Edit** ("Editar") → ligue **Point-in-time
   recovery** → salvar. ✅ (caminho descrito na documentação do Firestore)
2. ⚠️ Existe um comando `gcloud firestore databases update ... --enable-pitr` que
   circula na internet; **a documentação oficial que consegui ler só mostra a
   versão de DESLIGAR** (`--no-enable-pitr`). Use o console.

### 2b. Backup diário, guardado por 7 dias
No terminal com o `gcloud` (ou Cloud Shell no Console do Google Cloud):
```
gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=7d
```
✅ (sintaxe e limites da documentação: um agendamento diário e um semanal por
banco; retenção máxima de 14 semanas = `14w`; **não dá para escolher a hora**; a
recorrência não pode ser editada depois — só apagar e criar de novo). Existe o
equivalente `firebase firestore:backups:schedules:create` ✅.
Sugestão: **diário com `14w`** se o custo abaixo lhe parecer aceitável.

### 2c. Como saber que deu certo
- PITR: em *Disaster Recovery* aparece como ligado, com a janela de 7 dias.
- Backup: no dia seguinte, em *Disaster Recovery → Backups* deve haver uma cópia.
  **Faça um restore de teste** num banco novo (não no de produção) ao menos uma
  vez: backup que nunca foi restaurado é um palpite.

### 2d. Quanto custa (armazenamento, e só)
- PITR: cobrado como armazenamento extra, **sem franquia grátis**, e "em geral
  parecido com o custo de armazenar o próprio banco" ✅. Nota: pode haver
  cobrança de até 1 dia mesmo se desligar logo (⚠️ isto está escrito para o
  modo Datastore; presumo que valha aqui).
- Backup: cobrado por GiB-mês enquanto a cópia existe ✅; restaurar custa por GiB.
- Preços de lista que li na página do Firestore: ≈ **US$ 0,15 por GiB-mês**
  (PITR) e ≈ **US$ 0,03 por GiB-mês** (backup). ⚠️ São de tabela global e
  conversão minha de preço por hora; **não achei a tabela de São Paulo** — confira
  na calculadora. Para um banco abaixo de 1 GiB, a ordem de grandeza é de
  **centavos de dólar por mês**.

**Fontes (14/11/2026):**
[Firestore — PITR](https://firebase.google.com/docs/firestore/use-pitr) ·
[Firestore — backup e restauração](https://firebase.google.com/docs/firestore/backups) ·
[gcloud firestore backups schedules create](https://docs.cloud.google.com/sdk/gcloud/reference/firestore/backups/schedules/create) ·
[Preços do Firestore](https://cloud.google.com/firestore/pricing) ·
[Exportação manual (gcloud firestore export)](https://firebase.google.com/docs/firestore/manage-data/export-import)

**Plano B — exportação manual** (guarda uma foto do banco num bucket seu; exige
Blaze ✅ e um bucket perto do banco, que não seja "Requester Pays" ✅):
`gcloud firestore export gs://NOME-DO-SEU-BUCKET --database='(default)'`.

---

## 3. Mapa: plano pago e trava de domínio da chave (MapTiler)

**Para que serve.** O mapa ao vivo é o que as famílias abrem todo dia. Dois
riscos, um por item:
- **Plano.** O plano **grátis do MapTiler é só para uso não comercial** ✅ (Termos
  de uso). Um app que cobra mensalidade dos motoristas é uso comercial. E a cota
  do grátis acaba rápido: ⚠️ sites de terceiros dão ~100 mil requisições/mês e
  dizem que, estourada a cota, o serviço **para** — o mapa fica **cinza para
  todas as famílias ao mesmo tempo**, sem erro na tela. A conta do tamanho disso
  está em `docs/analise/02-confiabilidade.md` (estimativa nossa: o piloto já
  passa de 100 mil).
- **Chave.** A chave do mapa aparece no código do site (não dá para esconder: é o
  navegador quem pede a imagem). O que protege é **restringir a chave ao seu
  domínio** — assim, chave copiada não funciona em outro site.

**Os cliques (em `cloud.maptiler.com`, logado na conta dona da chave):**
1. **Plano:** *Account* → *Plan* (⚠️ o nome exato do menu pode variar) → escolha
   um plano que permita uso comercial. ⚠️ O mais barato que li é o **Flex, ~US$
   25/mês, 500 mil requisições e 25 mil "sessões"** — **de fonte de terceiros;
   confirme na página oficial de preços antes de pagar.**
2. **Trava de domínio:** *API keys* → a chave do app → **Settings** → campo
   **Allowed HTTP origins** → uma por linha: `https://alobuzinou.com`. ✅ Aceita
   curinga (`*.alobuzinou.com`) se um dia houver subdomínio.
   - ⚠️ **Cuidado que já pegou muita gente:** com origem cadastrada, requisição
     **sem** origem/referer é **rejeitada** ✅. O site já manda o cabeçalho certo
     (`Referrer-Policy: strict-origin-when-cross-origin`, em `firebase.json`),
     mas **teste logo depois de salvar** (item abaixo).
   - **Não** misture "origem" com "User-Agent" na mesma chave: as duas regras
     valem juntas (E, não OU) e bloqueiam gente legítima ✅.
   - Para desenvolver localmente use **outra chave** (sem `localhost` na de
     produção).
3. **Colocar no site:** a chave vai em `VITE_MAPTILER_KEY` no `.env` **da pasta de
   produção**. Desde esta rodada, o build de produção **se recusa a terminar sem
   ela**, dizendo o que falta — não há mais o mapa cinza silencioso.

**Como saber que deu certo.** Abra `https://alobuzinou.com` em uma janela
anônima, entre como responsável, abra o mapa: as ruas aparecem. Depois, o teste
que prova a trava: abra o endereço de um tile com a sua chave **direto na barra
do navegador** (⚠️ monte a URL a partir de `src/config/mapa.js`): sem origem, deve
ser **recusado**.

**Fontes (14/11/2026):**
[Termos do MapTiler Cloud](https://www.maptiler.com/cloud/terms/) ·
[Preços](https://www.maptiler.com/cloud/pricing/) ·
[Como proteger sua chave](https://docs.maptiler.com/guides/maps-apis/maps-platform/how-to-protect-your-map-key/) ·
[Chaves de API](https://docs.maptiler.com/cloud/api/authentication-key/)
(⚠️ as páginas oficiais de preço abriram incompletas na pesquisa; os números de
cota e valor vêm de listagens de terceiros — **confirme**).

---

## 4. App Check: a chave reCAPTCHA Enterprise

**Para que serve.** Hoje qualquer script de fora pode chamar as funções do app
como se fosse o app. O App Check faz o site provar "sou o app de verdade". O
código já está pronto e **desligado**; falta a chave e a ordem certa.

⚠️ **É reCAPTCHA ENTERPRISE, não o "v3".** Os dois são produtos diferentes, com
chaves que não se misturam; o código usa o Enterprise (`src/firebase/config.js`).
Uma chave v3 no lugar errado faz o app real ser recusado quando a imposição for
ligada.

**Os cliques:**
1. **Console do Google Cloud** → ative a **reCAPTCHA Enterprise API** (⚠️ o
   Google pode pedir isso na primeira vez) → **reCAPTCHA Enterprise** → **Create
   key**.
2. Tipo **Web** (site). **Não** marque "Use checkbox challenge" ✅ (precisa ser
   invisível, por pontuação). Domínios: `alobuzinou.com`. ✅ **Nunca** coloque
   `localhost` numa chave de produção. Salve e **copie a "site key"**.
3. **Console do Firebase** → **App Check** → aba **Apps** → o app Web →
   **reCAPTCHA Enterprise** → cole a chave → salvar. ✅
4. Ponha a chave em `VITE_APPCHECK_SITE_KEY` no `.env` da pasta de produção e
   **publique o site** (`deploy.md`). Agora o app passa a enviar o token.
5. **Espere e olhe as métricas** (App Check → métricas de cada serviço) por
   alguns dias: a coluna de "verificadas" tem de ser a grande maioria e a de
   "recusaria" quase zero. (Prazo e limiares: decisão sua com a Segurança.)
6. **Só então** ligar a imposição das functions: `EXIGIR_APP_CHECK=true` em
   `functions/.env` e publicar as functions. **Ligar antes do passo 5 derruba o
   app inteiro.** A imposição nos produtos do Firebase (Firestore, Storage) é
   outra chave no console e **não faz parte deste plano** — não ligue sem
   combinar.

**Como saber que deu certo.** Passo 4: no navegador do app (aba Rede), as chamadas
a `cloudfunctions.net` levam o cabeçalho `X-Firebase-AppCheck`. Passo 6: depois de
ligar, o app continua funcionando **e** uma chamada de `curl` sem token é
recusada.

**Custo.** ⚠️ Não confirmei a franquia gratuita do reCAPTCHA Enterprise nem quanto
o App Check consome dela. Confira em *reCAPTCHA Enterprise → preços* antes do
passo 5, porque o app pede token a cada renovação.

**Fonte (14/11/2026):**
[App Check com reCAPTCHA Enterprise na web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)

---

## O que eu NÃO consegui confirmar (resumo)

| Item | Estado |
|---|---|
| Criar alerta de log com filtro `severity>=ERROR` e canal de e-mail | ✅ peças confirmadas; **o conjunto num único exemplo oficial, não** |
| Canais além do e-mail (SMS, app do Google, WhatsApp) | ⚠️ WhatsApp não existe; os outros não confirmei |
| `gcloud logging write ... --severity=ERROR` para o teste | ⚠️ conhecido, não verificado agora |
| Preço de alertas/logs | ⚠️ não consultado |
| Ligar PITR em banco existente por `gcloud` | ⚠️ só o console está confirmado |
| Preço de PITR/backup **em São Paulo** | ⚠️ só tabela global |
| Cota e preço exatos do MapTiler (grátis, Flex) | ⚠️ fonte de terceiros; o "só não comercial" é ✅ dos Termos |
| Franquia do reCAPTCHA Enterprise | ⚠️ não consultada |
| Nomes exatos de menus do Console | ⚠️ mudam; o caminho é o descrito |

**Antes de executar qualquer uma:** a Condução revisa este arquivo. **Depois de
executar:** marque aqui a data e quem fez, para o próximo saber o que existe de
verdade no console (não há registro de que alguma delas esteja ligada hoje — e
"está ligado" é uma afirmação que só o console prova).

| Tarefa | Feito em | Por quem | Testado (como) |
|---|---|---|---|
| 1. Alerta de erro por log | | | |
| 2a. PITR | | | |
| 2b. Backup diário | | | |
| 3. MapTiler: plano + trava de domínio | | | |
| 4. App Check: chave + métricas | | | |
