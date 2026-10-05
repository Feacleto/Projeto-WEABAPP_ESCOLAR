/**
 * A COMUNIDADE — a régua pura (sem require; `npm run testar:comunidade`).
 * Espelho de `src/dominio/identidade/comunidade.js` nas constantes.
 *
 * Desenho aprovado pelo dono em 05/10/2026 (etapa 1): no Início do tio, o
 * botão "Comunidade" com duas abas — "Minhas famílias" (a foto da turma numa
 * época festiva) e "Tios parceiros" (quem ele indicou e quem o indicou).
 *
 * ⚠️ FOTO DE CRIANÇA SÓ SAI COM O "SIM" DE CADA FAMÍLIA (LGPD, art. 14).
 * Numa foto da turma são várias crianças, e um "sim" só não cobre a foto:
 * quem posta MARCA quem está nela, e o servidor confere criança por
 * criança. `children.fotoDaTurmaConsentida` é escrito SÓ pela responsável
 * (rules), e ausente é NÃO.
 *
 * ⚠️ PARA OS TIOS PARCEIROS, NUNCA CRIANÇA. A família autorizou mostrar o
 * filho a ELA (e às famílias da mesma turma), não a outros motoristas. Post
 * para parceiros não pode ter criança marcada e exige a declaração "nesta
 * foto não aparece nenhuma criança".
 *
 * ⚠️ A FOTO SOME SOZINHA em `DIAS_DA_FOTO` (o fim da época): as rules negam a
 * leitura depois de `expiraEm`, e uma agendada apaga o documento e o arquivo.
 */

const DIAS_DA_FOTO = 30;
const PUBLICO = Object.freeze({ FAMILIAS: 'familias', PARCEIROS: 'parceiros' });
const EPOCAS = Object.freeze([
  'Volta às aulas',
  'Carnaval',
  'Páscoa',
  'Dia das Mães',
  'Festa Junina',
  'Dia dos Pais',
  'Dia das Crianças',
  'Natal',
  'Formatura',
]);
const MAX_CRIANCAS = 40;
const LEGENDA_MAX = 80;

/** O caminho do arquivo no Storage: `fotosDaTurma/{uid}/{id}.jpg`. */
function caminhoValido(uid, caminho) {
  if (typeof caminho !== 'string' || !uid) return false;
  const prefixo = `fotosDaTurma/${uid}/`;
  if (!caminho.startsWith(prefixo)) return false;
  return /^[A-Za-z0-9_-]{6,40}\.(jpg|jpeg|png|webp)$/.test(caminho.slice(prefixo.length));
}

/**
 * Pode publicar? `turma` é um mapa childId → documento da criança (lido pelo
 * servidor). Devolve `{ ok: true }` ou `{ ok: false, erro, semSim? }`.
 */
function validarPublicacao({ uid, publico, criancas, epoca, legenda, todasMarcadas, semCrianca, turma } = {}) {
  if (!Object.values(PUBLICO).includes(publico)) return { ok: false, erro: 'Escolha para quem é a foto.' };
  if (!EPOCAS.includes(epoca)) return { ok: false, erro: 'Escolha a época da foto.' };
  if (legenda != null && (typeof legenda !== 'string' || legenda.length > LEGENDA_MAX)) {
    return { ok: false, erro: 'A legenda passou do tamanho.' };
  }
  const lista = Array.isArray(criancas) ? criancas : [];
  if (lista.length > MAX_CRIANCAS || new Set(lista).size !== lista.length) {
    return { ok: false, erro: 'A lista de crianças está errada.' };
  }

  if (publico === PUBLICO.PARCEIROS) {
    if (lista.length > 0 || semCrianca !== true) {
      return { ok: false, erro: 'Para os tios parceiros, só foto sem criança.' };
    }
    return { ok: true };
  }

  if (todasMarcadas !== true) {
    return { ok: false, erro: 'Confirme que marcou todas as crianças da foto.' };
  }
  const semSim = [];
  for (const id of lista) {
    const c = turma?.[id];
    if (!c || c.adminUid !== uid || c.active === false) {
      return { ok: false, erro: 'Uma das crianças marcadas não é da sua turma.' };
    }
    if (c.fotoDaTurmaConsentida !== true) semSim.push(id);
  }
  if (semSim.length) {
    return { ok: false, erro: 'Há criança na foto sem a autorização da família.', semSim };
  }
  return { ok: true };
}

