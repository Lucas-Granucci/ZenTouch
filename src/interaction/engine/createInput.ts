import type { InputSource, InteractionOutput, LandmarkProvider, TargetRegistry } from '../../types/interaction.ts';
import { SimulatedInputProvider } from '../simulated/SimulatedInputProvider.ts';
import { InteractionEngine, defaultPipelineSettings, type PipelineSettings } from './InteractionEngine.ts';
import type { Calibration } from '../pointing/calibration/affine.ts';

export interface KioskInput extends InteractionOutput {
  readonly targets: TargetRegistry;
  reset(timestamp?: number): void;
  dispose(): void;
}
export function createInput(source: InputSource, settings: PipelineSettings = defaultPipelineSettings,
  viewport = () => ({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }), calibration: Calibration | null = null) {
  return source === 'simulated' ? new SimulatedInputProvider(settings.selection) : new InteractionEngine(viewport, settings, calibration);
}

/** Unsubscribe before stopping: a late provider callback must not reach the old engine. */
export function connectLandmarks(engine: InteractionEngine, provider: LandmarkProvider) {
  let active = true;
  const unsubscribe = provider.subscribe(frame => { if (active) engine.processFrame(frame); });
  const timer = setInterval(() => engine.tick(performance.now()), 100);
  return () => { active = false; unsubscribe(); clearInterval(timer); provider.stop(); };
}
