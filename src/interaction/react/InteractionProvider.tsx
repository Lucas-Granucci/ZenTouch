import { useEffect, useState, type ReactNode } from 'react';
import type { KioskInput } from '../engine/createInput.ts';
import { TargetActivation } from './activation.ts';
import type { PipelineSettings } from '../engine/InteractionEngine.ts';

import { InteractionContext } from './context.ts';

export function InteractionProvider({ input, settings, children }: { input: KioskInput | null; settings: PipelineSettings; children: ReactNode }) {
  const [router, setRouter] = useState<{ input: KioskInput; activation: TargetActivation } | null>(null);
  useEffect(() => {
    if (!input) return;
    const activation = new TargetActivation(input);
    // The subscription is created in an effect so Strict Mode can dispose every router.
    // oxlint-disable-next-line react/set-state-in-effect
    setRouter({ input, activation });
    return () => activation.dispose();
  }, [input]);
  return <InteractionContext value={input ? { input, settings, activation: router?.input === input ? router.activation : null } : null}>{children}</InteractionContext>;
}
