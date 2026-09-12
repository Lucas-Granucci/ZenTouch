import { leadingTarget } from './distribution.ts';
import type { IntentDistribution } from '../../types/interaction.ts';
export class TemporalBelief {
  private previous: IntentDistribution = { timestamp: 0, targets: [], leadingTargetId: null };
  private alpha: number;
  constructor(alpha = 0.3) {
    this.alpha = alpha;
    if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) throw new RangeError('Invalid temporal alpha');
  }
  reset() { this.previous = { timestamp: 0, targets: [], leadingTargetId: null }; }
  get history() { return new Map(this.previous.targets.map(t => [t.targetId, t.belief])); }
  update(current: IntentDistribution): IntentDistribution {
    const history = this.history;
    // Preserve absolute target mass. Removed targets transfer their belief to
    // "no target" rather than making the remaining targets more certain.
    const initialized = this.previous.targets.length > 0;
    const targets = current.targets.map(t => ({ ...t, belief: initialized
      ? this.alpha * t.probability + (1 - this.alpha) * (history.get(t.targetId) ?? 0)
      : t.probability }));
    this.previous = { ...current, targets, leadingTargetId: leadingTarget(targets, this.previous.leadingTargetId) };
    return this.previous;
  }
}
export function lockEligible(belief: number, threshold: number, startedAt: number | null, timestamp: number, duration: number) {
  const start = belief > threshold ? startedAt ?? timestamp : null;
  return { startedAt: start, progress: start === null ? 0 : Math.min(1, Math.max(0, (timestamp - start) / duration)) };
}
