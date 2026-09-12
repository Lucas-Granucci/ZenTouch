import type { ReactNode } from 'react'
import { useTouchlessTarget } from './useTouchlessTarget'

export interface TouchlessCardProps {
  readonly id: string
  readonly onActivate: () => void
  readonly disabled?: boolean
  readonly selected?: boolean
  readonly className?: string
  readonly children: ReactNode
  readonly armedLabel?: string
}

/**
 * A larger selectable surface (restaurant, menu item, side option). Children
 * own their own padding — this component only supplies the card chrome — so a
 * photo can bleed to the edge while text keeps room, including extra
 * bottom padding, for the armed-hold caption this renders when active.
 */
export function TouchlessCard({
  id,
  onActivate,
  disabled = false,
  selected = false,
  className = '',
  children,
  armedLabel = 'Hold to select',
}: TouchlessCardProps) {
  const { ref, onClick, armed, progress } = useTouchlessTarget(id, !disabled, onActivate)

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative block w-full overflow-hidden rounded-[10px] border p-0 text-left transition-transform duration-150 ease-out ${
        disabled
          ? 'border-line bg-paper shadow-none'
          : selected
            ? 'border-brand bg-brand-tint shadow-[0_1px_2px_rgba(32,28,26,.04),0_10px_22px_rgba(32,28,26,.07)]'
            : 'border-line bg-paper shadow-[0_1px_2px_rgba(32,28,26,.04),0_10px_22px_rgba(32,28,26,.07)]'
      } ${
        armed && !disabled
          ? '-translate-y-1 scale-[1.025] border-interact shadow-[0_16px_30px_rgba(32,28,26,.22),0_0_0_3px_rgba(184,72,31,.4)]'
          : ''
      } ${className}`}
    >
      {children}
      {armed && !disabled && (
        <>
          <span className="pointer-events-none absolute bottom-3 left-4 text-[11px] font-bold tracking-wide text-interact">
            {armedLabel}
          </span>
          <span
            className="absolute bottom-0 left-0 h-[4px] bg-interact"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </>
      )}
    </button>
  )
}
