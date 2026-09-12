import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LandmarkMapper } from '../src/interaction/vision/landmarks.ts';

export function result(count = 1) {
  return {
    landmarks: Array.from({ length: count }, () => Array.from({ length: 21 }, (_, i) => ({ x: 0.3 + i / 100, y: 0.4, z: -i / 100 }))),
    worldLandmarks: Array.from({ length: count }, () => Array.from({ length: 21 }, (_, i) => ({ x: i / 1000, y: 0, z: 0 }))),
    handedness: Array.from({ length: count }, () => [{ categoryName: 'Left', score: 0.7 }]),
  };
}

test('copies and freezes 21 image/world points; quality is independent of handedness', () => {
  const mapper = new LandmarkMapper();
  const raw = result();
  const frame = mapper.map(raw, 1);
  assert.equal(frame.status, 'tracking');
  assert.equal(frame.hands[0].confidence, 1);
  assert.equal(frame.hands[0].handednessConfidence, 0.7);
  assert.equal(frame.hands[0].landmarks[20].z, -0.2);
  assert.equal(frame.hands[0].worldLandmarks?.length, 21);
  raw.landmarks[0][0].x = 99;
  assert.equal(frame.hands[0].landmarks[0].x, 0.3);
  assert.ok(Object.isFrozen(frame.hands[0].landmarks[0]));
});

test('stable IDs across continuous tracking, new IDs after loss, ambiguity, or a gap', () => {
  const mapper = new LandmarkMapper();
  const first = mapper.map(result(), 1).hands[0].id;
  assert.equal(mapper.map(result(), 30).hands[0].id, first);
  assert.equal(mapper.map(result(0), 60).status, 'no-hand');
  const second = mapper.map(result(), 90).hands[0].id;
  assert.notEqual(second, first);
  assert.equal(mapper.map(result(2), 120).status, 'multiple-hands');
  const third = mapper.map(result(), 150).hands[0].id;
  assert.notEqual(third, second);
  assert.notEqual(mapper.map(result(), 500).hands[0].id, third);
});

test('invalid or degenerate geometry never enables tracking; invalid world data is omitted', () => {
  const mapper = new LandmarkMapper();
  const raw = result();
  raw.landmarks[0][0].x = NaN;
  assert.equal(mapper.map(raw, 1).status, 'low-confidence');
  const short = result(); short.landmarks[0].pop();
  assert.equal(mapper.map(short, 2).status, 'low-confidence');
  const flat = result(); flat.landmarks[0].fill({ x: 0, y: 0, z: 0 });
  assert.equal(mapper.map(flat, 3).status, 'low-confidence');
  const world = result(); world.worldLandmarks[0][0].z = Infinity;
  assert.equal(mapper.map(world, 4).hands[0].worldLandmarks, null);
  const multiple = result(2); multiple.landmarks[1].pop();
  assert.equal(mapper.map(multiple, 5).status, 'multiple-hands');
});
