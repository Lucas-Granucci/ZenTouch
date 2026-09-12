# G1 camera input

`CameraLandmarkProvider` implements the F2 `LandmarkProvider` contract. It owns
the supplied video element and its camera stream. Use HTTPS or localhost.

```ts
const input = new CameraLandmarkProvider(video);
const unsubscribe = input.subscribe(frame => engine.processFrame(frame));
await input.start(); // Invoke from a user action; asks for the front camera.
// On teardown:
unsubscribe();
input.stop();
```

For React, `useCamera()` exposes `videoRef`, `provider`, `status`, `error`,
`start`, and `stop`. Attach the ref to a continuously mounted `<video>` element.
Subscribe to `provider` before enabling Start. The hook updates React state only
for status/errors; consumers subscribe directly to landmark frames. Initialization
errors are available as `error`; expected camera failures become status frames.
App wiring and landmark overlays belong to I2 and G2 respectively.

The provider uses local MediaPipe assets, VIDEO mode, CPU/WASM inference, and
detects up to two hands and publishes the selected controlling hand. No video is
uploaded. Inference is synchronous, once per new video frame; worker offloading
and performance tuning are deferred to D3. Native video-frame callbacks use
`captureTime` when supplied. Otherwise callback time is an approximation of
capture time in the `performance.now()` clock domain. The animation-frame fallback
deduplicates by `video.currentTime`. Inference completion time is never used.
The downstream engine must still tick to expire stale frames during a camera stall.

Image landmarks remain unmirrored; preview mirroring is metadata (default true).
World landmarks are optional model estimates in meters. Each published array
contains 21 finite copied/frozen points. Invalid image geometry is noninteractive;
invalid world geometry is omitted.

MediaPipe does not expose its internal detection/presence/tracking scores in
`HandLandmarkerResult`. `confidence` is therefore explicitly a **binary quality
gate**, not a calibrated model probability: 1 for a finite, complete hand with
nondegenerate wrist-to-middle-MCP span, 0 for degenerate geometry. Missing or
malformed image points are rejected. MediaPipe's internal detection, presence,
and tracking thresholds are each 0.5. Handedness classification confidence is
reported separately and never used as tracking quality. Tune a richer quality
estimator using benchmark evidence before relying on graded confidence.

Selection prefers the largest apparent palm as a camera-proximity estimate. An
existing hand retains control unless another palm is at least 30% larger for
200 ms. Wrist position and palm scale match the active hand across detector
reordering, with handedness as a soft preference. Loss, interruption, a frame gap
over 250 ms, or a discontinuity starts a new identity; a missing active hand lets
the remaining hand take over immediately. Only the selected hand is published,
so pointing and gestures share the same identity and hand switches reset intent.
Palm size is approximate: hand anatomy and orientation can affect the estimate.
Hand-relative model z is not used as absolute camera depth. This heuristic cannot
identify people or reliably distinguish same-location hand substitutions.

Start/stop are idempotent. Stop settles pending start, cancels scheduling, stops
tracks, detaches video, and closes the detector. Late async resources are released.
Permission/device failures publish empty status frames; unexpected model setup
failures reject start. Track mute/end, video errors, and backgrounding publish
`interrupted` and release resources; call start explicitly to retry. Stopped
providers deliver no frames. Status-only timestamps advance by at least 0.001 ms
when the clock has not advanced, while captured frame timestamps are never adjusted.

Validation: `npm test`, `npm run lint`, `npm run build` with the Node version in
package.json. Automated tests use injected camera/detector/scheduler doubles.
Still required on real hardware: allow/deny camera permission, front camera
selection, 21-point output, local model/WASM loading, mirror orientation,
background/resume, and iPad Safari throughput. These were not exercised here.
