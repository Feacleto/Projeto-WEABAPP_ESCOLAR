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
npm run testar                   # 538 casos: horarios, faltas, aviso, contraste,
                                 # travessia, contrato, pix, status, auth,
                                 # trial, planos, conta, cobranca, gateway
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

Deploy: [docs/deploy.md](docs/deploy.md) (a ordem importa, há dois pré-requisitos de
console, e desde 05/09/2026 são **dois sites** — `hosting:app` e `hosting:landing`). Acessos de teste por papel: [docs/testes.md](docs/testes.md).

**O projeto Firebase é `alobuzinou-be81f`**, e o sufixo não é engano: o nome
`alobuzinou` ficou preso pelo projeto anterior, excluído em 05/09/2026. O
console mostra o NOME de exibição, não o ID — quem confia no cabeçalho aponta
o repositório inteiro para um projeto que não existe. O ID real sai de
`firebase projects:list`, e o anexo do [deploy.md](docs/deploy.md) conta o resto.

**Os dois domínios servem peças diferentes:** `alobuzinou.com` é o APP e
`alobuzinou.com.br` é a landing. Não há subdomínio — e o `.com` deixou de ser
defesa de marca: se ele expirar, o app cai junto.

## Stack

React 19 · Vite 8 · Tailwind 3 · Firebase 12 (Auth, Firestore, Storage,
Functions v2 em `southamerica-east1`, FCM) · react-router 7 · Leaflet 1.9 +
react-leaflet 5 (OSM, sem chave) · vite-plugin-pwa · lucide-react ·
react-hot-toast. JavaScript puro — **não há TypeScript**.

> O [README.md](README.md) é a porta de entrada e ROTEIA — ele não repete o que
> está aqui. Foi reescrito em 30/08/2026; a versão antiga falava de React 18,
> Firebase 10, router 6 e "Tio Nino Digital", e estava três versões atrás.

---

## Os quatro papéis — leia antes de mexer em permissão

Definidos e explicados em [src/dominio/identidade/papeis.js](src/dominio/identidade/papeis.js). A
armadilha central do projeto:

| `role` | Quem é | Painel |
|---|---|---|
| `owner` | **Dono da plataforma** — acompanha a base, vê os números | `/admin` |
| `admin` | **MOTORISTA**, não dono. Nome histórico. | `/tio` |
| `parent` | Responsável | `/pai` |
| *(sem papel)* | Sessão criada, escolha ainda não feita | `/comecar` |

**`role: 'admin'` significa motorista.** Ler isso como "administrador" é o erro
mais caro possível aqui. O dono aceita também o legado `superAdmin: true` — a
conta dele não tem outra prova até a migração manual pelo console.

**A ENTRADA VIROU AUTOATENDIMENTO EM 06/09/2026, e isso muda como se escreve
regra.** O motorista se cadastra em `/quero-fazer-parte` e a conta JÁ NASCE
`role: 'admin'`: não há mais fila, aprovação, nem o papel `aguardando`. Quem
controla o acesso agora é o teste de três meses, que começa na primeira rota.

A consequência é a linha mais importante desta seção: **`isAdmin()` deixou de
ser um conjunto escolhido a dedo e virou "tem uma conta"** — qualquer pessoa
com um e-mail chega lá em trinta segundos. Regra que para num `isAdmin()` solto
é porta pública. Foi por isso que o `allow get` de `users` e a leitura de
`taxaConfig` foram escopados ANTES de a porta abrir. O teste de rules tem um
ator só pra isso: `novato`, motorista legítimo com zero vínculo, que precisa
não alcançar nada.

`painelDe(profile)` é a única resposta para "pra onde mando essa pessoa", e
quando não há papel ela responde `/comecar` — a bifurcação de quem acabou de
criar sessão. **Sessão sem documento em `users` deixou de ser lixo e virou estado do
produto:** o login com Google parou de apagar a conta órfã, porque apagar era
desfazer o que a pessoa acabou de fazer e devolver erro no lugar de caminho.

