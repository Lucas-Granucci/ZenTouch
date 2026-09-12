import type { LandmarkFrame, LandmarkProvider, TrackingStatus } from '../../types/interaction.ts';
import { LandmarkMapper } from './landmarks.ts';
import { createHandDetector } from './mediapipe.ts';
import type { HandDetector } from './mediapipe.ts';

export interface CameraOptions {
  previewMirrored?: boolean;
  preferredCameraLabel?: string;
  /** Requested physical pixel dimensions, evaluated each time the camera starts. */
  captureSize?: () => { width: number; height: number };
  /** Injection points allow deterministic lifecycle tests without a real camera. */
  createDetector?: () => Promise<HandDetector>;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  enumerateDevices?: () => Promise<MediaDeviceInfo[]>;
  now?: () => number;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
}

function cameraFailure(error: unknown): TrackingStatus | null {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission-denied';
  if (['NotFoundError', 'NotReadableError', 'OverconstrainedError', 'AbortError'].includes(name)) return 'unavailable';
  return null;
}

/** Owns the supplied video element's stream. Subscribe before calling start(). */
export class CameraLandmarkProvider implements LandmarkProvider {
  readonly source = 'camera' as const;
  private readonly video: HTMLVideoElement;
  private readonly options: CameraOptions;
  private listeners = new Set<(frame: LandmarkFrame) => void>();
  private mapper = new LandmarkMapper();
  private generation = 0;
  private active = false;
  private pending: Promise<void> | null = null;
  private cancelStart: (() => void) | null = null;
  private stream: MediaStream | null = null;
  private detector: HandDetector | null = null;
  private cancelScheduled: (() => void) | null = null;
  private cleanups: (() => void)[] = [];
  private lastTimestamp = -Infinity;
  private lastVideoTime = -1;

  constructor(video: HTMLVideoElement, options: CameraOptions = {}) {
    this.video = video;
    this.options = options;
  }

  subscribe(listener: (frame: LandmarkFrame) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  start(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.active) return Promise.resolve();
    this.active = true;
    const generation = ++this.generation;
    const cancelled = new Promise<void>(resolve => { this.cancelStart = resolve; });
    const work = this.initialize(generation);
    const pending = Promise.race([work, cancelled]).finally(() => {
      if (this.pending === pending) { this.pending = null; this.cancelStart = null; }
    });
    this.pending = pending;
    return pending;
  }

  stop(): void {
    this.active = false;
    this.generation++;
    this.cancelStart?.();
    this.cancelStart = null;
    this.pending = null;
    this.cancelScheduled?.();
    this.cancelScheduled = null;
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.video.pause();
    this.video.srcObject = null;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.detector?.close();
    this.detector = null;
    this.mapper.reset();
    this.lastVideoTime = -1;
  }

  private current(generation: number): boolean { return this.active && this.generation === generation; }
  private now(): number { return (this.options.now ?? (() => performance.now()))(); }

  private publish(status: TrackingStatus, timestamp = Math.max(this.now(), this.lastTimestamp + 0.001), hands: LandmarkFrame['hands'] = []): void {
    if (!this.active || !Number.isFinite(timestamp) || timestamp <= this.lastTimestamp) return;
    this.lastTimestamp = timestamp;
    if (status !== 'tracking') this.mapper.reset();
    const frame: LandmarkFrame = Object.freeze({
      timestamp, source: this.source, status, hands: Object.freeze(hands),
      previewMirrored: this.options.previewMirrored ?? true,
      imageSize: Object.freeze({ width: this.video.videoWidth, height: this.video.videoHeight }),
    });
    const generation = this.generation;
    for (const listener of [...this.listeners]) {
      if (!this.current(generation)) break;
      listener(frame);
    }
  }

