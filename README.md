# ZenTouch

A touchless kiosk prototype built with React, TypeScript, Vite, and Tailwind CSS.

## Development

Use Node.js 22.12+ (22.x), or Node.js 24+. Install the locked dependencies and start the development server:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To expose the development server on your local network, use `npm run dev -- --host`.

```sh
npm run typecheck # Check TypeScript
npm test          # Check simulated input behavior
npm run lint      # Run Oxlint
npm run build     # Type-check and build into dist/
npm run preview   # Serve the production build locally
```

Tailwind uses its Vite plugin and the import in `src/index.css`.

## Source layout

The app follows `REPO.md`:

```text
src/
  app/                   App entry and future providers/routing
  pages/
    kiosk/               Ordering demo (welcome placeholder for now)
    benchmark/           Future selection and accuracy experiments
    calibration/         Future pointing calibration
  components/
    kiosk/               Ordering controls
    zentouch/            Shared interaction-aware components
  interaction/
    vision/              Camera and MediaPipe
    pointing/            Pointing estimation
    filtering/           Signal smoothing
    intent/              DOM target registry and probability scoring
    gestures/            Selection strategies and state machine
  hooks/                 Shared React hooks
  state/                 Context and reducers
  types/                 Shared TypeScript contracts
  utils/                 Math and general helpers
  assets/                Bundled assets
public/                  Static assets, future local model/WASM files
```

Empty directories contain `.gitkeep` files so the structure is preserved in Git. The benchmark lives at `src/pages/benchmark` per `REPO.md`; it can be split into a separate app later if needed.

## Scope

This implements F1–F3 in [IMPL.md](specs/IMPL.md): frontend tooling, source directories, a responsive welcome screen, shared [interaction types](src/types/interaction.ts), and mouse/script simulated input. Open `/?input=simulated` after starting Vite to try dwell selection. The [simulated input guide](specs/SIMULATED_INPUT.md) includes a quick walkthrough, a copyable script, and React integration instructions.

[Interaction contract details](specs/INTERACTION.md) define input, geometry, intent, engine states, events, and provider boundaries. Ordering state/screens, camera processing, and benchmarks remain future tasks. The app does not request camera access or load MediaPipe. No backend is needed for this phase.

See [SPEC.md](specs/SPEC.md) for requirements and [IMPL.md](specs/IMPL.md) for the implementation sequence. Future camera testing on an iPad will require an HTTPS origin; the HTTP LAN development URL is only for checking the frontend layout.
