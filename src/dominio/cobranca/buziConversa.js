import { formatBRL } from '../../compartilhado/formatters.js';
import { PERGUNTA, TEMA } from './boletim.js';
import { PERGUNTA_DA_PERUA, TEMA_DA_PERUA } from './buziDaPerua.js';
import { PERGUNTA_DO_DIA, TEMA_DO_DIA } from '../rota/buziDoDia.js';
import { PERGUNTA_DA_TURMA, TEMA_DA_TURMA } from '../identidade/buziDaTurma.js';

/**
 * O BUZI CHAT — a conversa que liga os assuntos (05/10/2026, modelo no jeito
 * do WhatsApp aprovado pelo dono no artifact "Buzi Chat").
 *
 * O Buzi oferece os botões DENTRO da conversa e o motorista toca: primeiro o
 * assunto, depois a pergunta, depois o próximo passo. Escrever ou falar é a
 * exceção, para quando o botão não basta — e aí o Buzi procura a pergunta
 * pronta mais parecida (`entenderPergunta`) e diz como entendeu.
 *
 * ⚠️ NÃO É IA, e não se chama assim. Cada resposta sai das réguas de cada
 * assunto (`boletim.js`, `buziDaPerua.js`, `rota/buziDoDia.js`,
 * `identidade/buziDaTurma.js`), com os números que o app já tem. Frase que
 * não casa com nenhuma pergunta recebe "ainda não sei responder isso", nunca
 * um palpite.
 *
 * ⚠️ NUNCA MAIS DE TRÊS BOTÕES À VISTA (regra do dono): o primeiro nível tem
 * três assuntos, "Rota e turma" abre outros três, cada assunto tem três
 * perguntas, e depois de cada resposta vêm no máximo três próximos passos.
 *
 * Puro: `npm run testar:buzi`.
 */

export const ASSUNTO = {
  MENSALIDADES: 'mensalidades',
  PERUA: 'perua',
  ROTA: 'rota',
  HOJE: 'hoje',
  TURMA: 'turma',
  SEMANA: 'semana',
};

/** Cada assunto: o rótulo do botão, a pergunta do Buzi e o que ele oferece. */
export const ASSUNTOS = {
  [ASSUNTO.MENSALIDADES]: {
    rotulo: 'Mensalidades',
    pergunta: 'O que você quer saber das mensalidades?',
    temas: [TEMA.ATRASADOS, TEMA.AVISARAM, TEMA.ENTROU],
  },
  [ASSUNTO.PERUA]: {
    rotulo: 'Perua e sobra',
    pergunta: 'O que você quer saber da perua?',
    temas: [TEMA_DA_PERUA.COMBUSTIVEL, TEMA_DA_PERUA.MANUTENCAO, TEMA_DA_PERUA.SOBROU],
  },
  [ASSUNTO.ROTA]: {
    rotulo: 'Rota e turma',
    pergunta: 'Sobre o que da rota?',
    assuntos: [ASSUNTO.HOJE, ASSUNTO.TURMA, ASSUNTO.SEMANA],
  },
  [ASSUNTO.HOJE]: {
    rotulo: 'Hoje',
    pergunta: 'O que você quer saber de hoje?',
    temas: [TEMA_DO_DIA.VAI, TEMA_DO_DIA.NAO_VAI, TEMA_DO_DIA.HORARIO],
  },
  [ASSUNTO.TURMA]: {
    rotulo: 'Turma',
    pergunta: 'O que você quer saber da turma?',
    temas: [TEMA_DA_TURMA.CONVITE, TEMA_DA_TURMA.CONTRATO, TEMA_DA_TURMA.SEM_HORARIO],
  },
  [ASSUNTO.SEMANA]: {
    rotulo: 'Semana',
    pergunta: 'O que você quer saber da semana?',
    temas: [TEMA_DO_DIA.FALTAS, TEMA_DO_DIA.FERIADO, TEMA_DO_DIA.ANIVERSARIO],
  },
};

