/**
 * Intervalos de dias — a parte PURA do aviso de "sem aula".
 *
 * Mora fora de `broadcastService` porque aquele arquivo importa o Firestore e
 * esta é a lógica que precisa de teste: um erro aqui gera ausência no dia
 * errado, e o pai descobre isso com a criança esperando na porta.
 */

/** Teto de dias por aviso. Protege contra o dedo escorregando no ano. */
export const MAX_DIAS = 31;

export function parseDia(chave) {
  const partes = String(chave || '').split('-');
  if (partes.length !== 3) return null;
  const [y, m, d] = partes.map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  // Rejeita data que "rolou" — '2026-02-31' vira 3 de março no construtor do
  // Date, e um aviso pra um dia que não existe é pior que um aviso recusado.
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return dt;
}

export function chaveDoDia(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Os dias ÚTEIS entre duas datas, inclusive.
 *
 * Sábado e domingo ficam de fora: a perua não roda, então uma ausência nesses
 * dias é um documento que ninguém lê e um dia a mais no texto do aviso —
 * dizendo ao responsável que não tem aula num dia em que ele já sabia.
 *
 * Devolve lista vazia (nunca lança) pra data inválida ou intervalo invertido:
 * quem chama precisa desabilitar o botão, não tratar exceção.
 */
export function diasUteis(de, ate) {
  const inicio = parseDia(de);
  const fim = parseDia(ate || de);
  if (!inicio || !fim || fim < inicio) return [];

  const dias = [];
  const cursor = new Date(inicio);
  while (cursor <= fim && dias.length < MAX_DIAS) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) dias.push(chaveDoDia(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

export function rotuloDoDia(chave) {
  const d = parseDia(chave);
  if (!d) return String(chave || '');
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(d);
}

/** "24/08", "24/08 e 25/08", "de 24/08 a 28/08". */
export function rotuloDoPeriodo(dias) {
  if (!dias?.length) return '';
  if (dias.length === 1) return rotuloDoDia(dias[0]);
  if (dias.length === 2) return `${rotuloDoDia(dias[0])} e ${rotuloDoDia(dias[1])}`;
  return `de ${rotuloDoDia(dias[0])} a ${rotuloDoDia(dias[dias.length - 1])}`;
}
