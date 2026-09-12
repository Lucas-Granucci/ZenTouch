import { useContext, useSyncExternalStore } from 'react';
import { InteractionContext } from '../interaction/react/context.ts';

export function useInteractionContext() {
  const context = useContext(InteractionContext);
  if (!context) throw new Error('Kiosk controls require InteractionProvider');
  return context;
}
export function useInteraction() {
  const { input } = useInteractionContext();
  return useSyncExternalStore(input.subscribe, input.getSnapshot);
}
