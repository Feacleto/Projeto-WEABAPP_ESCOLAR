# Como entrar como motorista, como dono e como responsável

Os três acessos são **diferentes por natureza**, e um deles não funciona sem o
plano Blaze. Isto não é burocracia acidental: cada caminho reflete uma decisão
de segurança.

| Papel | Rota | Funciona hoje (sem Blaze)? |
|---|---|---|
| Motorista | `/tio` | **Sim** |
| Dono do produto | `/admin` | **Sim**, com um campo no console |
| Responsável | `/pai` | **Não** pelo app. Só pelo console. |

---

## 1. Motorista — funciona hoje

O primeiro motorista se cria sozinho pelo app:

> Abra **`/first-admin`** e preencha nome, e-mail, telefone e senha.

Isso grava `users/{uid}` com `role: 'admin'` e cria `appState/init`, que
**fecha a porta atrás de si** — a partir daí `/first-admin` recusa qualquer
tentativa, e a regra do Firestore só permite criar admin enquanto
`appState/init` não existir.

Depois disso, entrar é pelo `/login` normal, e o app manda pro `/tio` pelo
`role` do documento.

**Se você já criou um admin e quer outro motorista:** não tem caminho no app,
de propósito (não existe autocadastro de parceiro). Pelo console:

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

## 2. Dono do produto (`/admin`) — um campo, na mão

O painel é protegido por `superAdmin: true` no seu documento de usuário, e
**nada no app grava esse campo**. As regras chegam a proibir o usuário de
gravá-lo em si mesmo. É de propósito: é o gate da plataforma, e um gate que o
próprio usuário liga não é gate.

Depois de criar sua conta de motorista (passo 1):

> Firestore → `users` → seu documento → **Adicionar campo**
> `superAdmin` · tipo **boolean** · valor **true**

Recarregue o app e abra **`/admin`**.

### O que tem lá dentro

- **Tamanho da base** — quantas famílias, crianças, motoristas
- **Dinheiro que passou pelo app** — GMV, com a nota explicando que GMV não é
  receita (a taxa não é cobrada em nenhum contrato ainda)
- **Fila de parceiros** — motoristas pedindo acesso
- **Manutenção** — o backfill de privacidade (Verificar / Aplicar)
- **Notas, Distribuição, O que mais usam, O que mais pedem, Comentários** — o
  que veio das avaliações

O botão **Verificar** da Manutenção é simulação: não escreve nada. Ele depende
de Cloud Functions, então **só funciona depois do Blaze**.

---

## 3. Responsável (`/pai`) — não tem caminho no app hoje

E o motivo é uma correção de segurança, não um bug: quando a escalada de
privilégio foi fechada, o cliente **perdeu** a permissão de criar conta de
responsável. Quem cria é a Cloud Function `redeemInvite`, com credencial de
servidor — e ela não está no ar sem o Blaze.

Sem Blaze, o link de convite não funciona, e `/first-access` também não.

### Para teste interno: montar o responsável pelo console

O console do Firebase escreve com privilégio de administrador e **não passa
pelas regras** — é por isso que este caminho funciona enquanto o do app não.

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
termsVersion      (string)  = 1.0
privacyVersion    (string)  = 1.0
termsAcceptedAt   (timestamp) = agora
```

Os três últimos não são enfeite: sem eles o app abre o **muro de aceite dos
termos** e você não sai dele. O gate exige as duas versões iguais à atual
(`LEGAL_VERSION = '1.0'`) **e** a data de aceite preenchida.

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

### Mas o financeiro dele vai estar vazio

E isso é o mais importante de saber antes de testar: **quem cria as
mensalidades é Cloud Function** (`generateMonthlyPayments`, todo mês, e
`runBillingNow` pelo botão). Não existe caminho no app pro motorista criar
cobrança à mão — então sem Blaze o responsável entra e vê o painel financeiro
sem nada, o que não é o teste que você quer fazer.

Para ter uma mensalidade pra olhar, crie o documento — Firestore → coleção
`payments` → **Add document** com ID automático:

```
childId     (string)    = <ID da criança>
childName   (string)    = Nome da Criança
parentUid   (string)    = <UID do responsável>
month       (string)    = 2026-08
amount      (number)    = 250
dueDate     (timestamp) = 2026-08-10
status      (string)    = pending
```

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

## O que muda quando o Blaze entrar

Tudo isto deixa de ser necessário para o responsável:

1. Cadastre a criança em `/tio`
2. Copie o link do convite e abra em outro aparelho
3. A conta se cria ali, com o vínculo, o aceite e tudo — em uma tela

Aí o console volta a ser o que deve ser: lugar de conferir dado, não de criar
usuário na mão.
