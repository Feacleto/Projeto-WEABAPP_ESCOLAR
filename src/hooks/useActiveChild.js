import { useAuth } from './useAuth';
import { useChild } from './useChild';

/**
 * A criança atualmente em foco no painel do responsável.
 *
 * Substitui os nove `useChild(profile?.childId)` espalhados pelo lado do
 * pai. Quem decide qual filho está ativo é o AuthContext — assim o seletor
 * de filho troca a tela inteira mudando um único valor.
 *
 * Retorna { child, loading, error, childIds, activeChildId, setActiveChildId,
 *           hasMultiple }.
 */
export function useActiveChild() {
  const { childIds, activeChildId, setActiveChildId } = useAuth();
  const { child, loading, error } = useChild(activeChildId);

  return {
    child,
    loading,
    error,
    childIds,
    activeChildId,
    setActiveChildId,
    hasMultiple: childIds.length > 1,
  };
}
