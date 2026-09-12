import type { ViewportRect } from '../../types/interaction.ts';

/** Shortest dimension captures narrow controls too. Dimensions are CSS pixels. */
export function smallTargetAssistance(rect?: ViewportRect): number {
  if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) return 0;
  // Full assistance at 32px, tapering to the existing behavior at 96px.
  return Math.max(0, Math.min(1, (96 - Math.min(rect.width, rect.height)) / 64));
}

export function assistedThreshold(threshold: number, rect?: ViewportRect): number {
  // Preserve low operator thresholds and keep lock/highlight thresholds ordered.
  return threshold - Math.min(0.15, threshold * 0.25) * smallTargetAssistance(rect);
}
