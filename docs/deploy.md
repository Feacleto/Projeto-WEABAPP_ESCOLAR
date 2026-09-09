# Como colocar o Alô Buzinou no ar

Este arquivo existe porque o deploy tem **uma ordem que não é opcional** e
**dois pré-requisitos de console** que nenhum comando resolve. Seguindo daqui
de cima pra baixo, funciona.

Projeto: `alobuzinou-be81f` · Região das functions: `southamerica-east1`

---

## Antes de tudo: dois cliques que só você pode dar

### 1. Plano Blaze (obrigatório, não tem contorno)

Cloud Functions v2 **só roda no Blaze**. E sem functions o app não tem como
funcionar — não é degradação, é bloqueio: `redeemInvite` é o único caminho que
existe pra criar conta de responsável, porque o cliente perdeu essa permissão
quando a escalada de privilégio foi fechada.

> Console → ⚙️ Configurações do projeto → **Uso e faturamento** → Modificar plano

O Blaze **mantém a cota gratuita** do Spark. Com um motorista e vinte famílias
o uso fica dentro dela. O cartão é exigência de cadastro, não cobrança
garantida. Exige cartão de **crédito** — débito e pré-pago costumam ser
recusados pelo Google.

Pra dormir tranquilo: Google Cloud Console → Faturamento → Orçamentos e
alertas → orçamento de R$ 5 com alerta em 50%. Alerta avisa; não desliga.

### 2. Cloud Storage (um clique, depois do Blaze)

> Console → **Storage** → Get Started → aceitar as regras padrão → escolher a
> região (use `southamerica-east1`, a mesma das functions)

Storage guarda três coisas: comprovante de pagamento, foto de perfil e foto da
criança. **O app funciona sem ele** — `src/config/capabilities.js` desliga os
botões de anexo em vez de deixar o upload falhar como erro de rede. Mas com
Blaze ativo não há razão pra deixar desligado.

### 3. O documento que te deixa entrar no /admin

O painel do dono é protegido por `role: 'owner'`, e **nada no app grava esse
papel** — o `create` de `users` só aceita `role == 'admin'`, e as rules
proíbem o usuário de mexer no próprio papel. É de propósito: foi assim que a
escalada de privilégio se fechou, e é por isso que o gate da plataforma
precisa nascer fora do app.

Crie o LOGIN pelo app (ou pelo Authentication do console), copie o uid e:

> Console → Firestore → coleção `users` → **Adicionar documento** com o uid
> como ID → campo `role` (string) = `owner`

⚠️ **`superAdmin: true` NÃO FUNCIONA MAIS** — o fallback saiu em 06/09/2026 de
[papeis.js](../src/dominio/identidade/papeis.js), de
[functions/lib/papeis.js](../functions/lib/papeis.js) e do `isOwner()` das
rules. Ele existia só porque a conta do dono do projeto ANTIGO nasceu como
motorista com a flag por cima; esse projeto foi excluído, e base zero era a
única janela em que a ponte podia cair sem trancar ninguém.

**Podem existir VÁRIOS donos.** `isOwner()` checa o papel, não a identidade —
cada pessoa da administração ganha um documento com `role: 'owner'`, criado do
mesmo jeito. Não há papel de "observador": quem entra no painel vê tudo,
inclusive CPF e chave PIX dos parceiros.

---

## São DOIS sites agora, e o comando mudou

Desde 05/09/2026 o projeto serve **dois sites do mesmo projeto Firebase**:

| Target | Site do Hosting | Pasta | Domínio | O que é |
|---|---|---|---|---|
| `app` | `alobuzinou-be81f` (padrão) | `dist/` | `alobuzinou.com` | o PWA — motorista, responsável e dono |
| `landing` | `alobuzinou-landing` (criado) | `landing/` | `alobuzinou.com.br` | a página institucional, HTML estático |

**Os nomes dos sites não têm valor de marca, e isso não é descuido.** O site
padrão herda o ID do projeto, que saiu `alobuzinou-be81f` porque `alobuzinou`
estava preso pelo projeto excluído. Com o padrão já sem nome bonito, tanto faz
qual peça mora nele — o ID do site só aparece na URL `.web.app`, que some
assim que o domínio próprio entra.

