import { QuantityControl } from '../../../components/zentouch/QuantityControl'
import { TouchlessButton } from '../../../components/zentouch/TouchlessButton'
import { TouchlessCard } from '../../../components/zentouch/TouchlessCard'
import { findItem, formatMoney } from '../../../state/kiosk/menuData'
import { useKioskDispatch, useKioskState } from '../../../state/kiosk/KioskStateProvider'
import { DeviceFrame } from '../DeviceFrame'

export function ItemScreen() {
  const dispatch = useKioskDispatch()
  const { currentRestaurantId, currentItemId, selectedSideName, quantity } = useKioskState()
  if (!currentRestaurantId || !currentItemId) return null
  const item = findItem(currentRestaurantId, currentItemId)
  if (!item) return null

  const selectedSide = item.sides.find((side) => side.name === selectedSideName)
  const total = (item.price + (selectedSide?.add ?? 0)) * quantity

  return (
    <DeviceFrame className="h-[var(--kiosk-height)] flex-row">
      <div className="relative h-full flex-[0_0_40%] bg-surface">
        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
        <div className="absolute left-4 top-4">
          <TouchlessButton
            id="item-back"
            variant="circle"
            tone="overlay"
            aria-label="Back to menu"
            onActivate={() => dispatch({ type: 'BACK_TO_MENU' })}
          >
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
              <path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </TouchlessButton>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pb-6 pt-5">
            <h1 className="text-[21px] font-semibold">{item.name}</h1>
            <div className="mt-1 text-[14.5px] font-bold tabular-nums text-muted">{formatMoney(item.price)}</div>
            <p className="mb-5 mt-2 max-w-[52ch] text-[13.5px] font-medium leading-relaxed text-muted">{item.desc}</p>

            <h2 className="mb-3 flex items-center gap-2.5 text-[11.5px] font-bold uppercase tracking-widest text-muted">
              Choose a side
              <span className="rounded-full bg-interact px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white">Required</span>
            </h2>
            <div className="mb-[30px] grid grid-cols-2 gap-[18px]">
              {item.sides.map((side) => (
                <TouchlessCard
                  key={side.name}
                  id={`side-${side.name}`}
                  selected={side.name === selectedSideName}
                  onActivate={() => dispatch({ type: 'SELECT_SIDE', sideName: side.name })}
                  className="min-h-[92px]"
                >
                  <div className="flex h-full min-h-[92px] flex-col justify-center px-[22px] pb-10 pt-6">
                    <div className="flex items-center gap-1.5 text-[17px] font-semibold">
                      {side.name}
                      {side.name === selectedSideName && (
                        <span className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-brand">
                          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" aria-hidden="true">
                            <path d="M5 12.5L9.5 17L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className={`mt-1.5 text-[13.5px] font-medium ${side.name === selectedSideName ? 'text-[#2f6b4e]' : 'text-muted'}`}>
                      {side.add > 0 ? `+${formatMoney(side.add)}` : 'no charge'}
                    </div>
                  </div>
                </TouchlessCard>
              ))}
            </div>

            <h2 className="mb-3 text-[11.5px] font-bold uppercase tracking-widest text-muted">Quantity</h2>
            <QuantityControl idPrefix="item-qty" value={quantity} onChange={(next) => dispatch({ type: 'SET_QUANTITY', quantity: next })} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-5 border-t border-line p-4 px-6">
          <div className="text-sm font-semibold text-muted">
            Total <b className="font-display text-base font-semibold text-ink">{formatMoney(total)}</b>
          </div>
          <TouchlessButton
            id="add-to-cart"
            tone="brand"
            disabled={!selectedSideName}
            onActivate={() => dispatch({ type: 'ADD_TO_CART' })}
          >
            Add to cart
          </TouchlessButton>
        </div>
      </div>
    </DeviceFrame>
  )
}
