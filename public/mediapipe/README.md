# Local MediaPipe assets

Pinned `@mediapipe/tasks-vision` version: **0.10.22-rc.20250304**.
Model: **hand_landmarker/float16/1**. All assets are served locally, including
both SIMD and non-SIMD WASM variants; no CDN is required at runtime.

The JavaScript bundle and source map live in
`src/interaction/vision/vendor/` so Vite can process the dynamic import in
development and emit a separate production chunk. The model and WASM runtime
assets remain in this public directory. Run `sha256sum -c SHA256SUMS` from
this directory to verify all pinned assets.

Upstream downloads:

- `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/vision_bundle.mjs`
- The matching `vision_bundle.mjs.map` and `wasm/vision_wasm{,_nosimd}_internal.{js,wasm}` in that package.
- `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`
- License: `https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE` (included).

The three generated JavaScript files have one prepended `eslint-disable`
comment to exclude third-party generated code from repository lint rules.
The bundle source map has one leading empty mappings line to match. There are
no executable-code modifications. `SHA256SUMS` records the checked-in assets.
Update the runtime, both WASM pairs, and source map together if changing versions.

Official integration reference:
https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js
