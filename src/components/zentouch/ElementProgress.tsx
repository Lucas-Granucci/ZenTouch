import { useContext, type CSSProperties } from 'react'
import { ElementProgressContext } from './elementProgressStyle'
import './interaction.css'

/** Visual only: phase announcements are handled by InteractionFeedback. */
export function ElementProgress({ progress }: { readonly progress: number }) {
  const style = useContext(ElementProgressContext)
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  return <span aria-hidden="true" className="element-progress" data-style={style}
    style={{ '--element-progress': value } as CSSProperties} />
}
