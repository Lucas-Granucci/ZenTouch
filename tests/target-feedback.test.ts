import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTargetFeedback } from '../src/components/zentouch/targetFeedback.ts';
import { SimulatedInputProvider } from '../src/interaction/simulated/SimulatedInputProvider.ts';

test('only changed target feedback invalidates a control snapshot; loss clears progress', () => {
  const input = new SimulatedInputProvider({ now: () => 0, lockDurationMs: 100, dwellDurationMs: 200 });
  input.targets.register({ id: 'choice', enabled: true, rect: { x: 0, y: 0, width: 100, height: 100 } });
  const timing = { lockDurationMs: 100, dwellDurationMs: 200 };
  const active = createTargetFeedback(input.getSnapshot, 'choice', true, timing);
  const other = createTargetFeedback(input.getSnapshot, 'other', true, timing);
  const disabled = createTargetFeedback(input.getSnapshot, 'choice', false, timing);
  const idle = other(), disabledIdle = disabled();
  input.pointAt('choice', 0);
  assert.equal(active().armed, true);
  const start = active();
  assert.equal(active(), start);
  input.tick(50);
  assert.notEqual(active(), start);
  assert.equal(active().progress, 1 / 6);
  assert.equal(other(), idle);
  assert.equal(disabled(), disabledIdle);
  input.tick(100);
  assert.equal(active().phase, 'locked');
  input.pointAt(null, 110);
  assert.deepEqual(active(), { armed: false, phase: 'idle', progress: 0 });
  input.dispose();
});
