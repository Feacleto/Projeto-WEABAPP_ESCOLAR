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
npm run testar                   # 1904 casos em 36 scripts. O PRIMEIRO é
                                 # `testar:imports`, e ele existe porque a
                                 # bateria já esteve partida no meio — ver a
                                 # nota abaixo. Depois, na ordem da cadeia:
                                 # horarios, faltas, endereco, aviso,
                                 # contraste, travessia, contrato, pix, brcode,
                                 # status, auth, trial, planos, avisos, multa,
                                 # conta, cobranca, gateway, carteira,
                                 # proposta, chamados, risco, fila, concessao,
                                 # selo, indicacao, origem, abas,
                                 # acompanhamento, transacoes, fundo, busca,
                                 # tutorial
npm run testar:regras            # rules do Firestore — precisa do emulador
npm run testar:storage           # rules do Storage — precisa de auth,firestore
                                 # E storage juntos (ele semeia usuário e
                                 # criança antes de testar). Só `--only storage`
                                 # morre em `fetch failed`.
npm run build
```

`--legacy-peer-deps` não é opcional: `vite-plugin-pwa@1.x` lista Vite ≤ 7 como
peer e o projeto usa Vite 8.

**Não existe runner de teste** (sem Jest/Vitest, de propósito). Os testes são
scripts Node em [scripts/](scripts/) rodados direto. Ao criar teste novo, siga
esse padrão em vez de introduzir um framework.

⚠️ **A BATERIA JÁ RODOU PELA METADE NO CI SEM NINGUÉM VER, E ISSO TEM TESTE
AGORA.** `testar-gateway.mjs` importava `functions/lib/contratacao.js`, cuja
primeira linha requer `firebase-functions` — pacote que só existe em
`functions/node_modules`, não rastreado pelo git, e o CI roda **um** `npm ci` na
raiz. Num checkout limpo o script morria, e o `&&` do encadeamento levava os
**11 seguintes** com ele: carteira, proposta, chamados, risco, fila, concessao,
selo, indicacao, origem, abas, transacoes. Na máquina de quem desenvolve tudo
passava.

A régua pura saiu para
[functions/lib/reguaDoServidor.js](functions/lib/reguaDoServidor.js), que **não
faz `require` nenhum**, e a regra virou: **módulo de `functions/lib/` que é
RÉGUA não requer `firebase-admin` nem `firebase-functions`.** Quem precisa do
SDK é o `onCall`, e ele mora noutro arquivo.
`npm run testar:imports` segue os imports de cada script da bateria e falha se
algum alcançar o SDK — e é o **primeiro** da bateria de propósito: quando o elo
parte, o mais rápido a saber deve ser quem mede o elo, não o 15º script a
morrer. Ele também exige que todo `scripts/testar-*.mjs` tenha porta no
`package.json`, com uma lista nomeada das exceções (emulador, rede, navegador).

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
react-leaflet 5 · vite-plugin-pwa · lucide-react ·
react-hot-toast. JavaScript puro — **não há TypeScript**.

⚠️ **OS TILES DO MAPA VÊM DO MAPTILER desde 10/09/2026, e o motivo não é
custo** — [config/mapa.js](src/config/mapa.js). Eles vinham do servidor do
**próprio OpenStreetMap**, cuja *Tile Usage Policy* destina aquela
infraestrutura doada a uso leve e não comercial: **rota ao vivo é exatamente o
padrão que ela exclui**, e bloqueio ali deixa o mapa cinza para todas as
famílias ao mesmo tempo, sem erro na tela.

A escolha entre MapTiler e OpenFreeMap foi de FORMATO, não de preço: o
OpenFreeMap serve só tiles vetoriais, que exigem MapLibre GL e **WebGL** —
trocar de provedor viraria trocar a biblioteca de mapa e levar WebGL para o
"Android barato" que este projeto trata como público principal em toda outra
decisão. O Leaflet tem 144 KB e desenha com `<img>`.

⚠️ **A chave aparece no bundle por desenho** (é o navegador que pede a
imagem, em qualquer provedor). Quem protege é a **restrição por domínio** no
painel do MapTiler — chave restrita e visível é segura; chave secreta em app
de navegador não existe. Sem `VITE_MAPTILER_KEY` o app volta ao OSM, que é o
caminho de **desenvolvimento** e é a própria política que isto veio deixar de
violar. `npm run testar:mapa` (25 casos) recusa qualquer mapa que escreva a
URL do provedor à mão — ela é curta, não pede chave e funciona na máquina de
quem testa, então voltar a escrevê-la é a coisa mais fácil do mundo.

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
mais caro possível aqui.

**O DONO PODE SER MAIS DE UM, e o legado `superAdmin` SAIU em 06/09/2026.**
`isOwner()` e `ehDono()` sempre checaram o PAPEL, nunca a identidade — duas
contas com `role: 'owner'` sempre foram duas donas; o que dizia o contrário era
comentário (e o bloco das rules chegou a se contradizer dentro de si). O
fallback era ponte para a conta do projeto antigo, que foi excluído. ⚠️ **A
conta de dono precisa nascer com `role: 'owner'`**, pelo console — `superAdmin:
true` não abre mais nada.

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

**O DESCONTO TEM DOCUMENTO PRÓPRIO desde 07/09/2026:
[docs/descontos.md](docs/descontos.md)** — escada de fechamento (50/30/15 por mês
de decisão), piso de fatura, indicação e a condição de fundador. Leia antes de
mexer em qualquer desconto. Ele supera partes das seções 5 e 7 do
[negocio.md](docs/negocio.md), que estão marcadas no lugar, e a **Parte 2 dele é
a lista do que foi mudado no código** (implementada em 07/09/2026 — a régua
descrita lá é o que `planos.js` faz hoje) e some quando a última linha for
conferida em produção.

O critério que ele estabelece vale para qualquer desconto novo: **o teste da fila
do portão**. Motorista de perua faz fila no mesmo portão todo dia, e um desconto
só pode existir se sobreviver a ser dito em voz alta entre dois deles — motivo
público, reproduzível por qualquer um, verificável. Foi ele que aposentou o
fundador-por-ordem-de-chegada (ninguém pode chegar antes) e a roleta (o critério
é sorte).

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
│   ├── Acompanhar    /acompanhar/:token — a tela de quem vai PEGAR a criança
│   │                 hoje. Pública, sem conta, sem sessão do Firebase e sem
│   │                 mapa ao vivo: a posição da perua é o veículo de um
│   │                 autônomo e ele não decidiu compartilhá-la com terceiros
│   ├── tio/           20 telas do motorista
│   ├── pai/           8 telas do responsável
│   ├── admin/         AdminPanel + TaxaTab. O dono tem UMA tela, com OITO
│   │                  abas: Hoje (a fila), Motoristas (lista + FICHA),
│   │                  Chamados, Mês (régua e fechamento), Números, Selos,
│   │                  Indicações, Pesquisa. As abas moram em
│   │                  components/admin/.
│   └── legal/         termos e privacidade — `LEGAL_VERSION` está em 1.1
│                       (09/09/2026): o controlador passou a ser IDENTIFICADO
│                       (razão social + CNPJ + cidade; os dois primeiros já
│                       estavam no repo e concordavam) e a seção 2b passou a
│                       declarar Resend e Asaas como operadores. Subir a versão
│                       obriga todo mundo a reaceitar — feito com base quase
│                       zero, custa uma conversa.
│                       ⚠️ SEDE e FORO são coisas DIFERENTES, mesmo quando
│                       coincidem. A sede é `DEV_ENDERECO` (Rua das Trovas,
│                       bairro Socorro, São Paulo/SP, CEP 04763-110) e a
│                       comarca é `DEV_COMARCA` — eleição é escolha (CPC 63),
│                       não consequência do endereço. A cláusula DECLARA, nunca
│                       deriva, e traz a ressalva do art. 101 I do CDC, sem a
│                       qual ela é abusiva e cai inteira.
│                       ⚠️ `Socorro` É BAIRRO, não cidade — o rodapé da landing
│                       dizia "Socorro — São Paulo/SP" e isso foi lido errado
│                       DUAS vezes numa auditoria (primeiro o estado como
│                       cidade, depois o bairro como cidade). O CEP é o que
│                       fecha a dúvida, e por isso ele está no endereço.
│                       Falta só o NÚMERO, em `DEV_NUMERO`
├── components/        por domínio: route, agenda, children, payments, map,
│                      call, notifications, landing, tutorial, festive…
├── services/          39 módulos — TODO acesso ao Firestore passa aqui
├── hooks/             23 hooks, quase todos onSnapshot de um service
├── config/            capabilities, developer, vitrine,
│                      paletaCategorica (o único lugar com cor crua)
├── context/           AuthContext (perfil + papel)
├── dominio/           AS REGRAS. Puro, sem Firebase, sem React — um contexto
│                      por pasta (ver "Os sete contextos" abaixo)
│   ├── rota/          horarios, avisoDoMomento, routePresence, faltas,
│   │                  intervaloDeDias
│   ├── cobranca/      statusPagamento, pix, pixPayload, chargeMessage,
│   │                  paymentVocabulary
│   ├── associacao/    planos, multa, contratoAssociacao, trial, contaAtiva,
│   │                  carteira, proposta, risco, fila, concessao, adesivo
│   ├── identidade/    papeis, childIds, generateInviteCode, inviteUrl,
│   │                  authErrors, verificacao, indicacao, origem
│   ├── escola/        nomeEscola
│   ├── suporte/       chamados
│   └── vitrine/       frentes
├── marca/             a personalidade: avatarUrl, greeting, festivities,
│                      travessia, promessas. Tem regra, mas de apresentação
├── compartilhado/     SEM regra nenhuma: formatters, masks, haversine,
│                      abaAtiva, browserEnv. Não conhece o domínio (o lint
│                      recusa)
└── firebase/config.js
landing/               O SITE INSTITUCIONAL — HTML estático, sem build.
                       `alobuzinou.com.br` (o app é o `.com`, não um
                       subdomínio). Não é o app: um index.html com CSS
                       e JS inline, deploy por `--only hosting:landing`. As
                       duas home públicas antigas (`/` do motorista) morreram
                       aqui dentro; a `/familia` continua no app.
functions/             Cloud Functions v2 (CommonJS, Node 22)
  └── lib/             reguaDoServidor (a régua PURA — sem require, e desde
                       10/09/2026 ela espelha `precoDoMes` INTEIRO, porque o
                       fechamento virou agendada), avisosComerciais (a outra
                       régua pura), fechamento + enviarAvisos (os dois
                       agendados que ESCREVEM), billing, invites, push, routes,
                       contratacao, relogioDoTeste, asaasCobranca, asaasWebhook,
                       confirmarAusencias, receiptGuard, papeis, limites,
                       indicacao + casarIndicacao (espelho da indicação)…
firestore.rules        108 KB — a segurança real do app mora aqui
storage.rules          foto, comprovante, logo e contrato de papel. Caminho
                       DETERMINÍSTICO (`childPhotos/{childId}`): `isAdmin()`
                       sozinho ali libera a plataforma inteira
scripts/               testes e utilitários de manutenção (Node puro).
                       `varrer-descontos.cjs` é SÓ LEITURA e não tem flag para
                       escrever: ele procura em `users` os descontos que a
                       régua vai deixar de reconhecer (`antecipacao`,
                       `roleta`, `condicaoFundador: 'metade'`) antes de
                       apagá-los. Apagar cedo demais falha em SILÊNCIO — a
                       fatura de alguém sobe e nenhum erro aparece
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

### Os sete contextos

Não são pastas por tipo de arquivo, são as seis conversas diferentes que o
sistema tem. Regra nova mora no contexto de quem decide sobre ela:

| Contexto | A pergunta que ele responde | Quem manda |
|---|---|---|
| `rota` | onde a criança está e o que o app sabe da perua | motorista |
| `cobranca` | quanto a família deve e como ela paga | motorista ↔ família |
| `associacao` | quanto o motorista paga à plataforma | dono |
| `identidade` | quem é essa pessoa e a que ela está ligada | plataforma |
| `escola` | que escola é essa e quem avisar | motorista |
| `suporte` | quem pediu ajuda e há quanto tempo espera | plataforma |
| `vitrine` | o que cada porta pública promete | dono |

`suporte` nasceu em 06/09/2026 e é o sétimo — a tabela dizia SEIS. Ele existe
porque `supportTickets` recebia desde sempre e nenhuma tela do dono lia: quem
pede ajuda e não recebe resposta cancela sem dizer por quê.

Os dois dinheiros são contextos SEPARADOS de propósito — misturá-los quebra o
item 7 dos Termos, e a separação em pastas é o que torna a mistura visível
antes de ela virar código.

---

## Modelo de dados (Firestore)

Coleções de raiz, como aparecem em [firestore.rules](firestore.rules):

`users` · `children` (+ subcoleção `rides/{YYYY-MM-DD}`) · `payments`
(+ `events`) · `liveLocation` · `notifications` · `altPickups` · `schools` ·
`absenceDeclarations` · `agendaEntries` · `pendingCalls` · `schoolBroadcasts` ·
`feedbacks` · `supportTickets` · `expenses` · `taxaConfig` · `taxaParceiros` ·
`faturasParceiro` · `contratosAssociacao` · `pedidosAdesivo` ·
`indicacoes` · `interesses` · `platformConfig` · `appState`

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

⚠️ **O ENDEREÇO TEM UM MODO DE FALHAR QUE NÃO É QUEBRAR — É AFIRMAR.** O campo
era um texto livre só, e o pedaço que se esquece nele é o **número**. Sem número
o Nominatim acha a RUA, centraliza no meio dela, e a tela escreve *"Local
confirmado!"* sobre uma coordenada na quadra errada — ninguém desconfia de um
pino que parece certo.

Desde 10/09/2026 há um campo de **CEP** antes dele, pelo
[ViaCEP](https://viacep.com.br) (grátis, sem chave, sem cota): ele preenche rua,
bairro e cidade, e o ganho de verdade é o que sobra — **o número fica num campo
próprio, e campo próprio pode ser exigido**. O CEP é ATALHO, nunca requisito:
quem não tem digita tudo no campo livre, como antes. Cadastro feito no meio da
rota não pode passar a depender de consultar papel.

- **Ou o endereço é derivado do CEP, ou é digitado — nunca os dois.** Enquanto
  as partes do ViaCEP existirem, o texto é remontado a cada mudança de número.
  No instante em que a pessoa digita no campo livre, ela vira dona dele e nada
  mais o reescreve. Sem essa regra, corrigir "Rua" para "Estrada" à mão e depois
  ajustar o número apagava a correção, sem nada explicando o que comeu o texto.
- **São DUAS strings com dois leitores**, e as duas são puras e testadas
  (`npm run testar:endereco`, 55 casos): `montarEndereco` é o que a pessoa lê
  (formato dos Correios) e `consultaDoEndereco` é o que o geocodificador lê
  (número ANTES da rua, sem o complemento, "Brasil" sempre no fim). Ambas em
  [compartilhado/formatters.js](src/compartilhado/formatters.js) — a segunda
  morou no `locationService` por uma hora, atrás de um `import` do Firestore
  onde o Node não a alcançava.
- ⚠️ **O `display_name` do Nominatim NÃO substitui o endereço que veio do CEP.**
  Ele é verboso, traz "Região Metropolitana" e microrregião, e com frequência
  **perde o número** — trocar o texto dos Correios por ele desfaz exatamente o
  conserto que o campo separado acabou de fazer. Só substitui quando o endereço
  foi digitado à mão.
- ⚠️ **`countrycodes=br` não é detalhe, e isso foi SONDADO.** Sem ele, "Rua
  Augusta, 100" e "Avenida da Liberdade, 100" voltaram as duas de **Lisboa** no
  Nominatim (10/09/2026) — e as duas são ruas brasileiras banais. O parâmetro
  troca uma classificação por uma garantia: sem ele o resultado é brasileiro
  quando o Nominatim decide que é. Passou meses aqui porque "Rua das Flores,
  100" vem do Brasil sozinha, então quem testa com um endereço qualquer não vê
  nada.
- **CEP inexistente responde HTTP 200** com `{"erro": "true"}` no corpo. Quem
  confere só `res.ok` grava endereço vazio por cima do que a pessoa digitou.
- **Só o `cep` é GRAVADO** (em `children` e em `schools`); número e complemento
  vivem dentro de `address`/`endereco`, que é a única string que rota, mapa,
  contrato e tela do pai leem. Uma segunda cópia do número seria uma segunda
  verdade sobre onde a criança mora. O CEP é a exceção porque não é texto de
  endereço, é a **chave** dele: guardado, dá pra reconsultar a rua e recalcular
  a coordenada de um cadastro antigo sem pedir nada a ninguém. Nenhuma mudança
  de rules — `children` e `schools` não têm whitelist de campos no `create`.
- **O número é cobrado na casa da criança e NÃO na escola.** A perua encosta
  numa PORTA: errar o número ali é parar na calçada errada com a mãe esperando
  na outra. Escola é prédio grande, muitas vezes de esquina ou num campus sem
  número útil — cobrar por simetria travaria o cadastro no caso em que a
  informação legitimamente não existe.

**E NÃO É GOOGLE MAPS, com a conta escrita.** O tile é MapTiler sobre Leaflet
([config/mapa.js](src/config/mapa.js)) — a saída do servidor doado do OSM está
contada no commit que a fez. A cota grátis do Google cobre ~10.000
carregamentos/mês, ou seja **250 crianças na plataforma inteira**; acima disso o
mapa ao vivo custaria ~R$ 1,55 por criança/mês contra os R$ 5,90 que a criança
paga — 26% da receita, e mais da metade no plano anual. ETA pela Routes API
sairia **sete vezes** a receita da criança.

O Google só se pagaria no **geocoding**, que é chamada única e fica gravada no
documento — e mesmo ali o ViaCEP chega primeiro, de graça. ⚠️ E os tiles dele
**não podem** ser servidos pelo Leaflet: é violação dos Termos, não uma
economia. Trocar de provedor de tile é trocar a URL em `config/mapa.js`; trocar
para o Google é reescrever os três componentes de mapa.

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

**A associação, ponta a ponta** — reescrita em 10/09/2026, quando o preço
virou LINEAR. Três paradas, e a primeira é o próprio motorista:
plano escolhido (`users.plano`, 'mensal' ou 'anual', gravado por
`contratarPlano`) → `contratosAssociacao` (aceito em
`/tio/contrato-plataforma`) → `faturasParceiro` (fechada por AGENDADA todo dia
1, paga em `/tio/taxa`).

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
- ⚠️ **`limiteCriancas` DEIXOU DE EXISTIR COMO TRANCA** (10/09/2026), e com ele
  a amarra de dois campos que este parágrafo descrevia. As rules recusavam a
  criança que passasse do teto — com preço por faixa isso era a cláusula sendo
  cobrada; com preço por criança virou uma porta na cara de quem acabou de
  ganhar um cliente. O campo não é mais escrito por ninguém e continua PROIBIDO
  nas rules: campo sem gravador não é campo livre.
  O que ficou no `allow create` de `children` é o contador subindo no mesmo
  batch — e ele passou a ser verdade agora: a conta antiga era
  `criancasAtivas <= limiteCriancas` com o limite ausente valendo 999999, então
  `0 <= 999999` passava SEM incremento para todo mundo em teste. Hoje compara o
  contador DEPOIS com o de ANTES.
- **Contratar é do MOTORISTA; a cláusula é do SERVIDOR.** `/tio/planos` tem o
  botão desde 06/09/2026 — ele abria o WhatsApp do consultor. A saída não foi
  abrir as rules de dinheiro: a callable `contratarPlano` grava `users.plano` e
  o degrau, e a rule de `contratosAssociacao` exige que o plano DENTRO do
  contrato bata com o que o servidor gravou. ⚠️ A amarra é sobre o PLANO, não
  sobre o valor: com preço por criança o valor muda todo mês, e exigir que o
  contrato repita um número o faria nascer inválido na criança seguinte. **O cliente ganhou o botão sem
  ganhar a caneta** — sem essa amarra, a fatura continuaria certa (ela lê
  `users.planoId`) e existiria um documento assinado dizendo outra coisa.
- **A ESCADA DE FECHAMENTO é decidida pelo relógio do SERVIDOR, e é VITALÍCIA.**
  Quem fecha no 1º mês do teste trava 30%; no 2º, 20%; no 3º, 10%; depois dos 90
  dias, nada (e 10% se voltar em 30 dias). ⚠️ **O desconto não expira** — vale
  enquanto ele ficar, e morre se ele cancelar. Foi assim que o problema do mês
  13 deixou de existir: não há data para chegar, e as três defesas que o
  desenho anterior previa (rampa, renovação, mensagem do mês 10) viraram
  desnecessárias. Em troca, o custo de sair passou a ser dele.
  ⚠️ **Ela vale só no MENSAL.** O anual já é metade do preço; a 50% (o valor
  antigo) o mensal com desconto máximo empatava com o anual e o anual perdia a
  razão de existir — é por isso que a escada encolheu junto com o preço.
  Quem decide o degrau é `functions/lib/contratacao.js` lendo `trialInicio`. No
  cliente, seria o relógio do aparelho — e mentir nele agora não vale doze meses
  de conta, vale a conta inteira. Concedida **uma vez**: quem troca de plano no
  décimo mês mantém a FRAÇÃO original, senão trocar ida e volta a melhoraria.
  A escada substituiu a `ANTECIPACAO` (50% em qualquer dia dos 90) em
  07/09/2026, e o motivo é que ela não antecipava nada: quem fechava no dia 3 e
  no dia 89 levavam o mesmo prêmio.
  ⚠️ **O preço NUNCA sobe quando ele recusa.** Não há segunda oferta na tela —
  desconto que sobe a cada "não" ensina a recusar e prova que o preço era
  teatro. Ver [descontos.md](docs/descontos.md), peça 3.
- ⚠️ **A CONTA INTEIRA ESTÁ ESPELHADA EM
  [reguaDoServidor.js](functions/lib/reguaDoServidor.js)**, e não só a tabela.
  O espelho cresceu em 10/09/2026 porque o fechamento saiu do cliente e virou
  agendada: o servidor passou a precisar de `precoDoMes` completo — descontos,
  teto de 100%, piso e isenção. O deploy das functions não alcança `src/`.
  **Duplicar aritmética só é aceitável com um teste que a compare caso a caso**,
  e `npm run testar:gateway` varre a MATRIZ (tamanho × plano × fundador ×
  indicações × descontos × mês, mais de mil combinações) além dos degraus dia a
  dia. É o terceiro espelho do projeto, depois da escolha do indicado e da
  antiga tabela.
  ⚠️ **Há uma TERCEIRA cópia da conta de degrau**, em
  [proposta.js](src/dominio/associacao/proposta.js), e o teste dela confere a
  fração da régua mas monta a STRING por conta própria. A proposta é a mensagem
  que o dono manda pelo WhatsApp: divergir ali é o motorista lendo um número e
  recebendo fatura de outro, com contrato assinado no meio.
- ⚠️ **O DESCONTO DE FECHAMENTO É VITALÍCIO, E `ate: null` É O JEITO DE DIZER
  ISSO.** `users.descontos` é uma lista de `{origem, fracao, ate, degrau}`
  ([planos.js](src/dominio/associacao/planos.js)); `ate` em 'AAAA-MM' é prazo,
  e `null` é sem prazo. A CONCESSÃO segue tendo data — ela é exceção, não régua.
  **`ate` AUSENTE não é vitalício: é descartado.** A distinção é estrita porque
  as duas falhas custam coisas diferentes — chave esquecida virando desconto
  eterno vaza receita em silêncio; vitalício tratado como vencido tira do
  motorista o que foi prometido. Escrever `null` é deliberado, esquecer não é.
  A lista é SUBSTITUÍDA, nunca acrescida, e quem já tem fechamento mantém a
  FRAÇÃO original — senão trocar de plano ida e volta melhoraria o desconto.
- **A INDICAÇÃO VALE 5% POR INDICADO PAGANTE, SEM PRAZO, E CAI QUANDO ELE
  SAI** (10/09/2026). Era 10%, e o problema não era o tamanho: **o desconto
  sai da fatura de QUEM INDICA e a receita vem de QUEM FOI INDICADO**, dois
  números sem relação. Medido contra `precoDoMes`, um motorista de 60 crianças
  trazendo um de 8 custava R$ 14,10 por mês — para sempre, contra R$ 10 a
  R$ 20 de infra. A 5% o pior caso fica em −R$ 2,70 e some assim que o
  indicado ganha uma criança.
  ⚠️ **NÃO TEM PRAZO, e isso é decisão.** A alternativa era pagar 12 meses por
  indicação; simulada contra o caso real (indica 5 no mês 3, mais 5 no mês 7,
  cada indicado levando ~4 meses para pagar), ela produz **doze mudanças de
  fatura em 30 meses, seis delas para cima** — o degrau que o preço linear e a
  escada vitalícia tinham acabado de eliminar, voltando pela porta do desconto.
  Sem prazo, a conta dele só desce e o escalonamento das entradas é invisível.
  ⚠️ **QUEM GANHA É QUEM INDICA, nunca o indicado.** Desconto por *ter sido*
  indicado faria dois motoristas que se cadastram no mesmo dia pagarem
  diferente por conhecerem ou não alguém — é o teste da fila do portão ao
  contrário. O indicado já leva o maior desconto da casa (30% por fechar no
  mês 1); o que falta é a mensagem de convite DIZER isso.
- ⚠️ **A INDICAÇÃO NÃO TEM TETO PERCENTUAL — QUEM PROTEGE A MARGEM É O PISO.**
  `PISO_DA_FATURA = 19`: nenhuma fatura fica abaixo disso (exceto o vitalício).
  O teto de 50% existia e **não protegia nada** — com o fechamento somando por
  cima, a fatura chegava a R$ 0,00, e o comentário que jurava o contrário durou
  meses porque o teste passava indicações SEM o outro desconto. Porcentagem não
  protege margem porque não é medida na moeda do custo. O número é derivado:
  ele desceu junto com o preço em 10/09/2026 — em R$ 34 ficaria ACIMA do menor
  plano novo (o anual mínimo, R$ 29) e o motorista pequeno nunca receberia nada
  por indicar, que é a queixa que o programa existe para evitar. ⚠️ Não
  confundir com o **MÍNIMO DE TABELA** (R$ 49 mensal / R$ 29 anual), que vem
  ANTES do desconto: invertidos, quem tem 10 crianças e 30% travado pagaria
  R$ 49 em vez de R$ 41,30 e o desconto sumiria sem nenhuma linha.
  `precoDoMes` devolve `pisoAplicado` e `descontoAbsorvido` porque **a tela
  precisa dizer quando o piso comeu desconto** — calar produz o *"indiquei e não
  recebi"*. A 5% ele quase não encosta: mordia na 4ª indicação de quem tem 8
  crianças, agora morde na 7ª.
- **A CONDIÇÃO DE FUNDADOR VIROU TÍTULO, NÃO PREÇO** (07/09/2026).
  `FUNDADORES_METADE = 0`: as doze vagas de metade não são mais concedidas —
  era o único desconto que ninguém podia reproduzir, e não sobrevivia à conversa
  no portão da escola. Custou zero, porque quem fecha no mês 1 já leva o degrau
  cheio pela escada. O **vitalício já concedido continua** (é contrato assinado, e é um
  só), e `descontoDoFundador` ainda lê `metade` — não conceder é diferente de
  desfazer o que foi concedido.
- **Fundador e fechamento NÃO somam — vale o maior**
  (`FUNDADOR_E_FECHAMENTO_SOMAM`). Somando, um fundador de metade chegaria a
  100% e a partir dali a indicação valeria zero — para exatamente as pessoas que
  mais indicam.
- **A ROLETA FOI APAGADA em 07/09/2026** — `girarPremio`, a coleção `premios`,
  `premioService`, `PremioNudge`/`PremioSheet` e `premioDeConversao.js`. O
  critério dela era SORTE, e sorte não sobrevive ao portão: *"o Zé girou e tirou
  2 meses, eu tirei 10%"* não tem resposta. O papel de prêmio de conversão é da
  escada, que é pública, reproduzível e com data.
  ⚠️ `descontosVigentes` não reconhece mais `origem: 'roleta'` — documento órfão
  em produção deixa de valer em silêncio. **Confira `users.descontos` antes de
  considerar a remoção terminada.**
- **Isenção não é desconto de 100%.** `users.isencaoAte` diz que aquele mês não
  tem fatura; desconto de 100% produz uma fatura de R$ 0. Os dois chegam a zero
  e contam histórias diferentes na hora de conferir o que foi concedido.
- **O vencimento é da CASA**, não de cada parceiro: `taxaConfig.diaVencimento`
  (1–28, padrão 10). `fecharFatura` congela a data pronta em `vencimento`, como
  o [billing.js](functions/lib/billing.js) faz com o `dueDay` da criança — e lá
  a data é por criança porque quem negocia é o motorista com cada família.
- **O contrato é de 12 MESES e renova de 12 em 12**, com cobrança mensal.
  `VERSAO_CONTRATO = 5` — a 1 mandava suspender por atraso sem definir atraso,
  a 2 passou a dizer o dia, a 3 trocou percentual sobre base por faixa de
  tabela, a 4 trouxe a escada de fechamento e o **piso como cláusula**, e a 5
  trocou a faixa pela TAXA POR CRIANÇA e tornou a cláusula 6 assimétrica.
  Subir a versão exige novo aceite.
  ⚠️ **A cláusula 3 declara a TAXA, não um valor** — é isso que elimina a
  reassinatura por crescimento. Na versão 4 ganhar uma criança que cruzasse a
  fronteira exigia documento novo, no exato momento em que ele fechou um cliente.
  ⚠️ **A cláusula 6 tem duas metades e só uma mudou.** O ASSOCIADO encerra na
  hora, sem aviso e sem multa; a CONTRATADA mantém os 30 dias. Tirar as duas
  seria rescisão unilateral sem direito equivalente (CDC art. 51, XI).
  ⚠️ **O piso vai escrito no contrato mesmo quando não morde.** Sem a cláusula,
  um associado com 100% de desconto nominal recebe fatura de R$ 34 e o documento
  não explica de onde ela veio — a mesma contradição da concessão, pelo outro
  lado da conta. `npm run testar:contrato` tem DUAS invariantes agora: as
  frações fecham com o total, **e** o valor mensal se explica pelas linhas.
- **NADA TRAVA QUANDO A OPERAÇÃO CRESCE** (10/09/2026). Não há teto de
  crianças: `users.criancasAtivas` é o número que a fatura multiplica pela taxa,
  e o `allow create` de `children` exige apenas que ele SUBA no mesmo batch —
  `getAfter` contra `get`. Um `addDoc` solto é recusado.
  **Não é à prova de devtools** — nenhuma rule exige que o contador ande junto
  de uma criança de verdade; quem pega é a fatura, que conta as crianças reais.
  ⚠️ A conta desce sozinha também: perdeu três crianças, a fatura do mês
  seguinte vem menor. Antes ela continuava vindo no valor da faixa contratada
  até alguém mexer à mão, o que é pior que burocracia — é cobrar a mais em
  silêncio.
- ⚠️ **APAGAR A COBRANÇA NO GATEWAY NÃO DESFAZ PAGAMENTO FEITO POR FORA.**
  `PAYMENT_DELETED` reabre a fatura — e o caminho natural é: o motorista paga o
  PIX direto, o dono dá baixa à mão, o dono apaga a cobrança redundante no
  painel do Asaas, e dez dias depois quem PAGOU é bloqueado. `quitadaPor` (que
  só a baixa manual grava) é o sinal que segura isso em
  [eventoDeCobranca.js](functions/lib/eventoDeCobranca.js). Estorno e chargeback
  continuam reabrindo: neles o dinheiro **voltou**.
- **Retenção de `payments` é de 60 MESES, e o número vem da Política de
  Privacidade** — não o contrário. Era 12, e a seção 8 prometia 5 anos por
  obrigação fiscal: o app apagava em um ano o que o documento diz guardar por
  cinco, e das duas a que vale contra a plataforma é a escrita. **Se mudar aqui,
  muda lá na mesma alteração.**
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

**O PREÇO É POR CRIANÇA, desde 10/09/2026.**
[planos.js](src/dominio/associacao/planos.js) — `TAXA` de R$ 5,90 por criança
ativa no **mensal** e R$ 2,90 no **anual**, com `MINIMO` de R$ 49 e R$ 29, e
`TAXA_ACIMA_DE_40` (R$ 4,90 / R$ 2,40) para o excedente da 40ª criança.

⚠️ **AS FAIXAS SAÍRAM PORQUE A CRIANÇA DA FRONTEIRA CUSTAVA SETE.** Eram três
(R$ 69 / 149 / 229), e no limite de uma para outra ganhar UMA criança subia a
conta em R$ 40 — 6,8 vezes a taxa por criança. O motorista não sentia que pagou
por uma, sentia que pagou por sete, e comparava com um concorrente que cobra
por aluno. Franquia de tolerância não resolvia: empurra o degrau uma criança
adiante. A troca também fechou um vazamento — a faixa cobrava R$ 4,76 por
criança de quem tinha 25 e R$ 7,44 de quem tinha 16.

⚠️ **A TAXA MARGINAL É MARGINAL, como faixa de imposto**, e é isso que a impede
de virar o degrau que acabou de sair: sem marginalidade `preco(41)` seria MENOR
que `preco(40)` e crescer daria desconto. `npm run testar:planos` varre 1 a 60
crianças nos dois planos e exige que o preço nunca desça.

**O plano capa PRAZO E SAÍDA, nunca funcionalidade** — não existe Básico/Pro. O
app é completo nos dois: o mensal não tem prazo nem multa e trava o desconto da
escada; o anual custa menos da metade e pede doze meses, com multa de 20% do
saldo ([multa.js](src/dominio/associacao/multa.js)).

**Só o fundador VITALÍCIO chega a zero**, e todo o resto para no piso de
R$ 19. O desconto somado é cortado em 100% antes disso — sem o corte, dez
indicações dariam 200% e a fatura viraria crédito. As duas travas são em série e
protegem coisas diferentes: o teto impede fatura NEGATIVA, o piso impede fatura
IRRISÓRIA. Testado em `npm run testar:planos`, incluindo o caso que vazava.

**O relógio dos três meses tem TRÊS GATILHOS, e vale o que vier primeiro:**
primeira rota, primeiro responsável entrando, primeira mensalidade gerada
([relogioDoTeste.js](functions/lib/relogioDoTeste.js)). Nunca o cadastro.

Por um dia o único gatilho foi a rota, e isso deixou um buraco de graça
ilimitada: o app tem DUAS metades, e dava para cadastrar a turma, convidar as
famílias, emitir contrato e cobrar mensalidade **para sempre** sem tocar em
"iniciar rota". O erro não foi escolher a rota — foi confundir ROTA com USO.

A rota liga pelo CLIENTE (o GPS liga no meio-fio, às vezes sem sinal); os
outros dois ligam no SERVIDOR, com Admin SDK — é o que permite ligar o relógio
do motorista a partir de um gesto do responsável sem abrir permissão nova.

**Na landing é "ATÉ 3 meses de teste grátis"** — decidido pelo dono em
07/09/2026, e é uma reversão. A regra anterior era *diga TESTE, nunca "grátis"*,
porque "grátis" na porta prepara a pessoa para achar que a cobrança depois é
pegadinha. O que segura essa leitura agora é o **"até"**: ele descreve um teto,
não uma doação. ⚠️ **A frase mora em DOIS lugares da landing** (`.teste-hero` no
hero e o parágrafo do CTA de autoatendimento) e as duas mudam juntas — separadas,
a página oferece duas coisas diferentes na mesma rolagem. Dentro do app o
vocabulário continua sendo TESTE ([trial.js](src/dominio/associacao/trial.js)).

O relógio começa no primeiro uso, não no cadastro —
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
- **Contratação:** `contratarPlano` — o MOTORISTA escolhe mensal ou anual e o
  servidor escreve a cláusula (`users.plano` mais o desconto do degrau, com
  `ate: null`). É function porque esses campos estão na lista que o cliente
  nunca escreve.
- **Fechamento (agendado):** `fecharMesDosParceiros` (todo dia 1 às 5h, emite a
  fatura de todo motorista sem uma) e `fecharMesAgora` (o mesmo, à mão, para o
  dono). ⚠️ Até 10/09/2026 a fatura da plataforma só nascia por CLIQUE, e isso
  custava conversão: o degrau da escada decai no relógio do servidor mesmo
  quando ninguém fecha nada, então o motorista perdia 30% sem nunca ter
  recebido um preço. A régua é pura
  ([reguaDoServidor.js](functions/lib/reguaDoServidor.js)); quem escreve é
  [fechamento.js](functions/lib/fechamento.js).
- **Avisos comerciais (agendado):** `enviarAvisosComerciais`, todo dia às 9h.
  É o único canal que alcança quem PAROU de abrir o app — e ele já existia:
  um doc em `notifications` escrito pelo Admin SDK dispara
  `sendPushOnNotification`. A régua é
  [avisosComerciais.js](functions/lib/avisosComerciais.js), pura e testada:
  janela de silêncio (6h–8h30 e 16h30–19h, ele está dirigindo com criança
  dentro), um assunto por semana, nada para quem já contratou, e nenhum número
  que não venha da tabela. ⚠️ **O aviso de conta pausada FURA o guarda
  semanal** — um assunto por semana vale para OFERTA, nunca para o app avisar
  que parou de funcionar.
- **Gateway (taxa do motorista):** `criarCobrancaDaFatura` (o DONO gera a
  cobrança de uma `faturasParceiro`) e `asaasWebhook` (a baixa vem de fora).
  As duas metades do mesmo elo: o webhook acha a fatura por `asaasPaymentId`,
  e é a callable que grava esse campo.
- **Acompanhamento do dia:** `gerarAcessoDoDia` (o responsável cria) e
  `verAcompanhamento` (pública, sem conta) — quem vai pegar a criança hoje
  acompanha a entrega por um link que morre à meia-noite. O token é
  `AAAA-MM-DD_childId.SEGREDO`: a primeira metade endereça, a segunda é
  comparada contra um SHA-256 guardado em `altPickups/{dia}_{crianca}`. Por
  morar nesse documento, **a revogação já existia** — "Trocar" apaga a
  indicação e o link junto. A régua pura (o que pode ser visto, e se ainda
  vale) é [reguaDoAcompanhamento.js](functions/lib/reguaDoAcompanhamento.js),
  com `npm run testar:acompanhamento`.
  ⚠️ **O caminho público NUNCA escreve**, e o recorte é uma LISTA FECHADA de
  campos, não um spread do doc da criança — o teste procura endereço,
  coordenada, telefone, mensalidade e dado de saúde dentro do JSON, um por um.
- **Outros:** `getShowcase`,
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

**O CONTRATO NÃO NASCE SEM A PARTE CONTRATADA.** `buildContractData` devolve
`null` quando o motorista não preencheu nome, CPF/CNPJ e cidade
([contractService.js](src/services/contractService.js)). Havia um PLACEHOLDER
fictício — "Tio Nino Transporte Escolar", CNPJ `00.000.000/0000-00` — e o
responsável assinava isso com nome digitado, hash SHA-256 e data. Fidelidade
visual num documento com valor probatório era a única coisa que ele não podia
ter.

**E a mãe PASSA quando não há contrato** ([App.jsx](src/App.jsx),
`ParentContractGate`): bloqueá-la por um formulário que o MOTORISTA não
preencheu é punir quem não tem como consertar. Quem é avisado do que falta é
ele, em `/tio/children/:id/contract`.

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

⚠️ **DADO DE SAÚDE DA CRIANÇA: SÓ A RESPONSÁVEL ESCREVE, E NUNCA O
MOTORISTA.** `children.saudeNotas` + `children.saudeConsentidaEm`, e os dois
**andam no mesmo write** — nota sem data é o dado sem o registro do
consentimento, ou seja, o passivo sem a defesa. Apagar também é os dois juntos
(art. 18, VI). O ramo do motorista no `allow update` de `children` permite
qualquer outro campo, então a proibição está escrita LÁ, não na tela.

O campo era DELE: o cadastro pedia *"Alergias, instruções especiais…"* — o app
convidava o motorista a escrever dado sensível de uma criança cuja mãe ainda não
tinha aceitado nada (ela é cadastrada ANTES do convite, e pode nunca resgatá-lo).
A saída não foi confiar num formulário novo: foi **tirar a caneta**.

São **duas camadas que não se substituem** — a declaração dele no cadastro
(`autorizacaoDeclarada`, obrigatória e com data) e o consentimento específico
dela, destacado, na tela dela. O desenho, os textos em rascunho e o que fica de
fora estão em [docs/consentimento-saude.md](docs/consentimento-saude.md), que
tem prazo de validade: quando a redação for ratificada, ela vai para o código.

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

**Falta tem teto de 14 dias** — `DIAS_DE_AVISO_DE_FALTA` em
[dominio/rota/faltas.js](src/dominio/rota/faltas.js), com `limiteDoAviso()` para
a data. Plano muda, ninguém desmarca, e no dia o motorista não passa na porta. O
HISTÓRICO anda meses pra trás (`/pai/faltas`); o aviso continua cabendo em duas
semanas. O teto **e** a conta são puros e testados (`npm run testar:faltas`) —
aviso marcado pra frente nunca é somado como falta.
⚠️ O teto era literal de JSX escrito DUAS vezes na
[AbsenceSheet](src/components/absences/AbsenceSheet.jsx) (o `max` do campo e o
texto ao lado), e esta linha afirmava que "a conta é testada" misturando as duas
coisas: a contagem era testada, o teto não. Mudar um e esquecer o outro produz
uma tela que oferece 21 dias e diz 14.

⚠️ **O "ESQUECI A SENHA" DEPENDE DE UM CAMPO DO CONSOLE, NÃO DO CÓDIGO.**
`actionCodeSettings.url` **não é o destino do link** — o SDK o converte em
`continueUrl` (`request.continueUrl = actionCodeSettings.url`, e a doc dele
confirma). Quem decide o destino é o **Action URL** em
Authentication → Templates, cujo padrão é
`<projeto>.firebaseapp.com/__/auth/action`.

Enquanto ele estiver no padrão, a tela [AuthAction.jsx](src/pages/AuthAction.jsx)
— que é completa e boa — é **código morto**, e a pessoa redefine a senha num
domínio sem marca que parece phishing. Um comentário afirmava o contrário, e foi
o que fez este fluxo passar por pronto.

O `continueUrl` aponta para `/login` (não para `/auth-action`, que sem `oobCode`
cai no ramo de erro e imprimia "Link inválido" **depois de a senha ter sido
trocada com sucesso**). A invariante está travada em `npm run testar:auth`:
*nenhum `continueUrl` do projeto pode apontar para uma rota que exige
`oobCode`*.

**E A TELA FOI DESENHADA PARA A DESCONFIANÇA, não para a usabilidade**
(09/09/2026). Quem chega nela perdeu a senha, clicou num link de e-mail e vai
digitar uma senha nova numa página que nunca viu — a forma exata de um golpe.
Layout bonito não responde a isso; o que responde é a tela dizer o que uma
página falsa não consegue dizer: o **domínio** lido do `location` (nunca escrito
à mão — constante mentiria numa cópia hospedada em outro domínio), o **e-mail
mascarado** (`mascararEmail` em [formatters.js](src/compartilhado/formatters.js),
com número FIXO de pontos: um ponto por caractere devolveria o comprimento do
endereço), o **escopo** do link de uso único, a **saída** para quem não pediu, as
**regras** marcadas antes do erro, e a **identidade do controlador** — razão
social e CNPJ de `COMPANY_INFO`, nos quatro estados, porque a tela de "link
inválido" é onde ela mais desconfia.

⚠️ **Nada de "conexão segura", "criptografado" ou "protegido" genérico.** Toda
frase da tela é conferível: o link é de uso único porque o `oobCode` é
consumido, e a senha não muda sozinha porque nada acontece sem o formulário.
Os blocos 7 e 8 de `testar:auth` travam as duas coisas — e o 8 tem um
descomentador com **sonda positiva**, porque a primeira versão dele reprovou o
COMENTÁRIO que explica a decisão.

**Erro de autenticação tem QUATRO contextos**, não três
([authErrors.js](src/dominio/identidade/authErrors.js)): `entrar`, `criar`,
`link` (ela CLICOU num link e ele falhou) e `reset` (ela PEDIU um link e o envio
falhou). As três telas que pedem o link usavam `'entrar'`, que responde "Email
ou senha incorretos." a `user-not-found` — uma frase sobre senha num momento em
que ela não digitou senha nenhuma. `reset` também não confirma se a conta
existe: é a mesma discrição de `entrar`, pelo mesmo motivo.

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

⚠️ **E QUEM APARECE NA BUSCA É A LANDING, NUNCA O APP** (09/09/2026). Medido
no Google: `alobuzinou.com` — a tela de LOGIN — aparecia **acima** de
`alobuzinou.com.br`. Os dois tinham o mesmo `<title>` e competiam pela mesma
busca; quem procurava o produto caía numa porta trancada. O app declara
`noindex, follow` no [index.html](index.html) e a landing ganhou título com a
CATEGORIA (marca sozinha só é achável por quem já sabe o nome) mais um
`JSON-LD` de `Organization` com razão social e CNPJ.

⚠️ **A ARMADILHA, e ela é contraintuitiva: `Disallow: /` NÃO tira da busca.**
Ele impede a LEITURA — e o resultado é a URL indexada sem descrição, que era
exatamente o estado do `.com.br` ("o site não nos permite exibir a
descrição"). Para SAIR é o contrário: deixar rastrear e declarar `noindex`.
Por isso [public/robots.txt](public/robots.txt) do app libera tudo, e por isso
ele **não** bloqueia `/convite/` — bloqueado, o buscador listaria a URL crua
**com o código do convite dentro dela**. `npm run testar:busca` trava as duas
metades juntas, porque separadas cada uma parece um erro.

⚠️ E o `JSON-LD` duplica razão social e CNPJ à mão: a landing é HTML estático
sem build e não alcança o `developer.js`. O teste compara os dois — sem isso
seria a quarta versão da identidade da empresa.

**Decidir mora FORA do app; entrar mora dentro dele.** Desde 06/09/2026 `/`
não é mais a home do motorista — ela foi APAGADA (eram 1090 linhas, e eager no
bundle de entrada). Quem chega em `alobuzinou.com` cai no `/login`, e quem
quer conhecer o produto está em `alobuzinou.com.br`, a landing estática, que
não passa pelo bundle do app. `SITE_INSTITUCIONAL` em
[config/vitrine.js](src/config/vitrine.js) é o único endereço dela no código —
sair do app exige `<a href>`, porque `<Link>` monta caminho relativo e
devolveria a pessoa pro login.

⚠️ **MAS CONVITE NÃO VAI PRA LANDING** (09/09/2026). As duas mensagens que a
plataforma escreve para quem ainda não tem conta — o convite do motorista ao
colega ([TioIndicar](src/pages/tio/TioIndicar.jsx)) e o pedido da responsável
ao motorista dela ([pedidoAoMotorista.js](src/marca/pedidoAoMotorista.js)) —
mandavam para `SITE_INSTITUCIONAL`, ou seja, punham uma apresentação na frente
de quem já tinha sido apresentado por alguém de confiança. O pedido dela era o
caso visível: dizia *"você cria a sua conta aqui"* e linkava a página onde não
se cria conta. Agora vão para `CADASTRO_DE_MOTORISTA`
([config/vitrine.js](src/config/vitrine.js)), e o convite carrega
`utm_source=indicacao` — **`DriverSignup` lê a UTM da PRÓPRIA URL**, então
indicação que passa pela landing chega ao painel do dono como tráfego solto.
O caso que segura isso está em `npm run testar:selo`, e são DOIS: o endereço
certo estar lá, e a landing **não** estar.

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

**A COLUNA DIREITA DO LOGIN TEM FUNDO desde 09/09/2026, e ele TROCA DE
ASSUNTO com a aba** — [FundoDoLogin](src/components/auth/FundoDoLogin.jsx), com
as nove peças em [marca/fundoDoLogin.js](src/marca/fundoDoLogin.js). Era uma
superfície branca com um cartão no meio, e o login é a tela **mais acessada do
produto** (mais que a landing): aquele vazio era o maior espaço de produto do
app sem nada dentro. Três cartões por assunto — o dia rodando (entrar), o
caminho até funcionar (criar conta), o lado da responsável (`/first-access`).

⚠️ **Os cartões são RECRIADOS, nunca print de tela.** Print de produto real
levaria nome e rosto de criança para uma página pública, que é dado sensível.
Iniciais em pastilha e primeiro nome fictício.

⚠️ **O QUE NÃO PODE APARECER LÁ É TESTE, NÃO LEMBRETE** (`npm run testar:fundo`,
56 casos). Cada item da lista é um número que EXISTIU no app e saiu por decisão:
o "a receber" (previsão no dia 3 é quase o faturamento inteiro), a contagem de
inadimplentes (virou nome e valor), qualquer ETA em minutos (era linha reta ÷ 18
km/h). Fundo que mostra a interface errada é pior que fundo abstrato — ele
promete uma tela que não existe. As frases que o app já diz são **copiadas da
fonte**, e o teste confere que elas ainda existem lá.

⚠️ **E O CARTÃO DO FORMULÁRIO ENCOSTA À DIREITA — isso é geometria.** Centrado,
sobram ~159px de cada lado e nenhum cartão de fundo cabe sem ser cortado; o
problema é o eixo X e nenhum ajuste de altura resolve. O fundo só liga onde a
conta fecha: **1340px** no login (cartão de 380) e **1500px** no
`/first-access` (cartão de 520). Abaixo disso ele não existe, em vez de ser
apertado. `testar:fundo` **refaz a conta a partir dos arquivos** — alargar o
formulário falha no teste em vez de aparecer como cartão cortado do outro lado
da tela. Foi ele que pegou o fundo ligando antes de o cartão se mover.

**A aba "Criar conta" NÃO cadastra ninguém — ela faz UMA pergunta**, e manda
pra `/quero-fazer-parte` (motorista) ou `/first-access` (responsável). Ela já
pediu o código do convite, e era erro: código é coisa de responsável, e o
motorista — que é o usuário principal — lia aquilo como "preciso de código pra
me cadastrar". As duas portas têm **pesos diferentes de propósito**: a do
motorista é cheia e vem primeiro, a da família é de contorno. Elas viajam com
`state: { de: 'escolha' }`, e é isso que faz o "Voltar" das duas telas
retornar pra bifurcação em vez de jogar pra fora do app quem estava
escolhendo.

**As duas telas de cadastro são de MONITOR também**, com `data-painel="web"`:
o motorista decide sentado, e a responsável que perdeu o link volta pelo site.
As formas são OPOSTAS, e isso vem da landing — ele está comprando (denso,
escuro, campos em pares), ela está sendo tranquilizada (claro, arejado, uma
coluna). O empilhado do celular continua sendo o desenho principal das duas.

⚠️ **A ENTRADA DO RESPONSÁVEL É O LINK, E SÓ ELE, desde 09/09/2026.** Ela é
inteira do [Invite.jsx](src/pages/Invite.jsx): `/convite/:codigo` lê o código
da URL, chama `redeemInvite` e leva pro `/pai`. **Esse caminho não passa pelo
`/first-access`** — então quem cai naquela tela é, por definição, quem NÃO tem
o link.

E a única coisa que ela oferecia a essa pessoa era **digitar um código de 8
caracteres**, que ela quase sempre também não tem: link e código viajam na
MESMA mensagem do WhatsApp, e se a conversa sumiu sumiram os dois. A tela
pedia a chave a quem tinha acabado de perder o chaveiro.

O campo saiu, e com ele o aceite legal, o Google e o e-mail/senha daquela tela
— sem código não há convite pra resgatar. No lugar entrou **o pedido ao
motorista** ([pedidoAoMotorista.js](src/marca/pedidoAoMotorista.js)): a
mensagem que ela manda pelo WhatsApp, à vista na tela antes de enviar, porque
ninguém manda texto que não leu.

Duas razões, e a segunda é a que decide: o pedido devolve um **link novo que
funciona**, contra a chance de errar uma letra num código lido por telefone; e
ele serve o caso que o campo nunca serviu — **o motorista que ainda não usa o
app**, onde não há convite perdido porque nunca houve convite.

⚠️ **O que isso fecha:** quem tem só o código anotado e perdeu o link perde a
entrada digitada. Decisão do dono. **O MECANISMO CONTINUA INTEIRO** —
`redeemInvite` aceita `inviteCode`, `codigoDoTexto` ainda lê código de
qualquer texto, `isValidInviteCodeFormat` ainda valida. Saiu a TELA, não a
porta. O bloco 9 de `npm run testar:auth` guarda as três metades: a tela não
cria conta, o link continua criando, e nenhuma outra tela promete a entrada
por código que o destino não oferece — a bifurcação do login dizia "um link ou
um código" e foi corrigida junto.

**O código do convite se lê de qualquer texto** — `codigoDoTexto` em
[generateInviteCode.js](src/dominio/identidade/generateInviteCode.js) aceita o
link inteiro (`/convite/TNAB23CD`), a mensagem inteira do WhatsApp e o código
digitado letra por letra. A máscara sozinha devolvia `HTTPSALOB` pra quem
colava o link e o app dizia "código inválido" com o código certo na mão.

⚠️ Isso continua valendo para o LINK, que é onde `codigoDoTexto` roda hoje —
**não há mais campo digitado no app** (ver a decisão acima). A mensagem que o
motorista manda continua trazendo o código escrito além do link: ele não serve
mais para ela digitar, serve para ela conferir que o link é daquele convite, e
para o dia em que o campo voltar.

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

[src/config/vitrine.js](src/config/vitrine.js) — **`PISO_DA_VITRINE` foi a 0 em
06/09/2026, ou seja, DESLIGADO.** Ele era 27: um piso sobre os contadores de
vitrine, que mostrava o piso quando a base era menor. Foi decisão de produto
tomada com o ponto do CDC na mesa, e o argumento continua escrito no arquivo —
o que a desfez foi outra coisa: com base zero, a tela mostrava 27 responsáveis
que não existem, e número inventado é passivo em qualquer conversa em que
alguém possa abrir a página e perguntar de onde ele vem.

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

   ⚠️ **A legenda do mapa é o QUARTO endereço**, e a exceção que mais custou:
   os três pinos (casa/perua/escola) eram hex cru em
   [index.css](src/index.css) — `#f59e0b` é exatamente o token `perua`. Agora
   são variáveis CSS declaradas num `:root` no topo do arquivo, com o porquê
   ali. Cor de impressão também ganhou nome: `linhaImpressa`, porque
   `borderStrong` não sai numa jato quase sem tinta e linha de assinatura
   invisível é folha inutilizada.

