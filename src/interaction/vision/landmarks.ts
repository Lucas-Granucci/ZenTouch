import type { HandLandmarks, Point3, TrackedHand, TrackingStatus } from '../../types/interaction.ts';
import type { HandResult } from './mediapipe.ts';

function copyPoints(points: Point3[] | undefined): HandLandmarks | null {
  if (!points || points.length !== 21 || points.some(p =>
    !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z))) return null;
  return Object.freeze(points.map(p => Object.freeze({ x: p.x, y: p.y, z: p.z }))) as unknown as HandLandmarks;
}

/** Conservative continuity for the initial single-hand policy; IDs never use result indices. */
export class LandmarkMapper {
  private previous: TrackedHand | null = null;
  private sequence = 0;
  private timestamp = -Infinity;

  reset(): void { this.previous = null; }

  map(result: HandResult, timestamp: number): { status: TrackingStatus; hands: readonly TrackedHand[] } {
    const previous = timestamp - this.timestamp <= 250 ? this.previous : null;
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
      // MediaPipe exposes no per-result tracking score. This is a binary geometry
      // quality gate after its detection/presence/IoU thresholds, not handedness confidence.
      const span = Math.hypot(landmarks[9].x - landmarks[0].x, landmarks[9].y - landmarks[0].y);
      const confidence = span > 1e-5 ? 1 : 0;
      const continuous = result.landmarks.length === 1 && previous && confidence > 0 &&
        previous.handedness === handedness && Math.hypot(
          landmarks[0].x - previous.landmarks[0].x,
          landmarks[0].y - previous.landmarks[0].y,
        ) <= 0.2;
      hands.push(Object.freeze({
        id: continuous ? previous.id : `camera-hand-${++this.sequence}`,
        handedness, handednessConfidence, confidence, landmarks,
        worldLandmarks: copyPoints(result.worldLandmarks[i]), elbow: null,
      }));
    }
    const status = result.landmarks.length > 1 ? 'multiple-hands' :
      result.landmarks.length === 0 ? 'no-hand' :
      hands.length === 1 && hands[0].confidence > 0 ? 'tracking' : 'low-confidence';
    this.previous = status === 'tracking' ? hands[0] : null;
    return { status, hands: Object.freeze(hands) };
  }
}