A conta do GOOGLE **não nasce como motorista** (só o formulário de cadastro
cria motorista), e é isso que evita o pior caso: a mãe que
ignora o link do convite e toca em "Entrar com Google" viraria motorista, e o
`redeemInvite` recusaria o convite dela depois (ele já barra motorista virando
responsável) — ela ficaria presa, sem saída no app. A sala de espera pergunta
o que ela FEZ (recebi convite / tenho uma van), não o que ela É: papel é uma
classificação que ela nunca viu, e obriga a mentir quem é as duas coisas.

**Quem chega pelo link nunca vê essa tela** — o código está na URL e a frente
já é conhecida. E a conta pendurada é INERTE: toda leitura passa por
`isAppUser()` nas rules, que exige o documento.

O cliente **não escreve `role`** — foi assim que a auto-promoção se fechou.

**Quem cria o quê no cadastro do responsável** (esta linha já esteve errada
aqui): a SESSÃO nasce no cliente, em `authenticateAndRedeem`
([authService.js](src/services/authService.js)) — é ele que chama
`createUserWithEmailAndPassword`. O que a function `redeemInvite` faz com
Admin SDK é o que o cliente não pode: escrever o DOCUMENTO `users/{uid}` com
`role: 'parent'` e vincular a criança. Dizer que "a conta só nasce pela
function" confunde as duas coisas e manda o próximo a procurar criação de
conta onde só há vínculo.

---

## Decisões de arquitetura

[docs/decisoes.md](docs/decisoes.md) — regras que NÃO podem ser quebradas por
conveniência, cada uma com o teste que a prova. **Leia antes de mexer em
permissão, dinheiro, vínculo de família ou dado sensível.** Se uma mudança
parece uma melhoria óbvia e contraria uma decisão de lá, a decisão vence até
alguém mudá-la explicitamente naquele arquivo.

Referência longa: [docs/arquitetura.md](docs/arquitetura.md) (alicerce técnico)
e [docs/evolucao.md](docs/evolucao.md) (para onde o produto anda). O índice de
tudo isso é [docs/README.md](docs/README.md).

**O modelo de negócio mora em [docs/negocio.md](docs/negocio.md)** — preço,
trial, indicação, funil e meio de pagamento. Ele foi escrito DEPOIS do produto
(04/09/2026): o app existia e o modelo estava implícito no código, espalhado
entre `taxaConfig`, `limiteCriancas` e uma conversa de consultor que não estava
escrita em lugar nenhum. Leia antes de mexer em cobrança da plataforma ou em
qualquer peça de marketing. **A unidade de cobrança é a CRIANÇA ATIVA** e o app
é completo em qualquer tamanho — não existe plano capado.

**Com quem o produto fala está em [docs/personas.md](docs/personas.md)** — três
personas e os dois canvas de valor. A regra que ele estabelece: **quem paga (o
motorista) não é quem usa (a responsável)**, e por isso são dois canvas
separados. A coluna de encaixe registra o que o produto **não** resolve, que é
o que nenhuma peça de marketing pode prometer. Leia antes de escrever pitch,
landing ou texto de aquisição.

**O negócio como um todo está em [docs/canvas-negocio.md](docs/canvas-negocio.md)**
— os nove blocos, e o que cada um ainda não tem. A tensão que o quadro
revelou: **o canal é escalável e a conversão não é** (a indicação entrega o
lead, o consultor fecha um por vez), então o número que governa o negócio não é
o preço, é hora de consultor por associado fechado — e ele não é medido.

**A voz da marca e o manifesto estão em [docs/marca.md](docs/marca.md)** — oito
declarações, cada uma com o jeito de pegar a marca mentindo. É teste, não
cartaz: se o código passar a fazer o que uma delas proíbe, ou a declaração sai
ou o código volta atrás. Registra também **por que não existe valor de
segurança** — a plataforma não inspeciona van nem confere CNH, e prometer isso
seria a única mentira grande do conjunto.

**O roteiro de venda está em [docs/pitch-comercial.md](docs/pitch-comercial.md)**
— e a seção 5 dele é a que interessa a quem mexe no produto: a lista das frases
que soam ótimas e são **falsas hoje**. Fechou um "pela metade" ou um "não
resolve" de [docs/personas.md](docs/personas.md)? A linha correspondente sai de
lá na mesma alteração.

