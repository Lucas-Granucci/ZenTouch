import './fixtures/kiosk/register.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InteractionEngine, defaultPipelineSettings } from '../src/interaction/engine/InteractionEngine.ts';
import { createInput, connectLandmarks } from '../src/interaction/engine/createInput.ts';
import { TargetActivation } from '../src/interaction/react/activation.ts';
import { createGeometryStore } from '../src/interaction/react/geometryStore.ts';
import { SimulatedInputProvider } from '../src/interaction/simulated/SimulatedInputProvider.ts';
import { softSnapModel, interactionMessage } from '../src/components/zentouch/feedbackModel.ts';
import type { HandLandmarks, LandmarkFrame, InteractionEvent, LandmarkProvider } from '../src/types/interaction.ts';
const { kioskReducer, initialKioskState } = await import('../src/state/kiosk/reducer.ts');
const viewport = { x: 0, y: 0, width: 1000, height: 800 };
const settings = { ...defaultPipelineSettings, selection: { ...defaultPipelineSettings.selection, lockDurationMs: 100, dwellDurationMs: 100, cooldownDurationMs: 100 } };
function frame(timestamp: number, x = 0.5): LandmarkFrame {
  const landmarks = Array.from({ length: 21 }, () => ({ x, y: 0.5, z: 0 }));
  landmarks[0] = { x, y: 0.7, z: 0 }; landmarks[8] = { x, y: 0.3, z: 0 };
  return { timestamp, source: 'camera', imageSize: { width: 640, height: 480 }, previewMirrored: true, status: 'tracking',
    hands: [{ id: 'hand', handedness: 'right', handednessConfidence: 1, confidence: 1, landmarks: landmarks as unknown as HandLandmarks, worldLandmarks: null, elbow: null }] };
}
const target = { id: 'begin', enabled: true, rect: { x: 450, y: 190, width: 100, height: 100 } };

test('landmarks project, filter, score, lock and select the same kiosk action as native activation', () => {
  for (const method of ['camera', 'click'] as const) {
    const engine = new InteractionEngine(() => viewport, settings);
    const router = new TargetActivation(engine);
    let state = initialKioskState, activations = 0;
    const remove = engine.targets.register(target);
    const unregister = router.register('begin', () => { activations++; state = kioskReducer(state, { type: 'NAVIGATE_RESTAURANTS' }); remove(); unregister(); });
    engine.processFrame(frame(0)); engine.processFrame(frame(100));
    assert.equal(engine.getSnapshot().state.phase, 'LOCKED');
    const glow = softSnapModel(engine.getSnapshot(), engine.targets.getSnapshot(), settings.selection)!;
    assert.equal(glow.progress, 0.5); assert.equal(glow.x, 500);
    if (method === 'camera') engine.processFrame(frame(200)); else router.click('begin');
    assert.equal(state.screen, 'restaurants'); assert.equal(activations, 1);
    assert.equal(engine.targets.getSnapshot().length, 0);
    router.click('begin'); engine.processFrame(frame(performance.now() + 1000));
    assert.equal(activations, 1);
    router.dispose(); engine.dispose();
  }
});

test('calibration transforms filtered position and velocity; resize invalidates it; stale frames cannot change the filter', () => {
  let size = viewport;
  const engine = new InteractionEngine(() => size, settings, { status: 'calibrated', transform: [1, 0, 20, 0, 1, 30], viewportSize: viewport, previewMirrored: true });
  engine.processFrame(frame(0));
  assert.deepEqual(engine.getSnapshot().pointing?.position, { x: 520, y: 270 });
  engine.processFrame(frame(100, 0.4));
  assert.equal(engine.getSnapshot().pointing?.position.x, 545);
  assert.equal(engine.getSnapshot().pointing?.velocity?.x, 250);
  const snapshot = engine.getSnapshot(); engine.processFrame(frame(50, 0)); assert.equal(engine.getSnapshot(), snapshot);
  size = { ...viewport, width: 800 }; engine.processFrame(frame(200));
  assert.equal(engine.getSnapshot().calibration.status, 'uncalibrated');
  assert.equal(engine.getSnapshot().pointing?.position.x, 400);
  assert.equal(engine.getSnapshot().pointing?.velocity, null);
  engine.dispose();
});

