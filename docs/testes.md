# Como entrar como motorista, como dono e como responsável

> **Reescrito em 09/09/2026.** A versão anterior era de 24/08/2026 e três das
> quatro instruções dela já não funcionavam: o plano **Blaze está no ar** desde
> 06/09 (então o convite funciona), o gate do `/admin` **deixou de ser
> `superAdmin`** (quem seguisse o doc criava uma conta que não abria o painel e
> concluía que o `/admin` estava quebrado), e **existe autocadastro de
> motorista** desde 06/09. Se você abriu este arquivo antes e estranhou, era o
> arquivo.

Os três acessos são **diferentes por natureza**, e a diferença reflete uma
decisão de segurança em cada caso.

| Papel | Rota | Como se chega lá |
|---|---|---|
| Motorista | `/tio` | **Pelo app**, em `/quero-fazer-parte`. Autoatendimento. |
| Dono do produto | `/admin` | **Pelo console**, com `role: 'owner'` na mão. |
| Responsável | `/pai` | **Pelo link do convite**, que o motorista manda. |

---

## 1. Motorista — pelo app, em trinta segundos

> Abra **`/quero-fazer-parte`** (ou o `/login`, aba "Criar conta" → "Eu dirijo
> a perua") e preencha nome, e-mail, telefone, cidade e quantas crianças você
> transporta.

A conta **já nasce `role: 'admin'`** — que neste projeto significa MOTORISTA, e
não administrador. Não há fila, não há aprovação, não existe mais o papel
`aguardando`. Quem controla o acesso agora é o teste de três meses, que começa
no primeiro USO (primeira rota, primeiro responsável entrando, ou primeira
mensalidade gerada — o que vier primeiro), nunca no cadastro.

Depois disso, entrar é pelo `/login` normal, e o app manda pro `/tio` pelo
`role` do documento.

⚠️ **`/first-admin` ainda existe como rota e não funciona.** Ela cria
`role: 'admin'` e depois tenta escrever `appState/init`, que só o DONO pode
criar — a segunda escrita é negada, o `catch` apaga a conta do Auth e deixa o
`users/{uid}` órfão. Não use. (Está na lista de coisas a decidir: remover a
rota ou reescrevê-la.)

**Se você quer um motorista sem passar pelo formulário**, pelo console:

1. Firebase Console → **Authentication** → Add user (e-mail + senha)
2. Copie o **UID**
3. Firestore → coleção `users` → criar documento com **ID = o UID**:

```
role   (string)  = admin
name   (string)  = Nome do Motorista
email  (string)  = o mesmo e-mail
phone  (string)  = 11999998888
```

---

## 2. Dono do produto (`/admin`) — o papel, na mão, pelo console

⚠️ **`superAdmin: true` NÃO ABRE MAIS NADA.** O campo legado saiu em
06/09/2026: nada no app o escreve, e as rules o mantêm fora de toda whitelist
de `users`. `isOwner()` nas rules e `ehDono()` no cliente sempre checaram o
PAPEL — o que dizia o contrário era comentário.

A conta de dono **precisa nascer com `role: 'owner'`**, e isso é pelo console:

1. Firebase Console → **Authentication** → Add user (e-mail + senha)
2. Copie o **UID**
3. Firestore → coleção `users` → criar documento com **ID = o UID**:

```
role              (string)    = owner
name              (string)    = Seu Nome
email             (string)    = o mesmo e-mail
termsVersion      (string)    = 1.1
privacyVersion    (string)    = 1.1
termsAcceptedAt   (timestamp) = agora
```

Os três últimos não são enfeite: o `/admin` também passa pelo gate de aceite
dos termos (desde 09/09/2026 — antes o dono era o único que não passava, e o
registro de aceite tinha um buraco justamente na conta que responde pela
plataforma).

**Mais de uma pessoa pode ser dona.** Duas contas com `role: 'owner'` são duas
donas; a regra checa papel, não identidade.

⚠️ **Não resgate um link de convite estando logado como dono.** Até 09/09/2026
isso sobrescrevia seu `role` para `'parent'` e você perdia o `/admin` de forma
irreversível pelo produto (o cliente não escreve `role` — o conserto era
console). Hoje o `redeemInvite` recusa qualquer papel que não seja `parent`,
mas o hábito continua valendo: para ver o que a mãe vê, use outra conta.

### O que tem lá dentro

São **oito abas**, e a padrão é a primeira:

- **Hoje** — a fila do dia: o que tem ação possível hoje, uma linha por
  motorista, a mais urgente
- **Motoristas** — a carteira, com a **ficha** de cada um (plano, contrato,
  faturas, nota das famílias, nota interna, condições vigentes)
- **Chamados** — quem pediu ajuda e há quanto tempo espera
- **Mês** — a régua e o fechamento das faturas
- **Números** — MRR, degraus da carteira, receita, origem dos cadastros
- **Selos** — alvarás enviados, para conferir e aprovar
- **Indicações** — quem indicou quem, e o casamento na baixa da fatura
- **Pesquisa** — quem levantou a mão em cada assunto

**Manutenção** (o backfill de privacidade) tem botão **Verificar** que é
simulação e não escreve nada.

---

## 3. Responsável (`/pai`) — pelo link do convite

**Este é o caminho normal e ele funciona.** Cadastre a criança em `/tio`, copie
o link do convite e abra em outro aparelho (ou em janela anônima): a conta se
cria ali, com o vínculo, o aceite e tudo, em uma tela.

Quem cria a conta é a Cloud Function `redeemInvite`, com credencial de servidor
— o cliente não tem permissão de escrever `role` nem `childIds`, e é isso que
fecha a auto-atribuição de filhos. **O Blaze está no ar desde 06/09/2026**, então
`lookupInvite`, `getInvitePreview` e `redeemInvite` respondem.

⚠️ **Duas coisas que o caminho do convite exige e que quebram calado se
faltarem:**

- **as functions publicadas** — e a lista de deploy já esteve errada duas
  vezes, o que faz o deploy abortar INTEIRO e não publicar nada, inclusive o
  `redeemInvite`. Prefira `.\deploy.ps1`: ele confere a lista contra os
  `exports.` de `functions/index.js` antes de gastar o deploy;
- **o índice de `children`** — a consulta do convite é
  `inviteCode == X && inviteStatus == 'pending'`. Duas igualdades sem `orderBy`
  são servidas por merge join, sem índice composto, então isto normalmente
  funciona sozinho.

### Para teste interno sem segundo aparelho: montar pelo console

O console do Firebase escreve com privilégio de administrador e **não passa
pelas regras** — é por isso que este caminho contorna o convite. Use quando
quiser um responsável pronto sem passar pelo fluxo, não como caminho normal.

**Antes:** entre como motorista e **cadastre uma criança**. Anote o ID do
documento dela em `children` (você vai precisar dele em dois lugares).

**a) Criar o login**

