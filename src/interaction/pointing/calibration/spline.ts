import type { Point2, PointingEstimate } from '../../../types/interaction.ts';
import type { CalibrationSample } from './affine.ts';

export interface SplineTransform {
  readonly status: 'spline-calibrated';
  readonly center: Point2;
  readonly scale: number;
  /** Control points in the centered/scaled space used for fitting and evaluation. */
  readonly points: readonly Point2[];
  /** Length points.length + 3: [w_1..w_N, a0, a1, a2] per the standard thin-plate-spline system. */
  readonly weightsX: readonly number[];
  readonly weightsY: readonly number[];
  readonly viewportSize: { readonly width: number; readonly height: number };
  readonly previewMirrored: boolean;
}

/** Thin-plate-spline radial basis kernel U(r) = r^2 * ln(r^2), with U(0) = 0. */
function kernel(squaredDistance: number): number {
  return squaredDistance <= 1e-12 ? 0 : squaredDistance * Math.log(squaredDistance);
}

/** Solves a square linear system via Gaussian elimination with partial pivoting. */
function solve(matrix: readonly (readonly number[])[], rhs: readonly number[]): number[] | null {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    if (Math.abs(a[col][col]) < 1e-9) return null;
    const divisor = a[col][col];
    a[col] = a[col].map(v => v / divisor);
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      if (factor !== 0) a[row] = a[row].map((v, k) => v - factor * a[col][k]);
    }
  }
  return a.map(row => row[n]);
}

/** Fits a thin-plate spline per axis instead of one global affine transform, so each
 * calibration point can pull the mapping locally (e.g. correct one screen corner)
 * rather than everywhere sharing a single scale/skew/offset. Center/scale the
 * projected samples first, matching affine.ts's conditioning approach.
 */
export function fitSplineCalibration(samples: readonly CalibrationSample[], viewportSize: SplineTransform['viewportSize'], previewMirrored: boolean): SplineTransform {
  const n = samples.length;
  if (n < 6 || samples.some(s => ![s.projected.x, s.projected.y, s.expected.x, s.expected.y].every(Number.isFinite)) ||
      ![viewportSize.width, viewportSize.height].every(v => Number.isFinite(v) && v > 0)) {
    throw new Error('At least six valid calibration samples are required');
  }
  const center = { x: samples.reduce((sum, s) => sum + s.projected.x, 0) / n, y: samples.reduce((sum, s) => sum + s.projected.y, 0) / n };
  const scale = Math.max(1, Math.max(...samples.map(s => Math.hypot(s.projected.x - center.x, s.projected.y - center.y))));
  const points = samples.map(s => ({ x: (s.projected.x - center.x) / scale, y: (s.projected.y - center.y) / scale }));

  const size = n + 3;
  const matrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) matrix[i][j] = kernel((points[i].x - points[j].x) ** 2 + (points[i].y - points[j].y) ** 2);
    matrix[i][n] = 1; matrix[i][n + 1] = points[i].x; matrix[i][n + 2] = points[i].y;
    matrix[n][i] = 1; matrix[n + 1][i] = points[i].x; matrix[n + 2][i] = points[i].y;
  }
  const weightsX = solve(matrix, [...samples.map(s => s.expected.x), 0, 0, 0]);
  const weightsY = solve(matrix, [...samples.map(s => s.expected.y), 0, 0, 0]);
  if (!weightsX || !weightsY || ![...weightsX, ...weightsY].every(Number.isFinite)) {
    throw new Error('Calibration points are too close together or nearly collinear; try again with a wider spread');
  }
  return { status: 'spline-calibrated', center, scale, points, weightsX, weightsY, viewportSize: { ...viewportSize }, previewMirrored };
}

export function applySplineCalibration(pointing: PointingEstimate, spline: SplineTransform): PointingEstimate {
  const p = { x: (pointing.position.x - spline.center.x) / spline.scale, y: (pointing.position.y - spline.center.y) / spline.scale };
  const evaluate = (weights: readonly number[]): number => {
    const n = spline.points.length;
    let value = weights[n] + weights[n + 1] * p.x + weights[n + 2] * p.y;
    for (let i = 0; i < n; i++) value += weights[i] * kernel((p.x - spline.points[i].x) ** 2 + (p.y - spline.points[i].y) ** 2);
    return value;
  };
  return { ...pointing, position: { x: evaluate(spline.weightsX), y: evaluate(spline.weightsY) } };
}
