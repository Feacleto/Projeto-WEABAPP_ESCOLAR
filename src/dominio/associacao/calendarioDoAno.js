/**
 * O CALENDÁRIO DO ANO DO PAINEL DO DONO — a lista de datas e a barra de "quanto
 * tem aula" de cada mês.
 *
 * POR QUE EXISTE: o negócio tem sazonalidade (janeiro vende, julho cala a
 * rota, dezembro esvazia) e o dono decidia isso de cabeça. A aba só LÊ esta
 * lista; nada aqui grava ou decide cobrança.
 *
 * ⚠️ FERIADO VEM DE `rota/calendario.js`, e não é recalculado aqui: duas listas
 * de feriado dariam dois sábados diferentes para a mesma data (o servidor usa o
 * espelho daquela). A Páscoa também é a de lá.
 *
 * ⚠️ FÉRIAS ESCOLARES SÃO ESTIMATIVA. Cada rede (municipal, estadual,
 * particular) tem o seu calendário e o app não o conhece — o motorista é quem
 * sabe. As datas abaixo são um palpite honesto, marcadas `estimativa: true`, e a
 * tela diz isso. Nunca virar aviso a família a partir delas.
 *
 * Puro: sem Firebase, sem React. Import interno com `.js`.
 */
import { feriadosNacionais, pascoa } from '../rota/calendario.js';

export const TIPO = {
  ESCOLA: 'escola',
  FERIADO: 'feriado',
  POPULAR: 'popular',
  NEGOCIO: 'negocio',
};

// A ordem também é o desempate quando duas coisas caem no mesmo dia.
const ORDEM_DO_TIPO = [TIPO.FERIADO, TIPO.POPULAR, TIPO.ESCOLA, TIPO.NEGOCIO];

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const p2 = (n) => String(n).padStart(2, '0');

/** 'AAAA-MM-DD' no calendário LOCAL — toISOString converteria para UTC e deslocaria o dia. */
export function chaveDoDia(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

const mais = (d, dias) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);

/** O n-ésimo dia da semana (0 = domingo) do mês (mes 1–12). */
function enesimoDiaDaSemana(ano, mes, diaDaSemana, n) {
  const primeiro = new Date(ano, mes - 1, 1);
  const deslocamento = (diaDaSemana - primeiro.getDay() + 7) % 7;
  return new Date(ano, mes - 1, 1 + deslocamento + (n - 1) * 7);
}

/** Primeiro dia útil (segunda a sexta) a partir de uma data. */
function primeiroDiaUtil(d) {
  let x = d;
  while (x.getDay() === 0 || x.getDay() === 6) x = mais(x, 1);
  return x;
}

/**
 * As férias ESTIMADAS, como intervalos fechados em 'MM-DD'. Janeiro inteiro,
 * recesso de julho (2 a 4 semanas: aqui, 3) e o fim das aulas em meados de
 * dezembro.
 */
export const FERIAS_ESTIMADAS = [
  { inicio: '01-01', fim: '01-31', nome: 'Férias de janeiro' },
  { inicio: '07-13', fim: '07-31', nome: 'Recesso de julho' },
  { inicio: '12-19', fim: '12-31', nome: 'Férias de dezembro' },
];

