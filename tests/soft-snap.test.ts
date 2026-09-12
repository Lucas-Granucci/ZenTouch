import assert from 'node:assert/strict';
import { test } from 'node:test';
import { softSnapPosition } from '../src/interaction/pointing/softSnap.ts';
import { SimulatedInputProvider } from '../src/interaction/simulated/SimulatedInputProvider.ts';

const button = { id: 'back', enabled: true, softSnap: true, rect: { x: 100, y: 100, width: 72, height: 60 } };

test('pulls inward gently, stays bounded, and fades continuously at the edges', () => {
  const point = { x: 112, y: 120 };
  const snapped = softSnapPosition(point, [button]);
  assert.ok(snapped.x > point.x && snapped.x < 136);
  assert.ok(snapped.y > point.y && snapped.y < 130);
  assert.ok(Math.hypot(snapped.x - point.x, snapped.y - point.y) <= 14);
  for (const p of [{ x: 99, y: 120 }, { x: 100, y: 120 }, { x: 136, y: 130 }]) {
    assert.deepEqual(softSnapPosition(p, [button]), p);
  }
  const nearEdge = softSnapPosition({ x: 100.001, y: 120 }, [button]);
  assert.ok(nearEdge.x - 100.001 < 0.000001);
  const wide = { ...button, rect: { x: 100, y: 100, width: 600, height: 72 } };
  const capped = softSnapPosition(point, [wide]);
  assert.ok(Math.hypot(capped.x - point.x, capped.y - point.y) <= 14.000001);
});

test('ignores disabled, empty, and non-action targets', () => {
  const p = { x: 112, y: 120 };
  for (const target of [{ ...button, enabled: false }, { ...button, softSnap: false },
    { ...button, rect: { ...button.rect, width: 0 } }]) {
    assert.deepEqual(softSnapPosition(p, [target]), p);
  }
});

test('simulator uses the same attraction without accumulating on repeated input', () => {
  const provider = new SimulatedInputProvider({ now: () => 0 });
  provider.targets.register(button);
  const p = { x: 112, y: 120 };
  provider.pointAt(button.id, 0, p);
  assert.deepEqual(provider.getSnapshot().pointing?.position, softSnapPosition(p, [button]));
  provider.pointAt(button.id, 1, p);
  assert.deepEqual(provider.getSnapshot().pointing?.position, softSnapPosition(p, [button]));
  provider.dispose();
});