test('calibration collection, disabled targets, tracking loss and timeout prevent selections', () => {
  for (const cause of ['calibration', 'disabled', 'lost', 'timeout'] as const) {
    const engine = new InteractionEngine(() => viewport, settings);
    engine.targets.register(target);
    let selections = 0; engine.subscribeEvents(e => { if (e.type === 'select') selections++; });
    const now = Math.floor(performance.now()); engine.processFrame(frame(now)); engine.processFrame(frame(now + 100));
    assert.equal(engine.getSnapshot().state.phase, 'LOCKED');
    if (cause === 'calibration') { engine.reset(now + 100); engine.setSuspended(true); engine.processFrame(frame(now + 200)); }
    if (cause === 'disabled') { engine.targets.update({ ...target, enabled: false }); engine.processFrame(frame(now + 200)); }
    if (cause === 'lost') engine.processFrame({ ...frame(now + 200), status: 'no-hand', hands: [] });
    if (cause === 'timeout') engine.tick(now + 350);
    assert.equal(selections, 0); assert.notEqual(engine.getSnapshot().state.phase, 'LOCKED');
    engine.dispose();
  }
});

test('terminal camera failures survive timeout ticks', () => {
  const engine = new InteractionEngine(() => viewport);
  engine.processFrame({ ...frame(0), status: 'permission-denied', hands: [] }); engine.tick(10000);
  assert.equal(engine.getSnapshot().tracking, 'permission-denied'); engine.dispose();
});

test('provider switch disconnects pending frames and disposes the former registry', () => {
  const engine = createInput('camera', settings, () => viewport);
  assert.ok(engine instanceof InteractionEngine);
  let listener: ((frame: LandmarkFrame) => void) | undefined, stopped = 0, unsubscribed = 0;
  const provider: LandmarkProvider = { source: 'camera', start: async () => {}, stop: () => { stopped++; }, subscribe: fn => { listener = fn; return () => { unsubscribed++; }; } };
  const disconnect = connectLandmarks(engine, provider);
  engine.targets.register(target); listener!(frame(0));
  disconnect(); const snapshot = engine.getSnapshot(); listener!(frame(100));
  assert.equal(engine.getSnapshot(), snapshot); assert.equal(stopped, 1); assert.equal(unsubscribed, 1);
  engine.dispose();
  const simulated = createInput('simulated', settings, () => viewport);
  assert.ok(simulated instanceof SimulatedInputProvider); assert.equal(simulated.targets.getSnapshot().length, 0);
  assert.equal(simulated.getSnapshot().source, 'simulated'); simulated.dispose();
});

test('one router deduplicates select delivery across target remounts and suppresses native clicks during cooldown', () => {
  let time = 0;
  const input = new SimulatedInputProvider({ now: () => time, lockDurationMs: 100, dwellDurationMs: 100, cooldownDurationMs: 100 });
  let deliver: ((event: InteractionEvent) => void) | undefined;
  const subscribe = input.subscribeEvents;
  input.subscribeEvents = fn => { deliver = fn; return subscribe(fn); };
  const router = new TargetActivation(input);
  let count = 0, event: InteractionEvent | undefined;
  const route = deliver!;
  input.subscribeEvents(e => { if (e.type === 'select') event = e; });
  input.targets.register(target); let removeAction = router.register('begin', () => count++);
  input.pointAt('begin'); time = 100; input.tick(); time = 200; input.tick();
  assert.equal(count, 1); router.click('begin'); assert.equal(count, 1);
  removeAction(); removeAction = router.register('begin', () => count++); route(event!); assert.equal(count, 1);
  time = 300; input.tick(); router.click('begin'); assert.equal(count, 2);
  input.targets.update({ ...target, enabled: false }); router.click('begin'); assert.equal(count, 2);
  removeAction(); router.dispose(); input.dispose();
});

test('geometry store is stable between notifications and overlay tracks moved and removed targets', () => {
  const input = new SimulatedInputProvider({ now: () => 0 });
  const store = createGeometryStore(input.targets); const unsubscribe = store.subscribe(() => {});
  assert.equal(store.getSnapshot(), store.getSnapshot()); const remove = input.targets.register(target);
  input.pointAt('begin', 0, { x: 500, y: 240 });
  const before = store.getSnapshot(); input.targets.update({ ...target, rect: { ...target.rect, x: 600 } });
  assert.notEqual(store.getSnapshot(), before);
  assert.equal(softSnapModel(input.getSnapshot(), store.getSnapshot())?.x, 650);
  remove(); assert.equal(store.getSnapshot().length, 0); assert.equal(softSnapModel(input.getSnapshot(), store.getSnapshot()), null);
  unsubscribe(); input.dispose();
});

test('non-dwell feedback describes the selected strategy', () => {
  const engine = new InteractionEngine(() => viewport, settings); engine.targets.register(target);
  engine.processFrame(frame(0)); engine.processFrame(frame(100));
  assert.match(interactionMessage(engine.getSnapshot(), 'pinch'), /pinch/);
  assert.match(interactionMessage(engine.getSnapshot(), 'fist'), /fist/);
  engine.dispose();
});
