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
npm run testar                   # horarios + faltas + aviso + contraste + travessia
npm run testar:regras            # rules do Firestore — precisa do emulador
npm run testar:storage           # rules do Storage — idem, com --only storage
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
├── config/            capabilities, rodada, developer, vitrine,
│                      paletaCategorica (o único lugar com cor crua)
├── context/           AuthContext (perfil + papel)
├── utils/             puros e testáveis, sem Firebase
└── firebase/config.js
functions/             Cloud Functions v2 (CommonJS, Node 22)
  └── lib/             billing, invites, push, routes, entryBonus, receiptGuard…
firestore.rules        71 KB — a segurança real do app mora aqui
storage.rules          foto, comprovante, logo e contrato de papel. Caminho
                       DETERMINÍSTICO (`childPhotos/{childId}`): `isAdmin()`
                       sozinho ali libera a plataforma inteira
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
[avatarUrl.js](src/utils/avatarUrl.js). O estilo é `adventurer` — 26 cortes
`long*` e 19 `short*`, nenhum ambíguo. Já foi `notionists`, que não expunha
gênero nenhum (64 cortes chamados `variant01`…`variant64`, e menina saía com
cara de menino), e depois `avataaars`, que resolvia o gênero mas repetia rosto:
fixado o cabelo, sobravam poucas combinações, e numa perua de 25 duas crianças
recebiam o rosto idêntico. `adventurer` dá 68 milhões. **Ele não tem barba** —
o motorista passou a ter um sinal de gênero em vez de dois.

Os nomes de cabelo vêm do schema da API, **não da memória**: valor fora do
catálogo devolve **HTTP 400** e a imagem some — não vira avatar feio, vira
buraco, e só pra quem tem aquele gênero. `npm run testar:avatar` bate as URLs
reais contra a API (precisa de rede, fica fora da bateria padrão). Sem gênero
informado, nenhum `hair` é passado e o sorteio é o padrão.

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

**O Início do responsável é UM cartão**, não uma pilha.
[PaiDashboard](src/pages/pai/PaiDashboard.jsx) — rosto, hora e a perua na
mesma superfície, com a tarja do momento (`HOJE` / `AO VIVO` / `DIA
ENCERRADO`) dizendo qual dos três estados é. Sem ela, a tela troca de cara
três vezes por dia e nada anuncia. O "falar com o motorista" mora no
CABEÇALHO ([Header](src/components/layout/Header.jsx)) e nunca desabilita:
emergência não pode rolar nem virar botão apagado.

**A tarja de aviso só aparece quando o app MENTE** —
[avisoDoMomento.js](src/utils/avisoDoMomento.js), testado com hora injetada
(`npm run testar:aviso`). Dois casos, não cinco: rota não iniciada depois da
hora de pegar, e criança "na perua" muito depois da hora de chegar. Atraso
comum NÃO gera tarja — ali o app está calado, não mentindo, e tarja semanal
ensina a pular tarja. Quando o grave dispara, o anel pulsante e o "AO VIVO"
PARAM: animação viva sobre dado morto é a pior parte.

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

**A marca do app é a PORTA, não a casa** — e é isso que decide onde ela pode
se mexer. O `<Logo />` aparece em 8 telas e TODAS são públicas ou de exceção;
dentro de `/tio` e `/pai` ele não aparece nenhuma vez, porque ali o
[Header](src/components/layout/Header.jsx) põe a marca do MOTORISTA. Sobrou a
travessia, que não é de ninguém: [Travessia.jsx](src/components/common/Travessia.jsx)
cobre a tela ao entrar e ao sair. **A cena NÃO viaja pelo `state` da
navegação** — tentou, e a saída nunca aparecia: ao zerar a sessão o
`PrivateRoute` devolve `<Navigate to="/login">`, que navega dentro de um
efeito e podia chegar depois, levando o `state` junto. A cortina sobe ANTES
(`travessar()`), fica montada no topo das rotas e não desmonta na troca de
tela; logout e navegação acontecem por baixo dela. Três cenas:
`abertura` só no primeiro acesso (o balão de fala cresce e vira a tela),
`entrada` no login e `saida` no logout. **A fala não tem nome, hora nem
contagem** — isso a pessoa vê lá dentro dois segundos depois, e citar aqui
criaria dependência de dado que pode não ter chegado. As frases e as quatro
regras que as filtraram estão em [utils/travessia.js](src/utils/travessia.js),
testadas com `npm run testar:travessia`. Um toque na cortina pula o teatro:
prender o motorista no portão da escola seria pior que não ter teatro.

