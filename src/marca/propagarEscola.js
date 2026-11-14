/**
 * OS TEXTOS DE "CORRIGIR O ENDEREÇO DA ESCOLA CHEGA ÀS CRIANÇAS" (RC2,
 * 14/11/2026) — a regra está em `dominio/escola/propagarEscola.js`, a tela em
 * `pages/tio/TioEscolas.jsx`. Puro, sem React (`npm run testar:propagar-escola`).
 *
 * ── A REGRA, IGUAL À DE `valorDoConvite.js`
 * Cada frase carrega `sustenta` (a funcionalidade que a faz verdade HOJE) e,
 * quando depende de algo, `condicao`. O teste mantém a lista fechada e aponta o
 * arquivo onde cada uma existe.
 *
 * ── O QUE A PERGUNTA DIZ
 * Diz o que ACONTECE: muda o ponto de rota daquelas crianças. Nada de "a
 * família será avisada" — ela não é: o aviso não existe e prometê-lo seria
 * mentira. Sem número solto além de N, sem prazo, sem exclamação.
 */

/** A chave de cada afirmação e a prova (no teste). */
export const SUSTENTA = {
  // A rota, o mapa da família e o contrato leem a cópia que a criança guarda.
  copia: 'copia-da-escola-na-crianca',
};
export const CONDICAO = {
  // Só se grava endereço com ponto: sem o ponto novo as crianças ficam como estavam.
  ponto: 'ponto-da-escola-achado',
};

export const APLICAR = 'Aplicar';
export const SO_A_ESCOLA = 'Só a escola';

const criancas = (n) => (n === 1 ? '1 criança' : `${n} crianças`);

/** A pergunta. N é o número de crianças que mudam, nunca o total da escola. */
export function tituloDoResumo(n) {
  return `Isto muda o ponto de rota de ${criancas(n)}. Aplicar?`;
}

/**
 * Quem muda, pelo primeiro nome (é como ele os chama no portão). Até cinco
 * nomes; de seis em diante, "e mais N" — a lista inteira numa caixa de
 * confirmação seria uma tela a rolar.
 */
export function nomesDoResumo(nomes) {
  const lista = (Array.isArray(nomes) ? nomes : []).map((n) => String(n || '').trim()).filter(Boolean);
  if (!lista.length) return '';
  const verbo = lista.length === 1 ? 'passa' : 'passam';
  if (lista.length === 1) return `${lista[0]} ${verbo} a descer neste endereço.`;
  if (lista.length <= 5) {
    const ate = lista.slice(0, -1).join(', ');
    return `${ate} e ${lista[lista.length - 1]} ${verbo} a descer neste endereço.`;
  }
  const primeiros = lista.slice(0, 4).join(', ');
  return `${primeiros} e mais ${lista.length - 4} ${verbo} a descer neste endereço.`;
}

/** Depois de aplicar. */
export function aplicado(n) {
  return n === 1 ? 'A criança desce no endereço novo.' : `As ${n} crianças descem no endereço novo.`;
}

/** Quando ele escolhe deixar as crianças como estão. */
export const SO_A_ESCOLA_MUDOU = 'Só a escola mudou. As crianças continuam com o endereço antigo.';

/** Quando o endereço não foi achado no mapa: nada é gravado nas crianças. */
export const SEM_PONTO =
  'Não achamos o endereço no mapa. As crianças continuam com o endereço antigo.';

/** Quando a gravação falhou no meio (cada lote é tudo ou nada, o conjunto não é). */
export function aplicadoPelaMetade(feitas, total) {
  return `Só ${feitas} de ${total} crianças foram atualizadas. Toque em Aplicar de novo.`;
}

/** Todas as afirmações, com a origem, para o teste varrer. */
export function todasAsAfirmacoes() {
  const nomes = ['Ana', 'Pedro', 'Lívia', 'Caio', 'Davi'];
  return [
    { id: 'titulo', texto: tituloDoResumo(5), sustenta: SUSTENTA.copia },
    { id: 'tituloUma', texto: tituloDoResumo(1), sustenta: SUSTENTA.copia },
    { id: 'nomes', texto: nomesDoResumo(nomes), sustenta: SUSTENTA.copia },
    { id: 'nomesUm', texto: nomesDoResumo(['Ana']), sustenta: SUSTENTA.copia },
    { id: 'nomesMuitos', texto: nomesDoResumo([...nomes, 'Bia', 'Theo', 'Nina']), sustenta: SUSTENTA.copia },
    { id: 'aplicado', texto: aplicado(5), sustenta: SUSTENTA.copia },
    { id: 'aplicadoUma', texto: aplicado(1), sustenta: SUSTENTA.copia },
    { id: 'soAEscola', texto: SO_A_ESCOLA_MUDOU, sustenta: SUSTENTA.copia },
    { id: 'semPonto', texto: SEM_PONTO, sustenta: SUSTENTA.copia, condicao: CONDICAO.ponto },
    { id: 'pelaMetade', texto: aplicadoPelaMetade(15, 30), sustenta: SUSTENTA.copia },
  ];
}
