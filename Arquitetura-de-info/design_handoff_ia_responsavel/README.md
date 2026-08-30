# Handoff — Arquitetura de informação do RESPONSÁVEL (`parent`)

Repositório: `Feacleto/Projeto-WEABAPP_ESCOLAR` · branch `WebApp-oficial-v1`
Escopo: a porta `src/pages/Familia.jsx` e o painel `src/pages/pai/*`.
**Fora do escopo:** tudo do motorista (`/tio`) e do dono (`/admin`). Não encostar.

Referência visual: `Alo Buzinou - IA do Responsavel.dc.html` neste pacote — protótipo em HTML, abre no navegador. 5 artboards: jornada, arquitetura, telas, antes/depois, estado de medo. **Não é código de produção.**

---

# PARTE 0 — DOIS BUGS. FAÇA ESTES PRIMEIRO.

Nada de design vale nada até estes dois subirem.

## 0.1 — O painel do responsável não abre. É tela branca. 🔴

`src/pages/pai/PaiDashboard.jsx`. Hoje o arquivo tem, nesta ordem:

```js
const estadoDoDia =
  status === 'delivered' || absence?.type === ABSENCE_TYPES.FULL
    ? 'encerrado'
    : routeActive || status === 'onboard'
    ? 'acompanhando'
    : 'esperando';
const status = getEffectiveStatus(child);   // ← declarada DEPOIS de ser lida
```

`const` não sofre hoisting de valor: ler `status` antes da linha de declaração lança
`ReferenceError: Cannot access 'status' before initialization` e o componente morre no
primeiro render. **Conserto:** mover `const status = getEffectiveStatus(child);` (e o
`const phrase = statusPhrase(...)` que depende dele) para **antes** do `estadoDoDia`.

```js
const status = getEffectiveStatus(child);
const phrase = statusPhrase(status, routeActive, new Date().getHours());
const estadoDoDia = /* ...igual... */;
```

Confirme abrindo `/pai` com uma conta de responsável antes de tocar em mais nada.

## 0.2 — A estimativa de chegada proibida voltou. 🔴

`src/utils/routePresence.js` tem `estimateMinutes(distanceKm, speed)` com
`FALLBACK_KMH = 18` sobre distância **em linha reta** (haversine) — exatamente a conta
que foi arrancada do `HorarioDoDia`. O `PresencePanel` estampa dela
`"Chega em uns 7 minutos"`, no bloco de maior confiança da tela dela.

**Conserto:** no estado `MOVING`, trocar o título por fato medido.

```js
// ANTES
title: etaMinutes != null
  ? `Chega em uns ${etaMinutes} ${etaMinutes === 1 ? 'minuto' : 'minutos'}`
  : 'Perua em rota',

// DEPOIS — distância é medida; minuto é palpite, e ela desce com a criança no palpite.
title: distanceKm != null
  ? `A perua está a ${formatDistance(distanceKm)} daqui`
  : 'Perua em rota',
detail: 'Avisamos quando estiver perto.',
```

`estimateMinutes` sai do retorno (`etaMinutes: null`) e, se ninguém mais a usar, sai do
arquivo. **Os toasts de zona continuam** — "chega em uns 5 minutos" ao cruzar 2 km é
outra coisa: é aviso de proximidade por faixa, não número na tela permanente. (Se
quiser rigor total, troque o texto do toast por "está chegando".)

---

# PARTE 1 — `src/pages/Familia.jsx` (a porta)

## 1.1 A lista `DENTRO` promete as coisas erradas

A porta promete mensalidade · recados · avisar falta · contrato. **Nenhuma das duas
coisas que o app lidera** — o horário de hoje e o rastreio — está na lista. O
`HorarioDoDia` diz, com essas palavras, que o horário é "a pergunta que traz o
responsável até aqui".

Substituir `DENTRO` por (mesma estrutura, mesmos 4 itens, nova ordem):

