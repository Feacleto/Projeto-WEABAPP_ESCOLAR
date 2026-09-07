# O console de gestão — plano e backlog

Escrito em 06/09/2026, depois que o modelo comercial virou autoatendimento com
preço de tabela ([plano-fases.md](plano-fases.md), fases 0 a 7).

**Este arquivo não é normativo.** Ele registra o que vai ser construído, em que
ordem e **por quê cada escolha foi feita assim**. O que virar lei vai para
[decisoes.md](decisoes.md). Quando a última fase fechar, este arquivo some.

---

## O problema que ele resolve

O painel do dono mede o negócio e **não deixa fazer nada com ele**. Não existe
"abrir o motorista X e ver tudo dele": ele aparece em pedaços, em duas abas, e
nenhuma permite agir.

E o modelo novo tirou a pessoa do caminho da venda — mas **não do caminho da
retenção**. Com 5 associados você olha tudo. Com 50, você não olha nada, e
descobre o problema pela fatura que não veio.

> **O que escala não é ter mais telas. É parar de varrer tabela.**

O console tem um objetivo só: transformar "olhar o painel" em "resolver a fila".

---

## O que já está decidido

| Decisão | Escolha |
|---|---|
| Abas | **Motoristas · Mês · Números · Pesquisa** |
| Proposta | WhatsApp com o texto do degrau dele, **editável antes de enviar** |
| Concessão | desconto ou meses grátis, com **motivo e prazo obrigatórios** |
| Uso | última rota + rotas no mês |
| Indicação | programa completo |
| Selo | **dois**: adesivo de rua (todos) e certificado (conquistado) |
| Documento do certificado | **alvará de transporte escolar**, não CNH |
| Endereço de entrega | guardado, **em `taxaParceiros`** |
| Layout | desktop primeiro, responsivo — a ficha vira tela cheia no celular |

---

## O que este plano NÃO vai construir

| | Por quê |
|---|---|
| Pipeline de vendas | é o funil voltando. Ele morreu porque a venda deixou de ter etapas |
| Disparo em massa | mensagem sem contexto é o oposto do que faz a proposta funcionar |
| Score preditivo | com dezenas de associados, quatro sinais explicáveis batem qualquer modelo |
| Chat interno | a [decisão 13](decisoes.md) já recusou, e o argumento continua valendo |
| Desconto caso a caso sem registro | é o orçamento com outro nome — ver a Fase 12 |

---

# ✅ Fase 8 · A aba Motoristas e a ficha — FEITA em 06/09/2026

**Por que primeiro:** é o recipiente de quase tudo o que vem depois, e sozinha
já é o console que faltava.

### Backlog

| # | Item | De onde vem o dado |
|---|---|---|
| 8.1 | Reorganizar as abas para **Motoristas · Mês · Números · Pesquisa**, com Motoristas como padrão | — |
| 8.2 | Lista de motoristas: nome, crianças (ativas/teto), faixa, estado, MRR dele | `users` + `carteira.js`, que já calcula o degrau |
| 8.3 | Ficha: **master-detail** no desktop, tela cheia no celular | — |
| 8.4 | Na ficha — identidade, contato e botão de WhatsApp | `users` |
| 8.5 | Na ficha — estado da conta **e por quê** | `estadoDaConta()` |
| 8.6 | Na ficha — plano, teto × ativas, preço já com descontos | `precoDoMes()` |
| 8.7 | Na ficha — **contrato assinado**, com o `ContratoDoc` | `contratosAssociacao` |
| 8.8 | Na ficha — histórico de faturas do parceiro, com dar baixa | `watchFaturasDoParceiro()` |
| 8.9 | Na ficha — **nota interna** do dono | `taxaParceiros.notaInterna` |
| 8.10 | Na ficha — nota das famílias dele | `feedbacks` |
| 8.11 | Na ficha — GMV dele (o tamanho da operação) | `payments` |
| 8.12 | Botão **Propor**, com o texto do degrau em que ele está | `carteira.js` |
| 8.13 | Sair da Visão geral: "Tamanho da base" como manchete e o GMV do destaque | — |

**Todos os 13 itens entregues.** A nota das famílias (8.10) precisou de uma
junção que não existia: `feedbacks` não guarda `adminUid`, e quem sabe a que
motorista uma família pertence é o documento dela. A conta ficou em
`notasPorMotorista()`, pura e testada.

