# O plano em fases — da porta única à cobrança

Escrito em 06/09/2026, no fim da sessão que reescreveu a entrada do app.

**Este arquivo não é normativo.** Ele registra o CAMINHO: o que já foi feito, o
que falta, em que ordem, e — a parte que mais se perde — **por que cada escolha
foi feita assim**. As regras que saíram daqui e viraram lei estão em
[decisoes.md](decisoes.md) (20, 21 e 22); o modelo de negócio está em
[negocio.md](negocio.md).

Quando a última fase fechar, este arquivo some.

---

## A jornada que o plano constrói

João é motorista escolar. Um colega mandou o link no WhatsApp.

1. Abre `alobuzinou.com.br`, lê, clica em **Entrar**
2. Cai no login em `alobuzinou.com`. Sem conta, entra com o Google
3. **A conta nasce sem papel.** A sala de espera pergunta por onde ele chegou;
   ele escolhe "sou motorista"
4. Coloca foto e logo da van, cadastra as 14 crianças, os horários, as escolas
5. Segunda de manhã, **inicia a primeira rota — e o relógio começa**
6. Manda os convites. As mães entram e veem a perua no mapa
7. **Aos 30 dias** o app pergunta se ele está gostando e pede avaliação
8. **A 30, 7 e 1 dia do fim**, três avisos de formas diferentes
9. Ele abre **Ver planos**: 14 crianças ativas, faixa de R$ 149, com os
   descontos dele já no número
10. Escolhe, aceita o contrato ali mesmo e paga
11. Se não escolher, a conta fica **inativa sobre o app desfocado**
12. **As mães não são punidas:** continuam com rota ao vivo, aviso de chegada e
    mensalidade. Some o histórico antigo, o extrato e os recados velhos

---

## Estado das fases

| Fase | O que é | Estado |
|---|---|---|
| 1 | A porta pública sai do app | ✅ |
| 2 | A tela de entrada | ✅ |
| 3 | Conta sem papel e as duas saídas | 🟡 falta a conversão |
| 4 | Blaze | ✅ **06/09/2026** |
| 5 | O relógio do teste | ✅ |
| 6 | Planos e assinatura | 🟡 régua e tela prontas |
| 7 | A conta inativa | ⬜ |
| 8 | Indicação | ⬜ |
| 9 | A avaliação do 1º mês | ⬜ |
| 10 | O painel do dono, e quem entra nele | ⬜ |

---

## O que falta, fase por fase

### Fase 3 · o que ainda não roda
A sala de espera existe, e desde 06/09 **as duas saídas funcionam** — o
`redeemInvite` está no ar.

Falta a **conversão de motorista vazio para responsável**, aprovada assim: só
quando a conta tem zero crianças e zero rotas, porque aí nada se perde.
`admin → parent` é descida de privilégio, não subida — a escrita perigosa é a
que sobe, e foi por ela que um motorista se promovia a dono. Com UMA criança
cadastrada o app precisa recusar: ali existe operação de verdade.

E a mensagem de recusa hoje é um beco. Ela diz só *"esta conta é de motorista e
não pode ser vinculada como responsável"* e para aí — precisa dizer o que
fazer.

### Fase 4 · Blaze — FEITA em 06/09/2026
As 12 functions estão no ar em `southamerica-east1`, as duas bandeiras viradas
no mesmo commit, a branch `alobuzinou` fundida de volta na principal. Push,
anexos, cobrança automática e resgate de convite passaram a existir.

Foram três bloqueios encadeados, e **nenhum era código** — os três estão
escritos no [deploy.md](deploy.md) para não custarem de novo: conta de
faturamento fechada continua vinculada e o Firebase não avisa; `--only` não
evita a consulta ao segredo; e projeto dentro de organização não ganha sozinho
o papel de build.

### Fase 6 · o que falta para o autoatendimento fechar
A régua e a tela estão prontas. O botão ainda abre o WhatsApp do consultor, e
virar "assinar agora" exige mexer nas duas rules de dinheiro:

- **`contratosAssociacao`** — hoje só o dono emite
- **`limiteCriancas`** — hoje só o dono escreve, e é o campo que o plano define

Não é lugar de pressa. Botão que promete autoatendimento e cai numa tela
quebrada é pior que botão honesto.

E os lembretes de PIX (no vencimento e no 5º dia) ainda não existem: com
**10 dias de tolerância** até a conta inativar, quem esquece precisa ser
lembrado antes de ser bloqueado.

### Fase 7 · a conta inativa
Uma tela para dois estados — fim do teste sem contrato, e 10 dias de atraso —
porque a situação é a mesma: existe conta, existe dado, falta acordo.

> ⚠️ **A tela precisa PARAR DE BUSCAR os dados antes de desfocá-los.**
> `filter: blur()` é CSS, não proteção: uma tela que carrega as crianças para
> borrá-las entrega nome, endereço e coordenada a quem abrir o inspetor. Isso
> é vazamento com aparência de segurança.

