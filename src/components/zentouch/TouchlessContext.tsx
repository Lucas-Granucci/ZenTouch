import { createContext, useContext, useEffect, useRef, useState, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { inputTimedOut, KIOSK_HOLD_TIMING } from './feedbackModel'
import { SoftSnapOverlay } from './SoftSnapOverlay'
import { InteractionFeedback } from './InteractionFeedback'
import { SimulatedInputProvider } from '../../interaction/simulated/SimulatedInputProvider'

/**
 * Owns the one SimulatedInputProvider for the kiosk session and connects it to
 * the mouse. This is deliberately minimal glue, not the Phase 3 integration
 * layer: `src/interaction/react/InteractionProvider.tsx` and its hooks are
 * reserved for I1/I3 in IMPL.md and are not created here.
 */
const TouchlessContext = createContext<SimulatedInputProvider | null>(null)

export function TouchlessProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<SimulatedInputProvider | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const instance = new SimulatedInputProvider(KIOSK_HOLD_TIMING)
    // oxlint-disable-next-line react/set-state-in-effect
    setProvider(instance)
    return () => instance.dispose()
  }, [])

  useEffect(() => {
    if (!provider || !rootRef.current) return
    return provider.connectMouse(rootRef.current)
  }, [provider])

  return (
    <TouchlessContext.Provider value={provider}>
      <div ref={rootRef} style={{ display: 'contents' }}>
        {children}
        {provider && <SimulatedFeedback provider={provider} />}
      </div>
    </TouchlessContext.Provider>
  )
}

export function useTouchlessProvider(): SimulatedInputProvider | null {
  return useContext(TouchlessContext)
}

function SimulatedFeedback({ provider }: { provider: SimulatedInputProvider }) {
  const snapshot = useSyncExternalStore(provider.subscribe, provider.getSnapshot)
  const geometry = useMemo(() => createGeometryStore(provider), [provider])
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = provider.getSnapshot()
      if (inputTimedOut(current, performance.now())) {
        provider.reset()
        setTimedOut(true)
      } else if (current.tracking === 'tracking') {
        setTimedOut(false)
      }
    }, 500)
    return () => window.clearInterval(timer)
  }, [provider])
  const targets = useSyncExternalStore(geometry.subscribe, geometry.getSnapshot)
  return <>
    <SoftSnapOverlay snapshot={timedOut ? null : snapshot} targets={targets} />
    <InteractionFeedback snapshot={snapshot} timedOut={timedOut} />
  </>
}

// F3 returns a fresh array per read; cache it for React's external-store contract.
function createGeometryStore(provider: SimulatedInputProvider) {
  let targets = provider.targets.getSnapshot()
  return {
    getSnapshot: () => targets,
    subscribe: (listener: () => void) => {
      const unsubscribe = provider.targets.subscribe(() => {
        targets = provider.targets.getSnapshot()
        listener()
      })
      targets = provider.targets.getSnapshot()
      return unsubscribe
    },
  }
}
