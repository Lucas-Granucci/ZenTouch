import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LiveInteraction } from '../src/interaction/gestures/LiveInteraction.ts';
import { createSelectionStrategy } from '../src/interaction/gestures/strategies.ts';
import { TargetRegistry } from '../src/interaction/intent/TargetRegistry.ts';
import { SelectionMachine, defaultSelectionConfig } from '../src/interaction/gestures/SelectionMachine.ts';
import type { HandLandmarks, InteractionEvent, LandmarkFrame, TrackedHand } from '../src/types/interaction.ts';
const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
points[5] = { x: 0.4, y: 0.5, z: 0 }; points[17] = { x: 0.6, y: 0.5, z: 0 };
const hand: TrackedHand = { id: 'h', handedness: 'right', handednessConfidence: 1, confidence: 1, landmarks: points as unknown as HandLandmarks, worldLandmarks: null, elbow: null };
function fixture() {
  const registry = new TargetRegistry(); const remove = registry.register({ id: 'a', enabled: true, rect: { x: 0, y: 0, width: 100, height: 100 } });
  const engine = new LiveInteraction(registry, () => ({ x: 0, y: 0, width: 1000, height: 800 }), { ...defaultSelectionConfig, lockDurationMs: 100, dwellDurationMs: 100 });
  const events: InteractionEvent[] = []; const phases: string[] = [];
  engine.subscribeEvents(e => { events.push(e); if (e.type === 'select') assert.equal(engine.getSnapshot().state.phase, 'SELECT'); });
  engine.subscribe(() => phases.push(engine.getSnapshot().state.phase));
  const frame = (timestamp: number, status: LandmarkFrame['status'] = 'tracking', h = hand, position = { x: 50, y: 50 }) => engine.process({ timestamp, status, source: 'camera', previewMirrored: true, imageSize: { width: 640, height: 480 }, hands: status === 'tracking' ? [h] : [] }, { timestamp, handId: h.id, position, velocity: null, direction: null, confidence: 1 });
  return { registry, remove, engine, events, phases, frame };
}
test('camera attraction recomputes from original input on layout and eligibility changes', () => {
  const f = fixture();
  const target = { id: 'a', enabled: true, softSnap: true, rect: { x: 0, y: 0, width: 72, height: 60 } };
  f.registry.update(target);
  f.frame(0, 'tracking', hand, { x: 12, y: 20 });
  const snapped = f.engine.getSnapshot().pointing!.position;
  assert.ok(snapped.x > 12 && snapped.y > 20);
  f.registry.update({ ...target, priority: 2 });
  assert.deepEqual(f.engine.getSnapshot().pointing!.position, snapped);
  f.registry.update({ ...target, enabled: false });
  assert.deepEqual(f.engine.getSnapshot().pointing!.position, { x: 12, y: 20 });
  f.registry.update(target);
  f.frame(1, 'tracking', hand, { x: -1, y: 20 });
  assert.deepEqual(f.engine.getSnapshot().pointing!.position, { x: -1, y: 20 });
  f.engine.dispose();
});
test('dwell publishes SELECT before event, then cooldown; reacquires from zero', () => {
  const f = fixture(); f.frame(0); f.frame(100); assert.equal(f.engine.getSnapshot().state.phase, 'LOCKED');
  f.frame(200); assert.deepEqual(f.phases, ['POINTING', 'LOCKED', 'SELECT', 'COOLDOWN']);
  f.frame(300, 'no-hand'); f.remove(); assert.equal(f.engine.getSnapshot().state.phase, 'COOLDOWN');
  f.engine.tick(1100); assert.equal(f.engine.getSnapshot().state.phase, 'IDLE'); assert.equal(f.events.filter(e => e.type === 'select').length, 1); f.engine.dispose();
});
test('tracking timeout, hand change, and target removal cancel a lock', () => {
  for (const action of ['timeout', 'hand', 'remove'] as const) {
    const f = fixture(); f.frame(0); f.frame(100);
    if (action === 'timeout') f.engine.tick(350);
    else if (action === 'hand') f.frame(200, 'tracking', { ...hand, id: 'other' });
    else f.remove();
    assert.notEqual(f.engine.getSnapshot().state.phase, 'LOCKED'); assert.equal(f.events.filter(e => e.type === 'select').length, 0); f.engine.dispose();
  }
});
test('stale frames and disposal do not publish', () => {
  const f = fixture(); f.frame(100); const original = f.engine.getSnapshot(); f.frame(100); f.frame(99); assert.equal(f.engine.getSnapshot(), original);
  f.engine.tick(150); f.frame(140); assert.equal(f.engine.getSnapshot(), original);
  f.engine.dispose(); f.frame(300); assert.equal(f.engine.getSnapshot(), original);
});
function withPoints(overrides: Record<number, { x: number; y: number; z: number }>) { return { ...hand, landmarks: points.map((p, i) => overrides[i] ?? p) as unknown as HandLandmarks }; }
test('pinch requires release after lock and cannot repeat a held gesture', () => {
  const strategy = createSelectionStrategy('pinch');
  const closed = withPoints({ 4: { x: 0.5, y: 0.5, z: 0 }, 8: { x: 0.51, y: 0.5, z: 0 } });
  const open = withPoints({ 4: { x: 0.3, y: 0.5, z: 0 }, 8: { x: 0.6, y: 0.5, z: 0 } });
  assert.equal(strategy.update(closed, 0, 0).complete, false); strategy.update(open, 10, 0);
  assert.equal(strategy.update(closed, 20, 0).complete, true); assert.equal(strategy.update(closed, 30, 0).complete, false);
  strategy.reset(); assert.equal(strategy.update(closed, 40, 0).complete, false);
});
test('push uses relative scale with a fresh baseline on reset', () => {
  const strategy = createSelectionStrategy('push');
  assert.equal(strategy.update(hand, 0, 0).complete, false);
  const closer = withPoints({ 5: { x: 0.35, y: 0.5, z: 0 }, 17: { x: 0.65, y: 0.5, z: 0 } });
  assert.equal(strategy.update(closer, 10, 0).complete, true); strategy.reset(); assert.equal(strategy.update(closer, 20, 20).complete, false);
});
test('fist requires an open palm first', () => {
  const strategy = createSelectionStrategy('fist');
  const open = withPoints(Object.fromEntries([8, 12, 16, 20].flatMap(i => [[i, { x: 0.5, y: 0.1, z: 0 }], [i - 2, { x: 0.5, y: 0.3, z: 0 }]])));
  const closed = withPoints(Object.fromEntries([8, 12, 16, 20].flatMap(i => [[i, { x: 0.5, y: 0.45, z: 0 }], [i - 2, { x: 0.5, y: 0.3, z: 0 }]])));
  assert.equal(strategy.update(closed, 0, 0).complete, false); strategy.update(open, 10, 0); assert.equal(strategy.update(closed, 20, 0).complete, true);
});
test('removing a selected target synchronously during delivery preserves cooldown', () => {
  const f = fixture(); f.engine.subscribeEvents(e => { if (e.type === 'select') f.remove(); });
  f.frame(0); f.frame(100); f.frame(200);
  assert.equal(f.engine.getSnapshot().state.phase, 'COOLDOWN'); assert.equal(f.engine.getSnapshot().intent.leadingTargetId, null);
  assert.equal(f.events.filter(e => e.type === 'select').length, 1); f.engine.dispose();
});
test('registry removal emits unavailable leave and never selects on layout updates', () => {
  const f = fixture(); f.frame(0); f.frame(100); f.engine.tick(220);
  f.registry.update({ id: 'a', enabled: true, rect: { x: 1, y: 0, width: 100, height: 100 } });
  assert.equal(f.events.filter(e => e.type === 'select').length, 0);
  f.remove(); assert.equal(f.engine.getSnapshot().state.phase, 'IDLE');
  const leave = f.events.findLast(e => e.type === 'target-leave'); assert.ok(leave?.type === 'target-leave'); assert.equal(leave.reason, 'target-unavailable');
  f.engine.dispose();
});
test('a camera gap cancels dwell even when the periodic timeout has not run', () => {
  const f = fixture(); f.frame(0); f.frame(100); f.frame(500);
  assert.equal(f.engine.getSnapshot().state.phase, 'POINTING'); assert.equal(f.events.filter(e => e.type === 'select').length, 0);
  f.engine.dispose();
});

