# Handoff — Arquitetura de informação das DUAS PORTAS PÚBLICAS

Repositório: `Feacleto/Projeto-WEABAPP_ESCOLAR` · branch `WebApp-oficial-v1`
Escopo: `src/pages/Home.jsx` (porta do motorista) e `src/pages/Familia.jsx` (porta da família).
**Fora do escopo:** os painéis `/tio`, `/pai` e `/admin`.

Referência visual: `Alo Buzinou - IA das Portas.dc.html` neste pacote — protótipo em HTML, abre no navegador. 4 artboards: mapa das portas, home do motorista, porta da família, as duas telas em 390px. **Não é código de produção.**

---

## A REGRA QUE ORGANIZA TUDO

Toda vez que aparecer um bloco novo, a pergunta é: **isso ajuda alguém a DECIDIR ou alguém a ENTRAR?**
Decidir mora em `/`. Entrar mora em `/familia`. Nada mora nas duas — e conteúdo que serviria nas duas provavelmente está escrito genérico demais pra funcionar em qualquer uma.

Nada aqui muda rota, permissão, rules ou componente compartilhado. São mudanças de conteúdo e de ordem dentro de dois arquivos.

---

# PARTE 1 — `src/pages/Home.jsx` (motorista)

## 1.1 De 7 blocos para 6

O array `secoes` hoje:

```js
const secoes = [
  ['inicio', 'Início'],
  ['perguntas', 'As três perguntas'],
  ['telas', 'As telas do app'],
  ['como', 'Como começa'],
  ['parceiro', 'Quem já é associado'],
  ['vozes', 'Avaliações'],
  ['motorista', 'Vaga de associado'],
];
```

Fica:

```js
const secoes = [
  ['inicio', 'Início'],
  ['perguntas', 'As três perguntas'],
  ['telas', 'As telas do app'],
  // Prova social ANTES do "como começa": quem não acreditou não lê passo a
  // passo. E os dois blocos antigos (parceiro + vozes) respondiam a MESMA
  // pergunta — "isso é de verdade?" — em dois gestos de rolagem. Com um
  // associado e poucos depoimentos, dividir a prova em dois blocos faz a
  // escassez de prova parecer maior do que ela é.
  ['prova', 'Quem já usa'],
  // A objeção de maior peso não tinha bloco: ela estava terceirizada pro
  // botão do consultor, que só atende quem toca.
  ['custo', 'O que custa'],
  // Os 3 passos desceram pra cá, colados no pedido: "como começa" só
  // interessa a quem já decidiu.
  ['motorista', 'Sua vaga'],
];
```

`ctaVisivel` continua igual (`active !== 'motorista' && active !== 'inicio'`).
`useSnapSections` não muda. As bolinhas passam a ser 6 automaticamente.

## 1.2 Bloco `prova` — funde `parceiro` + `vozes`

Junte os dois `<Snap>` atuais em um só, nesta ordem interna:

1. `<ArtBadge />` (a arte que já abria o bloco `parceiro`)
2. Chapéu `quem já usa` + o `<h2>` "Somos o seu principal parceiro…" (mantido)
3. O tile branco com `LOGO_ASSOCIADO` (mantido como está — logo de marca precisa de fundo claro, e a nota sobre nunca usar `photoURL` continua valendo)
4. `<ReviewsBlock items={testimonials} stats={rating} loaded={vozesLoaded} />`
5. A linha "Quem avalia é quem usa…" e a linha "Já é cliente de um associado? Peça o link de convite…"

`<ArtStars />` sai (a arte de estrelas fica redundante ao lado do `ReviewsBlock`, que já mostra a nota). Nenhum dado novo: `testimonials`, `rating`, `vozesLoaded` e `showcase` já existem no estado.

## 1.3 Bloco `custo` — NOVO. É o coração deste handoff.

**Não é tabela de preço.** É a FORMA do dinheiro. O código atual é honesto ao admitir que a dúvida "quanto fica na MINHA mensalidade?" não cabe em parágrafo e foi mandada pro consultor — o que funciona pra quem toca e perde quem não toca, que é a maioria de quem lê página de vendas às 22h.

Quatro afirmações, nesta ordem, no cartão de vidro (`GLASS`) do resto da página:

1. **"A mensalidade das suas famílias é sua."** PIX, dinheiro ou maquininha, direto com a família. A plataforma **não entra no caminho desse dinheiro** e não fica com percentual.
2. **"O que você paga é a taxa de associação."** Mensal, com dia de vencimento definido no contrato.
3. **"São dois dinheiros diferentes, e o app não mistura nem numa tela."** (é verdade no produto: a taxa vive em `/tio/taxa`, fora de `/tio/finance`, exatamente por isso)
4. **"Quanto é: a gente fecha na conversa"** — porque a vaga é negociada. Aí sim o `<ConsultorButton assunto="quanto custa a associação" />` entra como *próximo passo*, e não como desvio.

> Dizer que a plataforma não toca no dinheiro dele é provavelmente a frase mais forte que essa página pode ter, e hoje ela não está em lugar nenhum. Se sobrar espaço pra uma só, é a 1.

**Regras de conteúdo deste bloco:** nenhum valor em reais na página pública (a vaga é negociada, e número fixo aqui vira promessa); nenhum "a partir de"; nenhuma comparação com concorrente. Verbo no presente, frase curta.

## 1.4 Bloco `motorista` — recebe os 3 passos

Ordem interna final: `<ArtSeats />` → pastilha da rodada → "Sua vaga de associado" → o parágrafo da estrutura → **`<StepsSequence />` com o chapéu "do caderno pro app em 3 passos"** → botão "Garanta seu nome na lista" → "Entrar na fila é grátis…" → a linha do brinde → `<ConsultorButton />` → `<footer>`.

