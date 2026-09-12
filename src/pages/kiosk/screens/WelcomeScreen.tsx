import { TouchlessButton } from '../../../components/zentouch/TouchlessButton'
import { useKioskDispatch } from '../../../state/kiosk/KioskStateProvider'
import { DeviceFrame } from '../DeviceFrame'

export function WelcomeScreen() {
  const dispatch = useKioskDispatch()

  return (
    <DeviceFrame className="h-[calc(100vh-60px)]">
      <img src="/kiosk/bayou-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 58%, rgba(9,10,7,.78) 0%, rgba(9,10,7,.5) 55%, rgba(9,10,7,.42) 100%)',
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
        <h1 className="mb-5 font-display text-[72px] font-semibold leading-[0.98] tracking-tight text-white sm:text-[108px]">
          Let&apos;s order.
        </h1>
        <p className="mb-10 max-w-[40ch] text-lg font-medium leading-relaxed text-white/86">
          Hover, hold, done. Nobody has to touch this screen — including you.
        </p>
        <TouchlessButton
          id="welcome-begin"
          tone="brand"
          className="px-14 py-6 text-xl"
          onActivate={() => dispatch({ type: 'NAVIGATE_RESTAURANTS' })}
        >
          Hold to begin
        </TouchlessButton>
      </div>
    </DeviceFrame>
  )
}