test('a distant sole target has negligible P and belief and never highlights or selects', () => {
  const f = fixture();
  for (const t of [0, 100, 200, 300]) f.frame(t, 'tracking', hand, { x: 500, y: 500 });
  assert.ok(f.engine.getSnapshot().intent.targets[0].probability < 0.001);
  assert.ok(f.engine.getSnapshot().intent.targets[0].belief < 0.001);
  assert.equal(f.engine.getSnapshot().state.phase, 'IDLE');
  assert.equal(f.events.filter(e => e.type === 'target-enter' || e.type === 'select').length, 0);
  f.engine.dispose();
});
test('nearby pointer highlights but must enter the rectangle to lock; leaving cancels dwell', () => {
  const f = fixture();
  for (const t of [0, 100, 200]) f.frame(t, 'tracking', hand, { x: 120, y: 50 });
  const near = f.engine.getSnapshot().state;
  assert.equal(near.phase, 'POINTING');
  if (near.phase === 'POINTING') { assert.equal(near.lockProgress, 0); assert.equal(near.lockStartedAt, null); }
  f.frame(300); f.frame(400); assert.equal(f.engine.getSnapshot().state.phase, 'LOCKED');
  f.frame(500, 'tracking', hand, { x: 101, y: 50 });
  assert.equal(f.engine.getSnapshot().state.phase, 'POINTING');
  assert.equal(f.events.filter(e => e.type === 'select').length, 0);
  f.frame(600); f.frame(700); f.frame(800);
  assert.equal(f.events.filter(e => e.type === 'select').length, 1); f.engine.dispose();
});
test('both current probability and belief must continuously exceed their thresholds', () => {
  for (const metric of ['probability', 'belief'] as const) {
    const machine = new SelectionMachine({ ...defaultSelectionConfig, lockDurationMs: 100, dwellDurationMs: 100 });
    const events: InteractionEvent[] = [];
    const update = (timestamp: number, value: number) => machine.update({ timestamp, leadingTargetId: 'a', targets: [
      { targetId: 'a', score: 1, probability: 0.99, belief: 0.99, [metric]: value },
    ] }, hand, 'camera', timestamp, 'tracking-unavailable', (_state, emitted) => events.push(...emitted), true, 0);
    update(0, 0.6); assert.equal(machine.state.phase, 'IDLE');
    update(100, 0.85); update(200, 0.85); assert.equal(machine.state.phase, 'POINTING');
    update(300, 0.99); update(400, 0.99); assert.equal(machine.state.phase, 'LOCKED');
    update(500, 0.85); assert.equal(machine.state.phase, 'POINTING');
    assert.equal(events.filter(e => e.type === 'select').length, 0);
    update(600, 0.99); update(700, 0.99); update(800, 0.99);
    assert.equal(events.filter(e => e.type === 'select').length, 1);
  }
});

