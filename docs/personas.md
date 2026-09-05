# Personas e canvas de valor

Escrito em 05/09/2026, na Fase 1 do trabalho de estruturação do negócio. É a
matéria-prima do Business Model Canvas, do pitch comercial e de qualquer peça de
marketing — nenhum dos três deveria ser escrito sem passar por aqui.

> **O que sustenta estas personas, e o que não sustenta.** Um motorista
> associado e 18 famílias: é **n = 1 do lado de quem paga**. O que está escrito
> abaixo vem de três fontes verificáveis — o comportamento codificado no app, a
> conversa de consultor registrada em [negocio.md](negocio.md) e a base atual —
> mas nenhuma delas é pesquisa de campo. **Antes de travar o pitch comercial,
> cinco a oito conversas em portão de escola mudariam o que ele diz.** Enquanto
> isso não acontecer, cada persona daqui é hipótese fundamentada, não fato.

---

## 1. Quem paga não é quem usa

A estrutura que decide o negócio inteiro, e a razão de existirem **dois** canvas
de valor neste documento em vez de um:

| | Motorista | Responsável |
|---|---|---|
| Paga a plataforma | **Sim** — é a receita | Não, e nunca vai pagar |
| Decide a renovação | Assina | **Decide de fato** |
| Se parar de usar | Cancela | Ele volta pro caderno e cancela |

O motorista sustenta a receita; a responsável sustenta o hábito. **Se ela não
abre o app, o valor dele evapora e ele cancela** — sem que nenhum número do
painel do dono tenha mudado antes. Por isso as dores dela entram no modelo de
negócio com o mesmo peso das dele, mesmo ela não sendo cliente.

Um pitch não fala bem com os dois motoristas ao mesmo tempo, tampouco: o de
caderno precisa ouvir *sai do caderno*, e o de operação precisa ouvir *para de
depender de você*.

---

## 2. As três personas

A escola fica **de fora de propósito**. Ela é compradora do estágio 3 de
[evolucao.md](evolucao.md), e persona de futuro contamina persona de hoje —
o pitch começa a responder a uma objeção que ninguém fez ainda.

### 2.1 O motorista de caderno — faixa até 10, R$ 69

**Recorte:** 8 a 12 crianças, 2 ou 3 escolas. Van própria, dirige sozinho ou com
a esposa de monitora. Caderno brochura, um grupo de WhatsApp por escola, PIX na
chave pessoal. Cobra de R$ 200 a R$ 350 por criança.

> *"Eu conheço todo mundo. Tá tudo na minha cabeça."*

| | |
|---|---|
| **Tarefas** | Levar e trazer inteiro, todo dia · saber quem falta hoje **antes** de sair de casa · receber a mensalidade sem virar cobrador · provar que passou, quando alguém diz que não |
| **Dores** | Cobrar gente que ele encontra todo dia é a pior parte do mês · o grupo mistura "hoje ele não vai" com foto de aniversário · férias derrubam a receita e não derrubam a prestação da van · ele é o único ponto de falha da própria operação |
| **Ganhos** | Parecer profissional na fila do portão — isso é status real · não perder mensalidade por esquecimento · domingo à noite sem acertar caderno |
| **Objeção silenciosa** | *"Aplicativo vai querer uma parte do meu dinheiro."* |

**Por que a objeção dele importa mais que a do outro:** é exatamente a que a
marca já sabe responder, e a resposta é verificável no código — a mensalidade é
PIX direto pai→motorista, e a separação entre `dominio/cobranca/` e
`dominio/associacao/` existe para que misturá-las apareça como erro de lint.
Ver a seção 3 de [negocio.md](negocio.md).

### 2.2 O motorista com operação — faixa 26 a 40, R$ 229

**Recorte:** 25 a 40 crianças, duas vans ou van mais agregado, monitora
contratada. Já tem planilha e já cobra por PIX com chave própria. Não está no
caderno — está preso na própria memória.

> *"Se eu ficar doente uma semana, para tudo."*

| | |
|---|---|
| **Tarefas** | Coordenar duas rotas que ele não vê ao mesmo tempo · controlar quem pagou entre 35 famílias · cobrir a rota quando um motorista falta · manter a monitora informada sem estar junto |
| **Dores** | A planilha só ele entende, então só ele pode operá-la · delegar é impossível, o processo mora na cabeça dele · o crescimento parou nele, não no mercado · já tem um sistema, e trocar significa redigitar tudo |
| **Ganhos** | Crescer sem virar refém da própria operação · poder passar a rota para alguém um dia · enxergar a segunda van sem ligar pro motorista |
| **Objeção silenciosa** | *"Já tenho meu sistema. Vou ter que digitar tudo de novo."* |