**`firebase deploy --only hosting` agora sobe os dois.** Para subir um só:

```bash
firebase deploy --only hosting:app        # só o PWA
firebase deploy --only hosting:landing    # só a landing (não precisa de build)
```

A landing **não passa por build**: é um `index.html` só, com CSS e JS inline.
Editar o arquivo e rodar o deploy do target é o ciclo inteiro.

### Antes do primeiro deploy da landing — um comando de console

O site `alobuzinou-be81f` nasce junto com o projeto (é o padrão) e já atende
o target `app`. O da landing não existe. Uma vez só:

```bash
firebase hosting:sites:create alobuzinou-landing
```

O `.firebaserc` já aponta o target `landing` para esse ID. Se você criar com
outro nome, mude lá.

**Por que não `alobuzinou`:** o nome está preso pelo projeto excluído, que
fica em exclusão pendente por 30 dias. Não vale esperar por ele — quem alcança
a landing digita `alobuzinou.com.br`, nunca o ID do site.

### Os domínios: um por peça, decidido em 05/09/2026

Os dois domínios estão na Hostinger e **cada um serve uma coisa diferente**.
Não há subdomínio.

```
alobuzinou.com.br       →  site "alobuzinou-landing"  (a landing)
alobuzinou.com          →  site "alobuzinou-be81f"    (o PWA)
www.alobuzinou.com.br   →  301 → alobuzinou.com.br
www.alobuzinou.com      →  301 → alobuzinou.com
```

**A alternativa descartada era `app.alobuzinou.com.br`**, com o `.com` inteiro
virando 301 de defesa de marca. Ela mantinha a marca num domínio só, e perdeu
para a simplicidade de usar os dois domínios que já existiam sem criar
subdomínio nenhum.

**O que a escolha custa, e precisa ficar escrito:** a marca passa a ter dois
endereços. Quem se anuncia em `.com.br` e manda link de `.com` está pedindo
para a mãe conferir duas vezes — e link de terceiro com domínio que não bate
tem a forma de um golpe. Não há conteúdo duplicado (são páginas diferentes, não
a mesma em dois lugares), e o `<link rel="canonical">` da landing segue no
`.com.br`. O risco é de leitura, não de SEO.

E o `.com` deixou de ser defesa de marca: **se ele expirar, o app cai junto.**
Renovação automática nos dois não é zelo, virou dependência.

Os dois `www` redirecionam pelo próprio Firebase — ao adicionar o domínio,
escolha a opção de redirecionar em vez de servir conteúdo.

### ⚠️ Mudar o app de domínio quebra três coisas de quem já usa

Isso vale para o dia em que o PWA sair de `alobuzinou-be81f.web.app` para
`alobuzinou.com`. **Hoje a base é zero**, então o custo também é — e é
por isso que a hora de amarrar o domínio é ANTES do primeiro convite circular
no WhatsApp, não depois. Feito depois, cada linha abaixo tem dono:

| O quê | Por quê |
|---|---|
| **PWA instalado** | `start_url` é `/?atalho=1` no domínio antigo. O ícone na tela deles aponta para lá. |
| **Links de convite** | `/convite/:codigo` já circulou no WhatsApp, e a `/familia` **promete** que o link "não vence e não se gasta". |
| **Sessões** | Auth do Firebase é por domínio. Todo mundo é deslogado. |

**A saída:** manter o domínio antigo respondendo com **301 preservando o path**
para o novo. Aí `/convite/ABC123` continua funcionando e a promessa da
`/familia` permanece verdadeira.

Adicione também o domínio novo em **Authentication → Settings → Authorized
domains**, senão o login quebra em silêncio.

### A CSP da landing é outra, e mais fechada

A landing não fala com o Firebase, então a CSP dela não abre `connect-src` para
nada além de `'self'`. Ela já entra em **enforcement**, não em Report-Only —
é página estática, sem autenticação e sem dado de usuário, então não há o risco
que justificou as duas etapas no app.

