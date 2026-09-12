# Pointing debug view (G2–G4)

Select **Hand** under **Tracking method** to move the cursor with the palm center (wrist and four finger-base knuckles). Finger articulation does not change this center, and projection distance is disabled for this mode. Mirroring, smoothing, calibration, and target selection still apply. **Hand direction** remains available for wrist-to-index-knuckle directional pointing.

Run `npm run dev`, open `http://localhost:5173/?input=camera`, and press **Start camera**. Allow camera access and hold up one hand. On a remote tablet, serve over HTTPS; ordinary LAN HTTP cannot request camera access. MediaPipe model/WASM files already live in `public/mediapipe/`; no additional package or camera service is needed.

The preview overlays the hand skeleton, handedness, geometry quality, handedness classification confidence, and raw finger (amber), hand (purple), and optional arm (blue) vectors. FPS measures incoming inference frames. Preview and overlay toggles are independent. Pose tracking is not enabled by G1, so arm vectors are absent until a provider supplies a confident elbow.

The amber ring shows raw projection, and the teal dot shows the filtered position in viewport CSS pixels. Neither activates controls. The existing default kiosk and `?input=simulated` remain available.

Projection blends normalized index-MCP-to-tip and wrist-to-index-MCP directions (0.7/0.3), then extrapolates from index MCP by a configurable image-space distance. Mirroring applies exactly once to the projected x coordinate and preview; returned direction stays in unmirrored image coordinates. This is an uncalibrated heuristic, not a physical ray/screen intersection. Offscreen positions are preserved. G5 will supply affine calibration.

`createPointingFilter` exposes a shared update/reset interface for EMA and a constant-velocity linear Kalman filter. EMA alpha is per sample. Kalman process noise is acceleration variance and measurement noise is CSS-pixel variance; time steps use seconds. Both reset after a gap over 250 ms or a hand change and ignore out-of-order samples. Debug controls recreate the filter when settings change. Missing/ambiguous tracking, stale frames, resizing, and component cleanup reset the display/filter. EKF refinements remain deferred per the implementation plan.

Validation: `npm test`, `npm run build`, and `npm run lint`. Automated tests cover projection/mirroring, missing pose, ambiguous input, smoothing/noise reduction, velocity units, invalid parameters, gaps, hand changes, and stale timestamps.

Manual device check (requires a real camera; not performed in the development container):

1. Start camera; check mirrored motion and landmark alignment across the preview, including portrait orientation.
2. Move one hand; compare raw versus filtered cursors and adjust EMA/Kalman settings.
3. Hide the preview and toggle landmarks/vectors independently.
4. Remove the hand or add a second hand; cursors should disappear. Restore one hand; the cursor should restart without carrying the previous position.
5. Stop/restart camera; switch tabs and return; confirm interruption recovery using Start camera.
6. Deny permission and verify the visible status; re-enable permission in browser settings and retry.
