import type { EngineSnapshot } from '../../types/interaction.ts';
import { holdProgress } from './feedbackModel.ts';

type Feedback = { armed: boolean; phase: 'idle' | 'locked' | 'pointing'; progress: number };

/** Stable snapshots keep unrelated controls out of the camera render loop. */
export function createTargetFeedback(getSnapshot: () => EngineSnapshot, id: string, enabled: boolean,
  timing: Parameters<typeof holdProgress>[1]) {
  let previous: Feedback = { armed: false, phase: 'idle', progress: 0 };
  return () => {
    const snapshot = getSnapshot();
    const state = snapshot.state;
    const armed = enabled && 'targetId' in state && state.targetId === id && snapshot.intent.leadingTargetId === id;
    const phase = armed ? state.phase === 'LOCKED' ? 'locked' : 'pointing' : 'idle';
    const progress = armed ? holdProgress(state, timing) : 0;
    if (previous.armed !== armed || previous.phase !== phase || previous.progress !== progress) {
      previous = { armed, phase, progress };
    }
    return previous;
  };
}
