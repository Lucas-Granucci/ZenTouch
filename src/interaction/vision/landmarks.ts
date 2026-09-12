import type { HandLandmarks, Point3, TrackedHand, TrackingStatus } from '../../types/interaction.ts';
import type { HandResult } from './mediapipe.ts';

function copyPoints(points: Point3[] | undefined): HandLandmarks | null {
  if (!points || points.length !== 21 || points.some(p =>
    !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z))) return null;
  return Object.freeze(points.map(p => Object.freeze({ x: p.x, y: p.y, z: p.z }))) as unknown as HandLandmarks;
}

// Palm bones are less sensitive to finger gestures than the full hand bounding box.
// Image scale is a proximity heuristic; model z coordinates are hand-relative.
function palmSize(hand: TrackedHand): number {
  const p = hand.landmarks;
  return Math.max(...[5, 9, 13, 17].map(i => Math.hypot(p[i].x - p[0].x, p[i].y - p[0].y)),
    Math.hypot(p[17].x - p[5].x, p[17].y - p[5].y));
}

function matchDistance(a: TrackedHand, b: TrackedHand): number {
  const distance = Math.hypot(a.landmarks[0].x - b.landmarks[0].x, a.landmarks[0].y - b.landmarks[0].y);
  const scale = Math.abs(Math.log(palmSize(a) / palmSize(b)));
  return distance <= 0.2 && scale < Math.log(1.8)
    ? distance + scale * 0.15 + (a.handedness === b.handedness ? 0 : 0.05) : Infinity;
}

/** Select one controlling hand before pointing and gesture processing. */
export class LandmarkMapper {
  private previous: TrackedHand | null = null;
  private challenger: { hand: TrackedHand; since: number } | null = null;
  private sequence = 0;
  private timestamp = -Infinity;

  reset(): void { this.previous = null; this.challenger = null; this.timestamp = -Infinity; }

  map(result: HandResult, timestamp: number): { status: TrackingStatus; hands: readonly TrackedHand[] } {
    const previous = timestamp > this.timestamp && timestamp - this.timestamp <= 250 ? this.previous : null;
    if (!previous) this.challenger = null;
    this.timestamp = timestamp;
    const hands: TrackedHand[] = [];
    for (let i = 0; i < result.landmarks.length; i++) {
      const landmarks = copyPoints(result.landmarks[i]);
      if (!landmarks) continue;
      const category = result.handedness[i]?.[0];
      const handedness = category?.categoryName === 'Left' ? 'left' :
        category?.categoryName === 'Right' ? 'right' : 'unknown';
      const score = category?.score;
      const handednessConfidence = typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1 ? score : 0;
      // MediaPipe exposes no per-result tracking score; retain the geometry gate.
      const span = Math.hypot(landmarks[9].x - landmarks[0].x, landmarks[9].y - landmarks[0].y);
      if (span <= 1e-5) continue;
      hands.push(Object.freeze({
        id: `camera-hand-${++this.sequence}`,
        handedness, handednessConfidence, confidence: 1, landmarks,
        worldLandmarks: copyPoints(result.worldLandmarks[i]), elbow: null,
      }));
    }
    const closest = hands.reduce<TrackedHand | null>((best, hand) =>
      !best || palmSize(hand) > palmSize(best) ? hand : best, null);
    const incumbent = previous ? hands.reduce<TrackedHand | null>((best, hand) =>
      matchDistance(previous, hand) < (best ? matchDistance(previous, best) : Infinity) ? hand : best, null) : null;
    let selected = incumbent ?? closest;
    if (incumbent && closest && closest !== incumbent && palmSize(closest) > palmSize(incumbent) * 1.3) {
      if (!this.challenger || !Number.isFinite(matchDistance(this.challenger.hand, closest))) {
        this.challenger = { hand: closest, since: timestamp };
      } else {
        this.challenger = { ...this.challenger, hand: closest };
      }
      if (timestamp - this.challenger.since >= 200) {
        selected = closest;
        this.challenger = null;
      }
    } else this.challenger = null;
    if (selected && selected === incumbent && previous) selected = Object.freeze({ ...selected, id: previous.id });
    this.previous = selected;
    return { status: selected ? 'tracking' : result.landmarks.length ? 'low-confidence' : 'no-hand',
      hands: Object.freeze(selected ? [selected] : []) };
  }
}