E a proposta (8.12) virou régua própria em `dominio/associacao/proposta.js`,
com 29 casos — quatro mensagens, e a garantia de que a de resgate **não promete
desconto** e a de quem está acima da tabela **não escreve preço nenhum**.

⚠️ **8.7 e 8.9 eram regressões minhas, e foram repostas.** A `TaxaTab` antiga
acompanhava `contratosAssociacao` e mostrava a nota interna; a reescrita da fase
3 removeu as duas sem repor, e por dois dias não houve como ver o que o
motorista assinou. Ficam registradas aqui porque a lição não é sobre elas: toda
reescrita de tela precisa listar o que a versão anterior mostrava antes de
apagar o arquivo.

### As quatro mensagens de proposta (8.12)

O botão lê o degrau e escreve a mensagem daquele degrau, com os números dele
dentro. Um botão, quatro textos:

| Degrau | O que a mensagem faz |
|---|---|
| não rodou | **ativação** — "precisa de ajuda pra cadastrar a turma?" |
| em teste | **conversão** — a faixa dele, o preço com antecipação, o prazo |
| bloqueado | **resgate** — "volta, eu libero a antecipação até sexta" |
| ativo | **indicação** — "conhece um colega?" |

Você lê e edita antes de enviar. **Nada sai sem você ver.**

---

# ✅ Fase 9 · A caixa de chamados — FEITA em 06/09/2026

**Por que agora:** é a maior lacuna do painel, e é a única em que alguém já
está falando com você.

`supportTickets` existe. O motorista **e** o responsável abrem chamado pelo
menu de perfil, a coleção recebe, as rules liberam o dono — e **nenhuma tela do
dono lê**. Quem pede ajuda e não recebe resposta cancela, e não diz por quê.

### Backlog

| # | Item |
|---|---|
| 9.1 | Estado no chamado: `aberto → respondido → fechado` |
| 9.2 | Caixa de entrada, com o chamado aberto há mais tempo no topo |
| 9.3 | Responder — por WhatsApp, com o contexto do chamado montado |
| 9.4 | O chamado aparece na ficha de quem o abriu |
| 9.5 | Contador de chamados sem resposta, para a fila da Fase 11 |

**Os cinco itens entregues**, e o painel voltou a ter cinco abas: Motoristas ·
**Chamados** · Mês · Números · Pesquisa. Elas quebram em duas linhas no celular
com `flex-wrap` — a tira que rola esconde o fim, e foi assim que a Taxa ficou
invisível por tanto tempo.

A régua ficou pura em `dominio/suporte/chamados.js` (27 casos), e ela nasceu com
o SÉTIMO contexto do projeto — a tabela do CLAUDE.md dizia seis.

⚠️ **Chamado de responsável não é chamado de motorista.** O responsável é
cliente do motorista, não seu — responder direto a ele passa por cima de quem
presta o serviço. A caixa separa os dois, e a TELA diz isso: o de responsável
sugere avisar o motorista dele em vez de responder por cima.

---

# Fase 10 · Uso e risco

**Por que agora:** abandono é o que antecede o cancelamento, e hoje ele é
invisível.

### Backlog

| # | Item | Onde |
|---|---|---|
| 10.1 | `users.ultimaRota` — gravado no mesmo gesto que já grava `trialInicio` | `trialService` |
| 10.2 | `users.rotasNoMes` — `{ mes, total }`, por `increment()` no mesmo lote | idem |
| 10.3 | Série de crianças por mês | **já existe**: cada fatura guarda `criancasAtivas` |
| 10.4 | Termômetro de risco, com os sinais listados | puro, testável |
| 10.5 | Rules: decidir se os dois campos novos entram na lista proibida | `firestore.rules` |

### O termômetro (10.4)

Quatro sinais, e a ficha diz **quais** dispararam:

| Sinal | Fonte |
|---|---|
| parou de rodar | `ultimaRota` |
| está encolhendo | série de `criancasAtivas` |
| atrasou | `faturasParceiro` |
| famílias reclamando | `feedbacks` |

⚠️ **Score sem explicação ninguém usa duas vezes.** O número existe para
ordenar a lista; o que decide é a frase que diz por quê.

⚠️ **A data é o número principal, o contador é o complemento.** Data não
desanda; contador desanda — `criancasAtivas` já ensinou isso aqui.

**Os cinco itens entregues.** A régua ficou pura em
`dominio/associacao/risco.js` (34 casos, `npm run testar:risco`), o ponto de
risco entrou na lista de motoristas e o bloco de motivos entrou na ficha.

