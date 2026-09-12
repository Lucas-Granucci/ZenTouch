import type { Point2 } from '../../types/interaction.ts';

/** Critically damped display motion: no target-dependent gain or screen-center scaling. */
export class CursorMotion {
  position: { x: number; y: number } | null = null;
  private target: Point2 | null = null;
  private velocity = { x: 0, y: 0 };
  private time = 0;

  reset() { this.position = null; this.target = null; this.velocity = { x: 0, y: 0 }; }

  setTarget(target: Point2 | null, now: number) {
    // Anchor to the last accepted destination, not the previous sample: slow
    // deliberate movement accumulates and escapes this small noise tolerance.
    if (target && this.target &&
      Math.hypot(target.x - this.target.x, target.y - this.target.y) <= 2.5) return;
    if (!this.target || !target) this.time = now;
    this.target = target;
    if (!target) this.velocity = { x: 0, y: 0 };
    if (!this.position && target) this.position = { ...target };
  }

  advance(now: number, reducedMotion = false): boolean {
    if (!this.target || !this.position) return false;
    // A suspended tab or slow inference must not cause a single large visual jump.
    const dt = Math.min(32, Math.max(0, now - this.time)) / 1000;
    this.time = now;
    const omega = 32, decay = Math.exp(-omega * dt);
    for (const axis of ['x', 'y'] as const) {
      const offset = this.position[axis] - this.target[axis];
      const c = this.velocity[axis] + omega * offset;
      this.position[axis] = this.target[axis] + (offset + c * dt) * decay;
      this.velocity[axis] = (this.velocity[axis] - omega * c * dt) * decay;
    }
    const settled = Math.hypot(this.position.x - this.target.x, this.position.y - this.target.y) < 0.05 &&
      Math.hypot(this.velocity.x, this.velocity.y) < 0.5;
    if (reducedMotion || settled) {
      this.position = { ...this.target };
      this.velocity = { x: 0, y: 0 };
      return false;
    }
    return true;
  }
}
