import { useEffect, useState } from 'react';

/**
 * O "AGORA" DE UMA TELA QUE MEDE PRAZO EM DIAS (o link do convite vale 15).
 *
 * Congelar a hora na montagem bastava enquanto a tela era aberta e fechada;
 * o app instalado fica aberto o dia inteiro, e a lista de ontem continuaria
 * dizendo "Enviado" para um link que venceu de madrugada. Acerta quando a aba
 * VOLTA a aparecer — sem relógio andando enquanto ninguém olha.
 */
export function useAgoraAoVoltar() {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') setAgora(Date.now());
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, []);
  return agora;
}
