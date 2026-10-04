import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * TODA TELA NOVA ABRE NO TOPO (03/10/2026, pedido do dono).
 *
 * O `BrowserRouter` não mexe na rolagem: a tela nova herdava a posição da
 * anterior. Quem tocava num item no fim de uma lista abria a próxima tela
 * pelo MEIO ou pelo fim — sem o título, sem o "voltar" à vista — e se
 * perdia. Para quem tem quarenta anos, abrir uma tela é começar do começo.
 *
 * Vale também para o VOLTAR (o navegador tentaria devolver a posição antiga,
 * e é por isso que a restauração automática dele fica desligada): voltar
 * para o meio de uma lista confunde do mesmo jeito.
 *
 * Só o CAMINHO conta. Folha, diálogo e aviso não trocam de endereço, e a
 * tela de baixo continua onde estava quando eles fecham.
 */
export default function TelaNovaNoTopo() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
