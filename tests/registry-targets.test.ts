import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TargetRegistry } from '../src/interaction/intent/TargetRegistry.ts';
const target = { id: 'a', enabled: true, rect: { x: 0, y: 0, width: 100, height: 100 } };
test('registry validates IDs and geometry, isolates immutable snapshots, and cleans up idempotently', () => {
  const r = new TargetRegistry(); let calls = 0; r.subscribe(() => calls++);
  const remove = r.register(target); const original = r.getSnapshot();
  r.update(target); assert.equal(calls, 1); assert.equal(original, r.getSnapshot());
  assert.throws(() => r.register(target)); assert.throws(() => r.update({ ...target, id: 'missing' }));
  assert.throws(() => r.update({ ...target, rect: { ...target.rect, width: -1 } }));
  assert.throws(() => r.update({ ...target, priority: Infinity }));
  r.update({ ...target, enabled: false }); assert.equal(original[0].enabled, true); assert.ok(Object.isFrozen(original[0].rect));
  remove(); remove(); assert.equal(calls, 3); assert.equal(r.getSnapshot().length, 0);
  const removeNew = r.register(target); remove(); assert.equal(r.getSnapshot().length, 1); removeNew();
});
