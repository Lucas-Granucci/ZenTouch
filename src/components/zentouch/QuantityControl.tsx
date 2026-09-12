import { TouchlessButton } from './TouchlessButton'

export interface QuantityControlProps {
  readonly idPrefix: string
  readonly value: number
  readonly onChange: (next: number) => void
  readonly min?: number
}

export function QuantityControl({ idPrefix, value, onChange, min = 1 }: QuantityControlProps) {
  return (
    <div className="flex items-center gap-5">
      <TouchlessButton
        id={`${idPrefix}-dec`}
        variant="circle"
        onActivate={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease quantity"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path d="M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </TouchlessButton>
      <span className="min-w-[28px] text-center font-display text-lg font-semibold tabular-nums">{value}</span>
      <TouchlessButton
        id={`${idPrefix}-inc`}
        variant="circle"
        onActivate={() => onChange(value + 1)}
        aria-label="Increase quantity"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </TouchlessButton>
    </div>
  )
}
