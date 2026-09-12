/** F2 boundary contracts. Runtime invariants are specified in specs/INTERACTION.md. */
export type Timestamp = number; // Monotonic milliseconds, performance.now() time origin.
export type Probability = number; // Finite, inclusive [0, 1]; validated by producers.
export type TargetId = string;
export type HandId = string;
export type Unsubscribe = () => void;

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

export interface Point3 extends Point2 {
  readonly z: number;
}

/** Client viewport CSS pixels, matching getBoundingClientRect(), not device pixels. */
export interface ViewportRect extends Point2 {
  readonly width: number;
  readonly height: number;
}

/** MediaPipe order: wrist, then thumb/index/middle/ring/pinky, base to tip. */
export type HandLandmarks = readonly [
  Point3,
  Point3, Point3, Point3, Point3,
  Point3, Point3, Point3, Point3,
  Point3, Point3, Point3, Point3,
  Point3, Point3, Point3, Point3,
  Point3, Point3, Point3, Point3,
];

export interface TrackedHand {
  readonly id: HandId;
  readonly handedness: 'left' | 'right' | 'unknown';
  /** Tracking quality; never substitute handedness classification confidence. */
  readonly confidence: Probability;
  readonly handednessConfidence: Probability;
  /** Unmirrored image coordinates: x/y normalized by image size; z wrist-relative. */
  readonly landmarks: HandLandmarks;
  /** Optional model-estimated meters, relative to the hand's geometric center. */
  readonly worldLandmarks: HandLandmarks | null;
  /** Optional pose elbow in the same image coordinate system as landmarks. */
  readonly elbow: (Point3 & { readonly confidence: Probability }) | null;
}

export type InputSource = 'camera' | 'simulated';

export type TrackingStatus =
  | 'initializing'
  | 'tracking'
  | 'no-hand'
  | 'low-confidence'
  | 'multiple-hands'
  | 'permission-denied'
  | 'unavailable'
  | 'interrupted';

export interface LandmarkFrame {
  readonly timestamp: Timestamp;
  readonly source: InputSource;
  readonly imageSize: { readonly width: number; readonly height: number };
  /** Preview mirroring is metadata; input landmarks remain unmirrored. */
  readonly previewMirrored: boolean;
  readonly status: TrackingStatus;
  readonly hands: readonly TrackedHand[];
}

export interface RegisteredTarget {
  /** Unique for this mounted target; do not reuse while old events can be pending. */
  readonly id: TargetId;
  readonly rect: ViewportRect;
  readonly enabled: boolean;
  /** Finite nonnegative UI prior; omitted means 1. Never overrides enabled=false. */
  readonly priority?: number;
}

export interface TargetRegistry {
  /** Duplicate IDs are errors. Cleanup is idempotent. */
  register(target: RegisteredTarget): Unsubscribe;
  /** Replaces geometry/eligibility for an existing ID; unknown IDs are errors. */
  update(target: RegisteredTarget): void;
  getSnapshot(): readonly RegisteredTarget[];
  subscribe(listener: () => void): Unsubscribe;
}

export interface PointingEstimate {
  readonly timestamp: Timestamp;
  readonly handId: HandId;
  /** Calibrated projected position in client viewport CSS pixels; may be offscreen. */
  readonly position: Point2;
  /** Unit direction in unmirrored image axes; null when direction is unavailable. */
  readonly direction: Point3 | null;
  /** CSS pixels per second; null until velocity can be estimated. */
  readonly velocity: Point2 | null;
  readonly confidence: Probability;
}

export interface TargetIntent {
  readonly targetId: TargetId;
  readonly score: number;
  readonly probability: Probability;
  readonly belief: Probability;
}

export interface IntentDistribution {
  readonly timestamp: Timestamp;
  /** Eligible targets only. Each distribution sums to at most 1; remaining mass means no target. */
  readonly targets: readonly TargetIntent[];
  /** Maximum-belief target; null when no-target mass wins (including ties) or distribution is empty. */
  readonly leadingTargetId: TargetId | null;
}

export type SelectionMethod = 'dwell' | 'pinch' | 'push' | 'fist';

export interface Selection {
  /** Unique within the engine session; used to deduplicate delivery. */
  readonly id: string;
  readonly targetId: TargetId;
  readonly confidence: Probability;
  readonly timestamp: Timestamp;
  readonly source: InputSource;
  readonly method: SelectionMethod;
}

