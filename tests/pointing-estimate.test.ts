import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultPointingOptions, estimatePointing, pointingVectors } from '../src/interaction/pointing/estimate.ts';
import type { HandLandmarks, LandmarkFrame } from '../src/types/interaction.ts';
const landmarks = Array.from({ length: 21 }, () => ({ x: 0.2, y: 0.5, z: 0 }));
landmarks[5] = { x: 0.3, y: 0.5, z: 0 }; landmarks[8] = { x: 0.4, y: 0.5, z: 0 };
const frame: LandmarkFrame = { timestamp: 1, source: 'camera', imageSize: { width: 640, height: 480 }, previewMirrored: false, status: 'tracking', hands: [{ id: 'a', handedness: 'right', confidence: 1, handednessConfidence: 0.9, landmarks: landmarks as unknown as HandLandmarks, worldLandmarks: null, elbow: null }] };
const viewport = { x: 10, y: 20, width: 1000, height: 500 };
test('hand mode follows palm translation and ignores finger articulation and projection distance', () => {
  const options = { ...defaultPointingOptions, trackingMethod: 'hand' as const };
  const raw = estimatePointing(frame, viewport, options)!;
  assert.ok(Math.abs(raw.position.x - 230) < 1e-9);
  assert.equal(raw.position.y, 270);
  assert.equal(raw.direction, null);
  const moved = { ...frame, hands: [{ ...frame.hands[0], landmarks: landmarks.map(p => ({ ...p, x: p.x + 0.1, y: p.y + 0.2 })) as unknown as HandLandmarks }] };
  const translated = estimatePointing(moved, viewport, options)!;
  assert.ok(Math.abs(translated.position.x - raw.position.x - 100) < 1e-9);
  assert.ok(Math.abs(translated.position.y - raw.position.y - 100) < 1e-9);
  const curled = landmarks.map((p, i) => i === 8 ? { x: 0.9, y: 0.1, z: 0 } : p);
  assert.deepEqual(estimatePointing({ ...frame, hands: [{ ...frame.hands[0], landmarks: curled as unknown as HandLandmarks }] }, viewport, { ...options, projectionDistance: 0.8 }), raw);
  const mirrored = estimatePointing({ ...frame, previewMirrored: true }, viewport, options)!;
  assert.ok(Math.abs(mirrored.position.x - 790) < 1e-9);
  assert.equal(estimatePointing({ ...frame, status: 'no-hand', hands: [] }, viewport, options), null);
  assert.equal(estimatePointing({ ...frame, hands: [...frame.hands, ...frame.hands] }, viewport, options), null);
});
test('projects normalized direction to viewport CSS pixels; mirrors position only', () => {
  const options = { ...defaultPointingOptions, projectionDistance: 0.1 };
  const raw = estimatePointing(frame, viewport, options)!;
  const mirrored = estimatePointing({ ...frame, previewMirrored: true }, viewport, options)!;
  assert.equal(raw.position.x, 410); assert.equal(raw.position.y, 270);
  assert.equal(mirrored.position.x, 610); assert.deepEqual(raw.direction, { x: 1, y: 0, z: 0 });
  assert.deepEqual(raw.direction, mirrored.direction);
});
test('rejects ambiguous or lost tracking and degenerate directions', () => {
  assert.equal(estimatePointing({ ...frame, status: 'no-hand', hands: [] }, viewport), null);
  assert.equal(estimatePointing({ ...frame, hands: [...frame.hands, ...frame.hands] }, viewport), null);
  assert.equal(estimatePointing(frame, viewport, { fingerWeight: 0, handWeight: 0, armWeight: 1, projectionDistance: 1 }), null);
  assert.equal(pointingVectors(frame.hands[0]).arm, null);
});
test('arm vector requires a confident pose elbow', () => {
  const hand = { ...frame.hands[0], elbow: { x: 0.1, y: 0.5, z: 0, confidence: 1 } };
  assert.ok(pointingVectors(hand).arm);
  assert.ok(estimatePointing({ ...frame, hands: [hand] }, viewport, { fingerWeight: 0, handWeight: 0, armWeight: 1, projectionDistance: 0.2 }));
});