**A espera mostra a marca, não um spinner** —
[Respiro.jsx](src/components/common/Respiro.jsx), nos dois lugares onde a
espera é real (tela de atualização e rota preguiçosa). **O atraso de 300 ms é o
ponto inteiro**: se o chunk chegar antes, ninguém vê nada. Animação que aparece
em toda navegação não é lembrada como capricho, é lembrada como lentidão.

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

**As duas portas públicas: decidir mora em `/`, entrar mora em `/familia`.**
Nada mora nas duas. A home do motorista tem 6 blocos, e a ordem segue a
decisão: o que faz → **por que confiar** → como começa → a vaga. A prova
social é UM bloco (parceiro e avaliações eram dois respondendo a mesma
pergunta, e prova pouca dividida em dois parece menos ainda). A porta da
família tem rodapé legal próprio — é onde está a pessoa cujos dados e os do
filho vivem no sistema — e **nenhuma** palavra de aquisição: sem vaga, sem
taxa, sem escassez.

**A porta dele é ESCURA, a dela é CLARA** — e o motivo não é coerência de
sistema, é o caminho de cada um. Ela nunca vê a home do motorista: o que ela
vê é o link no WhatsApp, a porta e o app. Então a única coerência que a
alcança é entre a porta e o APP dela, que é claro — porta escura prometia um
produto que não é o que abre em seguida. E link pelado de terceiro numa
página escura pedindo login tem a forma exata de um golpe, risco que o
[index.html](index.html) já reconhece pro preview do link. Ele está
comprando (escuro, negócio); ela está entrando em casa.

**Preço não aparece na vitrine.** O que aparece é a FORMA do dinheiro: "a
mensalidade das suas famílias é sua, a plataforma não entra no caminho dela".
É verdade verificável (`payments` é PIX direto pai→motorista; a taxa vive em
`faturasParceiro` e noutra tela) e sustenta o item 7 dos Termos. Quanto custa
é conversa com o consultor — número solto vira âncora antes de existir
proposta.

[src/config/rodada.js](src/config/rodada.js) — `VAGAS_NA_RODADA` é escassez
**real** e precisa ser baixada à mão quando um associado entra; contador falso
que reinicia sozinho é propaganda enganosa (CDC art. 37).

[src/config/vitrine.js](src/config/vitrine.js) — **a exceção à regra de cima, e
não é bug.** `PISO_DA_VITRINE` (27) é um piso sobre os dois contadores de
vitrine: abaixo dele a tela mostra o piso, não o real. Decisão de produto,
tomada com o ponto do CDC na mesa. Quem for "consertar" isso leia o arquivo
primeiro — baixar para 0 desliga o piso inteiro.

Os dois contadores medem coisas **diferentes**, e trocá-los faz as duas portas
se contradizerem: a home do motorista mostra `families` (crianças ativas, o
tamanho da operação); a porta da família mostra `responsaveis` (contas com
login). O segundo é sempre menor — a mãe de dois irmãos é um responsável com
duas crianças (`childIds`), e criança cadastrada existe antes do pai resgatar o
convite. Ambos vêm da callable pública `getShowcase`. **Nenhum piso encosta em
`rating`**: média de avaliação é opinião de terceiro, e piso ali seria
falsificar depoimento.

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

**Cor tem nome, e o nome é o papel.** Todos os tokens estão em
[tailwind.config.js](tailwind.config.js), com o porquê de cada um no próprio
arquivo, e `npm run testar:contraste` mede 43 pares contra os fundos reais.
Cinco regras, e todas nasceram de um bug:

1. **Âmbar é aviso e nada mais** — algo que a pessoa precisa atender. Havia um
   `secondary` com o mesmo hex do `warning`, e "a segunda cor" serve pra
   qualquer coisa: foi assim que o sinal virou enfeite. Nome vago não é
   economia, é permissão. As duas exceções têm nome próprio: `perua` (a
   legenda casa/perua/escola) e `ouro` (estrela, moeda, enfeite).