export type IdleReason = 'startup' | 'reset' | 'tracking-unavailable' | 'no-targets';

/** SELECT is a transient state, retained in the event stream even if renders skip it. */
export type InteractionState =
  | { readonly phase: 'IDLE'; readonly since: Timestamp; readonly reason: IdleReason }
  | {
      readonly phase: 'POINTING';
      readonly since: Timestamp;
      readonly targetId: TargetId;
      readonly confidence: Probability;
      readonly lockStartedAt: Timestamp | null;
      readonly lockProgress: Probability;
    }
  | {
      readonly phase: 'LOCKED';
      readonly since: Timestamp;
      readonly targetId: TargetId;
      readonly confidence: Probability;
      readonly selectionProgress: Probability;
    }
  | { readonly phase: 'SELECT'; readonly since: Timestamp; readonly selection: Selection }
  | {
      readonly phase: 'COOLDOWN';
      readonly since: Timestamp;
      readonly until: Timestamp;
      readonly selection: Selection;
    };

export type CalibrationState =
  | { readonly status: 'uncalibrated' }
  | { readonly status: 'collecting'; readonly completedSamples: number; readonly totalSamples: number }
  | {
      readonly status: 'calibrated';
      /** Row-major affine map: x'=a*x+b*y+tx, y'=c*x+d*y+ty. */
      readonly transform: readonly [a: number, b: number, tx: number, c: number, d: number, ty: number];
      readonly viewportSize: { readonly width: number; readonly height: number };
      readonly previewMirrored: boolean;
    }
  | { readonly status: 'failed'; readonly reason: string };

export interface EngineSnapshot {
  readonly timestamp: Timestamp;
  readonly source: InputSource;
  readonly tracking: TrackingStatus;
  readonly activeHandId: HandId | null;
  readonly pointing: PointingEstimate | null;
  readonly intent: IntentDistribution;
  readonly state: InteractionState;
  readonly calibration: CalibrationState;
}

interface TargetEvent {
  readonly targetId: TargetId;
  readonly confidence: Probability;
  readonly timestamp: Timestamp;
  readonly source: InputSource;
}

export type InteractionEvent =
  | (TargetEvent & { readonly type: 'target-enter' | 'target-update' | 'target-lock' })
  | (TargetEvent & {
      readonly type: 'target-leave';
      readonly reason: 'target-changed' | 'target-unavailable' | 'tracking-unavailable' | 'reset';
    })
  | (Selection & { readonly type: 'select' });

export interface EngineConfig {
  readonly minTrackingConfidence: Probability;
  readonly lockThreshold: Probability;
  readonly lockDurationMs: number;
  readonly dwellDurationMs: number;
  readonly cooldownDurationMs: number;
  readonly trackingTimeoutMs: number;
  readonly selectionMethod: SelectionMethod;
  readonly intent: {
    readonly weights: {
      readonly alignment: number;
      readonly distance: number;
      readonly motion: number;
      readonly history: number;
      readonly prior: number;
    };
    readonly softmaxTemperature: number;
    readonly temporalAlpha: Probability;
  };
  readonly smoothing:
    | { readonly method: 'ema'; readonly alpha: Probability }
    | { readonly method: 'kalman' | 'ekf'; readonly processNoise: number; readonly measurementNoise: number };
}

/** Live and scripted landmark providers share this boundary. */
export interface LandmarkProvider {
  readonly source: InputSource;
  subscribe(listener: (frame: LandmarkFrame) => void): Unsubscribe;
  start(): Promise<void>;
  stop(): void;
}

/** Common UI boundary for the live engine and a simulated intent provider. */
export interface InteractionOutput {
  getSnapshot(): EngineSnapshot;
  subscribe(listener: () => void): Unsubscribe;
  subscribeEvents(listener: (event: InteractionEvent) => void): Unsubscribe;
}

export interface InteractionEngine extends InteractionOutput {
  readonly targets: TargetRegistry;
  processFrame(frame: LandmarkFrame): void;
  /** Advances tracking timeout/cooldown even when the camera emits no frames. */
  tick(timestamp: Timestamp): void;
  reset(timestamp: Timestamp, options?: { readonly clearCalibration?: boolean }): void;
  dispose(): void;
}