**O painel abre na FILA DO DIA, não num relatório nem numa lista.**
[fila.js](src/dominio/associacao/fila.js) (`npm run testar:fila`) soma degrau,
termômetro, chamados e fechamento numa lista de coisas a fazer hoje, e cada
linha leva à aba onde a coisa se resolve. A aba padrão andou duas vezes pelo
mesmo motivo: "Visão geral" era relatório, e "Motoristas" ainda exigia varrer a
carteira para descobrir com quem falar.

⚠️ **Fila que nunca esvazia deixa de ser lida** — e depois disso não volta a
ser lida no dia em que tiver algo grave. Só entra o que tem ação possível hoje.
Suspenso não entra (quem suspendeu foi o dono). É **uma linha por motorista, a
mais urgente**: quatro sinais viram uma linha com três detalhes, senão o
contador diria "7" onde o dia tem três conversas. Chamado é linha por chamado;
o fechamento do mês é UMA linha para todas as faturas.

**A lista de MOTORISTAS é onde se navega a carteira.** Relatório não
pede ação: abrir na carteira muda a pergunta de "como vai o negócio" (uma vez
por mês) para "com quem eu preciso falar hoje" (todo dia). A
[ficha](src/components/admin/FichaDoMotorista.jsx) reúne plano, contrato,
faturas, nota das famílias e nota interna numa superfície só, com as ações no
TOPO — enterrar o botão no fim da rolagem devolve a tela à condição de
relatório.

