Start with two parallel tracks: the gesture pipeline and a complete example kiosk interface. Stabilize the event contract early so both can be developed independently.

## File ownership and merge order

Paths below follow the current repository and [`REPO.md`](REPO.md). They are ownership boundaries for implementation, not a claim that every file already exists; new filenames are proposed. Use `src/pages/benchmark/` and `src/benchmark/` for the benchmark, rather than introducing the `apps/benchmark` tree mentioned in `SPEC.md`. Express and SQLite remain deferred.

- Finish F1/F2 before branching the parallel tracks. Phase 2A owns engine internals, 2B owns kiosk UI/state, and 2C owns benchmark UI/metrics. Import other tracks through the F2 contracts; request changes from the owning track instead of editing its files.
- Keep `src/types/interaction.ts` and `specs/INTERACTION.md` under one contract owner after F2. Merge any agreed contract change first, then update dependent branches. Put private types and helpers beside their implementation instead of growing shared `src/types/` or `src/utils/` files.
- A single integration owner handles `src/app/App.tsx`, `src/main.tsx`, `src/index.css`, `index.html`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig*.json`, `.oxlintrc.json`, and `.gitignore`. F1 initializes them; subsequent tracks submit small prerequisite changes to that owner. Merge dependency changes together with the generated lockfile before dependent work. Keep feature styles/assets in their owned folders.
- During Phase 2, expose feature entry components for later wiring; do not have all tracks edit `App.tsx`. Avoid shared barrel files. Keep tests in separate files with the prefixes below (the current test command discovers `tests/*.test.ts`). Browser test setup or test-runner changes go through the integration owner.
- Merge Phase 2 modules before Phase 3 wires them together. Phase 3 may touch earlier files only after their owners hand them off; Phase 4 follows the same rule. If work overlaps, retain the original file owner and merge their fix first rather than patching the same file on two branches.
- This plan and other shared documentation also have one editor at a time. Feature-specific notes belong in the dedicated documents listed below; do not update `README.md` or reorganize directories independently on each track.

## Phase 1 — Foundation

F2 contracts are defined in [`INTERACTION.md`](INTERACTION.md) and [`src/types/interaction.ts`](../src/types/interaction.ts), including coordinate/time conventions, state transitions, and event delivery rules. Runtime implementations follow in F3 and G1–G9.

F3 is implemented by [`SimulatedInputProvider`](../src/interaction/simulated/SimulatedInputProvider.ts). Open `/?input=simulated` for the mouse demo, or follow the [usage guide](SIMULATED_INPUT.md) for deterministic scripts and UI integration.

| ID | Task                           | Brief technical description                                                                                                                                              |
| -- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1 | Scaffold frontend              | Create the Vite + React + TypeScript + Tailwind app. Add directories for `interaction`, `components`, `kiosk`, `benchmark`, and shared types.                            |
| F2 | Define interaction contracts   | Define landmark-frame input, registered-target geometry, intent probabilities, engine state, and normalized events such as `{ type, targetId, confidence, timestamp }`.  |
| F3 | Build simulated input provider | Create a mouse-controlled or scripted provider that emits the same data/events as the future gesture engine. This lets UI development and integration begin immediately. |

### Files to touch — Phase 1

| Tasks | Owned folders/files | Boundary / handoff |
| --- | --- | --- |
| F1 | Root scaffold/config files listed above; `src/main.tsx`, `src/app/App.tsx`, `src/index.css`, `src/pages/kiosk/KioskPage.tsx`; `README.md`, `specs/REPO.md` | Establish the layout once. Hand the kiosk page to 2B and retain shared app/config ownership for integration. |
| F2 | `src/types/interaction.ts`, `specs/INTERACTION.md` | Freeze the provider, registry, snapshot, event, and engine interfaces before parallel work. |
| F3 | `src/interaction/simulated/SimulatedInputProvider.ts`, `src/pages/kiosk/SimulatedInputDemo.tsx`, `tests/simulated-input.test.ts`, `specs/SIMULATED_INPUT.md` | Keep the existing simulator and demo as a reusable fixture. 2B consumes the provider; simulator changes stay with its owner until Phase 3. |

## Phase 2A — Gesture and Intent Pipeline

These tasks form one track. G1 and the UI track can start concurrently.

| ID | Task                             | Brief technical description                                                                                                                                                     |
| -- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1 | Camera and MediaPipe integration | Request the front camera, initialize `HandLandmarker`, process video frames, and expose timestamped 2D/3D hand landmarks with tracking confidence.                              |
| G2 | Landmark debug view              | Overlay landmarks, handedness, FPS, confidence, and raw pointing vectors on the camera feed. Include toggles for finger, hand, and arm vectors.                                 |
| G3 | Pointing estimator               | Implement finger and hand direction estimators from landmarks. Add arm direction only if pose tracking is enabled. Return projected screen position, direction, and confidence. |
| G4 | Signal smoothing                 | Implement EMA first, then a position-and-velocity Kalman/EKF filter behind a shared interface. Make smoothing parameters configurable from the debug panel.                     |
| G5 | Calibration flow                 | Display several known targets, collect projected and expected points, fit the affine correction \(p' = Ap+b\), and store calibration locally.                                   |
| G6 | DOM target registry              | Create registration hooks/components that continuously report each interactive element’s rectangle, enabled state, and optional priority to the engine.                         |
| G7 | Intent scoring engine            | Score every registered target using alignment, projected distance, motion, history, and UI prior. Normalize scores with softmax and expose `P(target)`.                         |
| G8 | Temporal belief and locking      | Smooth target probabilities over frames, track the leading target, and lock only after it exceeds a configurable threshold for the required duration.                           |
| G9 | Selection state machine          | Implement `IDLE → POINTING → LOCKED → SELECT → COOLDOWN`. Start with dwell selection; add pinch, push, or fist as isolated interchangeable strategies.                          |

### Files to touch — Phase 2A

| Tasks | Owned folders/files | Boundary / handoff |
| --- | --- | --- |
| G1 | `src/interaction/vision/`, `src/hooks/useCamera.ts`, `public/mediapipe/` | Own camera lifecycle and model/WASM assets. Request MediaPipe dependency/config changes through the integration owner. |
| G2 | `src/components/debug/LandmarkDebugView.tsx` and adjacent styles | Own the camera/landmark visualization; expose it for I5 to compose into operator mode. |
| G3 | `src/interaction/pointing/` (excluding `calibration/`) | Keep projection/vector helpers local to this module. |
| G4 | `src/interaction/filtering/` | Export filters and parameter interfaces; I5 owns the final operator controls. |
| G5 | `src/interaction/pointing/calibration/`, `src/pages/calibration/` | Own affine fitting, persistence, and calibration UI. Export a page; defer app navigation wiring to Phase 3. |
| G6 | `src/interaction/intent/TargetRegistry.ts`, `src/hooks/useRegisteredTarget.ts` | Own registry implementation and DOM measurement hook. U2 owns the controls consuming this hook. |
| G7 | `src/interaction/intent/scoring.ts` and scoring-specific helpers | Consume registered geometry through F2; avoid editing G6's registry. |
| G8 | `src/interaction/intent/temporal.ts` and belief-specific helpers | Export belief/lock eligibility calculations; G9 owns state transitions. |
| G9 | `src/interaction/gestures/` | Own the state machine and interchangeable selection strategies; B2 consumes these strategies rather than implementing duplicates. |
| G1–G9 validation | `tests/vision-*.test.ts`, `tests/pointing-*.test.ts`, `tests/filtering-*.test.ts`, `tests/calibration-*.test.ts`, `tests/registry-*.test.ts`, `tests/intent-*.test.ts`, `tests/gestures-*.test.ts` | Each module owns its tests. Keep shared contracts, kiosk controls, and benchmark files outside this track's edits. |

## Phase 2B — Example Kiosk Interface

These tasks can run concurrently with G1–G9.

| ID | Task                                | Brief technical description                                                                                                                                     |
| -- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1 | Design the example flow             | Define a small food-ordering flow: category/menu → item customization → cart → confirmation. Keep it short enough for a reliable live demo.                     |
| U2 | Create interaction-aware components | Build large target buttons, cards, quantity controls, back actions, and confirmation controls. Each component must support click and normalized gesture events. |
| U3 | Implement kiosk state               | Use Context + `useReducer` for navigation, selected items, customization, cart totals, and order completion. Keep input handling independent of UI state.       |
| U4 | Build kiosk screens                 | Implement the full example flow with responsive iPad layouts, clear hierarchy, generous spacing, and obvious recovery/back actions.                             |
| U5 | Soft-snap feedback overlay          | Render the hand as a glow rather than a cursor. Interpolate the glow toward the leading target based on intent confidence and show dwell/lock progress.         |
| U6 | Add accessible feedback             | Provide visible focus, selection confirmation, cooldown feedback, timeout recovery, reduced-motion support, and sufficient contrast.                            |
| U7 | Validate with simulated input       | Complete the entire kiosk flow using the simulated provider before connecting the camera pipeline.                                                              |

### Files to touch — Phase 2B

| Tasks | Owned folders/files | Boundary / handoff |
| --- | --- | --- |
| U1, U3 | `src/state/kiosk/` (menu data, domain types, context, reducer); `specs/KIOSK_FLOW.md` | Keep order/navigation state here, independent of engine internals and app wiring. |
| U2 | `src/components/zentouch/TouchlessButton.tsx`, `TouchlessCard.tsx`, `QuantityControl.tsx` within that folder; `src/components/kiosk/` | Own reusable controls and their click/action API. Consume F2 and the G6 hook when available; I1/I3 own final registration and event wiring. |
| U4 | `src/pages/kiosk/KioskPage.tsx`, new screens in `src/pages/kiosk/`, `src/assets/kiosk/`, `public/kiosk/` | Exclude the F3-owned `SimulatedInputDemo.tsx`. Keep screen/component styles adjacent to their owners instead of editing global CSS. |
| U5 | `src/components/zentouch/SoftSnapOverlay.tsx` and adjacent styles | Accept snapshot/geometry inputs through props; I4 supplies the live subscription. |
| U6 | The U2/U4/U5 files above; `src/components/zentouch/InteractionFeedback.tsx` | Accessibility work is part of this UI track and coordinated with its component owners, not a separate branch rewriting the same controls. |
| U7 | `tests/kiosk-*.test.ts`, `tests/ui-*.test.ts`, `specs/KIOSK_VALIDATION.md` | Import the F3 simulator without modifying its implementation/demo/tests. Record full-flow manual checks here if browser automation is not yet configured. |

## Phase 2C — Benchmarking

This can begin once raw pointing output exists.

| ID | Task                           | Brief technical description                                                                                                    |
| -- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| B1 | Build pointing benchmark       | Present randomized targets and record predicted target, intended target, acquisition time, confidence, and target switches.    |
| B2 | Build selection-method harness | Run dwell, pinch, push, and palm/fist strategies through the same target trials without changing the underlying UI.            |
| B3 | Add local metrics              | Calculate accuracy, median acquisition time, false-activation rate, and target-switch count. Export trial data as JSON or CSV. |
| B4 | Add condition labels           | Allow trials to be tagged by lighting, distance, hand, calibration state, and selection method for later comparison.           |

### Files to touch — Phase 2C

| Tasks | Owned folders/files | Boundary / handoff |
| --- | --- | --- |
| B1 | `src/pages/benchmark/BenchmarkPage.tsx`, `src/pages/benchmark/components/`, `src/benchmark/trials.ts`, `src/benchmark/types.ts` | Own trial presentation and records. Consume pointing/interaction output; export the page for I5 to wire. |
| B2 | `src/benchmark/selectionHarness.ts` | Import G9 selection strategies through their public interface; request any missing strategy from 2A. |
| B3 | `src/benchmark/metrics.ts`, `src/benchmark/export.ts` | Keep metrics/export independent of the kiosk reducer and engine internals. |
| B4 | `src/pages/benchmark/ConditionControls.tsx`, `src/benchmark/conditions.ts` | Put condition metadata in benchmark-local types; coordinate changes to `types.ts` with B1. |
| B1–B4 validation | `tests/benchmark-*.test.ts`, `specs/BENCHMARK.md` | Use benchmark-specific fixtures under `tests/fixtures/benchmark/`; do not append to other tracks' test files. |

## Phase 3 — Integration

| ID | Task                                      | Brief technical description                                                                                                                          |
| -- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1 | Connect target registry to kiosk controls | Ensure every actionable kiosk element registers its current DOM rectangle and unregisters cleanly when screens change.                               |
| I2 | Replace simulated intent with live intent | Feed MediaPipe landmarks through projection, smoothing, calibration, scoring, and temporal filtering while keeping the simulated provider available. |
| I3 | Route normalized selections               | Convert the state machine’s `SELECT` output into the same actions used by clicks. Prevent duplicate activation from dwell and native click events.   |
| I4 | Integrate soft-snap rendering             | Drive glow position, target highlighting, and lock progress directly from the engine’s leading target and probability.                               |
| I5 | Add operator/debug mode                   | Provide toggles for camera preview, landmarks, probabilities, thresholds, smoothing, selection method, and FPS without exposing them in kiosk mode.  |
| I6 | Tune using benchmark results              | Choose weights, confidence thresholds, dwell duration, cooldown, and smoothing based on measured performance rather than demo-specific hardcoding.   |

### Files to touch — Phase 3

| Tasks | Owned folders/files | Boundary / handoff |
| --- | --- | --- |
| I1, I3 | `src/interaction/react/InteractionProvider.tsx`, `src/hooks/useInteraction.ts`, `src/hooks/useTargetActivation.ts`; handed-off U2 controls and G6 hook as needed | Centralize registration context, subscriptions, and selection deduplication in the adapter layer. Keep action logic in the existing kiosk reducer. Assign I1/I3 one adapter owner to avoid overlapping edits. |
| I2 | `src/interaction/engine/InteractionEngine.ts`, `src/interaction/engine/createInput.ts`, `src/app/App.tsx` | Compose the completed pipeline and provider switching here. Retain simulated mode; engine module fixes go through the module owner if that work is still active. |
| I4 | `src/interaction/react/InteractionOverlay.tsx`; handed-off `src/components/zentouch/SoftSnapOverlay.tsx` if its props need adjustment | Own the live snapshot-to-overlay adapter; keep rendering in U5's component. |
| I5 | `src/pages/operator/`, `src/app/App.tsx` | Compose debug view, calibration, benchmark, and settings. The same app owner as I2 serializes route/provider wiring. |
| I6 | `src/interaction/config/defaults.ts`, `specs/TUNING.md` | Keep measured default parameters in one file consumed by engine/operator mode; do not scatter constants across earlier modules. |
| I1–I6 validation | `tests/integration-*.test.ts`, `tests/fixtures/integration/` | Cover registry cleanup, provider switching, shared click/gesture actions, deduplication, and overlay updates. |

## Phase 4 — Demo Hardening

| ID | Task                      | Brief technical description                                                                                                                                  |
| -- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1 | Test on the target iPad   | Verify camera permission, front-camera selection, orientation, viewport sizing, WASM loading, performance, and Safari behavior.                              |
| D2 | Handle failure states     | Add clear states for missing permission, lost hand tracking, low confidence, multiple hands, failed calibration, and camera interruption.                    |
| D3 | Optimize performance      | Throttle inference separately from rendering, avoid React state updates per landmark frame, and move high-frequency engine state outside the component tree. |
| D4 | Prepare demo reset        | Add a one-action reset that clears the order, engine state, cooldown, benchmark trial, and optionally calibration.                                           |
| D5 | Run end-to-end rehearsals | Test the full flow at different distances and lighting levels, record failures, and freeze a known-good configuration before judging.                        |

### Files to touch — Phase 4

| Tasks | Owned folders/files | Boundary / handoff |
| --- | --- | --- |
| D1 | `specs/IPAD_VALIDATION.md`; targeted fixes in `src/interaction/vision/`, `public/mediapipe/`, app/viewport/config files | Record device/browser results. Route each fix to the current module owner; the integration owner handles root config and dependencies. |
| D2 | `src/components/zentouch/InteractionFeedback.tsx`, `src/interaction/engine/InteractionEngine.ts`, `src/interaction/vision/`, `src/pages/calibration/` | This crosses prior ownership boundaries: serialize engine/camera fixes with their owners, then wire the resulting status into feedback/calibration UI. |
| D3 | `src/interaction/vision/`, `src/interaction/engine/`, `src/interaction/react/`, `src/hooks/useInteraction.ts` | Assign one performance owner for scheduling/store/subscription changes; coordinate with D2 before editing their shared engine/vision files. |
| D4 | `src/app/resetDemo.ts`, `src/pages/operator/DemoReset.tsx`; reset APIs in `src/state/kiosk/`, `src/interaction/engine/`, `src/benchmark/trials.ts` as needed | Put reset orchestration in one app module. Extend subsystem APIs through their owners, including optional calibration clearing. |
| D5 | `specs/DEMO_RUNBOOK.md`, `tests/e2e/`, `src/interaction/config/defaults.ts` | Record rehearsals and freeze the I6-owned configuration after tuning stops. Browser tests here require integration-owned runner setup; they are not discovered by the current unit-test command. |
| D1–D4 regression checks | Relevant existing module tests or new `tests/hardening-*.test.ts` | Update tests with each owned fix. Avoid concurrent broad refactors or formatting changes during hardening. |

prioritize the vertical slice `F1–F3 → G1–G4 → G6–G9 → U1–U7 → I1–I4`. Treat pose tracking, EKF refinements, push selection, Express, and SQLite as secondary unless the core interaction is already dependable.
