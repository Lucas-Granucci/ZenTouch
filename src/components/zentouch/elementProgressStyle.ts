import { createContext } from 'react'

export const elementProgressStyles = [
  { id: 'line', label: 'Bottom line', description: 'A line fills from left to right along the bottom edge.' },
  { id: 'fill', label: 'Surface fill', description: 'A translucent fill rises across the whole element.' },
  { id: 'border', label: 'Border sweep', description: 'An outline sweeps clockwise around the element.' },
] as const
export type ElementProgressStyle = typeof elementProgressStyles[number]['id']
export const ElementProgressContext = createContext<ElementProgressStyle>('line')

