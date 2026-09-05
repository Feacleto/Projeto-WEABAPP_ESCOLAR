# Business Model Canvas

Escrito em 05/09/2026, na Fase 2 do trabalho de estruturação do negócio.

**Este documento não resume [negocio.md](negocio.md).** Aquele descreve as
decisões do modelo — preço, trial, indicação, meio de pagamento. Este arruma as
mesmas peças em nove blocos por uma razão só: **o quadro mostra o que falta.**
Bloco vazio num canvas é pergunta que ninguém fez, e foi assim que os três
achados da seção 3 apareceram — nenhum deles estava escrito antes.

---

## 0. A premissa desta versão

A pendência 1 de [personas.md](personas.md) — *qual motorista é o alvo da
rodada* — ainda não foi ratificada. **Este canvas assume a recomendação de lá: o
motorista de caderno**, 8 a 12 crianças, faixa de R$ 69.

Não é detalhe de redação. Cinco dos nove blocos mudam se o alvo virar o
motorista com operação, e a coluna da tabela abaixo diz quais. Se a ratificação
vier diferente, **o que se reescreve são esses cinco**, não o documento inteiro.

---

## 1. O quadro em uma página

| # | Bloco | O que é hoje | Muda com o alvo? |
|---|---|---|---|
| 1 | **Segmentos** | Motorista escolar autônomo de 8 a 12 crianças. Mais a responsável, que **não paga e decide a retenção** | **sim** |
| 2 | **Proposta de valor** | "Sai do caderno sem perder o que é seu" — e a mensalidade continua sendo dele | **sim** |
| 3 | **Canais** | Indicação de motorista para motorista, landing institucional, e o consultor | não |
| 4 | **Relacionamento** | Consultoria pessoal na entrada; o app se opera sozinho depois | **sim** |
| 5 | **Receita** | Taxa mensal por faixa de criança ativa. Recorrente, vencimento da casa | **sim** |
| 6 | **Recursos** | O produto construído, a separação estrutural dos dois dinheiros, e **o consultor** | não |
| 7 | **Atividades** | Vender um a um, **migrar a turma do caderno**, fechar a fatura do mês | **sim** |
| 8 | **Parcerias** | Quase nenhuma — ver o achado C | não |
| 9 | **Custos** | Tempo de consultor (dominante) e infra (centavos, até o ponto de cruzamento) | não |

---

## 2. Bloco a bloco

Só o que precisa de explicação. Os blocos que são transcrição direta de
[negocio.md](negocio.md) apontam para lá em vez de repetir.

### 1 · Segmentos de clientes

**O pagante:** motorista escolar autônomo, 8 a 12 crianças, sem exigência de MEI
nem CNPJ (pendência 5 de [negocio.md](negocio.md), resolvida). Ficha completa em
[personas.md](personas.md).

**O segmento que não paga:** a responsável. Ela entra no canvas porque **decide a
renovação sem ser cliente** — se ela não usa, o valor do motorista evapora e ele
cancela. Nenhum bloco de receita se liga a ela, e três blocos dependem dela.

