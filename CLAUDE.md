# Alô Buzinou — mapa do projeto

PWA mobile-first de transporte escolar. Liga o **motorista** ("Tio") às
**famílias**: convite por código, rota ao vivo no mapa, aviso de chegada,
mensalidade e agenda. Português do Brasil em todo lugar — código, comentário,
commit e interface.

> **Este arquivo é o índice que evita ler o projeto inteiro.** Ele é carregado
> sozinho em toda sessão. Comece por aqui, vá direto ao arquivo apontado, e
> **atualize-o quando mudar o que está descrito** — o protocolo está no fim.

---

## Como rodar

```bash
npm install --legacy-peer-deps   # vite-plugin-pwa ainda pede Vite <= 7
npm run dev                      # localhost:5173
npm run lint
npm run testar                   # = testar:horarios (node puro, sem runner)
npm run testar:regras            # precisa dos emuladores: npm run emu
npm run build
```

`--legacy-peer-deps` não é opcional: `vite-plugin-pwa@1.x` lista Vite ≤ 7 como
peer e o projeto usa Vite 8.

**Não existe runner de teste** (sem Jest/Vitest, de propósito). Os testes são
scripts Node em [scripts/](scripts/) rodados direto. Ao criar teste novo, siga
esse padrão em vez de introduzir um framework.

`.env` a partir de [.env.example](.env.example). `VITE_USE_EMULATORS=false`
por padrão — **rodar local sem isso grava no Firebase de produção**.

Deploy: [DEPLOY.md](DEPLOY.md) (a ordem importa e há dois pré-requisitos de
console). Acessos de teste por papel: [TESTES.md](TESTES.md).

## Stack

React 19 · Vite 8 · Tailwind 3 · Firebase 12 (Auth, Firestore, Storage,
Functions v2 em `southamerica-east1`, FCM) · react-router 7 · Leaflet 1.9 +
react-leaflet 5 (OSM, sem chave) · vite-plugin-pwa · lucide-react ·
react-hot-toast. JavaScript puro — **não há TypeScript**.

> O [README.md](README.md) está defasado (fala React 18, Firebase 10, router 6
> e "Tio Nino Digital"). Prefira este arquivo.

---

## Os quatro papéis — leia antes de mexer em permissão

Definidos e explicados em [src/utils/papeis.js](src/utils/papeis.js). A
armadilha central do projeto:

| `role` | Quem é | Painel |
|---|---|---|
| `owner` | **Dono da plataforma** — aprova motorista, vê os números | `/admin` |
| `admin` | **MOTORISTA**, não dono. Nome histórico. | `/tio` |
| `parent` | Responsável | `/pai` |
| `aguardando` | Motorista inscrito, ainda não aprovado | `/aguardando` |

**`role: 'admin'` significa motorista.** Ler isso como "administrador" é o erro
mais caro possível aqui. O dono aceita também o legado `superAdmin: true` — a
conta dele não tem outra prova até a migração manual pelo console.

`painelDe(profile)` é a única resposta para "pra onde mando essa pessoa"; ela
cai em `/login` quando não há papel (devolver `null` dava tela branca calada).

O cliente **não escreve `role`** — foi assim que a auto-promoção se fechou.
Conta de responsável só nasce pela function `redeemInvite`.

---

## Onde está cada coisa

```
src/
├── App.jsx            todas as rotas + PrivateRoute. Só o caminho de quem
│                      chega de fora é eager; o resto é lazy (ver o topo
│                      do arquivo — era 1,47 MB num bundle só)
├── pages/
│   ├── Home, Familia, Invite, Login, FirstAccess, Welcome, AuthAction (públicas)
│   ├── tio/           17 telas do motorista
│   ├── pai/           7 telas do responsável
│   ├── admin/         AdminPanel, TaxaTab (dono da plataforma)
│   └── legal/         termos e privacidade
├── components/        por domínio: route, agenda, children, payments, map,
│                      call, notifications, landing, tutorial, festive…
├── services/          38 módulos — TODO acesso ao Firestore passa aqui
├── hooks/             18 hooks, quase todos onSnapshot de um service
├── config/            capabilities, rodada, developer
├── context/           AuthContext (perfil + papel)
├── utils/             puros e testáveis, sem Firebase
└── firebase/config.js
functions/             Cloud Functions v2 (CommonJS, Node 22)
  └── lib/             billing, invites, push, routes, entryBonus, receiptGuard…
firestore.rules        71 KB — a segurança real do app mora aqui
scripts/               testes e utilitários de manutenção (Node puro)
```

**Regra de camada:** tela → hook → service → Firestore. Componente que importa
`firebase/firestore` direto está fora do padrão.

---

## Modelo de dados (Firestore)

Coleções de raiz, como aparecem em [firestore.rules](firestore.rules):

`users` · `children` (+ subcoleção `rides/{YYYY-MM-DD}`) · `payments`
(+ `events`) · `liveLocation` · `notifications` · `altPickups` · `schools` ·
`absenceDeclarations` · `agendaEntries` · `pendingCalls` · `schoolBroadcasts` ·
`feedbacks` · `supportTickets` · `expenses` · `waitlistDrivers` ·
`waitlistParents` · `entryBonuses` · `taxaConfig` · `taxaParceiros` ·
`faturasParceiro` · `leadsFunil` · `contratosAssociacao` · `platformConfig` ·
`appState`

### Conceitos que não dá pra adivinhar do nome

