import type { SelectionMethod, TrackedHand } from '../../types/interaction.ts';
export interface SelectionStrategy {
  reset(): void;
  update(hand: TrackedHand, timestamp: number, lockedAt: number): { complete: boolean; progress: number };
}
/** Secondary gestures must first be released/open after lock; a held gesture cannot repeat. */
export function createSelectionStrategy(method: SelectionMethod, dwellDurationMs = 1200): SelectionStrategy {
  if (!Number.isFinite(dwellDurationMs) || dwellDurationMs <= 0) throw new RangeError('Invalid dwell duration');
  let armed = false, baseline = 0;
  return {
    reset() { armed = false; baseline = 0; },
    update(hand, timestamp, lockedAt) {
      if (method === 'dwell') { const progress = Math.min(1, Math.max(0, (timestamp - lockedAt) / dwellDurationMs)); return { complete: progress === 1, progress }; }
      const p = hand.landmarks;
      const dist = (a: number, b: number) => Math.hypot(p[a].x - p[b].x, p[a].y - p[b].y);
      const width = dist(5, 17);
      if (width < 0.01) return { complete: false, progress: 0 };
      let active = false, released = false, progress = 0;
      if (method === 'pinch') {
        const ratio = dist(4, 8) / width;
        released = ratio > 0.65; active = ratio < 0.3; progress = Math.max(0, Math.min(1, (0.65 - ratio) / 0.35));
      } else if (method === 'fist') {
        const folded = [8, 12, 16, 20].filter(tip => dist(tip, 0) < dist(tip - 2, 0) * 1.1).length;
        released = folded === 0; active = folded === 4; progress = folded / 4;
      } else {
        if (!baseline) { baseline = width; armed = true; }
        const ratio = width / baseline;
        active = ratio > 1.3; progress = Math.max(0, Math.min(1, (ratio - 1) / 0.3));
      }
      if (released) armed = true;
      const complete = armed && active;
      if (complete) armed = false;
      return { complete, progress: armed || complete ? progress : 0 };
    },
  };
}
