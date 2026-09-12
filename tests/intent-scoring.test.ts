import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreTargets, defaultIntentConfig } from '../src/interaction/intent/scoring.ts';
import { TemporalBelief, lockEligible } from '../src/interaction/intent/temporal.ts';
import type { IntentDistribution, PointingEstimate } from '../src/types/interaction.ts';
const viewport = { x: 0, y: 0, width: 1000, height: 800 };
const p: PointingEstimate = { timestamp: 0, handId: 'h', position: { x: 100, y: 100 }, velocity: null, direction: null, confidence: 1 };
test('scores all eligible targets; excludes disabled, empty, offscreen and leaves distance-rejected mass for no target', () => {
  const targets = [0, 1, 2, 3, 4].map(i => ({ id: String(i), enabled: i !== 2, rect: { x: i === 4 ? 2000 : i * 200 + 50, y: 50, width: i === 3 ? 0 : 100, height: 100 }, priority: i === 0 ? 0 : 1 }));
  const result = scoreTargets(p, targets, viewport);
  assert.deepEqual(result.targets.map(t => t.targetId), ['0', '1']); assert.equal(result.leadingTargetId, '0');
  assert.ok(result.targets.reduce((n, t) => n + t.probability, 0) <= 1);
  assert.deepEqual(scoreTargets(p, [], viewport).targets, []);
  assert.throws(() => scoreTargets(p, targets, viewport, { ...defaultIntentConfig, softmaxTemperature: 0 }));
});
const distribution = (entries: [string, number][]): IntentDistribution => ({ timestamp: 1, leadingTargetId: entries[0]?.[0] ?? null, targets: entries.map(([targetId, probability]) => ({ targetId, probability, belief: probability, score: 0 })) });
test('temporal belief preserves absolute surviving history and retains leader on ties', () => {
  const temporal = new TemporalBelief(0.5);
  temporal.update(distribution([['b', 0.8], ['a', 0.2]]));
  assert.equal(temporal.update(distribution([['a', 0.8], ['b', 0.2]])).leadingTargetId, 'b');
  const next = temporal.update(distribution([['a', 0.5], ['c', 0.5]]));
  assert.deepEqual(next.targets.map(t => t.belief), [0.5, 0.25]);
  temporal.reset(); assert.equal(temporal.update(distribution([['b', 0.5], ['a', 0.5]])).leadingTargetId, 'a');
});
test('lock requires strict threshold and uninterrupted duration', () => {
  assert.deepEqual(lockEligible(0.7, 0.7, 0, 1000, 300), { startedAt: null, progress: 0 });
  assert.equal(lockEligible(0.8, 0.7, 0, 150, 300).progress, 0.5);
});

test('single-target probability decays with distance and no target can win', () => {
  const targets = [{ id: 'a', enabled: true, rect: { x: 50, y: 50, width: 100, height: 100 } }];
  const at = (x: number) => scoreTargets({ ...p, position: { x, y: 100 } }, targets, viewport);
  const values = [100, 174, 198, 246, 500].map(x => at(x).targets[0].probability);
  assert.equal(values[0], 1);
  for (let i = 1; i < values.length; i++) assert.ok(values[i] < values[i - 1]);
  assert.ok(values[3] < 0.02); assert.equal(at(246).leadingTargetId, null);
});
test('belief decays after moving away and is not renormalized back to certainty', () => {
  const temporal = new TemporalBelief(0.3);
  temporal.update(distribution([['a', 1]]));
  let result = temporal.update(distribution([['a', 0.001]]));
  assert.ok(result.targets[0].belief < 0.71);
  for (let i = 0; i < 20; i++) result = temporal.update(distribution([['a', 0.001]]));
  assert.ok(result.targets[0].belief < 0.002); assert.equal(result.leadingTargetId, null);
});
test('many distant targets and historical or prior bias cannot suppress no target', () => {
  const targets = Array.from({ length: 20 }, (_, i) => ({ id: String(i), enabled: true, priority: i === 0 ? 100000 : 1, rect: { x: 50 + i, y: 50, width: 100, height: 100 } }));
  const result = scoreTargets({ ...p, position: { x: 900, y: 700 } }, targets, viewport, defaultIntentConfig, new Map([['0', 1]]));
  assert.ok(result.targets.reduce((sum, t) => sum + t.probability, 0) < 0.001);
  assert.equal(result.leadingTargetId, null);
});
