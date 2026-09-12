import type { Point2, RegisteredTarget } from '../../types/interaction.ts';

/** Stateless attraction: never accumulates, expands hit areas, or retains a target. */
export function softSnapPosition(position: Point2, targets: readonly RegisteredTarget[]): Point2 {
  const target = targets.filter(({ enabled, softSnap, rect: r }) =>
    enabled && softSnap && r.width > 0 && r.height > 0 &&
    position.x > r.x && position.x < r.x + r.width &&
    position.y > r.y && position.y < r.y + r.height)
    .sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
  if (!target) return position;
  const r = target.rect;
  const dx = r.x + r.width / 2 - position.x;
  const dy = r.y + r.height / 2 - position.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return position;
  // Fade continuously from zero at every edge; cap the pull on wide CTAs.
  const depth = Math.min(position.x - r.x, r.x + r.width - position.x,
    position.y - r.y, r.y + r.height - position.y);
  const t = Math.min(1, depth / Math.min(12, r.width / 4, r.height / 4));
  const strength = Math.min(0.3, 14 / distance) * t * t * (3 - 2 * t);
  return { x: position.x + dx * strength, y: position.y + dy * strength };
}
