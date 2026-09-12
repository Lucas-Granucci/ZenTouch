import type { InputSource, IntentDistribution, InteractionEvent, InteractionState, SelectionMethod, TrackedHand } from '../../types/interaction.ts';
import { createSelectionStrategy } from './strategies.ts';
import { lockEligible } from '../intent/temporal.ts';
export interface SelectionConfig { selectionMethod: SelectionMethod; lockThreshold: number; lockDurationMs: number; dwellDurationMs: number; cooldownDurationMs: number; highlightThreshold: number; highlightDistancePx: number; lockDistancePx: number }
export const defaultSelectionConfig: SelectionConfig = { selectionMethod: 'dwell', lockThreshold: 0.85, lockDurationMs: 300, dwellDurationMs: 1200, cooldownDurationMs: 900, highlightThreshold: 0.6, highlightDistancePx: 24, lockDistancePx: 0 };
let session = 0;
export class SelectionMachine {
  state: InteractionState = { phase: 'IDLE', since: 0, reason: 'startup' };
  private strategy;
  private leader: { id: string; confidence: number } | null = null;
  private serial = 0;
  private session = ++session;
  readonly config: SelectionConfig;
  constructor(config: SelectionConfig = defaultSelectionConfig) {
    this.config = { ...config };
    if (!Number.isFinite(config.lockThreshold) || config.lockThreshold < 0 || config.lockThreshold >= 1 ||
      [config.lockDurationMs, config.dwellDurationMs].some(n => !Number.isFinite(n) || n <= 0) || !Number.isFinite(config.cooldownDurationMs) || config.cooldownDurationMs < 0) throw new RangeError('Invalid selection configuration');
    if (!Number.isFinite(config.highlightThreshold) || config.highlightThreshold < 0 || config.highlightThreshold > config.lockThreshold ||
      !Number.isFinite(config.highlightDistancePx) || !Number.isFinite(config.lockDistancePx) || config.lockDistancePx < 0 || config.highlightDistancePx < config.lockDistancePx) throw new RangeError('Invalid targeting thresholds');
    this.strategy = createSelectionStrategy(config.selectionMethod, config.dwellDurationMs);
  }
  reset(timestamp: number, source: InputSource = 'camera'): InteractionEvent[] {
    const events: InteractionEvent[] = this.leader ? [{ type: 'target-leave', targetId: this.leader.id, confidence: this.leader.confidence, timestamp, source, reason: 'reset' }] : [];
    this.leader = null; this.strategy.reset(); this.state = { phase: 'IDLE', since: timestamp, reason: 'reset' }; return events;
  }
  update(intent: IntentDistribution, hand: TrackedHand | null, source: InputSource, timestamp = intent.timestamp,
    unavailableReason: 'target-unavailable' | 'tracking-unavailable' = 'tracking-unavailable', publish: (state: InteractionState, events: InteractionEvent[]) => void = () => {}, allowProgress = true, targetDistancePx = Infinity) {
    const events: InteractionEvent[] = [];
    const candidate = hand ? intent.targets.find(t => t.targetId === intent.leadingTargetId) : undefined;
    const c = this.config;
    // Relative softmax confidence alone cannot establish that a pointer is near a target.
    const target = candidate && targetDistancePx <= c.highlightDistancePx && candidate.probability > c.highlightThreshold && candidate.belief > c.highlightThreshold ? candidate : undefined;
    const changed = this.leader?.id !== target?.targetId;
    if (changed && this.leader) events.push({ type: 'target-leave', targetId: this.leader.id, confidence: this.leader.confidence, timestamp, source, reason: target ? 'target-changed' : unavailableReason });
    if (target) events.push({ type: changed ? 'target-enter' : 'target-update', targetId: target.targetId, confidence: target.belief, timestamp, source });
    this.leader = target ? { id: target.targetId, confidence: target.belief } : null;
    if (this.state.phase === 'COOLDOWN' && timestamp < this.state.until) { publish(this.state, events); return; }
    if (!target || !hand) { this.strategy.reset(); this.state = { phase: 'IDLE', since: timestamp, reason: hand ? 'no-targets' : 'tracking-unavailable' }; publish(this.state, events); return; }
    const canLock = targetDistancePx <= c.lockDistancePx && target.probability > c.lockThreshold && target.belief > c.lockThreshold;
    if (this.state.phase !== 'LOCKED' || changed || !canLock) {
      const previous = this.state;
      const lock = lockEligible(canLock ? Math.min(target.probability, target.belief) : 0, c.lockThreshold, previous.phase === 'POINTING' && !changed ? previous.lockStartedAt : null, timestamp, c.lockDurationMs);
      this.strategy.reset();
      this.state = { phase: 'POINTING', since: previous.phase === 'POINTING' && !changed ? previous.since : timestamp, targetId: target.targetId, confidence: target.belief, lockStartedAt: lock.startedAt, lockProgress: lock.progress };
      if (allowProgress && lock.progress === 1) {
        this.state = { phase: 'LOCKED', since: timestamp, targetId: target.targetId, confidence: target.belief, selectionProgress: 0 };
        events.push({ type: 'target-lock', targetId: target.targetId, confidence: target.belief, timestamp, source });
      }
    } else if (allowProgress) {
      const result = this.strategy.update(hand, timestamp, this.state.since);
      this.state = { ...this.state, confidence: target.belief, selectionProgress: result.progress };
      if (result.complete) {
        const selection = { id: `gesture-${this.session}-${++this.serial}`, targetId: target.targetId, confidence: target.belief, timestamp, source, method: c.selectionMethod };
        this.state = { phase: 'SELECT', since: timestamp, selection };
        publish(this.state, [...events, { ...selection, type: 'select' }]);
        this.strategy.reset(); this.state = { phase: 'COOLDOWN', since: timestamp, until: timestamp + c.cooldownDurationMs, selection };
        publish(this.state, []); return;
      }
    }
    publish(this.state, events);
  }
}
