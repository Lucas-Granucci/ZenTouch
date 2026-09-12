import type { EngineSnapshot, RegisteredTarget } from '../../types/interaction'
import { softSnapModel, defaultCursorSettings, type CursorSettings } from './feedbackModel'
import './interaction.css'

export interface SoftSnapOverlayProps {
  readonly snapshot: EngineSnapshot | null
  readonly targets: readonly RegisteredTarget[]
  readonly cursor?: CursorSettings
  readonly timing?: { readonly lockDurationMs: number; readonly dwellDurationMs: number }
}

export function SoftSnapOverlay({ snapshot, targets, timing, cursor = defaultCursorSettings }: SoftSnapOverlayProps) {
  const glow = softSnapModel(snapshot, targets, timing, cursor.snapStrength)
  if (!glow) return null
  return (
    <div className="soft-snap" aria-hidden="true" data-phase={glow.phase}
      style={{ left: glow.x, top: glow.y, width: cursor.size, height: cursor.size }}>
      <div className="soft-snap-glow" />
      {!cursor.hideProgress && <svg viewBox="0 0 100 100" className="soft-snap-progress">
        <circle cx="50" cy="50" r="43" fill="none" stroke="white" strokeWidth="7" />
        <circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" strokeWidth="4"
          pathLength="1" strokeDasharray={`${glow.progress} 1`} transform="rotate(-90 50 50)" />
      </svg>}
    </div>
  )
}