**O caminho em construção está em [docs/plano-fases.md](docs/plano-fases.md)**
— nove fases, o que trava cada uma, e por que cada escolha foi feita assim.
Não é normativo (o que virou lei está em decisoes.md 20, 21 e 22) e tem prazo
de validade: some quando a última fase fechar.

**O que ainda não foi decidido está em [docs/pendencias.md](docs/pendencias.md)**
— pauta com recomendação, em cinco blocos, e com prazo de validade: a decisão é
registrada no documento DONO e a linha é riscada de lá. Não confundir com
[docs/decisoes.md](docs/decisoes.md), que é normativo. Captação foi decidida
como **não** ([docs/pitch-investidor.md](docs/pitch-investidor.md)): o plano é
crescer com receita.

---

## Onde está cada coisa

```
src/
├── App.jsx            todas as rotas + PrivateRoute. Só o caminho de quem
│                      chega de fora é eager; o resto é lazy (ver o topo
│                      do arquivo — era 1,47 MB num bundle só)
├── pages/
│   ├── Familia, Invite, Login, FirstAccess, Welcome, AuthAction (públicas)
│   ├── tio/           16 telas do motorista
│   ├── pai/           8 telas do responsável
│   ├── admin/         AdminPanel, TaxaTab — o dono tem UMA tela só, com
│   │                  quatro abas. A aba "Fila" morreu com a aprovação:
│   │                  ninguém pede acesso, o motorista entra sozinho.
│   └── legal/         termos e privacidade
├── components/        por domínio: route, agenda, children, payments, map,
│                      call, notifications, landing, tutorial, festive…
├── services/          37 módulos — TODO acesso ao Firestore passa aqui
├── hooks/             23 hooks, quase todos onSnapshot de um service
├── config/            capabilities, developer, vitrine,
│                      paletaCategorica (o único lugar com cor crua)
├── context/           AuthContext (perfil + papel)
├── dominio/           AS REGRAS. Puro, sem Firebase, sem React — um contexto
│                      por pasta (ver "Os seis contextos" abaixo)
│   ├── rota/          horarios, avisoDoMomento, routePresence, faltas,
│   │                  intervaloDeDias
│   ├── cobranca/      statusPagamento, pix, pixPayload, chargeMessage,
│   │                  paymentVocabulary
│   ├── associacao/    planos, contratoAssociacao, trial, contaAtiva
│   ├── identidade/    papeis, childIds, generateInviteCode, inviteUrl,
│   │                  authErrors
│   ├── escola/        nomeEscola
│   └── vitrine/       frentes
├── marca/             a personalidade: avatarUrl, greeting, festivities,
│                      travessia. Tem regra, mas de apresentação
├── compartilhado/     SEM regra nenhuma: formatters, masks, haversine,
│                      browserEnv. Não conhece o domínio (o lint recusa)
└── firebase/config.js
landing/               O SITE INSTITUCIONAL — HTML estático, sem build.
                       `alobuzinou.com.br` (o app é o `.com`, não um
                       subdomínio). Não é o app: um index.html com CSS
                       e JS inline, deploy por `--only hosting:landing`. As
                       duas home públicas antigas (`/` do motorista) morreram
                       aqui dentro; a `/familia` continua no app.
functions/             Cloud Functions v2 (CommonJS, Node 22)
  └── lib/             billing, invites, push, routes, entryBonus, receiptGuard…
firestore.rules        71 KB — a segurança real do app mora aqui
storage.rules          foto, comprovante, logo e contrato de papel. Caminho
                       DETERMINÍSTICO (`childPhotos/{childId}`): `isAdmin()`
                       sozinho ali libera a plataforma inteira
scripts/               testes e utilitários de manutenção (Node puro)
```

**Regra de camada:** tela → hook → service → Firestore. Componente que importa
`firebase/firestore` direto está fora do padrão. **O lint recusa** — não é
convenção, é erro de CI ([eslint.config.js](eslint.config.js)).

**A outra direção também:** `dominio/`, `marca/` e `compartilhado/` não
importam service, hook, componente, tela, Firebase **nem React**, e
`compartilhado/` não importa nem o domínio. Se uma regra precisa de dado do
banco, quem busca é o service e passa **por parâmetro**.

