import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SimulatedInputProvider } from '../src/interaction/simulated/SimulatedInputProvider.ts'

function setup() {
  let time = 0
  const provider = new SimulatedInputProvider({ now: () => time, lockDurationMs: 100, dwellDurationMs: 200, cooldownDurationMs: 300 })
  const target = { id: 'tea', enabled: true, rect: { x: 10, y: 10, width: 100, height: 100 } }
  const remove = provider.targets.register(target)
  provider.targets.register({ ...target, id: 'coffee' })
  const advance = (timestamp: number) => { time = timestamp; provider.tick(time) }
  return { provider, target, remove, advance }
}

test('dwell publishes SELECT before its event, then cooldown; events are not replayed', () => {
  const { provider, advance } = setup()
  const events: string[] = []
  const ids: string[] = []
  provider.subscribeEvents((event) => {
    events.push(event.type)
    if (event.type === 'select') {
      assert.equal(provider.getSnapshot().state.phase, 'SELECT')
      assert.equal(event.source, 'simulated')
      ids.push(event.id)
    }
  })
  provider.pointAt('tea')
  advance(99)
  assert.equal(provider.getSnapshot().state.phase, 'POINTING')
  advance(100)
  advance(299)
  assert.equal(provider.getSnapshot().state.phase, 'LOCKED')
  advance(300)
  assert.equal(provider.getSnapshot().state.phase, 'COOLDOWN')
  advance(599)
  assert.deepEqual(events, ['target-enter', 'target-lock', 'select'])
  advance(600)
  advance(700)
  advance(900)
  assert.equal(new Set(ids).size, 2)
  let replayed = false
  provider.subscribeEvents(() => { replayed = true })
  assert.equal(replayed, false)
})

test('switching and tracking loss cancel progress and order leave before enter', () => {
  const { provider, advance } = setup()
  const events: string[] = []
  provider.subscribeEvents((event) => events.push(`${event.type}:${event.targetId}`))
  provider.pointAt('tea')
  advance(100)
  provider.pointAt('coffee', 150)
  assert.equal(provider.getSnapshot().state.phase, 'POINTING')
  assert.deepEqual(events.slice(-2), ['target-leave:tea', 'target-enter:coffee'])
  provider.pointAt(null, 160)
  advance(1000)
  assert.equal(provider.getSnapshot().state.phase, 'IDLE')
  assert.equal(provider.getSnapshot().intent.leadingTargetId, null)
  assert.ok(!events.some((event) => event.startsWith('select:')))
})

test('disabling immediately cancels a lock; removing a selected target preserves cooldown', () => {
  const { provider, target, advance, remove } = setup()
  provider.pointAt('tea')
  advance(100)
  provider.targets.update({ ...target, enabled: false })
  assert.equal(provider.getSnapshot().state.phase, 'IDLE')
  assert.throws(() => provider.pointAt('tea'), /Ineligible/)
  provider.targets.update(target)
  provider.pointAt('tea')
  advance(200)
  advance(400)
  remove()
  remove()
  provider.pointAt('coffee')
  assert.equal(provider.getSnapshot().state.phase, 'COOLDOWN')
  advance(700)
  assert.equal(provider.getSnapshot().state.phase, 'POINTING')
})

test('navigation inside select delivery cannot bypass cooldown', () => {
  const { provider, remove, advance } = setup()
  provider.subscribeEvents((event) => {
    if (event.type === 'select') {
      remove()
      provider.pointAt('coffee')
    }
  })
  provider.pointAt('tea')
  advance(100)
  advance(300)
  assert.equal(provider.getSnapshot().state.phase, 'COOLDOWN')
  assert.equal(provider.getSnapshot().intent.leadingTargetId, 'coffee')
})

test('reset during selection remains reset', () => {
  const { provider, advance } = setup()
  provider.subscribeEvents((event) => { if (event.type === 'select') provider.reset() })
  provider.pointAt('tea')
  advance(100)
  advance(300)
  assert.equal(provider.getSnapshot().state.phase, 'IDLE')
  assert.equal(provider.targets.getSnapshot().length, 2)
})

