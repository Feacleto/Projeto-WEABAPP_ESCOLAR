# Alô Buzinou — visão geral

> Escrito em 04/10/2026 para duas pessoas: o **dono**, que quer o projeto
> inteiro numa leitura só, e a **sessão de jornadas**, que vai testar o app de
> ponta a ponta no navegador. É um mapa: cada assunto aponta para o documento
> que manda nele. Se este texto e o documento apontado discordarem, **vale o
> documento apontado** (e este aqui precisa ser corrigido).
>
> Para o detalhe técnico, o índice é o [CLAUDE.md](../CLAUDE.md).

---

## 1. O que é, em uma frase

Um app de celular (PWA) que liga o **motorista de transporte escolar** ("o
Tio") às **famílias** que ele atende: rota do dia com aviso de chegada,
mensalidade organizada com PIX direto para ele, faltas avisadas antes,
contrato assinado no app — tudo com o **nome, o logo e a cor dele**.

- `alobuzinou.com` é o **app**; `alobuzinou.com.br` é o **site** (landing).
- Quem **paga** é o motorista (uma taxa por criança). Quem **usa** mais é a
  responsável, e ela **não paga nada**.

## 2. Para quem — as personas

Detalhe em [personas.md](personas.md).

| Persona | Quem é | O que pesa para ele/ela |
|---|---|---|
| **Motorista de caderno** | 8 a 12 crianças, organiza no caderno e no WhatsApp | preço, simplicidade, não perder tempo |
| **Motorista com operação** | 26 a 40 crianças, às vezes com auxiliar | gestão do dinheiro, controle, imagem profissional |
| **A responsável** | a mãe/o pai; recebe o convite do motorista | saber onde o filho está, pagar sem atrito, avisar falta |

O que faz o motorista comprar, na ordem dita pelo dono: **1º preço, 2º gestão
financeira, 3º apoio na rota.**

## 3. Premissas e diretrizes (valem para tudo)

**Público de ~40 anos, no celular, com pressa.**
- Letra de no mínimo 16 px no conteúdo; botão de no mínimo 48 px; uma coluna;
  **um botão principal por tela** (o "protagonista", cheio e na cor da marca;
  o resto é branco ou contorno).
- "← Voltar" sempre escrito; nomes curtos ("Abrir rota", "Abrir caixa").
- Campos de texto têm **microfone** (falar em vez de digitar), nunca em senha,
  CPF, PIX, CEP, data ou saúde.

**O app fala pouco e só quando precisa.**
- A tarja de aviso só aparece quando o app estaria **mentindo** (ex.: rota não
  começou depois da hora). Atraso comum não gera aviso.
- **Nada se mexe sozinho**, só o que é "ao vivo" (a perua no mapa, a buzina).
- **Sem emoji** em lugar nenhum: ícones (lucide no app, SVG no site).

**Dinheiro e confiança.**
- A mensalidade é **PIX direto da família para o motorista**. A plataforma não
  intermedeia, não segura, não cobra em cima. Os dois dinheiros (mensalidade
  pai→motorista e taxa motorista→plataforma) nunca se misturam.
- **Nenhuma frase afirma segurança** (a plataforma não inspeciona van nem
  confere CNH). Há um teste que reprova essas palavras.
- **Teste da fila do portão**: um desconto só existe se puder ser dito em voz
  alta entre dois motoristas na fila da escola (motivo público e igual para
  todos).

**Dados e LGPD.**
- A posição da perua mostrada às famílias é **aproximada** (grade de 150 m), o
  motorista pode **desligar o mapa**, e a última posição é **apagada** ao
  encerrar a rota.
- Dado de **saúde da criança**: só a responsável escreve, com consentimento
  próprio; o motorista só lê.
- Regra do Firestore não esconde campo: quem lê um documento lê ele inteiro.
  Por isso o que é segredo mora em outra coleção.

**Marca do motorista.** O app do motorista e o das famílias dele levam o
**logo e a cor dele** (desde 04/10/2026, a cor viva do logo nos botões e
faixas; trocar o logo **pergunta** se é para usar a cor). A relação dele com a
plataforma (planos, taxa, suporte) fica no **verde do Alô Buzinou**.

Decisões que não se quebram por conveniência: [decisoes.md](decisoes.md)
(23 decisões, cada uma com o teste que a prova). Marca e manifesto:
[marca.md](marca.md). Design: [design-system.md](design-system.md).

## 4. Modelo de negócio

Documento dono: [negocio.md](negocio.md). Estrutura atual da cobrança:
[estrutura-de-cobranca.md](estrutura-de-cobranca.md).

**Preço por criança ativa** (o app é completo em qualquer tamanho; não existe
plano "básico"):

| | Mensal | Anual |
|---|---|---|
| Por criança | R$ 5,90 | R$ 2,90 |
| Mínimo por mês | R$ 49 | R$ 29 |
| Acima da 40ª criança | R$ 4,90 | R$ 2,40 |
| Prazo e saída | sem prazo, sem multa | 12 meses; sair antes tem multa de 10% do saldo (teto de 2 mensalidades, carência de 30 dias) |

- **O teste grátis**: o relógio começa no **3º dia diferente em que ele
  inicia uma rota** (decidido em 04/10/2026), nunca no cadastro; quem liga é o
  servidor ([relogioNaRota.js](../functions/lib/relogioNaRota.js)). No site a
  frase é **"Use grátis. Decida depois."**
- ⚠️ **A cobrança da plataforma está DESLIGADA** (chave
  `platformConfig/app.cobrancaLigada`, ausente = desligada). O dono liga no
  painel; os descontos são módulos que ligam um a um.
- **Contrato da associação**: 12 meses, renova de 12 em 12; o motorista
  **encerra pelo próprio app**, a qualquer hora (`/tio/encerrar`).
- **Pagamento da taxa**: fatura no dia 1, PIX ou link do Asaas (gateway). O
  gateway cobra **só a taxa**, nunca a mensalidade da família.

## 5. Descontos

Documento dono: [descontos.md](descontos.md).

| Desconto | Regra |
|---|---|
| **Escada de fechamento** (só no mensal) | fechou no 1º mês do teste: **30%**; no 2º: **20%**; no 3º: **10%**. **Vitalício** enquanto ele ficar; some se ele cancelar. O preço nunca sobe quando ele recusa. |
| **Indicação** | **5% por indicado pagante**, sem prazo, para QUEM INDICA (nunca para o indicado). Cai quando o indicado sai. |
| **Piso** | nenhuma fatura abaixo de **R$ 19** (exceto o fundador vitalício). |
| **Fundador** | virou título, não preço (só o vitalício já concedido continua). |
| **Concessão** | exceção do dono, com motivo e prazo; uma por vez. |
| **Isenção** | o mês não tem fatura (diferente de desconto de 100%). |

Saíram por não passar no teste da fila do portão: a roleta de prêmios e o
"fundador por ordem de chegada".

## 6. Vendas e aquisição

- **Site** ([landing/](../landing/)): home com sete blocos e sete páginas
  (como funciona, motorista, família, sobre, dúvidas, contato, investidores).
  **Sem preço no site** (o pai também lê); preço é da tela de planos.
- **Meus planos** (`/tio/planos`): autoatendimento — a conta pelo preço por
  criança, os descontos em cartão próprio, comparação com o concorrente,
  dúvidas, "Minha história" e o contato do time de vendas.
- **Indicação** (`/tio/indicar`): o convite ao colega leva direto ao cadastro,
  com o nome de quem indicou.
- **Consultor**: o fechamento ainda é humano em boa parte; o gargalo do
  negócio é hora de consultor por associado fechado.
- Roteiro de venda e as frases que **não** podem ser ditas (falsas hoje):
  [pitch-comercial.md](pitch-comercial.md). Captação: decidido que **não**
  ([pitch-investidor.md](pitch-investidor.md)).

## 7. Os papéis e as portas

| Papel | No código | Painel | Como entra |
|---|---|---|---|
| Motorista | `role: 'admin'` (⚠️ "admin" = motorista) | `/tio` | cria a conta sozinho (login → "Criar conta") |
| Responsável | `role: 'parent'` | `/pai` | pelo **link do convite** que o motorista manda; sem link, pede acesso pelo WhatsApp e o motorista aprova |
| Auxiliar | `role: 'auxiliar'` (05/10/2026) | `/aux` | só pelo convite do motorista (`/auxiliar/:codigo`); ligada a UM motorista, ele desativa |
| Dono da plataforma | `role: 'owner'` | `/admin` | conta criada no console |
| Sem papel | — | `/comecar` | sessão criada, escolha ainda não feita |

Contas de teste e como entrar em cada papel: [testes.md](testes.md).

## 8. As telas

### Públicas
| Rota | Tela |
|---|---|
| `/login` | **Entrar** — tela limpa no verde: marca, frase, "Começar com Google", "Usar email", "Conhecer o app" (folha "Tudo na sua mão.") |
| `/quero-fazer-parte` | cadastro do motorista (e-mail e senha) |
| `/convite/:codigo` | o convite que a família abre |
| `/first-access` | a responsável sem link pede acesso pelo WhatsApp |
| `/acompanhar/:token` | link público de um dia (quem busca hoje / segundo responsável por 24 h) |
| `/familia`, `/termos`, `/privacidade`, `/auth-action` (senha nova) | |

### Motorista (`/tio`)
| Rota | Tela |
|---|---|
| `/tio` | **Início**: saudação, cartão do momento, "Para resolver", "Meu transporte"; barra "Iniciar a rota" em dia de rota. Primeiro acesso é um **card por cima** (dados, marca, localização, dados do contrato, turma) |
| `/tio/rota` | **Minha rota**: Ida e Volta, quem vai em ordem, chave do mapa para as famílias |
| `/tio/route/now` | **A rota rodando**: linha do tempo, parada em foco, EMBARQUEI/ENTREGUEI, buzinar, desfazer, avisos (atraso, perua quebrada), recado |
| `/tio/horarios`, `/tio/semana`, `/tio/route/plan` | horários da rota, semana, planejamento |
| `/tio/children`, `children/new`, `children/:id`, `children/escolas` | turma, cadastro da criança (com escola criada no caminho e convite no fim), ficha, escolas |
| `children/:id/contract`, `children/:id/extrato` | contrato com a família, extrato da criança |
| `/tio/finance` | **Central** (era o Financeiro) — atrás da **senha do Financeiro** (teclado de banco ou digital): o mês primeiro (mensalidades), o saldo com "Perguntar ao Buzi", a turma, a perua, os planos financeiros e as contas. Na rota, a aba Central do rodapé vira a tela da rota, sem senha e sem valor |
| `finance/auxiliar` | a **auxiliar**: convidar, desativar, o pagamento dela, as faltas e as substitutas |
| `finance/turma`, `finance/expenses`, `finance/reserva`, `finance/aumentar` | turma e contratos, despesas, reserva da perua, "Preciso aumentar?" |
| `finance/buzi`, `finance/boletim` | **Buzi** (assistente de perguntas prontas, sem IA) e o **Boletim** do mês em PDF |
| `finance/negocio` | **Meu negócio** — a trilha que leva ao Diamante |
| `/tio/abastecer` | abastecer (fora da senha) |
| `/tio/pix` | chave PIX (atrás da senha) |
| `/tio/nivel` | Meu nível |
| `/tio/selo` | adesivo e certificado do alvará |
| `/tio/planos`, `/tio/taxa`, `/tio/contrato-plataforma`, `/tio/encerrar`, `/tio/indicar`, `/tio/historia` | relação com a plataforma (no verde da casa) |
| `/tio/profile`, `/tio/notifications` | perfil (marca, cor, PIX, avisos) e o sino |

### Auxiliar (`/aux`, desde 05/10/2026)
| Rota | Tela |
|---|---|
| `/aux` | **Hoje**: a turma do motorista dela (cópia sem endereço, saúde nem valor), o próximo passo de cada criança para marcar, e o PIX da perua |
| `/aux/pagamentos`, `/aux/perfil` | os pagamentos dela (o "Recebi") e o perfil |

### Família (`/pai`)
| Rota | Tela |
|---|---|
| `/pai` | **Início**: um cartão com o filho, a hora e a perua (HOJE / AO VIVO / DIA ENCERRADO) e a ação do momento |
| `/pai/map` | a perua no mapa (posição aproximada) |
| `/pai/finance` | Financeiro: "Pagar a [motorista]", PIX copia-e-cola, "Já paguei" |
| `/pai/faltas`, `/pai/agenda` | faltas e o caderno de recados |
| `/pai/child`, `/pai/contrato`, `/pai/adicionar-filho` | ficha do filho (escola, saúde, segundo responsável, acesso de 24 h), contrato, outro filho |
| `/pai/profile`, `/pai/notifications` | perfil (nível da família no menu) e o sino |

### Dono (`/admin`)
Uma tela com nove abas: **Hoje** (a fila do dia), Motoristas (com a ficha),
Chamados, Mês (fechamento), Números, Selos, Indicações, Pesquisa,
Investidores.

## 9. As funcionalidades, por assunto

**Rota.** O dia é uma lista de paradas ordenada pela hora combinada de cada
criança. Status da criança: em casa → na perua → na escola → entregue. A
família recebe "a perua saiu", "está chegando" e "chegou" (calculados no
celular do motorista, sem mandar a posição exata). Buzina: o celular da mãe
toca em tela cheia. Fim de semana e feriado nacional: "Hoje não tem rota".
Previsão de chegada só pelo atraso real, nunca trânsito adivinhado.

**Central (o Financeiro do motorista).** Mensalidades geradas todo mês (`pending →
claimed → paid`: a mãe avisa "Já paguei", ele dá baixa; na rota, a auxiliar
dá baixa no dinheiro ou anota o PIX sem ver valor, marcado como "sem a
senha"). Despesas por
categoria, combustível com litros e posto, reserva da perua (o app **anota**,
não guarda dinheiro), "Preciso aumentar?" (nunca sugere valor), Buzi e
Boletim. Tudo atrás da senha do Financeiro, porque a auxiliar usa o celular
dele.

**Contrato com a família.** Documento gravado por versão; a família aceita no
app; mudar depois é aditivo, que a família aceita de novo.

**Perfil e marca.** Nome da marca, logo, cor (as duas do logo ou o verde),
chave PIX, preferências de aviso (prazos e ofertas se desligam; fatos e
estado não).

**Gamificação.**
- *Nível do motorista* ([niveis.md](niveis.md)): Bronze → Prata → Ouro
  ensinam o app; **Platina** é estar em dia com as novidades (uma atividade
  por mês); **Diamante** é Platina + a trilha "Meu negócio". Nível é USO do
  app, nunca plano ou pagamento. A família **não vê** o nível dele.
- *Nível da família*: Bronze (avisos ligados), Prata (+ segundo responsável e
  "Já paguei"), Ouro (+ pagou em dia e avisa falta com antecedência; oscila).
  Só ela vê; nada é gravado.
- *Adesivo* (proposta em aberto): selo pequeno "Parceiro Alô Buzinou" com o
  logo dele, enviado quando ele chega ao Diamante.

**Avisos.** Três canais: push (app fechado), cartão na tela (app aberto) e
e-mail (só a cobrança da plataforma ao motorista). O sino separa novos e já
vistos. Aviso dura 90 dias.

**A auxiliar (05/10/2026).** Conta própria, ligada a um motorista: entra pelo
convite dele, vê a turma do dia numa cópia que o servidor mantém e marca a
rota por uma função do servidor (que confere o vínculo e se a conta do
motorista pode operar). O motorista anota o pagamento dela, a falta e quem a
substituiu. ⚠️ A Política de Privacidade ainda não fala dela nem das
substitutas.

**Outros.** Acesso de 24 h para o segundo responsável; pedido de acesso pelo
WhatsApp; irmão entra sozinho na conta da mãe; avaliação do app (cinco rostos,
depois de algo dar certo); suporte pelo WhatsApp; troca de versão com "Atualizar
para a versão X".

## 10. As jornadas (para testar)

O kit está em [testes-navegador/](../testes-navegador/): abre o Chrome como um
celular (360×740, toque, pt-BR, GPS em São Paulo), com as personas **Seu Zé**
(motorista) e **Mariana** (mãe), e anota os achados em
[ACHADOS.md](../testes-navegador/ACHADOS.md) com print.

**Como rodar:** emuladores de pé (`firebase emulators:start --project
demo-alobuzinou`, config em `.env.development.local`) e o `vite`; depois
`node testes-navegador/<jornada>.mjs`. Cada conta de teste tem o seu Chrome e
o login é feito uma vez só (`garantirSessao` no kit); sem ninguém assistindo,
`RAPIDO=1`. ⚠️ **Nada toca produção**: WhatsApp e
"compartilhar" são interceptados.

| Jornada | Quem | Script | Situação em 04/10/2026 |
|---|---|---|---|
| M1/M2 Cria a conta, primeiro acesso, tour | motorista | `m1-cadastro` | **refazer**: login e primeiro acesso mudaram |
| M3/M4 Cadastra a criança e manda o convite | motorista | `m3-crianca` | **refazer**: cadastro mudou |
| M3b Dados do contrato | motorista | `m3b-contrato` | existe |
| M3c Muda o combinado (aditivo) | motorista | `m3c-combinado` | existe |
| M5 Faz a ida com quatro crianças | motorista | `m5-rota` | existe; cores e Início mudaram |
| M6 Rota com as ferramentas | motorista | `m6-rota-completa` | existe |
| M7 Mapa desligado, perua quebrada, dia sem rota | os dois | `m7-ocorrencia` | existe |
| F1 A Central com a senha | motorista | `f1-financeiro` | refeita para a Central; espera reiniciar os emuladores |
| C1 A auxiliar na rota (sem senha, sem valor) | motorista e auxiliar | `c1-auxiliar-na-rota` | **passou** (05/10/2026) |
| P1 Sua perua | motorista | `p1-perua` | rodar o `semear-perua` antes |
| R1 Abre o convite e cria a conta | mãe | `r1-convite` | existe |
| R2 Aceita o contrato | mãe | `r2-aceite` | existe |
| R2b Aceita o aditivo | mãe | `r2b-aditivo` | existe |
| R3 Telefone da escola | mãe | `r3-escola` | existe |
| Troca de versão | os dois | `atualizacao` | existe; telas mudaram |
| **Cor do logo** (envia, responde, app muda) | motorista | — | **criar** |
| **Mensalidade ponta a ponta** (gera → "Já paguei" → baixa) | os dois | — | **criar** |
| **Buzina** (buzina → tela cheia na mãe) | os dois | — | **criar** |
| Dia a dia da família (ao vivo, falta, quem busca) | mãe | — | criar |
| Pedido de acesso sem link | os dois | — | criar |
| Acesso de 24 h do segundo responsável | mãe + terceiro | — | criar |
| Nível, Meu negócio, Buzi e Boletim | motorista | — | criar |
| Esqueci a senha | qualquer | — | criar |
| Painel do dono | dono | — | criar |

As lentes de cada achado: **UX** (o caminho), **UI** (a tela), **40+** (letra,
toque, contraste), **AI** (o que o app afirma bate com o que faz). Gravidade:
**Bloqueia**, **Atrapalha**, **Melhoria**.

## 11. Em construção e decisões em aberto (05/10/2026)

| Assunto | Estado |
|---|---|
| **A auxiliar trabalhar para dois tios** e a **recomendação** entre tio e auxiliar | plano da sessão prod; a recomendação depende da reestruturação para `{tio}_{aux}` e do prazo mínimo de trabalho juntos (decisão do dono) |
| **Transferir uma família** para um tio parceiro | plano da sessão prod |
| **Política de Privacidade**: auxiliar, substitutas, transferência e recomendação | pendente do dono (uma revisão só, com `LEGAL_VERSION` nova) |
| **Texto da saúde da criança** | rascunho, espera revisão jurídica |
| **Convite da família** com o logo do motorista e o nome mascarado (`Ana*****`) | esperando o dono escolher (A, B ou C) |
| **E-mail** com domínio próprio no Resend | sem ele, só o sandbox entrega |
| **Emuladores** | o de functions não responde; reiniciar é do dono |
| **Publicar no ar** | o ar está na 1.2; o GitHub tem muito mais |

Pauta completa de decisões: [pendencias.md](pendencias.md).

## 12. Para a sessão de jornadas: como trabalhar com o time

- **Várias sessões mexem no mesmo repositório ao mesmo tempo.** Nunca
  `git add -A`; em arquivo que outra sessão também mudou, faça commit **só dos
  seus trechos**. Commit e envio ao GitHub **só com o "pode" do dono**.
  Publicar no ar, só quando ele pedir.
- A sessão **projeto-weabapp-escolar-5d** é o **QA do time**: ela confere que o
  que vai ao GitHub compila numa cópia limpa e audita os commits. Avise-a
  (SendMessage) quando for commitar, e mande para ela o que achar de quebrado
  em código de outra sessão.
- Teste só com emuladores (`demo-alobuzinou`). Se um teste precisar de dado,
  use os scripts `semear-*.mjs` ou crie um novo nesse padrão.
- Achado vai para o [ACHADOS.md](../testes-navegador/ACHADOS.md) com print,
  gravidade e lente. Achado de segurança ou dinheiro vai também direto para o
  dono.
- **O plano de testes ao vivo** está no painel do dono:
  https://claude.ai/artifact/54HfCVe2badoUB9J6sr5d2 (aba "Testes ao vivo").
  Atualize-o com a ferramenta `ArtifactData` (ela atualiza a página na hora):
  - `jornadas/<id>` (ids: `m1`, `m3`, `m5`, `versao`, `cor-do-logo`,
    `mensalidade`, `buzina`, `m3b`, `m3c`, `m6`, `m7`, `r1`, `r2`, `r2b`,
    `r3`, `f1`, `p1`, `dia-a-dia`, `pedido-de-acesso`, `acesso-24h`, `nivel`,
    `senha`, `admin`): `update` com `status` (`a_fazer`, `rodando`, `passou`,
    `com_achados`, `bloqueada`, `esperando`), `nota` (uma frase), `achados`
    (`{bloqueia, atrapalha, melhoria}`), `sessao` e `atualizadoEm` (ISO).
  - `plano/geral`: `update` do `resumo` (o que está acontecendo agora).
  - `eventos/<id novo>`: `set` com `{em, sessao, texto}` a cada marco.
- Comece pelo que mudou em 04/10/2026: **M1, M3, M5 e a troca de versão**;
  depois crie **cor do logo, mensalidade ponta a ponta e buzina**.
