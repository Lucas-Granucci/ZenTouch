import type { EngineSnapshot, InteractionState, RegisteredTarget, SelectionMethod } from '../../types/interaction'

const clamp = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0

// Shared with the kiosk simulator so visual progress follows actual phase durations.
export const KIOSK_HOLD_TIMING = { lockDurationMs: 250, dwellDurationMs: 1200 } as const

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

export const cursorStyles = [
  { id: 'cyan', family: 'beacon', label: 'Cyan beacon', description: 'A bright cyan center with a soft aura and a dark edge.', size: 70 },
  { id: 'beacon-violet', family: 'beacon', label: 'Violet beacon', description: 'A bright violet center with a soft aura and a dark edge.', size: 70 },
  { id: 'beacon-rose', family: 'beacon', label: 'Rose beacon', description: 'A bright rose center with a soft aura and a dark edge.', size: 70 },
  { id: 'beacon-amber', family: 'beacon', label: 'Amber beacon', description: 'A bright amber center with a soft aura and a dark edge.', size: 70 },
  { id: 'beacon-mint', family: 'beacon', label: 'Mint beacon', description: 'A bright mint center with a soft aura and a dark edge.', size: 70 },
  { id: 'lens-cyan', family: 'lens', label: 'Cyan lens', description: 'A translucent cyan disc with a crisp white and dark rim.', size: 80 },
  { id: 'violet', family: 'lens', label: 'Violet lens', description: 'A translucent violet disc with a crisp white and dark rim.', size: 80 },
  { id: 'lens-rose', family: 'lens', label: 'Rose lens', description: 'A translucent rose disc with a crisp white and dark rim.', size: 80 },
  { id: 'lens-amber', family: 'lens', label: 'Amber lens', description: 'A translucent amber disc with a crisp white and dark rim.', size: 80 },
  { id: 'lens-mint', family: 'lens', label: 'Mint lens', description: 'A translucent mint disc with a crisp white and dark rim.', size: 80 },
] as const

export type CursorStyle = typeof cursorStyles[number]['id']

export interface CursorSettings {
  style: CursorStyle
  size: number
  snapStrength: number
  hideProgress: boolean
}

export const defaultCursorSettings: CursorSettings = { style: 'lens-mint', size: 70, snapStrength: 0.25, hideProgress: true }

/** Geometry is in viewport CSS pixels. Attraction eases in within 24px of the leading element, capped at the configured strength. */
export function softSnapModel(snapshot: EngineSnapshot | null, targets: readonly RegisteredTarget[], timing = KIOSK_HOLD_TIMING as {
  readonly lockDurationMs: number
  readonly dwellDurationMs: number
}, snapStrength = defaultCursorSettings.snapStrength) {
  if (!snapshot?.pointing || snapshot.tracking !== 'tracking') return null
  const { x, y } = snapshot.pointing.position
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const target = targets.find((entry) => entry.enabled && entry.rect.width > 0 && entry.rect.height > 0 && entry.id === snapshot.intent.leadingTargetId)
  const intent = snapshot.intent.targets.find((entry) => entry.targetId === target?.id)
  const distance = target ? Math.hypot(
    Math.max(target.rect.x - x, 0, x - target.rect.x - target.rect.width),
    Math.max(target.rect.y - y, 0, y - target.rect.y - target.rect.height),
  ) : Infinity
  const proximity = clamp(1 - distance / 24)
  // Smoothly enter the attraction zone without a jump at the element boundary.
  const falloff = proximity * proximity * (3 - 2 * proximity)
  const attraction = intent ? Math.sqrt(clamp(intent.belief)) * clamp(snapStrength) * falloff : 0
  const state = snapshot.state
  return {
    x: target ? x + (target.rect.x + target.rect.width / 2 - x) * attraction : x,
    y: target ? y + (target.rect.y + target.rect.height / 2 - y) * attraction : y,
    phase: state.phase,
    progress: holdProgress(state, timing),
  }
}

export function interactionMessage(snapshot: EngineSnapshot | null, method: SelectionMethod = 'dwell'): string {
  if (!snapshot) return 'Hover over a choice and hold, or use touch or keyboard.'
  const state = snapshot.state
  if (state.phase === 'SELECT' || state.phase === 'COOLDOWN') return 'Selected. Pause briefly before your next choice.'
  if (snapshot.tracking === 'low-confidence') return 'Tracking is uncertain. Steady your hand or use touch or keyboard.'
  if (state.phase === 'IDLE' && state.reason === 'tracking-unavailable') return 'Input paused. Your order is saved. Point at a choice to resume, or use touch or keyboard.'
  if (snapshot.tracking !== 'tracking' && snapshot.tracking !== 'no-hand') return 'Touchless input is unavailable. Use touch or keyboard to continue.'
  if (state.phase === 'LOCKED' && method !== 'dwell') return method === 'pinch' ? 'Open your thumb and index finger, then pinch to select.' : method === 'fist' ? 'Open your palm, then close your fist to select.' : 'Move your hand toward the camera to select.'
  if (state.phase === 'POINTING' || state.phase === 'LOCKED') return method === 'dwell' ? 'Keep holding to select. Move away to cancel.' : 'Point steadily to lock a choice. Move away to cancel.'
  return snapshot.source === 'camera' ? 'Point at a choice, or use touch or keyboard.' : 'Hover over a choice and hold, or use touch or keyboard.'
}

/** A stalled input stream must not leave a frozen lock/glow on the screen. */
export function inputTimedOut(snapshot: EngineSnapshot, now: number, timeoutMs = 2000): boolean {
  return snapshot.tracking === 'tracking' && now - snapshot.timestamp >= timeoutMs
}