**A nota das famílias exige uma JUNÇÃO**, e é por isso que ela mora em
[carteira.js](src/dominio/associacao/carteira.js): `feedbacks` não guarda
`adminUid`, e quem sabe a que motorista uma família pertence é o `adminUid` do
documento dela em `users`. A atribuição usa o campo SINGULAR — somar nos dois
motoristas de uma mãe de perua dupla contaria a mesma opinião duas vezes.

**A proposta lê o DEGRAU e escreve a mensagem daquele degrau**
([proposta.js](src/dominio/associacao/proposta.js)), com os números dele
dentro, e abre o WhatsApp para o dono LER antes de enviar. **Ela nunca inventa
preço** — todo número sai da régua. No dia em que ela oferecer um valor que não
está na tabela, o orçamento voltou com outro nome e sem contrato que registre;
o caminho para isso é a concessão, com motivo e prazo.

**O painel do dono mede a CARTEIRA, não o tamanho da base.** Ele media
`usuarios`, `criancas` e GMV — e nenhum desses é receita da plataforma. Agora
mostra em que degrau cada associado está (**cadastrou → rodou a 1ª rota →
contratou → pagou**, um campo por degrau) e o **MRR**, soma de `precoDoMes` de
quem tem contrato. `receitaPropria` olha pra trás (fatura quitada); o MRR olha
pra frente. A conta é pura em
[carteira.js](src/dominio/associacao/carteira.js) (`npm run testar:carteira`).

