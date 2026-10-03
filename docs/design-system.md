# Design system — o app e o site com uma cara só

Aprovado pelo dono em 02–03/10/2026. As telas de referência, vivas ao toque:

- O sistema inteiro (diferenças, tokens, peças, movimento e modelos): https://claude.ai/artifact/Qw1AvnPdKCU6RCG7HRo2ym
- Início, Rota e Financeiro do motorista já no sistema: https://claude.ai/artifact/H8Ky7m5Ajqy6jc1KH74v1q

> **Os VALORES moram num lugar só: [tailwind.config.js](../tailwind.config.js).**
> Este documento guarda as REGRAS de uso. Não copie hex para cá nem para
> componente nenhum.

## Como mudar um valor

1. Mude no `tailwind.config.js` (o porquê de cada cor está no próprio arquivo).
2. Rode `npm run tokens`. Ele gera `src/design/tokens.css` (o CSS cru do app)
   e `landing/tokens.css` (o site, que é HTML sem build).
3. Rode `npm run testar:contraste` e `npm run testar:design`.

`testar:design` falha se uma das cópias ficar diferente da fonte, se o site
declarar cor própria (`--verde:` dentro de `landing/`), se alguém voltar para
a Inter ou se aparecer letra abaixo de 12px no app.

No site, as variáveis têm os nomes de sempre (`--verde`, `--areia`,
`--linha`, `--vivo`…), e cada uma é só um apelido do token do app. A lista
está em [scripts/tokens-css.mjs](../scripts/tokens-css.mjs).

## Por que existe: as nove diferenças

Em 02/10/2026 quem vinha do site achava que tinha aberto outro produto. O site
tinha a cara da marca, o app tinha as cores medidas. Ficou a cara de um com a
régua do outro.

| | Antes | Decisão |
|---|---|---|
| D1 Fonte | site Bricolage + Instrument Sans; app Inter | as do site nos dois |
| D2 Tamanho | app com 270 usos de 9–11px | piso de 12px; corpo 16 no app, 18 no site |
| D3 Botão | site verde na home e limão nas páginas | verde sobre claro; limão só sobre verde ou escuro |
| D4 Cinzas | app com os cinzas azulados do Tailwind | os do site, puxados para o verde |
| D5 Chips | cada lado com os seus | um conjunto: verde do site, âmbar e vermelho do app |
| D6 Cantos | site 12–22 sem regra; app 8/12/16/24 | 10 · 14 · 20 · 28 · pílula |
| D7 Cartão | site com borda; app com 5 sombras soltas | sombra `rest`, sem borda; borda só em campo e lista |
| D8 Ícones | site desenhado à mão; app lucide | lucide nos dois, traço 2 |
| D9 Rótulo | site mono; app Inter 10px | mono 12px, maiúsculas, espaçado (`.rotulo`) |

**O que continua diferente de propósito:** o cabeçalho (verde na porta — site
e login —, branco dentro de `/tio` e `/pai`, com a marca do motorista), o
painel do dono (mais denso, mesmo piso de 12px) e a superfície escura (só no
site).

**Dentro do app não existe tela escura (decisão do dono, 03/10/2026).** As
telas de entrada — boas-vindas, cadastro do motorista, login, primeiro acesso
e o topo do painel do dono — eram escuras porque "quem chega está comprando".
Passaram para o claro: a porta é o cabeçalho VERDE com a marca, e o resto é a
areia do app. A folha (`Sheet`) também perdeu a tampa escura. O que fica
escuro é só o balão do tutorial, que usa a tinta do texto.

## Cor: cada nome é um papel

As cinco regras do CLAUDE.md continuam valendo (âmbar é aviso, verde e âmbar
não são texto, meça contra o fundo real, uma sombra colorida por tela, cor crua
só nos três endereços de paleta). O sistema acrescentou:

