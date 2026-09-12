import type { ReactNode } from 'react'

/** Fill the kiosk viewport while keeping controls inside the iPad safe area. */
export function DeviceFrame({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[var(--kiosk-viewport,100dvh)] items-center justify-center bg-counter p-[30px] [--frame-inset:60px] max-[1220px]:p-0 max-[1220px]:[--frame-inset:0px]">
      <div
        className={`relative flex w-full overflow-hidden bg-paper text-ink ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