⚠️ **Onde o número não existe, a tela diz "—", nunca zero.** No primeiro mês,
0% de conversão pareceria fracasso onde não houve nem tentativa — ninguém saiu
do teste ainda. `resumirCarteira` devolve `null` nesses casos de propósito.

**Quem contratou e parou de pagar conta como BLOQUEADO, não contratado** — ele
continua com `planoId`, e classificá-lo pelo campo inflaria o MRR com dinheiro
que não entra mais. É o jeito mais comum de um painel mentir para o próprio
dono.

**O termômetro de risco não é um score, é uma LISTA DE MOTIVOS** —
[risco.js](src/dominio/associacao/risco.js) (`npm run testar:risco`). Quatro
sinais, e nenhum precisou de coleta nova: parou de rodar (`users.ultimaRota`),
está encolhendo (a série de `criancasAtivas` que cada fatura já guarda),
atrasou (`faturasParceiro` vencida) e famílias reclamando (a nota dele).
Número sem explicação ninguém usa duas vezes: o peso existe só para ORDENAR, e
o que a ficha mostra é a frase que diz por quê.

⚠️ **Ele desempata DENTRO do degrau, nunca por cima.** O degrau é o estado da
relação; o risco é um aviso dentro dele. Mandar na ordem geral misturaria um
contratado que parou de rodar com um teste que vence amanhã — e a segunda
conversa tem data.

