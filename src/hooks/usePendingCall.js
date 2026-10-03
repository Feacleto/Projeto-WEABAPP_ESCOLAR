import { useEffect, useState } from 'react';
import {
  watchActiveCallForParent,
  watchActiveCallsForAdmin,
} from '../services/pendingCallService';
import { buzinaValendo } from '../dominio/rota/buzina.js';

/**
 * O relógio que faz a buzina VENCER sem o banco mudar. O snapshot só chega
 * quando o documento muda — e a chamada esquecida não muda nunca; é por isso
 * que ela tocava no dia seguinte.
 */
function useAgora(intervaloMs = 30_000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(t);
  }, [intervaloMs]);
  return agora;
}

/**
 * Hook do Pai: subscribe à chamada ativa (ringing/acknowledged).
 */
export function useActiveCallForParent(parentUid) {
  const [call, setCall] = useState(null);

  useEffect(() => {
    if (!parentUid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCall(null);
      return;
    }
    const unsub = watchActiveCallForParent(
      parentUid,
      (data) => setCall(data),
      () => {}
    );
    return unsub;
  }, [parentUid]);

  const agora = useAgora();
  return buzinaValendo(call, agora) ? call : null;
}

/**
 * Hook do Tio: lista de chamadas ativas que ele disparou.
 */
export function useActiveCallsForAdmin(adminUid) {
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    if (!adminUid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCalls([]);
      return;
    }
    const unsub = watchActiveCallsForAdmin(
      adminUid,
      (list) => setCalls(list),
      () => {}
    );
    return unsub;
  }, [adminUid]);

  const agora = useAgora();
  return calls.filter((c) => buzinaValendo(c, agora));
}
