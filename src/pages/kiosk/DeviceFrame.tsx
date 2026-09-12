import type { ReactNode } from 'react'

/** Fill the kiosk viewport while keeping controls inside the iPad safe area. */
export function DeviceFrame({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className="kiosk-viewport bg-paper">
      <div
        className={`relative flex w-full overflow-hidden bg-paper text-ink ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