⚠️ **"Nunca rodou" não é "parou de rodar", e nem entra na conta.** Quem não
iniciou uma rota ainda não entrou; medir risco de saída dele encheria a fila
com quem acabou de se cadastrar. Bloqueado também fica fora, pelo motivo
oposto.

**O sinal de uso é gravado pelo PRÓPRIO motorista** — `users.ultimaRota` e
`users.rotasNoMes`, por `registrarRota` em
[trialService](src/services/trialService.js), no mesmo gesto que liga o
relógio do teste. Eles **não** estão na lista de campos proibidos das rules, e
a troca é consciente: mentir ali faz ele parecer ativo e sumir de uma lista de
acompanhamento; mentir em `trialInicio`, `limiteCriancas` ou `assinaturaAte`
seria não pagar. Um é sinal de saúde, o outro é cláusula — e pôr o sinal atrás
de uma function seria esperar cold start com o passageiro na porta. O caso
`uso` em `testar-regras.mjs` existe para essa decisão aparecer se alguém
mudá-la.

**A PESQUISA DO CARTÃO PERGUNTA, NUNCA ANUNCIA** — `interesses/{uid}_{assunto}`,
no fim do Financeiro do motorista. Sem data e sem "em breve": prometer prazo a
um autônomo e não cumprir custa a confiança que é a visão da empresa, e quem
depende do dinheiro da mensalidade organiza o mês em cima dela. O painel mostra
**quem** levantou a mão, não só quantos — cinco interessados que são os maiores
da base é uma conversa, cinco de uma criança cada é outra. O caminho seria
**split, nunca escrow**, e o risco que a pesquisa mede é o CNPJ: boa parte dos
PSPs o exige para subconta, e o modelo decidiu que o motorista não precisa de
MEI.