⚠️ **O item 10.5 foi decidido AO CONTRÁRIO do que este plano dizia**, e o
registro fica aqui porque é uma reversão, não um esquecimento. Os dois campos
NÃO entraram na lista proibida: o motorista escreve o próprio sinal de uso.

A diferença dos campos que estão na lista é o que está em jogo. Mentir em
`ultimaRota` faz ele parecer ativo e sumir de uma lista de acompanhamento;
mentir em `trialInicio`, `limiteCriancas` ou `assinaturaAte` seria não pagar.
Um é sinal de saúde, o outro é cláusula — e só a cláusula justifica travar. Pôr
o sinal atrás de uma function significaria esperar cold start com o passageiro
na porta, que é a regressão que a decisão 2 já recusou.

No dia em que o uso valer desconto ou prazo, ele vira cláusula e sobe para a
lista. `scripts/testar-regras.mjs` tem o caso `uso` escrito para essa mudança
de ideia aparecer.

⚠️ **O risco desempata dentro do degrau, não por cima dele.** O degrau é o
ESTADO da relação; o risco é um aviso dentro desse estado. Deixá-lo mandar na
ordem geral misturaria um contratado que parou de rodar com um teste que vence
amanhã — duas conversas diferentes, e a segunda tem data.

⚠️ **O termômetro é calculado UMA VEZ, na lista, e desce por prop para a
ficha.** Recalcular lá com outra fonte faria o mesmo motorista aparecer em dois
níveis na mesma tela. Por isso `carregarConsole()` passou a trazer também
`faturasParceiro` inteira, agrupada por parceiro.

---

# Fase 11 · A fila do dia

**Por que depois:** ela não tem conteúdo próprio. É a soma das três fases
anteriores, apresentada como trabalho em vez de relatório.

```
PRECISA DE VOCÊ HOJE                          7
──────────────────────────────────────────────
🔴  Marcos não roda há 6 dias · teste em 9d
🔴  Chamado sem resposta há 2 dias
🟠  Nino: teste acaba em 4 dias
🟠  Fatura de agosto atrasada há 8 dias
🟠  Documento enviado, aguardando revisão
⚪  Carla perdeu 3 crianças este mês
```

### Backlog

| # | Item |
|---|---|
| 11.1 | Agregador puro: recebe carteira, chamados, faturas e uso; devolve a lista ordenada |
| 11.2 | Três níveis de urgência, e a cor **não é o único sinal** — a ordem também é |
| 11.3 | Cada linha abre a ficha já na seção certa |
| 11.4 | Fila vazia mostra "nada precisa de você hoje", não uma lista em branco |

⚠️ **Fila que nunca esvazia deixa de ser lida.** Só entra o que tem ação
possível — "3 associados sem indicar há 60 dias" é relatório, não fila.

**Os quatro itens entregues.** A régua ficou pura em
`dominio/associacao/fila.js` (37 casos, `npm run testar:fila`), e a aba **Hoje**
virou a primeira do painel — a terceira aba padrão desde que o painel existe, e
pelo mesmo motivo das duas anteriores: a lista de motoristas responde "com quem
eu falo", mas ainda exige varrer a carteira para descobrir com quem.

⚠️ **UMA LINHA POR MOTORISTA, A MAIS URGENTE.** Um associado pode disparar
quatro sinais ao mesmo tempo. Quatro linhas fariam o contador dizer "7" onde o
dia tem três conversas — e o número no topo é a única coisa que alguém lê antes
de decidir se abre a tela. Os outros motivos viram detalhe da mesma linha.

A exceção é o chamado (uma linha por chamado: cada um é uma resposta
diferente) e o fechamento do mês, que é UMA linha para todas as faturas —
vinte faturas por fechar são um gesto na aba Mês, não vinte pendências.

⚠️ **Suspenso não entra.** Quem suspendeu foi o dono; a fila cobrando dele uma
decisão que ele já tomou é exatamente o ruído que a faz parar de ser lida.

⚠️ **O teste acabando ganha do termômetro**, e o motivo é a data: a conversa do
risco pode ser amanhã, a do teste que vence em dois dias não pode.

**11.3 saiu sem âncora.** O bloco de risco é a primeira coisa dentro da ficha,
acima de plano e contrato — então "abrir na seção certa" é abrir a ficha.
Âncora dentro de uma tela que cabe numa dobra é precisão falsa.

---

# Fase 12 · Concessões e condições

**Por que depois da ficha:** conceder sem ver o histórico é conceder no escuro.

### Backlog

