import type { ReactNode } from 'react'
import { useTouchlessTarget } from './useTouchlessTarget'

export interface TouchlessButtonProps {
  readonly id: string
  readonly onActivate: () => void
  readonly disabled?: boolean
  /** `pill` is a compact labeled action (nav, secondary); `rect` is a large full-width
   * primary call-to-action, using the same 10px corner radius as TouchlessCard so it
   * reads as one shape language with the side-option cards it sits beside; `circle`
   * is a compact icon button (quantity). */
  readonly variant?: 'pill' | 'rect' | 'circle'
  readonly tone?: 'brand' | 'neutral'
  readonly className?: string
  readonly children: ReactNode
  readonly 'aria-label'?: string
}

const toneClasses: Record<'brand' | 'neutral', string> = {
  brand:
    'bg-brand text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),inset_0_-3px_0_rgba(0,0,0,.13),0_10px_20px_rgba(32,28,26,.22)]',
  neutral: 'bg-surface text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.6),inset_0_-2px_0_rgba(0,0,0,.04)]',
}

export function TouchlessButton({
  id,
  onActivate,
  disabled = false,
  variant = 'pill',
  tone = 'neutral',
  className = '',
  children,
  ...aria
}: TouchlessButtonProps) {
  const { ref, onClick, armed, progress } = useTouchlessTarget(id, !disabled, onActivate)

  const shape =
    variant === 'circle'
      ? 'flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full'
      : variant === 'rect'
        ? 'inline-flex items-center justify-center gap-2.5 rounded-[10px] px-8 py-4 font-display text-[15px] font-semibold'
        : 'inline-flex items-center gap-2.5 rounded-full px-8 py-4 font-display text-[15px] font-semibold'

  return (
    <button
      ref={ref}
      data-interaction-target={id}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative overflow-hidden transition-transform duration-150 ease-out ${shape} ${
        disabled ? 'cursor-default bg-disabled-bg text-disabled-fg shadow-none' : toneClasses[tone]
      } ${armed && !disabled ? '-translate-y-1 scale-[1.03] shadow-[0_16px_28px_rgba(32,28,26,.22),0_0_0_3px_rgba(184,72,31,.4)]' : ''} ${className}`}
      {...aria}
    >
      {children}
      {armed && !disabled && (
        <span
          className="absolute bottom-0 left-0 h-[4px] bg-interact"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      )}
    </button>
  )
}
