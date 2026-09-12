import type { RegisteredTarget, TargetRegistry as Registry } from '../../types/interaction.ts';

function copy(target: RegisteredTarget): RegisteredTarget {
  if (!target.id || !Object.values(target.rect).every(Number.isFinite) || target.rect.width < 0 || target.rect.height < 0 ||
      (target.priority !== undefined && (!Number.isFinite(target.priority) || target.priority < 0))) throw new RangeError('Invalid target');
  return Object.freeze({ ...target, rect: Object.freeze({ ...target.rect }) });
}
export class TargetRegistry implements Registry {
  private targets = new Map<string, RegisteredTarget>();
  private listeners = new Set<() => void>();
  private snapshot: readonly RegisteredTarget[] = Object.freeze([]);
  private publish() {
    this.snapshot = Object.freeze([...this.targets.values()]);
    for (const listener of this.listeners) listener();
  }
  register(target: RegisteredTarget) {
    if (this.targets.has(target.id)) throw new Error(`Duplicate target: ${target.id}`);
    this.targets.set(target.id, copy(target)); this.publish();
    let active = true;
    return () => { if (active) { active = false; this.targets.delete(target.id); this.publish(); } };
  }
  update(target: RegisteredTarget) {
    const previous = this.targets.get(target.id);
    if (!previous) throw new Error(`Unknown target: ${target.id}`);
    const next = copy(target);
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    this.targets.set(target.id, next); this.publish();
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
}
