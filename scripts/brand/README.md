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

Tipografia: **Nunito 900**, tracking −2,8%. As letras estão convertidas em
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
| `favicon.svg` | aba do navegador (troca de cor sozinho em tema escuro) |
| `favicon.ico` | reserva 16/32/48 px — tile esmeralda, porque em 16 px desenho vazado desaparece |
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
| `#52C41A` | verde — ondas da buzina, "Buzinou" |
| `#0B1210` | quase-preto — fundo escuro (hero, card de compartilhamento) |
| `#FFFFFF` | janela do balão |
| `#EEF1EF` | fundo de página |

## Limites de uso

- Folga mínima ao redor do logo: a altura do "A" do "Alô".
- Não recolorir fora dessas cinco cores, não aplicar sombra, contorno,
  gradiente nem rotação.
- Fundo escuro pede o tom `onDark` (janela vazada), não a versão colorida —
  a janela branca sobre preto vira um borrão claro.
- Abaixo de 20 px de altura, use só o `LogoMark`. O nome não é legível.
