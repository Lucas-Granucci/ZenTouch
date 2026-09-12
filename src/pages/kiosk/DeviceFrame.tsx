import type { ReactNode } from 'react'

/**
 * The kiosk "screen": full-bleed at the target device width, presented as a
 * physical device sitting on a dark counter at wider desktop widths so it
 * never reads as a stretched, empty web page.
 */
export function DeviceFrame({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[var(--kiosk-viewport,100dvh)] items-center justify-center bg-counter p-[30px] [--frame-inset:60px] max-[1220px]:p-0 max-[1220px]:[--frame-inset:0px]">
      <div
        className={`relative flex w-full max-w-[1180px] overflow-hidden rounded-xl bg-paper text-ink shadow-[0_34px_70px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.5)] max-[1220px]:rounded-none max-[1220px]:shadow-none ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
