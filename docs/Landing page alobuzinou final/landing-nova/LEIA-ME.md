# Landing nova — o que mudou e por quê

Arquivo: `landing-nova/index.html` → substitui `landing/index.html`.
Um arquivo só, CSS e JS inline, sem build, sem dependência além do Google Fonts.
Mesmas fontes (Bricolage Grotesque + Instrument Sans), mesma paleta, mesmo texto.

---

## A decisão de arquitetura, em uma frase

A página deixa de ser **dez seções no mesmo ritmo** e passa a ser um **tronco
comum que se parte em duas faixas opostas e volta a se juntar numa quebra
amarela**:

    TRONCO      hero → o problema → como funciona
                (serve aos três públicos, ninguém pula nada)
    ↓
    BIFURCAÇÃO  duas portas, lado a lado, em tela cheia
    ↓ ↓
    FAIXA DO MOTORISTA          FAIXA DA FAMÍLIA
    denso, verde escuro         arejado, areia
    números à esquerda          frases curtas, muito respiro
    mockup: quem pagou          mockup: mapa + aviso
    ↓                           ↓
    A DECLARAÇÃO (preto)        (as duas terminam com um link
    "a mensalidade é sua"        cruzado pra faixa do outro)
    ↓ ↓
    A QUEBRA AMARELA — "a gente está começando"
    ↓
    comunidade → sobre → RI (sóbrio) → dúvidas (2 públicos) → contato

---

## Os oito problemas, um por um

### 1 · Monotonia estrutural

Antes: nove de dez seções eram `chapeu → h2 → lead → grid de cards`.

Agora cada seção tem um **peso declarado**, e a forma muda com o peso:

| Peso | Seções | Forma |
|---|---|---|
| DOMINA | hero · bifurcação · a declaração · a quebra amarela | sangram na largura toda, tipo em `clamp(2rem, 5.4vw, 3.6rem)`, sem card nenhum |
| MÉDIO | problema · como funciona · as duas faixas · comunidade · sobre | largura de leitura, régua ou card |
| PASSAGEM | RI · dúvidas · contato | tipo menor, linha divisória no lugar de card |

Os `grid g3` de card sobraram em **dois** lugares (comunidade e valores), não
em nove. O resto virou régua (`.razoes`, `.calmas`, `.tese`), que é outra
textura.

### 2 · A página nunca mostrava o produto  ⭐ o maior ganho

Três telas, todas em CSS/SVG, nenhuma imagem externa:

- **`.t-pag`** — quem pagou, quem está em aberto, e o botão de PIX. Na faixa do
  motorista, logo depois da lista de razões. A linha do Davi pisca em âmbar: é
  o único que está em aberto.
- **`.t-mapa`** — a perua andando pela rota, com o pin da casa pulsando e o
  cartão "voltando pra casa" embaixo. A rota é um `<path>` e a perua anda em
  **`@keyframes` com as mesmas coordenadas em %** — desenho e movimento não
  podem divergir quando a tela muda de tamanho.
- **`.t-aviso`** — a tela de bloqueio recebendo a notificação de chegada.

**Como virar foto depois:** cada mockup é `.fone > .tela`. O `.fone` é a moldura
(proporção 9/19, sombra, notch). Trocar o conteúdo de `.tela` por um `<img>` é
uma linha — a proporção e a moldura continuam valendo.

### 3 · Os dois públicos recebiam forma idêntica

| | Motorista | Família |
|---|---|---|
| fundo | `--verde-esc` | `--areia` |
| densidade | 6 linhas numeradas coladas numa régua | 5 frases com 26px de respiro entre elas |
| tipo | corpo 1.03rem, peso 500 | corpo até 1.22rem, peso 500, linha 1.42 |
| ritmo | tudo numa coluna, sem ar | quase o dobro de espaço vertical por item |
| prova | uma tela de dinheiro | duas telas de tranquilidade |
| fecho | uma declaração em preto, tipo gigante | um cartão com borda esquerda verde |

Ele está comprando: a faixa dele **empilha argumento**. Ela está sendo
tranquilizada: a faixa dela **respira**.

### 4 · A bifurcação não existia

Antes os dois botões do hero só rolavam pra baixo, e quem era família
atravessava a faixa inteira do motorista.