test('snapshots are stable and immutable; subscriptions and disposal clean up', () => {
  const { provider, target } = setup()
  const snapshot = provider.getSnapshot()
  assert.equal(snapshot, provider.getSnapshot())
  let calls = 0
  const unsubscribe = provider.subscribe(() => calls++)
  provider.pointAt('tea')
  assert.equal(calls, 1)
  assert.notEqual(snapshot, provider.getSnapshot())
  assert.ok(Object.isFrozen(provider.getSnapshot().intent.targets[0]))
  target.rect.x = 999
  assert.equal(provider.targets.getSnapshot()[0].rect.x, 10)
  unsubscribe()
  unsubscribe()
  provider.reset()
  assert.equal(calls, 1)
  provider.dispose()
  provider.dispose()
  assert.throws(() => provider.tick(), /disposed/)
})

test('rejects invalid config, geometry, duplicate IDs and backward time', () => {
  assert.throws(() => new SimulatedInputProvider({ dwellDurationMs: 0 }), /duration/)
  assert.throws(() => new SimulatedInputProvider({ now: () => NaN }), /timestamp/)
  const { provider, target, advance } = setup()
  assert.throws(() => provider.targets.register(target), /Duplicate/)
  assert.throws(() => provider.targets.update({ ...target, id: 'missing' }), /Unknown/)
  assert.throws(() => provider.targets.update({ ...target, rect: { ...target.rect, width: -1 } }), /Invalid/)
  assert.throws(() => provider.pointAt('tea', 0, { x: NaN, y: 0 }), /position/)
  advance(100)
  assert.throws(() => provider.reset(99), /monotonic/)
  assert.throws(() => provider.tick(Infinity), /monotonic/)
})

test('mouse hover selects without a click, blur clears intent, and disconnect cancels frames', () => {
  const names = ['window', 'requestAnimationFrame', 'cancelAnimationFrame'] as const
  const originals = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name))
  const browserWindow = Object.assign(new EventTarget(), { innerWidth: 800, innerHeight: 600 })
  let nextFrame = 0
  const frames = new Map<number, FrameRequestCallback>()
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: browserWindow },
    requestAnimationFrame: { configurable: true, value: (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame } },
    cancelAnimationFrame: { configurable: true, value: (id: number) => frames.delete(id) },
  })
  try {
    let time = 0
    const provider = new SimulatedInputProvider({ now: () => time, lockDurationMs: 100, dwellDurationMs: 200 })
    provider.targets.register({ id: 'tea', enabled: true, rect: { x: 10, y: 10, width: 100, height: 100 } })
    const surface = new EventTarget()
    let selections = 0
    provider.subscribeEvents((event) => { if (event.type === 'select') selections++ })
    const disconnect = provider.connectMouse(surface as HTMLElement)
    surface.dispatchEvent(Object.assign(new Event('pointermove'), { pointerType: 'mouse', clientX: 20, clientY: 20 }))
    for (const timestamp of [0, 100, 300]) {
      time = timestamp
      const callbacks = [...frames.values()]
      frames.clear()
      callbacks.forEach((callback) => callback(time))
    }
    assert.equal(selections, 1)
    browserWindow.dispatchEvent(new Event('blur'))
    assert.equal(provider.getSnapshot().intent.leadingTargetId, null)
    assert.equal(provider.getSnapshot().state.phase, 'COOLDOWN')
    disconnect()
    disconnect()
    assert.equal(frames.size, 0)
    surface.dispatchEvent(Object.assign(new Event('pointermove'), { pointerType: 'mouse', clientX: 20, clientY: 20 }))
    assert.equal(provider.getSnapshot().intent.leadingTargetId, null)
    provider.dispose()
  } finally {
    names.forEach((name, index) => {
      const original = originals[index]
      if (original) Object.defineProperty(globalThis, name, original)
      else Reflect.deleteProperty(globalThis, name)
    })
  }
})
