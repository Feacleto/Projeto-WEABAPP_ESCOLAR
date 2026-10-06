/**
 * O RESUMO DA AVALIAÇÃO DO APP — a conta da aba "Avaliação do app" do dono.
 *
 * ── POR QUE ELA É UM ARQUIVO À PARTE
 * A aba antiga (`Pesquisa`) somava dentro do service, atrás de um import do
 * Firestore, e por isso nenhum número dela tinha teste. Aqui entra a lista de
 * `feedbacks` já lida e o "agora" por PARÂMETRO; sai o que a tela desenha.
 *
 * ── ⚠️ ONDE O NÚMERO NÃO EXISTE, A RESPOSTA É `null`, NUNCA ZERO
 * Média de quem não respondeu não é 0,0: é "ninguém respondeu", e zero
 * pareceria nota péssima onde não houve nem pergunta. A tela escreve "—".
 *
 * ── ⚠️ DE FAMÍLIA NUNCA SAI O NOME
 * O comentário da família leva só o papel e o momento. O primeiro nome existe
 * apenas para o MOTORISTA. Quem lê "Maria disse que o app trava" sabe de quem
 * é a criança; o dono não precisa saber.
 *
 * ── ⚠️ A NOTA QUE A FAMÍLIA DÁ AO TIO NÃO ENTRA
 * Ela mora em `avaliacoesDoTio` e é outra coleção. Esta régua só conhece
 * `feedbacks`: a pergunta aqui é sobre o APP.
 *
 * Papéis e momentos estão escritos aqui como TEXTO (os mesmos de
 * `avaliacaoRapida.js`) de propósito: a régua segue testável mesmo se aquele
 * arquivo mudar de lugar, e o teste confere os valores à mão.
 *
 * PURO: sem Firebase, sem React. `node scripts/testar-resumo-da-avaliacao.mjs`.
 */

import {
  avaliacaoLigada,
  MOMENTO,
  NOTA_BAIXA,
  PAPEL_DA_AVALIACAO,
  ROSTOS,
} from './avaliacaoRapida.js';

// Os papéis, os momentos, os rostos e a nota baixa vêm da régua da AVALIAÇÃO
// RÁPIDA (quem pergunta), e não são reescritos aqui: se o cartão ganhar um
// momento novo, o painel o rotula sem ninguém lembrar de copiar.
export { NOTA_BAIXA };

const DIA_MS = 24 * 60 * 60 * 1000;

/** Quem respondeu, no jeito que o painel agrupa. */
export const GRUPO = Object.freeze({
  MOTORISTA: 'motorista',
  FAMILIA: 'familia',
  LINK: 'link',
});

export const ROTULO_DO_GRUPO = Object.freeze({
  motorista: 'Motorista',
  familia: 'Família',
  link: 'Pelo link',
});

/** Os períodos do filtro. `dias: null` é "desde o começo". */
export const PERIODOS = Object.freeze([
  { id: '30', dias: 30, rotulo: '30 dias' },
  { id: '90', dias: 90, rotulo: '90 dias' },
  { id: 'tudo', dias: null, rotulo: 'Desde o começo' },
]);

/** Valor de `momento` → como o dono lê. Feedback antigo não tem momento. */
export const ROTULO_DO_MOMENTO = Object.freeze({
  [MOMENTO.FIM_DA_ROTA]: 'Fim da rota',
  [MOMENTO.DIA_ENTREGUE]: 'Filho entregue',
  [MOMENTO.ACOMPANHAMENTO]: 'Pelo link, depois da entrega',
  [MOMENTO.PERFIL]: 'Pelo perfil',
  sem_momento: 'Sem momento (antes do cartão)',
});

export const ROTULO_DA_NOTA = Object.freeze(
  Object.fromEntries(ROSTOS.map((r) => [r.nota, r.rotulo]))
);

/** Quantos comentários a lista guarda, do mais novo para o mais antigo. */
export const MAX_COMENTARIOS = 60;

export const FILTROS_DE_COMENTARIO = Object.freeze([
  { id: 'todos', rotulo: 'Todos' },
  { id: 'baixas', rotulo: 'Notas 1 e 2' },
  { id: 'motorista', rotulo: 'Motoristas' },
  { id: 'familia', rotulo: 'Famílias' },
]);

