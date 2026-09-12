import type { ReactNode } from 'react'

/** Fill the available kiosk surface on every device; the session handles safe areas. */
export function DeviceFrame({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className="flex w-full min-h-[var(--kiosk-viewport,100dvh)] items-center justify-center bg-paper">
      <div
        className={`relative flex w-full overflow-hidden bg-paper text-ink ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
