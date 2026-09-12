import { TouchlessProvider } from '../../components/zentouch/TouchlessContext'
import { KioskStateProvider, useKioskState } from '../../state/kiosk/KioskStateProvider'
import { CartScreen } from './screens/CartScreen'
import { ConfirmationScreen } from './screens/ConfirmationScreen'
import { ItemScreen } from './screens/ItemScreen'
import { MenuScreen } from './screens/MenuScreen'
import { RestaurantsScreen } from './screens/RestaurantsScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'

export function KioskPage() {
  return (
    <KioskStateProvider>
      <TouchlessProvider>
        <ActiveScreen />
      </TouchlessProvider>
    </KioskStateProvider>
  )
}

function ActiveScreen() {
  const { screen } = useKioskState()
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
