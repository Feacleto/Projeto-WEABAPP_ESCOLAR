import { useEffect, useState } from 'react';
import { verCartaoDoTio } from '../services/cartaoDoTioService';

/**
 * O cartão público do tio para a página `/conheca/<uid>`. `null` enquanto
 * carrega; depois, `{ vale: true, marca, logoURL, cor, cidade, bairro,
 * whatsapp }` ou `{ vale: false, frase }`. Uma leitura só — não há escuta.
 */
export function useCartaoDoTio(uid) {
  const [estado, setEstado] = useState({ uid: null, cartao: null });
  useEffect(() => {
    let vivo = true;
    verCartaoDoTio(uid).then((cartao) => {
      if (vivo) setEstado({ uid, cartao });
    });
    return () => {
      vivo = false;
    };
  }, [uid]);
  return estado.uid === uid ? estado.cartao : null;
}
