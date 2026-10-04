import { useEffect, useRef } from 'react';

/**
 * O VOLTAR DO CELULAR FECHA A FOLHA (03/10/2026, pedido do dono).
 *
 * Folha (a ficha da criança, o combinado, uma confirmação) não troca de
 * endereço — então o voltar do Android, que é o botão que o público de 40+
 * MAIS usa, passava por cima dela e tirava a pessoa da tela inteira. Era o
 * voltar fazendo o contrário do que ela queria.
 *
 * Ao abrir, a folha empilha uma entrada no histórico (mesmo endereço, com
 * uma marca dela). O voltar consome essa entrada e a folha fecha. Fechada
 * pelo X, pelo "Voltar" ou por um botão, ela mesma desfaz a entrada — mas só
 * se a entrada do topo ainda for a dela: se a folha levou para outra tela
 * (navegação por dentro), desfazer ali seria desfazer a navegação.
 *
 * Folha dentro de folha funciona: cada uma tem a sua marca, e o voltar fecha
 * só a de cima.
 */
let contador = 0;

export function useVoltarFechaFolha(aberta, fechar) {
  const fecharRef = useRef(fechar);
  useEffect(() => {
    fecharRef.current = fechar;
  });

  useEffect(() => {
    if (!aberta || typeof window === 'undefined') return undefined;
    contador += 1;
    const marca = `folha-${contador}`;
    window.history.pushState({ ...(window.history.state || {}), folha: marca }, '');
    let fechouPeloVoltar = false;

    const aoVoltar = () => {
      if (window.history.state?.folha === marca) return; // voltou para ela mesma
      fechouPeloVoltar = true;
      fecharRef.current?.();
    };
    window.addEventListener('popstate', aoVoltar);

    return () => {
      window.removeEventListener('popstate', aoVoltar);
      if (!fechouPeloVoltar && window.history.state?.folha === marca) window.history.back();
    };
  }, [aberta]);
}