Agora eles apontam para `#escolha` — uma seção **preta de tela cheia com duas
portas lado a lado**, divididas por um fio amarelo de 2px. Cada porta diz o
estado mental de quem entra ("Você está decidindo se vale a pena" / "Você quer
saber onde seu filho está") e tem uma silhueta própria em SVG.

E cada faixa termina com um **link cruzado** (`.troca`) — quem entrou na porta
errada acha a certa sem voltar ao topo.

### 5 · A área de RI não parecia RI

Registro tipográfico próprio, dentro da mesma marca:

- fundo `#0E1714` (mais frio que o `--preto`), texto `#D9E2DD`
- **sem card, sem canto arredondado, sem verde caloroso** — três linhas
  separadas por régua de 1px, rótulo em mono à esquerda numa coluna de 120px
- `h2` menor que o das outras seções (2.4rem contra 3rem)
- uma linha de identificação no topo: razão social, cidade, CNPJ
- o único CTA da página que não é caloroso

### 6 · Faltava um momento de quebra

A seção **"A gente está começando"** — que é o diferencial da marca e tinha o
mesmo peso de uma lista de benefícios — virou o centro visual da página:

- **amarelo sangrado de ponta a ponta**, a única seção assim
- faixa de van (preto sobre amarelo) no topo e no rodapé da seção
- `h2` em `clamp(2.3rem, 6.6vw, 4.6rem)` — o maior tipo depois do `h1`
- as três colunas são separadas por **régua de 2px**, não por card
- o fecho é uma frase de 2.3rem, não um parágrafo

Ela resolve os problemas 1, 6 e 7 de uma vez.

### 7 · O amarelo — corrigido: ele NÃO é da marca

O brief pedia pra explorar `#F2B705` como identidade. **Não dá, e o motivo
está no próprio design system do projeto:**

- `#F2B705` não existe em lugar nenhum do `tailwind.config.js`. Foi inventado
  pra landing.
- O âmbar que existe é `warning: #F5A623`, e a **regra 1** do sistema é
  literal: *"âmbar é aviso e nada mais — algo que a pessoa precisa atender"*.
  Ela nasceu de um bug: havia um `secondary` com o mesmo hex, "a segunda cor"
  servia pra qualquer coisa, e foi assim que o sinal de alerta virou enfeite.
  Pintar a landing de amarelo repete exatamente esse erro, em escala maior.
- A marca não tem amarelo. Tem **verde-floresta** (`#1F5F3F`) e o
  **verde-limão das ondas da buzina** (`#52C41A`).

**`--amarelo` foi removido do arquivo.** O papel estrutural que ele teria
passa pro verde-limão, que é a cor mais reconhecível da marca de verdade:

1. a régua de progresso de leitura no rodapé da nav
2. a faixa que fecha o hero (verde/preto)
3. o fio que divide as duas portas da bifurcação
4. a barra de 6px no topo da declaração
5. a seção-quebra inteira
6. o topo do rodapé
7. a haste da bandeira da escola, na cena do hero

**A única exceção**, declarada como `--aviso: #F5A623`: a linha do pagamento
em aberto **dentro do mockup do app**. Ali não é decoração — é o produto de
verdade mostrando um aviso de verdade, e mudar a cor seria mentir sobre a tela.

### 7b · A tarja "dia 10" virou uma folha do caderno

Ela era o melhor elemento da página e continua sendo — mas o amarelo saiu, e
verde-limão no lugar seria pior: no app o verde-limão significa **concluído**,
e este bloco é o problema, não a solução.

Agora é **uma folha de caderno pautada**, arrancada e jogada na tela escura,
com a margem vermelha à esquerda. É o caderno de onde o `h1` diz que o
transporte saiu — o bloco passou a ilustrar a frase que abre a página.

### 8 · O FAQ falava com um público só

Duas abas — **Quem dirige** / **Quem confia**. As nove perguntas do motorista
ficam iguais. Seis novas para a família, e três delas saem direto do que o app
faz (não inventei regra):

- Como eu crio minha conta? *(só o motorista cria — é o `redeemInvite`)*
- Quem consegue ver onde meu filho está?
- E se eu perder o link?
- Eu pago pelo app? *(não — quem tem conta com a plataforma é o motorista)*
- Como aviso que hoje meu filho não vai?
- Preciso instalar alguma coisa? *(PWA, instala pelo navegador)*

Os chips de atalho são por aba e abrem a pergunta certa.

---

## A marca, aplicada de verdade

**O logo era desenhado em CSS** — um círculo verde com um retângulo amarelo
dentro (`.buzina`). Não é a marca: é uma coisa parecida com ela.

Agora o `<svg>` inline carrega **a geometria real de `public/brand/mark.svg`**
— a perua com a janela em balão de fala e as duas ondas de buzina. Essa
geometria é gerada por script a partir de uma origem única, justamente pra
ícone e wordmark nunca divergirem; redesenhar em CSS aqui recriava a
divergência que o gerador existe pra evitar.

Duas versões, as mesmas do repositório: **colorida** no cabeçalho (fundo claro)
e **branca com a janela na cor do fundo** no rodapé (fundo verde) — porque o
`wordmark-white.svg` do repo tem a janela em `#0B1210` e vira um buraco preto
sobre o verde.

**A perua da cena do hero passou a ecoar o ícone**: corpo branco, faixa em
`--verde-esc` (era amarela) e as ondas de buzina saindo do canto superior
direito, com o mesmo gesto do símbolo.

**A paleta base também foi alinhada ao `tailwind.config.js`:** o fundo saiu do
creme `#FAF9F6` pro `#EEF1EF` do app — cinza com viés verde, não creme — e o
texto secundário saiu de `#5A6660` pro `#55606E`, que é o valor corrigido do
`textMuted` (o antigo reprovava contraste sobre o fundo da página). A landing
e o produto agora são visivelmente a mesma marca.

## O que eu mantive intacto

- A tarja **"dia 10"** — número gigante em bloco diagonal, no lugar da foto.
  Continua sendo o melhor elemento da página; só trocou de material (ver 7b).
- A **timeline** de "Como funciona", com a linha que se desenha ao rolar e os
  nós acendendo. Só mudou o `requestAnimationFrame` no scroll.
- A **composição animada do hero** — van, faixa correndo, pin pulsando, blob.
- O **spotlight** que segue o cursor nos cards.
- Todas as cores, as duas fontes, os sete itens do menu com o mesmo peso.
- **Todo o texto aprovado**, palavra por palavra. Só reorganizei ordem e forma,
  e cortei duas repetições ("E a gente vive de quê?" virou o painel dos dois
  dinheiros, que diz a mesma coisa em menos palavras).

## O que continua travado, e continua respeitado

- Nenhum número de tração. Nenhum contador. Nenhum "X motoristas".
- Nenhum preço em lugar nenhum.
- **"A mensalidade das suas famílias é sua"** virou a maior linha de texto da
  página — seção própria, fundo preto, `clamp(2rem, 5.4vw, 3.6rem)`, com um
  painel ao lado mostrando os dois dinheiros e a legenda "nunca se encontram".
- "A gente está começando" não foi suavizada: foi **ampliada**.
- Zero depoimento, selo, logo de cliente ou badge de loja.

---

## O botão de Entrar

Faltava — quem já é cliente chegava na landing e não tinha caminho pro app.

- **No cabeçalho**, à esquerda do hambúrguer, e **visível também no mobile**:
  login escondido atrás de menu é login que não se acha.
- **Pequeno de propósito.** Serve a minoria que já tem conta; destaque igual
  ao dos CTAs de venda roubaria a cena de quem ainda está decidindo. Contorno
  em vez de preenchimento.
- Repetido no rodapé, no fim da coluna "Navegar".
- ⚠️ **O endereço é um palpite:** `https://app.alobuzinou.com.br/login`.
  Está marcado com comentário no HTML — confirmar o domínio do `hosting:app`
  antes de publicar. Aparece em dois lugares.

## Os grafismos, aplicados na página

O kit tinha quatro peças e a landing usava zero. Agora três estão em uso, uma
por seção, **cada uma onde ela significa alguma coisa** — e nenhuma decorando
por decorar.

**`percurso` em "Como funciona"** — casa → perua → escola, acima da timeline.
Resume os quatro passos numa linha antes de a pessoa ler qualquer um deles.
*Microinteração:* a perua só percorre o trajeto **quando a seção entra na
tela**, e as duas paradas acendem em verde junto. Animação que roda fora de
vista é bateria gasta no celular dela.

**`ondas` em "Comunidade"** — três arcos propagando no canto superior direito.
Aqui a onda não é enfeite: é o argumento da seção desenhado (um tio avisa o
outro, que avisa o outro). *Microinteração:* ao passar o ponteiro na seção, o
ciclo acelera de 3,6s para 1,9s — a propagação fica mais rápida quando você
chega perto. No toque, roda sozinha.

**`marca-dagua` em "Sobre"** — a perua a 12% (o teto do guia de marca) no canto
inferior direito. *Microinteração:* 76px de deslocamento ao longo do trecho
visível, calculado no mesmo `requestAnimationFrame` do resto do scroll. Curso
curto de propósito: marca d'água que se mexe muito vira atração e disputa com
o texto.

A quarta peça (`faixa-rodape`) não entrou: ela é uma barra de três cores, e
uma delas era o amarelo. Sem ele vira uma barra de dois verdes, que é
exatamente o que a faixa do hero e o topo do rodapé já fazem.

## O menu ficou verde

A barra passou de areia translúcida para **verde institucional sólido**.

Sólida, e não translúcida, por um motivo específico: a janela da perua no
logo é preenchida com o mesmo `#1F5F3F` da barra. Com fundo translúcido ela
deixaria de casar assim que a página rolasse por baixo — a janela apareceria
como uma mancha da cor do conteúdo.

Sobre a barra verde **o lockup dispensa a placa** (seria verde sobre verde).
A placa continua valendo em fundo claro — rodapé de e-mail, PDF, cartão.

O botão **Entrar** virou contorno branco que preenche em verde-limão no hover.
E o menu passa a virar hambúrguer em **1000px**, não em 900: são sete itens
mais o botão, e a 1000px eles já quebravam em duas linhas. Nav e grid não têm
o mesmo ponto de aperto, então cada um tem o seu breakpoint.

## Um bug de contraste que valia mais que os outros

O texto de apoio da seção do motorista — *"A gente não vem te ensinar a
dirigir…"* — estava em **1,6:1**, praticamente invisível.

A causa não era a cor escolhida: era a **regra que não pegava**. A seção usa
`class="sec mot"`, e as regras de texto sobre fundo escuro estavam escritas
para `.escuro` e `.verde`. O `.mot` tem o mesmo fundo verde e nome de classe
próprio — então caía no `.lead` do tema claro, cinza escuro sobre verde.

Corrigido em todas as regras da família (`lead`, `chapeu`, `card p`, `b2`,
`fone-leg`): **quem decide a cor do texto é o fundo, não o apelido da seção.**

Aproveitei e troquei **todo texto com alfa sobre cor saturada** por valor
sólido. `rgba(234,246,239,.78)` sobre `#1F5F3F` dava 4,4:1 e reprovava o piso
— e o pior é que ninguém percebe, porque a conta muda com o fundo e nunca é
refeita. Agora são hex fixos, medidos: `#D6E7DC` sobre verde (5,6:1) e
`#C7D3CD` sobre preto (12,1:1).

## Mais três grafismos

Agora são seis no total.

**`pauta` na seção do problema** — a pauta do caderno correndo pela seção
inteira a 3% de branco. Não é um desenho em cima do fundo: é o material do
fundo. A seção é sobre o caderno e a tarja é uma folha dele.

**`dois dinheiros` na declaração** — a nota com o cifrão e o cartão de
crédito, em contorno. *Microinteração:* eles flutuam **se afastando** um do
outro, num ciclo de 7s. É a frase da seção desenhada — *"são dois dinheiros
diferentes, e eles nunca se encontram"*. Grafismo que repete o argumento em
vez de decorar.

**`eco` atrás do celular do motorista** — quatro arcos concêntricos saindo
por trás do aparelho, como som que ele emite: é o gesto do ícone em escala de
cena, e resolve o fundo vazio ao redor do mockup sem inventar elemento novo.
*Microinteração:* os atrasos são quartos exatos do ciclo, então sempre há uma
onda na tela e a emissão fica contínua — sem o trecho morto que aparece
quando os atrasos somam menos que a duração.

**`marca-dagua` no contato** — a perua a 7% no canto inferior esquerdo, com o
mesmo parallax da seção "Sobre" (o cálculo agora serve todas as marcas d'água
da página, não uma só).

**O RI continua sem grafismo nenhum**, de propósito. É a única seção sóbria da
página e a ausência é o que faz o registro dela.

## Técnico

- **Primeiro quadro completo.** `.rv` só ganha `opacity:0` se o `<script>` no
  `<head>` confirmar que existe `IntersectionObserver` e que não há
  `prefers-reduced-motion` — só então ele põe `.anima` no `<html>`. Sem JS, sem
  observer ou com movimento reduzido, a página nasce inteira. Ainda há uma rede
  de segurança de 4s que revela tudo na marra.
- **`prefers-reduced-motion`** desliga tudo. Três elementos ganharam guarda
  explícita (`.notif`, `.pulso`, `.halo`) porque o ciclo deles **termina
  invisível** — congelar no último quadro deixaria o mockup vazio.
- **Contraste AA.** `--verde-vivo` (#52C41A) só aparece sobre `--preto`
  (9,2:1) ou como preenchimento; nunca como texto sobre fundo claro. Amarelo só
  carrega texto `--preto` (11,6:1). O RI usa `#C6D2CC` sobre `#0E1714` (11,1:1).
- **Nada depende de hover.** O spotlight só liga em `(hover:hover)`; as portas,
  os chips e o accordion funcionam no toque.
- **Foco visível** com `:focus-visible` de 3px em `--verde-vivo`.
- **Sem rolagem horizontal** em nenhuma largura — testado de 320px pra cima.
- O scroll usa um `requestAnimationFrame` só, com listener `passive`.
- O formulário monta a mensagem e abre `wa.me/5511969170709`.

## Antes de publicar

- [ ] Os links de **Termos** e **Política** ainda são `href="#"` — apontar pros
      arquivos reais quando existirem.
- [ ] Conferir a seção RI com alguém de fora: o registro sóbrio é intencional,
      mas vale confirmar que não ficou frio demais pro tom da marca.
- [ ] `landing/brand/` continua servindo os favicons — nada mudou ali.
