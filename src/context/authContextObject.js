import { createContext } from 'react';

/**
 * O objeto de contexto, sozinho num arquivo só.
 *
 * Ele morava em `AuthContext.jsx`, ao lado do `AuthProvider`. Funciona — e
 * quebra o Fast Refresh: um arquivo que exporta componente E outra coisa faz o
 * refresh remontar a árvore inteira a cada salvamento, em vez de trocar só o
 * componente. Na prática, mexer no provider derruba a sessão de quem está
 * desenvolvendo e obriga a logar de novo a cada edição.
 *
 * Separar é a correção que o próprio lint sugere, e custa um arquivo de três
 * linhas.
 */
export const AuthContext = createContext(null);
