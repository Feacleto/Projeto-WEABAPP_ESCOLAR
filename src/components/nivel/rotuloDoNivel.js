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

// ─── A ESTRADA (modelo D2, 04/10/2026) ─────────────────────────────────────

/** Os níveis que cada um percorre: o motorista tem cinco, a família três. */
export const ESTRADA_DO_MOTORISTA = ['bronze', 'prata', 'ouro', 'platina', 'diamante'];
export const ESTRADA_DA_FAMILIA = ['bronze', 'prata', 'ouro'];

/** "Na Prata", "No Ouro" — o artigo de cada nível. */
export function noNivel(chave) {
  return `${chave === 'prata' || chave === 'platina' ? 'Na' : 'No'} ${NOME_DO_NIVEL[chave]}`;
}

/**
 * A frase de quem toca num nível da estrada para "sonhar" com ele.
 * `faltam` é quantas missões faltam até lá, quando se sabe (pode ser null).
 */
export function fraseDoSonho({ vendo, atual, estrada, faltam = null }) {
  const iv = estrada.indexOf(vendo);
  const ia = estrada.indexOf(atual);
  if (iv === ia || iv < 0) return 'Toque num nível para ver o selo dele.';
  if (iv < ia) return `Você já conquistou o selo ${NOME_DO_NIVEL[vendo]}.`;
  const inicio = `${noNivel(vendo)} seu selo fica assim.`;
  if (vendo === 'platina') {
    return `${inicio} A Platina vai e volta: ela vale enquanto você estiver em dia com as novidades do mês.`;
  }
  if (vendo === 'diamante') return `${inicio} O Diamante é a Platina com a trilha do seu negócio completa.`;
  if (faltam == null || faltam <= 0) return inicio;
  return `${inicio} ${faltam === 1 ? 'Falta 1 missão' : `Faltam ${faltam} missões`}.`;
}

/**
 * O que cada parada da estrada pede, numa linha: as duas primeiras missões
 * do nível e "mais N". Platina e Diamante têm frase própria.
 */
export function oQueONivelPede(chave, missoes) {
  if (chave === 'platina') return 'Estar em dia com as novidades do mês';
  if (chave === 'diamante') return 'Platina e a trilha do seu negócio';
  const doNivel = (missoes || []).filter((m) => m.nivel === chave && !m.pre);
  if (doNivel.length === 0) return '';
  const primeiras = doNivel.slice(0, 2).map((m) => m.titulo).join(', ');
  return doNivel.length > 2 ? `${primeiras} e mais ${doNivel.length - 2}` : primeiras;
}

/** "Feito hoje", "Feito ontem", "Feito em 12/09" — ou só "Feito", sem data. */
export function rotuloDoFeito(emMs, agora = new Date()) {
  if (typeof emMs !== 'number') return 'Feito';
  const dia = (d) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const hoje = dia(agora);
  if (dia(emMs) === hoje) return 'Feito hoje';
  if (dia(emMs) === dia(agora.getTime() - 24 * 60 * 60 * 1000)) return 'Feito ontem';
  return `Feito em ${new Date(emMs).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })}`;
}
