import { KioskPage } from '../pages/kiosk/KioskPage'
import { SimulatedInputDemo } from '../pages/kiosk/SimulatedInputDemo'

export default function App() {
  return new URLSearchParams(window.location.search).get('input') === 'simulated'
    ? <SimulatedInputDemo />
    : <KioskPage />
}
