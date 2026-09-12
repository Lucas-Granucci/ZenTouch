import type { PointingEstimate } from '../../types/interaction.ts';

export type FilterOptions = { method: 'ema'; alpha: number } |
  { method: 'kalman'; processNoise: number; measurementNoise: number };
export interface PointingFilter {
  update(estimate: PointingEstimate): PointingEstimate;
  reset(): void;
}
interface Axis { p: number; v: number; pp: number; pv: number; vv: number }
/** Constant-velocity linear Kalman model. Noise units: acceleration² and CSS pixels². */
function step(axis: Axis, measurement: number, dt: number, q: number, r: number): Axis {
  const p = axis.p + axis.v * dt;
  const pp = axis.pp + 2 * dt * axis.pv + dt * dt * axis.vv + q * dt ** 4 / 4;
  const pv = axis.pv + dt * axis.vv + q * dt ** 3 / 2;
  const vv = axis.vv + q * dt * dt;
  const kp = pp / (pp + r), kv = pv / (pp + r);
  return { p: p + kp * (measurement - p), v: axis.v + kv * (measurement - p),
    pp: (1 - kp) * pp, pv: (1 - kp) * pv, vv: vv - kv * pv };
}
export function createPointingFilter(options: FilterOptions): PointingFilter {
  if (options.method === 'ema' ? !Number.isFinite(options.alpha) || options.alpha <= 0 || options.alpha > 1 :
    !Number.isFinite(options.processNoise) || options.processNoise < 0 || !Number.isFinite(options.measurementNoise) || options.measurementNoise <= 0) {
    throw new RangeError('Invalid filter parameters');
  }
  const config = { ...options };
  let previous: PointingEstimate | null = null;
  let x: Axis, y: Axis;
  return {
    reset() { previous = null; },
    update(input) {
      if (![input.timestamp, input.position.x, input.position.y].every(Number.isFinite)) throw new RangeError('Non-finite pointing sample');
      if (previous && input.handId === previous.handId && input.timestamp <= previous.timestamp) return previous;
      if (!previous || input.handId !== previous.handId || input.timestamp - previous.timestamp > 250) {
        const axis = (p: number): Axis => ({ p, v: 0, pp: config.method === 'kalman' ? config.measurementNoise : 1, pv: 0, vv: 10000 });
        x = axis(input.position.x); y = axis(input.position.y);
        previous = { ...input, velocity: null };
        return previous;
      }
      const dt = (input.timestamp - previous.timestamp) / 1000;
      if (config.method === 'ema') {
        const position = { x: previous.position.x + config.alpha * (input.position.x - previous.position.x),
          y: previous.position.y + config.alpha * (input.position.y - previous.position.y) };
        previous = { ...input, position, velocity: { x: (position.x - previous.position.x) / dt, y: (position.y - previous.position.y) / dt } };
      } else {
        x = step(x, input.position.x, dt, config.processNoise, config.measurementNoise);
        y = step(y, input.position.y, dt, config.processNoise, config.measurementNoise);
        previous = { ...input, position: { x: x.p, y: y.p }, velocity: { x: x.v, y: y.v } };
      }
      return previous;
    },
  };
}