/** O primeiro nível: o que o Buzi oferece quando a conversa começa. */
export const PRIMEIROS = [ASSUNTO.MENSALIDADES, ASSUNTO.PERUA, ASSUNTO.ROTA];

export const PERGUNTA_INICIAL = 'Sobre o que você quer saber?';

/** O texto de cada pergunta, que vira a bolha dele na conversa. */
export const PERGUNTAS = { ...PERGUNTA, ...PERGUNTA_DA_PERUA, ...PERGUNTA_DO_DIA, ...PERGUNTA_DA_TURMA };

/** Todos os temas que o Buzi sabe responder. */
export const TEMAS = Object.keys(PERGUNTAS);

/** De que assunto é um tema — para o "Outra pergunta" voltar ao lugar certo. */
export function assuntoDoTema(tema) {
  return Object.keys(ASSUNTOS).find((a) => ASSUNTOS[a].temas?.includes(tema)) || null;
}

/**
 * O que pode ir para o Boletim: só o dinheiro do negócio (mensalidades,
 * perua e sobra). A rota e a turma não são o Boletim do negócio.
 * ⚠️ A taxa da plataforma nunca entra: é o outro dinheiro.
 */
export const VAI_PARA_O_BOLETIM = new Set([...ASSUNTOS.mensalidades.temas, ...ASSUNTOS.perua.temas]);

/** As partes do Boletim que valem, na ordem em que ele perguntou, sem repetir. */
export function partesDoBoletim(lista = []) {
  const vistas = new Set();
  return (lista || []).filter((t) => VAI_PARA_O_BOLETIM.has(t) && !vistas.has(t) && vistas.add(t));
}

/** O Boletim "do mês" de sempre, para quem não escolheu nenhuma parte. */
export const BOLETIM_PADRAO = [TEMA.ENTROU, TEMA.ATRASADOS, TEMA.AVISARAM];

/**
 * ESCREVER OU FALAR — acha a pergunta pronta mais parecida.
 *
 * Por palavras-chave, na ordem: a mais específica primeiro, e as que se
 * sobrepõem se resolvem embaixo ("não entrou no app" não é "quanto entrou").
 * Uma frase com dois assuntos vira duas respostas, uma de cada — é a regra
 * "um assunto por pergunta" aplicada ao que ele escreveu. No máximo três.
 */
const CHAVES = [
  [TEMA_DA_TURMA.CONVITE, /entrou no app|n[aã]o entrou|n[aã]o entraram|convite|baixou o app|instal/],
  [TEMA_DA_TURMA.CONTRATO, /contrato|assin/],
  [TEMA_DA_TURMA.SEM_HORARIO, /sem hor[aá]rio/],
  [TEMA.ATRASADOS, /atras|n[aã]o pag|devendo|\bdeve(m)?\b|calote/],
  [TEMA.AVISARAM, /avis\w* que pag|j[aá] pag|comprovante|(?<!n[aã]o )pagou|(?<!n[aã]o )pagaram/],
  [TEMA.ENTROU, /entrou|entraram|recebi|ganhei|faturei/],
  [TEMA_DA_PERUA.COMBUSTIVEL, /gasolina|diesel|combust|abastec|posto|etanol/],
  [TEMA_DA_PERUA.MANUTENCAO, /manuten|oficina|[oó]leo|pneu|mec[aâ]nic|revis[aã]o/],
  [TEMA_DA_PERUA.SOBROU, /sobr|lucro/],
  [TEMA_DO_DIA.NAO_VAI, /n[aã]o vai|n[aã]o v[aã]o|falt\w* hoje|quem falta hoje/],
  // "quem falta assinar" é o verbo, não a falta da criança.
  [TEMA_DO_DIA.FALTAS, /faltou|faltas|falta(?!\s+assin)/],
  [TEMA_DO_DIA.HORARIO, /que horas|hor[aá]rio|\bsaio\b|sa[ií]da|\bsair\b/],
  [TEMA_DO_DIA.VAI, /quem vai|\bhoje\b/],
  [TEMA_DO_DIA.FERIADO, /feriado/],
  [TEMA_DO_DIA.ANIVERSARIO, /anivers/],
];

