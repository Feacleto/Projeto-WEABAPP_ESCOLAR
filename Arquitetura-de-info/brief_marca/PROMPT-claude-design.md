# Prompt para o Claude Design — Sistema de marca do Alô Buzinou

> Como usar: cole o conteúdo abaixo (da linha `---` em diante) no Claude Design,
> ou rode `/design` no Claude Code apontando para este arquivo. **Anexe junto**,
> se puder: `public/brand/mark.svg`, `public/brand/wordmark.svg`,
> `public/brand/og-image.png` e um print de `/` e de `/pai`. O brief é
> autossuficiente sem eles, mas a marca atual desenhada vale mais que a marca
> atual descrita.

---

Você é o diretor de arte e o redator de um sistema de marca. Preciso de um
**brand book aplicável** para um app que já está no ar — não de um rebrand do
zero, e não de um moodboard.

## 1. O produto, em um parágrafo

**Alô Buzinou** é um PWA mobile-first de transporte escolar, em português do
Brasil, que liga o **motorista de perua escolar** às **famílias**. O motorista
convida a família por um link; a família acompanha a rota no mapa ao vivo,
recebe o aviso de chegada, avisa falta, vê o contrato e a mensalidade. O nome
vem da buzina: quando o motorista chega e ninguém desce, em vez de buzinar na
rua às 6h40 ele dispara uma chamada que toca em tela cheia no celular do
responsável. **"Alô, buzinou"** é literalmente a coisa que o produto faz.

Três coisas de modelo de negócio que a marca precisa respeitar, porque estão nos
Termos de Uso:

1. **A plataforma não toca no dinheiro da família.** A mensalidade é PIX,
   dinheiro ou maquininha, direto do responsável para o motorista. A plataforma
   só cobra uma taxa de associação do motorista, em outra tela. Misturar os dois
   dinheiros numa peça de marca quebra o contrato.
2. **O app é do motorista, não da escola.** O motorista é o cliente que paga; a
   família é a usuária que ele traz. São duas portas de entrada diferentes, com
   objetivos opostos (uma vende, a outra acolhe).
3. **Escassez e número são reais ou não existem.** Contador que reinicia sozinho
   é propaganda enganosa (CDC art. 37), e isso já foi decidido no produto.

## 2. O que JÁ existe — e por quê (não jogue fora sem argumento)

### O desenho atual

Frente da perua vista de frente: um retângulo arredondado esmeralda com duas
rodinhas embaixo, e a **janela em formato de balão de fala** (branca, vazada,
com a "perninha" do balão apontando para baixo à direita). Do canto superior
direito saem **duas ondas de buzina** em arco, verde-claro. A leitura pretendida
é: *"a perua chegou **e te avisou**"* — sem depender de a pessoa já conhecer o
nome.

No wordmark, **o circunflexo do "ô" de Alô é a buzina** — as mesmas duas ondas,
com o peso recalculado para o corpo do texto. É o que costura o nome ao ícone.

### Tipografia

- Logotipo: **Nunito 900**, tracking −2,8%, letras convertidas em curva (o logo
  não depende de webfont: sai idêntico no PDF, no preview do WhatsApp e no
  celular offline).
- Interface: **Inter** (400/500/600/700).

### Paleta (espelha o `tailwind.config.js`, e há razão em cada valor)

| Hex | Papel |
|---|---|
| `#1F5F3F` | esmeralda — carroceria do ícone, palavra "Alô", `theme-color` do PWA |
| `#143F2A` | esmeralda escuro — estado pressionado |
| `#52C41A` | verde — ondas da buzina, palavra "Buzinou", sucesso |
| `#F5A623` | âmbar — atenção, aviso, pendência |
| `#EF4444` | vermelho — erro, atraso |
| `#0B1210` | quase-preto — fundo das telas escuras (hero, card de compartilhamento) |
| `#EEF1EF` | fundo de página: cinza com **viés verde** (o G um degrau acima de R e B). Cinza puro lê como "não escolhido"; azul criaria um segundo sistema de cor. Tem 12,7% de separação do branco do cartão, então o cartão flutua sem precisar de borda |
| `#FFFFFF` | cartão, janela do balão |
| `#F6F8F7` | superfície recuada dentro de um cartão branco |
| `#111827` / `#6B7280` | texto / texto secundário |

### Os arquivos que a marca precisa gerar hoje

`favicon.svg` (troca de cor sozinho em tema escuro) · `favicon.ico` 16/32/48
(hoje é um tile esmeralda sólido, porque em 16 px o desenho vazado desaparece) ·
`icon-192.png` e `icon-512.png` (manifest `any`) · `icon-maskable-512.png` (o
Android recorta um círculo) · `apple-touch-icon.png` 180 px ·
`notification-badge-96.png` (silhueta branca, o Android tinge pelo alfa) ·
`og-image.png` 1200×630 · `mark.svg` / `mark-white.svg` · `wordmark.svg` /
`wordmark-white.svg` / `wordmark-stacked.svg`.

### Limites de uso já em vigor

