# Como colocar o Alô Buzinou no ar

Este arquivo existe porque o deploy tem **uma ordem que não é opcional** e
**dois pré-requisitos de console** que nenhum comando resolve. Seguindo daqui
de cima pra baixo, funciona.

Projeto: `projeto-tio-nino-digital` · Região das functions: `southamerica-east1`

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

### 3. O campo que te deixa entrar no /admin

O painel do dono é protegido por `superAdmin: true` no seu documento de
usuário, e **nada no app grava esse campo** — as rules até proíbem o usuário de
gravá-lo em si mesmo. É de propósito: é o gate da plataforma.

Depois de criar sua conta de motorista no app:

> Console → Firestore → coleção `users` → seu documento → Adicionar campo
> `superAdmin` (boolean) = `true`

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

# 5. Por último o site
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
