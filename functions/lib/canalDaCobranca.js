/**
 * QUEM MANDA CADA MARCO DA MENSALIDADE DA FAMÍLIA — e desde 03/10/2026 a
 * resposta é sempre o PUSH.
 *
 * ── ⚠️ O E-MAIL SAIU DA MENSALIDADE (decisão do dono, 03/10/2026)
 * O e-mail da plataforma ficou só para a COBRANÇA DA PLATAFORMA ao motorista
 * (`emailDoAviso.js`). Os dois marcos que eram de e-mail — 3 dias antes e 3
 * de atraso — custavam caro e no pior dia: com o vencimento padrão no dia 10,
 * eram ~3.000 e-mails de uma vez no dia 7, acima do plano grátis do Resend e
 * do tempo da função. E a mensalidade é um combinado entre a família e o
 * motorista: a plataforma lembrar por e-mail era se meter numa conversa que
 * não é dela, com o remetente dela.
 *
 * Os marcos que sobraram são os do push: 5 dias antes (abre), o dia do
 * vencimento, e 7 dias de atraso (fecha). Três avisos por mês no máximo.
 *
 * ── POR QUE ESTE ARQUIVO CONTINUA EXISTINDO
 * Dois agendados já falaram da mesma dívida, no mesmo minuto, por dois canais
 * — o jeito mais rápido de ensinar alguém a ignorar os dois. A regra *um
 * marco, um canal* continua valendo, e é aqui que ela é decidida: se o e-mail
 * da mensalidade voltar um dia, volta por este mapa, e `testar:preferencias`
 * reprova o marco com dois canais.
 *
 * ESTE ARQUIVO NÃO FAZ `require` DE SDK — é régua, e `testar:imports` guarda.
 */

const CANAL = {
  PUSH: 'push',
  EMAIL: 'email',
};

/**
 * O canal de cada marco, indexado por DIAS ATÉ O VENCIMENTO.
 *
 * Positivo é "ainda falta"; zero é o dia; negativo é atraso. É a mesma
 * convenção de `faltam` em `reguaDosAvisos`.
 */
const CANAL_DO_MARCO = {
  5: CANAL.PUSH,
  0: CANAL.PUSH,
  '-7': CANAL.PUSH,
};

function mandaNesteMarco(canal, diasAteVencer) {
  const chave = String(Number(diasAteVencer));
  return CANAL_DO_MARCO[chave] === canal;
}

function pushMandaEm(diasAteVencer) {
  return mandaNesteMarco(CANAL.PUSH, diasAteVencer);
}

/** Sempre falso desde 03/10/2026 — fica para o teste da regra de um canal. */
function emailMandaEm(diasAteVencer) {
  return mandaNesteMarco(CANAL.EMAIL, diasAteVencer);
}

module.exports = {
  CANAL,
  CANAL_DO_MARCO,
  mandaNesteMarco,
  pushMandaEm,
  emailMandaEm,
};
