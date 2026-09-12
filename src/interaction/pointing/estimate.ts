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
function toViewport(x: number, y: number, frame: LandmarkFrame, viewport: ViewportRect): { x: number; y: number } | null {
  if (![x, y].every(Number.isFinite)) return null;
  return { x: viewport.x + (frame.previewMirrored ? 1 - x : x) * viewport.width, y: viewport.y + y * viewport.height };
}
export function pointingVectors(hand: TrackedHand) {
  return {
    finger: subtract(hand.landmarks[8], hand.landmarks[5]),
    hand: subtract(hand.landmarks[5], hand.landmarks[0]),
    arm: hand.elbow && hand.elbow.confidence >= 0.5 ? subtract(hand.landmarks[0], hand.elbow) : null,
  };
}
type Vectors = { finger: Point3; hand: Point3; arm: Point3 | null };
function projectVectors(hand: TrackedHand, vectors: Vectors, frame: LandmarkFrame, viewport: ViewportRect, options: PointingOptions): PointingEstimate | null {
  const sum = { x: 0, y: 0, z: 0 };
  for (const key of ['finger', 'hand', 'arm'] as const) {
    const vector = vectors[key] && unit(vectors[key]!);
    const weight = options[`${key}Weight`];
    if (vector) { sum.x += vector.x * weight; sum.y += vector.y * weight; sum.z += vector.z * weight; }
  }
  const direction = unit(sum);
  if (!direction) return null;
  const origin = hand.landmarks[5];
  const position = toViewport(origin.x + direction.x * options.projectionDistance, origin.y + direction.y * options.projectionDistance, frame, viewport);
  if (!position) return null;
  return { timestamp: frame.timestamp, handId: hand.id, position, direction, velocity: null, confidence: hand.confidence };
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
  return projectVectors(hand, pointingVectors(hand), frame, viewport, options);
}

/** Direction vectors from MediaPipe's reconstructed metric 3D hand pose instead of raw
 * image-space landmarks. Image-space landmarks are warped by perspective projection —
 * a finger pointing off-axis doesn't produce a straight 2D vector — while worldLandmarks
 * approximate the hand's true 3D geometry, so direction should be less distorted. No
 * world elbow is available, so the arm vector is always null here.
 */
export function worldPointingVectors(hand: TrackedHand): Vectors | null {
  const w = hand.worldLandmarks;
  if (!w) return null;
  return { finger: subtract(w[8], w[5]), hand: subtract(w[5], w[0]), arm: null };
}
/** Experiment: same projection as estimatePointing, but the pointing direction comes
 * from worldPointingVectors, falling back to image-space landmarks when MediaPipe
 * didn't return world landmarks for this frame.
 */
export function estimateWorldPointing(frame: LandmarkFrame, viewport: ViewportRect,
  options: PointingOptions = defaultPointingOptions): PointingEstimate | null {
  if (Object.values(options).some(v => !Number.isFinite(v) || v < 0)) throw new RangeError('Invalid pointing options');
  if (frame.status !== 'tracking' || frame.hands.length !== 1 ||
      !Number.isFinite(frame.timestamp) || !Object.values(viewport).every(Number.isFinite) || viewport.width <= 0 || viewport.height <= 0) return null;
  const hand = frame.hands[0];
  if (!Number.isFinite(hand.confidence) || hand.confidence <= 0 || hand.confidence > 1) return null;
  return projectVectors(hand, worldPointingVectors(hand) ?? pointingVectors(hand), frame, viewport, options);
}

export interface GainOptions {
  /** Expansion factor applied around the viewport center; 1 = no change. */
  gain: number;
}
export const defaultGainOptions: GainOptions = { gain: 2.2 };
/** Experiment: stretches the comfortable, near-center range of estimatePointing's
 * output to cover the full screen, instead of requiring the hand to reach the
 * camera's physical frame edge to reach a screen edge.
 */
export function estimateGainPointing(frame: LandmarkFrame, viewport: ViewportRect,
  pointingOptions: PointingOptions = defaultPointingOptions, gainOptions: GainOptions = defaultGainOptions): PointingEstimate | null {
  if (!Number.isFinite(gainOptions.gain) || gainOptions.gain <= 0) throw new RangeError('Invalid gain options');
  const base = estimatePointing(frame, viewport, pointingOptions);
  if (!base) return null;
  const cx = viewport.x + viewport.width / 2, cy = viewport.y + viewport.height / 2;
  return { ...base, position: {
    x: cx + (base.position.x - cx) * gainOptions.gain,
    y: cy + (base.position.y - cy) * gainOptions.gain,
  } };
}

