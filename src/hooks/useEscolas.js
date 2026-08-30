import { useEffect, useMemo, useState } from 'react';
import { watchEscolas, porId } from '../services/escolasService';
import { useAuth } from './useAuth';

/**
 * As escolas DESTE motorista, com live updates.
 *
 * O uid vem daqui e não de quem chama, pelo mesmo motivo do `useChildren`:
 * esquecer de passar o escopo não dá erro de compilação, dá lista vazia — que
 * na tela de cadastro se confunde com "ainda não cadastrei nenhuma escola" e
 * faz o motorista cadastrar a mesma escola de novo.
 *
 * Devolve `mapa` junto porque `utils/horarios` consome { id: escola }.
 */
export function useEscolas() {
  const { user } = useAuth();
  const [escolas, setEscolas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Sem `setLoading(true)` aqui de propósito. Chamar setState no corpo do
    // efeito dispara render em cascata (react-hooks/set-state-in-effect), e
    // não é necessário: `loading` já nasce true e só vira false quando o
    // primeiro snapshot chega. O uid só muda em login/logout, que remonta a
    // árvore inteira.
    const unsub = watchEscolas(
      user?.uid,
      (list) => {
        setEscolas(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [user?.uid]);

  const mapa = useMemo(() => porId(escolas), [escolas]);

  return { escolas, mapa, loading, error };
}
