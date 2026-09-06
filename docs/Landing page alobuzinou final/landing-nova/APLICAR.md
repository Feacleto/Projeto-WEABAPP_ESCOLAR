# Como aplicar no projeto

A landing é **HTML estático, sem build**. Trocar o arquivo é a aplicação inteira.

## 1 · Substituir o arquivo

    landing-nova/index.html   →   landing/index.html

É o único arquivo que muda. **Não mexa em** `landing/brand/`, `landing/robots.txt`
nem `landing/sitemap.xml` — continuam servindo como estão, e os caminhos de
favicon e og:image do HTML novo são os mesmos.

## 2 · Confirmar o endereço do login  ⚠️ obrigatório

Procure por `app.alobuzinou.com.br` no arquivo — **duas ocorrências**, uma no
cabeçalho e uma no rodapé. É um palpite meu; troque pelo domínio real do
`hosting:app`. Há um comentário no HTML marcando o primeiro.

## 3 · Conferir localmente

    npx serve landing        # ou qualquer servidor estático
    # abrir http://localhost:3000

Vale abrir com **DevTools em 320px** e com **"Emular prefers-reduced-motion"**
ligado — foram os dois casos que mais quebraram durante a construção.

## 4 · Publicar

    firebase deploy --only hosting:landing

Nada de `npm run build`: a landing não passa pelo Vite. E confira o
[docs/deploy.md](../docs/deploy.md) — desde 05/09/2026 são dois sites e a
ordem importa.

---

## Se preferir que um agente aplique

Mande estas três linhas junto com a pasta:

> Substitua `landing/index.html` pelo `index.html` desta pasta. Não altere
> `landing/brand/`, `robots.txt` nem `sitemap.xml`. Antes de publicar, troque
> as duas ocorrências de `app.alobuzinou.com.br` pelo domínio real do
> `hosting:app`. O `LEIA-ME.md` explica cada decisão de design, caso precise
> justificar alguma mudança.

---

## Duas coisas que ficaram pendentes fora da landing

Não bloqueiam a publicação, mas valem uma tarefa:

1. **`landing/brand/favicon.svg` ainda some a 16px.** É o desenho vazado; a
   1,63% de traço as ondas desaparecem. O `.ico` já é tile por esse motivo,
   e o comentário do `index.html` do app até explica o porquê — só não foi
   aplicado ao `.svg`, que é o que o Chrome usa.
2. **Faltam dois arquivos em `public/brand/`:** `wordmark-on-primary.svg` e
   `wordmark-stacked-white.svg`. A landing não depende deles (o lockup do
   cabeçalho é SVG inline), mas qualquer peça de logo sobre o verde `#1F5F3F`
   sai com a janela da perua em preto sem o primeiro.
