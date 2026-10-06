/**
 * O KANBAN DO DONO — régua pura (05/10/2026).
 *
 * Um TEMA tem atividades dentro, e tema e atividade guardam duas datas: quando
 * foram abertos e quando foram concluídos. As datas são 'AAAA-MM-DD' e "hoje"
 * entra SEMPRE por parâmetro: quem conhece o relógio (fuso de Brasília) é o
 * service, e régua que lê o relógio sozinha não se testa.
 *
 * Os limites são os mesmos que as rules vão conferir (nome 120, texto 200, 50
 * atividades): conferir aqui só poupa a viagem — quem trava de verdade é a rule.
 */
export const ESTADO = { A_FAZER: 'a_fazer', FAZENDO: 'fazendo', CONCLUIDO: 'concluido' };
export const ESTADOS = [ESTADO.A_FAZER, ESTADO.FAZENDO, ESTADO.CONCLUIDO];
export const LIMITES = { NOME: 120, TEXTO: 200, ATIVIDADES: 50 };

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export function dataValida(s) {
  return typeof s === 'string' && DATA.test(s);
}

function limpar(s) {
  return typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '';
}

/** Id de atividade: curto, único dentro do tema (remover não pode reusar um id vivo). */
function novoId(tema) {
  const usados = new Set((tema.atividades || []).map((a) => a.id));
  let i = (tema.atividades || []).length + 1;
  while (usados.has(`a${i}`)) i += 1;
  return `a${i}`;
}

export function criarTema({ nome, hoje, uid }) {
  const n = limpar(nome);
  if (!n) return { ok: false, erro: 'Escreva o nome do tema.' };
  if (n.length > LIMITES.NOME) return { ok: false, erro: `O nome passa de ${LIMITES.NOME} letras.` };
  if (!dataValida(hoje)) return { ok: false, erro: 'Data inválida.' };
  if (!uid) return { ok: false, erro: 'Sem usuário.' };
  return {
    ok: true,
    tema: {
      nome: n,
      estado: ESTADO.A_FAZER,
      abertoEm: hoje,
      concluidoEm: null,
      atividades: [],
      criadoPor: uid,
    },
  };
}

/** Move o tema. Concluir grava a data; sair de concluído a zera. */
export function moverTema(tema, estado, hoje) {
  if (!ESTADOS.includes(estado)) return tema;
  return {
    ...tema,
    estado,
    concluidoEm: estado === ESTADO.CONCLUIDO ? tema.concluidoEm || hoje : null,
  };
}

/** Atividade nova num tema concluído o reabre: o tema deixou de estar pronto. */
export function acrescentarAtividade(tema, texto, hoje) {
  const t = limpar(texto);
  if (!t) return { ok: false, erro: 'Escreva a atividade.' };
  if (t.length > LIMITES.TEXTO) return { ok: false, erro: `O texto passa de ${LIMITES.TEXTO} letras.` };
  if ((tema.atividades || []).length >= LIMITES.ATIVIDADES) {
    return { ok: false, erro: `Um tema guarda até ${LIMITES.ATIVIDADES} atividades.` };
  }
  const base = {
    ...tema,
    atividades: [
      ...(tema.atividades || []),
      { id: novoId(tema), texto: t, abertaEm: hoje, concluidaEm: null },
    ],
  };
  return {
    ok: true,
    tema: tema.estado === ESTADO.CONCLUIDO ? moverTema(base, ESTADO.FAZENDO, hoje) : base,
  };
}

/** Marcar grava a data de hoje; desmarcar zera. */
export function alternarAtividade(tema, id, hoje) {
  return {
    ...tema,
    atividades: (tema.atividades || []).map((a) =>
      a.id === id ? { ...a, concluidaEm: a.concluidaEm ? null : hoje } : a
    ),
  };
}

export function removerAtividade(tema, id) {
  return { ...tema, atividades: (tema.atividades || []).filter((a) => a.id !== id) };
}

/** Confere o documento inteiro contra o formato combinado. */
export function temaValido(t) {
  if (!t || typeof t !== 'object') return false;
  if (typeof t.nome !== 'string' || !t.nome || t.nome.length > LIMITES.NOME) return false;
  if (!ESTADOS.includes(t.estado)) return false;
  if (!dataValida(t.abertoEm)) return false;
  if (t.concluidoEm !== null && !dataValida(t.concluidoEm)) return false;
  if (!Array.isArray(t.atividades) || t.atividades.length > LIMITES.ATIVIDADES) return false;
  return t.atividades.every(
    (a) =>
      a &&
      typeof a.id === 'string' &&
      typeof a.texto === 'string' &&
      a.texto &&
      a.texto.length <= LIMITES.TEXTO &&
      dataValida(a.abertaEm) &&
      (a.concluidaEm === null || dataValida(a.concluidaEm))
  );
}

export function agruparPorEstado(temas) {
  const g = { [ESTADO.A_FAZER]: [], [ESTADO.FAZENDO]: [], [ESTADO.CONCLUIDO]: [] };
  for (const t of temas || []) if (g[t.estado]) g[t.estado].push(t);
  return g;
}

export function resumirKanban(temas) {
  const lista = temas || [];
  const concluidos = lista.filter((t) => t.estado === ESTADO.CONCLUIDO).length;
  return { abertos: lista.length - concluidos, concluidos };
}

export function frasesDoResumo(temas) {
  const { abertos, concluidos } = resumirKanban(temas);
  return `${abertos} ${abertos === 1 ? 'tema aberto' : 'temas abertos'} · ${concluidos} ${
    concluidos === 1 ? 'concluído' : 'concluídos'
  }`;
}