A exceção é `script-src 'unsafe-inline'`: o JS da landing é inline, num arquivo
só. Trocar por hash SHA-256 exigiria recalcular a cada edição do arquivo, e a
página não renderiza nenhuma entrada de usuário — o `encodeURIComponent` do
formulário é o único ponto que toca texto digitado, e ele vira URL de WhatsApp,
nunca DOM.

---

## O deploy, na ordem

A ordem importa em **um** ponto crítico: **functions antes de hosting**. Site
novo contra funções velhas (ou ausentes) quebra na primeira tela — a home chama
`getShowcase` e a entrada do responsável chama `redeemInvite`.

```powershell
# 0. Sempre valide antes de subir
npm run lint
npm run build

# 1. Índices (nada depende deles pra existir, mas consultas quebram sem)
firebase deploy --only firestore:indexes

# 2. Regras do banco
firebase deploy --only firestore:rules

# 3. Regras do Storage (só depois do "Get Started" no console)
firebase deploy --only storage

# 4. Functions — o núcleo, 14 de 16. Ver a nota do Resend abaixo.
#    ⚠️ PREFIRA `.\deploy.ps1`: ele CONFERE esta lista contra os `exports.` de
#    functions/index.js antes de gastar o deploy. Um nome apagado aqui aborta
#    o deploy INTEIRO ("the following filters do not exist") e nada sobe —
#    inclusive redeemInvite, que é o caminho todo do responsável. Esta lista
#    já esteve errada duas vezes.
firebase deploy --only functions:lookupInvite,functions:redeemInvite,functions:getShowcase,functions:getInvitePreview,functions:contratarPlano,functions:closeStaleRoutes,functions:confirmarAusencias,functions:sendPushOnNotification,functions:generateMonthlyPayments,functions:runBillingNow,functions:flagDuplicateReceipts,functions:backfillTestimonialPrivacy,functions:asaasWebhook,functions:criarCobrancaDaFatura

# 5. Por último os sites (os DOIS — ver a seção acima para subir um só)
firebase deploy --only hosting
```

No PowerShell **não use `&&`** — ele não é separador válido nesta versão. Rode
uma linha por vez, ou separe com `;`.

### Por que as functions estão listadas uma por uma

Duas das 14 (`sendPaymentReminders` e `runPaymentRemindersNow`, o lembrete por
e-mail) declaram o segredo `RESEND_API_KEY`. Como e-mail não é o caminho
principal (a cobrança real acontece no WhatsApp), o comando acima sobe as 12
que não dependem de nada.

⚠️ **O `--only` NÃO evita o segredo, e isto custou uma tarde.** O CLI carrega e
analisa o código do projeto INTEIRO antes de aplicar o filtro — e o
`defineSecret('RESEND_API_KEY')` no topo do módulo faz ele consultar o Secret
Manager nessa análise. Em projeto novo a API do Secret Manager está desligada, e
o deploy morre com 403 antes de olhar a lista de funções.

O destravamento é criar o segredo, o que liga a API junto:

```powershell
firebase functions:secrets:set RESEND_API_KEY
```

