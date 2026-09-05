# Como colocar o Alô Buzinou no ar

Este arquivo existe porque o deploy tem **uma ordem que não é opcional** e
**dois pré-requisitos de console** que nenhum comando resolve. Seguindo daqui
de cima pra baixo, funciona.

Projeto: `alobuzinou` · Região das functions: `southamerica-east1`

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

**Não use `superAdmin: true` em projeto novo.** Ele ainda funciona
([papeis.js](../src/dominio/identidade/papeis.js) e `isOwner()` nas rules
aceitam os dois), mas existe só porque a conta do dono do projeto ANTIGO
nasceu como motorista com a flag por cima e migrar exigia console. Base zero é
a única chance de o fallback nunca ter usuário — usá-lo agora seria recriar de
graça a dívida que ele representa.

---

## São DOIS sites agora, e o comando mudou

Desde 05/09/2026 o projeto serve **dois sites do mesmo projeto Firebase**:

| Target | Site do Hosting | Pasta | Domínio | O que é |
|---|---|---|---|---|
| `app` | `alobuzinou-app` (criado) | `dist/` | `app.alobuzinou.com.br` | o PWA — motorista, responsável e dono |
| `landing` | `alobuzinou` (padrão) | `landing/` | `alobuzinou.com.br` | a página institucional, HTML estático |

**A landing está no site PADRÃO e o app num site criado**, e é o inverso do que
parece natural. O site padrão herda o ID do projeto e é o único que não pode
ser apagado; o canônico da marca é `alobuzinou.com.br`, e quem atende ali é a
landing. Pôr o app no endereço mais permanente do projeto seria dar a âncora à
peça que muda mais.

**`firebase deploy --only hosting` agora sobe os dois.** Para subir um só:

```bash
firebase deploy --only hosting:app        # só o PWA
firebase deploy --only hosting:landing    # só a landing (não precisa de build)
```

A landing **não passa por build**: é um `index.html` só, com CSS e JS inline.
Editar o arquivo e rodar o deploy do target é o ciclo inteiro.

### Antes do primeiro deploy do app — um comando de console

O site `alobuzinou` nasce junto com o projeto (é o padrão) e já atende o
target `landing`. O do app não existe. Uma vez só:

```bash
firebase hosting:sites:create alobuzinou-app
```

O `.firebaserc` já aponta o target `app` para esse ID. Se você criar com
outro nome, mude lá.

### Os domínios: um canônico, o resto redireciona

Comprados os dois (`.com.br` e `.com`), **o canônico é o `.com.br`** — o público
é 100% brasileiro e o nome é português. O `.com` existe como defesa de marca.

```
alobuzinou.com.br       →  site "alobuzinou"       (a landing, site padrão)
app.alobuzinou.com.br   →  site "alobuzinou-app"   (o PWA)
alobuzinou.com          →  301 → alobuzinou.com.br
www.*                   →  301 → alobuzinou.com.br
```

**Nunca sirva conteúdo nos dois domínios.** Google trata como conteúdo
duplicado e divide a autoridade; pior, o motorista recebe dois links e pergunta
qual é o verdadeiro. O `<link rel="canonical">` da landing já aponta para o
`.com.br`.

O 301 do `.com` se faz de dois jeitos — **o segundo é mais simples e é o
recomendado**:

1. Um terceiro site no Firebase só com `redirects` no `firebase.json`.
2. **Encaminhamento com 301 no próprio registrador.** Registro.br e a maioria
   dos registradores oferecem isso sem custo. Zero infraestrutura.

### ⚠️ Mudar o app de domínio quebra três coisas de quem já usa

Isso vale para o dia em que o PWA sair de `alobuzinou-app.web.app` para
`app.alobuzinou.com.br`. **Hoje a base é zero**, então o custo também é — e é
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

# 4. Functions — o núcleo, 12 de 14. Ver a nota do Resend abaixo.
firebase deploy --only functions:lookupInvite,functions:redeemInvite,functions:joinDriverWaitlist,functions:getShowcase,functions:spinEntryBonus,functions:closeStaleRoutes,functions:sendPushOnNotification,functions:generateMonthlyPayments,functions:runBillingNow,functions:getInvitePreview,functions:flagDuplicateReceipts,functions:backfillTestimonialPrivacy

# 5. Por último os sites (os DOIS — ver a seção acima para subir um só)
firebase deploy --only hosting
```

No PowerShell **não use `&&`** — ele não é separador válido nesta versão. Rode
uma linha por vez, ou separe com `;`.

### Por que as functions estão listadas uma por uma

Duas das 14 (`sendPaymentReminders` e `runPaymentRemindersNow`, o lembrete por
e-mail) declaram o segredo `RESEND_API_KEY`. O CLI **exige o valor do segredo
antes de subir** — sem ele, o deploy para e fica esperando digitação. Como
e-mail não é o caminho principal (a cobrança real acontece no WhatsApp), o
comando acima sobe as 12 que não dependem de nada e deixa o app inteiro
funcionando.

Quando você tiver uma conta no [Resend](https://resend.com) e a chave:

```powershell
firebase functions:secrets:set RESEND_API_KEY
firebase deploy --only functions:sendPaymentReminders,functions:runPaymentRemindersNow
```

---

## Depois que subir: três verificações

1. **A home carrega e mostra o parceiro.** Se o nome do motorista aparecer, o
   `getShowcase` está no ar e o Firestore respondeu.

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

- **App Check** nas quatro callables públicas (`getShowcase`, `lookupInvite`,
  `getInvitePreview`, `joinDriverWaitlist`). Elas aceitam chamada sem login e
  têm freio de tentativa por hora, mas nada prova que quem chama é o app.
  Precisa de uma chave reCAPTCHA v3 criada por você.
- **Testes das rules.** Quatro casos valem: pai não lê filho de outro; anônimo
  não cria documento de usuário; depoimento público não carrega nome completo
  nem foto sem consentimento; anônimo não lê a posição ao vivo da perua.
  Exige acrescentar dependência de teste ao projeto.
- **Gate de admin em custom claim.** Hoje `superAdmin` é campo em documento, e
  está seguro por três regras que precisam continuar todas certas. Em claim,
  viraria uma garantia em vez de três.

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
recomeçou em `alobuzinou`. Havia zero usuário, então **não houve migração** —
não teve export de Firestore, de Auth nem de Storage. O trabalho foi
reapontar configuração e refazer console.

### Dois nomes são globais, e é o que trava

| O quê | Regra |
|---|---|
| **Project ID** | Permanente, e o Google **nunca reusa** ID de projeto excluído. `projeto-tio-nino-digital` está fora para sempre. |
| **Site ID do Hosting** | Global entre todos os projetos do Firebase. E o site padrão herda o ID do projeto — então um site preso bloqueia até a criação do projeto de mesmo nome. |

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
