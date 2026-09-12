import assert from 'node:assert/strict'
import { test } from 'node:test'
import { softSnapModel, interactionMessage, inputTimedOut } from '../src/components/zentouch/feedbackModel.ts'
import { SimulatedInputProvider } from '../src/interaction/simulated/SimulatedInputProvider.ts'

test('soft snap follows belief at a fixed distance and uses viewport coordinates', () => {
  const provider = new SimulatedInputProvider({ now: () => 0 })
  const target = { id: 'choice', enabled: true, rect: { x: 100, y: 200, width: 100, height: 100 } }
  provider.targets.register(target)
  provider.pointAt('choice', 0, { x: 10, y: 20 })
  const snapshot = provider.getSnapshot()
  for (const belief of [0, 0.5, 1]) {
    const intent = { ...snapshot.intent, targets: snapshot.intent.targets.map((entry) => ({ ...entry, belief })) }
    const glow = softSnapModel({ ...snapshot, intent }, [target])!
    assert.equal(glow.x, 10 + 140 * belief)
    assert.equal(glow.y, 20 + 230 * belief)
  }
  assert.equal(softSnapModel(snapshot, [{ ...target, enabled: false }])?.x, 10)
  assert.equal(softSnapModel(snapshot, [])?.y, 20)
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
