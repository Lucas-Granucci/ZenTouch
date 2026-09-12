# U5–U7 — Kiosk feedback and simulated validation

Implemented on the default kiosk route `/`. `/?input=simulated` remains the separate F3 fixture.

## Feedback behavior

`SoftSnapOverlay` accepts F2 snapshots and registered geometry as props. It interpolates from the projected viewport position to the enabled leading target's center using temporal intent belief (0 leaves it at the hand, 1 reaches the center). It does not choose targets by distance. The simulator supplies belief 1; intermediate attraction is covered with synthetic snapshots in tests. Lock acquisition (250 ms) and selection dwell (800 ms) share one continuous 1.05-second visual fill, weighted by their durations. Both internal phases still run, but the progress and hold instruction do not restart at lock. The glow is decorative and cannot intercept pointer events. Missing tracking hides it; removed or disabled geometry cannot attract it.

`InteractionFeedback` exposes a persistent polite status region. Messages distinguish holding, locking, selection/cooldown, unavailable tracking, and recovery, without announcing percentages every frame. SELECT can be skipped by React; the cooldown snapshot retains selection confirmation. Side choices expose `aria-pressed`. Screen changes focus the heading; keyboard targets have a contrasting two-color focus treatment. Reduced-motion preference removes glow interpolation and control movement. Forced-colors mode preserves control boundaries. The status footer uses white on #1c1a16; existing body and control colors remain unchanged.

The simulator adapter checks for a stalled tracking stream every 500 ms. After two seconds without an updated snapshot, it resets pending interaction and hides the glow, while retaining the order and displaying resume instructions. Fresh tracking clears the timeout notice. Ordinary pointer exit/tracking loss cancels pending dwell through F3 immediately. The normal simulator ticks continuously, so holding still is not inactivity and does not trigger timeout. There is no automatic cart deletion or time limit on completing an order.

Native clicks cancel pending dwell and are ignored during selection/cooldown to prevent a completed dwell followed by a click from activating twice. The native cursor is hidden while the glow is visible; it remains a fallback where F3 provides no pointing estimate. Camera subscriptions and live-engine adapters remain Phase 3 work.

## Automated checks

- `npm test`: passes. `kiosk-flow.test.ts` drives the actual F3 provider with a deterministic clock and routes normalized selections to the actual kiosk reducer: welcome → restaurant → menu → customization (paid side and quantity) → cart → back/menu → another item → cart → confirmation → fresh order. It checks totals, required customization, cart preservation, unique selections, target cleanup, disabled targets, cooldown, and tracking-loss recovery.
- `ui-feedback.test.ts`: tests confidence interpolation at unchanged geometry, missing/disabled targets, lock/dwell progress, cooldown confirmation, tracking recovery, and timeout boundaries.
- `npm run build`: passes TypeScript and production bundling.
- `npm run lint`: passes with existing unused prototype helper and React Fast Refresh warnings.

These are provider/reducer and presentation-model tests, not mounted DOM or browser tests. The local Node resolver fixture handles Vite-style extensionless imports without changing application imports or the test runner.

## Manual browser checks — pending

No browser automation runner or browser binary is available in this workspace. The following checks have **not** been executed; run them on desktop and the target iPad before demo sign-off.

1. Run `npm run dev`, open `/`, and hover/hold through begin → Underground Grill → Smash Burger → Sweet Potato Fries → quantity + → add → place order → done. Verify $30.30 and a clean welcome screen afterward.
2. Repeat with click and with Tab/Enter/Space. Verify heading focus after navigation, side selection announcement, visible focus on photographic backgrounds, and no double activation when clicking immediately after dwell.
3. Move away during both lock and dwell; return and verify a fresh hold. Leave the window and return; confirm recovery instructions and the retained order.
4. Verify the glow aligns with controls after scrolling and resizing, never blocks clicks, and clears when its target disappears. Check portrait/landscape iPad layouts and ensure the sticky status footer does not cover actions.
5. Enable reduced motion and forced colors. Check absence of animated motion, visible target boundaries, and readable focus. Use a screen reader to confirm phase messages without frame-by-frame chatter.
6. For future live-input integration, stop snapshot updates for more than two seconds while holding a target. Confirm the pending hold resets, the order remains, and fresh input requires a new hold.
