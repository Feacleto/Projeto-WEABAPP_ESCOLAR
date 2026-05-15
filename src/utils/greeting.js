/**
 * Saudação dinâmica baseada nos horários definidos pelo Tio no Profile.
 *
 * Cada user da operação (Tio + Pais) vê a saudação com os mesmos horários,
 * lidos de `users/{adminUid}.greetingHours = { morning, afternoon, evening }`.
 *
 * Default seguro: 5h–12h bom dia · 12h–18h boa tarde · 18h–5h boa noite.
 */

export const DEFAULT_GREETING_HOURS = {
  morning: 5,
  afternoon: 12,
  evening: 18,
};

/**
 * Retorna a saudação adequada pra hora atual.
 *
 * @param {Date} date — data/hora atual (default: now)
 * @param {object|null} hours — { morning, afternoon, evening } com horas inteiras 0-23
 */
export function greet(date = new Date(), hours = null) {
  const h = sanitizeHours(hours);
  const hour = date.getHours();
  if (hour >= h.morning && hour < h.afternoon) return 'Bom dia';
  if (hour >= h.afternoon && hour < h.evening) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Garante que os horários estão dentro de 0-23 e na ordem certa.
 * Cai pros defaults se vier algo bagunçado.
 */
export function sanitizeHours(hours) {
  if (!hours) return DEFAULT_GREETING_HOURS;
  const m = clamp(Number(hours.morning), 0, 23);
  const a = clamp(Number(hours.afternoon), 0, 23);
  const e = clamp(Number(hours.evening), 0, 23);
  if (!(m < a && a < e)) return DEFAULT_GREETING_HOURS;
  return { morning: m, afternoon: a, evening: e };
}

function clamp(n, min, max) {
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, min), max);
}