Enquanto não houver conta no [Resend](https://resend.com), use um valor que se
denuncie — `PLACEHOLDER-substitua-pela-chave-real-do-resend`. Se alguém publicar
as duas functions de e-mail sem trocar, o Resend recusa com chave inválida em
vez de falhar em silêncio.

Quando a chave real existir:

```powershell
firebase functions:secrets:set RESEND_API_KEY
firebase deploy --only functions:sendPaymentReminders,functions:runPaymentRemindersNow
```

### Os segredos do gateway de cobrança

Dois, e eles não se substituem:

```powershell
firebase functions:secrets:set ASAAS_WEBHOOK_TOKEN   # gerado no painel, em Integrações
firebase functions:secrets:set ASAAS_API_KEY         # a chave da API, SEM permissão de saque
```

⚠️ **Cole no prompt escondido, nunca na linha de comando.** Chave em linha de
comando fica no histórico do PowerShell, e um `$` no início dela vira nome de
variável — foi assim que uma chave chegou vazia ao Secret Manager e devolveu
401 sem dizer por quê.

⚠️ **A chave da API não pode ter permissão de transferência.** Ela vaza em log
mais fácil do que se imagina; sem saque, o pior caso é cobrança indevida — que
se estorna — e não dinheiro saindo da conta, que não volta.

**O ambiente é um parâmetro, não um segredo:** `ASAAS_AMBIENTE`, padrão
`sandbox`, em `functions/.env.alobuzinou-be81f` — **versionado de propósito**.

⚠️ **O `default` do `defineString` NÃO vale em modo não-interativo.** Sem esse
arquivo o deploy para com *"In non-interactive mode but have no value for the
following environment variables: ASAAS_AMBIENTE"* e não sai do lugar, mesmo
com o padrão declarado no código. Por isso ele tem uma exceção no
`functions/.gitignore`, que ignora `.env.*`: o valor não é segredo, e quem
clonar o repositório precisa conseguir publicar. Chave de sandbox contra o host de produção devolve 401, que é falha
barulhenta; apontar para produção sem querer cobra gente de verdade. Para virar,
`ASAAS_AMBIENTE=producao` no `.env.alobuzinou-be81f` dentro de `functions/`.

---

## ⚠️ Projeto dentro de ORGANIZAÇÃO: o papel que trava tudo

Registrado em 06/09/2026, depois de as 12 functions falharem em bloco com a
mesma mensagem — e nenhuma delas por causa de código:

> *Could not build the function due to a missing permission on the build service
> account. (…) this could be caused by a change in the organization policies.*

**A causa.** Cloud Functions v2 não publica o código direto: ele empacota num
container antes, e quem faz isso é a conta de serviço padrão do Compute Engine
(`<número-do-projeto>-compute@developer.gserviceaccount.com`). Ela precisa do
papel **`roles/cloudbuild.builds.builder`** para gravar o resultado do build.

Em projeto solto o Google concede sozinho. **Em projeto dentro de organização,
não** — e o `alobuzinou-be81f` nasceu dentro de `felipe-anacleto2002-org`,
criada junto com a conta de faturamento.

**O conserto**, no console:

> IAM e administrador → IAM → marcar **"Incluir concessões de papéis fornecidas
> pelo Google"** (sem isso a conta nem aparece na lista) → editar a conta
> `<número>-compute@developer.gserviceaccount.com` → adicionar
> `roles/cloudbuild.builds.builder`

Espere um ou dois minutos: permissão de IAM não vale na hora.

**Passe `--force` no primeiro deploy de functions**, ou rode
`firebase functions:artifacts:setpolicy` depois. Sem política de limpeza, as
imagens de container se acumulam no Artifact Registry e viram alguns centavos
por mês para sempre.

---

## Trocar a conta de faturamento sem mexer no projeto

Conta de faturamento e projeto são coisas separadas, e **a conta se anexa a um
projeto que já existe** — inclusive de outra conta Google. Recriar o projeto
para trocar de pagador joga fora ID, DNS, sites, verificação de domínio e o
domínio no ar.

O caminho, quando o pagador está noutra conta Google:

1. Na conta que TEM o faturamento: Faturamento → Gerenciamento da conta →
   **Adicionar principal** → o e-mail da conta dona do projeto, papel
   **Usuário da conta de faturamento** (Admin também serve)
2. Na conta DONA do projeto: `console.cloud.google.com/billing/linkedaccount?project=<id>`
   → **Alterar conta de faturamento**

**Confira pelo ID, não pelo nome.** Contas de faturamento nascem todas como
"Minha conta de faturamento", e escolher a errada de uma lista de três iguais é
o erro fácil. Renomeie as suas.

**Conta de faturamento FECHADA continua vinculada** e não avisa em lugar nenhum
do Firebase — o sintoma é a API de Functions responder `SERVICE_DISABLED` como
se o projeto estivesse no Spark. Quem denuncia é o banner vermelho da tela de
gerenciamento da conta, no Google Cloud.

---

## Depois que subir: três verificações

1. **A `/familia` carrega e mostra os contadores.** É a porta que realmente
   chama `getShowcase`. Se os números aparecerem, a callable está no ar e o
   Firestore respondeu.

   ⚠️ Esta verificação dizia "a home carrega e mostra o parceiro". A home
   pública do motorista foi APAGADA em 06/09/2026 — `/` é
   `<Navigate to="/login">` —, então o passo era inexecutável como escrito. E
   `/familia` só é alcançável pelo link de convite ou pelo endereço direto: a
   landing não linka para ela.

2. **O backfill de privacidade.** `/admin` → Manutenção → **Verificar**. É
   simulação, não escreve nada: conta quantos depoimentos públicos ainda
   carregam nome completo ou foto sem consentimento. Se der zero, a base estava
   limpa e fechar a porta bastou. Se der mais que zero, **Aplicar correção**.

3. **A entrada do responsável, ponta a ponta.** Cadastre uma criança, copie o
   link do convite e abra em outro aparelho (ou em janela anônima). É o caminho
   de 9 em 10 responsáveis e o único que passa por `redeemInvite`.

---

## Os cabeçalhos de segurança, e a CSP em duas etapas

O bloco `headers` do `firebase.json` deixou de ter só `Cache-Control`. Como
JSON não aceita comentário, o porquê mora aqui.

**Não dá pra conferir cabeçalho com o emulador.** O emulador de hosting
**ignora o bloco `headers`** — nem o `Cache-Control: immutable` de
`/assets/**`, que está no arquivo há semanas, sai na resposta dele. Conferido
com `curl -I`. Pra ver os cabeçalhos de verdade antes de publicar:

```bash
npm run build
npm run servir          # dist/ em :5050, aplicando o firebase.json
curl -sI http://127.0.0.1:5050/ | grep -i security
```

### A CSP está em `Report-Only`. Isso é a etapa 1 de 2.

`Content-Security-Policy-Report-Only` **não bloqueia nada** — só relata no
console do navegador o que seria bloqueado. É o único jeito honesto de subir
uma política: a alternativa é descobrir a origem esquecida em produção, com o
app quebrado na mão de quem está usando.

**Antes de trocar para enforcing,** percorra com o console aberto (use
`npm run servir`, não o emulador) e confirme ZERO violação em:

| Tela | O que ela exercita |
|---|---|
| `/` (home) | fontes do Google, avatar do dicebear, callable `getShowcase` |
| `/familia` | mesma callable, outra porta |
| login com Google | o iframe do `authDomain` — `frame-src` |
| `/pai/map` ou `/tio/route` | tiles do OpenStreetMap |
| cadastro de criança | **Nominatim** (geocoding) e o `capture` da câmera |
| qualquer foto/comprovante | download do Firebase Storage |
| receber uma notificação | o service worker do FCM, que importa de `gstatic` |

**A troca é de uma palavra:** em `firebase.json`, o `key`
`Content-Security-Policy-Report-Only` vira `Content-Security-Policy`. Nada
mais muda.

### Origens que precisaram entrar, e por quê

Todas foram confirmadas no código, não copiadas de um modelo:

- **`www.gstatic.com` em `script-src`** — `public/firebase-messaging-sw.js` faz
  `importScripts` de lá. Sem isso, push para de registrar.
- **`'unsafe-inline'` em `style-src`** — o `react-hot-toast` usa `goober`, que
  injeta `<style>` em runtime. Não há equivalente em `script-src`: o HTML
  gerado não tem um único script inline.
- **`nominatim.openstreetmap.org`** — o geocoding do cadastro de criança.
- **`*.tile.openstreetmap.org`** — os tiles do Leaflet (`{s}` é subdomínio).
- **`api.dicebear.com`** — avatares, e em `img-src`, não `connect-src`.
- **`*.googleusercontent.com`** — foto de quem entrou com conta Google.
- **`firebasestorage.googleapis.com`** — foto, comprovante e logo.
- **O `authDomain` em `frame-src`** — o `firebase/auth` monta um iframe lá pro
  login com Google, e é outra origem que a do site.

**O que NÃO entrou, e é decisão:** `firebaseio.com` (Realtime Database). Ele
aparece em todo exemplo de CSP do Firebase, mas este projeto não usa RTDB —
conferido. Origem que o app não alcança só enfraquece o controle.

**`connect-src` é enumerado, não `*.googleapis.com`.** É ele o controle
antiexfiltração: com a lista fechada, nem um script malicioso rodando na
origem consegue mandar dado pra fora. Curinga em `googleapis.com` devolveria
metade dessa garantia.

## O próximo passo: App Check

Ele responde a pergunta que a CSP não responde — *esta chamada veio do meu
app?*. Os `maxInstances` das functions limitam o dano de quem passa; o App
Check é quem impede de passar.

**A ordem importa e não é opcional:** registre o app no console
(App Check → reCAPTCHA v3 para web) ANTES de ligar `enforceAppCheck` em
qualquer function. Ligado antes do registro, ele derruba o app inteiro.

## O e-mail de cobrança: domínio próprio e custo

Estava em `functions/README.md`, que descrevia 2 das 15 functions e por isso
saiu — quem abria achava que `functions/` era sobre e-mail.

**Enquanto não há domínio próprio**, o remetente é o sandbox do Resend
(`onboarding@resend.dev`), fixo em `functions/index.js`. Para trocar:

1. Resend → **Domains** → "Add Domain" → `alobuzinou.com.br`
2. Configurar os três registros DNS que ele mostra (MX, SPF/TXT, DKIM)
3. Aguardar a verificação (~1h)
4. Atualizar `FROM_EMAIL` em `functions/index.js`
5. `firebase deploy --only functions`

**Custo, na ordem de grandeza deste projeto:** o Resend dá 3.000 e-mails/mês
grátis (acima, ~US$ 0,40 por mil). As functions somam uma execução por dia mais
~3 operações por mensalidade — com 50 alunos ativos são ~150 operações/dia, o
que no Blaze custa centavos por ano.

O que muda essa conta não é o volume de uso legítimo: é abuso nas quatro
callables públicas. Por isso elas têm `maxInstances` apertado — ver
`functions/lib/limites.js`.

## O que fica de fora, de propósito

- **App Check** nas **três** callables públicas (`getShowcase`,
  `lookupInvite`, `getInvitePreview`). Elas aceitam chamada sem login e têm
  freio de tentativa por hora (`maxInstances: 3`), mas nada prova que quem
  chama é o app. Precisa de uma chave reCAPTCHA v3 criada por você, e ela tem
  que ser registrada no console **antes** de qualquer `enforceAppCheck` —
  invertido, derruba o app.

  A mais custosa é `getInvitePreview`: cada chamada lê a criança, os pagamentos
  em aberto e conta os recados.

  ⚠️ `joinDriverWaitlist` saiu desta lista: a function foi apagada em
  06/09/2026 com a fila.
- ~~**Testes das rules.**~~ **FEITO.** `scripts/testar-regras.mjs` existe com
  **219 casos** e `scripts/testar-storage.mjs` com **32**, os dois contra o
  emulador, contra o arquivo do disco, **sem nenhuma dependência nova** — são
  scripts Node puros, no padrão de `scripts/`. Esta linha dizia que era preciso
  "acrescentar dependência de teste ao projeto", e era o que fazia o item
  parecer caro.

  Rode os dois à mão antes de publicar rule:
  `firebase emulators:exec --only auth,firestore "node scripts/testar-regras.mjs"`
  e
  `firebase emulators:exec --only auth,firestore,storage "node scripts/testar-storage.mjs"`.
- **Gate de dono em custom claim.** Hoje é `users.role == 'owner'`, lido por
  `isOwner()` nas rules e `ehDono()` no cliente. Em claim, viraria uma garantia
  no token em vez de uma leitura de documento por regra.

  ⚠️ Esta linha dizia "hoje `superAdmin` é campo em documento" — e o mesmo
  arquivo, 400 linhas acima, já diz que `superAdmin` não abre mais nada
  (saiu em 06/09/2026). O gate é o PAPEL.

---

## Se algo falhar

| Mensagem | O que é |
|---|---|
| `Billing account ... is not open` | Blaze não está ativo. Nada de functions sobe. |
| `Firebase Storage has not been set up` | Falta o "Get Started" no console. |
| `Failed to list functions` | Quase sempre é o Blaze também. |
| Deploy parado pedindo um valor | É o `RESEND_API_KEY`. Suba as 12 do núcleo. |
| Login do pai dá erro de função | Hosting subiu antes das functions. Suba functions e recarregue. |

---

## Anexo: trocar de projeto Firebase

Escrito em 05/09/2026, quando `projeto-tio-nino-digital` foi excluído e tudo
recomeçou em `alobuzinou-be81f`. Havia zero usuário, então **não houve migração** —
não teve export de Firestore, de Auth nem de Storage. O trabalho foi
reapontar configuração e refazer console.

### Dois nomes são globais, e é o que trava

| O quê | Regra |
|---|---|
| **Project ID** | Permanente, e o Google **nunca reusa** ID de projeto excluído. `projeto-tio-nino-digital` está fora para sempre. |
| **Site ID do Hosting** | Global entre todos os projetos do Firebase. E o site padrão herda o ID do projeto — então um site preso bloqueia até a criação do projeto de mesmo nome. |

**E aconteceu na primeira tentativa.** O projeto foi criado com o nome de
exibição `alobuzinou` e saiu com o ID `alobuzinou-be81f`: o Firebase acrescenta
um sufixo EM SILÊNCIO quando o nome está tomado, e o cabeçalho do console
mostra o nome, não o ID. Quem confia no cabeçalho configura o repositório
inteiro errado. O ID real aparece em `firebase projects:list`, em ⚙️
Configurações → Geral, e no remetente dos e-mails do Auth
(`noreply@<id>.firebaseapp.com`) — foi por esse último que este aqui apareceu.

Projeto excluído entra em **exclusão pendente por 30 dias** segurando os dois.
Se a criação falhar por conflito de nome, é isso: ou você restaura o projeto
velho pra liberar o nome, ou escolhe outro. Não adianta insistir.

### Os lugares que ficam presos ao ID antigo

Nenhum deles é encontrado por teste — o `npm run testar` é de domínio puro e
passa igual com o projeto errado. A busca é `grep -rn "<id-antigo>"`.

| Arquivo | O que tem |
|---|---|
| `.env` | as 7 `VITE_FIREBASE_*` |
| [`.firebaserc`](../.firebaserc) | projeto padrão e os dois targets de hosting |
| [`firebase.json`](../firebase.json) | **a CSP** — `southamerica-east1-<id>.cloudfunctions.net` e o `frame-src` do `authDomain` |
| [`functions/index.js`](../functions/index.js) | `APP_URL`, que vai nos e-mails de cobrança |
| [`index.html`](../index.html) | `og:url` e `og:image` |
| `deploy.ps1` | a URL impressa no fim |
| `scripts/testar-regras.mjs`, `scripts/testar-storage.mjs` | o `PID` do emulador |

**A CSP é a que morde tarde.** Ela está em `Report-Only`, então ID errado ali
não quebra nada hoje — quebra no dia em que virar enforcing, e aí param de uma
vez todas as callables e o login com Google. Report-Only é justamente o que
esconde o erro até o pior momento.

O que **não** precisa mexer, pra não caçar fantasma:
[`inviteUrl.js`](../src/dominio/identidade/inviteUrl.js) monta o link do
`window.location.origin`; os scripts `.cjs` leem do `.env`; a `landing/`
não fala com Firebase nenhum.

### A janela de bootstrap fica aberta no meio do caminho

A regra de `users` permite criar documento com `role: 'admin'` enquanto
`appState/init` não existir, e **não restringe os outros campos**
([firestore.rules](../firestore.rules)). É a única forma de existir o primeiro
motorista — e enquanto ela está aberta, qualquer pessoa na internet pode se
cadastrar como motorista no seu projeto.

Ela abre no `deploy --only firestore:rules` e fecha no último passo do
`node scripts/criar-contas-teste.cjs`. **Rode os dois na mesma sessão.** Com
base zero o dano possível é nenhum, mas o intervalo é a única fresta de
escalada de privilégio que o projeto tem por construção — e ela não se fecha
sozinha com o tempo.
