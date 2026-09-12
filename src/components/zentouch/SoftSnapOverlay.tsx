import { useLayoutEffect, useRef } from 'react'
import type { EngineSnapshot, RegisteredTarget } from '../../types/interaction'
import { softSnapModel, cursorStyles, defaultCursorSettings, type CursorSettings } from './feedbackModel'
import './interaction.css'

export interface SoftSnapOverlayProps {
  readonly snapshot: EngineSnapshot | null
  readonly targets: readonly RegisteredTarget[]
  readonly cursor?: CursorSettings
  readonly timing?: { readonly lockDurationMs: number; readonly dwellDurationMs: number }
}

export function SoftSnapOverlay({ snapshot, targets, timing, cursor = defaultCursorSettings }: SoftSnapOverlayProps) {
  const glow = softSnapModel(snapshot, targets, timing, cursor.snapStrength)
  const node = useRef<HTMLDivElement>(null)
  const tracking = useRef(false)
  const source = snapshot?.source
  const x = glow?.x, y = glow?.y
  useLayoutEffect(() => {
    // A new input source starts without a retained camera position.
    node.current!.style.visibility = 'hidden'
    node.current!.dataset.positioned = 'false'
    tracking.current = false
  }, [source])
  useLayoutEffect(() => {
    const element = node.current!
    if (x === undefined || y === undefined) {
      if (tracking.current) {
        // Freeze at the displayed position, including an in-flight transition.
        const transform = getComputedStyle(element).transform
        element.style.transitionDuration = '0ms'
        element.style.transform = transform
      }
      tracking.current = false
      return
    }
    const first = element.style.visibility === 'hidden'
    element.style.transitionDuration = first ? '0ms' : tracking.current ? '80ms' : '240ms'
    element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
    element.style.visibility = 'visible'
    element.dataset.positioned = 'true'
    tracking.current = true
  }, [x, y, source])
  return (
    <div ref={node} className="soft-snap" aria-hidden="true" data-tracking={Boolean(glow)} data-phase={glow?.phase ?? 'IDLE'} data-style={cursor.style} data-family={cursorStyles.find(style => style.id === cursor.style)?.family}
      style={{ width: cursor.size, height: cursor.size }}>
      <CursorArtwork />
      {!cursor.hideProgress && <svg viewBox="0 0 100 100" className="soft-snap-progress">
        <circle cx="50" cy="50" r="43" fill="none" stroke="white" strokeWidth="7" />
        <circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" strokeWidth="4"
          pathLength="1" strokeDasharray="1" strokeDashoffset={1 - (glow?.progress ?? 0)} transform="rotate(-90 50 50)" />
      </svg>}
    </div>
  )
}

export function CursorArtwork() {
  return <div className="soft-snap-glow" />
}
