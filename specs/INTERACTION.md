# F2 — Interaction contracts

The public, framework-independent boundary is [`src/types/interaction.ts`](../src/types/interaction.ts). These are contracts, not implementations: F3 supplies simulated input/output; G1–G9 supply the camera pipeline and state machine. UI components consume `InteractionOutput` and register with `TargetRegistry`, without importing MediaPipe or storing per-frame state in React reducers.

## Coordinates and time

- All numbers must be finite. `Probability` and progress values are in [0, 1]. Type aliases document units/ranges; they do not perform runtime validation. Producers must validate external data before publishing it.
- Landmark arrays contain exactly 21 points in MediaPipe order. Image x/y use the unmirrored source image (normally [0, 1], but inference can extend outside the image); z is wrist-relative with smaller values closer to the camera. World landmarks are optional model estimates in meters, not measured depth. Optional pose elbow coordinates must be converted to the same image convention before fusion.
- Hand IDs remain stable while tracked. Handedness confidence is separate from tracking quality; the camera adapter must document how it estimates tracking quality if the model does not provide it directly.
- Pointing positions, velocities, and target rectangles use client viewport CSS pixels, matching `getBoundingClientRect()`. Velocities use seconds. Projection applies preview mirroring exactly once, before calibration; no device-pixel-ratio or page-scroll offsets are added. A direction is normalized or null, never a zero unit vector.
- Timestamps use the `performance.now()` monotonic millisecond time origin, including simulation and benchmark timing. Frame timestamps represent capture time, not inference completion. Reject frames older than or equal to the last accepted frame, and frames older than the engine clock advanced by `tick`. Reset does not rewind the clock. Wall-clock timestamps belong only in export metadata.
- Calibration maps projected viewport points to corrected viewport points. Viewport-size or mirroring changes invalidate the stored transform and cancel interaction progress.

## Geometry and intent

Registered IDs identify mounted actions. Re-registering an existing ID is an error; cleanup is idempotent. Publish fresh immutable rectangles on layout, scroll, resize, orientation, or enabled-state changes. Width and height must be nonnegative. Zero-area, offscreen, and disabled targets are ineligible. Unmounting removes a target immediately. Never serialize DOM nodes or callbacks into engine snapshots.

Score eligible targets using the SPEC's alignment, distance, motion, history, and UI-prior weights, then apply softmax. Disabled targets must be excluded before softmax: setting their prior to zero alone would still give them positive probability. Omitted priority means 1; priority zero removes only the prior contribution, not eligibility.

`probability` is the current softmax result; `belief` is its temporal smoothing using `temporalAlpha`. Both distributions sum to 1 within floating-point tolerance. On registry changes, remove ineligible entries and renormalize surviving historical belief before blending; new targets start with zero historical mass, or current probabilities when no historical mass survives. Empty eligibility or unusable tracking produces an empty distribution and null leader. Target IDs occur once per distribution.

Choose the greatest belief as leader, retain the previous leader on an exact tie if possible, otherwise use lexicographic target ID order. Event/state confidence is the target's temporal belief, not landmark confidence. Tracking confidence independently gates interaction. Soft-snap rendering uses pointing position, leader geometry, belief, and progress; it does not replace intent scoring with nearest-target hit testing.

## State and event behavior

| State | Entry and progression |
| --- | --- |
| `IDLE` | Startup/reset, unusable tracking, or no eligible targets. No selection or lock progress. |
| `POINTING` | A usable hand and leader exist. Start the lock timer only while that same leader's belief is strictly greater than `lockThreshold`. A leader change or threshold failure resets the timer. |
| `LOCKED` | The same leader stayed above threshold for `lockDurationMs`. Dwell progress starts at zero here; `dwellDurationMs` is additional to lock time. Pinch/push/fist strategies also require this state. |
| `SELECT` | The configured strategy completes while the locked target remains eligible, leading, and above threshold. Emit exactly one `select` event with a unique selection ID. This state may be skipped by rendering, never by event delivery. |
| `COOLDOWN` | Immediately follows selection. Suppress all selection and lock accumulation until `until`. Then reacquire from zero progress. |

Before selection, tracking loss, low confidence, ambiguous multiple hands, permission failure, interruption, or `trackingTimeoutMs` without a fresh frame clears pointing/belief and cancels progress. Initial policy requires exactly one usable hand; a changed hand ID also cancels progress. A locked leader change or belief threshold failure returns to `POINTING` with fresh progress; removal/disable returns to `POINTING` for a remaining leader or `IDLE`. Registry updates must invalidate locks immediately, without waiting for a camera frame.

Cooldown survives tracking loss, target removal, and screen navigation so these cannot bypass duplicate suppression. Its selection is historical and can reference a removed target. A periodic caller invokes `tick` so camera stalls still expire tracking and cooldown. Reset returns to `IDLE`, clears pointing, belief, progress and cooldown, and retains registrations and calibration unless `clearCalibration` is true. Disposal releases subscriptions/resources and stops delivery.

Emit `target-enter` when the leader becomes active, `target-update` as its belief changes, and `target-lock` on lock acquisition. Emit `target-leave` before a replacement enter, or when tracking/eligibility/reset clears the leader; leave confidence is the last known belief. Threshold loss alone does not leave an unchanged leader. Cooldown may continue publishing visual leader feedback but never lock/select events. Publish the corresponding immutable snapshot before notifying subscribers or delivering events. `getSnapshot` retains object identity until a new snapshot is published; unsubscribe functions are idempotent. Events are synchronous, ordered, and are not replayed to new subscribers.

Only `select` activates a kiosk action. The adapter rechecks target eligibility and deduplicates the selection ID before invoking the same action as native click/keyboard activation. It must not synthesize a DOM click in addition to invoking that action. Native activation is handled directly by the UI; it is not mislabeled as a gesture selection. Screens need no knowledge of dwell, pinch, push, or fist.

## Configuration and providers

Durations must be positive, except cooldown may be zero. Softmax temperature and measurement noise must be positive; process noise and scoring weights must be nonnegative. Smoothing alpha and temporal alpha must be greater than zero and at most 1. The lock threshold must be less than 1. The initial implementation uses dwell and may choose EMA per IMPL; EKF remains the SPEC's primary intended filter. No tuning defaults are fixed by F2; benchmark results will inform them.

Subscribe before starting a `LandmarkProvider`. Start/stop are idempotent, stop releases camera resources and cancels an in-flight start, and stopped providers emit no frames. Expected camera failures publish a status frame (empty hands if unavailable); unexpected initialization failures reject `start`. Status-only frames may use zero image dimensions; tracked frames require positive dimensions. The engine treats every status other than `tracking` as noninteractive. A tracking frame requires exactly one usable hand; inconsistent frames must not enable selection.

F3 can implement `LandmarkProvider` for scripted pipeline tests or `InteractionOutput` for mouse/script-controlled UI development. Both output paths must obey these snapshot/event semantics. Engine configuration is supplied at construction by the eventual implementation; changing configuration must cancel accumulated interaction progress. Camera processing, scoring, filtering, selection strategies, registry hooks, runtime validation, and reducer integration remain subsequent implementation tasks.
