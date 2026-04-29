# 🚐 Tio Nino Digital

PWA mobile-first de gestão e rastreamento em tempo real para transporte escolar.
Conecta o motorista ("Tio") aos pais via convite por código, mapa ao vivo,
alertas de proximidade e cobrança mensal.

## Stack

- **Vite + React 18** (JavaScript)
- **Tailwind CSS 3** (design system custom)
- **Firebase v10+** (Auth + Firestore)
- **Leaflet 1.9 + react-leaflet 5** (mapa OSM, sem chave de API)
- **vite-plugin-pwa** (instalável, com cache de tiles)
- **react-router-dom 6**
- **react-hot-toast**, **lucide-react**

## Rodar localmente

```bash
npm install --legacy-peer-deps
npm run dev
```

Abra http://localhost:5173.

> **Por que `--legacy-peer-deps`?** O `vite-plugin-pwa@1.x` ainda lista
> Vite ≤ 7 como peer; com Vite 8 (do `create-vite@latest`) o resolve
> reclama mas o plugin funciona normalmente.

### Variáveis de ambiente

Copie `.env.example` para `.env` e preencha com sua config Firebase:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

## Configuração inicial do Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com)
2. **Authentication → Sign-in method**: habilite "Email/Password"
3. **Firestore Database**: crie em modo "Native"
4. Cole as credenciais no `.env`
5. Aplique as Security Rules:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init firestore   # aponte pra firestore.rules deste repo
   firebase deploy --only firestore:rules
   ```

## Criar o primeiro administrador

Existem **duas formas** — escolha uma:

### A. Pela interface (fluxo recomendado)

1. Abra o app pela primeira vez (com Firestore vazio)
2. Na tela de Login, no rodapé, aparece o link **"Configurar primeiro administrador"**
3. Preencha nome, telefone, email e senha
4. Pronto — o link some pra todas as visitas futuras (gated por `appState/init`)

### B. Manualmente no Firebase Console

Útil pra fluxos de produção mais controlados.

1. **Authentication → Users** → "Add user" com email/senha
2. **Firestore → Start collection** → `users`, doc id = `{uid do passo 1}`:
   ```
   role: "admin"
   name: "..."
   email: "..."
   phone: "..."
   createdAt: serverTimestamp
   ```
3. Crie também `appState/init`:
   ```
   hasAdmin: true
   adminUid: "{uid}"
   createdAt: serverTimestamp
   ```

## Cadastrar uma criança e vincular um responsável

1. Logado como admin → aba **Crianças** → toque em **+**
2. Preencha o formulário; toque em **"Buscar coordenadas"** (geocodifica via Nominatim/OSM)
3. Salve — anote o **invite code** mostrado (`TN` + 4 dígitos, ex: `TN4582`)
4. Entregue o código pro responsável (WhatsApp, presencial, etc.)
5. O responsável abre o app → **"Primeiro acesso"** → informa código + email + senha
6. Conta criada e vinculada automaticamente; nos próximos logins ele usa email + senha

## Iniciar uma rota (Tio)

1. Aba **Rota** → toque em **"Iniciar rota"**
2. Permita acesso ao GPS quando o navegador pedir
3. **Mantenha o app aberto durante a rota** — o navegador suspende GPS em segundo plano.
   Você pode trocar entre as abas do BottomNav, o tracking continua
4. O app salva no Firestore a cada 30 segundos (throttle pra economizar bateria/dados)
5. Toque em **"Encerrar rota"** ao fim (precisa confirmar — toque duas vezes)

## Visualização do Pai

- **Início**: status atual da criança (em casa / aguardando / embarcado / na escola
  / voltando / entregue), mapa em tempo real com posição da casa e da perua,
  e alertas de proximidade:
  - Distância > 2 km → "🚐 Tio Nino em rota"
  - Distância ≤ 2 km → "🚐 está a aproximadamente 5 minutos"
  - Distância ≤ 400 m → "📍 Tio Nino chegou!" (com vibração)
- **Pagamentos**: histórico mensal somente leitura

## Build & deploy (Firebase Hosting)

```bash
npm run build                  # gera dist/ com PWA
firebase init hosting          # aponte public dir = "dist", SPA = yes
firebase deploy --only hosting,firestore:rules
```

O app fica disponível em `https://{projectId}.web.app`. PWA instalável em
qualquer browser moderno (mobile e desktop).

