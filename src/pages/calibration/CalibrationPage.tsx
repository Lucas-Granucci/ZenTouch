import { useEffect, useRef, useState } from 'react';
import type { PointingEstimate } from '../../types/interaction.ts';
import type { CalibrationSample } from '../../interaction/pointing/calibration/affine.ts';

export const defaultCalibrationPositions = [[0.15, 0.2], [0.85, 0.2], [0.5, 0.5], [0.15, 0.8], [0.85, 0.8]] as const;

export function CalibrationPage<T>({ positions, getPointing, mirrored, fit, onComplete, onCancel }: {
  positions: readonly (readonly [number, number])[];
  getPointing: () => PointingEstimate | null;
  mirrored: boolean;
  fit: (samples: CalibrationSample[], size: { width: number; height: number }, mirrored: boolean) => T;
  onComplete: (result: T) => void;
  onCancel: () => void;
}) {
  const [samples, setSamples] = useState<CalibrationSample[]>([]);
  const [error, setError] = useState('');
  const size = useRef({ width: window.innerWidth, height: window.innerHeight });
  const buffer = useRef<PointingEstimate[]>([]);
  const target = positions[samples.length];
  useEffect(() => {
    buffer.current = [];
    const timer = window.setInterval(() => {
      const p = getPointing();
      if (p && performance.now() - p.timestamp < 250 && buffer.current.at(-1)?.timestamp !== p.timestamp) buffer.current.push(p);
      buffer.current = buffer.current.filter(p => performance.now() - p.timestamp < 600);
    }, 30);
    return () => clearInterval(timer);
  }, [getPointing, samples.length]);
  const capture = () => {
    if (window.innerWidth !== size.current.width || window.innerHeight !== size.current.height) { setError('Viewport changed. Cancel and restart calibration.'); return; }
    const points = buffer.current.filter(p => performance.now() - p.timestamp < 600);
    if (points.length < 5 || performance.now() - points[points.length - 1].timestamp > 250 || new Set(points.map(p => p.handId)).size !== 1) { setError('Hold one hand steadily toward the target for half a second.'); return; }
    const projected = { x: points.reduce((sum, p) => sum + p.position.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.position.y, 0) / points.length };
    if (points.some(p => Math.hypot(p.position.x - projected.x, p.position.y - projected.y) > 60)) { setError('Point more steadily, then capture again.'); return; }
    const next = [...samples, { projected, expected: { x: target[0] * size.current.width, y: target[1] * size.current.height } }];
    setError('');
    if (next.length === positions.length) {
      try { onComplete(fit(next, size.current, mirrored)); }
      catch (failure) { setError(String(failure)); setSamples([]); }
    } else setSamples(next);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.code === 'Space' && event.target === document.body) { event.preventDefault(); capture(); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  return <section className="calibration-page" role="dialog" aria-modal="true" aria-label="Pointing calibration">
    <div className="calibration-instructions"><h2>Calibration {samples.length + 1} / {positions.length}</h2>
      <p>Point at the circle, hold steady, then press Space or have a helper press Capture.</p>
      <button onClick={capture}>Capture sample</button> <button onClick={onCancel}>Cancel</button><p role="status">{error}</p></div>
    <div className="calibration-target" style={{ left: `${target[0] * 100}%`, top: `${target[1] * 100}%` }}>{samples.length + 1}</div>
  </section>;
}