- **`text` (#0B1210)** para título, valor e nome; **`textBody`** para parágrafo
  longo; **`textMuted`** para o secundário.
- **O limão (`accent`) só vira botão sobre verde ou escuro**, com o rótulo em
  `onAccent`. Sobre fundo claro o botão principal é `primary`.
- **`menta`** é o rótulo em mono sobre verde ou escuro; **`onNightAccent`** é a
  palavra verde sobre escuro. Os outros verdes claros que existiam saíram.

## Letra

- **Bricolage Grotesque** (`font-display`): título de tela (todo `h1` e `h2`
  já sai nela, pelo `index.css`), a marca e o número que importa. Aparece
  pouco, senão deixa de ser voz.
- **Instrument Sans**: todo o resto.
- **Mono do sistema**: só o rótulo em maiúsculas (`.rotulo`) e código (PIX, CNPJ).
- **Piso de 12px no app inteiro.** As três exceções estão nomeadas, com o
  motivo, em `testar-design.mjs` (contrato impresso e dois desenhos).

## Peças

- **Botão** ([Button](../src/components/common/Button.jsx)): `primary`,
  `secondary` (branco com borda), `danger` (fundo `dangerText`, porque branco
  sobre `danger` dava 3,8:1), `ghost`. Alturas 56, 48, 40. Um principal por
  tela. O texto é o verbo do que acontece ("Dar baixa", nunca "Confirmar").
- **Campo** ([Input](../src/components/common/Input.jsx)): 56px, borda de 2px,
  rótulo em cima; no foco, borda verde e halo limão.
- **Cartão** ([Card](../src/components/common/Card.jsx)): branco, canto 20,
  sombra `rest`, sem borda.
- **Estado da criança** ([StatusBadge](../src/components/children/StatusBadge.jsx)):
  segue a legenda do mapa — em casa cinza, **na perua âmbar**, na escola
  violeta, entregue verde.
- **Estado da mensalidade:** pendente cinza, avisou que pagou âmbar (é o
  motorista que precisa conferir), paga verde, atrasada vermelha. Âmbar e
  vermelho sempre com ícone. As palavras moram num lugar só,
  [paymentVocabulary](../src/dominio/cobranca/paymentVocabulary.js) — do lado
  do motorista: Recebido, Conferir, Pendente, Atrasado.
- **Ícone em vez de emoji:** sempre do lucide. Quando o ícone vem de um dado
  (recado, despesa, data festiva), o dado guarda o nome e
  [IconePorNome](../src/components/common/IconePorNome.jsx) desenha.
- **O cartão verde do Início** ([ResumoDaTurma](../src/components/tio/ResumoDaTurma.jsx)):
  "12 crianças, 3 escolas", a hora da primeira parada e o botão limão. Os
  números crescem conforme o motorista cadastra. É o único bloco verde da tela.

## Lista

Rosto ou ícone, nome, uma linha de detalhe e **no máximo uma coisa à direita**.
Pelo menos 64px de altura, tocável inteira. O traço entre as linhas começa
depois do rosto. Quem está fora hoje fica no fundo recuado, sem sumir. Lista
vazia nunca fica em branco: diz o que vai aparecer ali e oferece a primeira ação.

## Diálogos

Do mais leve ao mais forte: **balão** (ensina, a tela não escurece) → **folha**
(escolha ou pouco preenchimento, nasce embaixo) → **confirmação** (só o que não
tem volta: título é a pergunta, texto é a consequência, botão repete o verbo) →
**tela cheia** (só a buzina). Um por vez. Erro aparece onde aconteceu, nunca num
popup por cima. Durante a rota, nada de confirmação.

## Movimento

Quatro durações (`duration-toque` 120, `-estado` 200, `-entrada` 300, `-festa`
450) e duas curvas (`ease-freio`, `ease-mola`). No CSS cru: `var(--dur-*)` e
`var(--curva-*)`.

- Toda animação responde a um toque ou a uma mudança real do dado.
- Menos de meio segundo, uma vez, e para. As exceções têm nome: o número que
  conta e o pulso do "ao vivo".
- Nunca prende o dedo. Com "reduzir movimento", o estado final aparece direto.
- **Na rota, só o que confirma o gesto do motorista.** Nada de festa.
- **Pulso vivo sobre dado velho é proibido**: a posição envelheceu, o anel para.
- A mola só em conquista (check, contador), nunca em erro ou aviso.

**As exceções nomeadas** (o resto não se mexe sozinho):

- o anel do "ao vivo" (mapa, rota ativa) — e ele PARA quando a posição envelhece;
- o anel do tour guiado, enquanto o balão aponta para o alvo;
- os cartões do fundo do login, que flutuam devagar (`testar:fundo` trava a
  conta e o "reduzir movimento");
- a ilustração das boas-vindas e do cadastro: a perua anda UMA vez e chega;
- o selo da data festiva ao lado da saudação: pulsa DUAS vezes e para;
- o confete do aniversário, que só existe enquanto o modal está aberto.

## Rota e financeiro

- **Rota:** uma parada em foco, com um botão de 60px e o verbo do momento; as
  outras numa linha do tempo, com a hora combinada e a real embaixo. **Nenhuma
  previsão em minutos** — a distância vira palavra (longe, perto, chegou).
- **Financeiro:** o total recebido em destaque, a barra dos quatro estados com
  ícone, quantidade e valor, e quem avisou que pagou logo depois. Atrasado
  tem **nome e valor**, nunca só a contagem. Valor sempre `R$ 1.234,56` em
  algarismos de largura fixa; a cor fica na tag, nunca no número. **Os dois
  dinheiros nunca se somam** — a taxa da plataforma tem a própria tela.
