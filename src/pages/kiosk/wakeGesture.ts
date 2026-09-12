/** A deliberate lateral movement followed by a reversal, within 1.5 seconds. */
export class WakeGesture {
  private start: number | null = null
  private origin = 0
  private extreme = 0
  private direction = 0

  reset() { this.start = null; this.direction = 0 }

  update(x: number | null, now: number): boolean {
    if (x === null) { this.reset(); return false }
    if (this.start === null || now - this.start > 1500) {
      this.start = now; this.origin = x; this.extreme = x; this.direction = 0
      return false
    }
    if (!this.direction) {
      if (Math.abs(x - this.origin) >= 0.08) {
        this.direction = Math.sign(x - this.origin); this.extreme = x
      }
      return false
    }
    if ((x - this.extreme) * this.direction > 0) this.extreme = x
    if ((this.extreme - x) * this.direction >= 0.04) { this.reset(); return true }
    return false
  }
}
