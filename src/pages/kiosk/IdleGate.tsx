import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useInteractionContext } from '../../hooks/useInteraction'
import { InteractionEngine } from '../../interaction/engine/InteractionEngine'
import { DeviceFrame } from './DeviceFrame'
import { WakeGesture } from './wakeGesture'

const IDLE_MS = 60_000

export function IdleGate({ children }: { children: ReactNode }) {
  const { input } = useInteractionContext()
  const [sleeping, setSleeping] = useState(true)
  const surface = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (sleeping) heading.current?.focus({ preventScroll: true })
    let lastActivity = performance.now()
    let lastFrame = -1
    let lastPosition: { x: number; y: number } | null = null
    const wave = new WakeGesture()
    const wake = () => { input.reset(performance.now()); setSleeping(false) }
    const activity = () => { lastActivity = performance.now() }
    const element = surface.current
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const
    for (const event of events) element?.addEventListener(event, activity, { passive: true })
    const unsubscribe = input.subscribe(() => {
      if (!(input instanceof InteractionEngine)) return
      const frame = input.frame
      if (!frame || frame.timestamp === lastFrame) return
      lastFrame = frame.timestamp
      const hand = frame.status === 'tracking' && frame.hands.length === 1 ? frame.hands[0] : null
      const wrist = hand?.landmarks[0] ?? null
      const now = performance.now()
      if (sleeping) {
        if (wave.update(wrist?.x ?? null, now)) wake()
      } else if (wrist) {
        if (!lastPosition || Math.hypot(wrist.x - lastPosition.x, wrist.y - lastPosition.y) > 0.015) {
          lastActivity = now
          lastPosition = wrist
        }
      } else lastPosition = null
    })
    const unsubscribeEvents = input.subscribeEvents(event => {
      if (event.type === 'select') activity()
    })
    const timer = window.setInterval(() => {
      if (!sleeping && performance.now() - lastActivity >= IDLE_MS) {
        setSleeping(true)
        input.reset(performance.now())
      }
    }, 1000)
    return () => {
      unsubscribe(); unsubscribeEvents(); clearInterval(timer)
      for (const event of events) element?.removeEventListener(event, activity)
    }
  }, [input, sleeping])

  return <div ref={surface}>
    {sleeping ? <DeviceFrame className="h-[calc(var(--kiosk-viewport,100dvh)-var(--frame-inset,0px))]">
      <img src="/kiosk/bayou-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover grayscale" />
      <div className="absolute inset-0 bg-neutral-800/85" />
      <div className="relative flex w-full flex-col items-center justify-center px-8 py-12 text-center text-white">
        <svg className="mb-7 h-24 w-24" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 34V17a4 4 0 0 1 8 0v15-21a4 4 0 0 1 8 0v21-18a4 4 0 0 1 8 0v20-12a4 4 0 0 1 8 0v18c0 12-7 20-18 20-7 0-12-4-16-10L10 36a4 4 0 0 1 6-5l6 7" />
          <path d="M10 10a21 21 0 0 0-5 15M54 5a23 23 0 0 1 6 12" />
        </svg>
        <h1 ref={heading} tabIndex={-1} className="text-5xl font-bold tracking-tight sm:text-6xl">Wave to begin</h1>
        <p className="mt-5 text-xl text-white/90">Hold your hand about 2 ft in front of the screen.</p>
        <p className="mt-2 text-lg text-white/80">Hover over items to select.</p>
        <button type="button" className="mt-9 rounded-full border border-white/50 px-6 py-3 text-base text-white focus-visible:outline-white" onClick={() => { input.reset(performance.now()); setSleeping(false) }}>Or tap to begin</button>
      </div>
    </DeviceFrame> : children}
  </div>
}
