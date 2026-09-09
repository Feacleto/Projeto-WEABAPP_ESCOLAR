/**
 * A RÉGUA DO SERVIDOR — dados e contas puras, SEM NENHUM `require`.
 *
 * ⚠️ ESTE ARQUIVO EXISTE PARA QUE A BATERIA DE TESTES CHEGUE AO FIM NO CI, E A
 * HISTÓRIA VALE SER LIDA ANTES DE MEXER.
 *
 * `scripts/testar-gateway.mjs` compara esta régua com a de
 * `src/dominio/associacao/planos.js` — faixa por faixa, degrau por degrau, e
 * dia por dia ao longo de 126 dias. É a proteção do espelho, e é boa.
 *
 * Só que ela importava de `contratacao.js`, e a primeira linha daquele arquivo
 * é `require('firebase-functions/v2/https')`. `firebase-functions` só existe em
 * `functions/node_modules`, que não é rastreado pelo git, e o CI roda **um**
 * `npm ci` na raiz. Medido num checkout simulado:
 * `node scripts/testar-gateway.mjs` morre com
 * `Cannot find module 'firebase-functions/v2/https'`, exit 1.
 *
 * E como `npm run testar` encadeia os scripts com `&&`, ele parava no 15º de
 * 26 — os **11 seguintes nunca rodavam no CI**: carteira, proposta, chamados,
 * risco, fila, concessao, selo, indicacao, origem, abas, transacoes.
 *
 * Ou seja: a aposta central deste projeto — regra pura provada por script Node
 * puro — estava com o fio cortado no meio, e nada acusava. Teste que não roda é
 * pior que teste nenhum, porque ocupa o lugar dele.
 *
 * ── A REGRA QUE ISTO ESTABELECE
 * **Módulo de `functions/lib/` que é RÉGUA não faz `require` de
 * `firebase-admin` nem de `firebase-functions`.** Quem precisa do SDK é o
 * `onCall`/`onSchedule`/`onRequest`, e ele mora noutro arquivo.
 *
 * Sete dos 21 módulos de `functions/lib/` já obedeciam por acidente — e são
 * exatamente os sete que os testes conseguem importar. `scripts/testar-imports.mjs`
 * transforma o acidente em regra: ele segue os imports de cada script da
 * bateria e falha se algum alcançar um módulo que requer o SDK.
 *
 * ── O QUE MORA AQUI
 * A tabela de faixas, a escada de fechamento, o degrau de retorno e as contas
 * de data que decidem o degrau. Nada disto toca banco: recebe `agora` por
 * parâmetro, como o resto do domínio deste projeto.
 */

/**
 * A régua, espelhada — SÓ OS DADOS, nenhuma aritmética.
 *
 * É a única coisa que precisa existir dos dois lados, e é uma tabela de três
 * linhas: id, teto, preço. `npm run testar:gateway` compara esta cópia com
 * `src/dominio/associacao/planos.js` faixa por faixa, então divergir é teste
 * vermelho e não descoberta numa fatura.
 */
const PLANOS = [
  { id: 'ate10', ate: 10, preco: 69 },
  { id: 'ate25', ate: 25, preco: 149 },
  { id: 'ate40', ate: 40, preco: 229 },
];

/**
 * A escada de fechamento, espelhada — SÓ OS DADOS, como a tabela de faixas.
 *
 * `npm run testar:gateway` compara esta cópia com `ESCADA_DE_FECHAMENTO` de
 * `src/dominio/associacao/planos.js` degrau por degrau. Divergir aqui é o
 * servidor gravando uma fração que a régua do app não reconhece — e a fatura
 * cobraria uma coisa enquanto o contrato assinado diria outra.
 */
const ESCADA = [
  { degrau: 1, fracao: 0.5 },
  { degrau: 2, fracao: 0.3 },
  { degrau: 3, fracao: 0.15 },
];

/** Quem deixou o teste vencer e volta em até 30 dias. */
const RETORNO = { fracao: 0.1, prazoDias: 30, degrau: 'retorno' };

/** Os descontos duram o contrato inteiro. */
const MESES_DE_CONTRATO = 12;

/** Cada degrau é um mês de teste: 90 dias divididos por 3. */
const DIAS_POR_DEGRAU = 30;