**Não existe mais "turno" nem "corrida".**
[horariosService.js](src/services/horariosService.js) — o dia do motorista é
uma **lista de paradas ordenada pela hora**, calculada de toda criança ativa
com horário. Os seis turnos fixos e a janela de tempo foram descartados (o
arquivo explica por quê). Não há array de membros salvo, então não há fila pra
envelhecer. **Esse arquivo não importa nada de propósito** — é o que o mantém
testável sem Firebase. Não adicione import ali.

**`rides` é a viagem do dia**, um doc por criança por data, id = a data (logo,
idempotente). Guarda os marcos com hora — `onboard`, `atSchool`, `delivered` —
e é gravado **no mesmo batch da mudança de status**, nunca depois.
[ridesService.js](src/services/ridesService.js)

**Status da criança:** `STATUS_CYCLE = ['home','onboard','atSchool','delivered']`
em [childrenService.js](src/services/childrenService.js). `home` é o que
`getEffectiveStatus` devolve quando o dia vira.

**Dois dinheiros diferentes, e misturá-los quebra os Termos de Uso:**
- `payments` — mensalidade do **pai → motorista**. A plataforma **não**
  intermedeia: PIX/dinheiro/maquininha direto. Fluxo `pending → claimed → paid`
  (o pai só consegue escrever `claimed`, garantido pelas rules).
  [paymentsService.js](src/services/paymentsService.js)
- `taxaParceiros` / `faturasParceiro` — taxa de associação do **motorista → a
  plataforma**. [taxaService.js](src/services/taxaService.js)

**A "buzina" é `pendingCalls`** — o motorista chega e o pai não desce; em vez de
buzinar na rua, dispara uma chamada que toca em tela cheia no celular do pai.
`ringing → acknowledged → resolved`.
[pendingCallService.js](src/services/pendingCallService.js)

**`liveLocation`** é sobrescrito com throttle (GPS suspende em aba oculta; a
function `closeStaleRoutes` fecha rota que ficou aberta).

---

## Cloud Functions (`functions/index.js`, região `southamerica-east1`)

Exigem plano **Blaze** — sem elas não há cadastro de responsável.

- **Convite:** `lookupInvite`, `redeemInvite`, `getInvitePreview` — único
  caminho para criar conta de pai
- **Cobrança:** `generateMonthlyPayments` (agendada), `runBillingNow`,
  `sendPaymentReminders`, `runPaymentRemindersNow`
- **Operação:** `closeStaleRoutes`, `confirmarAusencias`
- **Push:** `sendPushOnNotification` (dispara FCM a partir de `notifications`)
- **Outros:** `joinDriverWaitlist`, `getShowcase`, `spinEntryBonus`,
  `flagDuplicateReceipts`, `backfillTestimonialPrivacy`

Cobrança e limpeza **saíram do cliente** de propósito: no cliente, o mês em que
o motorista não abrisse o app ficava sem cobrança.

---

## Degradação por ambiente

[src/config/capabilities.js](src/config/capabilities.js) — `STORAGE_ENABLED`.
Sem Cloud Storage o app **esconde** os botões de anexo (comprovante, foto de
perfil, foto da criança) em vez de deixar o upload falhar como erro de rede.
Tudo o mais funciona. Push sem `VITE_FIREBASE_VAPID_KEY` vira no-op silencioso.

[src/config/rodada.js](src/config/rodada.js) — `VAGAS_NA_RODADA` é escassez
**real** e precisa ser baixada à mão quando um associado entra; contador falso
que reinicia sozinho é propaganda enganosa (CDC art. 37).

---

## Convenções que este projeto leva a sério

**Comentário explica *por quê*, não *o quê*.** Os cabeçalhos de service são
longos e contam a decisão, a alternativa descartada e o bug que motivou. Ao
mexer num arquivo desses, mantenha o cabeçalho verdadeiro — **comentário que
promete garantia sem prová-la já foi um problema recorrente aqui**.

**Mensagem de commit descreve o efeito para uma pessoa**, não o diff:
"O pai é avisado quando a criança chega", "Aviso antigo deixa de virar criança
na calçada". Prefixos `fix()/test()/chore()` aparecem, mas o corpo é sempre
humano.

**Segurança mora nas rules, não na interface.** Esconder botão é UX; o que
impede é [firestore.rules](firestore.rules). Toda mudança de permissão precisa
passar por lá — e `npm run testar:regras` cobre o payload real.

**Navegação: uma tela só.** Cada troca de tela cobra pedágio — resolva em folha
onde couber, e rotule o "voltar" onde não couber.

**Nada de `git add -A`** — o repositório recebe várias sessões ao mesmo tempo.

---

## Manutenção deste arquivo

Ele só serve enquanto for verdade. **Atualize-o na mesma alteração** que mudar
qualquer uma destas coisas:

1. **Papel, permissão ou rules** → a tabela de papéis e a seção de segurança
2. **Coleção nova, renomeada ou removida** → a lista de coleções
3. **Rota nova, tela nova ou pasta nova em `src/`** → o mapa "Onde está cada coisa"
4. **Cloud Function criada ou removida** → a lista de functions
5. **Script npm, dependência de peso ou passo de setup** → "Como rodar" / "Stack"
6. **Modelo de domínio** (horários, rides, pagamentos, taxa, buzina) → a seção
   "Conceitos que não dá pra adivinhar"

Regras de escrita: aponte para o arquivo em vez de repetir o conteúdo dele;
uma linha por fato; se um trecho ficou obsoleto, **corrija ou apague** — meia
verdade aqui custa mais que a ausência, porque o agente confia sem conferir.