> Authentication → Add user → e-mail + senha. Copie o **UID**.

**b) Criar o perfil** — Firestore → `users` → documento com **ID = o UID**:

```
role              (string)  = parent
childIds          (array)   = [ <ID da criança> ]
childId           (string)  = <ID da criança>
name              (string)  = Nome do Responsável
email             (string)  = o mesmo e-mail
termsVersion      (string)  = 1.1
privacyVersion    (string)  = 1.1
termsAcceptedAt   (timestamp) = agora
```

Os três últimos não são enfeite: sem eles o app abre o **muro de aceite dos
termos** e você não sai dele. O gate exige as duas versões iguais à atual
(`LEGAL_VERSION = '1.1'`, em `src/pages/legal/legalContent.js` — confira lá antes de digitar, porque este número sobe) **e** a data de aceite preenchida.

`childId` é campo legado e `childIds` é o atual — o app grava os dois, e telas
antigas ainda leem o primeiro. Preencha ambos.

**c) Ligar a criança ao responsável** — Firestore → `children/{ID}`:

```
parentUid     (string) = o UID
inviteStatus  (string) = used
```

**d) Passar o aceite do contrato** (opcional)

Se você não quiser cair no muro do contrato, no mesmo documento da criança:

```
contractAcceptedAt  (timestamp) = agora
contractVersion     (number)    = 1
```