function emMs(valor) {
  if (valor == null) return null;
  if (typeof valor === 'number') return valor;
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (typeof valor.toDate === 'function') return valor.toDate().getTime();
  if (typeof valor === 'string') {
    const t = new Date(valor).getTime();
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/** `admin` é o MOTORISTA; quem não é motorista nem do link é a família. */
export function grupoDoPapel(role) {
  if (role === PAPEL_DA_AVALIACAO.MOTORISTA) return GRUPO.MOTORISTA;
  if (role === PAPEL_DA_AVALIACAO.ACOMPANHANTE || role === PAPEL_DA_AVALIACAO.SEGUNDO_RESPONSAVEL) {
    return GRUPO.LINK;
  }
  return GRUPO.FAMILIA;
}

function notaDe(f) {
  const n = Number(f?.answers?.rating);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

function media(soma, n) {
  return n > 0 ? soma / n : null;
}

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || null;
}

function chaveDoMomento(f) {
  return f?.momento && ROTULO_DO_MOMENTO[f.momento] ? f.momento : 'sem_momento';
}

/** O interruptor do dono. Ausente é LIGADA — só o `false` explícito desliga. */
export function perguntaLigada(config) {
  return avaliacaoLigada(config);
}

/**
 * Corta a lista pelo período. Documento sem data não é "recente": só entra no
 * "desde o começo".
 */
export function noPeriodo(feedbacks, { dias = null, agora = new Date() } = {}) {
  const lista = Array.isArray(feedbacks) ? feedbacks : [];
  if (!dias) return lista;
  const t = emMs(agora) ?? Date.now();
  return lista.filter((f) => {
    const em = emMs(f?.createdAt);
    return em != null && t - em <= dias * DIA_MS;
  });
}

/**
 * Tudo o que a aba mostra, de uma vez. Só conta feedback com nota válida (1 a
 * 5): sem nota não há o que somar, e inventar uma distorceria a média.
 */
export function resumirAvaliacao(feedbacks, { dias = null, agora = new Date() } = {}) {
  const lista = noPeriodo(feedbacks, { dias, agora })
    .map((f) => ({ f, nota: notaDe(f) }))
    .filter((x) => x.nota !== null);

  const grupos = {
    motorista: { n: 0, soma: 0 },
    familia: { n: 0, soma: 0 },
    link: { n: 0, soma: 0 },
  };
  const contagem = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const momentos = new Map();
  let soma = 0;

  for (const { f, nota } of lista) {
    const g = grupoDoPapel(f.role);
    grupos[g].n += 1;
    grupos[g].soma += nota;
    contagem[nota] += 1;
    soma += nota;

    const chave = chaveDoMomento(f);
    const m = momentos.get(chave) || { n: 0, soma: 0 };
    m.n += 1;
    m.soma += nota;
    momentos.set(chave, m);
  }

  const total = lista.length;

  const distribuicao = [5, 4, 3, 2, 1].map((nota) => ({
    nota,
    rotulo: ROTULO_DA_NOTA[nota],
    n: contagem[nota],
    pct: total > 0 ? Math.round((contagem[nota] / total) * 100) : null,
  }));

  // Do momento com mais respostas para o com menos; o que não tem momento
  // (feedback anterior ao cartão) vai por último, mesmo se for o maior.
  const porMomento = [...momentos.entries()]
    .map(([momento, m]) => ({
      momento,
      rotulo: ROTULO_DO_MOMENTO[momento],
      n: m.n,
      media: media(m.soma, m.n),
    }))
    .sort((a, b) => {
      if (a.momento === 'sem_momento') return 1;
      if (b.momento === 'sem_momento') return -1;
      return b.n - a.n;
    });

  const comentarios = lista
    .map(({ f, nota }) => {
      const texto = String(f.comment || '').trim();
      if (!texto) return null;
      const grupo = grupoDoPapel(f.role);
      const momento = chaveDoMomento(f);
      return {
        id: f.id ?? null,
        texto,
        nota,
        grupo,
        rotuloDoGrupo: ROTULO_DO_GRUPO[grupo],
        momento,
        rotuloDoMomento: ROTULO_DO_MOMENTO[momento],
        // Nome só do motorista. Família e link: nunca.
        nome: grupo === GRUPO.MOTORISTA ? primeiroNome(f.authorName) : null,
        em: emMs(f.createdAt),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.em ?? 0) - (a.em ?? 0))
    .slice(0, MAX_COMENTARIOS);

  return {
    total,
    media: media(soma, total),
    motoristas: { n: grupos.motorista.n, media: media(grupos.motorista.soma, grupos.motorista.n) },
    familias: { n: grupos.familia.n, media: media(grupos.familia.soma, grupos.familia.n) },
    link: { n: grupos.link.n, media: media(grupos.link.soma, grupos.link.n) },
    notasBaixas: contagem[1] + contagem[2],
    distribuicao,
    porMomento,
    comentarios,
  };
}

/** Os filtros da lista "O que escreveram". Desconhecido vale "todos". */
export function filtrarComentarios(comentarios, filtro = 'todos') {
  const lista = Array.isArray(comentarios) ? comentarios : [];
  switch (filtro) {
    case 'baixas':
      return lista.filter((c) => c.nota <= NOTA_BAIXA);
    case 'motorista':
      return lista.filter((c) => c.grupo === GRUPO.MOTORISTA);
    case 'familia':
      return lista.filter((c) => c.grupo === GRUPO.FAMILIA);
    default:
      return lista;
  }
}
