# Simulated input: quick start

Build and try gesture-aware UI without a camera. The simulator implements the same `InteractionOutput` contract that the live engine will expose.

## Try it in your browser

1. Run `npm install` if you have not installed dependencies yet.
2. Run `npm run dev`.
3. Open the URL Vite prints, adding `?input=simulated` (usually `http://localhost:5173/?input=simulated`).
4. Move your mouse onto **Tea** or **Coffee**, then hold still. No click needed.

You will see **POINTING → LOCKED → COOLDOWN**, and the drink count increases once. The event list records the selection. Moving away before selection cancels it. Staying on a drink selects it again after a fresh cooldown, lock, and dwell.

The defaults are **250 ms to lock**, **800 ms more to select**, and **600 ms of cooldown**. The transient `SELECT` state is delivered synchronously; React may render only the following `COOLDOWN` state.

Click and keyboard activation also increase the count directly. They are separate inputs: clicking while hovering does not cancel a later dwell selection. Use hover alone when testing simulated gestures. **Reset demo** clears counts and interaction progress.

The ordinary welcome page is still available at `/`.

## Use a script

This example runs without a browser, camera, timers, or waiting. Import paths below assume a file in the project root.

```ts
import { SimulatedInputProvider } from './src/interaction/simulated/SimulatedInputProvider.ts'

let time = 0
const input = new SimulatedInputProvider({
  now: () => time,
  lockDurationMs: 250,
  dwellDurationMs: 800,
  cooldownDurationMs: 600,
})

const unregister = input.targets.register({
  id: 'add-tea',
  enabled: true,
  rect: { x: 20, y: 20, width: 200, height: 100 },
})

const unsubscribe = input.subscribeEvents((event) => {
  if (event.type === 'select') console.log('Activate:', event.targetId)
})

input.pointAt('add-tea') // POINTING
time = 250
input.tick()            // LOCKED; dwell starts now
time = 1050
input.tick()            // One select event, then COOLDOWN
input.pointAt(null)     // Simulate losing the hand; cooldown survives

unsubscribe()
unregister()
input.dispose()
```

Save it as `simulate.ts` and run `node --experimental-strip-types simulate.ts` using the project's supported Node version. Keep the injected clock in sync with explicit timestamps. Time cannot move backward, even after reset. A large time jump advances one phase; it does not invent selections for missed time. Call `tick` at the lock boundary and again at the dwell boundary as above.

## Connect your UI

1. Create one provider for your screen/session.
2. Register each action with a unique ID and its `getBoundingClientRect()` rectangle. Call `targets.update(...)` when layout, scroll, resize, or enabled state changes. Call the returned cleanup when the action unmounts.
3. Subscribe to `select` events and call the same action function used by your button's `onClick`. Recheck that the target is still enabled and deduplicate `event.id`. Do not dispatch another DOM click.
4. Call `input.connectMouse(containerElement)` to start mouse input and automatic animation-frame ticks. Keep the returned disconnect function for cleanup.
5. Disconnect, unsubscribe, unregister, and dispose when finished.

For React feedback, read the provider as an external store:

```tsx
const snapshot = useSyncExternalStore(input.subscribe, input.getSnapshot)
const activeId = snapshot.intent.leadingTargetId
const phase = snapshot.state.phase
```

See [SimulatedInputDemo.tsx](../src/pages/kiosk/SimulatedInputDemo.tsx) for the complete React example, including geometry updates, event handling, and cleanup.

## Small API reference

| Call | What it does |
| --- | --- |
| `pointAt(id, timestamp?, position?)` | Aim at an enabled registered target. Position defaults to its center. |
| `pointAt(null, timestamp?)` | Clear the current target and cancel unfinished selection. |
| `tick(timestamp?)` | Advance lock, dwell, or cooldown using monotonic milliseconds. |
| `connectMouse(element)` | Use mouse coordinates to choose a target; returns cleanup. A new connection replaces the old one. |
| `getSnapshot()` | Read the current immutable state; identity stays stable between publications. |
| `subscribe(listener)` | Receive snapshot notifications; returns cleanup. |
| `subscribeEvents(listener)` | Receive ordered events, without replay; returns cleanup. |
| `targets.register/update/getSnapshot/subscribe` | Maintain explicit target geometry and eligibility. |
| `reset(timestamp?)` | Clear progress and cooldown; retain targets and subscriptions. |
| `dispose()` | Release listeners and mouse resources. Safe to repeat; later mutations throw. |

## What is simulated?

Mouse mode uses rectangle hit testing; script mode chooses the target explicitly. The chosen target gets probability and belief **1**; other targets are omitted. Overlapping mouse targets use lexicographic ID order. Disabled, zero-area, and fully offscreen targets cannot be selected. In scripts without a browser, there is no upper viewport boundary check.

This deliberately substitutes simple intent for the future scoring pipeline. It emits `source: 'simulated'`, uses dwell only, and does not produce landmarks, score real hand motion, calibrate, or estimate tracking quality. Confidence stays at 1, so there are no confidence-change `target-update` events. Scripted intent persists until changed; mouse intent clears on pointer exit or window blur. There is no camera tracking timeout to simulate.

The provider handles immediate target invalidation and preserves cooldown across navigation. General DOM registration hooks, production scoring, and other selection strategies remain later tasks in [IMPL.md](IMPL.md).

Run `npm test`, `npm run lint`, and `npm run build` to check the implementation.
