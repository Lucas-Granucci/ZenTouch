import { KioskPage } from '../pages/kiosk/KioskPage'
import { SimulatedInputDemo } from '../pages/kiosk/SimulatedInputDemo'

import { LandmarkDebugView } from '../components/debug/LandmarkDebugView'

export default function App() {
  if (new URLSearchParams(window.location.search).get('input') === 'camera') return <LandmarkDebugView />
  return new URLSearchParams(window.location.search).get('input') === 'simulated'
    ? <SimulatedInputDemo />
    : <KioskPage />
}
