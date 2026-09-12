import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useInteractionContext } from '../../hooks/useInteraction'
import { InteractionEngine } from '../../interaction/engine/InteractionEngine'
import { WelcomeScreen } from './screens/WelcomeScreen'
import { useKioskDispatch, useKioskState } from '../../state/kiosk/KioskStateProvider'
import { WakeGesture, WAVE_READING_DELAY_MS } from './wakeGesture'

const IDLE_MS = 60_000

export function IdleGate({ children }: { children: ReactNode }) {
  const { input } = useInteractionContext()
  const [sleeping, setSleeping] = useState(true)
  const surface = useRef<HTMLDivElement>(null)
  const { screen } = useKioskState()
  const dispatch = useKioskDispatch()
  const showingWelcome = sleeping || screen === 'welcome'
  const wake = useCallback(() => {
    input.reset(performance.now())
    if (screen === 'welcome') dispatch({ type: 'NAVIGATE_RESTAURANTS' })
    setSleeping(false)
  }, [input, screen, dispatch])

  useEffect(() => {
    if (showingWelcome) {
      const heading = surface.current?.querySelector('h1')
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
    }
    let lastActivity = performance.now()
    let lastFrame = -1
    let lastPosition: { x: number; y: number } | null = null
    const wave = new WakeGesture(lastActivity + WAVE_READING_DELAY_MS)
    let waveHandId: string | null = null
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
      if (showingWelcome) {
        if (waveHandId !== (hand?.id ?? null)) wave.reset()
        waveHandId = hand?.id ?? null
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
      if (!showingWelcome && performance.now() - lastActivity >= IDLE_MS) {
        setSleeping(true)
        input.reset(performance.now())
      }
    }, 1000)
    return () => {
      unsubscribe(); unsubscribeEvents(); clearInterval(timer)
      for (const event of events) element?.removeEventListener(event, activity)
    }
  }, [input, showingWelcome, wake])

  return <div ref={surface}>
    {showingWelcome ? <WelcomeScreen onBegin={wake} resuming={screen !== 'welcome'} /> : children}
  </div>
}