No app da família, limitar **só o que não foi prometido**: histórico, extrato e
recados antigos. Rota ao vivo, aviso de chegada e mensalidade continuam — é o
que a landing promete a ela, e ela não é parte do acordo que não fechou.

### Fase 8 · indicação
Não existe registro de quem indicou quem. Precisa do vínculo, da validação pelo
**número de WhatsApp normalizado** (com e sem nono dígito, com e sem DDI) e da
recusa de auto-indicação. As duas falhas produzem a mesma queixa — *"indiquei e
não recebi"* — e é o tipo de ruído que viaja rápido numa rede de indicação.

A conta do desconto já está pronta e testada em `dominio/associacao/planos.js`.

### Fase 9 · a avaliação do primeiro mês
A janela de avaliação **já existe** em `platformConfig`, ligada pelo dono sem
deploy. Falta o gatilho dos 30 dias de uso. É plugar, não construir.

---

### Fase 10 · O painel do dono, e quem entra nele

**Passo zero: a conta de dono não existe.** Ela foi adiada em 06/09 e nunca
voltou à pauta — hoje ninguém consegue entrar no `/admin`. Cria-se no console:
Authentication → adicionar usuário, e `users/{uid}` com `role: 'owner'`.

#### Três papéis na administração, e o segundo é novo

Múltiplos donos **já funcionam** — `isOwner()` nas rules checa o PAPEL, não a
identidade, então duas contas com `role: 'owner'` são as duas donas. O que o
código diz é outra coisa: *"O DONO É UMA CONTA SÓ"*. Isso é suposição
declarada, não limite técnico, e a frase sai do `firestore.rules` e do
`papeis.js` na mesma alteração que aceitar a segunda.

| Papel | O que faz |
|---|---|
| `owner` | aprova motorista, fecha fatura, emite contrato, vê tudo |
| `observador` | vê números, funil e fila. **Não muda nada** |
| `admin` | é MOTORISTA. Nome histórico — ver a tabela de papéis do CLAUDE.md |

O `observador` existe por um motivo concreto: o painel mostra **chave PIX de
cada parceiro**, GMV e a fila de concorrentes. Quem entra para montar deck ou
ajudar na venda precisa VER, não precisa MEXER. E é mais barato criar o papel
com duas pessoas dentro do que com cinco.

**Os dois papéis nascem no console, sempre.** Não haverá botão de promover a
dono: hoje NÃO EXISTE caminho para `role: 'owner'` pelo cliente — o `create` de
`users` só aceita `admin`, e o `update` só deixa o dono promover
`aguardando → admin`. Criar esse caminho seria abrir a primeira porta, e quem
passasse por ela veria tudo. Com duas a quatro pessoas, um botão economizaria
minutos por ano e custaria a garantia que a refatoração de papel comprou.

#### A aba do investidor

O `adminMetricsService` já entrega usuários, motoristas, responsáveis,
crianças, GMV total e do mês, ticket médio, receita própria e receita em
aberto. O que falta não é cálculo: é a tela que junta isso no formato do
[pitch-investidor.md](pitch-investidor.md).

⚠️ **A regra que decide se essa aba presta:** onde o número não existe, ela
precisa dizer **"não medimos"** — e não mostrar zero. Num deck, zero e
"não medimos" são coisas opostas, e confundir os dois é o erro que não se
desfaz numa reunião.

E o número que mais falta é justamente o que o
[canvas-negocio.md](canvas-negocio.md) aponta como o que governa o negócio:
**hora de consultor por associado fechado**. O
[pitch-investidor.md](pitch-investidor.md) transforma isso em portão — *não
capte antes de medir* —, e a [pendencias.md](pendencias.md) já recomenda o
conserto: um campo `horasConsultor` no lead, preenchido à mão.

A aba existindo é o que torna essa ausência visível toda vez que alguém a abre.
Hoje ela não incomoda ninguém porque não aparece em lugar nenhum.

#### O que ainda não está decidido aqui

**O que melhorar no painel além disso.** Ele tem cinco abas hoje — Visão geral,
Funil, Taxa, Fila, Pesquisa — e nenhuma reclamação registrada. Melhorar sem
saber o que incomoda produz retrabalho: a lista sai de usar, não de supor.

## O gateway — escrito em 06/09/2026, ainda não exercitado

A conta do Asaas foi aprovada em 06/09/2026 e as duas metades existem em
código. A chave da API vive em `functions:secrets`, nunca em `.env` com prefixo
`VITE_` — tudo com esse prefixo entra no bundle, público por construção.

**O gateway cobra a TAXA, nunca a mensalidade.** Não é preferência: é a
[decisão 19](decisoes.md), o item 7 dos Termos e a frase que está publicada na
landing. O Asaas oferece split e subconta, e é natural pensar em processar tudo
por ele — processar a mensalidade transformaria a plataforma em intermediária
de dinheiro de terceiro. A trava é o formato:
`functions/lib/cobrancaDaTaxa.js` só sabe ler `faturasParceiro`.

As duas coisas que cobravam caro se erradas foram decididas e testadas:

