import { TouchlessButton } from '../../../components/zentouch/TouchlessButton'
import { findItem, formatMoney } from '../../../state/kiosk/menuData'
import { useKioskDispatch, useKioskState } from '../../../state/kiosk/KioskStateProvider'
import type { CartLine } from '../../../state/kiosk/types'
import { DeviceFrame } from '../DeviceFrame'

export function CartScreen() {
  const dispatch = useKioskDispatch()
  const { cart, currentRestaurantId } = useKioskState()
  const backRestaurantId = cart[0]?.restaurantId ?? currentRestaurantId ?? 'underground'
  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)

  return (
    <DeviceFrame className="h-[var(--kiosk-viewport,100dvh)] flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <header className="mb-5 flex items-center gap-3.5">
            <TouchlessButton
              id="cart-back"
              variant="back"
              aria-label="Back to menu"
              onActivate={() => dispatch({ type: 'OPEN_RESTAURANT', restaurantId: backRestaurantId })}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
                <path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </TouchlessButton>
            <div>
              <h1 className="font-display text-[28px] font-semibold leading-tight">Review your order</h1>
            </div>
          </header>

          {cart.length === 0 ? (
            <div className="pb-8">
              <h2 className="mb-2 text-[19px] font-semibold">Your cart is empty</h2>
              <p className="mb-5 text-[13.5px] font-medium text-muted">Head back to the menu and add something good.</p>
              <TouchlessButton id="browse-restaurants" onActivate={() => dispatch({ type: 'BACK_TO_RESTAURANTS' })}>
                Browse restaurants
              </TouchlessButton>
            </div>
          ) : (
            <div>
              {cart.map((line, index) => (
                <CartRow key={`${line.itemId}-${index}`} line={line} />
              ))}
            </div>
          )}
        </div>
      </div>

      {cart.length > 0 && (
        <div className="flex w-[320px] shrink-0 flex-col overflow-y-auto bg-surface p-6">
          <h2 className="mb-4 text-[11.5px] font-bold uppercase tracking-widest text-muted">Order summary</h2>
          <div className="text-[13.5px]">
            <div className="flex justify-between py-1 text-muted tabular-nums">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between py-1 text-muted tabular-nums">
              <span>Sales tax</span>
              <span>{formatMoney(0)}</span>
            </div>
            <div className="mt-1.5 flex justify-between border-t border-line pt-3.5 font-display text-lg font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(subtotal)}</span>
            </div>
          </div>
          <div className="mt-auto flex shrink-0 flex-col gap-3 pt-6">
            <TouchlessButton id="add-more" variant="rectangle" className="border border-brand" onActivate={() => dispatch({ type: 'OPEN_RESTAURANT', restaurantId: backRestaurantId })}>
              Add more items
            </TouchlessButton>
            <TouchlessButton id="place-order" variant="rectangle" tone="brand" onActivate={() => dispatch({ type: 'PLACE_ORDER' })}>
              Place order
            </TouchlessButton>
          </div>
        </div>
      )}
    </DeviceFrame>
  )
}

function CartRow({ line }: { line: CartLine }) {
  const item = findItem(line.restaurantId, line.itemId)
  return (
    <div className="flex items-center gap-3.5 border-b border-line py-3.5 first:pt-0">
      <div className="h-[54px] w-[54px] shrink-0 overflow-hidden rounded-lg bg-surface">
        {item && <img src={item.image} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-semibold">
          {line.quantity} &times; {item?.name ?? line.itemId}
        </div>
        <div className="mt-0.5 text-[12.5px] font-medium text-muted">{line.sideName}</div>
      </div>
      <div className="whitespace-nowrap text-[14.5px] font-bold tabular-nums">{formatMoney(line.unitPrice * line.quantity)}</div>
    </div>
  )
}
