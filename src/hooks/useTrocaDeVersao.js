import { useCallback, useEffect, useState } from 'react';
import {
  buscarVersaoNova,
  ouvirEtapaDaTroca,
  trocarDeVersao,
} from '../services/versaoService';

/**
 * A troca de versão como a tela precisa dela (03/10/2026): a versão que está
 * chegando (`{ versao, data, commit, hash }`, ou null), a etapa em curso e o
 * gesto de atualizar. Os dois lugares
 * que trocam de versão — o aviso (AtualizacaoDisponivel) e a tela de erro de
 * versão (ErrorScreen) — usam este mesmo hook, para dizerem a mesma coisa.
 *
 * `buscar` liga a consulta do número: só vale perguntar quando há versão
 * nova de fato, senão é um pedido a cada abertura do app sem nada a mostrar.
 */
export function useTrocaDeVersao({ buscar = true } = {}) {
  const [versaoNova, setVersaoNova] = useState(null);
  const [etapa, setEtapa] = useState(null);

  useEffect(() => {
    if (!buscar) return undefined;
    let vivo = true;
    buscarVersaoNova().then((v) => {
      if (vivo) setVersaoNova(v);
    });
    return () => {
      vivo = false;
    };
  }, [buscar]);

  useEffect(() => ouvirEtapaDaTroca(setEtapa), []);

  const atualizar = useCallback(() => {
    setEtapa('procurando');
    trocarDeVersao();
  }, []);

  return { versaoNova, etapa, atualizar };
}
