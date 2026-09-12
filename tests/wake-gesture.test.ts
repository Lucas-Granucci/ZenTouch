import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WakeGesture, WAVE_READING_DELAY_MS } from '../src/pages/kiosk/wakeGesture.ts'

test('a wave wakes in either direction after a deliberate reversal', () => {
  for (const direction of [-1, 1]) {
    const wave = new WakeGesture()
    assert.equal(wave.update(0.5, 0), false)
    assert.equal(wave.update(0.5 + direction * 0.22, 300), false)
    assert.equal(wave.update(0.5 + direction * 0.04, 600), true)
  }
})

test('stationary hands, jitter, and one-way motion do not wake', () => {
  const wave = new WakeGesture()
  for (const [i, x] of [0.5, 0.501, 0.49, 0.51, 0.6, 0.65, 0.64].entries()) {
    assert.equal(wave.update(x, i * 100), false)
  }
})

test('faster waves register at 250 ms in either direction, but shorter spikes do not', () => {
  for (const direction of [-1, 1]) {
    for (const duration of [200, 249, 250, 300, 400]) {
      const wave = new WakeGesture()
      assert.equal(wave.update(0.5, 0), false)
      assert.equal(wave.update(0.5 + direction * 0.22, duration / 2), false)
      assert.equal(wave.update(0.5 + direction * 0.04, duration), duration >= 250)
    }
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

test('shallow reversals and rapid spikes do not wake', () => {
  for (const samples of [
    [[0.5, 0], [0.62, 300], [0.56, 600]],
    [[0.5, 0], [0.72, 300], [0.66, 600]],
    [[0.5, 0], [0.72, 50], [0.54, 100], [0.54, 600]],
  ]) {
    const wave = new WakeGesture()
    for (const [x, time] of samples) assert.equal(wave.update(x, time), false)
  }
})

test('smaller waves register in either direction without a broad sweep', () => {
  for (const direction of [-1, 1]) {
    const wave = new WakeGesture()
    assert.equal(wave.update(0.5, 0), false)
    assert.equal(wave.update(0.5 + direction * 0.11, 150), false)
    assert.equal(wave.update(0.5 + direction * 0.03, 300), true)
  }
})

test('movement below the initial sweep threshold does not wake', () => {
  for (const direction of [-1, 1]) {
    const wave = new WakeGesture()
    assert.equal(wave.update(0.5, 0), false)
    assert.equal(wave.update(0.5 + direction * 0.09, 150), false)
    assert.equal(wave.update(0.5, 300), false)
  }
})

test('reading window discards early movement and requires a complete fresh wave', () => {
  const wave = new WakeGesture(WAVE_READING_DELAY_MS)
  for (const [x, time] of [[0.5, 0], [0.72, 300], [0.54, 600], [0.5, 1600], [0.72, 1900], [0.54, 2000]]) {
    assert.equal(wave.update(x, time), false)
  }
  assert.equal(wave.update(0.76, 2300), false)
  assert.equal(wave.update(0.56, 2600), true)
})

test('stalled tracking, invalid coordinates, and clock reversal discard partial waves', () => {
  for (const interruption of ['gap', 'invalid', 'clock', 'lost'] as const) {
    const wave = new WakeGesture()
    wave.update(0.5, 0)
    wave.update(0.72, 300)
    if (interruption === 'invalid') wave.update(NaN, 400)
    if (interruption === 'clock') wave.update(0.72, 200)
    if (interruption === 'lost') wave.update(null, 400)
    assert.equal(wave.update(0.54, interruption === 'gap' ? 800 : 600), false)
  }
})
