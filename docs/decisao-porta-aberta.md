# A porta aberta

**Decisão proposta:** abandonar a fila de espera do motorista e, junto com ela,
a ideia de que o acesso é concedido por um link.

**Data:** 30/08/2026 · **Estado:** proposta, nada implementado

---

## As duas decisões são uma só

Elas chegaram como dois assuntos e são o mesmo. A indicação parecia estranha
porque `indicar` significava *mandar alguém para uma porta que não abre*: o
sistema é fechado, quem chega pelo link não entra, e o link vira uma promessa
que o app desmente três telas depois.

Enquanto a porta for fechada, todo link é um convite para uma sala de espera.
Abrir a porta é o que faz a indicação virar uma coisa simples — não é um
segundo projeto, é a consequência do primeiro.

E a fila cobra caro por algo que ela quase não entrega. Hoje o motorista se
inscreve, sai com conta criada, e cai numa sala de espera com o app desfocado
atrás ([Aguardando.jsx](../src/pages/Aguardando.jsx)) esperando uma aprovação
que é negociada fora do sistema. Ele queria entrar e saber que já pode usar.
Recebeu um vidro fosco.

---

## O que existe hoje, e que esta decisão desmonta

O raio de alcance é **39 ocorrências em 13 arquivos**. Não é uma limpeza de
uma tarde, mas quase tudo é deleção — o tipo de mudança que deixa o sistema
menor.

| Onde | O que faz hoje |
|---|---|
| [papeis.js](../src/utils/papeis.js) | `ehAguardando()` e o quarto papel |
| [associadoService.js](../src/services/associadoService.js) | cria a conta como `role: 'aguardando'` |
| [DriverSignup.jsx](../src/pages/DriverSignup.jsx) | manda pra `/aguardando` depois do cadastro |
| [Aguardando.jsx](../src/pages/Aguardando.jsx) | a sala de espera, com posição na fila |
| [travessia.js](../src/utils/travessia.js) | omite a cortina pra quem espera |
| [firestore.rules](../firestore.rules) | 8 pontos — ver abaixo |
| `/admin` aba **Fila** | a aprovação |
| [rodada.js](../src/config/rodada.js) | `VAGAS_NA_RODADA`, a escassez da home |

### Os quatro pontos das rules que importam

1. **`isAppUser()`** exclui `aguardando` explicitamente (linha ~168). Essa
   linha é o que impede a fila de virar porta: sem ela, um inscrito lia
   `schoolBroadcasts` e `agendaEntries` do parceiro que já está dentro.
2. **`users` create**, ramo da inscrição (linha ~349): `role` fixo em
   `'aguardando'` — é o que impede a auto-promoção no ato da criação.
3. **`users` update**, ramo da aprovação (linha ~415): a **única** transição
   de `role` que existe no sistema, e só o dono faz.
4. **`users` create**, ramo do provisionamento (linha ~320): **o dono já pode
   criar uma conta de motorista pronta**, com `provisionedBy` e
   `provisionedFromLead`. Este caminho já existe e ninguém está usando.

---

## Três formas de abandonar, e a que eu recomendo

### A — Autosserviço aberto

Qualquer um se cadastra e vira `admin` na hora.

O problema não é filosófico, é concreto: **o cliente não pode escrever
`role: 'admin'`**. Foi essa regra que fechou a escalada de privilégio, e ela
custou caro. Abrir esse ramo nas rules reabre a porta pelo lado de dentro.
Fazer isso direito exige uma Cloud Function com Admin SDK — exatamente como
`redeemInvite` faz para o responsável.

E sobra um risco que não é de código: qualquer pessoa vira um cadastro de
motorista e passa a registrar **nome, endereço, coordenada e telefone de
criança** dentro do seu sistema. Não é que ela roube o dado de outro; é que
ela vira uma operadora de dado de menor dentro da sua plataforma, e você não
sabe quem é.

### B — O dono provisiona (o caminho que já está construído)

Ninguém se inscreve. A home pede **conversa**, não cadastro — o
[ConsultorButton](../src/components/landing/ConsultorButton.jsx) já está lá. A
negociação acontece por WhatsApp, e quando fecha o dono cria a conta pronta
pelo ramo `provisionedBy` que as rules já aceitam.

O motorista **nunca vê sala de espera** porque nunca se cadastra sozinho: ele
recebe uma conta que funciona. A fila é abandonada do ponto de vista dele, que
é o único que importa.

Custo: quase só deleção. Mas não resolve "entrar e usar hoje" — só troca a
espera de lugar. Continua dependendo de você atender.

### C — Porta aberta com teto ← **recomendada**

Ele se cadastra sozinho, entra como motorista de verdade, e **usa hoje** — com
um teto de crianças.

O teto **já existe e já é cobrado pelas rules**: `users.limiteCriancas` contra
`users.criancasAtivas`, validado no `allow create` de `children` com
`getAfter`. Um `addDoc` solto é recusado. Cadastro novo nasce com
`limiteCriancas: 3`.

Por que é a melhor síntese:

- **Responde ao que o tio quer.** Ele entra, cadastra a perua, as escolas, os
  horários e três crianças na mesma noite. O produto se prova sozinho, que é
  exatamente o que a roleta já foi criada para comprar tempo para fazer.
- **A urgência vira verdadeira.** Não é "restam 2 vagas" — é "seu acesso cabe
  3 crianças". Escassez que existe de verdade, verificável na própria tela,
  sem ninguém precisar baixar número à mão todo mês.
- **O abuso fica com teto.** Um cadastro falso registra 3 crianças, não 300.
- **Reaproveita dois mecanismos prontos** em vez de inventar um quarto papel.

