# Modelo de negócio

**Este documento foi escrito depois do produto.** O app nasceu resolvendo o dia
do motorista, e o modelo de negócio ficou implícito no código — espalhado entre
`taxaConfig`, `limiteCriancas` e uma conversa de consultor que não estava escrita
em lugar nenhum. Este arquivo torna isso explícito, e a partir dele o produto se
adapta ao modelo, não o contrário.

Escrito em 04/09/2026, com **1 motorista associado e 18 famílias**. Todo número
daqui que não vier do banco está marcado como pendência, não como fato.

> **Ordem de trabalho declarada:** marketing primeiro, tecnologia depois. A
> tecnologia atual é considerada suficiente — o que vem é **adaptação** ao que
> está escrito aqui, não reconstrução.

---

## 1. O negócio em uma frase

O Alô Buzinou vende **software de gestão para o motorista escolar autônomo**,
cobrado proporcionalmente ao tamanho da operação dele. A plataforma **não**
intermedeia a mensalidade que a família paga ao motorista, e essa separação é
estrutural — ver seção 3.

Não é marketplace. Não é intermediação de pagamento. Não é frota. É SaaS para
um profissional que hoje trabalha em caderno.

---

## 2. Identidade da marca

Fixado em 04/09/2026, na conversa que originou este documento. Vale para a
landing pública, para a conversa do consultor e para o texto dentro do app.

| | |
|---|---|
| **Frase de impacto** | "O transporte escolar saiu do caderno." |
| **Missão** | Ligar as duas pontas com confiança. |
| **Visão** | Ser referência em confiança, não em tamanho. |
| **Posicionamento** | App de transporte escolar (categoria funcional, não "infraestrutura" nem "plataforma de impacto") |
| **Tom** | Caloroso e brasileiro — "a gente", frase curta, zero superlativo |
| **Problema nomeado** | Dinheiro e confiança se misturam |

**Os três valores**, e cada um é verificável no código — foi esse o critério de
escolha:

