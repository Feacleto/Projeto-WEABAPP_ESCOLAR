import { useEffect, useState } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

/**
 * Subscribe à posição ao vivo DE UM MOTORISTA.
 *
 * `driverUid` é obrigatório na prática, e quem chama precisa saber de quem é
 * a perua que está desenhando: a tela do pai passa `child.adminUid`, a tela
 * do motorista omite e cai na própria sessão.
 *
 * Omitir era o comportamento antigo do módulo inteiro — um `liveLocation/
 * current` global — e é assim que o pai de um motorista via a van de outro.
 * O padrão "sem argumento = a minha" só é seguro pra quem É o motorista.
 *
 * Retorna { location, loading, error } onde location é null se ainda não
 * existir o doc (rota nunca foi iniciada).
 */
export function useLiveLocation(driverUid) {
  const alvo = driverUid || auth.currentUser?.uid || null;

  // O estado guarda DE QUEM ele é, e não só o quê.
  //
  // Sem isso, trocar de criança (pai com dois filhos em peruas diferentes)
  // deixaria a posição do motorista anterior na tela até o primeiro snapshot
  // do novo chegar — e nesse intervalo o mapa mostra a van errada com toda a
  // confiança do mundo. Comparar o dono na hora de ler é o que fecha essa
  // janela sem precisar zerar estado dentro do efeito.
  const [snap, setSnap] = useState({ uid: null, location: null, error: null });

  useEffect(() => {
    if (!alvo) return undefined;
    return onSnapshot(
      doc(db, 'liveLocation', alvo),
      (s) => setSnap({ uid: alvo, location: s.exists() ? s.data() : null, error: null }),
      (err) => {
        console.error('useLiveLocation error:', err);
        setSnap({ uid: alvo, location: null, error: err });
      }
    );
  }, [alvo]);

  const noAlvo = snap.uid === alvo;
  return {
    location: noAlvo ? snap.location : null,
    // Sem alvo não há o que carregar — `loading: true` pra sempre deixaria a
    // tela do pai num esqueleto eterno se a criança ainda não tiver motorista.
    loading: alvo ? !noAlvo : false,
    error: noAlvo ? snap.error : null,
  };
}