Isso não é zelo: a máquina de estado da criança e o teto de vagas ficaram sem
teste por anos porque moravam atrás de um `import { db }` — não por descuido,
mas porque o Node não conseguia carregar o arquivo. Regra pura é regra
testável, e é essa a troca.

Import interno do núcleo leva extensão `.js` EXPLÍCITA — o Vite resolve sem, o
Node não, e é o Node que roda os testes.

### Os seis contextos

Não são pastas por tipo de arquivo, são as seis conversas diferentes que o
sistema tem. Regra nova mora no contexto de quem decide sobre ela:

| Contexto | A pergunta que ele responde | Quem manda |
|---|---|---|
| `rota` | onde a criança está e o que o app sabe da perua | motorista |
| `cobranca` | quanto a família deve e como ela paga | motorista ↔ família |
| `associacao` | quanto o motorista paga à plataforma | dono |
| `identidade` | quem é essa pessoa e a que ela está ligada | plataforma |
| `escola` | que escola é essa e quem avisar | motorista |
| `vitrine` | o que cada porta pública promete | dono |

Os dois dinheiros são contextos SEPARADOS de propósito — misturá-los quebra o
item 7 dos Termos, e a separação em pastas é o que torna a mistura visível
antes de ela virar código.

---

## Modelo de dados (Firestore)

Coleções de raiz, como aparecem em [firestore.rules](firestore.rules):

`users` · `children` (+ subcoleção `rides/{YYYY-MM-DD}`) · `payments`
(+ `events`) · `liveLocation` · `notifications` · `altPickups` · `schools` ·
`absenceDeclarations` · `agendaEntries` · `pendingCalls` · `schoolBroadcasts` ·
`feedbacks` · `supportTickets` · `expenses` · `entryBonuses` · `taxaConfig` · `taxaParceiros` ·
`faturasParceiro` · `contratosAssociacao` · `platformConfig` ·
`appState`

### Conceitos que não dá pra adivinhar do nome

**Não existe mais "turno" nem "corrida".**
[dominio/rota/horarios.js](src/dominio/rota/horarios.js) — o dia do motorista é
uma **lista de paradas ordenada pela hora**, calculada de toda criança ativa
com horário. Os seis turnos fixos e a janela de tempo foram descartados (o
arquivo explica por quê). Não há array de membros salvo, então não há fila pra
envelhecer. **Esse arquivo não importa nada de propósito** — é o que o mantém
testável sem Firebase. Não adicione import ali.

Ele mudou de casa DUAS vezes, e a segunda é o ponto. Era
`services/horariosService.js`, e `avisoDoMomento` e `intervaloDeDias`
importavam dele — a seta da camada ao contrário, funcionando só porque ele não
tinha imports. Virou `utils/horarios.js`, e a garantia passou a ser do
diretório. Hoje é `dominio/rota/horarios.js`, junto dos dois que dependem
dele: o contexto que os três descrevem é o mesmo, e agora o diretório diz
qual é.

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

**A associação, ponta a ponta** — reescrita em 06/09/2026, quando o preço
virou de TABELA. Três paradas, e a primeira é o próprio motorista:
faixa escolhida (`users.planoId`, escrita pelo dono na aba **Taxa**) →
`contratosAssociacao` (aceito em `/tio/contrato-plataforma`) →
`faturasParceiro` (fechada na aba **Taxa**, paga em `/tio/taxa`).

O que sumiu junto foi a **negociação**: `leadsFunil`, o orçamento, a aba
**Funil**, `taxa.js` e os seis eixos que ela cruzava (percentual, piso, modo,
periodicidade, carência, desconto de antecipação). Nenhuma migração — não
havia base real.

- **A varredura de `children` morreu com o percentual.** O modelo antigo
  cobrava sobre a soma das mensalidades, então a aba Taxa baixava TODA criança
  ativa da plataforma — com endereço, escola e telefone de família — só para
  somar; e não podia limitar a consulta, porque teto ali fazia a cobrança sair
  menor que a devida. A faixa depende só do NÚMERO, que já está em
  `users.criancasAtivas`. Um documento por parceiro em vez de mil por
  plataforma.
