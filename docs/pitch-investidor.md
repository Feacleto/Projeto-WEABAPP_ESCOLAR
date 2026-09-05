# Pitch investidor

Escrito em 05/09/2026, na Fase 5 do trabalho de estruturação do negócio.

⚠️ **A decisão de captação já foi tomada, e foi "não".** O plano é crescer com
receita. Este documento existe mesmo assim, e a seção 1 diz por quê — mas quem
chegar aqui procurando o plano de captação da empresa está no arquivo errado:
não há um.

---

## 1. Três usos legítimos deste deck

**1. Escrever o deck é o exercício, mesmo que ele nunca saia.** A estrutura de um
pitch obriga a responder onze perguntas em ordem, e é implacável com quem não
tem resposta. Duas pendências desta rodada nasceram aqui — as da seção 6.

**2. Um parceiro estratégico não é um investidor.** Uma rede de escolas que
adote muda a aquisição inteira (estágio 3 de [evolucao.md](evolucao.md)): seis
vans de uma vez. A conversa com ela pede as mesmas onze respostas, e não pede
dinheiro nenhum.

**3. Oportunidade tem prazo, e material não se improvisa.** Se a conversa
aparecer, ela aparece com duas semanas de aviso.

**O que este deck NÃO é:** um plano. Enquanto a régua de preço se sustentar, a
infra custar centavos e o canal for gratuito, **este negócio fecha sem aporte**
— e captar com um cliente significa ser avaliado por uma tração que não existe,
vendendo barato o que a arquitetura já protege.

---

## 2. O estágio, dito em voz alta

| | |
|---|---|
| Associados pagantes | **1** |
| Famílias | 18 |
| Receita recorrente | próxima de zero — a régua de preço nem foi ratificada |
| Churn | não existe: base de 1 |
| LTV | sem histórico |
| CAC | não medido |
| Produto | **no ar, completo, em produção** |

Isso é pré-seed, ou família e amigos. **Não é deck de seed**, e apresentá-lo
como tal é a maneira mais rápida de queimar a única coisa que existe aqui, que é
credibilidade. A declaração 8 do manifesto ([marca.md](marca.md)) vale para
investidor igual vale para motorista.

⚠️ **E não vai existir número de retenção tão cedo.** O trial é de três meses;
churn e LTV só começam a significar alguma coisa uns seis meses depois do
primeiro associado pagante. Um deck feito hoje é feito **sem** os números que um
investidor pede primeiro, e essa é uma razão de peso para ele ficar na gaveta.

---

## 3. A tese, em quatro afirmações

Nenhuma delas depende de tração — foi esse o critério de seleção.

### 3.1 O produto está construído, e isso é raro no estágio

A maioria dos pitches nesta fase tem apresentação e protótipo. Aqui há software
em produção: 37 services, `firestore.rules` de 71 KB, camada de domínio pura com
bateria de testes, CI rodando lint, testes e build. **O risco de execução técnica
já foi pago.**

### 3.2 A promessa central é arquitetural, não editorial

*"A mensalidade da sua família é sua"* não é política de empresa que uma reunião
muda. Os dois dinheiros estão separados em **quatro camadas independentes** —
coleção, pasta de domínio, tela e Termos de Uso — para que misturá-los apareça
como erro de lint antes de virar produto.

**É o que o concorrente não copia sem reescrever o próprio modelo de receita**,
porque quase todo concorrente vive de percentual sobre a mensalidade. É o mais
próximo de fosso que este negócio tem, e ele é verificável em minutos.

### 3.3 A unidade de cobrança resolve sazonalidade sem código

A cobrança é por **criança ativa**. Três efeitos que um investidor reconhece:

- **Expansão sem venda nova** — de 12 para 20 crianças e a receita sobe sozinha.
- **Retenção em janeiro e julho.** Férias derrubam a fatura em vez de derrubar o
  cliente. É exatamente o mês em que um autônomo cancela software, e aqui o
  software fica mais barato em vez de virar peso morto.
- **Preço que acompanha o valor entregue**, sem plano capado e sem negociação
  a cada crescimento.

