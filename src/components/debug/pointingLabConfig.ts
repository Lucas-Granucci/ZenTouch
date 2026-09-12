import type { FilterOptions } from '../../interaction/filtering/PointingFilter.ts';
import type { SelectionMethod } from '../../types/interaction.ts';

/** Pointing Lab startup settings, tuned from the lab controls. */
export const pointingLabConfig = {
  filterMethod: 'ema' as FilterOptions['method'],
  emaAlpha: 0.5,
  processNoise: 10000,
  measurementNoise: 100,
  projectionDistance: 0.2,
  trackingMethod: 'hand-direction' as 'blend' | 'finger' | 'hand-direction' | 'hand',
  selectionMethod: 'dwell' as SelectionMethod,
  lockThreshold: 0.7,
  dwellDurationMs: 300,
};
