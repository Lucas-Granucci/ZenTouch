import type { CursorSettings } from '../../components/zentouch/feedbackModel.ts';
import { useInteraction, useInteractionContext } from '../../hooks/useInteraction.ts';
import { SoftSnapOverlay } from '../../components/zentouch/SoftSnapOverlay.tsx';
import { InteractionFeedback } from '../../components/zentouch/InteractionFeedback.tsx';

export function InteractionOverlay({ cursor }: { cursor: CursorSettings }) {
  const { settings } = useInteractionContext();
  const snapshot = useInteraction();
  return <><SoftSnapOverlay snapshot={snapshot} timing={settings.selection} cursor={cursor} /><InteractionFeedback snapshot={snapshot} selectionMethod={snapshot.source === 'simulated' ? 'dwell' : settings.selection.selectionMethod} /></>;
}
