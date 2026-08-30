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
│   ├── tio/           16 telas do motorista
│   ├── pai/           8 telas do responsável
│   ├── admin/         AdminPanel, TaxaTab — o dono tem UMA tela só, com
│   │                  cinco abas. `/admin/parceiros` era a segunda e virou
│   │                  redirecionamento; a fila mora na aba "Fila".
│   └── legal/         termos e privacidade
├── components/        por domínio: route, agenda, children, payments, map,
│                      call, notifications, landing, tutorial, festive…
├── services/          38 módulos — TODO acesso ao Firestore passa aqui
├── hooks/             23 hooks, quase todos onSnapshot de um service
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

**A associação, ponta a ponta** — escrito inteiro nas Fases 2 e 3 (24/08/2026)
e ligado à navegação em 29/08. Quatro paradas:
`leadsFunil` (prospecção, aba **Funil** do `/admin`) → orçamento
([OrcamentoSheet](src/components/admin/OrcamentoSheet.jsx), que grava a
negociação **e** emite o contrato na mesma folha) → `contratosAssociacao`
(o associado aceita em `/tio/contrato-plataforma`) → `faturasParceiro`
(fechada na aba **Taxa**, paga em `/tio/taxa`).

- **`leadsFunil` não é `waitlistDrivers`.** O funil é registro comercial; a
  fila (aba **Fila** do painel) é a porta do app. Mover cartão de
  vendas não dá acesso a sistema nenhum — ver o cabeçalho de
  [funilService.js](src/services/funilService.js).
- **Orçar exige conta aprovada.** O id do lead é o uid só quando a pessoa se
  inscreveu pelo app; pra quem chegou por fora, salvar produziria um contrato
  que ninguém consegue aceitar. Quem recusa é
  [FunilTab.jsx](src/components/admin/FunilTab.jsx) — as rules deixam passar,
  porque a escrita é do dono.
- **O vencimento é da CASA**, não de cada parceiro: `taxaConfig.diaVencimento`
  (1–28, padrão 10). `fecharFatura` congela a data pronta em `vencimento`, como
  o [billing.js](functions/lib/billing.js) faz com o `dueDay` da criança — e lá
  a data é por criança porque quem negocia é o motorista com cada família. Se
  alguém pedir dia diferente, o lugar é `diaVencimento` na negociação:
  `dataDeVencimento` já prefere ela sobre a régua.
- **O contrato diz o dia** desde a `VERSAO_CONTRATO = 2` — a 1 mandava
  suspender por atraso sem definir atraso. Subir a versão exige novo aceite.
- **Vaga de criança é contratada.** `users.limiteCriancas` (só o dono escreve,
  definido no orçamento) contra `users.criancasAtivas`, contador que sobe no
  MESMO batch do cadastro. Rules não sabem contar documentos: `allow create` em
  `children` valida o contador com `getAfter` — um `addDoc` solto é recusado.
  Limite ausente = sem limite. Conta só crianças ATIVAS, mesmo recorte de
  `resumirBase`, então desativar libera vaga.
  **Não é à prova de devtools** — nenhuma rule exige que o contador ande junto
  de uma criança de verdade; quem pega é a fatura, que conta as crianças reais.
  Vira Cloud Function quando o Blaze entrar.
- **Receita é fatura `quitada`**, e sai de `faturasParceiro` em
  [adminMetricsService.js](src/services/adminMetricsService.js) — mesmo
  critério do GMV, que só soma `payments` com `paid`. Fatura `aberta` viaja
  em `receitaEmAberto` e **nunca** é somada na receita.
- **`suspenso` bloqueia nas rules**; o cartão de
  [AvisoDaPlataforma](src/components/tio/AvisoDaPlataforma.jsx) só explica.
  Ele mora no `TioLayout` e é omitido em `/tio/taxa` de propósito: cobrança
  que cobre a própria tela de pagamento não deixa ninguém pagar.

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