2. **Verde e âmbar não são texto** — `accent` como palavra dá 2,3:1 e
   `warning` dá 2,0:1. Quando precisam ser lidos, existem `accentText` e
   `warningText`.
3. **Meça contra o fundo REAL, não contra um representante** — o `textMuted`
   passava sobre o branco do cartão (4,8:1) e reprovava sobre o cinza da
   página (4,3:1), que é onde ele mais aparece. Foi medir num lugar só.
4. **Sombra colorida é uma por tela** — `shadow-focus` chama; cinco coisas
   chamando é nenhuma chamando. `rest` no resto, `float` no que flutua.
5. **Cor crua do Tailwind só em três endereços:**
   [components/festive/](src/components/festive/),
   [utils/festivities.js](src/utils/festivities.js) e
   [config/paletaCategorica.js](src/config/paletaCategorica.js) — as paletas
   em que a cor não significa nada e só precisa diferir da vizinha (dez tipos
   de recado, quatro estados da criança, cinco fatias de gráfico). Um lugar
   com licença é o que evita que o resto peça licença.

**O painel do dono tem piso de 12px.** O resto do app é de bolso, lido a 30cm;
[/admin](src/pages/admin/AdminPanel.jsx) é de mesa, e a 60cm o mesmo 11px tem
metade do tamanho aparente. A largura já tinha sido corrigida lá, a escala
não. Não há sistema tipográfico próprio — é só um piso, e o
[ContratoDoc](src/components/admin/ContratoDoc.jsx) é a exceção porque é
impresso.

**Segurança mora nas rules, não na interface.** Esconder botão é UX; o que
impede é [firestore.rules](firestore.rules). Toda mudança de permissão precisa
passar por lá — e `npm run testar:regras` cobre o payload real (101 casos, com
atores **anônimo** e **`aguardando`**; ele roda fora do CI porque precisa do
emulador, então rode à mão antes de publicar rule).

**`isAdmin()` nas rules significa QUALQUER MOTORISTA** — nunca é escopo
sozinho. Quem escopa é `ehDoMotorista()`/`doDono()`, que comparam `adminUid`.
Regra nova que pare em `isAdmin()` está entregando o dado de um parceiro aos
outros; foi assim que a chave PIX, a trilha de pagamento, a roleta e os leads
de família ficaram legíveis por quem não devia.

**O responsável alcança o doc do motorista por `users.adminUids`** — a LISTA,
mantida por `arrayUnion` no `redeemInvite`. O campo singular `adminUid` guarda
só o PRIMEIRO motorista, e a interface resolve pelo `adminUid` da criança
ATIVA: escopar só pelo singular faz a mãe com filhos em peruas diferentes
perder a chave PIX do segundo filho, em silêncio.

**As functions têm o próprio guarda de papel** —
[functions/lib/papeis.js](functions/lib/papeis.js), com `exigirMotorista` e
`exigirDono`. Callable manual recebe o escopo do **uid autenticado**, nunca de
`request.data`. As agendadas continuam globais de propósito.

**Há CI** — [.github/workflows/ci.yml](.github/workflows/ci.yml) roda lint,
`npm run testar` e build. Rules e Storage ficam fora até o emulador entrar lá.

**O Início do motorista tem um ÍNDICE, não um bloco de cadastro.**
[MeuTransporteSheet](src/components/tio/MeuTransporteSheet.jsx) — turma,
escolas, rota padrão, semana, avisos e contrato, atrás de uma linha no fim da
rolagem. O motivo não é limpeza: o bloco antigo **sumia no estado
`dirigindo`**, e pra avisar uma escola no portão o motorista precisava
ENCERRAR a rota (o que apaga a perua do mapa de todas as famílias) e ligar de
novo. A folha existe em todos os estados, inclusive dirigindo. Contagens vão
por **prop** — o `TioDashboard` já assina `children` e `escolas`, e reassinar
dentro dela abriria leitura permanente duplicada do mesmo dado.

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