```js
const DENTRO = [
  {
    Icon: Clock,            // lucide
    titulo: 'A hora de estar na porta',
    texto: 'O horário que o motorista combinou com você, para hoje.',
    destaque: true,
  },
  {
    Icon: Bus,
    titulo: 'Onde a perua está agora',
    texto: 'E um aviso no celular quando ela estiver chegando.',
    destaque: true,
  },
  {
    Icon: CalendarX2,
    titulo: 'Avisar que hoje não vai',
    texto: 'Sem depender de alguém ler mensagem no meio da rota.',
  },
  {
    Icon: Receipt,
    titulo: 'A mensalidade e o comprovante',
    texto: 'O que está pago, o que está em aberto, e o PIX pronto.',
  },
];
```

- **Saem** "os recados do motorista" e "o contrato". Os dois continuam existindo no app; nenhum dos dois é motivo de abrir o app amanhã de manhã.
- Continuam **quatro** linhas — a regra do arquivo ("quatro, não seis: é o que ele realmente abre o app pra fazer") fica respeitada.
- `destaque: true` nos dois primeiros → cartão com `border-emerald-300/30 bg-emerald-500/10` em vez do vidro neutro. São as duas linhas que respondem "está tudo certo com meu filho?".
- **Atenção ao texto do rastreio:** "onde a perua está agora", nunca "veja quantos minutos faltam". A porta não pode prometer o número que o painel se recusa a mostrar (ver 0.2).

Ajustar o parágrafo do topo junto: hoje diz "Entre para ver a mensalidade, os recados e o contrato" → **"Entre para ver a hora de hoje e acompanhar a perua. É a mesma conta que você criou pelo link do motorista."**

## 1.2 Mantido da rodada anterior

