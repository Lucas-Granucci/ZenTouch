# ZenTouch — Project Specification

Monocular-webcam, intent-inference touchless interaction system for kiosks.

---

## 1. Problem

Shared kiosk touchscreens (e.g. our campus GrubHub kiosks) are touched by hundreds of unwashed hands a day at the same few screen locations and are rarely sanitized between uses — studies have found fecal bacteria and Staph on the majority of tested fast-food/grocery kiosk screens (in one case dirtier than hospital touchscreens), and kiosk deployment is growing fast (~350k+ installs, still accelerating). We're replacing touch input with touchless input on the same kiosk UIs, no new hardware required.

---

## 2. What We're Building

Two coupled components:

1. **Interaction Engine** — takes noisy monocular hand-tracking + live DOM target geometry, outputs a probability distribution over which UI element the user intends to select (not a cursor coordinate).
2. **Accessible UI Framework** — React/TS component library + kiosk app designed around uncertain remote input from the start (large targets, soft-snap feedback), not touch UI with gestures bolted on.

Key design decisions:

- **Sensor:** one monocular RGB camera only. No depth/stereo/LiDAR, no wearables/markers. Display: standard tablet screen (demo target: iPad, front camera).
- **No cursor.** Hand position is rendered as a soft shadow/glow. UI targets pull the shadow toward them ("soft-snap") as intent confidence rises — snapping is driven by the intent-probability score, not proximity.
- **Smoothing/state estimation:** treat raw landmark noise as a state-estimation problem. Primary approach: Extended Kalman Filter (EKF) over position + velocity of the pointing signal. EMA and linear Kalman are simpler fallbacks; a discrete Bayesian/HMM belief over targets is a stretch layer on top.
- Runs fully client-side (WASM); no video leaves the device.

---

## 3. Architecture

```
Camera → MediaPipe HandLandmarker (+ optional Pose) → per-frame hand/arm landmarks
      → Pointing Estimator (finger/hand/arm vector fusion)
      → EKF smoothing → smoothed position/velocity/confidence
      → Intent Engine (scores every registered DOM target rect) → P(target)
      → Temporal filtering (persistent belief across frames)
      → Soft-snap shadow render + Gesture state machine (IDLE → POINTING → LOCKED → SELECT → COOLDOWN)
      → normalized gesture event { type, targetId, confidence } → React reducer / kiosk action
```

Every clickable React component registers its live screen rect with the Intent Engine (the DOM is a sensor). Gesture events are normalized to a generic shape so kiosk screens consume them like ordinary click events, independent of the underlying gesture/CV implementation.

---

## 4. Repository Layout

## 5. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind |
| Hand tracking | `@mediapipe/tasks-vision` (HandLandmarker, WASM, client-side) |
| State | React Context + `useReducer` |
| Backend | Node.js + Express |
| Storage | SQLite |

---

## 6. CV / Intent Pipeline

**Pointing direction** — blend of finger, hand, and arm vectors (test which is most reliable independently):

$$d_\text{finger} = p_\text{index-tip} - p_\text{index-MCP} \quad d_\text{hand} = p_\text{index-MCP} - p_\text{wrist} \quad d_\text{arm} = p_\text{wrist} - p_\text{elbow}$$
$$d = \alpha d_\text{finger} + \beta d_\text{hand} + \gamma d_\text{arm}$$

**Relative depth** (for push gesture) via apparent hand scale: \(z \propto 1/\text{hand width}\).

**Target scoring:**
$$S_i = w_a A_i + w_d D_i + w_m M_i + w_h H_i + w_p P_i$$
(angular alignment, distance to projected point, motion trend, historical consistency, UI prior — disabled elements get \(P_i=0\)), converted to probabilities via softmax, then smoothed over time: \(P_t = \lambda P_\text{current} + (1-\lambda)P_{t-1}\). Target locks once \(P(T_i) > \theta\) for duration \(t_\text{lock}\).

**Calibration:** short on-screen pointing sequence, fit affine correction \(p' = Ap+b\).

---

## 7. Selection Methods to Test

| Method | Mechanism | Notes |
|---|---|---|
| Dwell | Hold soft-snap on target ~600–1200ms | Most accessible, no secondary gesture |
| Pinch | Thumb–index distance threshold | Reliable, but can distort pointing vector |
| Push | Hand moves toward camera (depth proxy) | Most novel, but depth is the least reliable monocular axis |
| Palm/fist | Open palm = active, fist = select | Fallback; robust but imprecise |

Build isolated harnesses in `apps/benchmark`, A/B on accuracy / acquisition time / false-activation rate before locking in a method for the full kiosk demo.

---

## 8. Metrics

$$Accuracy = \frac{\text{correct}}{\text{attempted}} \qquad T = t_\text{selected}-t_\text{presented} \qquad FAR = \frac{\text{unintended selections}}{\text{total selections}}$$

Also track target switches (stability) across lighting conditions and standing distance (~1–2 ft from iPad).