1. **O dinheiro do motorista é do motorista.** A mensalidade não passa pela
   plataforma. Provado por `payments` ser PIX direto e pela separação de
   `dominio/cobranca/` e `dominio/associacao/` ([decisão 17](decisoes.md#17-a-regra-de-negócio-mora-em-srcdominio-e-não-alcança-nada)).
2. **A gente é comunidade.** Motorista indica motorista, e é assim que a base
   cresce — não por mídia paga. Ver seção 7.
3. **Do lado de quem dirige.** A plataforma apoia o motorista, não o fiscaliza.
   É o que sustenta a [decisão 14](decisoes.md#14-motorista-não-avalia-responsável--em-nenhum-estágio) e a
   [decisão 6](decisoes.md#6-verificação-é-selo--nunca-bloqueia-operar).

### Dados oficiais

Usados no rodapé de toda peça pública, nos Termos e no contrato.

| | |
|---|---|
| **Razão** | Alô Buzinou |
| **CNPJ** | `65.000.217/0001-47` |
| **Endereço** | Rua das Trovas, 64 — Socorro, São Paulo/SP |
| **E-mail** | `contato@alobuzinou.com.br` |
| **WhatsApp** | +55 11 96917-0709 |
| **Instagram** | `@alobuzinou` |

⚠️ **A marca pública é Alô Buzinou, sem assinatura de terceiro.** A home atual
do motorista traz um rodapé "sistema desenvolvido por Desenvolva Algo" com CNPJ
e contato próprios (`src/config/developer.js`, `Home.jsx`). Isso **contradiz** a
decisão desta rodada e precisa sair na mesma passada em que a landing nova
entrar — senão o app e a landing assinam empresas diferentes na frente do mesmo
motorista.

**A honestidade sobre o estágio é posicionamento, não fraqueza.** A comunicação
diz abertamente que o produto está começando, que hoje só há PIX, e que o app
nas lojas depende dos motoristas que entrarem agora. Isso foi escolhido de
propósito: é o que torna a visão ("confiança, não tamanho") verificável em vez
de slogan. Quem for suavizar esse texto está trocando o único diferencial que
não se copia.

---

## 3. Os dois dinheiros

A regra mais importante deste documento, e ela já era regra de arquitetura antes
de ser regra de negócio.

| | Mensalidade | Taxa de associação |
|---|---|---|
| **Quem paga** | Responsável | Motorista |
| **Quem recebe** | Motorista | Alô Buzinou |
| **Coleção** | `payments` (+ `events`) | `faturasParceiro`, `taxaParceiros` |
| **Domínio** | `dominio/cobranca/` | `dominio/associacao/` |
| **Tela** | `/pai/financeiro`, `/tio/finance` | `/tio/taxa` |
| **A plataforma toca?** | **Não** | Sim, é a receita |

**Por que a separação é estrutural e não organizacional.** Misturá-las quebra o
item 7 dos Termos de Uso e destrói o primeiro valor da marca. A separação existe
em quatro camadas independentes — coleção, pasta de domínio, tela e Termos — para
que a mistura apareça como erro de lint antes de virar produto.

**A frase pública que depende disso:**

> "A mensalidade das suas famílias é sua. PIX, dinheiro ou maquininha, direto
> com quem paga — a plataforma não entra no caminho desse dinheiro e não fica
> com percentual nenhum dele."

Ela está na home do motorista hoje e vai para a landing nova. Qualquer mudança no
meio de pagamento precisa manter essa frase verdadeira, ou a frase sai junto —
ver seção 8.

---

## 4. Como a plataforma ganha

### A unidade de cobrança é a criança ativa

**Decisão:** o preço é **proporcional ao número de crianças ativas**, e o app é
**completo em qualquer tamanho**. Não existe plano Básico, Pro ou Premium.

**Por que essa unidade, e não outra.** Três alternativas foram consideradas:

| Modelo | Por que não |
|---|---|
| **Preço fixo único** | O motorista de 8 crianças acha caro e não entra; o de 45 acha barato e você deixa dinheiro na mesa. Perde as duas pontas. |
| **Planos por funcionalidade** | Obriga o motorista a adivinhar se precisa de "relatório avançado". Ele não sabe, e na dúvida escolhe o mais barato ou desiste. Cria também duas versões do produto para manter. |
| **Percentual da mensalidade** | Quebraria o primeiro valor da marca e o item 7 dos Termos. Fora de questão. |
| **Freemium com anúncios** | Descartado com três razões somadas — ver seção 11. |

**Por que a criança ativa é a unidade certa:**

1. **Já está construída.** `users.limiteCriancas` e `users.criancasAtivas`
   existem, as rules recusam `addDoc` que estoure o limite via `getAfter`, e
   `fecharFatura` conta as crianças reais. Dar nome comercial ao que a
   arquitetura já faz custa quase nada.
2. **Alinha preço e valor entregue.** Cada criança ativa é uma cobrança mensal
   que o app organiza, um responsável com login, uma rota calculada e um fluxo
   de faltas. O trabalho da plataforma cresce junto com a conta.
3. **É a linguagem do cliente.** O motorista pensa em "quantas crianças eu
   levo". Não pensa em tier. Uma pergunta só — *"quantas crianças você leva
   hoje?"* — e o preço sai.
4. **Resolve a sazonalidade sem código novo.** Janeiro e julho são férias.
   Ele desativa quem parou e a fatura cai sozinha, porque `criancasAtivas` já
   conta só o ativo. **Isso é retenção pura:** o app não vira peso morto no mês
   em que ele não fatura, que é exatamente quando um autônomo cancela software.
5. **Cresce sem venda nova.** De 12 para 20 crianças e a receita sobe sem
   ninguém negociar de novo.

### Faixa ou linear — **pendência**

Duas formas de aplicar a mesma unidade:

- **Linear** — `R$ X por criança ativa`. Mais justo e mais fácil de explicar.
- **Faixa** — `até 10 · 11–25 · 26–40 · acima de 40`. Cria degrau visível, é
  mais simples de comunicar numa tabela, e o motorista perto do topo de uma
  faixa tem incentivo de crescer dentro dela.

**Recomendação:** faixa, porque a conversa do consultor fica mais curta e o
motorista entende o preço sem fazer conta. Mas a decisão está aberta.

### Valor — régua recomendada

**Ainda não é preço publicado**, é a régua de partida da conversa do consultor.
Definida em 04/09/2026 a partir de três âncoras.

| Faixa | Taxa mensal | Efetivo por criança |
|---|---|---|
| Até 10 crianças | **R$ 69** | R$ 6,90 a R$ 8,60 |
| 11 a 25 | **R$ 149** | R$ 5,96 a R$ 13,50 |
| 26 a 40 | **R$ 229** | R$ 5,72 a R$ 8,80 |
| Acima de 40 | conversa | — |

**A âncora que faz o motorista entender em um segundo:** a taxa custa **menos
que uma mensalidade**. Ele cobra na faixa de R$ 200 a R$ 400 por criança; a
conta inteira do app fica abaixo do que ele recebe de uma única família. Essa é
a frase da conversa comercial — não o valor solto.

**As três âncoras que produziram a régua:**

1. **Percentual do faturamento dele.** Um motorista com 20 crianças a R$ 250
   fatura cerca de R$ 5.000/mês. R$ 149 é ~3% disso. Software de gestão para
   autônomo costuma ser tolerado entre 2% e 5% do faturamento; acima disso ele
   compara com o caderno e o caderno ganha.
2. **O custo de uma falha evitada.** Se o app evita **uma** mensalidade perdida
   ou esquecida por ano, já se paga em dois a três meses.
3. **Progressão que não pune o pequeno.** O efetivo por criança cai conforme a
   operação cresce, mas a entrada é baixa o bastante para o motorista de 8
   crianças não desistir na primeira frase.

### A conta dos três meses grátis

O trial é barato e o CAC é o que custa — e é isso que a régua precisa cobrir.

| Item | Estimativa | Observação |
|---|---|---|
| Infra por motorista/mês | R$ 10 a R$ 20 | **mensurável hoje no console**, ver seção 10 |
| Custo dos 3 meses grátis | R$ 30 a R$ 60 | recuperado no **primeiro mês pago** |
| CAC (tempo de consultor) | [[MEDIR]] | é o custo real, não a infra |
| Payback total | ~5 meses | 3 de trial + ~2 pagos, se o CAC ficar perto de R$ 300 |

**A conclusão que importa:** os três meses grátis **não são o problema de
caixa** — custam algumas dezenas de reais por motorista. O que precisa ser
controlado é o tempo de consultor por lead, porque é ele que decide o payback.
Um trial que não converte custa pouco; um consultor que gasta seis horas com um
lead que não fecha custa muito.

⚠️ **A régua acima é hipótese até o item 4 da seção 12 ser medido.** O custo real
de infra por motorista está disponível no console do Firebase hoje, e é ele que
confirma ou derruba a faixa.

### O que o vencimento faz

`taxaConfig.diaVencimento` (1–28, padrão 10) é da **casa**, não de cada
parceiro. `fecharFatura` congela a data em `vencimento`. Se um parceiro precisar
de dia diferente, o lugar é `diaVencimento` na negociação — `dataDeVencimento`
já prefere ela sobre a régua.

---

## 5. Como o motorista entra

**Três meses grátis, e cada mês tem um trabalho diferente.** A régua abaixo foi
definida em 04/09/2026 e resolve a pendência que estava aberta.

**Por que três e não um.** Um mês prova que a ferramenta funciona; três provam
que ela pega o hábito. O ciclo do produto é mensal — cadastrar a turma, rodar a
rota, fechar a cobrança — e o motorista precisa atravessar esse ciclo mais de
uma vez para parar de abrir o caderno em paralelo. **O caderno é o concorrente
real, e ele não morre em 30 dias.**

### Mês 1 — fecha e pergunta

Ao fim do primeiro mês, o app avisa que o mês grátis fechou **e pede uma
avaliação**.

Pedir cedo é deliberado: ele acabou de atravessar um ciclo inteiro e a
impressão está fresca. A avaliação serve a dois donos — feedback real para o
produto e, com autorização, depoimento para a vitrine (`feedbacks`,
`listPublicTestimonials`).

⚠️ **Risco a observar:** um mês pode ser cedo para quem ainda não migrou a turma
toda, e nota baixa de quem não entendeu o produto contamina a média. Se isso
aparecer, a saída não é esconder a nota — é perguntar primeiro *"você já
cadastrou todas as crianças?"* e só pedir avaliação de quem disser que sim.

### Mês 2 — certifica

O app avisa que ele está no segundo mês de gratuidade usando o apoio e o
ambiente digital completo, e **pede os documentos do motorista para
certificá-lo**.

**Por que no mês 2, e não na entrada.** É o ponto de maior comprometimento e
menor atrito: ele já cadastrou a turma, já rodou a rota, já viu funcionar. Pedir
documento no dia 1 é portão; pedir no mês 2 é passo natural de quem já está
dentro.

⚠️ **O pedido NÃO pode virar bloqueio.** A
[decisão 6](decisoes.md#6-verificação-é-selo--nunca-bloqueia-operar) é firme:
verificação é selo e nunca impede operar. Quem não enviar documento continua
usando o app normalmente — perde o selo, não o acesso. Se algum dia a
certificação travar uma operação, a decisão 6 foi quebrada e a mudança precisa
estar escrita lá, não aqui.

### Mês 3 — conta para trás

O app avisa **regressivamente até o fim do mês**, e é aqui que ele diz que vai
perder o acesso.

**Por que a contagem regressiva só no último mês.** Alerta que aparece cedo
demais e repete por 90 dias vira paisagem — o motorista aprende a pular o aviso,
que é exatamente o que a regra da tarja do app já evita
(`dominio/rota/avisoDoMomento.js`: tarja semanal ensina a pular tarja). Nos dois
primeiros meses o app **informa**; no terceiro ele **conta**.

### Fim do trial sem contrato — conta inativa

O motorista vê **o card de conta inativa sobre o app desfocado** — a mesma tela
de quem está inadimplente. Uma tela só para os dois estados, porque a situação é
a mesma: existe conta, existe dado, falta acordo.

⚠️ **Três alertas técnicos, e o primeiro é de segurança:**

1. **Desfoque não é proteção — é CSS.** `filter: blur()` não tira nada do DOM:
   quem abrir o inspetor lê nome, endereço e coordenada de criança por baixo do
   borrão. Se a tela inativa continuar **carregando** os dados para desfocá-los,
   isso é vazamento com aparência de segurança. A conta inativa precisa **parar
   de buscar** o dado, e o desfoque ficar como recurso estético sobre uma tela
   que já não tem conteúdo real.
2. **Isto não contradiz a [decisão 16](decisoes.md#16-a-fila-de-espera-do-motorista-e-o-link-que-não-abre-porta), e a distinção importa.**
   Lá o vidro fosco é criticado **na entrada** — quem nunca usou não sabe o que
   está atrás do borrão, então a tela só frustra. **Na saída é o oposto:** quem
   rodou três meses sabe exatamente o que perdeu, e o borrão é lembrança
   concreta, não promessa vaga. Mesmo componente, efeitos opostos, porque o que
   muda é o que a pessoa já viveu.
3. **O dado do responsável não pode sumir junto.** As famílias não têm culpa do
   contrato não fechado, e a criança continua sendo transportada. Precisa estar
   decidido o que a família vê quando a conta do motorista dela fica inativa —
   **hoje isso não está definido, e é a pendência 11 da seção 12.**

**O que o motorista NUNCA perde:** o dado dele. Conta inativa é acesso
suspenso, não exclusão — e a
[decisão 4](decisoes.md#4-papel-é-derivado-de-vínculo-não-campo-em-users) já
diz que vínculo se encerra com `ativoAte`, nunca se apaga, por exigência de
LGPD.

---

## 6. O funil comercial

Quatro paradas, já construídas e ligadas à navegação desde 29/08/2026:

```
leadsFunil ──► orçamento ──► contratosAssociacao ──► faturasParceiro
(aba Funil)   (OrcamentoSheet)  (/tio/contrato-      (aba Taxa →
                                 plataforma)          /tio/taxa)
```

Três armadilhas registradas, todas já documentadas no `CLAUDE.md`:

- **`leadsFunil` não é `waitlistDrivers`.** O funil é registro comercial; a fila
  é a porta do app. Mover cartão de vendas não dá acesso a sistema nenhum.
- **Orçar exige conta aprovada.** O id do lead é o uid só quando a pessoa se
  inscreveu pelo app. Para quem chegou por fora, salvar produz um contrato que
  ninguém consegue aceitar. Quem recusa é o `FunilTab.jsx`.
- **Subir a `VERSAO_CONTRATO` exige novo aceite.** Se a mudança de modelo alterar
  o contrato — e ela altera, porque muda a forma de cobrança — a versão sobe e
  todo associado aceita de novo.

**Receita é fatura `quitada`.** Fatura `aberta` viaja em `receitaEmAberto` e
**nunca** é somada na receita (`adminMetricsService.js`). Mesmo critério do GMV,
que só soma `payments` com `paid`.

---

## 7. Aquisição: a comunidade é o canal

**O insight que define a estratégia de marketing:** motoristas de perua já são
a rede de apoio uns dos outros. Eles indicam cliente entre si, avisam sobre a
rua que fechou, cobrem a rota do colega quando a van quebra. Eles fazem fila no
mesmo portão de escola todo dia — é uma rede densa, de alta confiança e custo
zero de acesso.

Isso já estava em [evolucao.md](evolucao.md), estágio 1, como observação. Aqui
vira **decisão de canal**: o Alô Buzinou cresce por indicação, não por mídia
paga.

**Consequências práticas:**

- O CAC tende a ser dominado por **tempo de consultor**, não por verba de anúncio.
- A landing pública é peça de **awareness e credibilidade** — o lugar para onde
  o motorista indicado vai olhar antes de responder a indicação —, não uma
  máquina de tráfego pago.
- **Um motorista mal atendido custa mais que um cliente.** Na mesma rede em que
  a indicação viaja, a reclamação viaja mais rápido. Suporte não é custo de
  operação aqui, é custo de aquisição.

### Programa de indicação

**Regra recomendada: 10% de desconto por indicação ativa, com teto de 50%.**

O desconto vale **enquanto o indicado for pagante** — para de valer se ele sair.
Cinco indicações zeram metade da conta e param aí.

**Por que percentual com teto, e não percentual aberto.** Sem teto, o modelo se
autodestrói: motorista de perua vive em rede densa — eles fazem fila no mesmo
portão todo dia — e trazer dez colegas é plausível. A 10% cada, dez indicações
zeram a conta para sempre, e o cliente mais valioso da base vira o único que não
paga. O teto de 50% mantém o incentivo forte e a receita de pé.

**A conta que mostra que o teto é generoso, não mesquinho:** um motorista que
traz 5 colegas gera 5 × R$ 149 = **R$ 745/mês de receita nova** e custa
**R$ 74,50** de desconto. Retorno de 10 para 1.

**A validação é pelo número de WhatsApp** — e é a escolha certa para este
público: o número é o identificador real do motorista (mais que e-mail), quem
indica já tem o do colega na agenda, e nada se perde no caminho como acontece
com código.

⚠️ **Duas armadilhas técnicas, e as duas produzem a mesma queixa** — *"indiquei e
não recebi"*, que é exatamente o tipo de ruído que viaja rápido nessa rede:

1. **O número precisa ser normalizado antes de comparar.** Com e sem o nono
   dígito, com e sem DDI, com e sem formatação. Sem normalização, o match falha
   em silêncio e o motorista conclui que foi passado para trás.
2. **Auto-indicação precisa ser recusada.** Indicar o próprio número, ou o de
   uma segunda conta, não pode gerar desconto.

⚠️ **O prêmio é só do motorista.** A plataforma não tem moeda para dar ao
responsável: a mensalidade é do motorista, e descontá-la quebraria o item 7 dos
Termos. Já registrado na [decisão 16](decisoes.md#16-a-fila-de-espera-do-motorista-e-o-link-que-não-abre-porta).

**Ainda em aberto:** se o indicado precisa cumprir carência (recomendado: só
conta depois do primeiro mês **pago**, não do cadastro — senão o trial vira
fábrica de desconto).

---

## 8. Meio de pagamento: hoje e o alvo

### Hoje

O app **não intermedeia**. Ele gera o PIX (`dominio/cobranca/pix.js`,
`pixPayload.js`), registra quem pagou e deixa o motorista marcar recebimento em
dinheiro. O fluxo é `pending → claimed → paid`, e o responsável só consegue
escrever `claimed` — garantido pelas rules.

### O alvo

Que o responsável pague **por cartão de crédito ou débito, recorrente**, para o
motorista não precisar cobrar ninguém todo mês. Foi identificado como a dor mais
forte do cliente: *"tem tio que quer receber a mensalidade dos pais pra não
precisar ficar cobrando o pai toda vez."*

### O caminho: split, nunca escrow

Existem dois jeitos de fazer isso, e a escolha entre eles decide se a marca
continua verdadeira.

| | **Split** (escolhido) | **Escrow** (recusado) |
|---|---|---|
| Onde o dinheiro cai | Direto na subconta do motorista | No caixa da plataforma, que repassa |
| A frase "a mensalidade é sua" | Continua verdadeira | Vira falsa |
| Exposição regulatória | O PSP é o regulado | Retenção de recurso de terceiro; entra em terreno de arranjo de pagamento |
| Risco de caixa | Nenhum | Fluxo de terceiro no balanço |

**Decisão: split, com PSP já regulado** (Asaas, Iugu, Pagar.me ou Mercado Pago
são os candidatos). A plataforma orquestra a cobrança e **nunca retém**. A taxa
de associação pode sair no próprio split, o que elimina a fatura manual.

**O que isso preserva:** a frase pública da seção 3 continua verdadeira sem
ajuste, o item 7 dos Termos continua de pé, e nenhum valor da marca precisa ser
reescrito. Foi esse o critério da escolha.

**O que precisa acontecer antes:**

1. Escolher o PSP e validar que ele abre subconta para **pessoa física sem
   CNPJ**. ⚠️ **Isto é o principal risco do item inteiro:** ficou decidido que o
   motorista **não precisa de MEI nem de CNPJ** para usar o app, e boa parte dos
   PSPs exige CNPJ para subconta com split. Se nenhum aceitar pessoa física, ou
   a regra de entrada muda — o que contradiz a decisão 6, que não põe portão na
   operação — ou o cartão recorrente não existe para quem não é formalizado.
   **Testar isso antes de qualquer promessa pública.**
2. Rever os Termos de Uso — mesmo com split, o texto do item 7 precisa
   descrever o novo fluxo.
3. Subir a `VERSAO_CONTRATO`.
4. **Não anunciar antes de existir.** A comunicação atual diz que isso é o
   futuro, com essas palavras. Prometer data para um autônomo e não cumprir
   custa a confiança que é a visão da empresa.

---

## 9. O que muda no produto

A tecnologia atual é considerada suficiente. O que segue é **adaptação**, em
ordem de dependência — não de vontade.

| # | Mudança | Por quê | Tamanho |
|---|---|---|---|
| 1 | Tabela de preço por faixa em `taxaConfig` | Hoje o valor é digitado no orçamento, caso a caso. Com preço proporcional ele passa a ser derivado de `criancasAtivas`. | médio |
| 2 | Estado do período gratuito no `users` | Não existe campo de trial. Precisa de início, fim e do que acontece no vencimento. | médio |
| 3 | Aviso de fim do trial a partir do 1º mês | Regra de comunicação da seção 5. Cabe em `AvisoDaPlataforma`, que já existe e já é omitido em `/tio/taxa`. | pequeno |
| 4 | Recontagem da fatura por `criancasAtivas` | `fecharFatura` já conta crianças reais — falta ligar essa contagem ao preço. | pequeno |
| 5 | Registro de indicação (quem indicou quem) | Não existe. Precisa do vínculo e da regra de quando o desconto vale. | médio |
| 6 | Landing pública nova | Peça de marketing, fora do app. Conteúdo já escrito. | — |
| 7 | Integração de PSP com split | Seção 8. Depende de decisão de fornecedor e de revisão dos Termos. | grande |

**A ordem importa.** 1 e 2 são pré-requisito de tudo; 7 é o único item que muda
contrato e Termos, e por isso vem por último mesmo sendo o mais desejado.

**O que NÃO muda:** os dois dinheiros continuam separados, o preço continua fora
da vitrine, a verificação continua sendo selo, e a regra de camada continua
valendo. Nenhuma decisão de `decisoes.md` foi revogada por este documento.

---

## 10. Unit economics

Todos os números abaixo são **estrutura de cálculo, não fatos**. Preencher
quando o preço estiver definido e houver mais de um associado.

```
Receita mensal por motorista  =  preço/criança × crianças ativas
MRR                           =  Σ (receita mensal por motorista)
```

| Métrica | Como calcular | Estado |
|---|---|---|
| **ARPU** | MRR ÷ motoristas pagantes | pendente de preço |
| **CAC** | (tempo de consultor + custo de material) ÷ motoristas entrados | pendente |
| **LTV** | ARPU × meses de permanência média | sem histórico suficiente |
| **Churn** | motoristas que saem ÷ base, por mês | 0% até hoje (base de 1) |
| **Breakeven** | (custo de infra + operação) ÷ ARPU | pendente de preço |
| **Margem bruta** | 1 − (custo Firebase por motorista ÷ ARPU) | mensurável hoje |

**O custo de infra é mensurável agora e ninguém mediu.** O projeto roda em
Firebase Blaze, onde leitura, escrita, GPS e push são cobrados por uso. Saber
quanto **um** motorista com 18 famílias custa por mês é o número que decide se a
faixa de preço da seção 4 fecha — e ele está disponível no console hoje.

⚠️ **Cada conta gratuita custa dinheiro real.** Isso é o que torna trial longo e
freemium decisões financeiras, não de marketing.

**A métrica que decide se existe produto** continua sendo a de
[evolucao.md](evolucao.md): **famílias ativas por motorista**. Se ele migra 20 de
25, funciona. Se migra 5, nenhum modelo de cobrança salva.

---

## 11. O que decidimos não fazer

Registrado porque volta à mesa a cada seis meses.

| | Por quê |
|---|---|
| **Freemium com anúncios** | Três razões somadas: (1) anúncio na tela onde a mãe procura o filho destrói a confiança que é a missão da empresa; (2) a matemática não fecha — ads pagam por milhar de impressão, e a base não tem volume nem vai ter tão cedo; (3) cada usuário grátis custa Firebase real, então usuário grátis não é neutro, é prejuízo unitário. |
| **Percentual sobre a mensalidade** | Quebra o primeiro valor da marca e o item 7 dos Termos. É também a objeção silenciosa que todo motorista tem contra "aplicativo" — resolver isso é o argumento comercial mais forte que existe aqui. |
| **Escrow (reter e repassar)** | Seção 8. Torna falsa a frase pública e cria exposição regulatória sem necessidade, já que split entrega a mesma experiência. |
| **Planos Básico / Pro / Premium** | Cria duas versões do produto para manter, obriga o cliente a adivinhar do que precisa, e o motorista de 45 crianças com "plano básico" vira o cliente mais insatisfeito da base. |
| **Free permanente até N crianças** | Tentador pelo boca a boca, mas com um associado e custo de infra por conta, financia concorrente do próprio caixa. Reavaliar quando houver base pagante que sustente o subsídio. |
| **Preço na vitrine** | [decisão 15](decisoes.md#15-preço-não-aparece-na-vitrine), firme. Número solto vira âncora antes de existir proposta. |

---

## 12. Pendências

Ordenadas por o que trava o quê. **Resolvidas em 04/09/2026** estão riscadas.

| # | Pendência | Trava | Estado |
|---|---|---|---|
| 1 | Ratificar a régua de preço (R$ 69 / 149 / 229) | Contrato, FAQ, unit economics | recomendada na seção 4 — falta o dono ratificar |
| 2 | ~~O que acontece no fim dos 3 meses~~ | — | **Resolvida.** Régua mês a mês na seção 5 |
| 3 | Carência do desconto de indicação | Seção 7 | recomendado: 1º mês **pago** do indicado |
| 4 | Custo de infra por motorista | Confirmar a régua de preço | **mensurável hoje no console** — ninguém mediu |
| 5 | ~~Motorista precisa de MEI/CNPJ?~~ | — | **Não precisa.** Ver a ressalva na seção 8 |
| 6 | Escolha do PSP | Roadmap de cartão | aberta |
| 7 | Dados de mercado (nº de veículos, nº de crianças) | Bloco de investidor | aberta — pesquisa |
| 8 | ~~CNPJ no rodapé~~ | — | **65.000.217/0001-47**, seção 2 |
| 9 | ~~Licença das fotos~~ | — | Serão licenciadas. Até lá, **animação CSS** ocupa o espaço |
| 10 | ~~Números de tração na página~~ | — | **Não vão para a página pública.** Só no deck |
| 11 | **O que a FAMÍLIA vê quando a conta do motorista fica inativa** | Regra de suspensão | **nova, aberta** — ver seção 5 |
| 12 | **Tirar a assinatura "Desenvolva Algo" da home** | Coerência de marca | **nova** — ver seção 2 |
| 13 | **Parar de carregar dado na tela inativa** (não só desfocar) | Segurança | **nova** — ver seção 5 |

### Duas decisões de comunicação tomadas junto

**A tração sai da página pública.** Hero e bloco de investidor não exibem
número de motoristas nem de famílias. O investidor pede o deck por e-mail e
recebe os números ali. Isso muda o hero — ele perde a linha de prova social e
passa a se sustentar só na frase de impacto — e muda o bloco de investidor, que
vira tese mais botão, sem dado na tela.

**O espaço das fotos é guardado com animação CSS.** Enquanto as imagens do
iStock não forem licenciadas, o lugar delas recebe uma composição animada em
CSS com a proporção final. Nunca uma foto com marca d'água, e nunca um retângulo
cinza: o primeiro é uso indevido, o segundo faz a página parecer quebrada.

---

## Manutenção

Este documento vale enquanto for verdade. Atualize-o **na mesma alteração** que
mudar preço, unidade de cobrança, regra de trial, programa de indicação, meio de
pagamento ou canal de aquisição.

Se uma decisão daqui virar regra que o código precisa garantir, ela **também**
vira entrada em [decisoes.md](decisoes.md), com a linha de como verificar. Este
arquivo descreve o negócio; aquele descreve o que o CI impede.
