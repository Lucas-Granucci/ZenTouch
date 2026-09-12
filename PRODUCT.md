# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

static HTML/CSS/JS (no build step, no framework) — existing choice, kept for this demo

## Users

Two audiences for this artifact:
- **In-story end users:** kiosk customers ordering food at a shared public touchscreen (e.g. a campus dining kiosk), who currently have to touch a screen thousands of strangers have touched.
- **Actual audience of this build:** hackathon judges/viewers evaluating the ZenTouch project pitch, who will interact with this demo directly via mouse (standing in for a webcam-tracked hand) on a laptop, and ideally see it presented on an iPad.

## Product Purpose

ZenTouch is a monocular-webcam, intent-inference touchless interaction system for kiosks: it replaces touch input with hover + hold-to-confirm input on existing kiosk-style UIs, so no one has to touch a shared screen. This specific artifact is a working ordering-kiosk demo (restaurant list → menu → item customize → cart → place order) built to showcase that interaction model, not a production food-ordering product.

## Positioning

Unlike gesture/AR kiosks that need extra hardware, ZenTouch needs only the kiosk's existing front camera. The core mechanic being demonstrated: hovering causes a probabilistic "soft-snap" toward the most likely intended target (not a literal cursor), and selection requires a sustained hold with visible fill-progress rather than an instant tap — both mirror the real system's noisy-input design (EKF-smoothed pointing + softmax intent scoring + dwell-style confirmation described in the project's SPEC.md).

## Operating Context

Deployed conceptually on a tablet (iPad) mounted at a kiosk stand, viewed portrait, ~1–2 ft away, always full-screen — never resized, never a narrow phone, never an arbitrary wide desktop window. For this build's actual review, it also gets opened in an ordinary desktop browser window by the user/judges, so it must not fall apart there even though it isn't the target device.

## Capabilities and Constraints

- Real interaction engine (hover-probability targeting with softmax + temporal smoothing, soft-snap cursor, hold-to-confirm with cancel-on-release) is implemented and must not be altered by visual redesign work — only its skin.
- No camera/ML integration in this artifact; mouse position is an explicit stand-in for the tracked hand/pointing signal.
- Content (restaurants, menu items, prices) is representative demo data, not a real business — free to be a fictional/generic kiosk brand, not tied to any real chain or university.
- Photography used for menu/restaurant imagery must stay real, freely-licensed photos (not illustrations, not AI-generated, not stock-obviously AI-styled) — this was an explicit prior instruction.

## Brand Commitments

None. No real restaurant, university, or company name may be implied (a prior draft used CMU-flavored branding; user explicitly rejected that). The kiosk itself may carry a small, low-key identity but is not the star — the ordering flow and interaction mechanic are.

## Evidence on Hand

- `SPEC.md` — full ZenTouch project spec (architecture, CV/intent pipeline, selection methods, metrics).
- `kiosk-demo/` — existing working implementation (4 pages + shared `engine.js` + `data.js`) with a validated interaction engine and real sourced food photography.
- Reference screenshots the user shared of an existing campus food-ordering app and a physical "Kiosk Burgers" touchscreen menu — used as functional/content inspiration only, explicitly not as a visual style to copy (user rejected that look as too close to a generic touch-based delivery app / too "gamified").

## Product Principles

1. The interaction mechanic is the product — every visual decision should make the hover/hold/pop/soft-snap behavior more legible, never compete with it or obscure it.
2. Design for the one real screen (iPad, portrait, fixed, close viewing distance, imprecise noisy pointing) — not for responsive breadth.
3. Read as a real, ordinary kiosk a restaurant would actually install — not as a generated tech demo, not as a game UI, not as a generic "AI app" template.
4. No fabricated brand affiliation — the food, restaurants, and kiosk brand are all openly fictional/generic.

## Accessibility & Inclusion

No specific standard mandated for this demo; the interaction model itself (large targets, generous spacing, dwell-based confirmation, forgiving cancel-on-release) is inherently oriented toward users who cannot use precise touch input, which should carry through visually (large text, high contrast, unambiguous states) rather than being undermined by decorative choices.
