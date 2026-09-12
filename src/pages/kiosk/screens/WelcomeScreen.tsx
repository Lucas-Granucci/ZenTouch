import { TouchlessButton } from '../../../components/zentouch/TouchlessButton'
import { useKioskDispatch } from '../../../state/kiosk/KioskStateProvider'
import { DeviceFrame } from '../DeviceFrame'

export function WelcomeScreen({ onBegin, resuming = false }: { onBegin?: () => void; resuming?: boolean }) {
  const dispatch = useKioskDispatch()

  return (
    <DeviceFrame className="h-[calc(var(--kiosk-viewport,100dvh)-var(--frame-inset,0px))]">
      <img src="/kiosk/bayou-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 58%, rgba(9,10,7,.78) 0%, rgba(9,10,7,.5) 55%, rgba(9,10,7,.42) 100%)',
        }}
      />
      <div className="relative min-h-0 w-full overflow-y-auto px-6 py-10 text-center text-white">
        <div className="mx-auto flex min-h-full max-w-[720px] flex-col items-center justify-center">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.24em] text-white/75">Good food. Zero touch.</p>
          <h1 className="mb-7 font-display text-[clamp(52px,8vw,100px)] font-semibold leading-[0.98] tracking-tight">
            {resuming ? 'Welcome back.' : 'Let’s order.'}
          </h1>
          <div className="mb-8 flex w-full max-w-[520px] flex-col items-center rounded-3xl border border-white/20 bg-black/25 px-6 py-7 backdrop-blur-sm">
            <svg className="mb-4 h-16 w-16 text-white" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 34V17a4 4 0 0 1 8 0v15-21a4 4 0 0 1 8 0v21-18a4 4 0 0 1 8 0v20-12a4 4 0 0 1 8 0v18c0 12-7 20-18 20-7 0-12-4-16-10L10 36a4 4 0 0 1 6-5l6 7" />
              <path d="M10 10a21 21 0 0 0-5 15M54 5a23 23 0 0 1 6 12" />
            </svg>
            <h2 className="text-3xl font-semibold">{resuming ? 'Wave to continue' : 'Wave to begin'}</h2>
            <p className="mt-3 max-w-[30ch] text-lg leading-relaxed text-white/90">Hold your hand about <strong className="font-bold text-white">2 ft</strong> from the screen.</p>
            <p className="mt-4 text-sm text-white/75">Then hover over a choice and hold to select.</p>
          </div>
          <TouchlessButton
            id="welcome-begin"
            tone="brand"
            variant="rectangle"
            className="min-h-[72px] w-full max-w-[340px]"
            onActivate={onBegin ?? (() => dispatch({ type: 'NAVIGATE_RESTAURANTS' }))}
          >
            <span className="text-lg">{resuming ? 'Or tap to continue' : 'Or tap to begin'}</span>
          </TouchlessButton>
        </div>
      </div>
    </DeviceFrame>
  )
}
