/**
 * O TEXTO DO AVISO "OS CONTRATOS ACABAM" (RC1.1, 14/11/2026) — a conta está em
 * `dominio/cobranca/contratosQueVencem.js`, a tela em
 * `components/tio/AvisoDosContratos.jsx`. Puro, sem React
 * (`npm run testar:contratos-que-vencem`).
 *
 * ── A REGRA, IGUAL À DE `valorDoConvite.js`
 * Cada frase carrega `sustenta` (a funcionalidade que a faz verdade HOJE) e
 * `condicao` (de que ela depende). O teste mantém a lista fechada das duas,
 * aponta o arquivo onde cada uma existe e reprova frase sem origem.
 *
 * ── O QUE O AVISO DIZ, E O QUE NÃO DIZ
 * Diz o que ACONTECE: o contrato acaba e a mensalidade do mês seguinte não é
 * gerada. Não diz "renove aqui" nem "toque para renovar": a renovação de
 * verdade (novo aceite da família) é outra entrega e ainda não existe — prometê-
 * la seria a primeira mentira do aviso. O toque leva à lista de crianças.
 *
 * ⚠️ OS ÚNICOS NÚMEROS SÃO N E A DATA. Os dois saem da conta, nunca de um
 * literal. Nada de "60 dias", de valor em reais nem de prazo para renovar.
 *
 * ⚠️ É AVISO NO INÍCIO, NÃO NOTIFICAÇÃO. Nenhum push novo nasce daqui (o
 * `testar:preferencias` exige classificar a espécie de todo aviso novo, e este
 * não é um tipo de `notifications`).
 */

/** Os meses por extenso, em minúscula (a frase os usa no meio da linha). */
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** 'AAAA-MM' → 'janeiro'. Texto que não é mês volta vazio (a frase se recusa a sair). */
export function nomeDoMes(aaaamm) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(aaaamm || ''));
  const n = m ? Number(m[2]) : 0;
  return n >= 1 && n <= 12 ? MESES[n - 1] : '';
}

/** 'AAAA-MM-DD' → '31/12' (sem o ano: dentro de 60 dias ele não ajuda). */
export function diaEMes(iso) {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[2]}/${m[1]}` : '';
}

/**
 * De onde cada frase tira a verdade. A prova de cada chave está no teste.
 *  - `vigencia-do-contrato`: o contrato da criança grava a vigência e a tela
 *    mostra o fim dela;
 *  - `mensalidade-fora-da-vigencia`: o servidor não gera a mensalidade de um
 *    mês que a vigência não cobre.
 * E as condições:
 *  - `vigencia-gravada`: só conta a criança que tem início e fim gravados (sem
 *    eles o servidor gera a mensalidade normalmente);
 *  - `mae-no-app-e-valor`: só conta quem tem responsável vinculado e valor —
 *    sem um dos dois a mensalidade não nasceria de qualquer jeito.
 */
export const SUSTENTA = {
  fim: { sustenta: 'vigencia-do-contrato', condicao: 'vigencia-gravada' },
  mensalidade: { sustenta: 'mensalidade-fora-da-vigencia', condicao: 'mae-no-app-e-valor' },
};

const familias = (n) => (n === 1 ? '1 família' : `${n} famílias`);

/**
 * As linhas do aviso, na ordem em que aparecem (a que ainda vai acabar vem
 * antes da que já acabou: a primeira ainda tem remédio). Cada linha:
 * `{ id, titulo, sub, ...SUSTENTA }`. Vazio quando não há nada a avisar.
 *
 * @param {{vencem: object|null, vencidos: object|null}} conta  o que devolve `contratosQueVencem`
 */
export function linhasDoAviso(conta) {
  const linhas = [];
  const { vencem, vencidos } = conta || {};

  if (vencem && vencem.familias > 0) {
    const mesmoDia = vencem.primeiroFim === vencem.ultimoFim;
    const mesmoMes = vencem.primeiroMesSemParcela === vencem.ultimoMesSemParcela;
    const um = vencem.familias === 1;
    const quando = mesmoDia
      ? `em ${diaEMes(vencem.primeiroFim)}`
      : `entre ${diaEMes(vencem.primeiroFim)} e ${diaEMes(vencem.ultimoFim)}`;
    const mes = nomeDoMes(vencem.primeiroMesSemParcela);
    linhas.push({
      id: 'vencem',
      titulo: um
        ? `O contrato de ${familias(1)} acaba ${quando}.`
        : `Os contratos de ${familias(vencem.familias)} acabam ${quando}.`,
      sub: mesmoMes
        ? `Sem renovar, a mensalidade de ${mes} não é gerada.`
        : `Sem renovar, a mensalidade não é gerada de ${mes} em diante.`,
      ...SUSTENTA.fim,
      sustentaSub: SUSTENTA.mensalidade.sustenta,
      condicaoSub: SUSTENTA.mensalidade.condicao,
    });
  }

  if (vencidos && vencidos.familias > 0) {
    const um = vencidos.familias === 1;
    linhas.push({
      id: 'vencidos',
      titulo: um
        ? `O contrato de ${familias(1)} já acabou.`
        : `Os contratos de ${familias(vencidos.familias)} já acabaram.`,
      sub: um ? 'A mensalidade dela não é gerada.' : 'A mensalidade delas não é gerada.',
      ...SUSTENTA.mensalidade,
    });
  }

  return linhas;
}

/**
 * Todas as formas do texto que o teste varre, com a origem de cada uma. As
 * contas são exemplos que cobrem singular, plural, um dia, vários dias, um mês
 * e vários meses.
 */
export function todasAsAfirmacoes() {
  const base = {
    familias: 9, criancas: 9,
    primeiroFim: '2026-12-31', ultimoFim: '2026-12-31',
    primeiroMesSemParcela: '2027-01', ultimoMesSemParcela: '2027-01', dias: 47,
  };
  const exemplos = [
    ['plural', { vencem: base, vencidos: null }],
    ['singular', { vencem: { ...base, familias: 1, criancas: 1 }, vencidos: null }],
    ['variosDias', {
      vencem: { ...base, primeiroFim: '2026-11-30', primeiroMesSemParcela: '2026-12', ultimoMesSemParcela: '2027-01' },
      vencidos: null,
    }],
    ['jaAcabaram', { vencem: null, vencidos: { familias: 3, criancas: 4 } }],
    ['jaAcabouUma', { vencem: null, vencidos: { familias: 1, criancas: 1 } }],
  ];
  return exemplos.flatMap(([nome, conta]) =>
    linhasDoAviso(conta).flatMap((l) => {
      const saida = [{ id: `${nome}:${l.id}:titulo`, texto: l.titulo, sustenta: l.sustenta, condicao: l.condicao }];
      saida.push({
        id: `${nome}:${l.id}:sub`,
        texto: l.sub,
        sustenta: l.sustentaSub || l.sustenta,
        condicao: l.condicaoSub || l.condicao,
      });
      return saida;
    })
  );
}
