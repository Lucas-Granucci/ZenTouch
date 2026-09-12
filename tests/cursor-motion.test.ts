import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CursorMotion } from '../src/components/zentouch/CursorMotion.ts';

function motion(x = 0) {
  const cursor = new CursorMotion();
  cursor.setTarget({ x, y: 0 }, 0);
  cursor.setTarget({ x: x + 100, y: 100 }, 0);
  return cursor;
}

test('display motion converges without overshoot and is independent of refresh rate and screen center', () => {
  for (const origin of [0, 500, 1000]) {
    const endpoints = [60, 120, 144].map(hz => {
      const cursor = motion(origin);
      let previous = origin;
      for (let i = 1; i <= hz / 2; i++) {
        cursor.advance(i * 1000 / hz);
        assert.ok(cursor.position!.x >= previous && cursor.position!.x <= origin + 100);
        previous = cursor.position!.x;
      }
      return cursor.position!.x - origin;
    });
    for (const x of endpoints) assert.ok(Math.abs(x - endpoints[0]) < 1e-8);
  }
});

test('new samples preserve motion; tracking loss freezes and return glides from that position', () => {
  const cursor = motion();
  cursor.advance(16);
  cursor.advance(32);
  const position = { ...cursor.position! };
  cursor.setTarget({ x: 200, y: 100 }, 33);
  assert.deepEqual(cursor.position, position);
  cursor.setTarget(null, 34);
  assert.equal(cursor.advance(1000), false);
  assert.deepEqual(cursor.position, position);
  cursor.setTarget({ x: 500, y: 200 }, 1000);
  assert.deepEqual(cursor.position, position);
  cursor.advance(1016);
  assert.ok(cursor.position!.x > position.x && cursor.position!.x < 100);
  cursor.reset();
  assert.equal(cursor.position, null);
});

test('display damps stationary noise and bounds stalled-frame jumps; reduced motion settles immediately', () => {
  const cursor = new CursorMotion();
  cursor.setTarget({ x: 100, y: 100 }, 0);
  let squaredError = 0;
  for (let i = 1; i <= 300; i++) {
    cursor.setTarget({ x: 100 + (i % 2 ? 10 : -10), y: 100 }, i * 16);
    cursor.advance(i * 16);
    if (i > 100) squaredError += (cursor.position!.x - 100) ** 2;
  }
  assert.ok(squaredError / 200 < 1);
  cursor.setTarget({ x: 1000, y: 100 }, 4801);
  cursor.advance(10000);
  assert.ok(cursor.position!.x < 500);
  assert.equal(cursor.advance(10016, true), false);
  assert.equal(cursor.position!.x, 1000);
});