### 3.4 O canal é gratuito e denso

Motoristas de perua fazem fila no mesmo portão todo dia. Indicam cliente entre
si, cobrem rota um do outro, avisam da rua que fechou. **É rede de alta
confiança e custo zero de acesso** — e a estratégia declarada é crescer por ela,
não por mídia paga.

---

## 4. O que é fraco, e por que fica no deck

Investidor desconta o que você esconde por muito mais do que o que você declara.
E aqui há uma razão a mais: a visão da empresa é *referência em confiança*, e um
deck que a contradiz na primeira reunião não vale o dinheiro que traria.

| Fraqueza | Como fica no deck |
|---|---|
| **Um cliente** | Dito no primeiro terço, com número. Não escondido no apêndice |
| **A conversão não escala** | A indicação entrega o lead, o consultor fecha um por vez ([canvas-negocio.md](canvas-negocio.md), achado A). É a pergunta que o investidor vai fazer — melhor ela sair da sua boca |
| **Dependência de uma pessoa** | Produto, venda e suporte na mesma cabeça |
| **CAC desconhecido** | Ver a seção 7: é o portão |
| **Fornecedor único** | Firebase é dependência crítica. Migrar tem custo real |
| **Degrau regulatório no estágio 4** | Quando a plataforma passar a **apresentar** motorista a família, provavelmente entra na cadeia de uma atividade regulada. Já está escrito em [evolucao.md](evolucao.md), com os três pré-requisitos |

⚠️ **A última é a que mais impressiona bem**, e por um motivo contraintuitivo:
poucos fundadores mapeiam o próprio risco regulatório antes de alguém perguntar.
Ela está documentada desde antes de existir deck.

---

## 5. A estrutura — onze slides

| # | Slide | O que entra | O que NÃO entra |
|---|---|---|---|
| 1 | A frase | *"O transporte escolar saiu do caderno."* | Logo gigante, tagline dupla |
| 2 | O problema | Dinheiro e confiança no mesmo grupo de WhatsApp, entre a foto de aniversário e o bom dia | Estatística de país que você não mediu |
| 3 | Quem paga | O motorista autônomo de caderno, ficha de [personas.md](personas.md) | "Todo mundo que tem filho" |
| 4 | O produto | **Três telas**, não vinte funcionalidades: o dia do motorista, o mapa da mãe, a cobrança | Lista de features |
| 5 | Por que a promessa se sustenta | Os dois dinheiros em quatro camadas — seção 3.2 | Adjetivo. Mostre a estrutura |
| 6 | Receita | Criança ativa, por faixa. Recorrente. Expande e retrai sozinha | Projeção de cinco anos em hóquei |
| 7 | Canal | A fila do portão. Indicação, custo zero | "Marketing digital" |
| 8 | Onde estamos | **1 associado, 18 famílias, produto no ar.** Com essas palavras | Suavização. Ver a declaração 8 |
| 9 | A alavanca | A escola: seis vans de uma vez, com gatilho definido | Prometer que já está acontecendo |
| 10 | **O que a gente não faz** | Anúncio, percentual, escrow, descoberta sem parecer jurídico — cada um com o motivo | Nada. Este slide é o diferencial |
| 11 | O pedido | Quanto, para quê, e **qual marco ele compra** | Pedido sem marco |

⚠️ **O slide 10 é o mais valioso do conjunto, e quase ninguém o tem.** Uma lista
de recusas fundamentadas lê como julgamento — e cada uma das quatro está
documentada em [negocio.md](negocio.md) seção 11, com o raciocínio, desde antes
de existir investidor para impressionar. É a diferença entre parecer disciplinado
e ser.

---

## 6. Os números — o que existe, o que falta

**Existe hoje, e é confiável:** GMV e receita saem de
[adminMetricsService.js](../src/services/adminMetricsService.js) com critério
declarado — receita é fatura `quitada`, GMV é `payments` com `paid`. Conversão e
ticket médio do funil saem de `resumirFunil`.

