import { leadingTarget } from './distribution.ts';
import type { EngineConfig, IntentDistribution, Point2, PointingEstimate, RegisteredTarget, ViewportRect } from '../../types/interaction.ts';

export const defaultIntentConfig: EngineConfig['intent'] = {
  weights: { alignment: 1, distance: 5, motion: 0.5, history: 0.5, prior: 0.25 }, softmaxTemperature: 0.35, temporalAlpha: 0.3,
};
export function eligibleTargets(targets: readonly RegisteredTarget[], viewport: ViewportRect) {
  return targets.filter(({ enabled, rect: r }) => enabled && r.width > 0 && r.height > 0 &&
    r.x < viewport.x + viewport.width && r.y < viewport.y + viewport.height && r.x + r.width > viewport.x && r.y + r.height > viewport.y);
}
/** Supply the pointing direction transformed into mirrored, calibrated viewport axes. */
export function scoreTargets(pointing: PointingEstimate, targets: readonly RegisteredTarget[], viewport: ViewportRect,
  config = defaultIntentConfig, history: ReadonlyMap<string, number> = new Map(), screenDirection: Point2 | null = null): IntentDistribution {
  if (!Number.isFinite(config.softmaxTemperature) || config.softmaxTemperature <= 0 || Object.values(config.weights).some(v => !Number.isFinite(v) || v < 0)) throw new RangeError('Invalid scoring configuration');
  const scale = Math.max(1, Math.hypot(viewport.width, viewport.height) * 0.2);
  const scored = eligibleTargets(targets, viewport).map(target => {
    const r = target.rect, p = pointing.position;
    const dx = r.x + r.width / 2 - p.x, dy = r.y + r.height / 2 - p.y;
    const distance = Math.hypot(dx, dy);
    const edge = Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.width), Math.max(r.y - p.y, 0, p.y - r.y - r.height));
    const v = pointing.velocity, length = screenDirection ? Math.hypot(screenDirection.x, screenDirection.y) : 0;
    const alignment = screenDirection && length > 1e-6 && distance > 1 ? (screenDirection.x * dx + screenDirection.y * dy) / (length * distance) : 0;
    const futureDistance = v ? Math.hypot(dx - v.x * 0.15, dy - v.y * 0.15) : distance;
    const w = config.weights;
    const score = w.alignment * alignment + w.distance * Math.exp(-(edge + distance * 0.25) / scale) +
      w.motion * Math.max(-1, Math.min(1, (distance - futureDistance) / scale)) + w.history * (history.get(target.id) ?? 0) + w.prior * Math.log1p(target.priority ?? 1);
    // Absolute evidence: outside the rectangle, confidence decays over 48 CSS px.
    // Relative ranking, history, and UI priors cannot override this spatial ceiling.
    const proximity = Math.exp(-((edge / 48) ** 2));
    return { targetId: target.id, score, proximity };
  });
  const maximum = Math.max(...scored.map(t => t.score));
  const mass = scored.map(t => Math.exp((t.score - maximum) / config.softmaxTemperature));
  const total = mass.reduce((a, b) => a + b, 0);
  const result = scored.map(({ targetId, score, proximity }, i) => {
    const probability = mass[i] / total * proximity;
    return { targetId, score, probability, belief: probability };
  });
  return { timestamp: pointing.timestamp, targets: result, leadingTargetId: leadingTarget(result) };
}