⚠️ **Ele paga três vezes mais e é três vezes mais caro de converter.** Tem dado
para migrar (custo de troca real) e sente duas dores — cobertura mútua e
delegação — que **o produto de hoje não resolve**, e que só chegam no estágio 2
de [evolucao.md](evolucao.md). Vender para ele agora é prometer o que não existe.

### 2.3 A responsável — não paga nada, decide a retenção

**Recorte:** 28 a 42 anos, filho entre 5 e 11, trabalha fora. Não escolheu o
motorista sozinha: veio por indicação de outra mãe ou da secretaria da escola.
Confia nele pessoalmente, e é por isso que hoje aceita não ter informação
nenhuma durante o trajeto.

> *"Ele saiu de casa e eu não sei mais nada até chegar."*

| | |
|---|---|
| **Tarefas** | Saber que o filho chegou — na escola e em casa · avisar falta e ter **certeza** de que foi lido · pagar e guardar o comprovante onde ela ache depois · estar na porta quando a van encostar |
| **Dores** | A janela cega: saiu de casa, e nada até alguém avisar · quarenta mensagens no grupo, e o recado dela enterrado · comprovante de PIX perdido dentro da conversa · descer correndo, de pijama, quando a buzina toca |
| **Ganhos** | Paz durante o trajeto, sem ter que perguntar · não depender de ninguém ler o grupo · ver que o motorista dela é organizado |
| **Objeção silenciosa** | *"Mais um aplicativo pra eu ter que abrir."* |

---

## 3. Canvas de valor — o motorista

A disciplina do canvas não é listar o que o produto faz. É **parear cada dor com
o que a alivia, e olhar de frente as que ficaram sem par** — a coluna de encaixe
é o documento inteiro.

| Tarefa ou dor | O que o app faz hoje | Encaixe |
|---|---|---|
| Cobrar sem constranger | Gera o PIX, registra o recebimento e faz a cobrança chegar. Quem cobra passa a ser o app, não ele | **resolve** |
| Receber sem ter que cobrar todo mês | Só metade: o app organiza, mas a família ainda age todo mês. Cartão recorrente é o item 7 do roadmap | **pela metade** |
| Saber quem falta antes de sair | Declaração de falta cai direto no painel do dia, com teto de 14 dias ([faltas.js](../src/dominio/rota/faltas.js)) | **resolve** |
| Provar que passou | `rides`: um doc por criança por dia, com a hora de cada marco, no mesmo batch da mudança de status | **resolve** |
| Parecer profissional | A marca é **dele** — `marcaNome` e `marcaLogoURL` no cabeçalho do app da família, no lugar de "Início" | **resolve** |
| Não buzinar na rua | `pendingCalls` toca em tela cheia no celular do responsável | **resolve** |
| Férias não podem virar peso | Cobrança por criança ativa: ele desativa quem parou e a fatura cai sozinha | **resolve** |
| Cobrir quando a van quebra | Nada. É o estágio 2 — vínculo temporário com `ativoAte`, não construído | **não resolve** |
| Delegar sem perder o controle | Nada. Não existe segundo operador: uma conta, uma pessoa | **não resolve** |

**Como ler a coluna:** *resolve* = a dor tem par no produto de hoje. *pela
metade* = alivia, mas não elimina o trabalho. *não resolve* = sem par, **e o
pitch não pode prometer**.

---

## 4. Canvas de valor — a responsável

O encaixe aqui é quase perfeito, e é exatamente por isso que a última linha
importa tanto.

| Tarefa ou dor | O que o app faz hoje | Encaixe |
|---|---|---|
| A janela cega | Mapa ao vivo e status num cartão só, com a tarja do momento dizendo qual dos três estados do dia é aquele | **resolve** |
| Avisar falta e ter certeza | Dois toques, e o aviso aparece no painel do dia do motorista — não numa mensagem que pode não ser lida | **resolve** |
| Falar com o motorista agora | Fica no [Header](../src/components/layout/Header.jsx), em toda tela, e nunca desabilita | **resolve** |
| Não descer correndo | A chamada toca em tela cheia antes de ele encostar | **resolve** |
| Guardar comprovante | Histórico próprio em `/pai/financeiro`, fora da conversa do WhatsApp | **resolve** |
| Saber quando o app está mentindo | A tarja só nos dois casos graves, e o anel "AO VIVO" **para** quando o dado morre ([avisoDoMomento.js](../src/dominio/rota/avisoDoMomento.js)) | **resolve** |
| Ter razão pra voltar todo dia | Não se sabe — ver a seção 5 | **ponto cego** |