- **`planoId` e `limiteCriancas` vão no MESMO batch**
  ([setPlanoDoParceiro](src/services/taxaService.js)). Um é o que a fatura
  cobra, o outro é o que as rules cobram no cadastro de criança: separados,
  existiria a janela em que ele paga R$ 69 com teto de 40, e cada campo estaria
  certo do ponto de vista de quem o lê.
- **Contratar é do MOTORISTA; a cláusula é do SERVIDOR.** `/tio/planos` tem o
  botão desde 06/09/2026 — ele abria o WhatsApp do consultor. A saída não foi
  abrir as rules de dinheiro: a callable `contratarPlano` grava `planoId` e
  `limiteCriancas`, e a rule de `contratosAssociacao` exige que a faixa DENTRO
  do contrato bata com a que o servidor gravou. **O cliente ganhou o botão sem
  ganhar a caneta** — sem essa amarra, a fatura continuaria certa (ela lê
  `users.planoId`) e existiria um documento assinado dizendo outra coisa.
- **A antecipação é decidida pelo relógio do SERVIDOR.** Quem contrata antes de
  o teste acabar leva 50% pelos 12 meses, e quem decide se ainda está dentro é
  `functions/lib/contratacao.js` lendo `trialInicio`. No cliente, seria o
  relógio do aparelho — a coisa mais fácil de mudar num telefone, valendo
  metade da conta por um ano. Concedida **uma vez**: quem troca de faixa no
  décimo mês mantém a data original, senão o desconto se renovaria para sempre.
- **A tabela de faixas está espelhada em `functions/lib/contratacao.js`** — só
  os DADOS (id, teto, preço), nenhuma aritmética, porque o deploy das functions
  não alcança `src/`. `npm run testar:gateway` compara as duas faixa por faixa.
  Espelhar a régua inteira (200 linhas) foi recusado pelo mesmo motivo.
- **Desconto tem PRAZO, e sem ele vira preço.** `users.descontos` é uma lista
  de `{origem, fracao, ate}` com `ate` em 'AAAA-MM'
  ([planos.js](src/dominio/associacao/planos.js)). Duas origens: `antecipacao`
  (contratou antes de o teste acabar → 50% por 12 meses) e `roleta`. A lista é
  SUBSTITUÍDA, nunca acrescida — `arrayUnion` acumularia o mesmo prêmio numa
  reemissão de contrato.
- **Fundador e antecipação NÃO somam — vale o maior.** É decisão de negócio, e
  mora em `FUNDADOR_E_ANTECIPACAO_SOMAM` justamente para poder ser desfeita
  numa linha. Somando, os treze primeiros associados chegariam a 100% e a
  partir dali roleta e indicação valeriam zero — para exatamente as pessoas que
  mais indicam.
- **Isenção não é desconto de 100%.** `users.isencaoAte` diz que aquele mês não
  tem fatura; desconto de 100% produz uma fatura de R$ 0. Os dois chegam a zero
  e contam histórias diferentes na hora de conferir o que foi concedido.
- **O vencimento é da CASA**, não de cada parceiro: `taxaConfig.diaVencimento`
  (1–28, padrão 10). `fecharFatura` congela a data pronta em `vencimento`, como
  o [billing.js](functions/lib/billing.js) faz com o `dueDay` da criança — e lá
  a data é por criança porque quem negocia é o motorista com cada família.
- **O contrato é de 12 MESES e renova de 12 em 12**, com cobrança mensal.
  `VERSAO_CONTRATO = 3` — a 1 mandava suspender por atraso sem definir atraso,
  a 2 passou a dizer o dia, a 3 trocou percentual sobre base por faixa de
  tabela. Subir a versão exige novo aceite.
- **Vaga de criança é contratada.** `users.limiteCriancas` (só o dono escreve,
  e vem da faixa) contra `users.criancasAtivas`, contador que sobe no MESMO
  batch do cadastro. Rules não sabem contar documentos: `allow create` em
  `children` valida o contador com `getAfter` — um `addDoc` solto é recusado.
  Limite ausente = sem limite, **e é isso que vale durante o teste**: ele
  cadastra a operação inteira e o app prova o valor no tamanho real.
  **Não é à prova de devtools** — nenhuma rule exige que o contador ande junto
  de uma criança de verdade; quem pega é a fatura, que conta as crianças reais.