## Estrutura

```
firestore.rules                Security rules de produção
public/icon.svg                Ícone PWA (vetor — escala pra qualquer tamanho)
src/
├── components/
│   ├── common/      Button, Card, Input, Skeleton, EmptyState, Spinner
│   ├── layout/      Header, BottomNav
│   ├── children/    ChildCard, ChildForm, StatusBadge
│   ├── map/         LiveMap, VanIcon
│   └── payments/    PaymentRow
├── pages/
│   ├── Login.jsx, FirstAccess.jsx, FirstAdmin.jsx
│   ├── tio/         TioLayout, TioDashboard, TioChildren, TioRoute, TioFinance
│   └── pai/         PaiLayout, PaiDashboard, PaiFinance
├── context/         AuthContext
├── services/        authService, childrenService, locationService,
│                    paymentsService, inviteCodeService
├── hooks/           useAuth, useChildren, useChild,
│                    useGeolocation, useLiveLocation, usePayments
├── utils/           haversine, formatters, generateInviteCode
└── firebase/        config (lê env vars)
```

## Modelo de dados (Firestore)

```
users/{uid}
  ├─ role: "admin" | "parent"
  ├─ name, email, phone
  └─ childId (só pais)

children/{childId}
  ├─ name, school, period
  ├─ parentName, parentEmail, parentPhone
  ├─ address, lat, lng
  ├─ monthlyFee, notes
  ├─ inviteCode, inviteStatus, parentUid
  ├─ status (em casa / aguardando / embarcado / ...)
  └─ active (soft delete)

liveLocation/current        // único doc, sobrescrito a cada 30s
  ├─ lat, lng, accuracy, speed, heading
  ├─ updatedAt, routeActive
  └─ driverUid

payments/{paymentId}
  ├─ childId, childName (denormalizado), parentUid
  ├─ month ("YYYY-MM"), amount, dueDate
  ├─ status: "paid" | "pending"  (overdue é derivado client-side)
  └─ paidAt, createdAt

appState/init               // bootstrap flag, leitura pública
  └─ hasAdmin: true
```

## Limitações conhecidas (MVP)

- **GPS pausa em background**: Web GPS é suspenso quando a aba não está
  visível. O Tio precisa manter o app aberto durante a rota
- **Encerramento abrupto**: se o Tio fechar a aba sem clicar "Encerrar",
  `routeActive` fica `true` no Firestore até a próxima rota sobrescrever.
  Aceitável, mas confunde o pai por alguns minutos
- **Sem push notifications**: alertas de proximidade só aparecem com o app
  aberto. FCM (Firebase Cloud Messaging) é trivial de adicionar
- **Vibração**: Android Chrome funciona; iOS Safari ignora silenciosamente
- **Reset de senha**: link enviado por email só funciona depois que você
  configurar o template no Authentication → Templates do Firebase Console

## Roadmap

- [ ] **Multi-tenant SaaS**: `companyId` em cada doc + rules baseadas em company
- [ ] **FCM push**: alertas mesmo com app fechado, lembretes de pagamento
- [ ] **App nativo** (React Native ou Capacitor): GPS em background no iOS, melhor UX
- [ ] **Integração Asaas / Mercado Pago**: cobrança automática via Pix/boleto
- [ ] **Histórico de rotas**: persistir cada rota completa (`routes/{routeId}`)
  pra auditoria e relatórios
- [ ] **N filhos por responsável**: 1 pai → vários filhos
- [ ] **N responsáveis por filho**: pai + mãe + avós no mesmo cadastro
- [ ] **Avaliação pós-rota** pelo pai

## Licença

Privado — projeto interno.
