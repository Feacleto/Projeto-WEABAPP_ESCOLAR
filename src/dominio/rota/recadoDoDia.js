/**
 * O RECADO DO DIA DA FAMÍLIA (05/10/2026, decisão do dono) — régua pura.
 *
 * A família escreve um recado CURTO para o tio, sobre AQUELE dia ("Hoje ele
 * sai mais cedo, às 11h"), no mesmo lugar onde avisa a falta ou quem busca.
 * O tio lê em âmbar no topo da ficha rápida da rota. A auxiliar NÃO lê.
 *
 * `recadosDoDia/{AAAA-MM-DD}_{childId}` = { childId, parentUid, adminUid,
 * dateKey, texto, criadoEm, atualizadoEm }. O id leva o dia: um recado por
 * criança por dia, e o de ontem não vira o de hoje.
 *
 * ── ⚠️ 1 A 140 LETRAS, E SÓ ESPAÇO NÃO É RECADO
 * Curto porque é lido no portão, de relance. A rule confere o mesmo teto
 * (`size() <= 140`); aqui o texto é limpo ANTES de gravar (espaços repetidos
 * viram um), para a conta da tela e a da rule serem a mesma.
 *
 * ── ⚠️ SAÚDE NÃO É RECADO
 * O recado é texto livre e pode trazer dado de saúde. O caminho com
 * consentimento é a ficha da criança (`SaudeDaCrianca`); a tela diz isso
 * embaixo do campo (pedido do jurídico).
 *
 * ── DURA 7 DIAS (decisão do dono)
 * `apagarViagensAntigas` apaga os mais velhos na mesma noite
 * (`functions/lib/reguaDoRecadoDoDia.js`, a cópia do prazo no servidor).
 *
 * Pura, sem import: roda no Node.
 */

export const RECADO_MAXIMO = 140;
export const DIAS_DO_RECADO = 7;

/** O id do documento: o dia e a criança. */
export function idDoRecado(dateKey, childId) {
  return `${dateKey}_${childId}`;
}

/**
 * O texto pronto para gravar, ou o erro com a frase da tela.
 * `{ ok: true, texto }` | `{ ok: false, erro }`.
 */
export function textoDoRecado(bruto) {
  const texto = String(bruto ?? '').replace(/\s+/g, ' ').trim();
  if (!texto) return { ok: false, erro: 'Escreva o recado.' };
  if (texto.length > RECADO_MAXIMO) {
    return { ok: false, erro: `O recado tem até ${RECADO_MAXIMO} letras.` };
  }
  return { ok: true, texto };
}

/** Quantas letras ainda cabem (para a contagem embaixo do campo). */
export function letrasQueSobram(bruto) {
  return RECADO_MAXIMO - String(bruto ?? '').replace(/\s+/g, ' ').trim().length;
}

/**
 * O texto que a ficha do tio mostra: só o recado DAQUELE dia, e só se tiver
 * texto. O de outro dia (cache, tela aberta de ontem) não aparece.
 */
export function recadoDoDiaParaMostrar(recado, hoje) {
  if (!recado || recado.dateKey !== hoje) return '';
  return String(recado.texto || '').trim();
}