function emFerias(d) {
  const mmdd = `${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  return FERIAS_ESTIMADAS.some((f) => mmdd >= f.inicio && mmdd <= f.fim);
}

function evento(data, nome, tipo, extra = {}) {
  return { data: chaveDoDia(data), nome, tipo, ...extra };
}

function eventosDeEscola(ano) {
  return [
    evento(new Date(ano, 0, 1), 'Férias de janeiro', TIPO.ESCOLA, { estimativa: true }),
    evento(primeiroDiaUtil(new Date(ano, 1, 1)), 'Volta às aulas', TIPO.ESCOLA, { estimativa: true }),
    evento(new Date(ano, 6, 13), 'Recesso de julho', TIPO.ESCOLA, { estimativa: true }),
    evento(primeiroDiaUtil(new Date(ano, 7, 1)), 'Volta do recesso', TIPO.ESCOLA, { estimativa: true }),
    evento(new Date(ano, 11, 18), 'Fim das aulas', TIPO.ESCOLA, { estimativa: true }),
  ];
}

function eventosDeFeriado(ano) {
  const lista = feriadosNacionais(ano);
  return Object.keys(lista).map((mmdd) => {
    const [m, d] = mmdd.split('-').map(Number);
    return evento(new Date(ano, m - 1, d), lista[mmdd], TIPO.FERIADO);
  });
}

function eventosPopulares(ano) {
  const quartaQuinta = enesimoDiaDaSemana(ano, 11, 4, 4);
  const fixas = [
    [3, 8, 'Dia Internacional da Mulher'],
    [6, 12, 'Dia dos Namorados'],
    [7, 25, 'Dia do Motorista'],
    [8, 11, 'Dia do Estudante'],
    [10, 15, 'Dia do Professor'],
    [10, 31, 'Halloween'],
  ];
  return [
    evento(pascoa(ano), 'Páscoa', TIPO.POPULAR),
    evento(enesimoDiaDaSemana(ano, 5, 0, 2), 'Dia das Mães', TIPO.POPULAR),
    evento(enesimoDiaDaSemana(ano, 8, 0, 2), 'Dia dos Pais', TIPO.POPULAR),
    // A Black Friday é a sexta DEPOIS da 4ª quinta de novembro (Ação de Graças).
    evento(mais(quartaQuinta, 1), 'Black Friday', TIPO.POPULAR),
    ...fixas.map(([m, d, nome]) => evento(new Date(ano, m - 1, d), nome, TIPO.POPULAR)),
  ];
}

/**
 * O QUE O NEGÓCIO PEDE — leitura do dono sobre o que o mês faz com a base.
 * Cada nota é ancorada no dia 1 do mês (ou na Black Friday), porque o que
 * importa é o mês e não a data.
 */
function eventosDoNegocio(ano) {
  const blackFriday = mais(enesimoDiaDaSemana(ano, 11, 4, 4), 1);
  const nota = (mes, texto) => evento(new Date(ano, mes - 1, 1), texto, TIPO.NEGOCIO);
  return [
    nota(1, 'Melhor mês para vender: o tio fecha a turma nova'),
    nota(2, 'Pico de cadastro e de chamados de convite'),
    nota(7, 'Rotas caem: o risco fica calado'),
    nota(10, 'O tio pensa no preço do ano que vem'),
    nota(11, 'Contrato do ano seguinte com as famílias'),
    evento(blackFriday, 'Black Friday: sem desconto relâmpago, a escada é pública', TIPO.NEGOCIO),
    nota(12, "Avisar antes de o 'parou de rodar' disparar"),
  ];
}

/** Todos os eventos do ano, em ordem cronológica. */
export function eventosDoAno(ano) {
  const todos = [
    ...eventosDeFeriado(ano),
    ...eventosPopulares(ano),
    ...eventosDeEscola(ano),
    ...eventosDoNegocio(ano),
  ];
  return todos.sort(
    (a, b) =>
      a.data.localeCompare(b.data) ||
      ORDEM_DO_TIPO.indexOf(a.tipo) - ORDEM_DO_TIPO.indexOf(b.tipo) ||
      a.nome.localeCompare(b.nome, 'pt-BR')
  );
}

/**
 * Quanto do mês tem aula: dias úteis que não são feriado nem férias estimadas,
 * sobre os dias úteis do mês. `mes` é 1–12.
 */
export function aulaDoMes(ano, mes) {
  const feriados = feriadosNacionais(ano);
  const ultimo = new Date(ano, mes, 0).getDate();
  let uteis = 0;
  let aula = 0;
  for (let dia = 1; dia <= ultimo; dia += 1) {
    const d = new Date(ano, mes - 1, dia);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    uteis += 1;
    if (!feriados[`${p2(mes)}-${p2(dia)}`] && !emFerias(d)) aula += 1;
  }
  return { aula, uteis, fracao: uteis ? aula / uteis : 0 };
}

/** Os 12 meses, cada um com seus eventos e a fração de aula. */
export function mesesDoAno(ano) {
  const eventos = eventosDoAno(ano);
  return MESES.map((nome, i) => ({
    mes: i + 1,
    nome,
    ...aulaDoMes(ano, i + 1),
    eventos: eventos.filter((e) => Number(e.data.slice(5, 7)) === i + 1),
  }));
}

/**
 * "Vem aí": as próximas datas a partir de `hoje` (inclusive). Ficam de fora as
 * notas do negócio (são do mês, não de um dia) e as estimativas de escola —
 * "a próxima data" não pode ser um palpite. Atravessa a virada do ano.
 */
export function vemAi(hoje = new Date(), quantas = 3) {
  const desde = chaveDoDia(hoje);
  const candidatos = [
    ...eventosDoAno(hoje.getFullYear()),
    ...eventosDoAno(hoje.getFullYear() + 1),
  ].filter((e) => e.data >= desde && e.tipo !== TIPO.NEGOCIO && !e.estimativa);
  return candidatos.slice(0, quantas);
}
