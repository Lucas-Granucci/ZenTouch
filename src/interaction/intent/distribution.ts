import type { TargetIntent } from '../../types/interaction.ts';

/** Unassigned mass represents pointing at none of the registered targets. */
export function noTargetMass(targets: readonly TargetIntent[], field: 'probability' | 'belief') {
  return Math.max(0, Math.min(1, 1 - targets.reduce((sum, target) => sum + target[field], 0)));
}
export function leadingTarget(targets: readonly TargetIntent[], previous: string | null = null) {
  const sorted = [...targets].sort((a, b) => b.belief - a.belief ||
    (a.targetId === previous ? -1 : b.targetId === previous ? 1 : a.targetId.localeCompare(b.targetId)));
  const best = sorted[0];
  return best && best.belief > noTargetMass(targets, 'belief') ? best.targetId : null;
}
