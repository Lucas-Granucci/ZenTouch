import assert from 'node:assert/strict'
import { test } from 'node:test'
import { softSnapModel, interactionMessage, inputTimedOut, defaultCursorSettings } from '../src/components/zentouch/feedbackModel.ts'
import { SimulatedInputProvider } from '../src/interaction/simulated/SimulatedInputProvider.ts'

test('inside an element, default snapping pulls up to 30% toward its center', () => {
  const provider = new SimulatedInputProvider({ now: () => 0 })
  const target = { id: 'choice', enabled: true, rect: { x: 100, y: 200, width: 100, height: 100 } }
  provider.targets.register(target)
  provider.pointAt('choice', 0, { x: 110, y: 220 })
  const snapshot = provider.getSnapshot()
  assert.equal(defaultCursorSettings.snapStrength, 0.30)
  for (const belief of [0, 0.5, 1]) {
    const intent = { ...snapshot.intent, targets: snapshot.intent.targets.map(entry => ({ ...entry, belief })) }
    const glow = softSnapModel({ ...snapshot, intent }, [target])!
    assert.equal(glow.x, 110 + 40 * Math.sqrt(belief) * 0.30)
    assert.equal(glow.y, 220 + 30 * Math.sqrt(belief) * 0.30)
  }
  assert.equal(softSnapModel(snapshot, [{ ...target, enabled: false }])?.x, 110)
  assert.equal(softSnapModel(snapshot, [])?.y, 220)
  assert.equal(softSnapModel(snapshot, [target], undefined, 0)?.x, 110)
  assert.equal(softSnapModel({ ...snapshot, tracking: 'no-hand' }, [target]), null)
  provider.dispose()
})

test('lock and dwell share one continuous fill; selection remains complete in cooldown', () => {
  let time = 0
  const provider = new SimulatedInputProvider({ now: () => time, lockDurationMs: 100, dwellDurationMs: 200 })
  provider.targets.register({ id: 'choice', enabled: true, rect: { x: 0, y: 0, width: 100, height: 100 } })
  const glow = () => softSnapModel(provider.getSnapshot(), provider.targets.getSnapshot(), { lockDurationMs: 100, dwellDurationMs: 200 })!
  provider.pointAt('choice')
  time = 50; provider.tick(time)
  assert.equal(glow().progress, 1 / 6)
  time = 100; provider.tick(time)
  assert.equal(glow().progress, 1 / 3)
  assert.equal(provider.getSnapshot().state.phase, 'LOCKED')
  assert.match(interactionMessage(provider.getSnapshot()), /Keep holding/)
  time = 200; provider.tick(time)
  assert.ok(Math.abs(glow().progress - 2 / 3) < 1e-10)
  time = 300; provider.tick(time)
  assert.equal(glow().progress, 1)
  assert.match(interactionMessage(provider.getSnapshot()), /Selected.*Pause/)
  provider.pointAt(null)
  time = 1000; provider.tick(time)
  assert.equal(glow(), null)
  assert.match(interactionMessage(provider.getSnapshot()), /order is saved.*resume/)
  provider.dispose()
})

test('stale input times out and fresh input recovers without changing the order', () => {
  const provider = new SimulatedInputProvider({ now: () => 0 })
  provider.targets.register({ id: 'choice', enabled: true, rect: { x: 0, y: 0, width: 100, height: 100 } })
  provider.pointAt('choice')
  assert.equal(inputTimedOut(provider.getSnapshot(), 1999), false)
  assert.equal(inputTimedOut(provider.getSnapshot(), 2000), true)
  provider.pointAt('choice', 2100)
  assert.equal(inputTimedOut(provider.getSnapshot(), 2100), false)
  provider.dispose()
})

test('snap never pulls beyond its approach zone, even when intent still leads there', () => {
  const provider = new SimulatedInputProvider({ now: () => 0 })
  const target = { id: 'choice', enabled: true, rect: { x: 100, y: 200, width: 100, height: 100 } }
  provider.targets.register(target)
  provider.pointAt('choice', 0, { x: 150, y: 250 })
  const snapshot = provider.getSnapshot()
  for (const position of [{ x: 76, y: 250 }, { x: 224, y: 250 }, { x: 150, y: 176 }, { x: 150, y: 324 }]) {
    const glow = softSnapModel({ ...snapshot, pointing: { ...snapshot.pointing!, position } }, [target], undefined, 1)!
    assert.equal(glow.x, position.x)
    assert.equal(glow.y, position.y)
  }
  provider.dispose()
})

test('small controls use the same snap strength without extra amplification', () => {
  const provider = new SimulatedInputProvider({ now: () => 0 })
  provider.targets.register({ id: 'choice', enabled: true, rect: { x: 0, y: 0, width: 100, height: 100 } })
  provider.pointAt('choice', 0, { x: 0, y: 0 })
  const snapshot = provider.getSnapshot()
  const intent = { ...snapshot.intent, targets: snapshot.intent.targets.map(entry => ({ ...entry, belief: 1 })) }
  for (const width of [1, 32, 64, 100]) {
    const target = { id: 'choice', enabled: true, rect: { x: 0, y: 0, width, height: 100 } }
    const glow = softSnapModel({ ...snapshot, intent }, [target])!
    assert.equal(glow.x, width / 2 * 0.30)
    assert.equal(glow.y, 15)
  }
  provider.dispose()
})

test('approaching back and order buttons produces a gentle continuous pull', () => {
  for (const width of [72, 240]) {
    const provider = new SimulatedInputProvider({ now: () => 0 })
    const target = { id: 'choice', enabled: true, rect: { x: 100, y: 200, width, height: 64 } }
    provider.targets.register(target)
    provider.pointAt('choice', 0, { x: 100, y: 232 })
    const snapshot = provider.getSnapshot()
    const intent = { ...snapshot.intent, targets: snapshot.intent.targets.map(entry => ({ ...entry, belief: 0.25 })) }
    const model = (x: number) => softSnapModel({ ...snapshot, intent, pointing: { ...snapshot.pointing!, position: { x, y: 232 } } }, [target])!
    assert.equal(model(76).x, 76)
    assert.ok(model(88).x > 88)
    assert.ok(model(100).x > 100)
    assert.ok(Math.abs(model(100).x - model(99.999).x) < 0.002)
    assert.ok(model(100).x - 100 <= width / 2 * 0.30)
    provider.dispose()
  }
})
