import { useEffect, useMemo, useState } from 'react';
import { watchFaturasDoParceiro } from '../services/taxaService';

/**
 * A fatura da PLATAFORMA que o motorista tem em aberto — a mais antiga.
 *
 * A MAIS ANTIGA, E NÃO A DO MÊS
 * Quem está devendo três meses precisa ver o primeiro, não o último: é o mais
 * velho que puxa a suspensão, e é ele que some da tela se o aviso mostrar o
 * mês corrente. Mostrar o recente também faria o valor PARECER menor do que a
 * dívida real, o que é pior que não avisar.
 *
 * O ESTADO CARREGA A CHAVE, como em `useAdminProfile`.
 * Sem isso, trocar de conta mostraria a dívida da conta anterior no intervalo
 * entre a assinatura nova e o primeiro resultado dela — e aqui o que aparece
 * nesse intervalo é uma acusação de calote.
 *
 * ERRO DE LEITURA DEVOLVE "NADA EM ABERTO", DE PROPÓSITO
 * O consumidor deste hook é um aviso de cobrança sobre o app inteiro. Falha de
 * rede virando cartão de dívida seria acusar quem só está no elevador — e o
 * aviso volta sozinho na próxima leitura que der certo. O que de fato impede o
 * trabalho é `suspenso` nas rules, que não depende daqui.
 */
export function useFaturaPlataforma(uid) {
  const [snap, setSnap] = useState({ chave: null, lista: [] });

  useEffect(() => {
    if (!uid) return undefined;
    return watchFaturasDoParceiro(
      uid,
      (lista) => setSnap({ chave: uid, lista }),
      () => setSnap({ chave: uid, lista: [] })
    );
  }, [uid]);

  const naChave = !!uid && snap.chave === uid;

  const emAberto = useMemo(
    () => (naChave ? snap.lista.filter((f) => f.status !== 'quitada') : []),
    [naChave, snap.lista]
  );

  return {
    // `watchFaturasDoParceiro` devolve em ordem decrescente de mês, então a
    // mais antiga em aberto é a última da lista filtrada.
    fatura: emAberto.length ? emAberto[emAberto.length - 1] : null,
    emAberto: emAberto.length,
    carregando: uid ? !naChave : false,
  };
}
