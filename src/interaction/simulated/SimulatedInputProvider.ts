import { softSnapPosition } from '../pointing/softSnap.ts'
import type {
  EngineSnapshot, InteractionEvent, InteractionOutput, InteractionState,
  Point2, RegisteredTarget, TargetRegistry, Unsubscribe,
} from '../../types/interaction.ts'

export interface SimulatedInputOptions {
  lockDurationMs?: number
  dwellDurationMs?: number
  cooldownDurationMs?: number
  /** Inject a monotonic clock for deterministic scripts. */
  now?: () => number
}

/** A UI simulator, not a landmark provider or the production intent engine. */
export class SimulatedInputProvider implements InteractionOutput {
  readonly source = 'simulated' as const
  readonly targets: TargetRegistry
  private readonly now: () => number
  private readonly lockMs: number
  private readonly dwellMs: number
  private readonly cooldownMs: number
  private readonly registered = new Map<string, RegisteredTarget>()
  private readonly listeners = new Set<() => void>()
  private readonly eventListeners = new Set<(event: InteractionEvent) => void>()
  private readonly registryListeners = new Set<() => void>()
  private snapshot: EngineSnapshot
  private sequence = 0
  private disposed = false
  private disconnect: Unsubscribe | null = null

  constructor(options: SimulatedInputOptions = {}) {
    this.now = options.now ?? (() => performance.now())
    this.lockMs = options.lockDurationMs ?? 250
    this.dwellMs = options.dwellDurationMs ?? 1200
    this.cooldownMs = options.cooldownDurationMs ?? 600
    for (const [name, value] of Object.entries({ lock: this.lockMs, dwell: this.dwellMs, cooldown: this.cooldownMs })) {
      if (!Number.isFinite(value) || value < 0 || (name !== 'cooldown' && value === 0)) {
        throw new RangeError(`Invalid ${name} duration`)
      }
    }
    const timestamp = this.now()
    if (!Number.isFinite(timestamp) || timestamp < 0) throw new RangeError('Invalid timestamp')
    this.snapshot = {
      timestamp, source: 'simulated', tracking: 'no-hand', activeHandId: null,
      pointing: null, intent: { timestamp, targets: [], leadingTargetId: null },
      state: { phase: 'IDLE', since: timestamp, reason: 'startup' },
      calibration: { status: 'uncalibrated' },
    }
    this.targets = {
      register: (target) => {
        this.assertActive()
        if (this.registered.has(target.id)) throw new Error(`Duplicate target: ${target.id}`)
        this.registered.set(target.id, this.copyTarget(target))
        this.registryChanged()
        let removed = false
        return () => {
          if (removed || this.disposed) return
          removed = true
          this.registered.delete(target.id)
          this.registryChanged()
        }
      },
      update: (target) => {
        this.assertActive()
        if (!this.registered.has(target.id)) throw new Error(`Unknown target: ${target.id}`)
        this.registered.set(target.id, this.copyTarget(target))
        this.registryChanged()
      },
      getSnapshot: () => Object.freeze([...this.registered.values()]),
      subscribe: (listener) => this.listen(this.registryListeners, listener),
    }
    this.publish(this.snapshot)
  }

  getSnapshot = (): EngineSnapshot => this.snapshot
  subscribe = (listener: () => void): Unsubscribe => this.listen(this.listeners, listener)
  subscribeEvents = (listener: (event: InteractionEvent) => void): Unsubscribe => this.listen(this.eventListeners, listener)