test('small targets select at lower confidence, but still require containment and sustained evidence', () => {
  for (const width of [32, 64, 96]) {
    const machine = new SelectionMachine({ ...defaultSelectionConfig, lockDurationMs: 100, dwellDurationMs: 100 });
    const events: InteractionEvent[] = [];
    const rect = { x: 0, y: 0, width, height: 100 };
    const update = (timestamp: number, distance = 0, probability = 0.8, belief = 0.8) => machine.update({ timestamp, leadingTargetId: 'a', targets: [
      { targetId: 'a', score: 1, probability, belief },
    ] }, hand, 'camera', timestamp, 'tracking-unavailable', (_state, emitted) => events.push(...emitted), true, distance, rect);
    update(0, 1); update(100, 1);
    assert.equal(machine.state.phase, 'POINTING');
    if (machine.state.phase === 'POINTING') assert.equal(machine.state.lockStartedAt, null);
    update(200); update(300);
    assert.equal(machine.state.phase, width < 96 ? 'LOCKED' : 'POINTING');
    update(400, 0, 0.65); // Current evidence alone can cancel a lock.
    assert.equal(machine.state.phase, 'POINTING');
    update(500); update(600); update(700, 0, 0.8, 0.65);
    assert.equal(machine.state.phase, 'POINTING');
    assert.equal(events.filter(e => e.type === 'select').length, 0);
    update(800); update(900); update(1000);
    assert.equal(events.filter(e => e.type === 'select').length, width < 96 ? 1 : 0);
  }
});
