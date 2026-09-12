import { useMemo, useSyncExternalStore } from 'react';
import { useInteraction, useInteractionContext } from '../../hooks/useInteraction.ts';
import { SoftSnapOverlay } from '../../components/zentouch/SoftSnapOverlay.tsx';
import { InteractionFeedback } from '../../components/zentouch/InteractionFeedback.tsx';
import { createGeometryStore } from './geometryStore.ts';

export function InteractionOverlay() {
  const { input, settings } = useInteractionContext();
  const snapshot = useInteraction();
  const geometry = useMemo(() => createGeometryStore(input.targets), [input]);
  const targets = useSyncExternalStore(geometry.subscribe, geometry.getSnapshot);
  return <><SoftSnapOverlay snapshot={snapshot} targets={targets} timing={settings.selection} /><InteractionFeedback snapshot={snapshot} selectionMethod={snapshot.source === 'simulated' ? 'dwell' : settings.selection.selectionMethod} /></>;
}
