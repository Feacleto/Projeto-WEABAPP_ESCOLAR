import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { criarSalvadorPorCampo } from '../compartilhado/salvarPorCampo.js';
import { salvarCampoDaLista, somDeSalvo } from '../services/listaDaTurmaService';

/**
 * O SALVADOR DA LISTA DA TURMA — UM SÓ, NA TELA (achado M4 da auditoria).
 *
 * O estado de "salvo" morava dentro de cada linha e se perdia quando ela
 * fechava ou pulava de grupo. Agora ele mora em `TioChildren`, por criança e
 * por campo (`<id>:<campo>`), com versão por campo: a resposta atrasada de
 * uma escrita velha não acende "salvo ✓" por cima de uma mais nova ainda
 * pendente. A máquina é pura (`compartilhado/salvarPorCampo.js`); aqui só se
 * liga ao React e ao som (um por rajada).
 */
export function useSalvadorDaLista() {
  const [salvador] = useState(() => criarSalvadorPorCampo({ aoTerminarRajada: somDeSalvo }));
  useSyncExternalStore(salvador.assinar, salvador.instantaneo);
  return salvador;
}

/**
 * Os campos de UMA criança no salvador da tela.
 *
 * A escrita usa a criança mais nova (a escuta ao vivo, guardada na ref) no
 * instante em que SAI — o "Tentar de novo" reenvia a mesma mudança sobre a
 * criança de agora, e o fim do `cadastroRapido` é decidido com o que o banco
 * já tem. `executar` troca o caminho da escrita (a mensalidade passa pelo
 * contrato quando há versão esperando aceite).
 *
 * `mexeu` diz se esta abertura da linha gravou algo: só então a versão do
 * contrato esperando aceite é conferida ao fechar.
 */
export function useSalvarNaLista(crianca, salvador) {
  const atual = useRef(crianca);
  const mexeu = useRef(null);
  useEffect(() => {
    atual.current = crianca;
  });
  const id = crianca?.id;

  const salvar = useCallback(
    (campo, mudanca, { executar = null, digitado } = {}) => {
      mexeu.current = { ...(mexeu.current || {}), ...mudanca };
      const escrever = async () => {
        try {
          await (executar ? executar(atual.current) : salvarCampoDaLista(atual.current, mudanca));
        } catch (err) {
          // Sem dado de criança no console: só o código do erro.
          console.error('[lista da turma] não salvou:', err?.code || 'erro');
          throw err;
        }
        // O próximo campo salvo antes de a escuta trazer este já o conhece.
        atual.current = { ...atual.current, ...mudanca };
      };
      return salvador.salvar(`${id}:${campo}`, escrever, { mudanca, digitado });
    },
    [id, salvador]
  );

  const estado = useCallback((campo) => salvador.ler(`${id}:${campo}`), [id, salvador]);
  const tentarDeNovo = useCallback((campo) => salvador.tentarDeNovo(`${id}:${campo}`), [id, salvador]);

  return { estado, salvar, tentarDeNovo, atual, mexeu };
}
