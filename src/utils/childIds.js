/**
 * Lê a lista de filhos de um perfil de responsável.
 *
 * Existe por causa da migração: contas criadas antes da Fase 2 têm o campo
 * antigo `childId` (string, um filho só); as novas têm `childIds` (array).
 * A Cloud Function `redeemInvite` grava os dois, mas contas antigas nunca
 * receberam o array — então ler sempre por aqui evita que um pai cadastrado
 * antes da mudança perca o acesso ao filho.
 *
 * Retorna sempre um array (possivelmente vazio), sem duplicatas.
 */
export function getChildIds(profile) {
  if (!profile) return [];
  const list = Array.isArray(profile.childIds) ? profile.childIds : [];
  const legacy = profile.childId;
  const all = legacy && !list.includes(legacy) ? [...list, legacy] : list;
  return all.filter(Boolean);
}

/**
 * Resolve qual filho deve estar ativo.
 * Se o salvo não pertence mais à conta (filho removido pelo tio), cai no
 * primeiro da lista em vez de deixar a tela vazia.
 */
export function resolveActiveChildId(profile, savedId) {
  const ids = getChildIds(profile);
  if (!ids.length) return null;
  return savedId && ids.includes(savedId) ? savedId : ids[0];
}
