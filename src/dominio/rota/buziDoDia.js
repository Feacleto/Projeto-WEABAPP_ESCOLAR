import { primeiroNome } from '../../compartilhado/formatters.js';
import { deMinutos, diaCompleto, horaCurta, precisaDaPerua } from './horarios.js';
import { diaSemRota, feriadosNacionais } from './calendario.js';

/**
 * O BUZI FALA DO DIA E DA SEMANA (05/10/2026, Buzi Chat aprovado pelo dono).
 *
 * Os assuntos "Hoje" e "Semana" do Buzi Chat. As mesmas regras do Boletim
 * (`cobranca/boletim.js`), e `npm run testar:buzi` cobra:
 *   1. UM ASSUNTO POR PERGUNTA — "quem vai hoje" não fala de quem falta.
 *   2. NADA DE COMPARAR COM OUTRO DIA OU MÊS.
 *   3. NÃO É CONVERSA DE AMIGO — relata e para.
 * E uma desta conversa: o app só sabe o que foi AVISADO. Falta combinada por
 * fora não aparece, e a resposta da falta diz isso. Feriado da cidade o app
 * também não sabe (`calendario.js` só conhece os nacionais).
 *
 * Puro: quem busca crianças, avisos e escolas é a tela, e passa por parâmetro.
 */

export const TEMA_DO_DIA = {
  VAI: 'vai',
  NAO_VAI: 'naoVai',
  HORARIO: 'horario',
  FALTAS: 'faltas',
  FERIADO: 'feriado',
  ANIVERSARIO: 'aniversario',
};

export const PERGUNTA_DO_DIA = {
  [TEMA_DO_DIA.VAI]: 'Quem vai hoje?',
  [TEMA_DO_DIA.NAO_VAI]: 'Quem não vai hoje?',
  [TEMA_DO_DIA.HORARIO]: 'Que horas eu saio?',
  [TEMA_DO_DIA.FALTAS]: 'Quem avisou falta?',
  [TEMA_DO_DIA.FERIADO]: 'Tem feriado esta semana?',
  [TEMA_DO_DIA.ANIVERSARIO]: 'Quem faz aniversário?',
};

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** O que cada aviso faz com o dia, na voz do motorista. */
const MOTIVO = {
  full: 'faltou',
  'no-pickup': 'o pai leva',
  'no-dropoff': 'o pai busca',
  'picked-up': 'o pai já pegou',
};

const chave = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const nome = (c) => primeiroNome(c?.name, 'Criança');
const ativas = (children) => (children || []).filter((c) => c?.active !== false);
const hora = (min) => horaCurta(deMinutos(min));
const plural = (n, um, varios) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

/** De segunda a domingo da semana de `agora` → { de, ate } em 'AAAA-MM-DD'. */
export function semanaDe(agora = Date.now()) {
  const d = new Date(agora);
  const desdeSegunda = (d.getDay() + 6) % 7;
  const seg = new Date(d.getFullYear(), d.getMonth(), d.getDate() - desdeSegunda);
  const dom = new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + 6);
  return { de: chave(seg), ate: chave(dom), segunda: seg };
}

function semRota(agora) {
  const motivo = diaSemRota(new Date(agora));
  if (!motivo) return null;
  return motivo.tipo === 'feriado'
    ? `Hoje é feriado: ${motivo.nome}. Não tem rota combinada.`
    : `Hoje é ${motivo.nome}. Não tem rota combinada.`;
}

