import { NIVEIS } from '../../dominio/identidade/nivel.js';

/**
 * O nome de cada nível como a pessoa lê — e a normalização do que chega de
 * `useNivel`. Apresentação, não regra: a régua só conhece as chaves.
 */
export const NOME_DO_NIVEL = {
  sem_nivel: 'Sem nível',
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
  platina: 'Platina',
  diamante: 'Diamante',
};

/**
 * Aceita a chave ('prata') ou o documento de `niveis/{uid}` ({ nivel }) e
 * devolve sempre a chave — 'sem_nivel' para o que não for reconhecido. Nível
 * desconhecido não vira selo: vira nada.
 */
export function chaveDoNivel(nivel) {
  const chave = typeof nivel === 'string' ? nivel : nivel?.nivel;
  return NIVEIS.includes(chave) ? chave : 'sem_nivel';
}

/** Posição na escada (0 = sem nível). */
export function posicaoDoNivel(nivel) {
  return NIVEIS.indexOf(chaveDoNivel(nivel));
}

/**
 * Para onde leva o botão de cada atividade de Platina, pela CHAVE de
 * `verificacao` (o catálogo da régua). Chave sem destino aqui leva a "Meu nível".
 */
export const DESTINO_DA_ATIVIDADE = {
  despesasDoMes: '/tio/finance/expenses',
  reservaAtualizadaNoMes: '/tio/finance/reserva',
  fotoDeTodas: '/tio/children',
  horarioDeCostumeVisto: '/tio/children',
};

/**
 * O que chega de `useAtividadesDaPlatina` — a lista, ou `{ atividades }` —
 * sempre como lista.
 */
export function listaDeAtividades(r) {
  if (Array.isArray(r)) return r;
  if (r && Array.isArray(r.atividades)) return r.atividades;
  return [];
}
