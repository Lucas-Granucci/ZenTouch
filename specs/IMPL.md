Start with two parallel tracks: the gesture pipeline and a complete example kiosk interface. Stabilize the event contract early so both can be developed independently.

## Phase 1 — Foundation

F2 contracts are defined in [`INTERACTION.md`](INTERACTION.md) and [`src/types/interaction.ts`](../src/types/interaction.ts), including coordinate/time conventions, state transitions, and event delivery rules. Runtime implementations follow in F3 and G1–G9.

F3 is implemented by [`SimulatedInputProvider`](../src/interaction/simulated/SimulatedInputProvider.ts). Open `/?input=simulated` for the mouse demo, or follow the [usage guide](SIMULATED_INPUT.md) for deterministic scripts and UI integration.

| ID | Task                           | Brief technical description                                                                                                                                              |
| -- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1 | Scaffold frontend              | Create the Vite + React + TypeScript + Tailwind app. Add directories for `interaction`, `components`, `kiosk`, `benchmark`, and shared types.                            |
| F2 | Define interaction contracts   | Define landmark-frame input, registered-target geometry, intent probabilities, engine state, and normalized events such as `{ type, targetId, confidence, timestamp }`.  |
| F3 | Build simulated input provider | Create a mouse-controlled or scripted provider that emits the same data/events as the future gesture engine. This lets UI development and integration begin immediately. |

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

## Phase 2C — Benchmarking

This can begin once raw pointing output exists.

| ID | Task                           | Brief technical description                                                                                                    |
| -- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| B1 | Build pointing benchmark       | Present randomized targets and record predicted target, intended target, acquisition time, confidence, and target switches.    |
| B2 | Build selection-method harness | Run dwell, pinch, push, and palm/fist strategies through the same target trials without changing the underlying UI.            |
| B3 | Add local metrics              | Calculate accuracy, median acquisition time, false-activation rate, and target-switch count. Export trial data as JSON or CSV. |
| B4 | Add condition labels           | Allow trials to be tagged by lighting, distance, hand, calibration state, and selection method for later comparison.           |

## Phase 3 — Integration

| ID | Task                                      | Brief technical description                                                                                                                          |
| -- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1 | Connect target registry to kiosk controls | Ensure every actionable kiosk element registers its current DOM rectangle and unregisters cleanly when screens change.                               |
| I2 | Replace simulated intent with live intent | Feed MediaPipe landmarks through projection, smoothing, calibration, scoring, and temporal filtering while keeping the simulated provider available. |
| I3 | Route normalized selections               | Convert the state machine’s `SELECT` output into the same actions used by clicks. Prevent duplicate activation from dwell and native click events.   |
| I4 | Integrate soft-snap rendering             | Drive glow position, target highlighting, and lock progress directly from the engine’s leading target and probability.                               |
| I5 | Add operator/debug mode                   | Provide toggles for camera preview, landmarks, probabilities, thresholds, smoothing, selection method, and FPS without exposing them in kiosk mode.  |
| I6 | Tune using benchmark results              | Choose weights, confidence thresholds, dwell duration, cooldown, and smoothing based on measured performance rather than demo-specific hardcoding.   |

## Phase 4 — Demo Hardening

| ID | Task                      | Brief technical description                                                                                                                                  |
| -- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1 | Test on the target iPad   | Verify camera permission, front-camera selection, orientation, viewport sizing, WASM loading, performance, and Safari behavior.                              |
| D2 | Handle failure states     | Add clear states for missing permission, lost hand tracking, low confidence, multiple hands, failed calibration, and camera interruption.                    |
| D3 | Optimize performance      | Throttle inference separately from rendering, avoid React state updates per landmark frame, and move high-frequency engine state outside the component tree. |
| D4 | Prepare demo reset        | Add a one-action reset that clears the order, engine state, cooldown, benchmark trial, and optionally calibration.                                           |
| D5 | Run end-to-end rehearsals | Test the full flow at different distances and lighting levels, record failures, and freeze a known-good configuration before judging.                        |

prioritize the vertical slice `F1–F3 → G1–G4 → G6–G9 → U1–U7 → I1–I4`. Treat pose tracking, EKF refinements, push selection, Express, and SQLite as secondary unless the core interaction is already dependable.