/** QUEM VAI HOJE — as viagens do dia e quantas crianças em cada uma. */
export function quemVaiHoje(children = [], { declaracoes = {}, escolasPorId = {}, agora = Date.now() } = {}) {
  const fechado = semRota(agora);
  if (fechado) return { tema: TEMA_DO_DIA.VAI, frases: [fechado], linhas: [], quantas: 0 };
  const blocos = diaCompleto(ativas(children), { declaracoes, escolasPorId });
  const linhas = blocos
    .map((b, i) => {
      const vao = b.paradas.filter((p) => precisaDaPerua(p.estado));
      if (!vao.length) return null;
      const escolas = b.escolas.map((e) => e.nome).join(', ');
      return {
        id: `${b.direcao}-${i}`,
        nome: `${b.direcao === 'ida' ? 'Ida' : 'Volta'} às ${hora(b.inicio)}`,
        detalhe: escolas,
        valor: plural(vao.length, 'criança', 'crianças'),
      };
    })
    .filter(Boolean);
  const quem = new Set();
  for (const b of blocos) for (const p of b.paradas) if (precisaDaPerua(p.estado)) quem.add(p.child.id);
  const frases = linhas.length
    ? [`Hoje vão ${plural(quem.size, 'criança', 'crianças')}, em ${plural(linhas.length, 'viagem', 'viagens')}.`]
    : ['Hoje nenhuma criança vai com você.'];
  return { tema: TEMA_DO_DIA.VAI, frases, linhas, quantas: quem.size };
}

/** QUEM NÃO VAI HOJE — só quem tem aviso para hoje, com o que foi avisado. */
export function quemNaoVaiHoje(children = [], { declaracoes = {}, agora = Date.now() } = {}) {
  const fechado = semRota(agora);
  if (fechado) return { tema: TEMA_DO_DIA.NAO_VAI, frases: [fechado], linhas: [], quantas: 0 };
  const linhas = ativas(children)
    .filter((c) => declaracoes[c.id])
    .map((c) => ({ id: c.id, nome: nome(c), detalhe: MOTIVO[declaracoes[c.id].type] || 'avisou' }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const n = linhas.length;
  const frases = n === 0
    ? ['Ninguém avisou que não vai hoje.']
    : [`${n === 1 ? '1 criança tem aviso' : `${n} crianças têm aviso`} para hoje.`];
  frases.push('Aparece só o que foi avisado pelo app.');
  return { tema: TEMA_DO_DIA.NAO_VAI, frases, linhas, quantas: n };
}

/** QUE HORAS EU SAIO — a próxima viagem de hoje e a primeira parada dela. */
export function quandoEuSaio(children = [], { declaracoes = {}, escolasPorId = {}, agora = Date.now() } = {}) {
  const fechado = semRota(agora);
  if (fechado) return { tema: TEMA_DO_DIA.HORARIO, frases: [fechado], linhas: [], quantas: 0 };
  const d = new Date(agora);
  const min = d.getHours() * 60 + d.getMinutes();
  const blocos = diaCompleto(ativas(children), { declaracoes, escolasPorId });
  const proxima = blocos
    .map((b) => ({ b, primeira: b.paradas.find((p) => precisaDaPerua(p.estado)) }))
    .find(({ primeira }) => primeira && primeira.minutos >= min);
  if (!proxima) {
    return { tema: TEMA_DO_DIA.HORARIO, frases: ['Hoje não tem mais viagem.'], linhas: [], quantas: 0 };
  }
  const { b, primeira } = proxima;
  const viagem = b.direcao === 'ida' ? 'ida' : 'volta';
  const onde = b.direcao === 'ida'
    ? `na casa ${primeira.child.gender === 'female' ? 'da' : 'do'} ${nome(primeira.child)}`
    : `na ${b.escolas[0]?.nome || 'escola'}`;
  return {
    tema: TEMA_DO_DIA.HORARIO,
    frases: [`A próxima viagem é a ${viagem}: a primeira parada é às ${horaCurta(primeira.hora)}, ${onde}.`],
    linhas: [],
    quantas: 1,
  };
}

/** QUEM AVISOU FALTA — os avisos desta semana, de segunda a domingo. */
export function faltasDaSemana(avisos = [], children = [], { agora = Date.now() } = {}) {
  const { de, ate } = semanaDe(agora);
  const porId = new Map(ativas(children).map((c) => [c.id, c]));
  const linhas = (avisos || [])
    .filter((a) => a?.dateKey >= de && a?.dateKey <= ate && porId.has(a.childId))
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0))
    .map((a) => {
      const [y, m, dd] = a.dateKey.split('-').map(Number);
      return {
        id: a.id || `${a.dateKey}_${a.childId}`,
        nome: nome(porId.get(a.childId)),
        detalhe: `${DIAS[new Date(y, m - 1, dd).getDay()]} · ${MOTIVO[a.type] || 'avisou'}`,
      };
    });
  const n = linhas.length;
  const frases = n === 0
    ? ['Ninguém avisou falta para esta semana.']
    : [`${n === 1 ? '1 aviso' : `${n} avisos`} para esta semana.`];
  frases.push('Aparece só o que foi avisado pelo app.');
  return { tema: TEMA_DO_DIA.FALTAS, frases, linhas, quantas: n };
}

