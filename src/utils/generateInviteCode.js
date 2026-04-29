// Gera código de convite no formato "TN" + 4 dígitos (ex: TN4582).
// IMPORTANTE: chance de colisão é 1/9000. O caller (childrenService)
// deve verificar unicidade no Firestore e regerar se necessário.
export function generateInviteCode() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `TN${digits}`;
}
