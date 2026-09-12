import { TouchlessButton } from '../../../components/zentouch/TouchlessButton'
import { TouchlessCard } from '../../../components/zentouch/TouchlessCard'
import { MENU_DATA, formatMoney } from '../../../state/kiosk/menuData'
import { useKioskDispatch, useKioskState } from '../../../state/kiosk/KioskStateProvider'
import { DeviceFrame } from '../DeviceFrame'

export function MenuScreen() {
  const dispatch = useKioskDispatch()
  const { currentRestaurantId } = useKioskState()
  const restaurant = currentRestaurantId ? MENU_DATA[currentRestaurantId] : null
  if (!restaurant) return null

  return (
    <DeviceFrame className="min-h-[calc(100vh-60px)] flex-col">
      <div className="flex-1 p-6 pb-9">
        <header className="mb-1.5 flex items-center gap-3.5">
          <TouchlessButton
            id="menu-back"
            variant="circle"
            aria-label="Back to restaurants"
            onActivate={() => dispatch({ type: 'BACK_TO_RESTAURANTS' })}
          >
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
              <path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </TouchlessButton>
          <div>
            <h1 className="font-display text-[22px] font-semibold">{restaurant.name}</h1>
            <p className="mt-0.5 text-[12.5px] font-medium text-muted">{restaurant.tagline}</p>
          </div>
          <div className="ml-auto whitespace-nowrap rounded-full bg-surface px-3.5 py-1.5 text-xs font-bold text-muted">
            Ready in {restaurant.ready}
          </div>
        </header>

        <h2 className="mb-3.5 mt-5 text-[11.5px] font-bold uppercase tracking-widest text-muted">Menu</h2>
        <div className="grid grid-cols-3 gap-[18px]">
          {restaurant.items.map((item) => (
            <TouchlessCard
              key={item.id}
              id={`menu-item-${item.id}`}
              onActivate={() => dispatch({ type: 'OPEN_ITEM', restaurantId: restaurant.id, itemId: item.id })}
            >
              <div className="relative aspect-[4/3] bg-surface">
                <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                <div className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand shadow-[0_4px_10px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.35)]">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
              <div className="p-3.5 pb-7 pt-3">
                <h3 className="text-[14.5px] font-semibold leading-snug">{item.name}</h3>
                <div className="mt-0.5 text-[13.5px] font-bold tabular-nums text-muted">{formatMoney(item.price)}</div>
              </div>
            </TouchlessCard>
          ))}
        </div>
      </div>
    </DeviceFrame>
  )
}
