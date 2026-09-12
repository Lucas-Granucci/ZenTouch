import { TouchlessButton } from '../../../components/zentouch/TouchlessButton'
import { useKioskDispatch, useKioskState } from '../../../state/kiosk/KioskStateProvider'
import { DeviceFrame } from '../DeviceFrame'

export function ConfirmationScreen() {
  const dispatch = useKioskDispatch()
  const { confirmation } = useKioskState()

  return (
    <DeviceFrame className="h-[calc(var(--kiosk-viewport,100dvh)-var(--frame-inset,0px))] items-center justify-center">
      <div className="max-w-[440px] p-6 text-center">
        <div className="mx-auto mb-7 flex h-[96px] w-[96px] items-center justify-center rounded-full bg-brand text-white">
          <svg viewBox="0 0 24 24" width="42" height="42" fill="none" aria-hidden="true">
            <path d="M5 12.5L9.5 17L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mb-3 font-display text-[40px] font-semibold leading-tight">Order placed</h1>
        <p className="mb-9 text-lg font-medium leading-relaxed text-muted">
          {confirmation
            ? `Ready for pickup in about ${confirmation.readyTime} at ${confirmation.restaurantName}.`
            : 'Ready for pickup shortly.'}
        </p>
        <TouchlessButton id="done" tone="brand" className="px-16 py-7 text-xl" onActivate={() => dispatch({ type: 'NAVIGATE_WELCOME' })}>
          Done
        </TouchlessButton>
      </div>
    </DeviceFrame>
  )
}