⚠️ **Nunca some GMV e receita no mesmo gráfico.** O dinheiro que passa entre pai
e motorista **não é seu** — a plataforma não o toca. Somá-los transforma um SaaS
de R$ 149 num "marketplace de R$ 5.000 por motorista", e é o erro clássico de
valuation neste formato. Um investidor que perceba isso encerra a conversa, e com
razão.

**Falta, e o deck não fecha sem:**

| Número | Onde buscar | Estado |
|---|---|---|
| Frota de transporte escolar no Brasil | SENATRAN/DENATRAN, frota por espécie e tipo | pendência 7 de [negocio.md](negocio.md) |
| Alunos que usam transporte escolar | Censo Escolar / INEP, e IBGE | aberta |
| Custo de infra por motorista | Console do Firebase, aba **Uso** — não a fatura | estimado na Fase 0 |
| **Horas de consultor por fechamento** | Não existe campo | **o portão — ver a seção 7** |

⚠️ **Nenhum número de mercado é citado aqui de propósito.** Número de tamanho de
mercado que entra num deck sem fonte verificada é o tipo de coisa que o
investidor confere no intervalo — e errar o próprio mercado custa a reunião
inteira. Busque, cite a fonte e a data no rodapé do slide.

---

## 7. O portão: não capte antes de medir isto

A conclusão mais importante do documento, e ela vem direto do achado A de
[canvas-negocio.md](canvas-negocio.md).

**Se o CAC é dominado por tempo de consultor, então dinheiro de investidor
compra uma coisa só: capacidade de venda** — mais gente conversando com mais
motoristas. Não compra produto, que já existe; não compra canal, que é gratuito;
não compra infra, que custa centavos.

**E você não sabe quanto custa uma hora de consultor por fechamento.**

⚠️ **Captar antes de medir isso é comprar uma unidade desconhecida em escala.**
Se um associado exige seis horas para fechar, o modelo não suporta consultor
contratado a R$ 149 de ticket, e o aporte financia uma máquina que perde
dinheiro mais rápido. Se exige quarenta minutos, o negócio escala sozinho e o
aporte era desnecessário. **Os dois cenários acabam no mesmo conselho: meça
primeiro.** É a pendência 2 de [canvas-negocio.md](canvas-negocio.md), e ela
custa um campo no lead.

**O marco que torna este deck apresentável** — e que, não por acaso, é o mesmo
que torna a captação desnecessária:

1. Régua de preço ratificada e cobrada de verdade
2. **Cinco a dez associados pagantes**, com horas de consultor medidas em cada um
3. Seis meses de base, para churn significar alguma coisa
4. Adoção da responsável instrumentada — a métrica que decide se existe produto
   ([personas.md](personas.md), achado 5.2)

---

## 8. Pendências

| # | Pendência | Trava | Estado |
|---|---|---|---|
| 1 | **Medir horas de consultor por fechamento** | Todo o resto — é o portão da seção 7 | **aberta**, herdada de [canvas-negocio.md](canvas-negocio.md) |
| 2 | Dados de mercado com fonte | Slides 2 e 9 | **aberta** — pendência 7 de [negocio.md](negocio.md) |
| 3 | Escrever os slides 5 e 10 | São os dois diferenciados; os outros nove são montagem | **aberta** — e são os únicos que valem tempo agora |

**Recomendação:** não monte o deck. **Escreva só os slides 5 e 10** — a promessa
arquitetural e a lista de recusas. São os dois que não se improvisam em duas
semanas, os dois que servem igualmente para a conversa com uma escola, e os dois
cujo conteúdo já existe e só precisa de forma. Os outros nove se montam num fim
de semana, no dia em que houver motivo.

---

## Manutenção

Este documento vale enquanto for verdade. Atualize-o **na mesma alteração** que:

1. Mudar a decisão de captação — e então a seção 1 inteira é reescrita
2. Passar de 1 para vários associados pagantes — a seção 2 é a que envelhece
   primeiro, e ela precisa envelhecer para o documento continuar honesto
3. Medir horas de consultor por fechamento — e aí a seção 7 deixa de ser portão
   e vira número no slide 11