**A marca do motorista** — `users.marcaNome` + `users.marcaLogoURL` (logo em
`marcaLogos/{uid}` no Storage). É o que aparece no cabeçalho do `/tio` **e** do
`/pai`, no lugar de "Início": ele escolhe como as famílias dele o chamam ("Tio
Nino"). Não é `name`, que é o nome civil do contrato. Resolve em
[useMarcaDoTio.js](src/hooks/useMarcaDoTio.js) — o pai vê a marca do motorista
DELE, pelo `adminUid` da criança ativa. Sem marca, volta o título.

**Avatar respeita gênero pelo CABELO**, em
[avatarUrl.js](src/utils/avatarUrl.js). O estilo é `avataaars` (era
`notionists`, que não expunha gênero nenhum — só barba, então menina saía com
cara de menino). Os nomes de cabelo vêm do schema da API, não da memória: na
v9 é `bob`, não `longHairBob`, e valor errado devolve **HTTP 400**, não um
avatar feio. Sem gênero informado, nenhum `top` é passado e o sorteio é o
padrão.

**Migrar quem já tinha contrato de papel** — o contrato do app **não é um
arquivo**: é gerado dos campos (mensalidade, `dueDay`, vigência) por
`buildContractData`. Então migrar = o motorista digitar os valores que já
combinou, e o pai aceitar o do app. O papel antigo vira ANEXO
(`children.contratoAnteriorURL`, Storage em `contratosAnteriores/{childId}`),
oferecido no fim do cadastro da criança — o único instante em que ele está com
aquela família na cabeça. **Anexo não é contrato**: não gera cobrança nem vale
como aceite, e as duas telas dizem isso, senão alguém opera sem contrato
válido achando que o papel bastou. Quem sobe é o MOTORISTA — documento que
define quanto o pai paga não entra pela mão de quem paga.

**Falta não gera desconto**, e a cláusula 7ª já dizia: o valor é pela VAGA,
inclusive nas férias, `independentemente da quantidade de dias letivos`. A tela
de faltas repete isso onde a dúvida nasce.

**Responsável avulso: guarda UM.** `children.altResponsibles` é um array de no
máximo 1 — o último. Era lista que só crescia; ninguém mantém lista, e são
nome e telefone de terceiro que não usa o app. Sobrescrever é o recurso: apaga
o histórico na mesma escrita, e mantém a permissão das rules intacta
(`hasOnly(['altResponsibles'])`).

**Falta tem teto de 14 dias** — o aviso do responsável não passa disso, e o
motivo está em [AbsenceSheet.jsx](src/components/absences/AbsenceSheet.jsx):
plano muda, ninguém desmarca, e no dia o motorista não passa na porta. O
HISTÓRICO anda meses pra trás (`/pai/faltas`); o aviso continua cabendo em
duas semanas. A conta é pura e testada em [utils/faltas.js](src/utils/faltas.js)
(`npm run testar:faltas`) — aviso marcado pra frente nunca é somado como falta.

**Chamar Cloud Function passa por `exigirCloud()`** —
[callableError.js](src/services/callableError.js). Sem Blaze, a API desativada
responde sem CORS e o erro que chega na tela é "falha de rede": quem usa troca
de rede, quem depura procura CORS, e o conserto é ligar o faturamento. Pior,
`functions/not-found` significava duas coisas — e o app acusava convite VÁLIDO
de não existir. O guarda vem antes do `try`, então esse código volta a ter um
significado só. `getShowcase` fica de fora de propósito: já degrada calado.

**PWA: instalar e atualizar** — as duas conversas com o aparelho.

- [InstallPrompt.jsx](src/components/common/InstallPrompt.jsx) convida a pôr na
  tela de início, montado nos layouts do tio **e** do pai. Android usa
  `beforeinstallprompt` (um toque); iOS não tem esse evento e recebe o passo a
  passo do Compartilhar. Quem decide é `isIOS()` em
  [browserEnv.js](src/utils/browserEnv.js). Não aparece na 1ª visita, nem já
  instalado, nem dentro da webview do WhatsApp.
- `registerType: 'prompt'` (não `autoUpdate`) em [vite.config.js](vite.config.js):
  versão nova AVISA em vez de assumir calada.
  [AtualizacaoDisponivel.jsx](src/components/common/AtualizacaoDisponivel.jsx)
  mostra o aviso, cobre a troca com uma tela cheia e recarrega na marra depois
  de 8s se o worker não assumir. Montado no `main.jsx`, fora do `AuthProvider`
  — atualizar não depende de quem está logado.

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

**Mobile-first, menos no `/admin`.** Motorista e responsável usam o app em pé,
na rua, com uma mão. O painel do dono é a exceção: é trabalho de mesa
(negociar, fechar mês, abrir número numa reunião), então lá o layout é pensado
pra largura — `max-w-6xl`, abas numa fileira em `sm`, kanban em cinco colunas
em `lg` — e o celular é o que precisa continuar funcionando, não o que manda.

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
