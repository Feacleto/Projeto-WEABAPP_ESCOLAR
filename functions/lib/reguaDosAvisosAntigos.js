/**
 * A RÉGUA DA LIMPEZA DOS AVISOS — pura, sem `require` nenhum (é régua, e
 * `npm run testar:imports` derruba a bateria se ela alcançar o SDK).
 *
 * ⚠️ O PRAZO É DECISÃO DO DONO (03/10/2026): 90 dias. Nada apagava
 * `notifications` — o único `delete` era o da própria pessoa —, e na escala
 * pretendida são uns 5 milhões de documentos por ano que ninguém relê: o sino
 * mostra as 100 mais recentes, e aviso de três meses atrás já não é pendência,
 * é histórico. O que precisa ser guardado por mais tempo já tem casa própria
 * (a mensalidade em `payments`, por 60 meses; a trilha em `events`).
 *
 * ⚠️ SE A POLÍTICA DE PRIVACIDADE PASSAR A CITAR ESTE PRAZO, os dois mudam
 * juntos — o mesmo acordo de `DIAS_DE_RETENCAO` das viagens.
 */
const DIAS_DE_RETENCAO_DOS_AVISOS = 90;

const DIA_MS = 24 * 60 * 60 * 1000;

/** O Firestore recusa lote acima de 500 escritas. 400 deixa folga. */
const LOTE_DA_LIMPEZA = 400;

/**
 * Quanto tempo a varredura se dá antes de parar, em milissegundos — abaixo do
 * `timeoutSeconds` do agendado (540 s), para fechar o lote em andamento e
 * registrar o que sobrou em vez de ser cortada no meio. A primeira execução
 * encontra o acúmulo de meses; o resto fica para a madrugada seguinte, e a
 * consulta é idempotente (o que já foi apagado não volta a aparecer).
 */
const ORCAMENTO_DA_LIMPEZA_MS = 7 * 60 * 1000;

/** O corte: aviso com `createdAt` ANTERIOR a esta data é apagado. */
function corteDosAvisos(agora = new Date(), dias = DIAS_DE_RETENCAO_DOS_AVISOS) {
  const ms = agora instanceof Date ? agora.getTime() : Number(agora);
  return new Date(ms - dias * DIA_MS);
}

/** Um aviso criado em `criadoEm` já passou do prazo, visto em `agora`? */
function avisoVencido(criadoEm, agora = new Date()) {
  if (!(criadoEm instanceof Date)) return false;
  return criadoEm.getTime() < corteDosAvisos(agora).getTime();
}

module.exports = {
  DIAS_DE_RETENCAO_DOS_AVISOS,
  LOTE_DA_LIMPEZA,
  ORCAMENTO_DA_LIMPEZA_MS,
  corteDosAvisos,
  avisoVencido,
};