1. **Qual evento marca a fatura como quitada.** `PAYMENT_CONFIRMED`, não
   `PAYMENT_RECEIVED`: esperar o dinheiro cair deixaria bloqueado por dias
   quem já pagou. O risco que sobra — estorno depois — é o que os eventos de
   `REFUNDED` e `CHARGEBACK` tratam.
2. **A baixa é idempotente pela FORMA.** Cada evento devolve um estado
   absoluto, nunca um passo relativo: aplicar duas vezes dá no mesmo. Mesmo
   padrão do `rides`, cujo id é a data por esse motivo.

E uma terceira, que só apareceu ao escrever a criação: **cobrar duas vezes o
mesmo mês tem duas guardas.** A fatura recusa quando já carrega
`asaasPaymentId`, e antes de criar se pergunta ao próprio gateway pelo
`externalReference` — entre criar lá e gravar aqui existe uma janela, e uma
queda dentro dela deixaria cobrança órfã lá e nenhum vestígio aqui.

**O que falta**, e nada disso é código:

- **O app não coleta CPF/CNPJ** em lugar nenhum — nem o cadastro, nem o
  contrato. O gateway não cria cliente sem ele. Hoje entra pela mão do dono e
  fica em `taxaParceiros/{uid}`, que só o dono lê; quando o cadastro pedir, a
  função não muda
- **Nunca rodou de verdade.** Tudo o que existe é teste puro (42 casos) — o
  caminho até o Asaas não foi exercitado nem em sandbox
- **Não há botão.** A aba **Taxa** do `/admin` fecha a fatura e não oferece
  "gerar cobrança"; a callable existe sem tela

---

## O modelo novo — o que já foi feito (06/09/2026)

O plano de nove fases acima descreve o produto que existia até aqui. Em
06/09/2026 o modelo comercial mudou, e três coisas foram decididas de uma vez:
**ninguém aprova motorista**, **o preço é fixo** (some o orçamento) e **a
roleta só aparece quando o teste acaba**. O modelo antigo é apagado, não
migrado — não há base real.

Fechado até agora:

- **Fase 0 · fechar antes de abrir.** `allow get` de `users` escopado por
  vínculo nas duas direções; `taxaConfig` fechado ao dono. As duas eram furos
  que a aprovação segurava — ver a [decisão 16](decisoes.md)
- **Fase 1 · pagamento destrava a conta.** O webhook do gateway passou a
  escrever `users.assinaturaAte` no mesmo lote da baixa. Sem isso, quem pagasse
  pelo gateway continuaria bloqueado com o comprovante na mão
- **Fase 2 · a conta nasce operando.** Some `aguardando`, a fila, a sala de
  espera, `waitlistDrivers`, `waitlistParents`, `joinDriverWaitlist`,
  `config/rodada.js`, a aba **Fila** do painel e as duas telas de landing que
  ninguém mais importava (`WaitlistSheet`, `PartnerPitch`)
- **Fase 3 · preço fixo.** Fatura e contrato saem de `planos.js`. Apagados
  `taxa.js`, `OrcamentoSheet`, `FunilTab`, `FunilKanban`, `funilService`,
  `leadsFunil` e a aba **Funil**. `VERSAO_CONTRATO = 3`. Desconto com PRAZO
  passou a existir, e com ele a regra de que fundador e antecipação não somam

O que falta, na ordem:

1. **Contratar dentro do app** — contrato de 12 meses, renovando de 12 em 12.
   Preço discreto durante o teste; quem contrata ANTES do fim leva 50% nos 12
   meses. Exige um conceito que não existe: **desconto com prazo**
2. **A tranca nas rules** — bloqueio por teste vencido e por atraso
3. ~~**A roleta na conversão**~~ — feita: `girarPremio`, coleção `premios`,
   quatro prêmios, girando só para quem contratou
4. **Painel do dono** — vira acompanhamento, não aprovação. E a conta
   `role: 'owner'`, que **ainda não existe**: ninguém consegue abrir `/admin`

✅ **A soma dos descontos foi decidida:** fundador e antecipação **não somam,
vale o maior** — `FUNDADOR_E_ANTECIPACAO_SOMAM = false` em `planos.js`, com
teste. Somando, os treze primeiros chegariam a 100% e a partir dali roleta e
indicação valeriam zero justamente para quem mais indica.

---

## O que continua em aberto

- **A condição de fundador precisa de dono.** Quem marca é o dono, num campo
  que só ele escreve — nunca um contador automático. Hoje o primeiro motorista
  no banco é uma conta de teste, e um contador daria gratuidade vitalícia a ela
- **A `/familia` está órfã:** a landing nova não linka para ela, e só o convite
  chega lá. Linkar é uma linha; aposentar é irreversível
- **Motorista que também é pai** continua impossível de representar — `role` é
  um só. Decidido: deixar assim, com mensagem clara mandando usar outro e-mail
- **Os dois modelos de preço** (`taxa.js` negociado e `planos.js` por faixa)
  convivem. A migração é pendência do [negocio.md](negocio.md)