/** Os mesmos 90 dias de `dominio/associacao/trial.js`. */
const DIAS_DE_TRIAL = 90;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor?.toDate === 'function') return valor.toDate();
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 'AAAA-MM' do ULTIMO mes em que um desconto de N meses ainda vale.
 *
 * O DIA VAI PARA 1 ANTES DE SOMAR, e isso nao e detalhe: `setMonth` preserva
 * o dia, e 31 nao existe em todo mes. Contratar em 31/03 com `setMonth(+12)`
 * produzia 31/02/2027, que o JavaScript normaliza para 03/03 — um mes a mais
 * de desconto, de graca, para sempre.
 *
 * E o `- 1` faz o prazo ser INCLUSIVO do mes corrente: 12 meses a partir de
 * setembro terminam em agosto do ano seguinte, nao em setembro. Sem ele o
 * desconto durava 13 meses — meia mensalidade extra por associado, silenciosa,
 * crescendo com a base.
 *
 * HOUVE UMA SEGUNDA COPIA, em `premioDeConversao.js`, e ela ja fazia certo —
 * as duas divergiam em um mes inteiro. Esse arquivo foi apagado em 07/09/2026
 * junto com a roleta, e sobrou esta. `npm run testar:gateway` continua
 * guardando a armadilha do `setMonth`, que e do JavaScript e nao da copia.
 */
function mesDaqui(meses, agora = new Date()) {
  const d = new Date(agora);
  d.setDate(1);
  d.setMonth(d.getMonth() + meses - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Ate quando a conta fica destravada por ter CONTRATADO.
 *
 * Fim do mes seguinte, meio-dia. E a mesma regra de `assinaturaAteDoMes`: quem
 * fecha um acordo hoje opera ate a primeira fatura vencer e ser paga.
 *
 * SEM ISTO, CONTRATAR NAO DESTRAVAVA NADA. `estadoDaConta` e `isAdmin()`
 * consultam `assinaturaAte`, e so a baixa de fatura escrevia esse campo — o
 * motorista assinava o contrato e voltava para a tela dizendo pra contratar.
 * Beco sem saida depois de a pessoa ter decidido pagar.
 *
 * Meio-dia, e nao meia-noite: o processo das functions roda em UTC, e a data
 * construida a 00:00 volta um dia quando lida no fuso de Brasilia.
 */
function cobertoAteOMesSeguinte(agora = new Date()) {
  const d = new Date(agora);
  return new Date(d.getFullYear(), d.getMonth() + 2, 0, 12, 0, 0);
}

/**
 * O teste ainda está correndo?
 *
 * Quem nunca rodou uma rota não tem `trialInicio` — e conta como DENTRO do
 * teste, porque o relógio dele nem começou. Recusar o desconto a essa pessoa
 * puniria justamente quem decidiu antes de precisar.
 */
function dentroDoTrial(trialInicio, agora) {
  const inicio = paraData(trialInicio);
  if (!inicio) return true;
  const passados = Math.floor((agora.getTime() - inicio.getTime()) / MS_POR_DIA);
  return passados < DIAS_DE_TRIAL;
}

/**
 * EM QUE DEGRAU DA ESCADA ELE ESTÁ — 1, 2, 3, 'retorno' ou null.
 *
 * `null` é "nenhum desconto", e é o caso de quem deixou os 90 dias e mais 30
 * passarem. Não existe quarto degrau: escada que premia quem esperou é
 * exatamente a lição que ela existe para não ensinar.
 *
 * ⚠️ SEM `trialInicio` O DEGRAU É 1, e não zero. Quem nunca rodou uma rota
 * ainda não gastou um dia do teste; ele é o mais antecipado de todos, e
 * cobrar-lhe o preço cheio puniria quem decidiu antes de precisar.
 *
 * ⚠️ O PISO DO DIA ZERO É EXPLÍCITO. Relógio de servidor atrasado em relação ao
 * do aparelho que gravou `trialInicio` produz dias NEGATIVOS, e
 * `floor(-1 / 30) + 1` daria degrau ZERO — nenhum desconto para quem acabou de
 * começar, que é o oposto do desenho.
 */
function degrauDaDecisao(trialInicio, agora = new Date()) {
  const inicio = paraData(trialInicio);
  if (!inicio) return 1;

  const passados = Math.max(
    0,
    Math.floor((agora.getTime() - inicio.getTime()) / MS_POR_DIA)
  );
  if (passados < DIAS_DE_TRIAL) {
    return Math.floor(passados / DIAS_POR_DEGRAU) + 1;
  }
  if (passados < DIAS_DE_TRIAL + RETORNO.prazoDias) return RETORNO.degrau;
  return null;
}

/** A fração daquele degrau. Espelha `descontoDoFechamento` do app. */
function descontoDoDegrau(degrau) {
  if (degrau === RETORNO.degrau) return RETORNO.fracao;
  const passo = ESCADA.find((e) => e.degrau === degrau);
  return passo ? passo.fracao : 0;
}

module.exports = {
  PLANOS,
  ESCADA,
  RETORNO,
  MESES_DE_CONTRATO,
  DIAS_POR_DEGRAU,
  DIAS_DE_TRIAL,
  paraData,
  mesDaqui,
  cobertoAteOMesSeguinte,
  dentroDoTrial,
  degrauDaDecisao,
  descontoDoDegrau,
};