- **Receita é fatura `quitada`**, e sai de `faturasParceiro` em
  [adminMetricsService.js](src/services/adminMetricsService.js) — mesmo
  critério do GMV, que só soma `payments` com `paid`. Fatura `aberta` viaja
  em `receitaEmAberto` e **nunca** é somada na receita.
- **`suspenso` bloqueia nas rules**; o cartão de
  [AvisoDaPlataforma](src/components/tio/AvisoDaPlataforma.jsx) só explica.
  Ele mora no `TioLayout` e é omitido em `/tio/taxa` de propósito: cobrança
  que cobre a própria tela de pagamento não deixa ninguém pagar.

**O gateway cobra a TAXA e só ela.** `criarCobrancaDaFatura` só sabe ler
`faturasParceiro`; a mensalidade da família continua PIX direto pai→motorista.
No dia em que uma cobrança de `payments` nascer ali, o item 7 dos Termos fica
falso. A trava é o formato: [cobrancaDaTaxa.js](functions/lib/cobrancaDaTaxa.js)
não conhece outro documento. **Cobrar duas vezes o mesmo mês tem duas
guardas** — a fatura recusa quando já tem `asaasPaymentId`, e antes de criar se
PERGUNTA ao gateway pelo `externalReference` (o id da fatura), porque entre
criar lá e gravar aqui existe uma janela. **O gateway não cria cliente sem
CPF/CNPJ e o app não coleta esse campo** em lugar nenhum: ele entra pela mão do
dono e fica em `taxaParceiros/{uid}`, que só o dono lê.

**HÁ UM MODELO DE PREÇO SÓ, desde 06/09/2026.**
[planos.js](src/dominio/associacao/planos.js) — faixa fixa por número de
crianças ativas (R$ 69 / 149 / 229). O `taxa.js`, que era o modelo NEGOCIADO
(percentual sobre a soma das mensalidades, ajustado caso a caso num orçamento),
foi APAGADO. Os dois conviveram por dias, e o CLAUDE.md avisava que somá-los na
mesma fatura cobraria duas vezes; a saída foi apagar um, não escolher entre os
dois a cada leitura.

**O plano capa QUANTIDADE, nunca funcionalidade** — não existe Básico/Pro. O
app é completo em qualquer faixa, e o que muda é `users.limiteCriancas`, que
já existe e já é cobrado pelas rules. Escolher plano menor que o uso é
permitido, e **quem aponta as crianças que saem é o motorista**: corte
automático apagaria clientes que ele não escolheu perder.

**Só fundador chega a zero**, e é o desenho: 1º motorista vitalício, os 12
seguintes com 50%, indicação vale 10% cada com teto de 50%. Metade + cinco
indicações fecha em zero; quem não é fundador para em 50%. O desconto somado é
cortado em 100% — sem isso, seis indicações sobre um fundador dariam 110% e a
fatura viraria crédito. Testado em `npm run testar:planos`.

**O relógio dos três meses começa na PRIMEIRA ROTA**, não no cadastro —
`users.trialInicio`, gravado por [trialService](src/services/trialService.js)
no mesmo gesto que liga o GPS. Motorista escolar tem calendário: contando do
cadastro, quem conhece o app em dezembro chega em fevereiro com três semanas de
teste, e a primeira experiência real dele é a tela de cobrança.

O campo é **gravável uma vez e nunca alterável**, e a trava mora nas
[rules](firestore.rules) — livre, ele reinicia o próprio teste pra sempre, que
é `limiteCriancas` com outro nome. Quanto falta e qual aviso mostrar é conta
pura em [dominio/associacao/trial.js](src/dominio/associacao/trial.js)
(`npm run testar:trial`). **São três avisos e eles são FAIXAS, não datas** —
30 dias (linha), 7 (cartão âmbar), o último dia (não fecha). A urgência é
comunicada pela FORMA, porque cinco avisos em vinte dias ensinariam a pular
aviso, que é a mesma lição de `avisoDoMomento`.

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
- **Contratação:** `contratarPlano` — o MOTORISTA escolhe a faixa e o servidor
  escreve a cláusula (`planoId` + `limiteCriancas` no mesmo write, mais o
  desconto de antecipação se ele ainda estiver no teste). É function porque os
  dois campos estão na lista que o cliente nunca escreve.
