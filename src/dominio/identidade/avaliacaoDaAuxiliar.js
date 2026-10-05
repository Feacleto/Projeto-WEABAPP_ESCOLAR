/**
 * AS AVALIAÇÕES ENTRE O TIO E A AUXILIAR — o lado do app (05/10/2026).
 *
 * A régua que decide é do SERVIDOR (`functions/lib/reguaDaAvaliacaoDaAuxiliar.js`):
 * os 30 dias de vínculo, o filtro da frase e a assinatura. Aqui fica só o que
 * a tela precisa para desenhar — a lista fechada dos pontos fortes, os
 * limites e as frases de cada estado —, e `npm run testar:avaliacao-da-auxiliar`
 * confere que a lista e os limites são os mesmos dos dois lados.
 *
 * ⚠️ SEM RANKING E SEM CONTAGEM: nenhuma frase daqui conta recomendações nem
 * compara auxiliares. A nota que ela dá ao tio só chega a ele como MÉDIA, e
 * só com pelo menos 3 auxiliares diferentes.
 */

export const PONTOS_FORTES = [
  { id: 'pontual', rotulo: 'Pontual' },
  { id: 'cuidadosa', rotulo: 'Cuidadosa com as crianças' },
  { id: 'paciente', rotulo: 'Paciente' },
  { id: 'organizada', rotulo: 'Organizada' },
  { id: 'gentil', rotulo: 'Gentil com as famílias' },
];
export const MAX_PONTOS = 3;
export const MAX_FRASE = 80;
export const MIN_DIAS_PARA_RECOMENDAR = 30;
export const MIN_AUXILIARES_PARA_MEDIA = 3;

export function rotuloDoPonto(id) {
  return PONTOS_FORTES.find((p) => p.id === id)?.rotulo || null;
}

/** Os pontos na ordem da lista, só os conhecidos. */
export function pontosEmOrdem(ids) {
  const lista = Array.isArray(ids) ? ids : [];
  return PONTOS_FORTES.filter((p) => lista.includes(p.id));
}

/**
 * O toque num ponto: marca ou desmarca. O 4º não marca — `cheio` diz à tela
 * para avisar "Até 3".
 */
export function alternarPonto(marcados, id) {
  const lista = Array.isArray(marcados) ? marcados : [];
  if (lista.includes(id)) return { pontos: lista.filter((p) => p !== id), cheio: false };
  if (lista.length >= MAX_PONTOS) return { pontos: lista, cheio: true };
  return { pontos: [...lista, id], cheio: false };
}

export function podeRecomendar(dias) {
  return Number(dias) >= MIN_DIAS_PARA_RECOMENDAR;
}

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || 'ela';
}

/**
 * O estado da recomendação na tela DO TIO: a frase e o tom. Âmbar só para o
 * que espera alguém (pendente); verde para a aprovada; cinza para a oculta.
 */
export function estadoParaOTio(recomendacao, nomeDela) {
  const n = primeiroNome(nomeDela);
  if (!recomendacao) return null;
  if (recomendacao.estado === 'aprovada') return { texto: 'Aprovada', tom: 'verde' };
  if (recomendacao.estado === 'oculta') return { texto: `${n} preferiu não mostrar`, tom: 'cinza' };
  return { texto: `Esperando ${n} aprovar`, tom: 'ambar' };
}

/** A linha da nota no topo da tela dele. Nunca uma nota sozinha, nunca um nome. */
export function textoDaNota(resumo) {
  if (!resumo) return null;
  if (resumo.media != null) {
    return `Nota das suas auxiliares: ${Number(resumo.media).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  }
  const r = Math.max(0, Number(resumo.respostas) || 0);
  return `${r} de ${MIN_AUXILIARES_PARA_MEDIA} responderam — a média aparece com ${MIN_AUXILIARES_PARA_MEDIA}.`;
}
