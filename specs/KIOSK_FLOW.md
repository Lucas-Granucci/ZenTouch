# U1 — Example kiosk flow

The example ordering flow, kept short enough for a reliable live demo: **welcome → restaurants → menu → item → cart → confirmation**. A restaurant-selection step is included (beyond U1's minimal "category/menu → item → cart → confirmation") because it is the already-validated visual centerpiece of the demo — real restaurant photography, a disabled/closed target, and cross-restaurant "picks" shortcuts.

Navigation is state, not routing: `KioskState.screen` selects which screen component renders. No router dependency is introduced. This matches U3 ("Use Context + `useReducer` for navigation, selected items, customization, cart totals, and order completion") and keeps `KioskPage.tsx` a single mounted tree, which is what `TouchlessProvider` (below) needs — one `SimulatedInputProvider`/mouse connection for the whole session, not one per route.

## Screens

| Screen | Purpose | Key targets registered |
| --- | --- | --- |
| `welcome` | Idle/splash. Full-bleed photo, big headline, one CTA. | one button: begin |
| `restaurants` | Pick a restaurant. | one card per restaurant (disabled when closed) + "picks" shortcut cards |
| `menu` | Item grid for the chosen restaurant. | back button, one card per item |
| `item` | Side selection, quantity, add to cart. | back button, one card per side, qty −/+, add-to-cart |
| `cart` | Review order, place it. | back button, add-more, place-order |
| `confirmation` | Order placed. | done button |

## State shape (`src/state/kiosk/types.ts`, `reducer.ts`)

```ts
interface KioskState {
  screen: 'welcome' | 'restaurants' | 'menu' | 'item' | 'cart' | 'confirmation'
  currentRestaurantId: RestaurantId | null
  currentItemId: ItemId | null
  selectedSideId: string | null
  quantity: number
  cart: CartLine[]
  confirmation: { restaurantName: string; readyTime: string } | null
}

interface CartLine {
  restaurantId: RestaurantId
  itemId: ItemId
  sideId: string
  quantity: number
  unitPrice: number
}
```

Actions: `NAVIGATE_WELCOME`, `NAVIGATE_RESTAURANTS`, `OPEN_RESTAURANT { restaurantId }`, `OPEN_ITEM { restaurantId, itemId }` (also used for the restaurants-screen "picks" shortcut, which supplies both IDs directly), `BACK_TO_MENU`, `BACK_TO_RESTAURANTS`, `SELECT_SIDE { sideId }`, `SET_QUANTITY { quantity }` (clamped to `>= 1`), `ADD_TO_CART`, `GO_TO_CART`, `PLACE_ORDER`, `RESET`.

`OPEN_ITEM` resets `selectedSideId` to `null` and `quantity` to `1`. `ADD_TO_CART` is only dispatched when a side is selected (the button is `disabled` otherwise); it pushes a `CartLine` and navigates to `cart`. `PLACE_ORDER` reads the restaurant from `cart[0].restaurantId`, builds the confirmation message, clears the cart, and navigates to `confirmation`. Reducer logic has no dependency on the interaction engine — it only ever receives already-decided actions, matching U3's "Keep input handling independent of UI state."

## Interaction wiring (scoped for this pass)

This pass (U1-U4) does **not** implement U5 (soft-snap glow overlay) or U7 (simulated-input validation pass) — those are separate, explicitly deferred tasks. The kiosk is still genuinely hover-driven today, not click-only: it uses the real `SimulatedInputProvider` from F3, not a placeholder.

`src/components/zentouch/TouchlessContext.tsx` creates one `SimulatedInputProvider`, connects it to the kiosk's root element via `connectMouse`, and exposes it through context — mirroring the exact lifecycle `SimulatedInputDemo.tsx` already uses (create in an effect, dispose on cleanup), not a new pattern.

`src/components/zentouch/useTouchlessTarget.ts` is a colocated hook (per IMPL's "put private helpers beside their implementation" convention, not a new shared `src/hooks/` file) that a `TouchlessButton`/`TouchlessCard` instance uses to: register/update/unregister its rect with `targets`, derive `armed`/`phase`/`progress` for its own ID from the shared snapshot, and invoke `onActivate` exactly once per selection (deduplicated by `event.id`) or on a native click — both paths call the same function, per `INTERACTION.md`'s "recheck eligibility and deduplicate; do not synthesize a second click."

This is intentionally the minimal glue needed to make U2's components live now. IMPL.md reserves `src/interaction/react/InteractionProvider.tsx`, `src/hooks/useInteraction.ts`, and `src/hooks/useTargetActivation.ts` for Phase 3 (I1/I3); this pass does not create or edit those paths. Phase 3 can replace `TouchlessContext`'s internals with the real engine/adapter without changing `TouchlessButton`/`TouchlessCard`'s external props.

Because there is no cursor-glow overlay yet, the native mouse cursor stays visible (not hidden) in this pass — hiding it without a replacement would leave no visual anchor for where "hovering" currently is.

## Visual design

Carries over the palette, type, and shape language already validated in the standalone HTML prototype (`kiosk-demo/`) rather than the placeholder teal currently in `KioskPage.tsx`: deep forest green (`#1f4d3a`) as brand/confirm color, burnt rust (`#b8481f`) reserved for the armed/hold signal, Fredoka for display type, Work Sans for body/UI, tight corner radii (not the heavy rounded-corner look), and real sourced food photography (copied from `kiosk-demo/images/` into `public/kiosk/`). Defined as a Tailwind v4 `@theme` block in `src/index.css` so components can use ordinary utility classes (`bg-brand`, `text-interact`, `font-display`) instead of inline styles.
