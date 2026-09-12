import { useLayoutEffect, useRef } from 'react'
import type { EngineSnapshot, RegisteredTarget } from '../../types/interaction'
import { softSnapModel, cursorStyles, defaultCursorSettings, type CursorSettings } from './feedbackModel'
import { CursorMotion } from './CursorMotion'
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
  const motion = useRef(new CursorMotion())
  const animation = useRef(0)
  const source = snapshot?.source
  const x = glow?.x, y = glow?.y
  useLayoutEffect(() => {
    // A new input source starts without a retained camera position.
    node.current!.style.visibility = 'hidden'
    node.current!.dataset.positioned = 'false'
    motion.current.reset()
    return () => {
      cancelAnimationFrame(animation.current)
      animation.current = 0
    }
  }, [source])
  useLayoutEffect(() => {
    const element = node.current!
    const controller = motion.current
    controller.setTarget(x === undefined || y === undefined ? null : { x, y }, performance.now())
    if (x === undefined || y === undefined) {
      cancelAnimationFrame(animation.current)
      animation.current = 0
      return
    }
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    const draw = () => {
      const position = controller.position!
      element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`
      element.style.visibility = 'visible'
      element.dataset.positioned = 'true'
    }
    const animate = (now: number) => {
      animation.current = 0
      const moving = controller.advance(now, preference.matches)
      draw()
      if (moving) animation.current = requestAnimationFrame(animate)
    }
    // Draw the retained position immediately; subsequent frames preserve velocity
    // even when a new camera sample changes the destination.
    draw()
    if (!animation.current) animation.current = requestAnimationFrame(animate)
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
