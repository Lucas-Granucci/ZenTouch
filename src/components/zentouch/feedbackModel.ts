import type { EngineSnapshot, InteractionState, RegisteredTarget } from '../../types/interaction'

const clamp = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0

// Shared with the kiosk simulator so visual progress follows actual phase durations.
export const KIOSK_HOLD_TIMING = { lockDurationMs: 250, dwellDurationMs: 800 } as const

/** One continuous fill across both internal phases, with no restart at lock. */
export function holdProgress(state: InteractionState, timing = KIOSK_HOLD_TIMING as {
  readonly lockDurationMs: number
  readonly dwellDurationMs: number
}): number {
  const lockShare = timing.lockDurationMs / (timing.lockDurationMs + timing.dwellDurationMs)
  if (state.phase === 'POINTING') return clamp(state.lockProgress) * lockShare
  if (state.phase === 'LOCKED') return lockShare + clamp(state.selectionProgress) * (1 - lockShare)
  if (state.phase === 'SELECT' || state.phase === 'COOLDOWN') return 1
  return 0
}

/** Geometry is in viewport CSS pixels. Attraction follows temporal intent, never distance. */
export function softSnapModel(snapshot: EngineSnapshot | null, targets: readonly RegisteredTarget[], timing = KIOSK_HOLD_TIMING as {
  readonly lockDurationMs: number
  readonly dwellDurationMs: number
}) {
  if (!snapshot?.pointing || snapshot.tracking !== 'tracking' || snapshot.state.phase === 'IDLE') return null
  const { x, y } = snapshot.pointing.position
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const target = targets.find((entry) => entry.enabled && entry.id === snapshot.intent.leadingTargetId)
  const intent = snapshot.intent.targets.find((entry) => entry.targetId === target?.id)
  const attraction = target && intent ? clamp(intent.belief) : 0
  const state = snapshot.state
  return {
    x: target ? x + (target.rect.x + target.rect.width / 2 - x) * attraction : x,
    y: target ? y + (target.rect.y + target.rect.height / 2 - y) * attraction : y,
    phase: state.phase,
    progress: holdProgress(state, timing),
  }
}

export function interactionMessage(snapshot: EngineSnapshot | null): string {
  if (!snapshot) return 'Hover over a choice and hold, or use touch or keyboard.'
  const state = snapshot.state
  if (state.phase === 'SELECT' || state.phase === 'COOLDOWN') return 'Selected. Pause briefly before your next choice.'
  if (snapshot.tracking === 'low-confidence') return 'Tracking is uncertain. Steady your hand or use touch or keyboard.'
  if (state.phase === 'IDLE' && state.reason === 'tracking-unavailable') return 'Input paused. Your order is saved. Point at a choice to resume, or use touch or keyboard.'
  if (snapshot.tracking !== 'tracking' && snapshot.tracking !== 'no-hand') return 'Touchless input is unavailable. Use touch or keyboard to continue.'
  if (state.phase === 'POINTING' || state.phase === 'LOCKED') return 'Keep holding to select. Move away to cancel.'
  return 'Hover over a choice and hold, or use touch or keyboard.'
}

/** A stalled input stream must not leave a frozen lock/glow on the screen. */
export function inputTimedOut(snapshot: EngineSnapshot, now: number, timeoutMs = 2000): boolean {
  return snapshot.tracking === 'tracking' && now - snapshot.timestamp >= timeoutMs
}