  private async initialize(generation: number): Promise<void> {
    try {
      this.publish('initializing');
      if (!this.current(generation)) return;
      const getMedia = this.options.getUserMedia ?? (typeof navigator !== 'undefined' && navigator.mediaDevices
        ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices) : null);
      if (!getMedia) { this.publish('unavailable'); this.stop(); return; }
      const size = this.options.captureSize?.();
      const resolution: MediaTrackConstraints = size ? {
        width: { ideal: size.width }, height: { ideal: size.height },
      } : {};
      let stream: MediaStream;
      try {
        stream = await getMedia({ audio: false, video: { ...resolution, facingMode: { ideal: 'user' } } });
      } catch (error) {
        if (!this.current(generation)) return;
        const status = cameraFailure(error);
        if (!status) throw error;
        this.publish(status);
        this.stop();
        return;
      }
      if (!this.current(generation)) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      if (this.options.preferredCameraLabel) {
        // Camera permission exposes device labels, so enumerate after opening a stream.
        const enumerate = this.options.enumerateDevices ?? navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
        const devices = await enumerate();
        if (!this.current(generation)) return;
        const preferred = devices.find(device => device.kind === 'videoinput' &&
          device.label.toLowerCase().includes(this.options.preferredCameraLabel!.toLowerCase()));
        if (!preferred) throw new Error('Logitech Brio camera not found. Connect it and start the camera again.');
        if (stream.getVideoTracks()[0]?.getSettings().deviceId !== preferred.deviceId) {
          stream.getTracks().forEach(track => track.stop());
          this.stream = null;
          stream = await getMedia({ audio: false, video: { ...resolution, deviceId: { exact: preferred.deviceId } } });
          if (!this.current(generation)) { stream.getTracks().forEach(track => track.stop()); return; }
          this.stream = stream;
        }
      }
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.srcObject = stream;
      const interrupt = () => {
        if (this.current(generation)) { this.publish('interrupted'); this.stop(); }
      };
      const listen = (target: EventTarget, event: string) => {
        target.addEventListener(event, interrupt);
        this.cleanups.push(() => target.removeEventListener(event, interrupt));
      };
      for (const track of stream.getVideoTracks()) { listen(track, 'ended'); listen(track, 'mute'); }
      listen(this.video, 'error');
      if (typeof document !== 'undefined') {
        const visibility = () => { if (document.hidden) interrupt(); };
        document.addEventListener('visibilitychange', visibility);
        this.cleanups.push(() => document.removeEventListener('visibilitychange', visibility));
        if (document.hidden) { interrupt(); return; }
      }
      try { await this.video.play(); }
      catch (error) {
        if (!this.current(generation)) return;
        const status = cameraFailure(error);
        if (!status) throw error;
        this.publish(status); this.stop(); return;
      }
      if (!this.current(generation)) return;
      const detector = await (this.options.createDetector ?? createHandDetector)();
      if (!this.current(generation)) { detector.close(); return; }
      this.detector = detector;
      this.schedule(generation);
    } catch (error) {
      if (!this.current(generation)) return;
      this.publish('unavailable');
      // Preserve rejection for unexpected failures instead of winning the race
      // with stop()'s normal cancellation resolution.
      this.cancelStart = null;
      this.stop();
      throw error;
    }
  }

  private schedule(generation: number): void {
    if (!this.current(generation)) return;
    const process = (timestamp: number) => {
      this.cancelScheduled = null;
      if (!this.current(generation)) return;
      try {
        if (this.video.readyState >= 2 && this.video.videoWidth > 0 && this.video.videoHeight > 0 &&
            this.video.currentTime !== this.lastVideoTime && Number.isFinite(timestamp) && timestamp > this.lastTimestamp) {
          this.lastVideoTime = this.video.currentTime;
          const result = this.detector!.detectForVideo(this.video, timestamp);
          const mapped = this.mapper.map(result, timestamp);
          this.publish(mapped.status, timestamp, mapped.hands);
        }
      } catch {
        this.publish('interrupted'); this.stop(); return;
      }
      this.schedule(generation);
    };
    if (!this.options.requestFrame && typeof this.video.requestVideoFrameCallback === 'function') {
      const id = this.video.requestVideoFrameCallback((now, metadata) => {
        // captureTime shares performance.now()'s origin; fall back to callback time
        // (a capture-time approximation), never inference completion or media seconds.
        process(metadata.captureTime ?? now);
      });
      this.cancelScheduled = () => this.video.cancelVideoFrameCallback(id);
    } else {
      const id = (this.options.requestFrame ?? requestAnimationFrame)(process);
      this.cancelScheduled = () => (this.options.cancelFrame ?? cancelAnimationFrame)(id);
    }
  }
}
