import type { ReactNode } from 'react'
import { ElementProgress } from './ElementProgress'
import { useTouchlessTarget } from './useTouchlessTarget'

export interface TouchlessButtonProps {
  readonly id: string
  readonly onActivate: () => void
  readonly disabled?: boolean
  /** Text actions default to a generous rounded rectangle. */
  readonly variant?: 'pill' | 'circle' | 'back' | 'quantity' | 'rectangle'
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
  variant = 'rectangle',
  tone = 'neutral',
  className = '',
  children,
  ...aria
}: TouchlessButtonProps) {
  const { ref, onClick, armed, progress } = useTouchlessTarget(id, !disabled, onActivate, true)

  const shape = {
    pill: 'rounded-full px-8 py-4 font-sans text-[15px] font-semibold',
    circle: 'flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full',
    back: 'flex h-[60px] w-[72px] shrink-0 items-center justify-center rounded-2xl',
    quantity: 'flex h-[64px] w-[72px] shrink-0 items-center justify-center rounded-2xl',
    rectangle: 'min-h-[72px] rounded-2xl px-8 py-5 font-sans text-lg font-semibold leading-snug',
  }[variant]

  return (
    <button
      ref={ref}
      data-interaction-target={id}
      data-tone={tone}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative overflow-hidden ${shape} ${
        disabled ? 'cursor-default bg-disabled-bg text-disabled-fg shadow-none' : toneClasses[tone]
      } ${armed && !disabled ? 'shadow-[0_16px_28px_rgba(32,28,26,.22),0_0_0_3px_rgba(184,72,31,.4)]' : ''} ${className}`}
      {...aria}
    >
      {children}
      {armed && !disabled && (
        <ElementProgress progress={progress} />
      )}
    </button>
  )
}
