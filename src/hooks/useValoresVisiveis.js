import { useCallback, useState } from 'react';

/**
 * O OLHO DO CAIXA (03/10/2026) — mostra ou esconde os valores ("••••").
 *
 * É preferência do APARELHO, não da conta: quem esconde é quem abre o caixa
 * com gente do lado, e isso é do celular dele, não do outro onde ele também
 * entra. Por isso mora no `localStorage`, e sempre dentro de try/catch — em
 * janela anônima ou com dado do site bloqueado ele lança, e o caixa abre com
 * os valores à vista, que é o padrão.
 */
const CHAVE = 'alobuzinou:financeiro:valores-escondidos';

function lerEscondidos() {
  try {
    return window.localStorage.getItem(CHAVE) === '1';
  } catch {
    return false;
  }
}

export function useValoresVisiveis() {
  const [escondidos, setEscondidos] = useState(lerEscondidos);

  const alternar = useCallback(() => {
    setEscondidos((atual) => {
      const novo = !atual;
      try {
        window.localStorage.setItem(CHAVE, novo ? '1' : '0');
      } catch {
        // Sem armazenamento a escolha vale só até fechar a tela.
      }
      return novo;
    });
  }, []);

  return { visiveis: !escondidos, alternar };
}

/** O texto que fica no lugar de um valor escondido. */
export const VALOR_ESCONDIDO = '••••';
