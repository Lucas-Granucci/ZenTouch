import { createContext } from 'react';
import type { KioskInput } from '../engine/createInput.ts';
import type { TargetActivation } from './activation.ts';
import type { PipelineSettings } from '../engine/InteractionEngine.ts';

export const InteractionContext = createContext<{ input: KioskInput; activation: TargetActivation | null; settings: PipelineSettings } | null>(null);
