import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { EngineSnapshot, Unsubscribe } from '../../types/interaction'
import { holdProgress } from './feedbackModel'
import { useTouchlessProvider } from './TouchlessContext'

export interface TouchlessTargetState {
  readonly armed: boolean
  readonly phase: 'idle' | 'pointing' | 'locked'
  readonly progress: number
}

const IDLE_STATE: TouchlessTargetState = { armed: false, phase: 'idle', progress: 0 }
const noSubscribe = (): Unsubscribe => () => {}

function deriveState(snapshot: EngineSnapshot | null, id: string): TouchlessTargetState {
  if (!snapshot || snapshot.intent.leadingTargetId !== id) return IDLE_STATE
  const state = snapshot.state
  if (state.phase === 'POINTING') return { armed: true, phase: 'pointing', progress: holdProgress(state) }
  if (state.phase === 'LOCKED') return { armed: true, phase: 'locked', progress: holdProgress(state) }
  if (state.phase === 'SELECT') return { armed: true, phase: 'locked', progress: 1 }
  return IDLE_STATE
}

/**
 * Registers one interactive element with the shared SimulatedInputProvider and
 * reports whether it is the current hover leader. Both a completed gesture
 * selection and a native click call the same `onActivate`, deduplicated by
 * selection id, per specs/INTERACTION.md.
 */
export function useTouchlessTarget(id: string, enabled: boolean, onActivate: () => void) {
  const provider = useTouchlessProvider()
  const [node, setNode] = useState<HTMLElement | null>(null)
  const ref = useCallback((element: HTMLElement | null) => setNode(element), [])

  const onActivateRef = useRef(onActivate)
  const enabledRef = useRef(enabled)
  useEffect(() => {
    onActivateRef.current = onActivate
    enabledRef.current = enabled
  })

  const subscribe = useCallback((listener: () => void) => (provider ? provider.subscribe(listener) : noSubscribe()), [provider])
  const getSnapshot = useCallback(() => (provider ? provider.getSnapshot() : null), [provider])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)

  // Register on mount, unregister on unmount. Uses enabledRef so this effect
  // does not depend on `enabled` and re-register (registering a live ID is an error).
  useEffect(() => {
    if (!provider || !node) return
    const rectOf = () => {
      const rect = node.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }
    const unregister = provider.targets.register({ id, enabled: enabledRef.current, rect: rectOf() })
    const update = () => provider.targets.update({ id, enabled: enabledRef.current, rect: rectOf() })
    const observer = new ResizeObserver(update)
    observer.observe(node)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      unregister()
    }
  }, [provider, node, id])

  // Enabled changes update the already-registered target's eligibility.
  useEffect(() => {
    if (!provider || !node) return
    const rect = node.getBoundingClientRect()
    provider.targets.update({ id, enabled, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } })
  }, [provider, node, id, enabled])

  // A completed gesture selection activates exactly once per selection id.
  useEffect(() => {
    if (!provider) return
    const seen = new Set<string>()
    return provider.subscribeEvents((event) => {
      if (event.type === 'select' && event.targetId === id && enabledRef.current && !seen.has(event.id)) {
        seen.add(event.id)
        onActivateRef.current()
      }
    })
  }, [provider, id])

  const onClick = useCallback(() => {
    if (!enabledRef.current) return
    const state = provider?.getSnapshot().state
    if (state?.phase === 'SELECT' || state?.phase === 'COOLDOWN') return
    // Cancel a pending dwell before the native action can change the screen.
    provider?.reset()
    onActivateRef.current()
  }, [provider])

  return { ref, onClick, ...deriveState(snapshot, id) }
}