/**
 * Os parceiros de um tio, a partir das indicações: quem ele indicou e quem o
 * indicou, desde que o indicado já tenha conta (`indicadoUid`). Uma linha
 * por pessoa; se os dois se indicaram, vale "você indicou".
 */
function parceirosDe(uid, { feitas = [], recebidas = [] } = {}) {
  const mapa = new Map();
  for (const i of feitas) {
    const outro = i?.indicadoUid;
    if (outro && outro !== uid) mapa.set(outro, 'voce_indicou');
  }
  for (const i of recebidas) {
    const outro = i?.indicadorUid;
    if (outro && outro !== uid && !mapa.has(outro)) mapa.set(outro, 'indicou_voce');
  }
  return [...mapa.entries()].map(([parceiroUid, papel]) => ({ uid: parceiroUid, papel }));
}

/* ── A AVALIAÇÃO DO TIO PELA FAMÍLIA (etapa 2, 05/10/2026) ──────────────
 *
 * Só a família avalia o tio, com estrelas (1 a 5), UMA vez por semestre (ela
 * pode mudar a nota dentro do semestre). O tio NÃO avalia a família: uma
 * nota sobre ela, guardada e vista por outro tio, seria cadastro de mau
 * pagador (CDC art. 43).
 *
 * ⚠️ O TIO VÊ SÓ A MÉDIA DO SEMESTRE QUE JÁ FECHOU, e só com pelo menos
 * `MIN_RESPOSTAS`. Média do semestre corrente mudaria a cada nota, e
 * comparar duas médias seguidas diz exatamente quanto a última família deu —
 * o anonimato acabaria na segunda resposta. Do semestre corrente ele vê só
 * QUANTAS famílias responderam.
 */
const MIN_RESPOSTAS = 5;

/**
 * "2026-2": o semestre de uma data, em UTC — o mesmo relógio das rules, que
 * só aceitam nota no semestre corrente. Em Brasília a virada cairia três
 * horas antes, e por três horas no ano a nota seria recusada.
 */
function semestreDe(agora = new Date()) {
  const d = agora instanceof Date ? agora : new Date(agora);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1 <= 6 ? 1 : 2}`;
}

/** O semestre antes deste: "2026-2" → "2026-1"; "2026-1" → "2025-2". */
function semestreAnterior(semestre) {
  const [ano, s] = String(semestre).split('-').map(Number);
  return s === 2 ? `${ano}-1` : `${ano - 1}-2`;
}

function notaValida(nota) {
  return Number.isInteger(nota) && nota >= 1 && nota <= 5;
}

/**
 * O que o tio pode ver, a partir das notas cruas dos dois semestres.
 * `media` vem com uma casa decimal e só a partir de MIN_RESPOSTAS.
 */
function resumoParaOTio({ semestre, notasDoAnterior = [], totalAtual = 0 }) {
  const validas = notasDoAnterior.filter(notaValida);
  const media = validas.length >= MIN_RESPOSTAS
    ? Math.round((validas.reduce((s, n) => s + n, 0) / validas.length) * 10) / 10
    : null;
  return {
    anterior: { semestre: semestreAnterior(semestre), total: validas.length, media },
    atual: { semestre, total: totalAtual },
  };
}

/** Quando a foto some, em milissegundos. */
function expiraEmMs(agoraMs) {
  return agoraMs + DIAS_DA_FOTO * 86400000;
}

module.exports = {
  DIAS_DA_FOTO,
  PUBLICO,
  EPOCAS,
  MAX_CRIANCAS,
  LEGENDA_MAX,
  caminhoValido,
  validarPublicacao,
  parceirosDe,
  expiraEmMs,
  MIN_RESPOSTAS,
  semestreDe,
  semestreAnterior,
  notaValida,
  resumoParaOTio,
};
