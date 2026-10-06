import { createContext, useContext } from 'react';

/**
 * A FOLHA DA MARCA, para o cabeçalho (05/10/2026). O layout do tio e o da
 * auxiliar montam a folha e entregam por aqui `abrir` e a marca a mostrar; o
 * `Header` só torna o logo tocável quando recebe isto.
 *
 * Mora fora do componente pelo mesmo motivo do `notificacoesContextObject.js`
 * (arquivo que exporta componente e outra coisa quebra o Fast Refresh). E a
 * folha mora no LAYOUT, não no Header: a tela anima com `transform`, e o
 * `fixed` dentro dela deixaria de ser relativo à janela.
 *
 * Fora dos dois layouts (a família, o dono, as telas públicas) o valor é
 * `null` — e o logo continua sendo só um logo.
 */
export const FolhaDaMarcaContext = createContext(null);

export function useFolhaDaMarca() {
  return useContext(FolhaDaMarcaContext);
}