**A INDICAÇÃO tem REGISTRO desde 06/09/2026** —
[indicacao.js](src/dominio/identidade/indicacao.js)
(`npm run testar:indicacao`). Antes existia só `users.indicacoesAtivas`, um
número que o dono escrevia à mão, sem nenhum registro de quem indicou quem.

⚠️ **As duas falhas possíveis produzem a MESMA queixa** — *"indiquei e não
recebi"* —, e numa rede de indicação ela viaja mais rápido que a indicação:
o telefone que não bateu, e a indicação que não devia valer. Por isso a
**normalização** e a **auto-indicação** vieram com teste antes de qualquer
tela.

**A chave é o telefone normalizado**, com o nono dígito: `(11) 8765-4321` e
`(11) 98765-4321` são a mesma pessoa, e comparar texto perderia a indicação de
quem ditou o número antigo. Fixo (2–5) **não** ganha o 9 — seria um número que
não existe.

⚠️ **O casamento acontece do lado do DONO, na baixa da fatura.** Casar no
cadastro do indicado exigiria `allow list` de `indicacoes` para qualquer
motorista — uma consulta por `chave` não é escopada por dono —, e isso entrega
os telefones que a base inteira indicou. O momento é o certo de qualquer forma:
a indicação vale quando o indicado **paga**.