Continua exigindo a Cloud Function do item A — a criação da conta com
`role: 'admin'` **não** pode passar a ser permitida pelas rules ao cliente.

---

## O que muda, na ordem

1. **Cloud Function `criarContaDeMotorista`** (Admin SDK). Cria auth + doc de
   `users` com `role: 'admin'`, `limiteCriancas: 3`, `origem` e `indicadoPor`.
   É a peça nova; todo o resto é subtração.
2. **Rules:** apagar o ramo de create com `aguardando`, apagar o ramo de update
   da aprovação, e tirar a exclusão de `aguardando` de `isAppUser()`. **Rodar
   `npm run testar:regras`** — este arquivo é a segurança real do app.
3. **Apagar** `/aguardando`, `ehAguardando()`, o ramo de `aguardando` na
   `travessia`, e a aba Fila como fila de aprovação (vira lista de cadastros
   recentes, que é outra coisa).
4. **`rodada.js`:** `VAGAS_NA_RODADA` sai da home. Com porta aberta, "restam 2
   vagas" passa a ser **falso** — e falso na tela é o que o próprio arquivo
   diz ser propaganda enganosa (CDC art. 37). Não dá para abrir a porta e
   manter a frase.
5. **A urgência muda de objeto** — a seção abaixo.
6. **A indicação**, que agora é um campo e um parâmetro de URL.

---

## A urgência, depois que a fila morre

A fila era a urgência. Tirando ela, sobra a roleta — e ela é um ativo melhor,
porque é **honesta por construção**: sorteia no servidor, grava antes de
responder, uma vez por conta, e nem o dono reescreve
([entryBonus.js](../functions/lib/entryBonus.js)).

A troca é de objeto escasso:

> **Escasso não é a vaga. É a condição.**
>
> "Restam 2 vagas" diz *você pode não entrar* — e some com quem só queria usar.
> "Quem entra em agosto gira a roleta" diz *entre agora* — e empurra pra dentro.

**Com uma exigência que não é negociável:** se a roleta virar a manchete, ela
precisa de um fim de validade **real**. "Quem entra em agosto" só é verdade se
em setembro a regra mudar de fato. Sem isso você recriou o contador falso com
outro nome, e o motorista que voltar em outubro vai ver a mesma frase de
agosto — que é precisamente como esse truque é descoberto.

---

## A indicação, agora que ela é simples

Com a porta aberta, o link do tio não promete nada que o app desminta:

```
/quero-fazer-parte?ind=<uid>  →  conta criada com indicadoPor: <uid>
```

- **Prêmio só para o tio.** O pai indica porque o app é bom — decidido, e é a
  leitura certa: a plataforma não tem moeda para dar ao pai. A mensalidade é
  do motorista, e descontar o dinheiro dos outros é o que quebraria o item 7
  dos Termos.
- **A recompensa é `isencaoAte`** — o campo de mês que o
  [TaxaTab](../src/pages/admin/TaxaTab.jsx) já lança à mão.
- **Não precisa de coleção nova nem de function agora.** Com um associado, o
  dono lança o mês na mão quando vê "veio pelo Tio Nino". Vira automação
  quando houver volume — não antes.
- **Liquidar só quando o indicado PAGAR a primeira fatura.** Recompensar
  cadastro é montar uma fazenda de conta falsa.

---

## O que esta decisão custa — e o que precisa ser resolvido junto

Três coisas quebram e nenhuma é opcional:

**1. A leitura do doc do motorista fica mais fraca.** A rule de `users` deixa
qualquer `isAppUser()` ler o doc de quem tem `role: 'admin'` — existe para o
pai ver a chave PIX e o telefone do motorista dele. Com porta aberta, virar
`isAppUser()` deixa de custar aprovação. **Essa rule precisa ser escopada ao
`adminUid` do próprio responsável** na mesma leva, senão a abertura entrega
nome, e-mail, telefone e chave PIX de todo parceiro a quem se cadastrar.

**2. `appState/init.adminUid` fica mais errado.** É um ponteiro único para "o
motorista da plataforma", usado como fallback em
[notificationsService](../src/services/notificationsService.js) e como fonte
da vitrine em `getShowcase`. O próprio código já registra o estrago: *"com
dois, o aviso de falta do pai de um chegava ao outro"*. Com cadastro aberto,
"dois" deixa de ser hipótese.

**3. A vitrine da home mostra `drivers[0]`.** Ela foi escrita para um
associado. Com vários, ou ela vira uma lista de verdade ou ela some.

---

## O que eu não faria

**Abrir a porta pelas rules.** A conta com `role: 'admin'` nasce de Cloud
Function, ponto. O dia em que o cliente puder escrever o próprio papel é o dia
em que a auto-promoção volta, e ela já custou uma refatoração de papel inteira.

**Manter a escassez de vagas junto com a porta aberta.** As duas frases não
cabem na mesma página sem uma delas virar mentira.

**Criar um quinto papel para o "em teste".** O teto de crianças já faz esse
trabalho, e é dado, não papel — muda com um número, não com uma migração.

---

## Aberto, para decidir

- **A aprovação vale alguma coisa hoje?** Ela é onde a taxa é negociada. Se a
  isenção da roleta já cobre os primeiros meses, a conversa pode acontecer com
  ele já usando — mas isso é uma escolha de negócio, não de arquitetura.
- **Teto de 3 crianças é o número certo?** Alto demais e o teste vira operação
  de graça; baixo demais e ele não consegue provar o app com a turma real.
- **O `contratosAssociacao` passa a ser o gate?** Faria sentido: entra, usa,
  e aceita o contrato quando a isenção acaba. `suspenso` já bloqueia nas rules
  para quem não aceitar.