Folga mínima = a altura do "A" do "Alô". Nunca recolorir fora da paleta, nunca
sombra, contorno, gradiente ou rotação. Fundo escuro pede a versão de janela
vazada (a janela branca sobre preto vira um borrão claro). Abaixo de 20 px de
altura, só o ícone — o nome não é legível.

### 🔒 A restrição que mais importa

**Todo arquivo de marca é GERADO por um script** a partir de uma geometria
única, descrita em coordenadas — retângulos com raio, arcos com espessura,
curvas de fonte. Uma geometria, todas as saídas. Isso existe porque, antes,
ícone e wordmark tinham nascido de gerador de imagem em dois desenhos diferentes
(um sólido, um contornado) e divergiram na mesma tela.

Consequência para você: **entregue a marca em geometria descritível, não em
pintura.** Formas primitivas, raios, ângulos de arco, espessuras de traço,
coordenadas relativas numa caixa de 512×512. Se você propuser algo que só existe
como imagem rasterizada ou como gradiente complexo, ele não entra no produto.
SVG limpo com `<path>` / `<rect rx>` / `<circle>` é o formato certo. Junto de
cada proposta, escreva os parâmetros em texto, de modo que uma pessoa consiga
reimplementá-la no gerador sem abrir seu arquivo.

## 3. As duas pessoas com quem a marca conversa

Elas não são segmentos de mercado, são dois estados mentais opostos. Peça que
serve às duas provavelmente está genérica demais para funcionar em qualquer uma.

### O MOTORISTA (no código o papel se chama `admin` — é o dono da perua)

- Homem ou mulher de 35 a 60 anos, dono do próprio negócio, tipicamente 15 a 40
  crianças. Muitos já são chamados de "Tio Fulano" pelas famílias, e o app deixa
  cada um escolher a própria marca de exibição ("Tio Nino") — a marca do app
  divide cabeçalho com a marca dele **e não pode competir com ela**.
- Usa o app **em pé, na rua, com uma mão**, sol na tela, celular Android barato,
  muitas vezes com a perua ligada. Antes do app: caderninho, planilha e três
  grupos de WhatsApp.
- O que ele teme: passar vergonha cobrando; ser visto como "o motorista
  desorganizado"; tecnologia que dá trabalho; parecer que entregou o controle do
  próprio negócio para um aplicativo.
- O que ele compra: **respeito profissional**. O app faz o trabalho chato
  (avisar, cobrar, organizar) para ele parecer o profissional que já é.
- Frases que hoje abrem a porta dele: *"Você faz seu transporte. O app avisa,
  cobra e organiza."* / *"Menos WhatsApp, menos caderninho, menos cobrança na
  mão."*

### O RESPONSÁVEL (papel `parent`)

- Na maioria mãe, 28 a 45 anos, celular na mão enquanto faz outra coisa. Entra no
  app por um link que o motorista mandou no WhatsApp — **e link pelado, mandado
  por alguém pedindo que ela clique, tem cara de golpe.** A primeira peça de
  marca que ela vê é o preview desse link.
- Usa o app em dois momentos: **os cinco minutos antes de a perua chegar** (a
  criança já está de mochila na porta) e **a hora de saber se chegou na escola**.
  Fora disso, quase não abre.
- O que ela teme: não saber onde o filho está. Só isso. Todo o resto —
  mensalidade, contrato, faltas — é secundário e ela resolve quando lembra.
- O que ela compra: **calma**. Não empolgação, não novidade, não gamificação.
- A porta dela **não tem uma palavra de aquisição**: sem vaga, sem taxa, sem
  escassez, sem preço. Ela não está comprando nada; está entrando numa conta que
  já existe.

## 4. O que eu quero de volta

Um **canvas com artboards**, nesta ordem. Cada artboard é uma página do brand
book, e cada decisão vem com **uma linha dizendo por quê** — o projeto tem a
convenção de que comentário explica o porquê, não o quê, e o brand book segue a
mesma regra.

1. **Diagnóstico da marca atual.** O que funciona, o que não sobrevive, o que
   está ambíguo. Seja específico e duro. Em particular: a metáfora "perua + balão
   de fala + ondas" está legível para quem vê pela primeira vez, ou virou um
   ícone genérico de mensagem?
2. **Ícone aprimorado — 3 direções.** Não três estilos do mesmo desenho: três
   apostas diferentes sobre o que o símbolo deve dizer. Cada uma renderizada em
   **512, 96, 32 e 16 px lado a lado, em tamanho real**, porque o teste de 16 px
   reprova sozinho a maior parte das ideias boas. Marque qual você recomenda, e
   por quê.
3. **Sistema do ícone.** Da direção recomendada: colorido, branco vazado,
   monocromático, maskable com a zona de segurança do Android desenhada por cima,
   e o badge de notificação (silhueta chapada, só alfa).
4. **Favicon.** O problema aberto: em 16 px o desenho vazado some, e a solução
   atual é um tile esmeralda sólido sem desenho — funciona, mas não é marca.
   Resolva isso: quero um favicon que ainda seja **reconhecidamente esta marca**
   a 16 px, na aba clara e na aba escura.
