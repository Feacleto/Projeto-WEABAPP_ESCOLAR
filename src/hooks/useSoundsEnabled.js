import { useEffect, useState } from 'react';
import { areSoundsEnabled, setSoundsEnabled } from '../services/soundService';

/**
 * Hook reativo pra preferência de sons.
 * Lê localStorage (default: true), permite trocar via setEnabled.
 */
export function useSoundsEnabled() {
  const [enabled, setEnabled] = useState(() => areSoundsEnabled());

  useEffect(() => {
    setSoundsEnabled(enabled);
  }, [enabled]);

  return [enabled, setEnabled];
}
