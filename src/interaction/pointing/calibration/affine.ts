import type { CalibrationState, Point2, PointingEstimate } from '../../../types/interaction.ts';
export type Calibration = Extract<CalibrationState, { status: 'calibrated' }>;
export interface CalibrationSample { projected: Point2; expected: Point2 }
export const calibrationKey = 'zentouch.calibration.v1';

/** Center/scale inputs before pivoted least squares to avoid viewport-sized conditioning errors. */
export function fitCalibration(samples: readonly CalibrationSample[], viewportSize: Calibration['viewportSize'], previewMirrored: boolean): Calibration {
  if (samples.length < 3 || samples.some(s => ![s.projected.x, s.projected.y, s.expected.x, s.expected.y].every(Number.isFinite)) ||
      ![viewportSize.width, viewportSize.height].every(n => Number.isFinite(n) && n > 0)) throw new Error('At least three valid, non-collinear samples are required');
  const center = { x: samples.reduce((sum, s) => sum + s.projected.x, 0) / samples.length, y: samples.reduce((sum, s) => sum + s.projected.y, 0) / samples.length };
  const scale = Math.max(...samples.map(s => Math.hypot(s.projected.x - center.x, s.projected.y - center.y)));
  if (scale < 1) throw new Error('Point at distinct positions before capturing each target');
  const rows = samples.map(s => [(s.projected.x - center.x) / scale, (s.projected.y - center.y) / scale, 1]);
  const matrix = [0, 1, 2].map(i => [0, 1, 2].map(j => rows.reduce((sum, row) => sum + row[i] * row[j], 0)));
  const solve = (axis: 'x' | 'y') => {
    const a = matrix.map((row, i) => [...row, rows.reduce((sum, row, j) => sum + row[i] * samples[j].expected[axis], 0)]);
    for (let i = 0; i < 3; i++) {
      let pivot = i;
      for (let j = i + 1; j < 3; j++) if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
      [a[i], a[pivot]] = [a[pivot], a[i]];
      if (Math.abs(a[i][i]) < 1e-6) throw new Error('Calibration points are collinear; try again with a wider range');
      const divisor = a[i][i]; a[i] = a[i].map(n => n / divisor);
      for (let j = 0; j < 3; j++) if (j !== i) { const factor = a[j][i]; a[j] = a[j].map((n, k) => n - factor * a[i][k]); }
    }
    const u = a[0][3] / scale, v = a[1][3] / scale;
    return [u, v, a[2][3] - u * center.x - v * center.y] as const;
  };
  const transform = [...solve('x'), ...solve('y')] as Calibration['transform'];
  if (!transform.every(Number.isFinite) || Math.abs(transform[0] * transform[4] - transform[1] * transform[3]) < 1e-8) throw new Error('Degenerate calibration');
  return { status: 'calibrated', transform, viewportSize: { ...viewportSize }, previewMirrored };
}
export function applyCalibration(pointing: PointingEstimate, calibration: Calibration): PointingEstimate {
  const [a, b, tx, c, d, ty] = calibration.transform, p = pointing.position, v = pointing.velocity;
  return { ...pointing, position: { x: a * p.x + b * p.y + tx, y: c * p.x + d * p.y + ty }, velocity: v ? { x: a * v.x + b * v.y, y: c * v.x + d * v.y } : null };
}
export function loadCalibration(storage: Pick<Storage, 'getItem'>, size: Calibration['viewportSize'], mirrored: boolean): Calibration | null {
  try {
    const c = JSON.parse(storage.getItem(calibrationKey) ?? 'null');
    return c?.status === 'calibrated' && Array.isArray(c.transform) && c.transform.length === 6 && c.transform.every((n: unknown) => typeof n === 'number' && Number.isFinite(n)) &&
      Math.abs(c.transform[0] * c.transform[4] - c.transform[1] * c.transform[3]) >= 1e-8 && c.viewportSize?.width === size.width && c.viewportSize?.height === size.height && c.previewMirrored === mirrored ? c : null;
  } catch { return null; }
}
export function saveCalibration(storage: Pick<Storage, 'setItem'>, calibration: Calibration) { storage.setItem(calibrationKey, JSON.stringify(calibration)); }
