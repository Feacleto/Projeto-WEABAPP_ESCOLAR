# Dado de saúde da criança — o desenho e os textos

> **RASCUNHO PARA REVISÃO JURÍDICA.** Os textos das seções 4 e 5 são propostas,
> escritas por quem programa e não por quem advoga. O **mecanismo** (o que o
> sistema faz, quem pode escrever o quê, o que fica registrado) está
> implementado e testado; a **redação** precisa de alguém qualificado antes de
> ir ao ar, porque é declaração sobre dado sensível de menor de idade.
>
> Este arquivo tem prazo de validade: quando a redação for ratificada, ela vai
> para `src/pages/legal/legalContent.js` e `src/components/children/`, e o que
> sobra aqui é a seção 2 (o desenho) — que vira parágrafo em
> [decisoes.md](decisoes.md).

---

## 1. O problema, como ele estava

O campo **Observações** do cadastro de criança tinha o placeholder
*"Alergias, instruções especiais…"* — ou seja, **o app convidava o motorista a
escrever dado de saúde de uma criança**.

Três coisas erradas ao mesmo tempo:

1. **Dado sensível sem base legal.** Saúde é dado sensível (LGPD art. 5º, II) e
   exige consentimento **específico e destacado** (art. 11, I). Tratando-se de
   criança, o art. 14, §1º pede consentimento específico de um dos pais ou do
   responsável legal.
2. **Quem digita não é quem consente.** Quem preenche é o **motorista**, sobre
   uma criança cuja responsável **ainda não aceitou nada** — a criança é
   cadastrada antes de o convite ser enviado, e a mãe pode nunca resgatá-lo.
3. **A Política afirmava o contrário do código.** Ela dizia que o consentimento
   é "manifestado durante o aceite destes termos no primeiro acesso", e esse
   aceite pode não existir nunca.

**Já feito (09/09/2026):** o convite saiu. O placeholder virou
*"Ex.: portão de trás, quem busca na segunda…"* e o campo ganhou uma linha
dizendo que saúde é assunto para combinar direto com a família. Isso fecha a
porta; não abre a certa.

---

## 2. O desenho — duas camadas que não se substituem

### Camada 1 · A declaração do MOTORISTA, no cadastro da criança

Uma caixa que ele marca ao cadastrar:

> Confirmo que tenho autorização do responsável desta criança para cadastrar os
> dados acima.

**Isto não é o consentimento da família.** É a afirmação dele, e serve a três
coisas:

- fecha a janela em que hoje **ninguém** declarou nada;
- cria responsabilidade rastreável (fica registrado quem declarou e quando);
- é verossímil, porque o modelo do produto já parte de que a família **conhece
  o motorista offline** — a plataforma não apresenta ninguém a ninguém.

⚠️ **Ela não pode ser apresentada como consentimento** em documento nenhum. Se
for, a plataforma passa a alegar um consentimento que não coletou.

### Camada 2 · O consentimento ESPECÍFICO da responsável

Uma caixa **separada** da dos Termos, na tela dela, e só quando ela quiser
informar algo de saúde:

- separada porque "aceito os termos" não cobre dado sensível — bundling é
  justamente o que o art. 11, I proíbe;
- **opcional**, e o app funciona inteiro sem ela: transporte não depende de
  saber alergia, e condicionar o serviço a dado sensível é o outro jeito de
  violar o art. 11.

### A peça que faz as duas funcionarem: **quem escreve é ela, não ele**

O campo de saúde **sai do cadastro do motorista** e passa a ser preenchido pela
**responsável**, na tela dela, com o consentimento ao lado. O motorista **lê**.

Três razões, e a terceira é a que decide:

1. **Ela sabe melhor.** É a mãe que conhece a alergia, a dose, o horário.
2. **Tira o motorista da cadeia de coleta.** Ele deixa de ser quem digita dado
   sensível de terceiro — e é ele o elo que a plataforma não controla.
3. **O consentimento fica no mesmo gesto do dado.** Consentimento coletado numa
   tela e dado digitado noutra, por outra pessoa, é consentimento que ninguém
   consegue provar depois.

**O campo de Observações continua com o motorista**, e continua sendo só
operação: portão de trás, quem busca na segunda, onde a perua encosta.

---

## 3. O que o sistema registra

