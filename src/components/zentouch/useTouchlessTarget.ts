import { useInteraction, useInteractionContext } from '../../hooks/useInteraction.ts';
import { useRegisteredTarget } from '../../hooks/useRegisteredTarget.ts';
import { useTargetActivation } from '../../hooks/useTargetActivation.ts';
import { holdProgress } from './feedbackModel.ts';

export function useTouchlessTarget(id: string, enabled: boolean, onActivate: () => void) {
  const { input, settings } = useInteractionContext();
  const ref = useRegisteredTarget<HTMLButtonElement>(input.targets, id, enabled);
  const onClick = useTargetActivation(id, enabled, onActivate);
  const snapshot = useInteraction();
  const state = snapshot.state;
  const armed = enabled && 'targetId' in state && state.targetId === id && snapshot.intent.leadingTargetId === id;
  return { ref, onClick, armed, phase: armed ? state.phase === 'LOCKED' ? 'locked' : 'pointing' : 'idle',
    progress: armed ? holdProgress(state, settings.selection) : 0 };
}
