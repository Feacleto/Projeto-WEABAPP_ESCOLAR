# O programa de descontos

**Reescrito em 10/09/2026**, quando o preço virou linear e a escada virou
vitalícia. Este documento é a fonte do assunto: o que desconta a taxa de
associação, quanto, por quanto tempo, e por quê.

> Ele **substitui** partes da [seção 5](negocio.md#5-como-o-motorista-entra) e
> da [seção 7](negocio.md#7-aquisição-a-comunidade-é-o-canal) do
> [negocio.md](negocio.md). O preço de tabela mora lá; aqui só o que o desconta.

⚠️ **A versão anterior deste arquivo descrevia um modelo que não existe mais** —
faixas de R$ 69 / 149 / 229, escada de 50/30/15 por doze meses, piso de
R$ 34,50 e indicação a 10%. Ela também carregava uma PARTE 2 com a lista de
migração de 07/09/2026, que foi executada e depois substituída. Nada disso
sobreviveu, e meia verdade num documento de dinheiro custa mais que a ausência.

---

## O critério que governa tudo: o teste da fila do portão

Motorista de perua faz fila no mesmo portão todo dia. Um desconto só pode
existir se sobreviver a ser dito em voz alta entre dois deles. Três condições:

1. **O motivo é público** — está escrito, não é segredo entre você e ele
2. **Qualquer um pode reproduzir** — o que o Zé fez, o João também pode fazer
3. **É verificável** — dá para conferir que ele cumpriu

| Desconto | Público | Reproduzível | Verificável | |
|---|---|---|---|---|
| Indicação paga | sim | sim | sim | ✅ |
| Mês em que fechou | sim | sim (todos têm 90 dias) | sim | ✅ |
| Concessão do dono | não | não | sim | ⚠️ exceção, com prazo e motivo |
| Fundador por ordem de chegada | sim | **não** | sim | ❌ aposentado |
| Desconto por *ter sido indicado* | sim | **não** (é sorte de quem você conhece) | sim | ❌ recusado |
| Escada que sobe quando ele recusa | **não** | em segredo | não | ❌ nunca |
| Roleta / sorteio | sim | **não** (é sorte) | sim | ❌ apagada |

Este critério decide sozinho metade deste documento, e vale para qualquer
desconto novo que alguém proponha depois.

---

## O que existe hoje: duas réguas e uma exceção

A conta cabe numa frase:

> **Preço de tabela** (nunca abaixo do mínimo) **menos escada, indicação e
> concessão**, e **nenhuma fatura abaixo de R$ 19**.

Três descontos, e cada um responde a uma pergunta diferente — é isso que
impede que se confundam na cabeça de quem paga e na de quem programa.

| | Premia | Dura | Quem concede |
|---|---|---|---|
| **Escada de fechamento** | uma DECISÃO — contratar cedo | enquanto ele for cliente | automático |
| **Indicação** | um ATO — trazer um colega que paga | enquanto o colega for cliente | automático |
| **Concessão** | nada; é exceção | prazo escrito, máximo 12 meses | o dono, com motivo |

A régua inteira é pura, em
[src/dominio/associacao/planos.js](../src/dominio/associacao/planos.js), com
espelho em [functions/lib/reguaDoServidor.js](../functions/lib/reguaDoServidor.js)
e `npm run testar:gateway` comparando a matriz caso a caso.

---

## 1. O teste é de até 3 meses, e a fatura existe desde o mês 1

A fatura sai **isenta**, com o preço cheio visível e a marcação de teste. Ela
existe para ele aprender a conta antes de ela custar — e para o dia da
cobrança não ser a primeira vez que ele vê o número.

O relógio começa no PRIMEIRO USO, nunca no cadastro
([trial.js](../src/dominio/associacao/trial.js)). Três gatilhos, vale o que
vier primeiro: a primeira rota, o primeiro responsável entrando, a primeira
mensalidade gerada.

## 2. A escada de fechamento — e ela é VITALÍCIA

| Ele fecha no… | Desconto | Dura |
|---|---|---|
| 1º mês do teste | **30%** | enquanto ele for cliente |
| 2º mês | **20%** | idem |
| 3º mês | **10%** | idem |
| depois dos 90 dias | 0% (a conta pausa até ele contratar) | — |
| voltando em até 30 dias | **10%** | enquanto ele for cliente |

**⚠️ O desconto não expira, e foi assim que o problema do mês 13 deixou de
existir.** Não há data para chegar, então não há salto a defender — as três
defesas que o desenho anterior previa (rampa, renovação, mensagem do mês 10)
viraram desnecessárias. Em troca, o custo de sair passou a ser dele: cancelou,
perde o desconto para sempre.

**⚠️ Ela vale só no plano MENSAL.** O anual já custa menos da metade; com a
escada em cima, o mensal com desconto máximo empatava com o anual e o anual
perdia a razão de existir. Foi por isso que ela encolheu de 50/30/15 para
30/20/10 quando o preço caiu.

**Quem decide o degrau é o relógio do SERVIDOR**
([contratacao.js](../functions/lib/contratacao.js), lendo `trialInicio`). No
cliente seria o relógio do aparelho — e mentir nele não adianta um mês, muda
o desconto da conta inteira, para sempre.

**Concedida uma vez.** Quem troca de plano no décimo mês mantém a fração
original; senão trocar ida e volta melhoraria o desconto.

Na lista `users.descontos` ela é `{ origem: 'fechamento', fracao, ate: null }`.
⚠️ **`ate: null` é vitalício e `ate` AUSENTE é descartado** — a distinção é
estrita porque as duas falhas custam coisas diferentes: chave esquecida
virando desconto eterno vaza receita em silêncio; vitalício tratado como
vencido tira do motorista o que foi prometido.

## 3. ⚠️ O preço NUNCA sobe quando ele recusa

Não há segunda oferta em tela nenhuma. Desconto que melhora a cada "não"
ensina a recusar e prova que o preço era teatro — e num grupo em que todo
mundo se fala, ensina isso à base inteira em uma semana.

Isso vale também na **tela de cancelamento**: nenhuma oferta nova aparece ali.
No dia em que "vou cancelar" virar botão de desconto, foi ensinado a todos.

## 4. A indicação — 5% por indicado pagante, sem prazo

**Quem ganha é QUEM INDICA.** `users.indicacoesAtivas` sobe no documento do
indicador, e cada indicado ativo vale **5%** da conta dele, todo mês,
**enquanto o colega for cliente**.

⚠️ **Era 10%, e o problema não era o tamanho.** O desconto sai da fatura de
quem indica e a receita vem de quem foi indicado — dois números sem relação.
Medido contra `precoDoMes`: um motorista de 60 crianças trazendo um de 8
custava **R$ 14,10 por mês, para sempre** (R$ 19,40 se o indicado entrasse no
anual), contra R$ 10 a R$ 20 de infraestrutura por conta. A 5% o pior caso
medido fica em −R$ 2,70 e some assim que o indicado ganha uma criança.

⚠️ **NÃO TEM PRAZO, e isso é decisão.** A alternativa era pagar 12 meses por
indicação. Simulada contra o caso real — indica 5 no mês 3, mais 5 no mês 7, e
cada indicado leva uns 4 meses para pagar a primeira fatura —, ela produz
**doze mudanças de fatura em 30 meses, seis delas para cima**. É o degrau que o
preço linear e a escada vitalícia acabaram de eliminar, voltando pela porta do
desconto, em datas que o motorista não consegue prever.

⚠️ **O INDICADO NÃO GANHA NADA POR TER SIDO INDICADO.** Dois motoristas que se
cadastram no mesmo dia pagariam diferente por um motivo que nenhum dos dois
controla — conhecer ou não alguém que já usa o app. É o teste do portão ao
contrário. O que ele ganha é o degrau que já existe para todos, e a mensagem
de convite passou a **dizer isso**: *"fechando no primeiro mês você trava
30%"*. Custa zero e serve aos dois lados — quanto antes o colega contratar,
antes o desconto de quem indicou entra.

**A carência é o primeiro mês PAGO do indicado**, não o cadastro. Sem ela,
cinco cadastros de teste dariam desconto real sobre receita que nunca entrou.

⚠️ **E O DESCONTO CAI QUANDO O COLEGA SAI.** Até 10/09/2026 não caía:
`indicacoesAtivas` só era escrito para cima, e nenhum caminho o baixava quando
o indicado cancelava — o desconto sobrevivia ao cliente que o justificava. Quem
fecha isso é `reconciliarIndicacoes`, chamada pelo fechamento mensal **antes**
de emitir as faturas. O quarto estado é `encerrada`, e é reversível: se ele
voltar a pagar, a indicação volta a valer.

**Atraso não derruba, sair derruba.** O critério é grosso de propósito — tem
plano e não está suspenso. Com o estado fino da conta, o desconto piscaria de
mês em mês por causa de uma fatura atrasada, e desconto que oscila é tão ruim
de explicar quanto desconto que não cai.

**Onde a oferta aparece:** `/tio/planos`, `/tio/taxa` (só com a fatura
**quitada** — pedir favor a quem está devendo é cobrança), `/tio/selo` e a
confirmação do contrato. Mais uma peça no sino, uma única vez, 30 dias depois
de contratar. **Nunca** no app da família, durante a rota, no sino durante os
90 dias, ou na tela de cancelamento — e isso é teste, não lembrete.

## 5. O piso de R$ 19 — e ele não é o mínimo de tabela

**`PISO_DA_FATURA = 19`: nenhuma fatura fica abaixo disso**, exceto o fundador
vitalício.

⚠️ **NÃO EXISTE TETO PERCENTUAL, e o que existia não protegia nada.** Havia um
teto de 50% na indicação, e com o fechamento somando por cima a fatura chegava
a R$ 0,00 do mesmo jeito. Porcentagem não protege margem porque **não é medida
na moeda do custo**. Quem protege é o piso, que é em reais.

O número é derivado: ele desceu de R$ 34 para R$ 19 junto com o preço. Mantido
onde estava, ficaria ACIMA do menor plano novo (o anual mínimo, R$ 29), e o
motorista pequeno nunca receberia nada por indicar — que é exatamente a queixa
que o programa existe para evitar.

⚠️ **Não confundir com o MÍNIMO DE TABELA** (R$ 49 mensal / R$ 29 anual), que
vem **antes** do desconto. Invertidos, quem tem 10 crianças e 30% travado
pagaria R$ 49 em vez de R$ 41,30, e o desconto sumiria sem nenhuma linha
explicando. A ordem é **mínimo → desconto → piso**, e cada passo protege outra
coisa.

⚠️ **O piso é publicado, nunca aplicado em silêncio.** `precoDoMes` devolve
`pisoAplicado` e `descontoAbsorvido` para a tela poder dizer quando ele comeu
desconto — calar produz o *"indiquei e não recebi"*. A 5% ele quase não
encosta: mordia na 4ª indicação de quem tem 8 crianças, agora morde na 7ª. E a
tela de indicar diz o valor real da PRÓXIMA indicação, com o piso já dentro
(`valorDaIndicacao`), porque perto do piso a porcentagem mente.

## 6. Fundador é título, não preço

`FUNDADORES_METADE = 0`: as doze vagas de metade **não são mais concedidas**.
Era o único desconto que ninguém podia reproduzir, e não sobrevivia à conversa
no portão. Custou zero, porque quem fecha no mês 1 já leva o degrau cheio.

**O vitalício já concedido continua** — é um só, é contrato assinado, e não
conceder é diferente de desfazer o que foi concedido. Ele é a única exceção ao
piso.

## 7. A concessão — a porta pela qual o orçamento pode voltar

Retenção real precisa de exceção: um associado bom, num mês ruim, pede
desconto, e "não" é a resposta que o faz cancelar. O que não pode é a exceção
virar regra sem ninguém ter decidido isso
([concessao.js](../src/dominio/associacao/concessao.js)).

- **Prazo e motivo são a tranca**: máximo 12 meses, motivo escrito, quem
  concedeu e quando ficam registrados
- **Uma por vez** — a nova substitui a anterior. Empilhar é como o preço
  desanda sem decisão
- **O registro e o efeito são campos diferentes, e vão no mesmo lote**:
  `users.concessoes` guarda a justificativa, `users.descontos` é o que a
  fatura lê. Separados, existiria a concessão registrada que nunca chega na
  fatura, ou o desconto que ninguém explica

**Isenção não é desconto de 100%.** `users.isencaoAte` diz que aquele mês não
tem fatura; desconto de 100% produz uma fatura de R$ 0. Os dois chegam a zero e
contam histórias diferentes na hora de conferir o que foi concedido.

---

## O que saiu, e por quê

| Saiu | Motivo |
|---|---|
| **Faixas de R$ 69/149/229** | a criança da fronteira custava sete: ganhar UMA subia a conta em R$ 40 |
| **Roleta de prêmio** | o critério era sorte, e sorte não sobrevive ao portão |
| **Fundador por ordem de chegada** | ninguém pode chegar antes |
| **Teto percentual da indicação** | não protegia nada; quem protege é o piso |
| **Expiração da escada em 12 meses** | criava o salto do mês 13 que o resto do desenho existe para evitar |
| **Prazo de 12 meses na indicação** | seis aumentos de fatura para quem mais ajudou |
| **Segunda oferta na recusa** | ensina a recusar |

---

## ⚠️ A pendência aberta: três peças mortas ainda na régua

Quatro instrumentos descrevem casos que não existem mais e continuam no
código:

| Peça | Situação |
|---|---|
| `FUNDADOR.METADE` | zero usuários desde 07/09/2026 |
| `FUNDADOR_E_FECHAMENTO_SOMAM` | **inerte** — verificado em 120 combinações, somar e pegar o maior dão o mesmo resultado |
| `ORIGEM.ANTECIPACAO` | legado; o nome antigo do fechamento |
| `origem: 'roleta'` | já não é reconhecida — documento órfão deixou de valer em silêncio |

**Nada disso pode ser apagado antes de rodar a varredura:**

```bash
VARRER_EMAIL=<dono> VARRER_SENHA=... node scripts/varrer-descontos.cjs
```

Ela é **só leitura** e não tem flag para escrever. A razão de ela vir antes é
que a falha de apagar cedo demais é **silenciosa**: `descontosVigentes` para de
somar aquela origem, a fatura do mês seguinte sai maior, e a primeira pessoa a
descobrir é o motorista perguntando por que a conta dele subiu.

---

## O que NÃO muda, e é para continuar assim

- **A mensalidade da família não passa pela plataforma.** Nada deste documento
  encosta nela — é PIX direto pai→motorista, e é o item 7 dos Termos
- **O preço de tabela não é negociado.** O que existe é desconto de régua, e a
  única exceção tem prazo, motivo e nome de quem concedeu
- **Nenhum número aparece numa tela sem sair da régua.** A proposta que o dono
  manda pelo WhatsApp lê o degrau e escreve o valor dele — no dia em que ela
  inventar um preço, o orçamento voltou com outro nome
- **O app é completo em qualquer tamanho.** O plano capa prazo e saída, nunca
  funcionalidade