- **Gateway (taxa do motorista):** `criarCobrancaDaFatura` (o DONO gera a
  cobrança de uma `faturasParceiro`) e `asaasWebhook` (a baixa vem de fora).
  As duas metades do mesmo elo: o webhook acha a fatura por `asaasPaymentId`,
  e é a callable que grava esse campo.
- **Outros:** `getShowcase`, `spinEntryBonus`,
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
[avatarUrl.js](src/marca/avatarUrl.js). O estilo é `adventurer` — 26 cortes
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
[avisoDoMomento.js](src/dominio/rota/avisoDoMomento.js), testado com hora injetada
(`npm run testar:aviso`). Dois casos, não cinco: rota não iniciada depois da
hora de pegar, e criança "na perua" muito depois da hora de chegar. Atraso
comum NÃO gera tarja — ali o app está calado, não mentindo, e tarja semanal
ensina a pular tarja. Quando o grave dispara, o anel pulsante e o "AO VIVO"
PARAM: animação viva sobre dado morto é a pior parte.

**Falta tem teto de 14 dias** — o aviso do responsável não passa disso, e o
motivo está em [AbsenceSheet.jsx](src/components/absences/AbsenceSheet.jsx):
plano muda, ninguém desmarca, e no dia o motorista não passa na porta. O
HISTÓRICO anda meses pra trás (`/pai/faltas`); o aviso continua cabendo em
duas semanas. A conta é pura e testada em [dominio/rota/faltas.js](src/dominio/rota/faltas.js)
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
regras que as filtraram estão em [marca/travessia.js](src/marca/travessia.js),
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
  [browserEnv.js](src/compartilhado/browserEnv.js). Não aparece na 1ª visita, nem já
  instalado, nem dentro da webview do WhatsApp.
- `registerType: 'prompt'` (não `autoUpdate`) em [vite.config.js](vite.config.js):
  versão nova AVISA em vez de assumir calada.
  [AtualizacaoDisponivel.jsx](src/components/common/AtualizacaoDisponivel.jsx)
  mostra o aviso, cobre a troca com uma tela cheia e recarrega na marra depois
  de 8s se o worker não assumir. Montado no `main.jsx`, fora do `AuthProvider`
  — atualizar não depende de quem está logado.

**Decidir mora FORA do app; entrar mora dentro dele.** Desde 06/09/2026 `/`
não é mais a home do motorista — ela foi APAGADA (eram 1090 linhas, e eager no
bundle de entrada). Quem chega em `alobuzinou.com` cai no `/login`, e quem
quer conhecer o produto está em `alobuzinou.com.br`, a landing estática, que
não passa pelo bundle do app. `SITE_INSTITUCIONAL` em
[config/vitrine.js](src/config/vitrine.js) é o único endereço dela no código —
sair do app exige `<a href>`, porque `<Link>` monta caminho relativo e
devolveria a pessoa pro login.

**A `/familia` continua**, e continua sendo a porta da responsável: rodapé
legal próprio — é onde está a pessoa cujos dados e os do filho vivem no
sistema — e **nenhuma** palavra de aquisição. Hoje ela está ÓRFÃ: a landing
nova não linka pra ela, e só o link de convite chega lá. Decisão pendente.

**O login é a única superfície de entrada**, para motorista, responsável e
dono — ninguém escolhe papel pra entrar, `painelDe()` resolve depois. É a
decisão 5 de [docs/decisoes.md](docs/decisoes.md), que estava com estado
"alvo".

**E ele tem DUAS ABAS desde 06/09/2026** — "Já tenho conta" e "Criar conta",
no mesmo cartão. O "Cadastrar" antigo era um link pra `/comecar`, e `/comecar`
devolve pro login quem não tem sessão: quem clicava deslogado voltava pra
mesma tela. A aba pode vir da URL (`/login?criar=1`): a landing está em outro
domínio e não tem `state`.

