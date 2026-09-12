import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WakeGesture } from '../src/pages/kiosk/wakeGesture.ts'

test('a wave wakes in either direction after a deliberate reversal', () => {
  for (const direction of [-1, 1]) {
    const wave = new WakeGesture()
    assert.equal(wave.update(0.5, 0), false)
    assert.equal(wave.update(0.5 + direction * 0.12, 300), false)
    assert.equal(wave.update(0.5 + direction * 0.06, 600), true)
  }
})

test('stationary hands, jitter, and one-way motion do not wake', () => {
  const wave = new WakeGesture()
  for (const [i, x] of [0.5, 0.501, 0.49, 0.51, 0.6, 0.65, 0.64].entries()) {
    assert.equal(wave.update(x, i * 100), false)
  }
})

test('lost tracking and expired gestures require a fresh wave', () => {
  for (const lost of [true, false]) {
    const wave = new WakeGesture()
    wave.update(0.5, 0)
    wave.update(0.65, 300)
    if (lost) wave.update(null, 400)
    assert.equal(wave.update(0.5, lost ? 500 : 2000), false)
  }
})