As correções já especificadas no handoff `design_handoff_portas_publicas` continuam
valendo e não conflitam: rodapé legal (LGPD + Termos + Privacidade + CNPJ, sem "seja
parceiro"), a frase de "ainda não tem conta", e a decisão de fundo/cor. Nenhuma
escassez, em nenhuma hipótese.

---

# PARTE 2 — `src/pages/pai/PaiDashboard.jsx` (o Início)

Estado `esperando` empilha 10 blocos. Vai a 6, e **3 deles são condicionais** — num dia
normal a tela tem 3 blocos e cabe em 320px sem rolar.

## 2.1 O HERO e o HORÁRIO viram um cartão só  ⭐ o movimento principal

**Por quê:** no `esperando`, o hero informa **zero**. "Tá em casa · ainda não saiu" é
dito sobre uma criança que está de pijama do lado dela. Ele custa ~200px do topo pra
contar o óbvio e empurra a hora — a única coisa que ela precisa ler de longe, com a
criança no colo — pra baixo da dobra num aparelho de 320px.

Novo componente, `src/components/dashboard/CartaoDeHoje.jsx`, que substitui o par
`<ChildHero>` + `<HorarioDoDia>` **nos três estados**:

```
┌─ topo: o gradiente de STATUS_GRADIENTS (mantidos como estão) ────┐
│  avatar lg   [TARJA]  NOME                                       │
│              frase de status (statusPhrase, 15px)      chevron →  │
├─ corpo: as duas Linha do HorarioDoDia, sem mudança ──────────────┤
│  [ícone 44] 06:20  entra na perua                                │
│  [ícone 44] 12:35  chega em casa                                 │
├─ pé: uma linha de presença, bg surface ──────────────────────────┤
│  🗺  A rota de hoje ainda não começou. Avisamos quando ela sair.  │
└──────────────────────────────────────────────────────────────────┘
```

Regras:

- **O corpo é o `HorarioDoDia` atual, inteiro.** Não reescrever: mover o `<section>` pra
  dentro do cartão e tirar o `bg-card rounded-3xl shadow-sm` dele (o cartão externo
  passa a ser a superfície). A regra do **horário nunca presumido** e o texto de
  "o motorista ainda não informou" ficam **exatamente como estão**. Idem o bloco da
  posição na fila.
- **`data-tour="hero"` e `data-tour="horario-dia"` mudam de lugar** — as duas âncoras
  passam a viver neste cartão. `data-tour="map"` **também**: ela agora aponta pro pé do
  cartão no `esperando` (ver 2.4). Conferir os passos em `InteractiveTour`.
- **A tarja do momento** (o conserto de "a tela mudou sozinha e nada diz isso"):
  `esperando` → `HOJE` · `acompanhando` → `AO VIVO` (com o pontinho) · `encerrado` →
  `DIA ENCERRADO`. Pílula `bg-white/22`, 10px, `font-extrabold`, `tracking-widest`,
  uppercase. É o mesmo conserto que o "MODO ROTA" fez no painel do motorista.
- **A hierarquia se inverte por estado, e o componente cuida disso:**
  - `esperando` — a frase de status é apoio (15px); os números são os protagonistas (36px).
  - `acompanhando` — a frase sobe (18px) e ganha a segunda linha ("voltando pra casa · chega 12:35"); os números saem do corpo e o corpo passa a ser o rastreio (ver 2.4).
  - `encerrado` — o topo vira o resumo: **"Chegou em casa às 12:41"** + **"3 minutos antes do combinado"**. Essa segunda linha é a frase que compra confiança: o app comparou o prometido com o real e disse que deu certo. Se atrasou, ela diz o atraso com a mesma calma ("12 minutos depois do combinado") — nunca esconde.
- `StateIllustration` continua, com uma exceção em 2.6 (o anel/animação param quando o dado envelhece).

## 2.2 A saudação é apagada

```jsx
// REMOVER inteiro
{estadoDoDia !== 'acompanhando' && (
  <div className="flex items-center gap-3">
    <h1 …>{greet(new Date())}, {firstName}!</h1>
    <FestiveBadge />
  </div>
)}
```

Ele mora no app o dia inteiro e a cortesia cabe; ela fica 20 segundos e a linha empurra
a hora. `<FestiveBadge />` reaparece no cabeçalho do cartão, ao lado do nome da criança
(é lá que ele faz sentido: o aniversário é da criança). `firstName` e `greet` saem se
não sobrar uso.

## 2.3 "Outro responsável vai buscar?" entra no bloco de avisar

**Por quê:** "eu levo", "eu busco" e "a avó busca" são três respostas da **mesma**
pergunta — quem encosta na criança hoje — e hoje moram em dois cartões com cores
diferentes. Juntas, ela lê as quatro opções de uma vez em vez de descobrir a quarta
rolando.

Em `src/components/absences/AvisoRapido.jsx`, o grid passa de `grid-cols-3` pra
`grid-cols-4` e ganha uma quarta pastilha:

```jsx
// 4ª opção — NÃO é um ABSENCE_TYPE. É a única que abre folha, porque precisa
// de nome e telefone de terceiro. As outras três continuam sendo um toque.
{ tipo: 'ALT_PICKUP', icon: UserCheck, titulo: 'Outra pessoa', abreFolha: true }
```

- `abreFolha` → chama `onOutraPessoa()`, que o `PaiDashboard` liga no `setAltPickupOpen(true)`. Nada muda no `AltPickupSheet` nem no `useDailyAltPickup`.
- **Estado aceso:** havendo `altPickup` do dia, a pastilha fica acesa (borda `primary`, fundo `primary/10`) com o primeiro nome embaixo — é o que substitui o cartão violeta de "Hoje quem pega: Vovó Cida".
- Em 320px o rótulo quebra em duas linhas ("Outra / pessoa") a 10px. Nada sai.
- `AltPickupCTA` é apagado do `PaiDashboard`.

**No `acompanhando` o bloco muda de pergunta:** vira "Quem recebe hoje?" com **duas**
opções (Eu busco · Outra pessoa), porque a perua já passou na porta dela. E a última
linha explica a ausência: *"'Não vai' e 'eu levo' saíram: a perua já passou na sua porta
hoje."* — a regra geral está em 2.7.

## 2.4 O painel da perua sai do `esperando` e cresce no `acompanhando`

**Por quê:** no `esperando` ele diz **sempre** a mesma coisa — "a rota de hoje ainda não
começou" — e um bloco cujo conteúdo é "nada aconteceu" ensina a pular blocos. Essa frase
cabe numa linha.

- `esperando` → `presence.title` + `presence.detail` viram a **linha do pé do cartão de
  hoje** (`bg-surface`, 12px, ícone 15px). Tocável, leva pra `/pai/map`. O `PresencePanel`
  não é montado.
- `acompanhando` → um bloco só, dentro do cartão de hoje, com **o `RouteTracker` (4 etapas
  com as horas reais do `ride`, sem mudança) + a linha de presença com distância e
  frescor + chevron pro mapa cheio**. O que hoje são dois blocos (`RouteTracker` e
  `PresencePanel`) passa a ser um.
- `encerrado` → só o `RouteTracker` completo, dentro do cartão. Sem linha de presença: a
  perua continua rodando pra outras famílias, e pra esta o dia acabou.

## 2.5 "Falar com o motorista" sai do corpo e vira ação do cabeçalho

**Por quê:** é a saída de emergência. Emergência não pode **rolar**, e não pode mudar de
lugar conforme o estado do dia — é justamente quando ela está com pressa que ela não vai
procurar. No cabeçalho fica no mesmo pixel em toda tela dela, inclusive em `/pai/faltas`
e `/pai/map`, onde hoje **não existe**.

Em `src/components/layout/Header.jsx`, dentro de `GlobalActions`, **só para
`role === 'parent'`**, um botão antes do sino: ícone `MessageCircle` 18px, tile 34px
`rounded-lg bg-emerald-50 text-emerald-700`, `aria-label="Falar com o motorista"`. O
telefone vem do `useAdminProfile(child?.adminUid)` da criança ativa.

- **Nunca desabilitado.** Sem telefone cadastrado, ele abre a folha do caso 5 (ver 3.5).
- O botão de bloco no `PaiDashboard` é apagado.

## 2.6 O FAB do caderno morre. O caderno fica.

**Por quê:** a metáfora é boa e é do mundo dela — a agenda de papel é o que a família de
transporte escolar já usa. O problema é o botão: pílula violeta com gradiente e chamada
permanente, flutuando acima da barra de abas. São **três ações principais** disputando o
mesmo canto (aba, cartão do dia, FAB), o violeta é uma quarta família de cor que não
existe no `tailwind.config.js` — e já é usada pelo cartão de "outro responsável". Convite
permanente pra uma consulta mensal é o oposto da prioridade dela.

- `PaiNotebookFAB` deixa de renderizar o botão flutuante. O `NotebookView` **fica igual**
  — papel pautado, espiral, margem vermelha, serif e o som ao virar página **continuam**.
  Essa segunda linguagem visual está certa: ela diz "isto é recado, não é o app falando".
  O que não pode é ela estar **do lado de fora**, competindo com a tela que responde
  "onde está meu filho".
- Envelopar o `NotebookView` no `AppSheet` (puxador, X, fecha no toque fora e arrastando
  pra baixo) em vez do `fixed inset-0` próprio. O papel vira o **conteúdo** da folha.
- A porta passa a ser uma **linha no Início**:
  - com recado novo (`esperando` e `encerrado`): `"2 recados novos no caderno"` + subtítulo com o assunto do mais recente + badge de contagem `bg-primary`.
  - sem recado novo (só no `encerrado`): `"Caderno de recados"` / `"Nada novo este mês"`. O caminho precisa existir antes do primeiro recado.
  - no `acompanhando`: **não aparece.** Ela está esperando na porta.
- `location.state.abrirCaderno` continua funcionando (a notificação de recado depende dele).

## 2.7 A regra da ausência explicada

Sempre que um bloco sai por causa do estado, o bloco vizinho leva **uma frase** dizendo
por quê. Quem abre o app às 12h20 e não encontra o botão de avisar falta conclui que o
app *perdeu* a função — não que ela saiu porque a perua já está na rua. Custa uma linha
de 11px e é o que faz os três estados ajudarem em vez de confundirem.

## 2.8 A ordem final, por estado

| | `esperando` | `acompanhando` | `encerrado` |
|---|---|---|---|
1 | `ChildSwitcher` (2+ filhos) | idem | idem
2 | **Cartão de hoje** · `HOJE` · 2 horas + linha da perua | **Cartão de hoje** · `AO VIVO` · rastreio + distância + mapa | **Cartão de hoje** · `DIA ENCERRADO` · resumo + rastreio
3 | Avisar · 4 opções · hoje/amanhã | Quem recebe hoje? · 2 opções | Ausência declarada (se houver)
4 | `AvisosFuturos` (se houver) | — | Mensalidade (se houver)
5 | Recados novos (se houver) | — | Faltas do mês + porta do histórico
6 | Mensalidade (se houver) | — | Caderno · `ReviewNudge` · Notificações · Como usar o app

Nos três estados, no cabeçalho: marca do motorista · **WhatsApp** · sino · perfil.

---

# PARTE 3 — O ESTADO DE MEDO

É o momento em que ela decide se confia no app, e é onde ele mais se cala hoje.
Cinco casos. **Nenhum precisa de dado novo** — todos só comparam o que o app já tem: a
hora combinada, o relógio, e a idade do último registro.

Um componente: `src/components/dashboard/TarjaDeAviso.jsx` — faixa âmbar logo abaixo do
`Header`, acima de tudo, `bg-amber-50 border-b border-amber-200`, ícone 15px, título 12,5px
`font-bold text-amber-900`, corpo 11,5px `text-amber-800`, e **um** botão de ação.

## As quatro regras da tarja

1. **Um fato, não um sentimento.** "Passou 20 min da hora combinada" — nunca "algo pode ter acontecido".
2. **Sempre a alternativa inocente.** "Pode ser só o celular dele sem sinal." Ela precisa ouvir isso antes de imaginar o pior. É o que protege o motorista também: sem a explicação, "não iniciou" soa como "ele não veio trabalhar".
3. **Uma ação, e ela funciona.** Nunca um botão apagado. Se o caminho de dentro do app não existe, diga o que existe fora.
4. **Nada de animação viva sobre dado morto.** Anel pulsante, tarja `AO VIVO` e o mapa **param** quando a informação envelhece.

## 3.1 A perua atrasou

Passou da hora combinada de entrega e a criança não foi marcada. **Hoje: nada** — a tela
das 18h15 é idêntica à das 6h, e o app tem os dois dados.

> ⏰ **Passou 20 min da hora combinada**
> A perua está a 1,2 km daqui, andando. Atualizado agora.
> `[💬 Falar com o Tio Nino]`

Gatilho: `agora > horariosCombinados(child).entrega + 15min` e `status !== 'delivered'`.
**Diz o atraso, não o motivo** — o app não sabe se foi trânsito ou pneu, e inventar
motivo é pior que atrasar.

## 3.2 O motorista não iniciou a rota

Já passou da hora de pegar e o GPS nunca foi ligado. **Hoje** a tela mostra "A rota de
hoje ainda não começou" — a mesma frase calma e cinza das 5h da manhã. Às 6h40, com a
criança na porta, ela é **tranquilizadora e falsa**.

> ⚠ **A rota não foi iniciada, e já passou das 06:20**
> Pode ser só o app dele fechado — muitas vezes a perua está na rua e o rastreamento não. Se ela não chegar, fale com ele.
> `[💬 Falar com o Tio Nino]`

Gatilho: `presence.kind === NO_ROUTE` e `agora > pega + 10min` e sem ausência declarada.

## 3.3 O GPS ficou sem sinal — já está certo

**É o caso mais bem resolvido do app e é modelo pro resto:** `PRESENCE.STALE` tem nome,
cor e telefone à mão ("Sem posição há 8 minutos" + "pode ser só o celular dele sem
sinal"), e o alerta de "chegou!" é bloqueado enquanto a posição está velha
(`lastZoneRef` + `presence.isStale`). **Não mexer.** A única correção do caso é a de 0.2:
tirar o "chega em uns X minutos" do estado saudável.

## 3.4 Passou da hora e ninguém marcou "entregue" — o pior caso

O rastreio fica parado em "Na perua" **com o anel pulsando**, e o topo continua "Tá na
perua · voltando pra casa" — verdade às 17h30, mentira às 18h20. A animação reforça a
impressão de que o app está sabendo.

> 🔺 **O último registro é de 17h32: embarcou na escola**
> Depois disso o app não recebeu mais nada. Isso não quer dizer que algo aconteceu — o motorista pode só não ter marcado a entrega.
> `[📞 Ligar pro Tio Nino]`

- **Único caso em vermelho** (`bg-red-50 border-red-200`, botão `bg-danger`).
- **Único caso em que a ação é LIGAÇÃO** (`href="tel:"`), não WhatsApp: ele está dirigindo e não vai ler mensagem.
- **O anel pulsante para** e a tarja `AO VIVO` é substituída por `SEM ATUALIZAÇÃO`.

Gatilho: `status === 'onboard'`, `agora > entrega + 20min`, e o último marco do `ride`
com mais de 20 min.

## 3.5 O telefone do motorista não está cadastrado

**Hoje** o botão fica desabilitado a 50% de opacidade com o subtítulo "Telefone não
cadastrado". Botão apagado não é resposta: ela toca, nada acontece, e a leitura é "o app
travou". Pior, ela fica sem **nenhum** caminho até o motorista dentro do app —
exatamente no caso 3.4.

**Do lado dela:** o botão desabilitado sai. O ícone do cabeçalho abre uma folha curta:

> ⚠ **O Tio Nino ainda não cadastrou o telefone dele aqui**
> Por enquanto, fale com ele no WhatsApp — é o mesmo número que te mandou o convite. Já avisamos ele pra cadastrar.

**Do lado dele (a outra frente, e é ela que resolve de verdade):** isto entra nas
**pendências** do Início do motorista — *"as famílias não conseguem falar com você pelo
app"*, levando ao perfil. Falta de dado dele não pode virar problema silencioso dela.
É a única linha deste handoff que toca em arquivo do `/tio`, e é uma linha no array de
pendências.

---

# O que NÃO tocar

- **O horário nunca presumido.** É a regra que mais protege a confiança dela. O texto de "o motorista ainda não informou" fica letra por letra.
- **O aviso de falta em um toque, com hoje/amanhã, e desfazer no mesmo botão.** Desenhado pro minuto exato em que ela usa. Só ganha a 4ª opção.
- **`AvisosFuturos`.** Sem ele, promessa feita semana passada nunca é reencontrada e no dia o motorista não passa na porta.
- **O Financeiro inteiro** (`PaiFinance`, `PixBlock`, `ReceiptPicker`): PIX com valor embutido, `txid` = id do pagamento, comprovante anexado no instante em que ela tem o print na mão, chave PIX do motorista **daquela** cobrança, e o total só quando ela deve. É a melhor parte da experiência dela. Ganha só o ícone de WhatsApp no cabeçalho.
- **As duas abas.** Início e Financeiro. Nenhuma terceira.
- **`IncomingCallModal`, `InstallPrompt`, `BirthdayModal`, gates de termos e contrato.**
- **Regras de conteúdo:** sem desconto por falta (o valor é pela vaga, cláusula 7ª), sem escassez de qualquer tipo, sem a inadimplência do motorista com a plataforma, sem estimativa calculada de chegada.

# Aceite

- [ ] `/pai` abre. (0.1)
- [ ] Nenhuma tela dela mostra minuto estimado de chegada. (0.2)
- [ ] A porta `/familia` promete hora e mapa nas duas primeiras linhas; continua com 4.
- [ ] No `esperando`, num dia normal e em **320px**, a hora está visível sem rolar.
- [ ] O cartão de hoje carrega a tarja do momento nos três estados.
- [ ] As 4 opções de "quem encosta na criança hoje" estão num bloco só.
- [ ] O ícone de falar com o motorista está no cabeçalho de **todas** as telas dela, e nunca desabilitado.
- [ ] Não existe mais FAB flutuante; o caderno abre por uma linha e mora num `AppSheet`.
- [ ] Os 5 casos de medo disparam, e o de 3.4 para a animação de "ao vivo".
- [ ] `data-tour` de `hero`, `horario-dia`, `map` e `absence` continuam achando o elemento certo — abrir o tutorial nos três estados.
- [ ] Nenhuma rota nova em `App.jsx`; nenhuma mudança em `firestore.rules`; nenhuma escrita nova no banco.
- [ ] `npm run lint` limpo.

# Atualize o CLAUDE.md

Registrar: o `CartaoDeHoje` como o bloco único do Início do responsável, a `TarjaDeAviso`
e os cinco gatilhos, a saída do FAB do caderno, e a correção do `estimateMinutes` — esta
última é importante porque o arquivo antigo dizia que a estimativa tinha sido removida,
e ela não tinha.
