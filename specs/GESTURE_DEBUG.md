# G5–G9: calibration and live selection

Open `/?input=camera`, start the camera, and keep one hand visible. The pointing lab now includes registered test targets, raw probabilities, smoothed beliefs, lock/selection progress, state, and a gesture selection log. The test targets do not invoke kiosk actions; production kiosk wiring remains Phase 3.

Tracking controls select finger direction, hand direction, or their 70/30 blend independently of the vector overlay checkboxes. EMA and position/velocity Kalman remain available. Arm direction is unavailable until pose tracking is connected. Changes to pipeline settings cancel accumulated interaction progress.

Selection methods share the same intent and locking pipeline:

- Dwell: maintain the leader for a 300 ms lock, then the configured dwell duration (800 ms initially).
- Pinch: after lock, open thumb/index, then bring their image-space distance below 30% of palm width. Release above 65% rearms it.
- Fist: after lock, show an open palm, then fold all four fingers. The detector compares fingertip and proximal joint distances to the wrist.
- Push (experimental): increase apparent palm width by 30% relative to the first sample after lock. Rotation can mimic depth; this requires live tuning.

Highlighting requires the filtered, calibrated pointer within 24 CSS pixels of the target rectangle and both current probability and temporal belief strictly above 0.60. All methods require the pointer inside the target rectangle and both current probability and temporal belief strictly above the adjustable lock threshold (initially 0.85), continuously through lock and selection. Leaving the rectangle or losing either threshold resets progress. Selection enters a 900 ms cooldown. The probability model also reduces each target’s softmax probability by `exp(-(edgeDistance / 48)^2)`. Distance is measured from the filtered, calibrated pointer to the target rectangle in CSS pixels. At 48 px outside, a target retains at most 37% probability; at 96 px it retains under 2%. Remaining mass represents no target, shown explicitly in the lab. Temporal belief smooths these absolute probabilities without renormalizing them, so it decays as the pointer moves away. When no-target belief wins, the distribution has no leading target. Loss of tracking, a hand change, or leader/threshold loss cancels acquisition. Tracking stalls expire after 250 ms via the periodic clock. Cooldown survives tracking loss and target removal. Pinch/fist must be released after each new lock; push takes a new baseline.

## Calibration

Choose tracking method and projection distance first, then press **Calibrate pointing**. Aim at each of five circles, hold still for roughly half a second, and press Space (when the page body has focus) or have a helper press **Capture sample**. Each sample averages recent distinct frames and rejects missing, stale, mixed-hand, or unstable input. Calibration suppresses target selection.

The fit uses centered/scaled least squares for a six-coefficient affine map. Degenerate/collinear input fails with a retry message. The correction applies to viewport positions and velocities; direction remains in the contract's unmirrored image axes. Scoring separately transforms the direction into calibrated viewport axes.

Calibration is stored locally with viewport/mirroring metadata. The lab also records its tracking/projection settings and only restores it when those settings match the lab's initial settings. Changing projection or tracking clears the saved correction. A viewport or mirroring change invalidates calibration and cancels acquisition. Storage failures retain the correction for the current session. **Clear calibration** removes it.

## Module boundaries

- `pointing/calibration/affine.ts`: fit, apply, validate/load, save.
- `pages/calibration/CalibrationPage.tsx`: reusable calibration overlay.
- `intent/TargetRegistry.ts` and `hooks/useRegisteredTarget.ts`: immutable target geometry, registration lifecycle, enabled/priority changes, resize/scroll and layout polling.
- `intent/scoring.ts`: angular alignment, distance, motion trend, historical belief and prior; stable softmax over enabled, nonempty targets intersecting the viewport, followed by absolute proximity weighting and an implicit no-target outcome.
- `intent/temporal.ts`: temporal belief with absolute surviving history, no-target leader handling, deterministic ties and lock eligibility.
- `gestures/strategies.ts` and `SelectionMachine.ts`: independent gesture strategies and normalized ordered events.
- `gestures/LiveInteraction.ts`: composition accepting already projected/filtered/calibrated frames; implements the interaction output boundary. Call `process` for new input and `tick` periodically; `dispose` releases registry subscriptions. Full provider orchestration remains Phase 3.

## Validation

`npm test`, `npm run lint`, and `npm run build` cover fitting/persistence, registry lifecycle, eligibility/normalization, temporal ties, timing, stale frames, tracking timeout/hand changes, target removal (including synchronous removal during select delivery), cooldown, and gesture arming.

Manual device checks still required: allow camera access; compare each tracking/filter mode; calibrate; acquire each test target with each selection method; remove your hand during lock; hold a pinch/fist across cooldown; scroll/resize and check target geometry; rotate the device and recalibrate. Verify denied permission and camera stop/restart. Real-camera accuracy and iPad/Safari performance are not established by unit tests.
