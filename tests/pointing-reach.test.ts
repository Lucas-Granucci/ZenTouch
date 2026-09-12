import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyProgressiveReach } from '../src/interaction/pointing/reach.ts';
import type { PointingEstimate } from '../src/types/interaction.ts';
const viewport = { x: 10, y: 20, width: 1000, height: 500 };
function point(x: number, y: number): PointingEstimate {
  return { timestamp: 1, handId: 'a', position: { x, y }, direction: { x: 0, y: 0, z: -1 }, velocity: { x: 100, y: -50 }, confidence: 1 };
}
test('central precision area retains position, velocity, and tracking metadata', () => {
  for (const x of [310, 510, 710]) {
    const p = point(x, 270);
    assert.deepEqual(applyProgressiveReach(p, viewport, 1), p);
  }
});
test('comfortable reaches map to all four corners with viewport offsets and aspect ratio', () => {
  for (const [x, expectedX] of [[160, 10], [860, 1010]]) {
    for (const [y, expectedY] of [[95, 20], [445, 520]]) {
      const result = applyProgressiveReach(point(x, y), viewport, 1);
      assert.ok(Math.abs(result.position.x - expectedX) < 1e-9);
      assert.ok(Math.abs(result.position.y - expectedY) < 1e-9);
    }
  }
});
test('reach increases smoothly and monotonically without coupling the axes', () => {
  let previous = -Infinity;
  for (let x = 10; x <= 1010; x++) {
    const result = applyProgressiveReach(point(x, 270), viewport, 1);
    assert.ok(result.position.x > previous);
    assert.equal(result.position.y, 270);
    previous = result.position.x;
  }
  const boundary = applyProgressiveReach(point(710 + 1e-5, 270), viewport, 1);
  assert.ok(Math.abs(boundary.velocity!.x - 100) < 0.001);
});
test('velocity follows the mapping derivative for motion prediction', () => {
  const p = point(820, 110), dt = 1e-6;
  const mapped = applyProgressiveReach(p, viewport, 1);
  const next = applyProgressiveReach({ ...p, position: { x: p.position.x + p.velocity!.x * dt, y: p.position.y + p.velocity!.y * dt } }, viewport, 1);
  for (const axis of ['x', 'y'] as const) {
    assert.ok(Math.abs((next.position[axis] - mapped.position[axis]) / dt - mapped.velocity![axis]) < 0.001);
  }
  assert.equal(applyProgressiveReach({ ...p, velocity: null }, viewport, 1).velocity, null);
});

test('scaling defaults to off and intermediate strength reduces edge amplification', () => {
  const p = point(860, 445);
  assert.deepEqual(applyProgressiveReach(p, viewport), p);
  assert.deepEqual(applyProgressiveReach(p, viewport, 0), p);
  const half = applyProgressiveReach(p, viewport, 0.5);
  assert.ok(Math.abs(half.position.x - 935) < 1e-9);
  assert.ok(Math.abs(half.position.y - 482.5) < 1e-9);
});
