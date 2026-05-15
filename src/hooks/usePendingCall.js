import { useEffect, useState } from 'react';
import {
  watchActiveCallForParent,
  watchActiveCallsForAdmin,
} from '../services/pendingCallService';

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

  return call;
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

  return calls;
}
