export const WAVE_READING_DELAY_MS = 500

/** A lateral sweep and return, lasting 150–2000 ms. Coordinates are normalized. */
export class WakeGesture {
  private start: number | null = null
  private origin = 0
  private extreme = 0
  private direction = 0
  private lastSample: number | null = null

  private readonly armedAt: number

  constructor(armedAt = 0) { this.armedAt = armedAt }

  reset() { this.start = null; this.direction = 0; this.lastSample = null }

  update(x: number | null, now: number): boolean {
    if (x === null || !Number.isFinite(x) || x < 0 || x > 1 || !Number.isFinite(now) || now < this.armedAt) { this.reset(); return false }
    // Never join movements across a stalled stream or non-monotonic timestamps.
    if (this.lastSample !== null && (now <= this.lastSample || now - this.lastSample > 400)) this.reset()
    this.lastSample = now
    if (this.start === null || now - this.start > 2000) {
      this.start = now; this.origin = x; this.extreme = x; this.direction = 0
      return false
    }
    if (!this.direction) {
      if (Math.abs(x - this.origin) >= 0.10) {
        this.direction = Math.sign(x - this.origin); this.extreme = x
      }
      return false
    }
    if ((x - this.extreme) * this.direction > 0) this.extreme = x
    if ((this.extreme - x) * this.direction >= 0.07) {
      const deliberate = now - this.start >= 150
      this.reset()
      return deliberate
    }
    return false
  }
}