/** TEM FERIADO ESTA SEMANA — os nacionais de segunda a domingo. */
export function feriadoDaSemana({ agora = Date.now() } = {}) {
  const { segunda } = semanaDe(agora);
  const linhas = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + i);
    const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const nomeDoFeriado = feriadosNacionais(d.getFullYear())[mmdd];
    if (nomeDoFeriado) linhas.push({ id: chave(d), nome: nomeDoFeriado, detalhe: `${DIAS[d.getDay()]}, dia ${d.getDate()}` });
  }
  const frases = linhas.length
    ? [`Esta semana tem ${plural(linhas.length, 'feriado nacional', 'feriados nacionais')}.`]
    : ['Esta semana não tem feriado nacional.'];
  frases.push('Feriado da cidade o app não sabe.');
  return { tema: TEMA_DO_DIA.FERIADO, frases, linhas, quantas: linhas.length };
}

/** QUEM FAZ ANIVERSÁRIO — as crianças da turma que fazem neste mês. */
export function aniversariosDoMes(children = [], { agora = Date.now() } = {}) {
  const d = new Date(agora);
  const mes = d.getMonth() + 1;
  const linhas = ativas(children)
    .map((c) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(c.birthDate || ''));
      if (!m || Number(m[2]) !== mes) return null;
      const dia = Number(m[3]);
      const quando = new Date(d.getFullYear(), mes - 1, dia);
      return { id: c.id, nome: nome(c), detalhe: `dia ${dia}, ${DIAS[quando.getDay()]}`, dia };
    })
    .filter(Boolean)
    .sort((a, b) => a.dia - b.dia)
    .map((l) => ({ id: l.id, nome: l.nome, detalhe: l.detalhe }));
  const n = linhas.length;
  const frases = n === 0
    ? [`Ninguém da turma faz aniversário em ${MESES[mes - 1]}.`]
    : [`${n === 1 ? '1 aniversário' : `${n} aniversários`} em ${MESES[mes - 1]}.`];
  frases.push('Conta só quem tem a data na ficha.');
  return { tema: TEMA_DO_DIA.ANIVERSARIO, frases, linhas, quantas: n };
}

/** A resposta de um tema do dia — o que a conversa chama a cada toque. */
export function responderDoDia(tema, { children = [], declaracoes = {}, escolasPorId = {}, avisosDaSemana = [], agora = Date.now() } = {}) {
  const op = { declaracoes, escolasPorId, agora };
  if (tema === TEMA_DO_DIA.VAI) return quemVaiHoje(children, op);
  if (tema === TEMA_DO_DIA.NAO_VAI) return quemNaoVaiHoje(children, op);
  if (tema === TEMA_DO_DIA.HORARIO) return quandoEuSaio(children, op);
  if (tema === TEMA_DO_DIA.FALTAS) return faltasDaSemana(avisosDaSemana, children, { agora });
  if (tema === TEMA_DO_DIA.FERIADO) return feriadoDaSemana({ agora });
  if (tema === TEMA_DO_DIA.ANIVERSARIO) return aniversariosDoMes(children, { agora });
  return null;
}

