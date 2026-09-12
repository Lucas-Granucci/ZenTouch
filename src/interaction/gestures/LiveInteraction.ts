import type { EngineSnapshot, InteractionEvent, LandmarkFrame, Point2, PointingEstimate, TargetRegistry, TrackedHand, ViewportRect } from '../../types/interaction.ts';
import { scoreTargets, defaultIntentConfig } from '../intent/scoring.ts';
import { TemporalBelief } from '../intent/temporal.ts';
import { SelectionMachine, defaultSelectionConfig } from './SelectionMachine.ts';
import type { SelectionConfig } from './SelectionMachine.ts';

/** G5–G9 composition for an already projected/filtered/calibrated camera signal. */
export class LiveInteraction {
  private belief: TemporalBelief;
  private machine: SelectionMachine;
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(event: InteractionEvent) => void>();
  private unsubscribe: () => void;
  private clock = -1;
  private lastFrame = -1;
  private hand: TrackedHand | null = null;
  private disposed = false;
  private screenDirection: Point2 | null = null;
  private geometry: string | null = null;
  private processing = false;
  private registryPending = false;
  private snapshot: EngineSnapshot = { timestamp: 0, source: 'camera', tracking: 'unavailable', activeHandId: null, pointing: null,
    intent: { timestamp: 0, targets: [], leadingTargetId: null }, state: { phase: 'IDLE', since: 0, reason: 'startup' }, calibration: { status: 'uncalibrated' } };
  private targets: TargetRegistry;
  private viewport: () => ViewportRect;
  private intentConfig: typeof defaultIntentConfig;
  private timeout: number;
  constructor(targets: TargetRegistry, viewport: () => ViewportRect,
    config: SelectionConfig = defaultSelectionConfig, intentConfig = defaultIntentConfig, timeout = 250) {
    this.targets = targets; this.viewport = viewport; this.intentConfig = { ...intentConfig, weights: { ...intentConfig.weights } }; this.timeout = timeout;
    this.machine = new SelectionMachine(config); this.belief = new TemporalBelief(intentConfig.temporalAlpha);
    this.unsubscribe = targets.subscribe(() => {
      if (this.disposed) return;
      if (this.processing) { this.registryPending = true; return; }
      const timestamp = Math.max(0, this.clock);
      // Refresh eligibility immediately, but never select using a layout notification.
      this.recompute(timestamp, 'target-unavailable', false);
    });
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  subscribeEvents = (listener: (event: InteractionEvent) => void) => { this.eventListeners.add(listener); return () => { this.eventListeners.delete(listener); }; };
  private publish = (state: EngineSnapshot['state'], events: InteractionEvent[]) => {
    this.snapshot = { ...this.snapshot, state };
    for (const listener of this.listeners) listener();
    for (const event of events) for (const listener of this.eventListeners) listener(event);
  };
  process(frame: LandmarkFrame, pointing: PointingEstimate | null, calibration: EngineSnapshot['calibration'] = { status: 'uncalibrated' }) {
    if (this.disposed || !Number.isFinite(frame.timestamp) || frame.timestamp <= this.lastFrame || frame.timestamp < this.clock) return;
    if (this.lastFrame >= 0 && frame.timestamp - this.lastFrame >= this.timeout) {
      this.hand = null; this.belief.reset();
      this.snapshot = { ...this.snapshot, timestamp: frame.timestamp, pointing: null, activeHandId: null, intent: { timestamp: frame.timestamp, targets: [], leadingTargetId: null } };
      this.machine.update(this.snapshot.intent, null, frame.source, frame.timestamp, 'tracking-unavailable', this.publish);
    }
    this.clock = frame.timestamp; this.lastFrame = frame.timestamp;
    const viewport = this.viewport();
    const geometry = JSON.stringify([viewport, frame.previewMirrored, calibration]);
    if (this.geometry !== null && this.geometry !== geometry) {
      this.belief.reset();
      if (this.machine.state.phase !== 'COOLDOWN') { const events = this.machine.reset(frame.timestamp); this.publish(this.machine.state, events); }
    }
    this.geometry = geometry;
    const direction = pointing?.direction;
    this.screenDirection = direction ? { x: direction.x * viewport.width * (frame.previewMirrored ? -1 : 1), y: direction.y * viewport.height } : null;
    if (this.screenDirection && calibration.status === 'calibrated') {
      const [a, b, , c, d] = calibration.transform, v = this.screenDirection;
      this.screenDirection = { x: a * v.x + b * v.y, y: c * v.x + d * v.y };
    }
    const hand = frame.status === 'tracking' && frame.hands.length === 1 && Number.isFinite(frame.hands[0].confidence) && frame.hands[0].confidence >= 0.5 && frame.hands[0].confidence <= 1 && pointing && pointing.handId === frame.hands[0].id && pointing.timestamp === frame.timestamp && [pointing.position.x, pointing.position.y].every(Number.isFinite) ? frame.hands[0] : null;
    if (hand && this.hand && hand.id !== this.hand.id) {
      this.belief.reset();
      if (this.machine.state.phase !== 'COOLDOWN') { const events = this.machine.reset(frame.timestamp); this.publish(this.machine.state, events); }
    }
    this.hand = hand;
    this.snapshot = { ...this.snapshot, timestamp: frame.timestamp, source: frame.source, tracking: frame.status, pointing: hand ? pointing : null, activeHandId: hand?.id ?? null, calibration };
    this.recompute(frame.timestamp);
  }
  private recompute(timestamp: number, reason: 'tracking-unavailable' | 'target-unavailable' = 'tracking-unavailable', allowProgress = true) {
    const p = this.snapshot.pointing;
    if (!p || !this.hand) this.belief.reset();
    const intent = p && this.hand ? this.belief.update(scoreTargets({ ...p, timestamp }, this.targets.getSnapshot(), this.viewport(), this.intentConfig, this.belief.history, this.screenDirection)) : { timestamp, targets: [], leadingTargetId: null };
    this.snapshot = { ...this.snapshot, timestamp, intent };
    const target = this.targets.getSnapshot().find(t => t.id === intent.leadingTargetId);
    const r = target?.rect;
    const targetDistance = p && r ? Math.hypot(Math.max(r.x - p.position.x, 0, p.position.x - r.x - r.width), Math.max(r.y - p.position.y, 0, p.position.y - r.y - r.height)) : Infinity;
    this.processing = true;
    try { this.machine.update(intent, this.hand, this.snapshot.source, timestamp, reason, this.publish, allowProgress, targetDistance); }
    finally { this.processing = false; }
    if (this.registryPending) { this.registryPending = false; this.recompute(timestamp, 'target-unavailable', false); }
  }
  tick(timestamp: number) {
    if (this.disposed || !Number.isFinite(timestamp) || timestamp < this.clock) return;
    this.clock = timestamp;
    if (timestamp - this.lastFrame >= this.timeout && ['tracking', 'no-hand', 'low-confidence', 'multiple-hands'].includes(this.snapshot.tracking)) {
      this.hand = null; this.snapshot = { ...this.snapshot, pointing: null, activeHandId: null, tracking: 'interrupted' }; this.recompute(timestamp);
    } else if (this.machine.state.phase === 'COOLDOWN' && timestamp >= this.machine.state.until) {
      // A clock tick may expire cooldown, but cannot select from stale landmarks.
      this.snapshot = { ...this.snapshot, timestamp };
      this.machine.update({ timestamp, targets: [], leadingTargetId: null }, null, this.snapshot.source, timestamp, 'tracking-unavailable', this.publish);
    }
  }
  reset(timestamp: number) {
    if (this.disposed || !Number.isFinite(timestamp) || timestamp < this.clock) return;
    this.clock = timestamp; this.hand = null; this.belief.reset(); this.geometry = null;
    this.snapshot = { ...this.snapshot, timestamp, pointing: null, activeHandId: null,
      intent: { timestamp, targets: [], leadingTargetId: null } };
    const events = this.machine.reset(timestamp, this.snapshot.source);
    this.publish(this.machine.state, events);
  }
  dispose() { this.disposed = true; this.unsubscribe(); this.listeners.clear(); this.eventListeners.clear(); }
}
