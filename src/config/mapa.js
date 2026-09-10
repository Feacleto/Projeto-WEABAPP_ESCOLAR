/**
 * DE ONDE VÊM OS QUADRADINHOS DO MAPA — e por que isso precisou de decisão.
 *
 * ── O PROBLEMA QUE ISTO CONSERTA
 * Até 10/09/2026 os dois mapas do app pediam os tiles direto ao servidor do
 * **próprio OpenStreetMap** (`{s}.tile.openstreetmap.org`). É de graça, não
 * pede chave, e funciona — mas a *Tile Usage Policy* deles é explícita:
 * aquela infraestrutura é **doada**, de capacidade limitada, e destinada a uso
 * leve e não comercial. Quem passa disso é bloqueado, e sem aviso.
 *
 * ⚠️ E O NOSSO CASO É EXATAMENTE O PADRÃO QUE A POLÍTICA EXCLUI: rota ao vivo.
 * Uma responsável acompanhando a perua por vinte minutos, arrastando e dando
 * zoom, gera centenas de requisições de tile. Multiplique por família, por
 * dia, por motorista.
 *
 * O modo de falhar é o pior possível: o mapa fica **cinza para todas as
 * famílias ao mesmo tempo**, sem erro na tela, e nada no app acusa —
 * `avisoDoMomento` avisa quando o app MENTE sobre a rota, não quando o mapa
 * não carrega. A descoberta viria por reclamação.
 *
 * ── POR QUE MAPTILER, E NÃO OPENFREEMAP
 * A escolha real não era preço, era FORMATO. O OpenFreeMap serve só tiles
 * VETORIAIS, que exigem MapLibre GL e **WebGL** — trocar de provedor viraria
 * trocar a biblioteca de mapa, reescrever `LiveMap` e `MapPicker`, e levar
 * WebGL para o "Android barato" que este projeto trata como público
 * principal em todas as outras decisões. O Leaflet inteiro tem 144 KB e
 * desenha com `<img>`.
 *
 * O MapTiler serve RASTER na mesma forma do OSM: trocou-se a URL, e nada mais.
 * E tem porta de saída paga — no dia em que a camada grátis apertar, paga-se e
 * continua, com a mesma URL. Gratuito sem porta de saída obriga a migrar sob
 * pressão, com as famílias sem mapa.
 *
 * ── A CHAVE FICA VISÍVEL, E ISSO NÃO É DESCUIDO
 * Toda chave de tile aparece no bundle — é assim em qualquer provedor, porque
 * é o navegador que pede a imagem. A proteção NÃO é esconder: é **restringir a
 * chave por domínio** no painel do MapTiler (`alobuzinou.com`). Chave
 * restrita e visível é segura; chave secreta num app de navegador não existe.
 *
 * ⚠️ Por isso ela mora no `.env` e não aqui: não porque seja segredo, mas
 * porque é configuração de AMBIENTE — quem roda local com outra conta não
 * precisa editar código.
 *
 * ── O QUE ACONTECE SEM CHAVE
 * Volta para o OSM, que é o que havia antes. É o caminho de DESENVOLVIMENTO:
 * quem clona o repositório vê mapa sem precisar criar conta em nada.
 *
 * ⚠️ **ESSE CAMINHO NÃO É PARA PRODUÇÃO** — ele é justamente a política que
 * este arquivo existe para deixar de violar. `npm run testar:mapa` exige que
 * os dois mapas leiam daqui, e o build de produção precisa da chave.
 */

/**
 * O estilo. `streets-v2` porque o produto é transporte: nome de rua legível e
 * malha viária clara valem mais que relevo ou satélite.
 *
 * Sem `@2x`: retina dobra os bytes de cada tile, e o aparelho da ponta é um
 * Android de entrada em dado móvel — a mesma razão pela qual a tira do fundo
 * do login não tem animação.
 */
const ESTILO = 'streets-v2';

/**
 * A atribuição do MapTiler é EXIGÊNCIA da camada grátis, não cortesia — e a do
 * OSM continua junto porque o dado é dele nos dois casos.
 */
const CREDITO_MAPTILER =
  '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">&copy; MapTiler</a> ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">&copy; OpenStreetMap</a>';

const CREDITO_OSM =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

/**
 * Resolve o provedor a partir da chave. Função PURA de propósito: é o que
 * permite `npm run testar:mapa` provar os dois caminhos sem navegador.
 *
 * ⚠️ O `{s}` DO OSM SAIU. O sharding por subdomínio (`a.`, `b.`, `c.`) foi
 * aposentado pelo OSM — eles pedem `tile.openstreetmap.org` direto. Estava
 * aqui porque veio de um trecho de exemplo antigo.
 */
export function tilesPara(chave) {
  const k = String(chave || '').trim();
  if (!k) {
    return {
      provedor: 'osm',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: CREDITO_OSM,
      maxZoom: 19,
    };
  }
  return {
    provedor: 'maptiler',
    url: `https://api.maptiler.com/maps/${ESTILO}/{z}/{x}/{y}.png?key=${k}`,
    attribution: CREDITO_MAPTILER,
    maxZoom: 20,
  };
}

/**
 * ⚠️ `import.meta.env` NÃO EXISTE NO NODE, e o `?.` é o que mantém este
 * arquivo importável pelo teste. Sem ele, `npm run testar:mapa` morreria em
 * "Cannot read properties of undefined" e o projeto ganharia um módulo de
 * configuração que nenhum teste alcança — exatamente o que a regra de camada
 * deste repositório existe para evitar.
 */
export const MAPA = tilesPara(import.meta.env?.VITE_MAPTILER_KEY);
