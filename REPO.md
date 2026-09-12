```zentouch/
├── src/
│   ├── app/                    # App setup, routing, and global state
│   ├── pages/
│   │   ├── kiosk/              # Main ordering demo
│   │   ├── benchmark/          # Gesture and accuracy experiments
│   │   └── calibration/        # Initial pointing calibration
│   │
│   ├── components/
│   │   ├── kiosk/              # Menu cards, cart, checkout
│   │   └── zentouch/           # Touchless button, target, soft-snap overlay
│   │
│   ├── interaction/
│   │   ├── vision/             # Camera and MediaPipe
│   │   ├── pointing/           # Landmark-to-pointing estimation
│   │   ├── filtering/          # EMA/Kalman/EKF smoothing
│   │   ├── intent/             # DOM targets and probability scoring
│   │   └── gestures/           # Dwell, pinch, push, state machine
│   │
│   ├── hooks/                  # Camera and interaction hooks
│   ├── state/                  # Context and reducers
│   ├── types/                  # Shared TypeScript types
│   ├── utils/                  # Math and general utilities
│   └── assets/
│
├── public/                     # Images and MediaPipe model/WASM assets
├── server/                     # Express + SQLite, only if needed
└── package.json```