import type { ReactNode } from 'react'
import { ElementProgress } from './ElementProgress'
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
  selected,
  className = '',
  children,
  armedLabel = 'Hold to select',
}: TouchlessCardProps) {
  const { ref, onClick, armed, progress } = useTouchlessTarget(id, !disabled, onActivate)

  return (
    <button
      ref={ref}
      data-interaction-target={id}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`relative block w-full overflow-hidden rounded-md border-2 p-0 text-left transition-colors duration-150 ease-out ${
        disabled
          ? 'border-card-edge bg-paper shadow-none'
          : selected
            ? 'border-brand bg-brand-tint'
            : 'border-card-edge bg-paper'
      } ${
        armed && !disabled
          ? 'border-interact outline-2 outline-offset-2 outline-interact'
          : ''
      } ${className}`}
    >
      {children}
      {armed && !disabled && (
        <>
          <span className="pointer-events-none absolute bottom-1 left-4 text-[11px] font-bold tracking-wide text-interact">
            {armedLabel}
          </span>
          <ElementProgress progress={progress} />
        </>
      )}
    </button>
  )
}
