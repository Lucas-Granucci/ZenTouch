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
    <DeviceFrame className="h-[calc(100vh-60px)] flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          <header className="mb-5 flex items-center gap-4">
            <TouchlessButton
              id="cart-back"
              tone="neutral"
              aria-label="Back to menu"
              onActivate={() => dispatch({ type: 'OPEN_RESTAURANT', restaurantId: backRestaurantId })}
            >
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
                <path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </TouchlessButton>
            <div>
              <h1 className="font-display text-[22px] font-semibold">Review your order</h1>
              <p className="mt-0.5 text-[12.5px] font-medium text-muted">&nbsp;</p>
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
        <div className="flex w-[440px] flex-col bg-surface p-8">
          <h2 className="mb-5 text-[13px] font-bold uppercase tracking-widest text-muted">Order summary</h2>
          <div className="text-[15px]">
            <div className="flex justify-between py-1.5 text-muted tabular-nums">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between py-1.5 text-muted tabular-nums">
              <span>Sales tax</span>
              <span>{formatMoney(0)}</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-4">
              <span className="text-base font-semibold text-muted">Total</span>
              <span className="font-display text-3xl font-bold tabular-nums text-ink">{formatMoney(subtotal)}</span>
            </div>
          </div>
          <div className="mt-auto flex flex-col gap-4">
            <TouchlessButton
              id="add-more"
              variant="rect"
              onActivate={() => dispatch({ type: 'OPEN_RESTAURANT', restaurantId: backRestaurantId })}
              className="w-full py-6 text-xl"
            >
              Add more items
            </TouchlessButton>
            <TouchlessButton
              id="place-order"
              variant="rect"
              tone="brand"
              onActivate={() => dispatch({ type: 'PLACE_ORDER' })}
              className="w-full py-8 text-2xl"
            >
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