| Onde | Campo | Quem escreve | Para quê |
|---|---|---|---|
`children` | `autorizacaoDeclarada` | motorista | a declaração da camada 1 |
`children` | `autorizacaoDeclaradaEm` | motorista | quando |
`children` | `saudeConsentidaEm` | responsável | o consentimento da camada 2 |
`children` | `saudeNotas` | responsável | o dado em si |

⚠️ **`saudeNotas` sem `saudeConsentidaEm` é estado inválido**, e as rules
recusam a escrita de um sem o outro. Guardar o dado sem o registro do
consentimento é ter o passivo sem a defesa.

⚠️ **O motorista não escreve nenhum dos dois campos de saúde**, e as rules
garantem — não a interface. Esconder campo é UX; o que impede é a regra.

---

## 4. RASCUNHO · o texto da camada 1 (declaração do motorista)

> **Autorização do responsável**
>
> Confirmo que tenho autorização do responsável legal desta criança para
> cadastrar no Alô Buzinou o nome, o endereço de embarque e os dados de
> contato informados acima, com a finalidade de operar o transporte escolar.

**Notas para quem for revisar:**

- Ela é sobre os dados **operacionais** (nome, endereço, contato). **Não**
  menciona saúde — de propósito: a camada 1 não pode parecer cobrir o que só a
  camada 2 cobre.
- "responsável legal" e não "responsável": o art. 14, §1º fala de pais ou
  representante legal.
- Não diz "declaro sob as penas da lei" nem prazo de guarda. Se a revisão
  entender que precisa, o campo comporta.

---

## 5. RASCUNHO · o texto da camada 2 (consentimento da responsável)

> **Informações de saúde (opcional)**
>
> Você pode informar alergias, medicamentos ou condições de saúde que o
> motorista precise saber em caso de emergência no trajeto.
>
> **Isso é opcional.** O transporte funciona igual sem essa informação, e você
> pode apagá-la quando quiser.
>
> ☐ Autorizo o Alô Buzinou a guardar as informações de saúde de
> **{nome da criança}** e a exibi-las ao motorista responsável pelo transporte
> dela, para uso em caso de emergência durante o trajeto.
>
> Só o motorista da van dela vê essa informação. Ela não aparece para outros
> motoristas, não é usada para mais nada e é apagada junto com o cadastro da
> criança.

**Notas para quem for revisar:**

- A caixa é **desmarcada por padrão** e o texto do consentimento está **dentro
  dela**, não num link — é o que "destacado" quer dizer no art. 11, I.
- A finalidade é **única e escrita**: emergência no trajeto. Finalidade genérica
  ("para melhor atendê-lo") não sustenta dado sensível.
- Diz **quem vê**, e a frase é verificável: as rules escopam a leitura ao
  motorista da criança ativa, como já fazem com foto e endereço.
- Diz que dá para **apagar**, e o botão precisa existir de fato (art. 18, VI).
- Não pede consentimento para "compartilhar com parceiros", porque não
  compartilhamos — e a Política declara os três operadores nominalmente.

---

## 6. O que a Política de Privacidade precisa ganhar

Um parágrafo na seção de dados coletados, na versão em que isto entrar:

> **Informações de saúde da criança (opcional).** Quando o responsável opta por
> informá-las, com consentimento específico e destacado, guardamos o texto que
> ele escreveu e a data do consentimento. Essa informação é exibida apenas ao
> motorista responsável pelo transporte daquela criança, com a finalidade de
> permitir atendimento adequado em caso de emergência durante o trajeto. Ela
> pode ser apagada pelo responsável a qualquer momento, e é excluída junto com
> o cadastro da criança.

⚠️ E a frase da seção 5 que diz que o consentimento é "manifestado durante o
aceite destes termos no primeiro acesso" **precisa deixar de valer para dado
sensível** — é exatamente o bundling que o art. 11, I recusa.

---

## 7. O que fica de fora, e por quê

- **Não guardamos documento de saúde** (receita, laudo, carteirinha). Texto que
  a responsável escreveu é o suficiente para uma emergência de trajeto, e
  arquivo de saúde de menor é passivo sem contrapartida — o mesmo argumento que
  fez o projeto conferir **alvará** e não CNH.
- **Não há campo estruturado** (tipo de alergia, gravidade, medicamento). Formulário
  clínico convida a coletar mais do que a finalidade sustenta, e a plataforma
  não é serviço de saúde.
- **Não notificamos ninguém** com base nesse dado. Push que diz "criança com
  alergia embarcou" transformaria dado sensível em tráfego, e a finalidade
  declarada é emergência no trajeto — não vigilância.