**A carência não é burocracia**: sem ela, cinco cadastros de teste dariam
desconto real sobre receita que nunca entrou. E `casarEAtivar` **reconta**
em vez de incrementar — o webhook e a baixa manual podem quitar a mesma fatura,
e um incremento duplicado ficaria errado para sempre.

**O CONVITE A INDICAR APARECE EM QUATRO TELAS, E A LISTA É FECHADA POR
TESTE** — [ConviteParaIndicar](src/components/tio/ConviteParaIndicar.jsx), em
`/tio/planos`, `/tio/taxa` (só com a fatura **quitada**), `/tio/selo` (só
depois de pedido) e na confirmação do contrato. O desconto estava inteiro no
código e **a oferta não existia**: o único convite era uma linha no fim da
rolagem do Início, dentro de uma folha.

⚠️ **O NÚMERO É A DIFERENÇA REAL, NUNCA "5% DA SUA CONTA".**
`valorDaIndicacao` ([planos.js](src/dominio/associacao/planos.js)) devolve
quanto a PRÓXIMA indicação tira, com o piso já dentro — para quem tem 8
crianças e 30% travado, a 7ª vale sessenta centavos e a 8ª vale zero. E ela
devolve `null` sem plano contratado: durante o teste a fatura é isenta, então
o convite fala no futuro e sem número. ⚠️ O parâmetro `plano` **não tem
padrão**, ao contrário de `precoDoMes` — com o padrão herdado, o guarda ficava
inalcançável e a tela prometia R$ 5,90 a quem não paga nada.

⚠️ **ONDE ELE NUNCA APARECE É TESTE, NÃO LEMBRETE** (`npm run testar:indicacao`
varre `src/` e compara com a lista de permitidos): app da família, durante a
rota, sino nos 90 dias, e **tela de cancelamento**. O mesmo bloco trava que o
INDICADO não ganha desconto por ter sido indicado — origem inventada em
`users.descontos` é ignorada, com sonda positiva ao lado.

⚠️ **O DESCONTO PRECISA CAIR, E ATÉ 10/09/2026 NÃO CAÍA.**
`users.indicacoesAtivas` só era escrito PARA CIMA: `casarEAtivar` reconta, mas
só quando OUTRA indicação do mesmo indicador ativa, e **nenhum caminho do
projeto baixava o número quando o indicado cancelava** — o desconto sobrevivia
ao cliente que o justificava. Enquanto se cogitou dar prazo à indicação, o
calendário resolveria isso de lado; sem prazo, este é o único limite que
existe.

Quem fecha isso é `reconciliarIndicacoes`, em
[indicacao.js](src/dominio/identidade/indicacao.js) com espelho em
[functions/lib/indicacao.js](functions/lib/indicacao.js), chamada por
`fechamento.js` **antes** de emitir as faturas do mês — `fecharFaturaDe` lê
`indicacoesAtivas`, então reconciliar depois gravaria o número velho num
documento já entregue. O quarto estado é `ESTADO.ENCERRADA`, e ele é
**reversível**: se o indicado voltar a pagar, a indicação volta a valer.

⚠️ **ATRASO NÃO DERRUBA, SAIR DERRUBA.** O critério de "ainda é cliente" é
grosso de propósito — tem plano e não está suspenso. Usar o estado fino da
conta faria o desconto piscar de mês em mês por causa de uma fatura atrasada,
e desconto que oscila é tão ruim de explicar quanto desconto que não cai.

⚠️ E a contagem devolvida inclui **os zeros**: sem uma entrada explícita para
quem perdeu a última indicação, o gravador nunca aprenderia a zerar ninguém e
o contador ficaria parado no valor antigo — o mesmo bug reaparecendo pela
porta da escrita.

**Dois indicaram a mesma pessoa? Vale quem indicou primeiro.** Premiar os dois
pagaria 20% por um cliente.

⚠️ **A ESCOLHA DE QUEM GANHA O CRÉDITO VIVE NO DOMÍNIO E TEM ESPELHO NO
SERVIDOR** — `escolherParaAtivar` em
[indicacao.js](src/dominio/identidade/indicacao.js), copiada em
[functions/lib/indicacao.js](functions/lib/indicacao.js), com
`npm run testar:indicacao` comparando as duas **caso por caso**. Foi a segunda
vez que este projeto precisou de espelho (a primeira é a régua de preço em
`contratacao.js`), e pelo mesmo motivo: o deploy das functions não alcança
`src/`.

⚠️ **E O CASAMENTO ACONTECE NOS DOIS CAMINHOS DE BAIXA.** Ele existia só no
CLIENTE, chamado depois da baixa manual — então ligar o gateway apagaria o
gatilho da indicação para **100% dos indicadores, em silêncio**: ninguém
receberia erro, o desconto simplesmente não apareceria na fatura seguinte.
[casarIndicacao.js](functions/lib/casarIndicacao.js) roda no webhook, DEPOIS do
commit e fora do lote — o desconto de um terceiro não pode fazer a baixa da
fatura falhar.

**SÃO DOIS SELOS, com economias OPOSTAS** — e tratá-los como um só foi o que
confundiu a conversa inicial. O **adesivo** de rua diz "usa Alô Buzinou", todo
associado tem, e se ganha **pedindo**
([adesivo.js](src/dominio/associacao/adesivo.js)). O **certificado** diz
"alvará conferido · 09/2026", só quem enviou e foi aprovado tem, e se ganha
**conquistando** ([verificacao.js](src/dominio/identidade/verificacao.js)).
Valor não vem de preço, vem de exigência: pago, o selo parece abusivo;
automático, não vale nada. `npm run testar:selo`.

⚠️ **NENHUM DELES AFIRMA SEGURANÇA, e isso é TESTE, não lembrete.**
[promessas.js](src/marca/promessas.js) guarda as raízes proibidas e o teste bate
cada string impressa contra elas — a plataforma não inspeciona van, não confere
CNH e não treina ninguém. "Certificado" está na lista com exceção só para o
painel: na tela da família a palavra vira "a plataforma certifica que este
motorista é bom".

⚠️ **A ausência do selo NÃO é um alerta.** Quem não enviou o alvará não é
suspeito — o modelo parte de que a família já conhece o motorista offline, e a
plataforma não apresenta ninguém a ninguém. Tem selo, aparece; não tem, não
aparece nada. É a decisão 6: pressão social, nunca técnica.

⚠️ **Alvará vencido deixa de ser "verificado" sozinho** (`alvaraValidade`
decide, não o campo de estado) — senão o selo diria "conferido" três anos
depois. Por isso a fila avisa 30 dias antes: ele perderia o selo sem ninguém
ter dito nada.

**ALVARÁ, NÃO CNH — e o motivo é técnico.** Para emitir o alvará a prefeitura
já exigiu CNH D, curso, antecedentes e vistoria; conferir o alvará apoia a
plataforma numa conferência que o poder público já fez, **sem guardar documento
de identidade**, que se vazar é material de fraude pronto. Storage em
`alvaras/{uid}` — o único caminho não legível por qualquer logado.

