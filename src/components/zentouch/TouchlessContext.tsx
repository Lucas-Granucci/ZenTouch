import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
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
    const instance = new SimulatedInputProvider()
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
      </div>
    </TouchlessContext.Provider>
  )
}

export function useTouchlessProvider(): SimulatedInputProvider | null {
  return useContext(TouchlessContext)
}
