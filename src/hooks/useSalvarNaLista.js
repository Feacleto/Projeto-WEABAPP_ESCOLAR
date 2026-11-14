import { useCallback, useEffect, useRef, useState } from 'react';
import { salvarCampoDaLista } from '../services/listaDaTurmaService';

/**
 * O ESTADO DE "SALVO" DE CADA CAMPO DE UMA LINHA DA LISTA DA TURMA.
 *
 * Três estados por campo, e o "salvo ✓" é o último a acender:
 *   'salvando' — a escrita saiu e o servidor ainda não respondeu;
 *   'salvo'    — o servidor confirmou (a promessa do `updateDoc` resolveu);
 *   { erro }   — não foi; a linha mostra "Não salvou." e "Tentar de novo",
 *                que reenvia a MESMA mudança.
 *
 * A criança vem por `crianca` a cada render (a escuta ao vivo da lista); a
 * escrita usa a versão mais nova, guardada na ref, para que o fim do
 * `cadastroRapido` seja decidido com o que o banco já tem.
 */
export function useSalvarNaLista(crianca) {
  const [estado, setEstado] = useState({});
  const atual = useRef(crianca);
  useEffect(() => {
    atual.current = crianca;
  });

  const salvar = useCallback(async (campo, mudanca) => {
    setEstado((p) => ({ ...p, [campo]: 'salvando' }));
    try {
      await salvarCampoDaLista(atual.current, mudanca);
      // O próximo campo salvo antes de a escuta trazer este já o conhece.
      atual.current = { ...atual.current, ...mudanca };
      setEstado((p) => ({ ...p, [campo]: 'salvo' }));
      return true;
    } catch (err) {
      // Sem dado de criança no console: só o código do erro.
      console.error('[lista da turma] não salvou:', err?.code || 'erro');
      setEstado((p) => ({ ...p, [campo]: { erro: true, mudanca } }));
      return false;
    }
  }, []);

  const tentarDeNovo = useCallback(
    (campo) => {
      const e = estado[campo];
      if (e && e.erro) return salvar(campo, e.mudanca);
      return Promise.resolve(false);
    },
    [estado, salvar]
  );

  return { estado, salvar, tentarDeNovo };
}
