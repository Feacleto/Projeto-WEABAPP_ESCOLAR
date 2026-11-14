/**
 * O TEXTO DO AVISO "OS CONTRATOS ACABAM" (RC1.1, 14/11/2026) — o número está
 * em `dominio/cobranca/avisoDosContratos.js` (que lê a fila de renovação), a
 * tela em `components/tio/AvisoDosContratos.jsx`. Puro, sem React
 * (`npm run testar:contratos-que-vencem`).
 *
 * ── A REGRA, IGUAL À DE `valorDoConvite.js`
 * Cada frase carrega `sustenta` (a funcionalidade que a faz verdade HOJE) e
 * `condicao` (de que ela depende). O teste mantém a lista fechada das duas,
 * aponta o arquivo onde cada uma existe e reprova frase sem origem.
 *
 * ── O QUE O AVISO DIZ, E O QUE NÃO DIZ
 * Diz o que ACONTECE (o contrato acaba e a mensalidade não é gerada) e ONDE
 * se resolve (a fila de renovação). Não diz que o contrato "foi renovado" nem
 * que renova sozinho: renovar é mandar um contrato novo, e ele só vale quando a
 * família assina (`marca/textosDaRenovacao.js`).
 *
 * ⚠️ A UNIDADE É O CONTRATO. Era "famílias" (uma mãe com dois filhos contava
 * como uma), e a fila lista uma linha por criança — o número do aviso tem que
 * ser o da lista. O texto diz "contratos".
 *
 * ⚠️ OS ÚNICOS NÚMEROS SÃO N E A DATA. Os dois saem da conta, nunca de um
 * literal. Nada de "60 dias", de valor em reais nem de prazo para renovar.
 *
 * ⚠️ É AVISO NO INÍCIO, NÃO NOTIFICAÇÃO. Nenhum push novo nasce daqui.
 */

/** Os meses por extenso, em minúscula (a frase os usa no meio da linha). */
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** 'AAAA-MM' → 'janeiro'. Texto que não é mês volta vazio. */
export function nomeDoMes(aaaamm) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(aaaamm || ''));
  const n = m ? Number(m[2]) : 0;
  return n >= 1 && n <= 12 ? MESES[n - 1] : '';
}

/** 'AAAA-MM-DD' → '31/12' (sem o ano: dentro da janela da fila ele não ajuda). */
export function diaEMes(iso) {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[2]}/${m[1]}` : '';
}

/** Para onde o toque leva, e o que a linha de baixo diz sobre isso. */
export const DESTINO = '/tio/finance/renovar';
export const ACAO = 'Ver quem renovar';

/**
 * De onde cada frase tira a verdade. A prova de cada chave está no teste.
 *  - `vigencia-do-contrato`: o contrato da criança grava a vigência;
 *  - `mensalidade-fora-da-vigencia`: o servidor não gera a mensalidade de um
 *    mês que a vigência não cobre;
 *  - `fila-de-renovacao`: a rota `/tio/finance/renovar` existe e lista esses
 *    contratos.
 * E as condições:
 *  - `vigencia-gravada`: só conta quem tem início e fim gravados;
 *  - `familia-no-app`: só conta quem tem família vinculada (a fila).
 */
export const SUSTENTA = {
  fim: { sustenta: 'vigencia-do-contrato', condicao: 'vigencia-gravada' },
  mensalidade: { sustenta: 'mensalidade-fora-da-vigencia', condicao: 'familia-no-app' },
  acao: { sustenta: 'fila-de-renovacao', condicao: 'familia-no-app' },
};

const contratos = (n) => (n === 1 ? '1 contrato' : `${n} contratos`);

/**
 * As linhas do aviso, na ordem em que aparecem (a que ainda vai acabar vem
 * antes da que já acabou: a primeira ainda tem tempo). Cada linha:
 * `{ id, titulo, sub, acao, ...SUSTENTA }`. Vazio quando não há nada a avisar.
 *
 * @param {{vencem: object|null, vencidos: object|null}} conta  o que devolve `contagemDoAviso`
 */
export function linhasDoAviso(conta) {
  const linhas = [];
  const { vencem, vencidos } = conta || {};

  if (vencem && vencem.contratos > 0) {
    const mesmoDia = vencem.primeiroFim === vencem.ultimoFim;
    const mesmoMes = vencem.primeiroMesSemParcela === vencem.ultimoMesSemParcela;
    const um = vencem.contratos === 1;
    const quando = mesmoDia
      ? `em ${diaEMes(vencem.primeiroFim)}`
      : `entre ${diaEMes(vencem.primeiroFim)} e ${diaEMes(vencem.ultimoFim)}`;
    const mes = nomeDoMes(vencem.primeiroMesSemParcela);
    linhas.push({
      id: 'vencem',
      titulo: um ? `${contratos(1)} acaba ${quando}.` : `${contratos(vencem.contratos)} acabam ${quando}.`,
      sub: mesmoMes
        ? `Sem renovar, a mensalidade de ${mes} não é gerada.`
        : `Sem renovar, a mensalidade não é gerada de ${mes} em diante.`,
      acao: ACAO,
      ...SUSTENTA.fim,
      sustentaSub: SUSTENTA.mensalidade.sustenta,
      condicaoSub: SUSTENTA.mensalidade.condicao,
    });
  }

  if (vencidos && vencidos.contratos > 0) {
    const um = vencidos.contratos === 1;
    linhas.push({
      id: 'vencidos',
      titulo: um ? `${contratos(1)} já acabou.` : `${contratos(vencidos.contratos)} já acabaram.`,
      sub: 'Sem renovar, a mensalidade não é gerada.',
      acao: ACAO,
      ...SUSTENTA.mensalidade,
    });
  }

  return linhas;
}

/**
 * Todas as formas do texto que o teste varre, com a origem de cada uma:
 * singular, plural, um dia, vários dias, um mês, vários meses, já acabou.
 */
export function todasAsAfirmacoes() {
  const base = {
    contratos: 9,
    primeiroFim: '2026-12-31', ultimoFim: '2026-12-31',
    primeiroMesSemParcela: '2027-01', ultimoMesSemParcela: '2027-01',
  };
  const exemplos = [
    ['plural', { vencem: base, vencidos: null }],
    ['singular', { vencem: { ...base, contratos: 1 }, vencidos: null }],
    ['variosDias', {
      vencem: { ...base, primeiroFim: '2026-11-30', primeiroMesSemParcela: '2026-12', ultimoMesSemParcela: '2027-01' },
      vencidos: null,
    }],
    ['jaAcabaram', { vencem: null, vencidos: { contratos: 3 } }],
    ['jaAcabou', { vencem: null, vencidos: { contratos: 1 } }],
  ];
  return exemplos.flatMap(([nome, conta]) =>
    linhasDoAviso(conta).flatMap((l) => [
      { id: `${nome}:${l.id}:titulo`, texto: l.titulo, sustenta: l.sustenta, condicao: l.condicao },
      {
        id: `${nome}:${l.id}:sub`,
        texto: l.sub,
        sustenta: l.sustentaSub || l.sustenta,
        condicao: l.condicaoSub || l.condicao,
      },
      { id: `${nome}:${l.id}:acao`, texto: l.acao, ...SUSTENTA.acao },
    ])
  );
}
