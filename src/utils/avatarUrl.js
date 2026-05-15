/**
 * Gera URL de avatar automático via DiceBear (CDN público gratuito, sem chave).
 *
 * Usado como fallback quando o usuário não fez upload de foto:
 *   - Crianças: estilos cartoon ilustrativos, diferenciados por gênero.
 *   - Adultos:  estilo "initials" mostrando inicial do nome.
 *
 * A seed (estável) garante que o mesmo usuário/criança sempre mostre o
 * mesmo avatar — sem isso, cada render geraria um avatar diferente.
 */

const DICEBEAR = 'https://api.dicebear.com/9.x';

// Cores de fundo por gênero pros avatares de criança
const BG_BOY = 'b6e3f4,c0aede,d1d4f9';
const BG_GIRL = 'ffd5dc,ffdfbf,c0aede';
const BG_NEUTRAL = 'c0aede,ffd5dc,b6e3f4';

/**
 * Avatar de criança baseado em gênero + seed estável (childId).
 * Usa o estilo "adventurer" — desenho infantil e amigável.
 */
export function childAvatarUrl({ id, gender }) {
  const seed = encodeURIComponent(String(id || 'unknown'));
  // adventurer suporta gender via seed prefixada — duas seeds diferentes
  // produzem avatares visualmente distintos.
  const prefix = gender === 'female' ? 'girl-' : gender === 'male' ? 'boy-' : '';
  const bg =
    gender === 'female' ? BG_GIRL : gender === 'male' ? BG_BOY : BG_NEUTRAL;
  return `${DICEBEAR}/adventurer/svg?seed=${prefix}${seed}&backgroundColor=${bg}&radius=50`;
}

/**
 * Avatar de adulto. Usa estilo "initials" — mostra inicial do nome.
 * Mais sóbrio que o cartoon das crianças.
 */
export function adultAvatarUrl({ name, seed }) {
  const value = encodeURIComponent(name || seed || 'user');
  return `${DICEBEAR}/initials/svg?seed=${value}&backgroundColor=1F5F3F&textColor=ffffff&radius=50`;
}
