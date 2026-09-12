import type { InteractionEvent } from '../../types/interaction.ts';
import type { KioskInput } from '../engine/createInput.ts';

/** One router per input session, shared across target mounts and screen transitions. */
export class TargetActivation {
  private actions = new Map<string, () => void>();
  private seen = new Set<string>();
  private input: KioskInput;
  private unsubscribe: () => void;
  constructor(input: KioskInput) {
    this.input = input;
    this.unsubscribe = input.subscribeEvents(this.deliver);
  }
  register(id: string, action: () => void) {
    if (this.actions.has(id)) throw new Error(`Duplicate action: ${id}`);
    this.actions.set(id, action);
    return () => { if (this.actions.get(id) === action) this.actions.delete(id); };
  }
  private deliver = (event: InteractionEvent) => {
    if (event.type !== 'select' || this.seen.has(event.id)) return;
    this.seen.add(event.id);
    if (this.input.targets.getSnapshot().some(t => t.id === event.targetId && t.enabled)) this.actions.get(event.targetId)?.();
  };
  click(id: string) {
    const state = this.input.getSnapshot().state;
    if (state.phase === 'SELECT' || state.phase === 'COOLDOWN') return;
    if (!this.input.targets.getSnapshot().some(t => t.id === id && t.enabled)) return;
    this.input.reset();
    this.actions.get(id)?.();
  }
  dispose() { this.unsubscribe(); this.actions.clear(); this.seen.clear(); }
}
