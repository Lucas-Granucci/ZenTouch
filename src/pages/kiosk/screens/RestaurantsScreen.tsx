import { TouchlessCard } from '../../../components/zentouch/TouchlessCard'
import { MENU_DATA, formatMoney } from '../../../state/kiosk/menuData'
import { useKioskDispatch } from '../../../state/kiosk/KioskStateProvider'
import type { RestaurantId } from '../../../state/kiosk/types'
import { DeviceFrame } from '../DeviceFrame'

export function RestaurantsScreen() {
  const dispatch = useKioskDispatch()
  const restaurants = Object.values(MENU_DATA)

  const picks = restaurants
    .filter((restaurant) => restaurant.open && restaurant.items.length > 0)
    .flatMap((restaurant) => {
      const items =
        restaurant.items.length > 1 ? [restaurant.items[0], restaurant.items[restaurant.items.length - 1]] : [restaurant.items[0]]
      return items.map((item) => ({ restaurantId: restaurant.id, restaurantName: restaurant.name, item }))
    })

  return (
    <DeviceFrame className="min-h-[calc(var(--kiosk-viewport,100dvh)-var(--frame-inset,0px))] flex-col">
      <div className="flex-1 p-6 pb-9">
        <header className="mb-7 flex items-start justify-between">
          <div>
            <h1 className="font-display text-[38px] font-bold leading-tight tracking-tight">Restaurants</h1>
            <p className="mt-2 text-base text-muted">Select a restaurant to browse its menu.</p>
          </div>
          <div className="mt-0.5 whitespace-nowrap rounded-full border-[1.5px] border-brand px-3.5 py-1.5 text-[11.5px] font-bold tracking-wide text-brand">
            No touching required
          </div>
        </header>

        <div className="grid grid-cols-3 gap-5">
          {restaurants.map((restaurant) => (
            <TouchlessCard
              key={restaurant.id}
              id={`restaurant-${restaurant.id}`}
              disabled={!restaurant.open}
              onActivate={() => dispatch({ type: 'OPEN_RESTAURANT', restaurantId: restaurant.id })}
            >
              <div className="relative aspect-[4/3] bg-surface">
                <img
                  src={restaurant.image}
                  alt={restaurant.name}
                  className={`h-full w-full object-cover ${!restaurant.open ? 'grayscale brightness-[0.6]' : ''}`}
                />
                {!restaurant.open && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-display text-[15px] font-semibold tracking-wide text-white">Closed</span>
                  </div>
                )}
              </div>
              <div className="p-3.5 pb-6 pt-3">
                <h3 className="text-[17px] font-semibold">{restaurant.name}</h3>
                <p className="mb-2.5 mt-0.5 truncate text-[12.5px] font-medium text-muted">{restaurant.tagline}</p>
                {restaurant.open && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    Ready in {restaurant.ready} &middot; No line
                  </div>
                )}
              </div>
            </TouchlessCard>
          ))}
        </div>

        <h2 className="mt-8 mb-4 flex items-center gap-3 text-xl font-bold">
          Featured dishes
          <span className="h-px flex-1 bg-line" />
        </h2>
        <div className="grid grid-cols-4 gap-[18px]">
          {picks.map(({ restaurantId, restaurantName, item }) => (
            <TouchlessCard
              key={`${restaurantId}-${item.id}`}
              id={`pick-${restaurantId}-${item.id}`}
              onActivate={() => dispatch({ type: 'OPEN_ITEM', restaurantId: restaurantId as RestaurantId, itemId: item.id })}
            >
              <div className="aspect-[4/3] bg-surface">
                <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
              </div>
              <div className="p-3 pb-5">
                <h4 className="text-[14.5px] font-semibold">{item.name}</h4>
                <div className="mb-1.5 mt-0.5 text-[11.5px] font-medium text-muted">{restaurantName}</div>
                <div className="text-[13px] font-bold tabular-nums">{formatMoney(item.price)}</div>
              </div>
            </TouchlessCard>
          ))}
        </div>
      </div>
    </DeviceFrame>
  )
}
