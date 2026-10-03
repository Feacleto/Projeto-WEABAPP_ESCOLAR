/**
 * A RÉGUA DAS VARREDURAS — o que as agendadas leem, e em que ordem.
 *
 * ⚠️ RÉGUA PURA: este arquivo não faz `require` nenhum (regra de
 * `functions/lib/`, conferida por `npm run testar:imports`). Quem fala com o
 * Firestore passa a consulta por parâmetro, e é isso que deixa
 * `npm run testar:varreduras` medir a paginação com consultas de mentira.
 *
 * ── POR QUE ISTO EXISTE (03/10/2026)
 * Duas agendadas liam a plataforma de um jeito que só funcionava com a base
 * pequena:
 *
 *   varrerAtrasos         `children.limit(500)`, sem filtro e sem ordem. Com
 *                         3.000 crianças, ~2.500 famílias nunca recebiam
 *                         "a rota não começou" — sempre as mesmas, sem erro.
 *   apagarViagensAntigas  `collectionGroup('rides')` inteiro num `.get()`,
 *                         com o padrão de 60 s e 256 MiB. Um documento por
 *                         criança por dia letivo: a primeira noite com a
 *                         base cheia estoura memória e não apaga nada.
 *
 * O conserto das duas é o mesmo tipo de coisa — ler em páginas, e ler só o
 * que pode gerar efeito — e as duas decisões moram aqui.
 */

'use strict';

/** O Firestore recusa lotes acima de 500; 400 deixa folga (como billing e fechamento). */
const TAMANHO_DA_PAGINA = 400;

/**
 * Lê uma consulta inteira em páginas, pelo cursor do último documento.
 *
 * `montar(ultimo)` devolve a consulta da próxima página (com `orderBy` e
 * `limit` já aplicados, e `startAfter(ultimo)` quando `ultimo` existe). A
 * régua não sabe o que é Firestore: só que a consulta tem `.get()` e o
 * resultado tem `.docs`.
 *
 * ⚠️ PÁGINA INCOMPLETA É O FIM. Sem isso, a última página custaria uma
 * consulta extra que volta vazia — barato, mas a cada vinte minutos.
 */
async function* paginar(montar, tamanho = TAMANHO_DA_PAGINA) {
  let ultimo = null;
  for (;;) {
    const snap = await montar(ultimo).get();
    const docs = (snap && snap.docs) || [];
    for (const doc of docs) yield doc;
    if (docs.length < tamanho) return;
    ultimo = docs[docs.length - 1];
  }
}

/**
 * Apaga em páginas o que uma consulta devolve, até ela voltar vazia.
 *
 * ⚠️ SEM CURSOR, DE PROPÓSITO. Quem foi apagado sai do resultado, então a
 * mesma consulta devolve a página seguinte sozinha — um cursor pularia
 * documentos. É o mesmo desenho do `purgeOld` de `billing.js`.
 *
 * ⚠️ E COM TETO DE PÁGINAS. Se um lote "apaga" e a consulta continua
 * devolvendo os mesmos documentos (regra, permissão, emulador estranho), o
 * laço sem teto rodaria até o timeout da function, gastando leitura. O teto
 * para antes e diz que parou: o que sobrar sai na próxima noite.
 *
 * `buscar(tamanho)` devolve uma lista de documentos; `apagar(docs)` grava o
 * lote. Devolve `{ apagados, paginas, interrompido }`.
 */
async function apagarEmPaginas({ buscar, apagar, tamanho = TAMANHO_DA_PAGINA, maxPaginas = 250 }) {
  let apagados = 0;
  let paginas = 0;
  for (;;) {
    if (paginas >= maxPaginas) return { apagados, paginas, interrompido: true };
    const docs = (await buscar(tamanho)) || [];
    if (!docs.length) break;
    await apagar(docs);
    apagados += docs.length;
    paginas += 1;
    if (docs.length < tamanho) break;
  }
  return { apagados, paginas, interrompido: false };
}

/**
 * QUEM A VARREDURA DE ATRASOS PRECISA OLHAR, E COMO.
 *
 * Entra a lista de motoristas (uids) e os documentos de `liveLocation`
 * (`{ id, routeActive }`). Sai:
 *
 *   semRota  motoristas cuja rota NÃO está ativa. Destes, a turma inteira é
 *            lida: os dois casos de `avisoDeAtraso` podem valer ("a rota não
 *            começou" e "passou da hora de chegar").
 *   comRota  motoristas com a rota rodando. Destes, só interessa a criança
 *            que consta NA PERUA — o caso "a rota não começou" exige rota
 *            parada, então ler a turma inteira deles seria leitura sem efeito.
 *
 * ⚠️ O CASO GRAVE NÃO DEPENDE DA ROTA. "Passou da hora de Lucas chegar" vale
 * com a rota ativa (ela ficou aberta e a criança não foi marcada), e por isso
 * os motoristas com rota não são DESCARTADOS — eles mudam de consulta.
 * Descartá-los calaria justamente o aviso que o cabeçalho de
 * `reguaDosAvisos.js` chama de pior caso.
 *
 * ⚠️ NA DÚVIDA, "A ROTA ESTÁ ATIVA". `rotasIlegiveis: true` (a leitura de
 * `liveLocation` falhou) põe TODO motorista em `comRota`: concluir "a rota
 * não começou" por causa de um soluço de rede mandaria aviso de atraso para a
 * base inteira. É a mesma regra que a varredura antiga aplicava motorista a
 * motorista.
 */
function motoristasDaVarredura({ motoristas = [], rotas = [], rotasIlegiveis = false } = {}) {
  const ativos = new Set();
  for (const r of rotas || []) {
    if (r && r.id && r.routeActive === true) ativos.add(r.id);
  }
  const semRota = [];
  const comRota = new Set();
  const vistos = new Set();
  for (const uid of motoristas || []) {
    if (!uid || vistos.has(uid)) continue;
    vistos.add(uid);
    if (rotasIlegiveis || ativos.has(uid)) comRota.add(uid);
    else semRota.push(uid);
  }
  return { semRota, comRota };
}

/**
 * A criança que veio da consulta "na perua" (plataforma inteira) entra na
 * avaliação? Só se o motorista dela está com a rota rodando — as dos outros
 * já vieram pela turma inteira, e avaliar duas vezes avisaria duas vezes.
 */
function avaliarDaPerua(crianca, comRota) {
  return Boolean(crianca && crianca.adminUid && comRota && comRota.has(crianca.adminUid));
}

module.exports = {
  TAMANHO_DA_PAGINA,
  paginar,
  apagarEmPaginas,
  motoristasDaVarredura,
  avaliarDaPerua,
};
