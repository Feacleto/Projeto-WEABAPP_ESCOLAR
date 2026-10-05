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
 *
 * ⚠️ A MONTAGEM DUPLA DO STRICTMODE FECHAVA A FOLHA NA HORA (05/10/2026, R4).
 * No `npm run dev` o efeito monta, limpa e monta de novo. A limpeza chamava
 * `history.back()` na hora, a segunda montagem empilhava outra marca, e o
 * `back()` — que é assíncrono — chegava DEPOIS e caía no `popstate` da marca
 * nova: a folha fechava no mesmo instante. A ficha da criança e a "Abasteci"
 * não abriam no dev. Agora a limpeza só AGENDA o desfazer, e uma montagem
 * logo em seguida com a folha ainda aberta o cancela e reaproveita a marca
 * que ficou no topo. Em produção (uma montagem só) nada muda: fechar a folha
 * desfaz a entrada um instante depois, em vez de no mesmo instante.
 */
let contador = 0;

export function useVoltarFechaFolha(aberta, fechar) {
  const fecharRef = useRef(fechar);
  // A marca e o desfazer agendado sobrevivem à montagem dupla (refs não são
  // recriadas entre a limpeza e a segunda montagem do StrictMode).
  const marcaRef = useRef(null);
  const desfazerRef = useRef(null);
  useEffect(() => {
    fecharRef.current = fechar;
  });

  useEffect(() => {
    if (!aberta || typeof window === 'undefined') return undefined;

    // Montou de novo logo depois de limpar: o desfazer ainda não rodou, e a
    // entrada dela continua no topo. Cancela e reaproveita — empilhar outra
    // deixaria duas entradas para um voltar só.
    if (desfazerRef.current) {
      clearTimeout(desfazerRef.current);
      desfazerRef.current = null;
    }
    if (!marcaRef.current || window.history.state?.folha !== marcaRef.current) {
      contador += 1;
      marcaRef.current = `folha-${contador}`;
      window.history.pushState({ ...(window.history.state || {}), folha: marcaRef.current }, '');
    }
    const marca = marcaRef.current;
    let fechouPeloVoltar = false;

    const aoVoltar = () => {
      if (window.history.state?.folha === marca) return; // voltou para ela mesma
      fechouPeloVoltar = true;
      marcaRef.current = null;
      fecharRef.current?.();
    };
    window.addEventListener('popstate', aoVoltar);

    return () => {
      window.removeEventListener('popstate', aoVoltar);
      if (fechouPeloVoltar) return;
      // Agendado, não imediato: se for a montagem dupla, a próxima montagem
      // cancela. Só desfaz se o topo ainda for dela — se a folha levou a
      // outra tela, desfazer ali seria desfazer a navegação.
      desfazerRef.current = setTimeout(() => {
        desfazerRef.current = null;
        if (window.history.state?.folha === marca) {
          marcaRef.current = null;
          window.history.back();
        }
      }, 0);
    };
  }, [aberta]);
}
