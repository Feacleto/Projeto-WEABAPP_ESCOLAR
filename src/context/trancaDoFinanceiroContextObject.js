import { createContext } from 'react';

/**
 * O objeto de contexto da tranca do Financeiro, sozinho num arquivo — pelo
 * mesmo motivo do `notificacoesContextObject.js`: arquivo que exporta
 * componente E outra coisa quebra o Fast Refresh.
 */
export const TrancaDoFinanceiroContext = createContext(null);