5. **Lockups.** Horizontal, empilhado e uma assinatura mínima, com a grade de
   folga cotada em múltiplos da altura do "A". Mostre também o logo do app ao
   lado da marca própria do motorista ("Tio Nino") num cabeçalho de 390 px,
   resolvendo a hierarquia entre as duas.
6. **Paleta com PAPÉIS e contraste.** Não uma fileira de quadradinhos: para cada
   cor, onde ela pode e não pode aparecer, e a razão de contraste medida contra
   os fundos reais (`#EEF1EF`, `#FFFFFF`, `#0B1210`). Mínimo WCAG AA 4,5:1 para
   texto — o motorista lê essa tela sob o sol.
7. **Tipografia aplicada.** A escala real do app: título de tela, número grande
   (a hora de hoje), rótulo maiúsculo espaçado, corpo, legenda. Com o tamanho
   mínimo que sobrevive a um celular barato ao sol.
8. **Tom de voz — a espinha.** Um artboard com os princípios e, ao lado de cada
   um, **um par escrito errado / escrito certo tirado do app**. Os princípios que
   já são lei aqui e você precisa incorporar:
   - **Nunca prometer o que o app não mede.** "Chega em uns 7 minutos" foi
     arrancado do produto: era distância em linha reta com velocidade chutada, e
     a mãe desce com a criança no palpite. Virou "A perua está a 1,2 km daqui —
     avisamos quando estiver perto."
   - **Avisar quando o próprio app está mentindo**, e só então. A tarja de aviso
     dispara em dois casos, não em cinco: rota não iniciada depois da hora de
     pegar, e criança "na perua" muito depois da hora de chegar. Atraso comum não
     gera tarja — ali o app está calado, não mentindo, e tarja semanal ensina a
     pular tarja.
   - **Falar o efeito para uma pessoa**, não a funcionalidade. Até as mensagens
     de commit deste projeto seguem isso: *"O pai é avisado quando a criança
     chega"*, não *"adiciona notificação de status"*.
   - **Nada de exclamação empolgada, nada de emoji decorativo, nada de
     infantilizar.** Há crianças no produto, não no público.
9. **Tom de voz PARA O MOTORISTA.** Vocabulário aprovado e vocabulário banido
   (ex.: o app diz "perua", não "veículo"; diz "as suas famílias", não "os seus
   clientes"). Como se pede dinheiro sem constranger. Como se dá má notícia
   (fatura vencida, conta suspensa) sem soar como banco. Escreva de verdade: 3
   push, 1 tela de erro, 1 aviso de cobrança, 1 mensagem de boas-vindas.
10. **Tom de voz PARA O RESPONSÁVEL.** Como se escreve para alguém em vigília.
    Escreva de verdade: o push de "a perua está chegando", o push de "chegou na
    escola", a tela de "dia encerrado", a tela de erro quando o GPS caiu, e o
    aviso de mensalidade — lembrando que **quem cobra é o motorista, não a
    plataforma**, e o texto não pode confundir isso.
11. **A peça mais importante do funil: o convite no WhatsApp.** O card de preview
    do link (1200×630), o texto que o motorista manda junto, e a primeira tela
    que ela abre. O trabalho desta peça é ser o oposto de um golpe: reconhecível,
    específica, com o nome do motorista dela.
12. **Ilustração e ícone de interface.** O app já tem artes de linha simples
    (casa → perua → escola). Defina a regra do sistema: espessura, cantos, uso de
    cor, e o que nunca aparece. Nota crítica: **rosto de criança em peça de marca
    é dado sensível**, o app trata isso sob LGPD, e ilustração de criança
    reconhecível está fora.
13. **Aplicações.** Adesivo do vidro traseiro da perua (a peça de aquisição mais
    barata que existe aqui), cartão de "peça seu link", assinatura de WhatsApp,
    story 1080×1920 e o cabeçalho de um PDF de contrato.
14. **Página de uso indevido.** O que quebra a marca, desenhado errado de
    propósito.

## 5. Como eu vou julgar

- **Passa no 16 px** ou não passa.
- **Sobrevive à luz do sol** num Android de 100 reais.
- **Cabe no gerador**: descritível como geometria, não como pintura.
- **As duas vozes soam diferentes** quando lidas em voz alta, e nenhuma das duas
  soa como software.
- **Não promete nada que o produto não faça** — nem minuto de chegada, nem
  intermediação de pagamento, nem vaga que não existe.
- **O motorista continua sendo o profissional.** Se a marca do app aparecer maior
  que a dele para a família dele, está errado.

## 6. O que NÃO fazer

- Não proponha renomear o produto. "Alô Buzinou" já está no comportamento do app
  e no domínio.
- Não troque a fonte da interface (Inter) — é decisão de engenharia, não de
  marca.
- Não invente número, depoimento, prêmio, selo, quantidade de usuários ou
  parceiro. Se uma peça pede prova social, deixe o espaço marcado como
  `[dado real a preencher]`.
- Não use fotografia de banco de imagens de criança sorrindo em van.
- Não entregue slogan em inglês.
- Não me devolva um moodboard de referências. Devolva decisões desenhadas.
