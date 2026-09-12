import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCalibration, fitCalibration, loadCalibration, saveCalibration } from '../src/interaction/pointing/calibration/affine.ts';
const size = { width: 1000, height: 700 };
test('least squares recovers affine transform and transforms velocity without translation', () => {
  const samples = [[10, 20], [700, 20], [10, 600], [700, 600], [400, 300]].map(([x, y]) => ({ projected: { x, y }, expected: { x: 2 * x + y + 10, y: -x + 3 * y - 20 } }));
  const calibration = fitCalibration(samples, size, true);
  calibration.transform.forEach((value, i) => assert.ok(Math.abs(value - [2, 1, 10, -1, 3, -20][i]) < 1e-8));
  const p = applyCalibration({ timestamp: 1, handId: 'h', position: { x: 10, y: 20 }, direction: null, velocity: { x: 2, y: 3 }, confidence: 1 }, calibration);
  assert.ok(Math.abs(p.position.x - 50) < 1e-8); assert.ok(Math.abs(p.velocity!.y - 7) < 1e-8);
});
test('degenerate calibration fails and persistence validates viewport, mirroring, corruption', () => {
  assert.throws(() => fitCalibration([0, 1, 2].map(n => ({ projected: { x: n, y: n }, expected: { x: n, y: n } })), size, true));
  const c = fitCalibration([[0, 0], [100, 0], [0, 100]].map(([x, y]) => ({ projected: { x, y }, expected: { x, y } })), size, true);
  let stored = ''; const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } };
  saveCalibration(storage, c); assert.deepEqual(loadCalibration(storage, size, true), c);
  assert.equal(loadCalibration(storage, size, false), null); assert.equal(loadCalibration(storage, { ...size, width: 500 }, true), null);
  stored = '{broken'; assert.equal(loadCalibration(storage, size, true), null);
  assert.equal(loadCalibration({ getItem: () => { throw Error('blocked'); } }, size, true), null);
});
