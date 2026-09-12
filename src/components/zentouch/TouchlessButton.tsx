import type { ReactNode } from 'react'
import { useTouchlessTarget } from './useTouchlessTarget'

export interface TouchlessButtonProps {
  readonly id: string
  readonly onActivate: () => void
  readonly disabled?: boolean
  /** `pill` is a labeled call-to-action; `circle` is a compact icon button (back, quantity). */
  readonly variant?: 'pill' | 'circle'
  readonly tone?: 'brand' | 'neutral' | 'overlay'
  readonly className?: string
  readonly children: ReactNode
  readonly 'aria-label'?: string
}

const toneClasses: Record<'brand' | 'neutral' | 'overlay', string> = {
  brand:
    'bg-brand text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),inset_0_-3px_0_rgba(0,0,0,.13),0_10px_20px_rgba(32,28,26,.22)]',
  neutral: 'bg-surface text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.6),inset_0_-2px_0_rgba(0,0,0,.04)]',
  overlay: 'bg-white/94 text-ink shadow-[0_4px_12px_rgba(0,0,0,.25)]',
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
      ? 'flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full'
      : 'rounded-full px-8 py-4 font-display text-[15px] font-semibold'

  return (
    <button
      ref={ref}
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
