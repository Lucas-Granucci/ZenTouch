import { useMemo, useSyncExternalStore } from 'react';
import { useInteractionContext } from '../../hooks/useInteraction.ts';
import { useRegisteredTarget } from '../../hooks/useRegisteredTarget.ts';
import { useTargetActivation } from '../../hooks/useTargetActivation.ts';
import { createTargetFeedback } from './targetFeedback.ts';

export function useTouchlessTarget(id: string, enabled: boolean, onActivate: () => void) {
  const { input, settings } = useInteractionContext();
  const ref = useRegisteredTarget<HTMLButtonElement>(input.targets, id, enabled);
  const onClick = useTargetActivation(id, enabled, onActivate);
  const getFeedback = useMemo(() => createTargetFeedback(input.getSnapshot, id, enabled, settings.selection),
    [input, id, enabled, settings.selection]);
  const feedback = useSyncExternalStore(input.subscribe, getFeedback);
  return { ref, onClick, ...feedback };
}