/** Wrist-to-middle-MCP span in normalized image units; a rough inverse-depth proxy
 * (shrinks as the hand moves farther from the camera). Shared with landmarks.ts's
 * confidence gate, which uses the same two joints for the same reason. */
export function handSpan(hand: TrackedHand): number {
  return Math.hypot(hand.landmarks[9].x - hand.landmarks[0].x, hand.landmarks[9].y - hand.landmarks[0].y);
}

export interface DepthScaleOptions {
  /** Hand span at which projectionDistance is used unscaled. */
  referenceSpan: number;
}
export const defaultDepthScaleOptions: DepthScaleOptions = { referenceSpan: 0.15 };
/** Experiment: scales projectionDistance inversely with apparent hand size, so a
 * farther-away hand — which looks smaller in frame, i.e. a smaller handSpan — gets a
 * longer effective reach. This matches how a real pointing ray sweeps more lateral
 * distance the farther it has to travel before reaching the screen (like a laser
 * pointer aimed from across a room versus up against the wall).
 */
export function estimateDepthScaledPointing(frame: LandmarkFrame, viewport: ViewportRect,
  pointingOptions: PointingOptions = defaultPointingOptions, depthOptions: DepthScaleOptions = defaultDepthScaleOptions): PointingEstimate | null {
  if (!Number.isFinite(depthOptions.referenceSpan) || depthOptions.referenceSpan <= 0) throw new RangeError('Invalid depth scale options');
  if (frame.status !== 'tracking' || frame.hands.length !== 1) return null;
  const span = handSpan(frame.hands[0]);
  if (!(span > 1e-4)) return null;
  const scale = Math.min(4, Math.max(0.25, depthOptions.referenceSpan / span));
  return estimatePointing(frame, viewport, { ...pointingOptions, projectionDistance: pointingOptions.projectionDistance * scale });
}

export interface PointingExperimentFlags {
  readonly world: boolean;
  readonly depthScale: boolean;
  readonly gain: boolean;
}
export const defaultPointingExperimentFlags: PointingExperimentFlags = { world: false, depthScale: false, gain: false };
/** Combines the three experiments above so each can be switched on independently:
 * world landmarks changes the direction source, depth scale adjusts the effective
 * projectionDistance, and gain stretches the final position. With every flag false
 * this is identical to estimatePointing.
 */
export function estimateExperimentalPointing(frame: LandmarkFrame, viewport: ViewportRect,
  pointingOptions: PointingOptions = defaultPointingOptions, flags: PointingExperimentFlags = defaultPointingExperimentFlags,
  depthOptions: DepthScaleOptions = defaultDepthScaleOptions, gainOptions: GainOptions = defaultGainOptions): PointingEstimate | null {
  if (Object.values(pointingOptions).some(v => !Number.isFinite(v) || v < 0)) throw new RangeError('Invalid pointing options');
  if (frame.status !== 'tracking' || frame.hands.length !== 1 ||
      !Number.isFinite(frame.timestamp) || !Object.values(viewport).every(Number.isFinite) || viewport.width <= 0 || viewport.height <= 0) return null;
  const hand = frame.hands[0];
  if (!Number.isFinite(hand.confidence) || hand.confidence <= 0 || hand.confidence > 1) return null;
  let projectionDistance = pointingOptions.projectionDistance;
  if (flags.depthScale) {
    if (!Number.isFinite(depthOptions.referenceSpan) || depthOptions.referenceSpan <= 0) throw new RangeError('Invalid depth scale options');
    const span = handSpan(hand);
    if (!(span > 1e-4)) return null;
    projectionDistance *= Math.min(4, Math.max(0.25, depthOptions.referenceSpan / span));
  }
  const vectors = flags.world ? worldPointingVectors(hand) ?? pointingVectors(hand) : pointingVectors(hand);
  const base = projectVectors(hand, vectors, frame, viewport, { ...pointingOptions, projectionDistance });
  if (!base) return null;
  if (!flags.gain) return base;
  if (!Number.isFinite(gainOptions.gain) || gainOptions.gain <= 0) throw new RangeError('Invalid gain options');
  const cx = viewport.x + viewport.width / 2, cy = viewport.y + viewport.height / 2;
  return { ...base, position: {
    x: cx + (base.position.x - cx) * gainOptions.gain,
    y: cy + (base.position.y - cy) * gainOptions.gain,
  } };
}
