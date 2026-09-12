import { useEffect, useRef } from 'react'
import { IdleGate } from './IdleGate'
import { useKioskState } from '../../state/kiosk/KioskStateProvider'
import { CartScreen } from './screens/CartScreen'
import { ConfirmationScreen } from './screens/ConfirmationScreen'
import { ItemScreen } from './screens/ItemScreen'
import { MenuScreen } from './screens/MenuScreen'
import { RestaurantsScreen } from './screens/RestaurantsScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'

export function KioskPage() {
  return (
    <div className="kiosk-interface">
      <IdleGate><ActiveScreen /></IdleGate>
    </div>
  )
}

function ActiveScreen() {
  const { screen } = useKioskState()
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const heading = contentRef.current?.querySelector('h1')
    if (heading) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
  }, [screen])
  return <main ref={contentRef}><Screen screen={screen} /></main>
}

function Screen({ screen }: { screen: ReturnType<typeof useKioskState>['screen'] }) {
  switch (screen) {
    case 'welcome':
      return <WelcomeScreen />
    case 'restaurants':
      return <RestaurantsScreen />
    case 'menu':
      return <MenuScreen />
    case 'item':
      return <ItemScreen />
    case 'cart':
      return <CartScreen />
    case 'confirmation':
      return <ConfirmationScreen />
  }
}
