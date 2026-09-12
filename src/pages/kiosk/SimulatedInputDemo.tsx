import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { SimulatedInputProvider } from '../../interaction/simulated/SimulatedInputProvider'

export function SimulatedInputDemo() {
  const [provider, setProvider] = useState<SimulatedInputProvider | null>(null)
  useEffect(() => {
    const instance = new SimulatedInputProvider()
    // Create/dispose the external resource together, including StrictMode effect replay.
    // oxlint-disable-next-line react/set-state-in-effect
    setProvider(instance)
    return () => instance.dispose()
  }, [])
  return provider ? <DemoControls provider={provider} /> : null
}

function DemoControls({ provider }: { provider: SimulatedInputProvider }) {
  const surface = useRef<HTMLElement>(null)
  const snapshot = useSyncExternalStore(provider.subscribe, provider.getSnapshot)
  const [counts, setCounts] = useState<Record<string, number>>({ tea: 0, coffee: 0 })
  const [events, setEvents] = useState<string[]>([])
  const activate = (id: string) => setCounts((previous) => ({ ...previous, [id]: (previous[id] ?? 0) + 1 }))

  useEffect(() => {
    const element = surface.current!
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('[data-target]')]
    const target = (button: HTMLButtonElement) => {
      const rect = button.getBoundingClientRect()
      return { id: button.dataset.target!, enabled: !button.disabled, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }
    }
    const unregister = buttons.map((button) => provider.targets.register(target(button)))
    const update = () => buttons.forEach((button) => provider.targets.update(target(button)))
    const observer = new ResizeObserver(update)
    buttons.forEach((button) => observer.observe(button))
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const seen = new Set<string>()
    const unsubscribe = provider.subscribeEvents((event) => {
      setEvents((previous) => [`${event.type}: ${event.targetId}`, ...previous].slice(0, 6))
      if (event.type === 'select' && !seen.has(event.id) && provider.targets.getSnapshot().some((entry) => entry.id === event.targetId && entry.enabled)) {
        seen.add(event.id)
        activate(event.targetId)
      }
    })
    const disconnect = provider.connectMouse(element)
    return () => {
      disconnect()
      unsubscribe()
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      unregister.forEach((remove) => remove())
    }
  }, [provider])

  const state = snapshot.state
  const progress = state.phase === 'POINTING' ? state.lockProgress : state.phase === 'LOCKED' ? state.selectionProgress : 0
  return (
    <main ref={surface} className="mx-auto min-h-dvh max-w-3xl space-y-8 p-8 text-stone-900">
      <a href="/" className="text-teal-800 underline">Back to welcome</a>
      <h1 className="text-4xl font-semibold">Simulated input</h1>
      <p>Move your mouse onto a drink and hold still. It locks after 250 ms, then selects after another 800 ms. Move away to cancel. Staying on it repeats after cooldown.</p>
      <div className="grid grid-cols-2 gap-6">
        {['tea', 'coffee'].map((id) => (
          <button key={id} data-target={id} onClick={() => activate(id)}
            className={`rounded-2xl border-4 p-8 text-xl capitalize focus-visible:outline-4 focus-visible:outline-teal-700 ${snapshot.intent.leadingTargetId === id ? 'border-teal-600 bg-teal-50' : 'border-stone-200'}`}>
            {id} · {counts[id]}
          </button>
        ))}
      </div>
      <p>Click or keyboard activation also works directly. To test dwell, just hover.</p>
      <div className="space-y-2">
        <p>State: <strong>{state.phase}</strong></p>
        <progress aria-label="Current phase progress" className="w-full" value={progress} max={1} />
      </div>
      <button className="rounded-lg bg-stone-900 px-5 py-3 text-white" onClick={() => { provider.reset(); setCounts({ tea: 0, coffee: 0 }); setEvents([]) }}>Reset demo</button>
      <section aria-label="Recent interaction events">
        <h2 className="mb-2 text-xl font-semibold">Recent events</h2>
        <ol className="font-mono text-sm">{events.map((event, index) => <li key={`${index}-${event}`}>{event}</li>)}</ol>
      </section>
    </main>
  )
}