**O ENDEREÇO DO ADESIVO MORA EM `pedidosAdesivo/{uid}`**, e não em `users` nem
em `taxaParceiros`. `users` as famílias leem (e a perua sai da casa dele);
`taxaParceiros` guarda a nota interna do DONO sobre ele, e rules não escondem
campo. Foi essa coleção que tornou possível o estado aparecer nos dois lados
sem vazar nada.

⚠️ **A trava do selo nas rules tem forma diferente das outras**: aqui não dá
para proibir a escrita — ele precisa poder dizer "enviei". A rule prende o
**valor**, e ele só escreve `verificacao: 'enviada'`. Selo que o próprio se dá
é propaganda.

⚠️ **AS LINHAS DO CONTRATO PRECISAM FECHAR COM O TOTAL**, e essa invariante é
testada (`npm run testar:contrato`). Ela nasceu de um bug: a concessão descia o
`valorMensal` e nenhuma linha a explicava, porque `montarContrato` não copiava
`descontoConcessao` — o documento saía se contradizendo, assinado com hash e
data. O teste que pega isso não é "a concessão aparece", é a soma fechar: essa
pega o próximo desconto que alguém esquecer de listar.

**A CONCESSÃO é a porta pela qual o orçamento pode voltar, e prazo e motivo
são a tranca** — [concessao.js](src/dominio/associacao/concessao.js)
(`npm run testar:concessao`). Ela existe porque retenção real precisa de
exceção: um associado bom, num mês ruim, pede desconto, e "não" é a resposta
que o faz cancelar. O que não pode é a exceção virar a regra sem ninguém ter
decidido isso.

⚠️ **O REGISTRO E O EFEITO SÃO CAMPOS DIFERENTES, E VÃO NO MESMO LOTE.**
`users.concessoes` guarda tipo, prazo, motivo, quem concedeu e quando;
`users.descontos` (ou `users.isencaoAte`) é o que `precoDoMes` e `fecharFatura`
leem — elas cobram, não julgam, e não sabem o que é uma concessão. Separados,
existiria a concessão registrada que nunca chega na fatura, ou o desconto que
ninguém explica. Mesma amarra de `planoId` + `limiteCriancas`.

**Uma concessão por vez: a nova SUBSTITUI a anterior.** Empilhar é como o preço
desanda sem decisão — 30% em março mais 30% em agosto, e a ficha diz 30%
enquanto a fatura cobra 60%. A ficha mostra as condições vigentes com a espécie
de cada uma (**régua** ou **exceção**), e sem essa coluna "50% de fundador" e
"50% de concessão" parecem a mesma coisa.

**E existe um CONTADOR DE FUNDADORES**, que não existia: são 1 vitalício + 12
pela metade e nada os somava, então dava para conceder o 14º sem perceber — e o
vitalício não expira. `contarFundadores` deixa `restam` ficar **negativo** de
propósito: zerar em zero esconderia justamente o caso que ele pega.

**A data decide, o contador contextualiza.** `ultimaRota` não desanda;
`rotasNoMes` é contador, e contador desanda — `criancasAtivas` já ensinou isso
aqui. Por isso o risco se resolve pela data, e o contador só aparece na ficha:
"roda todo dia" e "roda às terças" são operações diferentes, e a última rota
sozinha não distingue as duas.

**O painel do dono tem piso de 12px.** O resto do app é de bolso, lido a 30cm;
[/admin](src/pages/admin/AdminPanel.jsx) é de mesa, e a 60cm o mesmo 11px tem
metade do tamanho aparente. A largura já tinha sido corrigida lá, a escala
não. Não há sistema tipográfico próprio — é só um piso, e o
[ContratoDoc](src/components/admin/ContratoDoc.jsx) é a exceção porque é
impresso.

**Segurança mora nas rules, não na interface.** Esconder botão é UX; o que
impede é [firestore.rules](firestore.rules). Toda mudança de permissão precisa
passar por lá — e `npm run testar:regras` cobre o payload real (233 casos, com
atores **anônimo**, **`novato`** (motorista recém-cadastrado e sem vínculo) e um
**recém-inscrito**, que exercita o payload de `inscreverAssociado` como
cliente). Ele roda fora do CI porque precisa do emulador, então rode à mão antes
de publicar rule:
`firebase emulators:exec --only auth,firestore "node scripts/testar-regras.mjs"`.

`testar:storage` são **37 casos** e precisa dos TRÊS emuladores:
`firebase emulators:exec --only auth,firestore,storage "node scripts/testar-storage.mjs"`.
Ele cobria 3 dos 6 caminhos até 09/09/2026 — `alvaras/` (o único não legível por
qualquer logado, que é a afirmação mais forte do arquivo), `paymentReceipts/` e o
catch-all não tinham um único caso. Os dois passavam em 09/09/2026.

**A TRANCA MORA NO `isAdmin()` DO FIRESTORE** — desde 06/09/2026 ele nega
também quem está com o teste vencido e sem assinatura, além de `suspenso`. Tela
não é tranca: o `GuardaDaConta` esconde o painel, mas o token continua válido e
uma aba antiga escreve igual.

⚠️ **`storage.rules` tem uma CÓPIA de `isAdmin()` e ela checa só `suspenso`** —
assimetria **decidida** em 09/09/2026, escrita nos dois arquivos e **travada por
teste** (bloco "A CONTA" em `testar-storage.mjs`). Upload não é cláusula: quem
está bloqueado não escreve nada no Firestore, então foto ou comprovante que ele
suba fica inerte. E replicar o prazo ali erra fácil no caso que importa —
`trialInicio` AUSENTE significa "o relógio nem começou" e tem que PASSAR, senão
a primeira foto do motorista recém-cadastrado é recusada. Os dois casos
positivos existem para que a "correção" errada falhe no teste em vez de aparecer
no primeiro cadastro real.

⚠️ **A SUSPENSÃO, essa vale nos dois** — e `marcaLogos` era a exceção que
ninguém media: a rule era `isSignedIn() && auth.uid == uid`, então um motorista
suspenso continuava trocando a imagem que aparece no cabeçalho de todas as
famílias dele. Achado por caso de teste novo, não por leitura.

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
outros; foi assim que a chave PIX, a trilha de pagamento, o prêmio e os leads
de família ficaram legíveis por quem não devia.

**O responsável alcança o doc do motorista por `users.adminUids`** — a LISTA,
mantida por `arrayUnion` no `redeemInvite`. O campo singular `adminUid` guarda
só o PRIMEIRO motorista, e a interface resolve pelo `adminUid` da criança
ATIVA: escopar só pelo singular faz a mãe com filhos em peruas diferentes
perder a chave PIX do segundo filho, em silêncio.

⚠️ **Quem escopa por motorista da família chama `ehMotoristaDaFamilia()`** — o
helper nas rules que testa os DOIS campos. Ele existe porque o idioma solto
falhou em três lugares: quando o `allow get` de `users` foi corrigido para
aceitar a lista, `liveLocation`, `notifications` e `agendaEntries` ficaram
atrás. A mãe de perua dupla perdia o MAPA do segundo filho, nenhum aviso
passava entre ela e o segundo motorista, e os recados de escola dele
desapareciam do caderno — três telas, um campo, nenhum erro visível. Os quatro
casos que guardam isso estão em `testar-regras.mjs`.

⚠️ **O `allow create` de `users` é lista de PERMITIDOS; o `update` é de
PROIBIDOS.** Confundir os dois fechou a porta da frente do produto: `origem`
nasceu no `inscreverAssociado` e não subiu para o `hasOnly` do create, e TODO
cadastro de motorista passou a devolver `permission-denied` — com a conta do
Auth já criada e a pessoa presa numa sessão sem documento. **Campo novo no
payload de inscrição entra na whitelist na MESMA alteração.** O caso que
exercita o payload real como CLIENTE está em `testar-regras.mjs`, bloco "A
PORTA DA FRENTE" — antes disso todo motorista do teste era semeado com Admin
SDK, que ignora rules, e o create nunca era medido.

⚠️ **O motorista escreve no doc da família dele só em `name`, `email` e
`phone`.** O ramo era escopado por `adminUid` e SEM lista de campos, então
`termsVersion` (aceite de LGPD escrito por terceiro) e `fcmTokens` (acrescentar
o próprio = receber os pushes dela) passavam — sondado no emulador, HTTP 200 nos
dois. Campo novo no doc do responsável não entra ali por padrão.

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

**O TOUR GUIADO CITA A LANDING, e as duas metades disso são teste**
([interactiveSteps.js](src/components/tutorial/interactiveSteps.js),
`npm run testar:tutorial`). Cada passo do motorista carrega em `cita` a frase
do site que ele fecha — *"a rota do dia pronta, na ordem dos horários"*, *"sem
caderno, sem planilha e sem cobrar de boca"* — e o balão a mostra citada, acima
do texto. Dizer a mesma coisa com outras palavras faz o app parecer um segundo
produto, e a promessa parecer propaganda. A landing é HTML estático sem build,
ninguém edita os dois juntos: o teste confere que cada `cita` existe de verdade
em [landing/index.html](landing/index.html).

⚠️ **E `interact: true` SÓ ONDE O TOQUE NÃO CUSTA NADA A NINGUÉM.** Quatro
âncoras são iluminadas e nunca tocadas: `start-route` (liga o GPS, publica a
perua e **escreve `trialInicio`** — o toque do tutorial gastaria o primeiro dia
do teste), `avancar-status` (muda o estado da criança e avisa a família),
`buzinar` (faz o celular de um responsável tocar) e `lista-pagamentos` (dá
baixa em dinheiro). A lista está travada no teste, com sonda positiva: pôr
`interact` num deles falha a bateria em vez de aparecer como rota ligada
sozinha no primeiro acesso de alguém.

⚠️ **A âncora órfã SAIU da seção 12 de `testar-horarios`** e mora no teste
novo, que varre `src/` inteiro. A lista de sete arquivos de tela escrita à mão
reprovou quatro âncoras que existiam — invariante que depende de alguém lembrar
de acrescentar um arquivo não é invariante.

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