const SOBREPOSTOS = [
  [TEMA_DO_DIA.NAO_VAI, TEMA_DO_DIA.FALTAS],
  [TEMA_DO_DIA.NAO_VAI, TEMA_DO_DIA.VAI],
  [TEMA_DA_TURMA.CONVITE, TEMA.ENTROU],
  [TEMA_DA_TURMA.SEM_HORARIO, TEMA_DO_DIA.HORARIO],
  [TEMA_DA_PERUA.SOBROU, TEMA.ENTROU],
];

export function entenderPergunta(texto) {
  const f = String(texto || '').toLowerCase();
  if (!f.trim()) return [];
  let achou = CHAVES.filter(([, re]) => re.test(f)).map(([t]) => t);
  for (const [fica, sai] of SOBREPOSTOS) {
    if (achou.includes(fica)) achou = achou.filter((t) => t !== sai);
  }
  return achou.slice(0, 3);
}

/**
 * A VOZ DO BUZI (05/10/2026, decisão do dono): ELE NUNCA FALA VALOR SOZINHO.
 *
 *   - "Ouvir" (o toque dele numa resposta) → `falaDaResposta`: a resposta
 *     INTEIRA, frases e lista, COM os valores. Quem está ao lado ouve porque
 *     ele quis. Com o olho fechado, nem o "Ouvir" fala valor.
 *   - A ligação, em que o Buzi responde falando sem ninguém tocar em nada →
 *     `falaDaLigacao`: SEMPRE sem valor, mesmo com o olho aberto, e termina
 *     com "Toque em Ouvir para ouvir os valores." O número continua escrito
 *     na conversa.
 *
 * A auxiliar está dentro da perua, e é dela que a senha do Financeiro
 * protege os valores — a voz não pode ser a porta dos fundos.
 */
const PARECE_DINHEIRO = /R\$|••••|\d+,\d{2}/;

/** As frases sem valor nenhum, e se alguma coisa ficou de fora. */
function semValor(resposta) {
  const frases = (resposta?.frases || []).filter((f) => !PARECE_DINHEIRO.test(f));
  const escondeu = frases.length < (resposta?.frases || []).length
    || (resposta?.linhas || []).some((l) => typeof l.valor === 'number');
  return { frases, escondeu };
}

function linhaFalada(l, mostrar) {
  const partes = [l.nome, l.detalhe].filter(Boolean);
  if (typeof l.valor === 'number') {
    if (mostrar) partes.push(formatBRL(l.valor));
  } else if (l.valor) {
    partes.push(l.valor);
  }
  return `${partes.join(', ')}.`;
}

/** O "Ouvir" de uma resposta — o toque explícito dele. */
export function falaDaResposta(resposta, { mostrar = true } = {}) {
  if (!resposta) return '';
  const linhas = (resposta.linhas || []).map((l) => linhaFalada(l, mostrar));
  if (mostrar) return [...(resposta.frases || []), ...linhas].join(' ');
  const { frases, escondeu } = semValor(resposta);
  return [...frases, ...linhas, ...(escondeu ? ['Os valores estão escondidos.'] : [])].join(' ');
}

/** O que o Buzi fala SOZINHO na ligação: nunca valor. */
export function falaDaLigacao(respostas = []) {
  const lista = (respostas || []).filter(Boolean);
  let escondeu = false;
  const falas = lista.map((r) => {
    const sem = semValor(r);
    escondeu = escondeu || sem.escondeu;
    return sem.frases.join(' ');
  });
  return [...falas.filter(Boolean), ...(escondeu ? ['Toque em Ouvir para ouvir os valores.'] : [])].join(' ');
}
