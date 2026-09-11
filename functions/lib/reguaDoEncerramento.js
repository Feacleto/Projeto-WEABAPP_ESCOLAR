/**
 * O ENCERRAMENTO, DO LADO DO SERVIDOR — espelho de
 * `src/dominio/associacao/encerramento.js`.
 *
 * ⚠️ É ESPELHO PORQUE O DEPLOY DAS FUNCTIONS NÃO ALCANÇA `src/`, e é o mesmo
 * motivo da régua de preço e da escolha de quem ganha a indicação. Duplicar
 * regra só é aceitável com um teste que compare as duas CASO A CASO —
 * `npm run testar:encerramento` faz isso, e falha quando uma das metades
 * aprende algo que a outra não aprendeu.
 *
 * ⚠️ **NENHUM `require` DO SDK.** Este arquivo é RÉGUA: quem precisa de
 * `firebase-admin` é o agendado, e ele mora noutro lugar. `reguaDoServidor` é
 * puro e pode ser requerido — `reguaDosAvisos` já o faz.
 *
 * Só entra aqui o que o SERVIDOR pergunta: se ainda fatura, e se o desconto
 * atravessa. A tela pergunta outras coisas (quanto falta, qual aviso, se dá
 * para religar) e essas ficam do lado do app — espelhar o que ninguém chama
 * dos dois lados é duplicar sem necessidade.
 */

const { PLANO, MESES_DE_CONTRATO, paraData } = require('./reguaDoServidor');

const MODO = {
  FIM_DO_PERIODO: 'fim_do_periodo',
  AGORA: 'agora',
};

const MS_POR_DIA = 86400000;

/** ⚠️ AUSENTE É LIGADA. Ver o cabeçalho do arquivo do app. */
function renovacaoLigada(motorista) {
  return (motorista || {}).renovacaoAutomatica !== false;
}

function pediuEncerramento(motorista) {
  return !renovacaoLigada(motorista);
}

/** ⚠️ NO ANUAL O PADRÃO É CUMPRIR O PRAZO — o modo que NÃO cobra multa. */
function modoDoPedido(motorista) {
  const m = motorista || {};
  if (m.plano !== PLANO.ANUAL) return MODO.AGORA;
  return m.encerramentoModo === MODO.AGORA ? MODO.AGORA : MODO.FIM_DO_PERIODO;
}

function fimDoCompromisso(motorista, mesesDeContrato = MESES_DE_CONTRATO) {
  const m = motorista || {};
  if (m.plano !== PLANO.ANUAL) return null;
  const inicio = paraData(m.contratadoEm);
  if (!inicio) return null;
  const fim = new Date(inicio.getTime());
  fim.setMonth(fim.getMonth() + mesesDeContrato);
  return fim;
}

function fimDaAssociacao(motorista) {
  if (!pediuEncerramento(motorista)) return null;
  if (modoDoPedido(motorista) === MODO.FIM_DO_PERIODO) {
    return fimDoCompromisso(motorista) || paraData((motorista || {}).assinaturaAte);
  }
  return paraData((motorista || {}).assinaturaAte);
}

function diasAteOFim(motorista, agora = new Date()) {
  const fim = fimDaAssociacao(motorista);
  const hoje = paraData(agora);
  if (!fim || !hoje) return null;
  return Math.ceil((fim.getTime() - hoje.getTime()) / MS_POR_DIA);
}

function associacaoEncerrada(motorista, agora = new Date()) {
  const dias = diasAteOFim(motorista, agora);
  return dias !== null && dias <= 0;
}

/**
 * ⚠️ A PERGUNTA DO FECHAMENTO. "Não há nova cobrança a partir do
 * encerramento" (cláusula 6) — menos o anual que escolheu cumprir o prazo, que
 * continua devendo as mensalidades do compromisso.
 */
function pararDeFaturar(motorista, agora = new Date()) {
  if (!pediuEncerramento(motorista)) return false;
  if (modoDoPedido(motorista) === MODO.FIM_DO_PERIODO) {
    const fim = fimDoCompromisso(motorista);
    const hoje = paraData(agora);
    if (fim && hoje && hoje < fim) return false;
  }
  return true;
}

/**
 * ⚠️ A PERGUNTA DE `contratarPlano`. O desconto de fechamento é vitalício
 * "enquanto este contrato estiver vigente" — encerrou, acabou; atrasou, não.
 */
function descontoAtravessa(motorista, agora = new Date()) {
  return !associacaoEncerrada(motorista, agora);
}

module.exports = {
  MODO,
  renovacaoLigada,
  pediuEncerramento,
  modoDoPedido,
  fimDoCompromisso,
  fimDaAssociacao,
  diasAteOFim,
  associacaoEncerrada,
  pararDeFaturar,
  descontoAtravessa,
};
