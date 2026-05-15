# Cloud Functions — Lembretes de pagamento por email

Envia 3 emails automáticos pra cada mensalidade ativa:

| Quando             | Cor (badge) | Tom                |
| ------------------ | ----------- | ------------------ |
| 3 dias antes       | Azul        | Lembrete amigável  |
| No dia             | Âmbar       | Urgência leve      |
| 3 dias após        | Vermelho    | Cobrança firme     |

Cada email tem:

- Imagem da van escolar no topo (credibilidade visual)
- Faixa de marca verde (Alô Buzinou!)
- Box destacado com valor + mês + criança + vencimento
- **Botão "Pagar agora pelo app"** → leva pra `/pai/finance`
- Bloco PIX com chave do motorista (quando configurada)
- Footer discreto

## Pré-requisitos

1. **Plano Blaze** no Firebase (pago por uso — você já tem).
2. **Node 20** instalado localmente pra deploy.
3. **Conta no Resend** (https://resend.com — grátis até 3.000 emails/mês).

## Setup inicial (uma vez)

### 1. Criar conta no Resend

1. https://resend.com → criar conta com email + senha.
2. Em **API Keys**, clica "Create API Key" — escolhe permissão "Sending access".
3. Copia a chave que aparece (começa com `re_`).

### 2. Instalar dependências das functions

```bash
cd functions
npm install
cd ..
```

### 3. Salvar a API key como Secret do Firebase

```bash
firebase functions:secrets:set RESEND_API_KEY
```

Cola a chave que você copiou do Resend e dá Enter.

### 4. Conferir as constantes em `functions/index.js`

- `FROM_EMAIL`: enquanto não tem domínio próprio, deixa
  `'Alô Buzinou! <onboarding@resend.dev>'`. Depois troca pra
  `'cobranca@seudominio.com.br'` (e configura DNS no Resend).
- `APP_URL`: URL do app em produção (Firebase Hosting). Default:
  `'https://tio-nino-digital.web.app'`. Trocar se mudar de domínio.

### 5. Deploy

```bash
firebase deploy --only functions
```

Vai criar:

- `sendPaymentReminders` — agendada (todo dia às 9h, horário BR).
- `runPaymentRemindersNow` — callable manual (só admin) pra forçar envio.

## Como testar agora (sem esperar 24h)

### Opção A: forçar via callable (recomendado)

Adicione um botão temporário no app que chama:

```js
import { getFunctions, httpsCallable } from 'firebase/functions';
const fns = getFunctions(undefined, 'southamerica-east1');
await httpsCallable(fns, 'runPaymentRemindersNow')();
```

Só funciona pra usuários admin.

### Opção B: via console

1. Cria um pagamento com `dueDate` setada pra HOJE.
2. Vai pro Firebase Console → Cloud Functions → `sendPaymentReminders` →
   menu kebab → "Force run" (ou aguarda 9h do dia seguinte).

## Idempotência

Cada email envia uma flag no doc do pagamento:

```js
{
  emailSentMilestones: {
    reminder_3d: <timestamp>,
    due_today:   <timestamp>,
    overdue_3d:  <timestamp>,
  }
}
```

Antes de enviar, a função checa se o milestone já foi enviado. Roda 2x no
mesmo dia → não duplica.

## Trocar pra domínio próprio (futuro)

1. No Resend → **Domains** → "Add Domain" → digita `alobuzinou.com.br`.
2. Configura os 3 DNS records que o Resend mostra (MX, SPF/TXT, DKIM).
3. Aguarda verificação (~1h).
4. Atualiza `FROM_EMAIL` em `functions/index.js` pra
   `'Alô Buzinou! <cobranca@alobuzinou.com.br>'`.
5. Redeploy: `firebase deploy --only functions`.

## Custo estimado

- **Resend**: 3.000 emails/mês grátis. Acima: ~$0,40/1.000.
- **Cloud Functions**: 1 execução por dia + ~3 leituras/escritas por
  pagamento. Pra 50 alunos ativos = ~150 ops/dia = praticamente
  insignificante no Blaze (custa centavos por ano).
