# Marca — Alô Buzinou

Todo arquivo de `public/brand/` é **gerado**. Não edite nenhum deles à mão:
mexa em `build_brand.py` (aqui do lado) e rode, da raiz do projeto:

```bash
python scripts/brand/build_brand.py
```

O script também reescreve `src/components/common/logoPaths.js`, que é a
geometria que o `<Logo />` usa. Uma geometria, todas as saídas — foi por não
ter isso que o ícone e o wordmark do gerador de imagem nasceram diferentes
(um sólido, um contornado).

## O desenho

Frente da perua com a janela em formato de balão de fala, e as ondas da
buzina saindo do canto superior direito. Diz "a perua chegou **e te avisou**"
sem depender de o usuário já conhecer o nome.

No wordmark, **o circunflexo do "ô" é a buzina** — as mesmas ondas, com o peso
recalculado pro corpo do texto (reduzir o arco do ícone daria fio de cabelo do
lado de um Nunito 900). É o que costura o nome ao ícone.

**Uma buzina por peça.** No logotipo COM a palavra, o ícone entra **sem ondas**:
quem buzina ali é o acento. As duas apareciam na mesma peça com os picos a 0,24
da altura das maiúsculas um do outro — perto demais pra lerem como coisas
diferentes, longe demais pra lerem como alinhados, e alinhar de verdade
custaria encolher o ícone em 25%. No ícone **sozinho** as ondas ficam, porque
ali não há palavra pra carregá-las.

**O que o ícone e o acento compartilham é `VAO_SOBRE_TRACO`** (0,91) — o vão
entre os dois arcos dividido pela espessura deles. É o que faz duas linhas
lerem como um gesto só. Os dois raios externos DERIVAM dessa constante; não
existem como número digitado. (O comentário antigo prometia "mesma razão entre
os raios" e isso era falso: 1,80 no ícone contra 2,54 no acento.)

Tipografia: **Nunito 900**, tracking −2,8% mais **kerning em quatro pares**
(`lo`, `zi`, `in`, `Bu`). Tracking uniforme preserva as laterais que a fonte
trouxe, feitas pra texto corrido: o vão de tinta ia de 0,0023 a 0,0653 em, e o
"l" e o "o" de "Alo" se tocavam — justo o "o" que recebe o acento. Com os
quatro pares a faixa fecha em 0,039–0,057. As letras estão convertidas em
curva, então nada aqui depende de webfont.

## No código, prefira o componente

```jsx
import Logo, { LogoMark } from '../components/common/Logo';

<Logo height={32} />                          {/* ícone + nome na linha */}
<Logo variant="stacked" height={104} />       {/* ícone em cima, nome embaixo */}
<Logo tone="onDark" height={30} />            {/* sobre fundo escuro */}
<LogoMark height={40} tone="mono" />          {/* herda a cor do texto */}
```

Vetor inline: sem requisição, sem piscada antes de carregar, e a mesma
geometria em fundo claro, escuro e impresso.

## Os arquivos

| Arquivo | Onde entra |
|---|---|
| `favicon.svg` | aba do navegador — ladrilho esmeralda com o balão (degrau C) |
| `favicon.ico` | reserva 16/24/32/48 px, **uma arte por tamanho** (ver Degraus) |
| `icon-192.png`, `icon-512.png` | ícones `any` do manifest |
| `icon-maskable-512.png` | ícone `maskable` — folga extra porque o Android recorta um círculo |
| `apple-touch-icon.png` | atalho na tela inicial do iOS (180 px) |
| `notification-badge-96.png` | `badge` de push: silhueta branca, o Android tinge pelo alfa |
| `og-image.png` | preview do link no WhatsApp (1200×630) |
| `mark.svg`, `mark-512.png` | marca colorida, fundo transparente |
| `mark-white.svg`, `mark-white-512.png` | marca branca com a janela vazada — pra fundo escuro ou foto |
| `wordmark.svg` / `.png` | logo horizontal pra fundo claro (relatório, PDF, impresso) |
| `wordmark-white.svg` / `.png` | logo horizontal pra fundo escuro |
| `wordmark-stacked.svg` | versão empilhada, pra espaço estreito e centralizado |

Os SVG são a fonte pra qualquer novo tamanho; os PNG existem só onde SVG não
serve (manifest, apple-touch, badge, preview de link).

## Paleta

Espelha `tailwind.config.js` — se mudar lá, mude no script.

| | |
|---|---|
| `#1F5F3F` | esmeralda — carroceria, "Alô" |
| `#3F9B12` | verde em fundo **claro** — ondas, "Buzinou" (`accentDark`) |
| `#52C41A` | verde em fundo **escuro** — as mesmas duas coisas |
| `#0B1210` | quase-preto — fundo escuro (hero, card de compartilhamento) |
| `#FFFFFF` | janela do balão |
| `#EEF1EF` | fundo de página |

**Por que dois verdes.** As ondas e a palavra "Buzinou" carregam o sentido
inteiro da marca — o "e te avisou" — e eram a coisa menos visível dela:
`#52C41A` dá **2,27:1** sobre branco e 1,99:1 sobre o `#EEF1EF` do app, quando
a WCAG 1.4.11 pede 3:1 pra gráfico com significado (a carroceria, que é só
carroceria, tem 7,59:1). `#3F9B12` sobe pra 3,55:1 / 3,12:1. Em fundo escuro
nada disso vale — ali `#52C41A` dá 8,36:1 e continua certo. **Não é cor nova**,
é a mesma cor por contexto.

## Degraus de tamanho

Uma geometria, três reduções. Reduzir o desenho inteiro pra 16 px punha o traço
da onda em 0,6 px e a roda em 1,6 px — abaixo de um pixel não existe desenho,
existe cinza.

A ordem de descarte é a ordem em que os elementos morrem, e ela sai da
espessura de cada um: a onda é um traço de 24, a roda é um bloco de 52×56, o
balão tem 256×170. **Some a onda primeiro, a roda nunca.**

| Degrau | Onde | O que fica |
|---|---|---|
| **A** | ≥ 64 px | completo: corpo, rodas, balão, as duas ondas |
| **B** | 24–64 px | sem ondas — a silhueta, que é o que se reconhece |
| **C** | ≤ 24 px | ladrilho: só o balão, que é o que carrega o sentido |

O degrau B usa a MESMA caixa do lockup (mark sem ondas), então a perua ocupa
a largura inteira do quadro em vez de ceder 13% pro vazio onde as ondas
estariam.

O `.ico` monta os quatro tamanhos com **uma arte por tamanho** (16 e 24 no
degrau C, 32 e 48 no B), o que o `sizes=` do Pillow não faz — ele redimensiona
uma arte só. O container é escrito à mão em `write_ico()`; PNG dentro de `.ico`
é aceito desde o Vista.

## Limites de uso

- Folga mínima ao redor do logo: a altura do "A" do "Alô".
- Não recolorir fora dessas cores, não aplicar sombra, contorno, gradiente nem
  rotação.
- O verde segue o FUNDO, não o gosto: `#3F9B12` no claro, `#52C41A` no escuro.
  Trocar por conta própria derruba o contraste do único elemento que diz o que
  o produto faz.
- Fundo escuro pede o tom `onDark` (janela vazada), não a versão colorida —
  a janela branca sobre preto vira um borrão claro.
- Abaixo de 20 px de altura, use só o `LogoMark`. O nome não é legível.