**A aba "Criar conta" NÃO cadastra ninguém — ela faz UMA pergunta**, e manda
pra `/quero-fazer-parte` (motorista) ou `/first-access` (responsável). Ela já
pediu o código do convite, e era erro: código é coisa de responsável, e o
motorista — que é o usuário principal — lia aquilo como "preciso de código pra
me cadastrar". As duas portas têm **pesos diferentes de propósito**: a do
motorista é cheia e vem primeiro, a da família é de contorno. Elas viajam com
`state: { de: 'escolha' }`, e é isso que faz o "Voltar" das duas telas
retornar pra bifurcação em vez de jogar pra fora do app quem estava
escolhendo — e que abre o campo de código já expandido no `/first-access`.

**As duas telas de cadastro são de MONITOR também**, com `data-painel="web"`:
o motorista decide sentado, e a responsável que perdeu o link volta pelo site.
As formas são OPOSTAS, e isso vem da landing — ele está comprando (denso,
escuro, campos em pares), ela está sendo tranquilizada (claro, arejado, uma
coluna). O empilhado do celular continua sendo o desenho principal das duas.

**O código do convite se lê de qualquer texto** — `codigoDoTexto` em
[generateInviteCode.js](src/dominio/identidade/generateInviteCode.js) aceita o
link inteiro (`/convite/TNAB23CD`), a mensagem inteira do WhatsApp e o código
digitado letra por letra. A máscara sozinha devolvia `HTTPSALOB` pra quem
colava o link e o app dizia "código inválido" com o código certo na mão. A
mensagem que o motorista manda passou a trazer **o código escrito** além do
link, porque a conversa some e o link vai junto.

**Preço não aparece na vitrine.** O que aparece é a FORMA do dinheiro: "a
mensalidade das suas famílias é sua, a plataforma não entra no caminho dela".
É verdade verificável (`payments` é PIX direto pai→motorista; a taxa vive em
`faturasParceiro` e noutra tela) e sustenta o item 7 dos Termos. Quanto custa
é conversa com o consultor — número solto vira âncora antes de existir
proposta.

`src/config/rodada.js` **foi apagado em 06/09/2026** junto com a fila.
`VAGAS_NA_RODADA` era escassez real — vaga na rodada do mês — e só fazia
sentido enquanto alguém controlava a porta. Sem porta, um contador de vagas
seria o contador falso que reinicia sozinho, ou seja, propaganda enganosa (CDC
art. 37). O argumento fica registrado porque vale para qualquer contador que
alguém queira pôr numa vitrine.

[src/config/vitrine.js](src/config/vitrine.js) — **a exceção a essa regra, e
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
arquivo, e `npm run testar:contraste` mede 50 pares contra os fundos reais.
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
   [marca/festivities.js](src/marca/festivities.js) e
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
passar por lá — e `npm run testar:regras` cobre o payload real (152 casos, com
atores **anônimo** e **`novato`** (motorista recém-cadastrado, sem vínculo); ele roda fora do CI porque precisa do
emulador, então rode à mão antes de publicar rule).

**A TRANCA MORA EM `isAdmin()`** — desde 06/09/2026 ele nega também quem está
com o teste vencido e sem assinatura, além de `suspenso`. Tela não é tranca: o
`GuardaDaConta` esconde o painel, mas o token continua válido e uma aba antiga
escreve igual.

⚠️ **A rule é o PISO, não o espelho da tela.** `contaAtiva.js` bloqueia antes
(dez dias depois do vencimento da fatura); a rule só conhece `assinaturaAte` +
folga, o que dá algumas semanas a mais. A assimetria é deliberada: errar
permissivo custa uma aba velha escrevendo; errar restritivo tranca um motorista
**pagante** às seis da manhã, sem conserto dentro do produto.

⚠️ **E ela tem DUAS metades de saída, que só funcionam juntas.** Nas rules,
`temPapelDeMotorista()` — usado SÓ na emissão de contrato — deixa o bloqueado
contratar, que é o que o desbloqueia. Na interface, `/tio/planos`, `/tio/taxa`
e `/tio/contrato-plataforma` ficam FORA do `GuardaDaConta` em
[App.jsx](src/App.jsx): dentro dele, o botão "Ver planos" navegava e a tela não
mudava. Sem qualquer uma das duas, a tranca prende quem está tentando sair.

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
