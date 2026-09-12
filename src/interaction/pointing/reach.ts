import type { PointingEstimate, ViewportRect } from '../../types/interaction.ts';

// Keep the central 40% unchanged. Beyond it, smoothly increase reach so
// at full strength, positions at 15% / 85% map to the screen edges on each axis.
const precisionRadius = 0.4;
const maximumStrength = 10 / 3;

export function applyProgressiveReach(pointing: PointingEstimate, viewport: ViewportRect, scaling = 0): PointingEstimate {
  if (!Number.isFinite(scaling) || scaling < 0 || scaling > 1) throw new RangeError('Invalid reach scaling');
  if (scaling === 0) return pointing;
  const strength = maximumStrength * scaling;
  const axis = (position: number, origin: number, size: number) => {
    const offset = (position - origin - size / 2) / (size / 2);
    const excess = Math.max(0, Math.abs(offset) - precisionRadius);
    return {
      position: position + Math.sign(offset) * strength * excess * excess * size / 2,
      slope: 1 + 2 * strength * excess,
    };
  };
  const x = axis(pointing.position.x, viewport.x, viewport.width);
  const y = axis(pointing.position.y, viewport.y, viewport.height);
  return {
    ...pointing,
    position: { x: x.position, y: y.position },
    velocity: pointing.velocity ? { x: pointing.velocity.x * x.slope, y: pointing.velocity.y * y.slope } : null,
  };
}
