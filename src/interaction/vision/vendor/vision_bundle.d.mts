import type { HandDetector } from '../mediapipe.ts';
export const FilesetResolver: { forVisionTasks(path: string): Promise<unknown> };
export const HandLandmarker: {
  createFromOptions(files: unknown, options: unknown): Promise<HandDetector>;
};
