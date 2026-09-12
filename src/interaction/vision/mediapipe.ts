import type { Point3 } from '../../types/interaction.ts';

/** Structural boundary for the pinned, locally served MediaPipe module. */
export interface HandResult {
  landmarks: Point3[][];
  worldLandmarks: Point3[][];
  handedness: { categoryName: string; score: number }[][];
}

export interface HandDetector {
  detectForVideo(video: HTMLVideoElement, timestamp: number): HandResult;
  close(): void;
}

export async function createHandDetector(): Promise<HandDetector> {
  const base = `${import.meta.env.BASE_URL}mediapipe/`;
  // JavaScript belongs in the module graph; public/ contains only runtime assets.
  const vision = await import('./vendor/vision_bundle.mjs');
  const files = await vision.FilesetResolver.forVisionTasks(`${base}wasm`);
  return vision.HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: `${base}hand_landmarker.task`, delegate: 'CPU' },
    runningMode: 'VIDEO',
    // Detect a second hand so ambiguous input cannot masquerade as single-hand input.
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}