  /** Explicit scripted intent. Null simulates tracking loss. */
  pointAt(targetId: string | null, timestamp = this.now(), position?: Point2): void {
    this.checkTime(timestamp)
    const target = targetId === null ? undefined : this.registered.get(targetId)
    if (targetId !== null && (!target || !this.eligible(target))) throw new Error(`Ineligible target: ${targetId}`)
    const point = position ?? (target && { x: target.rect.x + target.rect.width / 2, y: target.rect.y + target.rect.height / 2 })
    if (point && (!Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new RangeError('Invalid position')
    const previous = this.snapshot.intent.leadingTargetId
    if (previous === targetId) {
      if (point) this.publish({ ...this.snapshot, timestamp, pointing: this.pointing(timestamp, point), intent: { ...this.snapshot.intent, timestamp } })
      this.tick(timestamp)
      return
    }
    if (previous !== null) this.clear(timestamp, targetId === null ? 'tracking-unavailable' : 'target-changed')
    if (!target || !point) return
    const previousState = this.snapshot.state
    const state: InteractionState = previousState.phase === 'COOLDOWN' ? previousState
      : previousState.phase === 'SELECT'
        ? { phase: 'COOLDOWN', since: previousState.since, until: previousState.since + this.cooldownMs, selection: previousState.selection }
        : this.pointingState(timestamp, target.id)
    this.publish({
      ...this.snapshot, timestamp, tracking: 'tracking', activeHandId: 'simulated-hand',
      pointing: this.pointing(timestamp, point),
      intent: { timestamp, targets: [{ targetId: target.id, score: 1, probability: 1, belief: 1 }], leadingTargetId: target.id },
      state,
    }, { type: 'target-enter', targetId: target.id, confidence: 1, timestamp, source: 'simulated' })
  }

  /** Advance simulated dwell. Large jumps enter each phase without backdating events. */
  tick(timestamp = this.now()): void {
    this.checkTime(timestamp)
    const targetId = this.snapshot.intent.leadingTargetId
    let state = this.snapshot.state
    if (state.phase === 'COOLDOWN') {
      if (timestamp >= state.until) state = targetId === null
        ? { phase: 'IDLE', since: timestamp, reason: 'tracking-unavailable' }
        : this.pointingState(timestamp, targetId)
    } else if (state.phase === 'POINTING') {
      const progress = Math.min(1, (timestamp - state.since) / this.lockMs)
      if (progress === 1) {
        this.publish({ ...this.snapshot, timestamp, state: { phase: 'LOCKED', since: timestamp, targetId: state.targetId, confidence: 1, selectionProgress: 0 } },
          { type: 'target-lock', targetId: state.targetId, confidence: 1, timestamp, source: 'simulated' })
        return
      }
      state = { ...state, lockProgress: progress }
    } else if (state.phase === 'LOCKED') {
      const progress = Math.min(1, (timestamp - state.since) / this.dwellMs)
      if (progress === 1) {
        const selection = { id: `simulated-${++this.sequence}`, targetId: state.targetId, confidence: 1, timestamp, source: this.source, method: 'dwell' as const }
        this.publish({ ...this.snapshot, timestamp, state: { phase: 'SELECT', since: timestamp, selection } }, { ...selection, type: 'select' })
        // A select subscriber may reset/dispose or navigate synchronously.
        if (!this.disposed && this.snapshot.state.phase === 'SELECT') {
          this.publish({ ...this.snapshot, state: { phase: 'COOLDOWN', since: timestamp, until: timestamp + this.cooldownMs, selection } })
        }
        return
      }
      state = { ...state, selectionProgress: progress }
    }
    this.publish({ ...this.snapshot, timestamp, state, intent: { ...this.snapshot.intent, timestamp } })
  }

  reset(timestamp = this.now()): void {
    this.checkTime(timestamp)
    this.clear(timestamp, 'reset')
  }

  /** Mouse hit testing is intentionally only a simulation of intent. Never handles clicks. */
  connectMouse(surface: HTMLElement): Unsubscribe {
    this.assertActive()
    this.disconnect?.()
    let position: Point2 | null = null
    let frame = 0
    const move = (event: PointerEvent) => { if (event.pointerType === 'mouse') position = { x: event.clientX, y: event.clientY } }
    const leave = () => { position = null; this.pointAt(null) }
    const advance = () => {
      if (position) {
        const { x, y } = position
        const target = [...this.registered.values()].filter((entry) => this.eligible(entry) && x >= entry.rect.x && x <= entry.rect.x + entry.rect.width && y >= entry.rect.y && y <= entry.rect.y + entry.rect.height)
          .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)[0]
        this.pointAt(target?.id ?? null, this.now(), position)
      } else this.tick()
      if (connected) frame = requestAnimationFrame(advance)
    }
    let connected = true
    surface.addEventListener('pointermove', move)
    surface.addEventListener('pointerleave', leave)
    window.addEventListener('blur', leave)
    frame = requestAnimationFrame(advance)
    const disconnect = () => {
      if (!connected) return
      connected = false
      cancelAnimationFrame(frame)
      surface.removeEventListener('pointermove', move)
      surface.removeEventListener('pointerleave', leave)
      window.removeEventListener('blur', leave)
      if (!this.disposed) this.pointAt(null)
      this.disconnect = null
    }
    this.disconnect = disconnect
    return disconnect
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.disconnect?.()
    this.listeners.clear()
    this.eventListeners.clear()
    this.registryListeners.clear()
    this.registered.clear()
  }

  private pointing(timestamp: number, position: Point2) {
    return { timestamp, handId: 'simulated-hand', position: { ...softSnapPosition(position, this.targets.getSnapshot()) }, direction: null, velocity: null, confidence: 1 } as const
  }

  private pointingState(timestamp: number, targetId: string): InteractionState {
    return { phase: 'POINTING', since: timestamp, targetId, confidence: 1, lockStartedAt: timestamp, lockProgress: 0 }
  }

  private clear(timestamp: number, reason: 'target-changed' | 'target-unavailable' | 'tracking-unavailable' | 'reset') {
    const targetId = this.snapshot.intent.leadingTargetId
    const oldState = this.snapshot.state
    const state: InteractionState = reason !== 'reset' && (oldState.phase === 'COOLDOWN' || oldState.phase === 'SELECT')
      ? oldState.phase === 'COOLDOWN' ? oldState : { phase: 'COOLDOWN', since: oldState.since, until: oldState.since + this.cooldownMs, selection: oldState.selection }
      : { phase: 'IDLE', since: timestamp, reason: reason === 'reset' ? 'reset' : reason === 'target-unavailable' ? 'no-targets' : 'tracking-unavailable' }
    this.publish({ ...this.snapshot, timestamp, tracking: 'no-hand', activeHandId: null, pointing: null, intent: { timestamp, targets: [], leadingTargetId: null }, state },
      targetId === null ? undefined : { type: 'target-leave', targetId, confidence: 1, timestamp, source: 'simulated', reason })
  }

  private registryChanged() {
    const id = this.snapshot.intent.leadingTargetId
    if (id !== null) {
      const target = this.registered.get(id)
      if (!target || !this.eligible(target)) this.clear(Math.max(this.now(), this.snapshot.timestamp), 'target-unavailable')
    }
    for (const listener of [...this.registryListeners]) listener()
  }

  private eligible(target: RegisteredTarget) {
    const { x, y, width, height } = target.rect
    return target.enabled && width > 0 && height > 0 && x + width > 0 && y + height > 0 &&
      (typeof window === 'undefined' || (x < window.innerWidth && y < window.innerHeight))
  }

  private copyTarget(target: RegisteredTarget): RegisteredTarget {
    if (!target.id || !Object.values(target.rect).every(Number.isFinite) || target.rect.width < 0 || target.rect.height < 0 ||
      (target.priority !== undefined && (!Number.isFinite(target.priority) || target.priority < 0))) throw new RangeError('Invalid target')
    return Object.freeze({ ...target, rect: Object.freeze({ ...target.rect }) })
  }

  private assertActive() { if (this.disposed) throw new Error('Simulator is disposed') }
  private checkTime(timestamp: number) {
    this.assertActive()
    if (!Number.isFinite(timestamp) || timestamp < this.snapshot.timestamp) throw new RangeError('Timestamp must be finite and monotonic')
  }

  private listen<T>(listeners: Set<T>, listener: T): Unsubscribe {
    this.assertActive()
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }

  private publish(snapshot: EngineSnapshot, event?: InteractionEvent) {
    // Freeze nested records too: consumers must not mutate future snapshots.
    const freeze = (value: unknown): void => {
      if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(freeze)
        Object.freeze(value)
      }
    }
    freeze(snapshot)
    this.snapshot = snapshot
    for (const listener of [...this.listeners]) { if (!this.disposed) listener() }
    if (event) {
      freeze(event)
      for (const listener of [...this.eventListeners]) { if (!this.disposed) listener(event) }
    }
  }
}