Sem isso o app mostra o aceite de contrato antes do painel — o que também é um
teste válido, se for isso que você quer ver.

**e) Entrar** — `/login` com aquele e-mail e senha. O app lê `role: 'parent'`
e abre o `/pai`.

### O financeiro dele começa vazio

**Quem cria as mensalidades é Cloud Function** (`generateMonthlyPayments`, todo
mês às 6h, e `runBillingNow` pelo botão do motorista). Não existe caminho no
app para o motorista criar cobrança à mão, então até a primeira geração o
responsável entra e vê o painel financeiro sem nada.

O caminho normal é tocar em **"Gerar mensalidades"** no Financeiro do `/tio`.
Se você quiser um documento pronto, pelo console — Firestore → coleção
`payments`:

⚠️ **USE O ID DETERMINÍSTICO `{childId}_{AAAA-MM}`, não "Add document".**
`generateMonthlyPayments` cria com esse id exato para garantir "uma cobrança por
mês". Um documento de id aleatório passa a existir em paralelo, e — se o campo
`month` divergir — o filtro de idempotência não o vê: a geração tenta criar o
id determinístico, o `create` rejeita, e desde 09/09/2026 só ESSE item fica de
fora (antes levava até 400 mensalidades com ele, e o motorista via o mês vazio
sem nenhum erro).

E **`adminUid` não é opcional**: as quatro consultas do motorista filtram por
ele. Sem o campo, a mensalidade é invisível para quem tem que receber — o pai
vê a cobrança e o motorista abre o Financeiro e encontra o mês vazio.

```
(ID do documento)         = <ID da criança>_2026-09
adminUid    (string)    = <UID do motorista>
childId     (string)    = <ID da criança>
childName   (string)    = Nome da Criança
parentUid   (string)    = <UID do responsável>
month       (string)    = 2026-09
amount      (number)    = 250
dueDate     (timestamp) = 2026-09-10  (use MEIO-DIA, não meia-noite)
status      (string)    = pending
```

`dueDate` ao meio-dia porque as functions rodam em UTC: à meia-noite, um
vencimento do dia 10 nasce `2026-09-10T00:00Z`, que no Brasil é 09/09 às 21h — a
tela imprime "Vence: 09/09" e o status marca atraso 27 horas cedo.

`childName` é **denormalizado de propósito** — a tela lê o nome daqui em vez de
buscar o documento da criança. Se você deixar em branco, a lista aparece sem
nome.

`month` tem que ser exatamente `AAAA-MM`. A tela do financeiro filtra por
competência, então um mês fora do formato simplesmente não aparece.

Os `status` que valem: `pending` (em aberto), `claimed` (o responsável avisou
que pagou e o motorista ainda não deu baixa) e `paid`. Vale criar três
documentos, um de cada, pra ver a lista com os três estados de uma vez — é o
teste que mostra mais em menos tempo.

Para testar **atraso**, crie um com `month` de um mês anterior e `status`
`pending`: a faixa de dívida antiga aparece no painel do motorista.

---

## Testar os dois papéis ao mesmo tempo

Use **janela normal** para um e **janela anônima** (ou outro navegador) para o
outro. Duas contas no mesmo navegador brigam pela sessão do Firebase Auth.

Uma pessoa pode legitimamente ser as duas coisas — motorista e responsável —
com duas contas separadas. O app não trava ninguém num papel: a frente que
aparece vem da **rota** (`/` ou `/familia`), não de nada gravado no aparelho.

---

## Os testes automatizados, que valem mais que qualquer receita daqui

```bash
npm run testar          # 1126 casos em 25 scripts, Node puro, sem emulador
npm run lint
npm run build
```

E os dois que precisam do emulador, **rode à mão antes de publicar rule**:

```bash
firebase emulators:exec --only auth,firestore "node scripts/testar-regras.mjs"
firebase emulators:exec --only auth,firestore,storage "node scripts/testar-storage.mjs"
```

⚠️ O de Storage precisa dos **três** emuladores (ele semeia usuário e criança
antes de testar). Só `--only storage` morre em `fetch failed`.

O console agora é o que deve ser: lugar de conferir dado e de criar a conta de
dono, não de criar usuário na mão.