⚠️ **Isto não faz do Alô Buzinou um marketplace**, e a distinção é jurídica, não
semântica: a plataforma **não apresenta ninguém a ninguém**. O motorista traz as
famílias que já transporta. É o que sustenta cadastro aberto e verificação como
selo ([decisão 6](decisoes.md#6-verificação-é-selo--nunca-bloqueia-operar)), e é
o que muda de patamar no estágio 4 de [evolucao.md](evolucao.md).

**Futuro:** a escola, no estágio 3. Fora deste canvas de propósito.

### 2 · Proposta de valor

Para o motorista, três frases, e cada uma tem par na coluna de encaixe de
[personas.md](personas.md):

1. **"O app cobra por você."** A cobrança sai do nome dele e passa a sair do
   sistema. ⚠️ Resolve **pela metade** — a família ainda age todo mês. Ver o
   achado 5.1 de [personas.md](personas.md).
2. **"A marca é sua."** `marcaNome` e `marcaLogoURL` no cabeçalho do app da
   família. O produto não se apresenta na frente do motorista.
3. **"A mensalidade é sua."** A plataforma não entra no caminho dela e não fica
   com percentual nenhum. Verificável no código, e é o primeiro valor da marca.

Para a responsável, uma: **"Você para de perguntar."** É ela que torna a
proposta do motorista verdadeira — o app dele só parece organizado porque ela vê
funcionando.

### 3 · Canais

| Canal | Trabalho que faz | Estado |
|---|---|---|
| Indicação motorista → motorista | Entrega o **lead**. Rede densa, alta confiança, custo zero | é o canal decidido |
| Landing `alobuzinou.com.br` | Credibilidade — onde o indicado olha antes de responder | no ar |
| O consultor (WhatsApp, conversa) | **Fecha.** É a conversão inteira | humano, um por vez |
| Porta da família (`/familia`) | Não é aquisição: é **ativação**. Zero palavra de venda ali | no ar |

⚠️ **As duas portas públicas fazem trabalhos diferentes e nada mora nas duas.**
Decidir mora em `/`, entrar mora em `/familia`. Confundi-las é o que faz a porta
dela ter cara de captação — ver o cabeçalho de `Familia.jsx`.

**Fora do canal de propósito:** mídia paga (seção 7 de [negocio.md](negocio.md))
e loja de aplicativos, que não é canal de aquisição num PWA.

### 4 · Relacionamento com clientes

Alto toque na entrada, baixo toque depois — e a régua do trial de três meses
(mês 1 pergunta, mês 2 certifica, mês 3 conta) é a espinha desse relacionamento.
Escrita na seção 5 de [negocio.md](negocio.md).

⚠️ **Suporte aqui é custo de aquisição, não de operação.** Na mesma rede em que
a indicação viaja, a reclamação viaja mais rápido — um motorista mal atendido
custa mais que um cliente. Isso muda onde o suporte aparece no bloco 9.

### 5 · Fontes de receita

Toda a mecânica está na seção 4 de [negocio.md](negocio.md). O que o canvas
acrescenta é o que **não** é receita, porque é o erro clássico de valuation
neste formato:

- **É receita:** fatura `quitada` em `faturasParceiro`. Fatura `aberta` viaja em
  `receitaEmAberto` e nunca é somada.
- **NÃO é receita:** o GMV — o dinheiro que passa de pai para motorista. A
  plataforma não toca nele. Somar os dois num canvas é o que transforma um SaaS
  de R$ 149 num "marketplace de R$ 5.000 por motorista", e é falso.

### 6 · Recursos-chave

| Recurso | Por que é chave | Escala? |
|---|---|---|
| O produto construído | 37 services, rules de 71 KB, regra de negócio pura e testada. É o principal ativo | sim |
| A separação dos dois dinheiros | Não é higiene de código: é o que torna a promessa da marca **verificável**, e nenhum concorrente copia sem reescrever | sim |
| Acesso à rede do portão | O canal existe porque o público já é comunidade | sim |
| **O consultor** | É quem fecha. Hoje é uma pessoa | **não** |

### 7 · Atividades-chave

1. **Vender um a um.** É a atividade real de hoje.
2. **Migrar a turma do caderno.** Cadastrar as crianças e fazer as famílias
   resgatarem o convite. Ver o achado B.
3. **Fechar a fatura do mês** (aba Taxa → `/tio/taxa`).
4. **Manter e adaptar o produto** — a ordem declarada é marketing primeiro,
   tecnologia depois.

**Não é atividade, e nunca vai ser:** intermediar pagamento e apresentar
motorista a família. As duas estão em [negocio.md](negocio.md) seção 11 e em
[evolucao.md](evolucao.md).

### 8 · Parcerias-chave

O bloco mais vazio do quadro. Ver o achado C.

| Parceria | Estado |
|---|---|
| PSP com split | Futuro, e com risco declarado: subconta para pessoa física sem CNPJ pode não existir |
| Escola | Estágio 3. **Inverte a aquisição** — uma escola com seis vans puxa seis motoristas |
| Firebase / Google | Fornecedor, não parceiro. Mas é dependência crítica de fornecedor único |
| OpenStreetMap | Mapa sem chave e sem custo |
| Sindicato ou associação de transporte escolar | **Nunca considerado em nenhum documento** |

### 9 · Estrutura de custo

| Custo | Ordem de grandeza | Estado |
|---|---|---|
| **Tempo de consultor** | Dominante | **não medido** — ver o achado A |
| Suporte | Entra como aquisição, não operação | não medido |
| Infra por motorista | Centavos de Firestore por mês | estimado na Fase 0, falta confirmar |
| Trial de 3 meses | Dezenas de reais, recuperado no 1º mês pago | estimado |
| Fixo (domínio, dois sites de hosting) | Baixo | conhecido |

⚠️ **A cota gratuita do Firebase esconde o custo marginal.** Ela é diária e por
projeto, então com um motorista a fatura é praticamente zero e ninguém aprende
nada com ela. **O número que governa este bloco não é R$/motorista — é o ponto
de cruzamento**, o nº de motoristas em que a cota estoura e a infra passa a ter
inclinação. Pelo modelo de consumo derivado do código na Fase 0, ele fica na
casa de 6 a 13 motoristas, e o termo dominante é o leque do `liveLocation`: cada
escrita de GPS é cobrada uma vez **por responsável com o app aberto**. Uma
criança a mais custa quase nada; um pai a mais olhando a tela custa.

---

## 3. Os três achados

### A · O canal é escalável e a conversão não é

A indicação entrega o **lead**. Quem fecha é o consultor, um humano, um por vez.
Então a receita não cresce com o tamanho da rede — cresce com **horas de
consultor disponíveis**. É a tensão central do modelo, e ela não estava escrita
em lugar nenhum.

**O número que governa o negócio, portanto, não é o preço. É horas de consultor
por associado fechado** — exatamente o que a pendência 4 de
[negocio.md](negocio.md) chama de CAC e ninguém mediu.

⚠️ **Parte já é mensurável, e a parte que falta é a que importa.**
[funilService.js](../src/services/funilService.js) já grava `criadoEm` e
`fechadoEm` no lead, e `resumirFunil` já calcula conversão e ticket médio. Isso
dá o **ciclo de venda em dias** — que é outra coisa: um lead pode ficar 20 dias
parado consumindo 40 minutos de trabalho. Tempo decorrido não é esforço, e é o
esforço que vira CAC. Falta um campo de horas no lead.

**A saída estrutural** é fazer a indicação carregar parte da conversão: um
material que o motorista satisfeito encaminhe sozinho. Ele converte melhor que
consultor — é a rede avalizando — e custa zero. É a peça encaminhável da Fase 4.

### B · A atividade que decide a retenção não é a venda

A métrica do piloto é **famílias ativas por motorista** ([evolucao.md](evolucao.md)):
migrou 20 de 25, funciona; migrou 5, nada salva. E o momento em que isso se
decide não é a assinatura — é o **onboarding**, cadastrar a turma e fazer as
famílias resgatarem o convite.

Hoje esse trabalho está implicitamente na conta do motorista. Se ninguém o faz
por ele, ele faz pela metade, e o produto "não funciona" **sem que nada esteja
quebrado**.

**Consequência para o bloco 9: o CAC não termina na assinatura, termina na turma
migrada.** Contar só a venda subestima o custo de aquisição pelo trecho que mais
decide a permanência.

### C · O bloco de parcerias está quase vazio, e isso nunca foi examinado

Tudo é feito por conta própria. Duas parcerias mudariam a estrutura do quadro
inteiro, e só uma delas está no plano:

- **Escola** — está em [evolucao.md](evolucao.md) como estágio 3, com gatilho.
  Inverte a aquisição: seis vans de uma vez, e *"a Escola X usa"* vale mais que
  qualquer peça de marketing.
- **Sindicato ou associação de transportadores escolares** — **não aparece em
  nenhum documento do projeto.** É a única lista organizada de motoristas que
  existe, e é acesso a rede em bloco no mesmo canal de confiança que a indicação
  já usa. Merece ser examinada e recusada com motivo, ou perseguida — mas não
  ficar de fora por esquecimento.

---

## 4. Pendências

| # | Pendência | Trava | Estado |
|---|---|---|---|
| 1 | Ratificar o alvo da rodada | Cinco dos nove blocos | **aberta** — herdada de [personas.md](personas.md) |
| 2 | Medir **horas de consultor** por lead fechado | CAC, payback, e o teto de crescimento | **aberta** — falta campo no lead; o ciclo em dias já é derivável |
| 3 | O onboarding é do consultor ou do motorista? | Onde termina o CAC, e a métrica do piloto | **aberta** — ver o achado B |
| 4 | Sindicato/associação como canal: examinar ou recusar com motivo | Bloco 8 | **nova, aberta** |
| 5 | Confirmar o ponto de cruzamento da infra | Bloco 9, e a régua de preço | **aberta** — herdada da Fase 0 |

**Recomendação para a pendência 3: o onboarding é do consultor, e isso entra no
CAC.** É o trecho que decide a métrica do piloto, e deixá-lo com o motorista
transfere o risco para quem menos pode absorvê-lo — ele não sabe que fez pela
metade até o app parecer inútil.

---

## Manutenção

Este documento vale enquanto for verdade. Atualize-o **na mesma alteração** que:

1. Ratificar ou trocar o alvo da rodada — e então os cinco blocos marcados na
   tabela da seção 1 são reescritos, não o arquivo inteiro
2. Abrir, fechar ou recusar uma parceria (bloco 8)
3. Mudar quem faz a conversão ou o onboarding (blocos 3, 4 e 7)
4. Medir qualquer um dos custos do bloco 9 — trocar estimativa por número
   medido, e dizer que passou a ser medido

Se uma decisão daqui virar regra que o código precisa garantir, ela **também**
vira entrada em [decisoes.md](decisoes.md), com a linha de como verificar.