| # | Item |
|---|---|
| 12.1 | Folha de conceder: **desconto com prazo** ou **meses sem fatura** |
| 12.2 | **Motivo e prazo obrigatórios**, mais quem concedeu e quando |
| 12.3 | `origem: 'concessao'` em `users.descontos` — estrutura já existe |
| 12.4 | O painel separa **desconto de régua** (política) de **concessão** (exceção) |
| 12.5 | Tabela de condições vigentes: quem tem o quê e até quando |
| 12.6 | **Contador de fundadores: `3 de 13`** |
| 12.7 | A concessão entra no contrato como qualquer outro desconto |

⚠️ **12.6 não existe e é dinheiro.** São 1 vitalício + 12 pela metade, e não há
contador nenhum — dá para conceder o 14º sem perceber. Vitalício não expira.

⚠️ **A concessão é a porta pela qual o orçamento pode voltar.** Prazo e motivo
são a tranca. E se daqui a três meses metade dos associados tiver concessão
ativa, **a tabela é que está errada** — o painel mostra isso em vez de esconder
numa média.

**Os sete itens entregues.** A régua ficou pura em
`dominio/associacao/concessao.js` (53 casos, `npm run testar:concessao`), e
`users.concessoes` nasceu já na lista de campos que o cliente não escreve — com
três casos em `testar:regras` (171 no total).

⚠️ **REGISTRO E EFEITO SÃO CAMPOS DIFERENTES, E VÃO NO MESMO LOTE.**
`users.concessoes` guarda tipo, prazo, motivo, quem concedeu e quando — é o que
alguém lê seis meses depois. `users.descontos` (ou `users.isencaoAte`) é o que
`precoDoMes` e `fecharFatura` leem para a conta sair menor; nenhuma das duas
sabe o que é uma concessão, e não deveria — elas cobram, não julgam.

Separados, existiriam os dois estados errados: a concessão registrada que nunca
chega na fatura (e o associado paga cheio depois de ouvir que não pagaria), e o
desconto na fatura que ninguém consegue explicar. É a mesma amarra de `planoId`
+ `limiteCriancas`.

⚠️ **UMA CONCESSÃO POR VEZ — a nova substitui a anterior.** Empilhar é como o
preço desanda sem ninguém decidir: 30% em março mais 30% em agosto, e a ficha
diz 30% enquanto a fatura cobra 60%.

⚠️ **Isenção não é desconto de 100%**, e a folha recusa 100% mandando usar o
outro botão. Uma diz que o mês não tem fatura, a outra produz fatura de R$ 0 —
os dois chegam a zero e contam histórias diferentes no extrato.

**12.6 entregue, e o contador aceita ficar negativo.** `restamVitalicio: -1` é
exatamente o caso que ele existe para pegar; zerar em zero o esconderia. A
linha aparece acima da lista de motoristas, e fica âmbar quando estourou ou
quando metade da carteira tem exceção ativa.

---

# Fase 13 · O selo

São **dois selos**, com economias opostas. Tratá-los como um só foi o que
confundiu a conversa inicial.

|  | Adesivo de rua | Certificado |
|---|---|---|
| Diz | "usa Alô Buzinou · acompanhe a rota" | "documentos em dia · 09/2026" |
| Quem tem | todo associado, desde o teste | quem enviou alvará e foi aprovado |
| Quem paga | você — **é sua mídia na van dele** | você — é seu tempo |
| Ganha como | pedindo | **conquistando** |

> **Valor não vem de preço. Vem de exigência.** Pago, ele acha abusivo.
> Automático, não vale nada. Conquistado resolve os dois.

### 13a · Adesivo de rua

| # | Item |
|---|---|
| 13a.1 | Endereço de entrega em **`taxaParceiros/{uid}`** |
| 13a.2 | Pedido no app do motorista, uma vez |
| 13a.3 | Estados: `pedido → postado → entregue` |
| 13a.4 | O estado aparece **nos dois lados** |

⚠️ **O endereço NÃO pode ir para `users`.** O documento `users` do motorista é
legível pelas famílias dele — é a regra que dá à mãe a chave PIX e o telefone.
Endereço residencial ali expõe onde ele mora a toda família que ele atende.

⚠️ **O texto do adesivo não pode afirmar segurança.** Ele fica na van, fala com
quem nunca abriu o app, e não dá para voltar atrás. O [marca.md](marca.md)
registra que prometer segurança seria "a única mentira grande deste conjunto".

### 13b · Certificado

