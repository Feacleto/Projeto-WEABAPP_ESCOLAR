/**
 * Lógica de aniversariantes do dia. O campo `birthDate` é uma string
 * "YYYY-MM-DD" salva no doc da criança. Comparamos só mês + dia (o ano
 * é puramente informativo).
 *
 * Helpers expostos:
 *   - getTodaysBirthdayChildren(children) — lista de aniversariantes hoje
 *   - isBirthdayToday(birthDate)          — bool helper isolado
 *   - shouldShowBirthdayModal()           — controle 1x/dia via localStorage
 *   - markBirthdayModalShown()            — registra que já mostrou hoje
 */

const STORAGE_KEY = 'tn_birthday_shown_date';

/**
 * Aceita "YYYY-MM-DD" ou objeto Date.
 * Retorna { month, day } ou null se inválido.
 */
function parseBirth(birthDate) {
  if (!birthDate) return null;
  if (birthDate instanceof Date) {
    if (isNaN(birthDate)) return null;
    return { month: birthDate.getMonth() + 1, day: birthDate.getDate() };
  }
  const m = String(birthDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { month: Number(m[2]), day: Number(m[3]) };
}

export function isBirthdayToday(birthDate, today = new Date()) {
  const b = parseBirth(birthDate);
  if (!b) return false;
  return b.month === today.getMonth() + 1 && b.day === today.getDate();
}

/**
 * Filtra a lista de crianças retornando só as que fazem aniversário hoje.
 * Ignora crianças sem birthDate. Use no painel do Tio (lista de filhos).
 */
export function getTodaysBirthdayChildren(children, today = new Date()) {
  if (!Array.isArray(children)) return [];
  return children.filter((c) => isBirthdayToday(c.birthDate, today));
}

/**
 * Devolve true se o modal de aniversário ainda não foi exibido hoje.
 * Controle por localStorage com a chave de data ISO (YYYY-MM-DD).
 */
export function shouldShowBirthdayModal(today = new Date()) {
  try {
    const key = isoDate(today);
    const last = localStorage.getItem(STORAGE_KEY);
    return last !== key;
  } catch {
    return true;
  }
}

export function markBirthdayModalShown(today = new Date()) {
  try {
    localStorage.setItem(STORAGE_KEY, isoDate(today));
  } catch {
    // ignore
  }
}

function isoDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
