import { TouchlessButton } from '../../../components/zentouch/TouchlessButton'
import { useKioskDispatch, useKioskState } from '../../../state/kiosk/KioskStateProvider'
import { DeviceFrame } from '../DeviceFrame'

export function ConfirmationScreen() {
  const dispatch = useKioskDispatch()
  const { confirmation } = useKioskState()

  return (
    <DeviceFrame className="h-[var(--kiosk-height)] items-center justify-center">
      <div className="max-w-[360px] p-6 text-left">
        <div className="mb-5 flex h-[58px] w-[58px] items-center justify-center rounded-full bg-brand text-white">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
            <path d="M5 12.5L9.5 17L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mb-2 font-display text-[23px] font-semibold">Order placed</h1>
        <p className="mb-6 text-[13.5px] font-medium text-muted">
          {confirmation
            ? `Ready for pickup in about ${confirmation.readyTime} at ${confirmation.restaurantName}.`
            : 'Ready for pickup shortly.'}
        </p>
        <TouchlessButton id="done" onActivate={() => dispatch({ type: 'NAVIGATE_WELCOME' })}>
          Done
        </TouchlessButton>
      </div>
    </DeviceFrame>
  )
}
