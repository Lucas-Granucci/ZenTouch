import type { ReactNode } from 'react'

/** Fill the kiosk surface, keeping bottom and side controls clear of system UI. */
export function DeviceFrame({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className="flex w-full min-h-[var(--kiosk-viewport,100dvh)] items-center justify-center bg-paper">
      <div
        className={`kiosk-device-content relative flex w-full overflow-hidden bg-paper text-ink ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
