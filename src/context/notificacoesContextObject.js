import { createContext } from 'react';

/**
 * O objeto de contexto do sino, sozinho num arquivo — pelo mesmo motivo do
 * `authContextObject.js`: arquivo que exporta componente E outra coisa quebra
 * o Fast Refresh.
 */
export const NotificacoesContext = createContext(null);
