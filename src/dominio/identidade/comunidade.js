/**
 * A COMUNIDADE, do lado do app (05/10/2026, etapa 1) — o que a tela precisa
 * saber antes de pedir ao servidor. Quem DECIDE é
 * `functions/lib/reguaDaComunidade.js`; as constantes daqui são espelho dela
 * (`npm run testar:comunidade` compara as duas).
 *
 * - Foto da turma só com o "sim" de CADA família marcada (LGPD art. 14).
 *   `children.fotoDaTurmaConsentida` é escrito só pela responsável, e
 *   ausente é NÃO.
 * - Para os tios parceiros, nunca criança.
 * - A foto some em `DIAS_DA_FOTO` dias.
 *
 * Puro, sem Firebase nem React.
 */

export const DIAS_DA_FOTO = 30;
export const PUBLICO = Object.freeze({ FAMILIAS: 'familias', PARCEIROS: 'parceiros' });
export const EPOCAS = Object.freeze([
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
export const LEGENDA_MAX = 80;

/** O "sim" da família: 'sim' | 'nao' | 'sem_resposta' (ausente = sem resposta, e conta como não). */
export function simDaFoto(crianca) {
  if (crianca?.fotoDaTurmaConsentida === true) return 'sim';
  if (crianca?.fotoDaTurmaConsentida === false) return 'nao';
  return 'sem_resposta';
}

/**
 * Pode mandar para o servidor? Devolve `{ ok, motivo }` — o mesmo critério
 * do servidor, para a tela dizer o que falta ANTES do toque.
 */
export function prontaParaPublicar({ publico, marcadas = [], turma = [], epoca, todasMarcadas, semCrianca, temFoto }) {
  if (!temFoto) return { ok: false, motivo: 'Escolha a foto.' };
  if (!EPOCAS.includes(epoca)) return { ok: false, motivo: 'Escolha a época.' };
  if (publico === PUBLICO.PARCEIROS) {
    if (marcadas.length) return { ok: false, motivo: 'Para os tios parceiros, só foto sem criança.' };
    if (!semCrianca) return { ok: false, motivo: 'Confirme que não aparece nenhuma criança.' };
    return { ok: true, motivo: null };
  }
  if (publico !== PUBLICO.FAMILIAS) return { ok: false, motivo: 'Escolha para quem é a foto.' };
  const porId = new Map(turma.map((c) => [c.id, c]));
  const semSim = marcadas.filter((id) => simDaFoto(porId.get(id)) !== 'sim');
  if (semSim.length) return { ok: false, motivo: 'Tem criança marcada sem o sim da família.' };
  if (!todasMarcadas) return { ok: false, motivo: 'Confirme que marcou todas as crianças da foto.' };
  return { ok: true, motivo: null };
}

/** "Some em 28 dias" / "Some amanhã" / "Some hoje". */
export function quandoSome(expiraEmMs, agoraMs = Date.now()) {
  const dias = Math.ceil((expiraEmMs - agoraMs) / 86400000);
  if (dias <= 0) return 'Some hoje';
  if (dias === 1) return 'Some amanhã';
  return `Some em ${dias} dias`;
}

/** "Você indicou" / "Indicou você". */
export function rotuloDoParceiro(papel) {
  return papel === 'indicou_voce' ? 'Indicou você' : 'Você indicou';
}

/* ── A AVALIAÇÃO DO TIO PELA FAMÍLIA (etapa 2) — espelho de
 * functions/lib/reguaDaComunidade.js. Só a família avalia, uma nota por
 * semestre (mudável), e o tio vê só a média do semestre FECHADO, com pelo
 * menos MIN_RESPOSTAS: a do semestre corrente denunciaria quem deu cada nota.
 */
export const MIN_RESPOSTAS = 5;

/** "2026-2", em UTC (o relógio das rules). */
export function semestreDe(agora = new Date()) {
  const d = agora instanceof Date ? agora : new Date(agora);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1 <= 6 ? 1 : 2}`;
}

/** "1º semestre de 2026". */
export function semestrePorExtenso(semestre) {
  const [ano, s] = String(semestre).split('-');
  return `${s === '1' ? '1º' : '2º'} semestre de ${ano}`;
}

/** O id do documento da nota: uma por família, por motorista, por semestre. */
export function idDaAvaliacao(adminUid, familiaUid, semestre) {
  return `${adminUid}_${familiaUid}_${semestre}`;
}
