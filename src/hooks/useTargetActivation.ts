import { useCallback, useLayoutEffect, useRef } from 'react';
import { useInteractionContext } from './useInteraction.ts';

export function useTargetActivation(id: string, enabled: boolean, onActivate: () => void) {
  const { activation } = useInteractionContext();
  const latest = useRef({ enabled, onActivate });
  useLayoutEffect(() => { latest.current = { enabled, onActivate }; });
  useLayoutEffect(() => activation?.register(id, () => {
    if (latest.current.enabled) latest.current.onActivate();
  }), [activation, id]);
  return useCallback(() => { if (latest.current.enabled) activation?.click(id); }, [activation, id]);
}