`<ArtSteps />` pode ser reaproveitada acima do `StepsSequence`, ou descartada — o bloco já tem `ArtSeats`.

## 1.5 O que NÃO tocar em `Home.jsx`

- **A rolagem travada** (`snap-y snap-mandatory` no scroller próprio, `h-[100svh] overflow-y-auto`). É a decisão certa pro leitor que ela tem, e o comentário explica por que não pode ser no body.
- **A ordem interna do hero.** Ela já segue o olho e está documentada passo a passo no arquivo.
- **O "Entrar" pequeno na barra fixa do topo.** Serve a minoria (quem já é cliente) e já perdeu o destaque de propósito.
- **A frase única do botão flutuante** (`CONVITE_LABEL`). Botão que troca de texto por bloco fica bonito e não ensina o destino.
- **Números reais e a regra do piso.** `comPiso` no contador de famílias, e **nunca** em `rating` — piso em opinião de terceiro é falsificar depoimento.
- **Demo em mock** (`PhoneDemo`). Print real vazaria nome e endereço de criança.
- **A vitrine só com marca**, nunca `photoURL` (função pública, roda sem login).
- **A escassez só verdadeira**, saindo de `src/config/rodada.js`.

---

# PARTE 2 — `src/pages/Familia.jsx` (responsável)

A estrutura está certa e as regras estão escritas no cabeçalho do arquivo. Três consertos.

## 2.1 Falta o rodapé legal — e aqui ele importa MAIS

A home do motorista tem LGPD, Termos, Privacidade, CNPJ e a assinatura de quem desenvolveu. A porta da família **não tem nenhum** — e é aqui que está a pessoa cujos dados (e os do filho: endereço, foto, escola) estão no sistema.

Acrescentar no fim, antes da linha "Alô Buzinou — o transporte escolar do seu filho, organizado.":

- a mesma linha de LGPD com `<ShieldCheck>` ("Todos os dados são tratados conforme a LGPD. Endereço e localização só aparecem pra quem tem vínculo.")
- os dois links legais: `/termos` e `/privacidade`
- a assinatura da empresa (o mesmo `DesenvolvaAlgoLogo` + CNPJ)

**Sem "seja parceiro", sem "quero fazer parte", sem link pra `/`.** O responsável não é público de aquisição — essa regra continua valendo no rodapé.

## 2.2 "Mesmo sistema visual" não está cumprido

O cabeçalho do arquivo promete o mesmo material das duas portas. Na prática:

| | Home | Familia |
|---|---|---|
| fundo | `#0B1210` + 3 brilhos animados + malha | `bg-primaryDark` (`#143F2A`) chapado |
| cor dos ícones | `emerald-300` | `secondary` (`#F5A623`) |
| cartão | `bg-white/[0.055] border-white/10 rounded-3xl` | igual ✓ |

Proposta: **mesma base `#0B1210`, sem os brilhos animados** (calma é o objetivo desta porta) e ícones em esmeralda. Mesmo produto, temperatura diferente — de propósito, e não por acidente. O âmbar é a cor de **aviso** no app inteiro; usá-lo como cor decorativa da porta da família gasta um sinal que tem outro trabalho.

Se preferir manter o `primaryDark`, então corrija o comentário do arquivo em vez do CSS — o que não pode ficar é a promessa sem o cumprimento.

## 2.3 Nada diz o que fazer quem NUNCA teve conta

"Perdeu o link?" atende quem já teve. Quem nunca recebeu — a mãe que ouviu falar do app e procurou sozinha — não tem frase nenhuma, e a conta dela **só pode nascer pelo convite do motorista** (`redeemInvite` é o único caminho). Sem uma linha, ela fica tentando "Entrar" com um email que não existe.

Acrescentar dentro do mesmo cartão de "Perdeu o link?", como última linha:

> **Ainda não tem conta?** Só o seu motorista pode criar a sua — peça o link pra ele.

## 2.4 O que NÃO acrescentar em `Familia.jsx`

Mapa, print do app, vídeo, "baixe agora", depoimento de mãe, contagem de associados, taxa, vaga, roleta, **e principalmente nenhuma escassez**. Cada bloco a mais é uma tela a mais entre ela e o botão branco. As quatro linhas de `DENTRO` continuam quatro.

---

# PARTE 3 — Fora do código

**O QR impresso.** Se o material vai pra mão da FAMÍLIA (cartão na van, adesivo, folheto entregue no portão), o QR tem que apontar pra `/familia`, não pra `/`. É a única decisão de porta que não está no código — está na gráfica. Material pro motorista continua apontando pra `/`.

---

# Aceite

- [ ] A home do motorista tem 6 bolinhas de seção, e a 4ª é a prova social.
- [ ] Nenhum valor em reais aparece na página pública.
- [ ] O bloco "o que custa" diz, com essas palavras, que a plataforma não entra no caminho da mensalidade das famílias.
- [ ] Os 3 passos aparecem no último bloco, acima do botão da lista.
- [ ] A porta da família tem LGPD + Termos + Privacidade + CNPJ, e **nenhum** convite de associação.
- [ ] A porta da família tem a frase de "ainda não tem conta".
- [ ] `DENTRO` continua com 4 itens; nenhuma menção a taxa, vaga ou prazo.
- [ ] Fundos e cores das duas portas coerentes com a decisão tomada em 2.2 (e o comentário do arquivo dizendo a verdade).
- [ ] `npm run lint` limpo. Nenhuma rota nova em `App.jsx`.

# Atualize o CLAUDE.md

Registrar a ordem nova dos blocos da home e o bloco "o que custa" (o `CLAUDE.md` pede atualização quando muda tela ou estrutura), e a regra de porta: decidir mora em `/`, entrar mora em `/familia`.