| # | Item |
|---|---|
| 13b.1 | Caminho novo no Storage para o **alvará de transporte escolar** |
| 13b.2 | Estados da [decisão 6](decisoes.md): `nao_iniciada → enviada → verificada \| recusada` |
| 13b.3 | Revisão no painel, e o motivo da recusa volta para ele |
| 13b.4 | O selo aparece **na tela em que a família aceita o convite** |
| 13b.5 | Data de conferência impressa no selo e mostrada no app |
| 13b.6 | Vencimento do alvará entra na fila quando se aproxima |

⚠️ **Alvará, não CNH — e o motivo é técnico, não de pudor.** Para emitir o
alvará, a prefeitura já exige CNH categoria D, curso de transporte escolar,
antecedentes criminais e vistoria. Conferir o alvará te apoia numa conferência
que o poder público já fez, sem você guardar documento de identidade — que, se
vazar, é material de fraude pronto. E é mais forte: "alvará municipal em dia"
diz mais que "vi a CNH dele".

Exceção: município que não emite alvará. Só aí, CRLV + vistoria + CNH.

⚠️ **A decisão 6 está "aceita · firme" e nunca foi implementada.** Não existe
campo, tela nem regra. Esta fase é a primeira implementação dela — e o
`verificado paga régua melhor` que ela promete continua pendente de decisão.

⚠️ **A conferência é trabalho seu e não escala sozinha.** É a primeira coisa
desde que o consultor morreu que **volta a te pôr no caminho crítico**.

---

# Fase 14 · Indicação, completa

Hoje existe só a **conta** do desconto: `indicacoesAtivas`, um número que só o
dono escreve. Não há registro de quem indicou quem.

### Backlog

| # | Item |
|---|---|
| 14.1 | Coleção `indicacoes`: indicador, telefone normalizado, status |
| 14.2 | **Normalização do telefone** — com e sem 9º dígito, com e sem DDI |
| 14.3 | Recusa de auto-indicação |
| 14.4 | Status `pendente → cadastrado → ativa` |
| 14.5 | O desconto entra quando o indicado **paga o primeiro mês** |
| 14.6 | Tela do motorista: link para compartilhar e o que já rendeu |
| 14.7 | Na ficha: quem ele indicou e quem o indicou |

⚠️ **A carência não é burocracia.** Sem ela, cinco cadastros de teste dariam
50% de desconto real sobre receita que nunca entrou.

⚠️ **As duas falhas possíveis produzem a mesma queixa** — *"indiquei e não
recebi"* —, e numa rede de indicação a reclamação viaja mais rápido que a
indicação. Por isso 14.2 e 14.3 vêm com teste próprio **antes** de qualquer
tela.

---

# Fase 15 · Subconta no gateway — a pesquisa

Custo quase zero, e o resultado **mata ou justifica uma fase inteira**.

O [negocio.md §8](negocio.md) escolheu **split, nunca escrow**, e nomeia o
risco: boa parte dos PSPs exige CNPJ para subconta com split, e o modelo
decidiu que o motorista **não precisa de MEI**.

### Backlog

| # | Item |
|---|---|
| 15.1 | No app do motorista: "quero receber a mensalidade por cartão" |
| 15.2 | Registro do interesse, com data |
| 15.3 | No painel: quantos querem, e quem |

⚠️ **Não prometer nada.** O texto pergunta interesse, não anuncia recurso. O
`negocio.md` é explícito: *"não anunciar antes de existir — prometer data para
um autônomo e não cumprir custa a confiança que é a visão da empresa"*.

Pode ser feita a qualquer momento. É a única fase que **não depende de nenhuma
outra**.

---

## Ordem recomendada

**8 → 9 → 10 → 11** é o núcleo: depois dessas quatro, você tem o console.
As três primeiras usam dado que já existe; a 11 só costura.

**12** logo depois, porque é o que te dá controle de retenção sem reabrir a
negociação.

**15** a qualquer momento — é uma tela e um campo.

**13 e 14** por último: são as únicas que nascem do zero, e as únicas que
trazem responsabilidade nova junto (documento de terceiro, e promessa de
desconto a quem indicou).

---

## Manutenção deste arquivo

Fase fechada é riscada aqui e resumida em [plano-fases.md](plano-fases.md). O
que virar regra que não pode ser quebrada vai para
[decisoes.md](decisoes.md) — em especial:

- o selo não afirma segurança (13a);
- concessão sem prazo e motivo não existe (12);
- o desconto de indicação só nasce com o primeiro pagamento (14).
