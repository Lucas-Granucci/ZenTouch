import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPointingFilter } from '../src/interaction/filtering/PointingFilter.ts';
import type { PointingEstimate } from '../src/types/interaction.ts';
const sample = (timestamp: number, x: number, handId = 'a'): PointingEstimate => ({ timestamp, handId, position: { x, y: 0 }, direction: null, confidence: 1, velocity: null });
test('EMA smooths position and measures velocity in seconds', () => {
  const filter = createPointingFilter({ method: 'ema', alpha: 0.5 });
  filter.update(sample(0, 0));
  const result = filter.update(sample(100, 10));
  assert.equal(result.position.x, 8.75); assert.equal(result.velocity?.x, 87.5);
});
for (const options of [{ method: 'ema', alpha: 0.25 }, { method: 'kalman', processNoise: 10000, measurementNoise: 100 }] as const) {
  test(`${options.method} resets on hand changes, gaps and explicit reset; ignores old timestamps`, () => {
    const filter = createPointingFilter(options);
    filter.update(sample(0, 0));
    const result = filter.update(sample(10, 10));
    assert.equal(filter.update(sample(5, 500)), result);
    assert.equal(filter.update(sample(20, 100, 'b')).position.x, 100);
    assert.equal(filter.update(sample(500, 200, 'b')).velocity, null);
    filter.reset(); assert.equal(filter.update(sample(510, 300)).position.x, 300);
  });
  test(`${options.method} reduces stationary noise and remains finite`, () => {
    const filter = createPointingFilter(options);
    let error = 0;
    for (let i = 0; i < 500; i++) {
      const result = filter.update(sample(i * 16, 100 + (i % 2 ? 10 : -10)));
      assert.ok(Number.isFinite(result.position.x));
      if (i > 100) error += (result.position.x - 100) ** 2;
    }
    assert.ok(error / 399 < 100);
  });
}
test('rejects invalid filter configuration', () => {
  assert.throws(() => createPointingFilter({ method: 'ema', alpha: NaN }));
  assert.throws(() => createPointingFilter({ method: 'kalman', processNoise: -1, measurementNoise: 0 }));
});

test('EMA has the same response at 30, 60 and 120 Hz', () => {
  const positions = [30, 60, 120].map(hz => {
    const filter = createPointingFilter({ method: 'ema', alpha: 0.25 });
    filter.update(sample(0, 0));
    for (let i = 1; i <= hz / 10; i++) filter.update(sample(i * 1000 / hz, 100));
    return filter.update(sample(100, 100)).position.x;
  });
  for (const position of positions) assert.ok(Math.abs(position - 57.8125) < 1e-9);
});
