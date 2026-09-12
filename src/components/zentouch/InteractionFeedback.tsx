import type { EngineSnapshot, SelectionMethod } from '../../types/interaction'
import { interactionMessage } from './feedbackModel'
import './interaction.css'

/** Announce phase changes only; frame-by-frame progress stays visual. */
export function InteractionFeedback({ snapshot, timedOut = false, selectionMethod }: { readonly snapshot: EngineSnapshot | null; readonly timedOut?: boolean; readonly selectionMethod?: SelectionMethod }) {
  return <div className="interaction-feedback" role="status" aria-live="polite" aria-atomic="true">
    {timedOut ? 'Input timed out. Your order is saved. Move to a choice to resume, or use touch or keyboard.' : interactionMessage(snapshot, selectionMethod)}
  </div>
}