---

## 5. Os dois achados desta fase

O par de canvas não confirmou o que já se sabia. Produziu duas consequências,
uma para a comunicação e uma para o produto.

### 5.1 A dor mais forte é a que o produto resolve pela metade

A frase que o consultor trouxe do campo — *"tem tio que quer receber a
mensalidade dos pais pra não precisar ficar cobrando o pai toda vez"*, registrada
na seção 8 de [negocio.md](negocio.md) — é a dor mais aguda das duas fichas de
motorista. E é o **único item do roadmap que ainda não existe**: cartão
recorrente com split, último da fila porque depende de escolher PSP, revisar os
Termos e subir a `VERSAO_CONTRATO`.

⚠️ **Consequência direta para o pitch comercial: ele não pode liderar com essa
promessa.** Lidera com *"sai do caderno"* e com *"a mensalidade é sua"*, e trata
o cartão como direção, **nunca como data**. Isso não é cautela nova — é o item 4
da seção 8 de [negocio.md](negocio.md), que já diz para não anunciar antes de
existir. Prometer prazo a um autônomo e não cumprir custa a confiança que é a
visão declarada da empresa.

### 5.2 A métrica que decide se existe produto não está sendo medida

[evolucao.md](evolucao.md) diz que **famílias ativas por motorista** é a pergunta
do piloto: migrou 20 de 25, funciona; migrou 5, nenhum estágio adiante salva.

Só que **"ativa" hoje significa ter conta, não ter aberto o app** — e o próprio
código já admite isso, em [functions/lib/invites.js](../functions/lib/invites.js)
(*"Não existe sinal de atividade em `users` (sem lastSeen, sem lastLogin), então
'ativo' aqui significa TER CONTA"*). Não há `lastSeen`, não há `lastLogin`, e
`getPlatformOverview` conta documentos.

**Cadastrar 18 e ter 4 usando é indistinguível de sucesso no painel do dono.** E
como a retenção do pagante depende do uso dela (seção 1), esse é o ponto cego
mais caro do sistema: o número que deveria dizer se o produto existe está
medindo cadastro.

⚠️ **O conserto é pequeno e a ressalva não é.** Um carimbo de último acesso no
documento do responsável resolve — mas é **dado pessoal com finalidade nova**,
então entra na política de privacidade antes de entrar no código, e a finalidade
a declarar é *medir adoção*, não vigiar família. Se virar regra que o código
precisa garantir, vira também entrada em [decisoes.md](decisoes.md).

---

## 6. Pendências desta fase

| # | Pendência | Trava | Estado |
|---|---|---|---|
| 1 | **Qual motorista é o alvo desta rodada** | Business Model Canvas, pitch comercial, régua de preço | **aberta** — recomendação abaixo |
| 2 | Instrumentar a adoção da responsável | A métrica do piloto | aberta — recomendado: sim, com finalidade declarada |
| 3 | Validar as personas em campo | Pitch comercial | aberta — recomendado: 5 a 8 conversas em portão |

**Recomendação para a pendência 1: o motorista de caderno.** Três razões
somadas — a objeção dele é a que a marca já sabe responder; o custo de troca é
zero, porque não há dado para migrar; e ele é a maioria da fila do portão, que é
onde o canal de indicação vive (seção 7 de [negocio.md](negocio.md)). O de
operação paga três vezes mais, mas tem planilha para migrar e sente duas dores
que o produto ainda não resolve.

---

## Manutenção

Este documento vale enquanto for verdade. Atualize-o **na mesma alteração** que:

1. Trocar o alvo da rodada, ou acrescentar/remover uma persona
2. Fechar um "não resolve" ou um "pela metade" de qualquer um dos dois canvas —
   a coluna de encaixe é o que este arquivo tem de mais perecível
3. Substituir hipótese por pesquisa de campo — quando as conversas em portão
   acontecerem, a ressalva do topo sai e as personas passam a citar a fonte

Se uma decisão daqui virar regra que o código precisa garantir, ela **também**
vira entrada em [decisoes.md](decisoes.md), com a linha de como verificar.
