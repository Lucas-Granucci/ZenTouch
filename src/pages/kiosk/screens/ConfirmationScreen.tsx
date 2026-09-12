import { TouchlessButton } from '../../../components/zentouch/TouchlessButton'
import { useKioskDispatch, useKioskState } from '../../../state/kiosk/KioskStateProvider'
import { DeviceFrame } from '../DeviceFrame'

export function ConfirmationScreen() {
  const dispatch = useKioskDispatch()
  const { confirmation } = useKioskState()

  return (
    <DeviceFrame className="h-[calc(var(--kiosk-viewport,100dvh)-var(--frame-inset,0px))] flex-col">
      <div className="min-h-0 w-full flex-1 overflow-y-auto px-6 py-10 sm:px-10">
        <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col items-center justify-center text-center">
          <div className="mb-5 flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" aria-hidden="true">
              <path d="M5 12.5L9.5 17L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="font-display text-[clamp(40px,6vw,64px)] font-semibold leading-none tracking-tight">Order done!</h1>
          <p className="mt-4 text-lg text-muted">We’ll take it from here.</p>
          {confirmation && (
            <div className="my-8 w-full rounded-3xl border border-line bg-surface px-6 py-7">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Confirmation number</p>
              <p className="mt-2 font-display text-[clamp(48px,7vw,76px)] font-semibold leading-none tracking-tight text-brand tabular-nums">#{confirmation.orderNumber}</p>
              <div className="mt-6 border-t border-line pt-5">
                <p className="text-xl font-semibold">
                  {confirmation.peopleAhead === 0 ? 'You’re next in line' : `${confirmation.peopleAhead} ${confirmation.peopleAhead === 1 ? 'person' : 'people'} ahead of you`}
                </p>
                <p className="mt-2 text-sm text-muted">We’ll call your number when it’s ready.</p>
              </div>
            </div>
          )}
          <p className="mb-8 mt-2 max-w-[420px] text-base leading-relaxed text-muted">
            {confirmation
              ? `Ready for pickup in about ${confirmation.readyTime} at ${confirmation.restaurantName}.`
              : 'Ready for pickup shortly.'}
          </p>
          <TouchlessButton id="done" variant="rectangle" tone="brand" className="min-h-[88px] w-full max-w-[420px] shrink-0" onActivate={() => dispatch({ type: 'NAVIGATE_WELCOME' })}>
            <span className="text-2xl font-semibold">Done</span>
          </TouchlessButton>
        </div>
      </div>
    </DeviceFrame>
  )
}
