/**
 * QUEM MANDA CADA MARCO DA MENSALIDADE — o push ou o e-mail.
 *
 * ── ⚠️ POR QUE ISTO PRECISOU EXISTIR
 * Dois agendados rodavam às 9h falando da MESMA dívida para a MESMA família,
 * e nenhum sabia do outro:
 *
 *   `enviarAvisosDoDia`   push  em 5, 3, 0, −3 e −7 dias do vencimento
 *   `sendPaymentReminders` e-mail em 3, 0 e −3
 *
 * Nos três marcos do meio ela recebia as duas coisas, no mesmo minuto, sobre
 * a mesma mensalidade. Isso não é redundância útil: é o jeito mais rápido de
 * ensinar alguém a ignorar os dois canais — e o canal que ela desliga primeiro
 * é o que mais dói perder, porque é o mesmo que avisa que a criança chegou.
 *
 * A colisão não aparecia em teste nenhum porque cada régua era testada
 * sozinha, e cada uma estava certa por si. É o defeito clássico de dois
 * módulos corretos: ninguém tinha o mapa dos dois juntos. Este arquivo é o
 * mapa, e é o único lugar onde a divisão existe.
 *
 * ── COMO OS MARCOS FORAM DIVIDIDOS
 * O push é uma frase e chega na tela bloqueada. O e-mail carrega valor, mês,
 * vencimento, aluno, botão de pagar e a chave PIX do motorista, e fica na
 * caixa dela.
 *
 *   PUSH   nos marcos em que basta SABER a hora:
 *          5 dias antes (abre), o dia do vencimento, 7 dias de atraso (fecha).
 *   E-MAIL nos dois marcos em que ela precisa RESOLVER com o dado na mão:
 *          3 dias antes e 3 dias de atraso.
 *
 * ⚠️ **ESTA DIVISÃO É JULGAMENTO, NÃO DEDUÇÃO** — e está num só lugar
 * justamente para poder ser mudada em uma linha. O que NÃO é julgamento é a
 * regra acima dela: *um marco, um canal*. Qualquer divisão serve, desde que
 * nenhum marco apareça duas vezes — e `testar:canal` prova essa parte, não a
 * escolha.
 *
 * ⚠️ E O E-MAIL DO DIA DO VENCIMENTO SAIU DE CENA. O template continua no
 * `emailTemplate.js` porque o disparo manual do dono ainda pode usá-lo, mas a
 * varredura diária não o emite mais: o push daquele dia é o que chega, e este
 * público lê push muito mais do que e-mail.
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
 * convenção de `MILESTONES` no `index.js` e de `faltam` em `reguaDosAvisos`,
 * de propósito: três representações do mesmo eixo seria a próxima divergência.
 */
const CANAL_DO_MARCO = {
  5: CANAL.PUSH,
  3: CANAL.EMAIL,
  0: CANAL.PUSH,
  '-3': CANAL.EMAIL,
  '-7': CANAL.PUSH,
};

/**
 * Este canal manda neste marco?
 *
 * ⚠️ MARCO DESCONHECIDO RESPONDE `false` PARA OS DOIS, e é o padrão certo:
 * um dia que ninguém atribuiu não deve virar dois avisos por omissão. Quem
 * acrescentar um marco novo precisa dizer de quem ele é — e enquanto não
 * disser, ninguém manda nada, o que é visível na hora.
 */
function mandaNesteMarco(canal, diasAteVencer) {
  const chave = String(Number(diasAteVencer));
  return CANAL_DO_MARCO[chave] === canal;
}

/** Atalhos, para o chamador não precisar importar `CANAL`. */
function pushMandaEm(diasAteVencer) {
  return mandaNesteMarco(CANAL.PUSH, diasAteVencer);
}

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
