import type { LandmarkFrame, Point3, PointingEstimate, TrackedHand, ViewportRect } from '../../types/interaction.ts';

export interface PointingOptions {
  fingerWeight: number;
  handWeight: number;
  armWeight: number;
  /** Extrapolation beyond index MCP, in normalized image units. */
  projectionDistance: number;
}
export const defaultPointingOptions: PointingOptions = {
  fingerWeight: 0.7, handWeight: 0.3, armWeight: 0, projectionDistance: 0.2,
};
const subtract = (a: Point3, b: Point3): Point3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
function unit(p: Point3): Point3 | null {
  const length = Math.hypot(p.x, p.y, p.z);
  return Number.isFinite(length) && length > 1e-6
    ? { x: p.x / length, y: p.y / length, z: p.z / length } : null;
}
export function pointingVectors(hand: TrackedHand) {
  return {
    finger: subtract(hand.landmarks[8], hand.landmarks[5]),
    hand: subtract(hand.landmarks[5], hand.landmarks[0]),
    arm: hand.elbow && hand.elbow.confidence >= 0.5 ? subtract(hand.landmarks[0], hand.elbow) : null,
  };
}
/** Heuristic image-space projection; G5 will apply an affine calibration afterward.
 * Never divide by z: monocular wrist-relative depth is not a screen-plane ray.
 */
export function estimatePointing(frame: LandmarkFrame, viewport: ViewportRect,
  options: PointingOptions = defaultPointingOptions): PointingEstimate | null {
  if (Object.values(options).some(v => !Number.isFinite(v) || v < 0)) throw new RangeError('Invalid pointing options');
  if (frame.status !== 'tracking' || frame.hands.length !== 1 ||
      !Number.isFinite(frame.timestamp) || !Object.values(viewport).every(Number.isFinite) || viewport.width <= 0 || viewport.height <= 0) return null;
  const hand = frame.hands[0];
  if (!Number.isFinite(hand.confidence) || hand.confidence <= 0 || hand.confidence > 1) return null;
  const vectors = pointingVectors(hand);
  const sum = { x: 0, y: 0, z: 0 };
  for (const key of ['finger', 'hand', 'arm'] as const) {
    const vector = vectors[key] && unit(vectors[key]);
    const weight = options[`${key}Weight`];
    if (vector) { sum.x += vector.x * weight; sum.y += vector.y * weight; sum.z += vector.z * weight; }
  }
  const direction = unit(sum);
  if (!direction) return null;
  const origin = hand.landmarks[5];
  const x = origin.x + direction.x * options.projectionDistance;
  const y = origin.y + direction.y * options.projectionDistance;
  if (![x, y].every(Number.isFinite)) return null;
  return { timestamp: frame.timestamp, handId: hand.id,
    position: { x: viewport.x + (frame.previewMirrored ? 1 - x : x) * viewport.width, y: viewport.y + y * viewport.height },
    direction, velocity: null, confidence: hand.confidence };
}
