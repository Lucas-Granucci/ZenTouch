import { useCallback, useEffect, useRef, useState } from 'react';
import { useCamera } from '../../hooks/useCamera.ts';
import { defaultPointingOptions, estimatePointing, pointingVectors } from '../../interaction/pointing/estimate.ts';
import { createPointingFilter } from '../../interaction/filtering/PointingFilter.ts';
import type { FilterOptions } from '../../interaction/filtering/PointingFilter.ts';
import type { EngineSnapshot, PointingEstimate, SelectionMethod } from '../../types/interaction.ts';
import { noTargetMass } from '../../interaction/intent/distribution.ts';
import { TargetRegistry } from '../../interaction/intent/TargetRegistry.ts';
import { useRegisteredTarget } from '../../hooks/useRegisteredTarget.ts';
import { LiveInteraction } from '../../interaction/gestures/LiveInteraction.ts';
import { defaultSelectionConfig } from '../../interaction/gestures/SelectionMachine.ts';
import { applyCalibration, calibrationKey, loadCalibration, saveCalibration } from '../../interaction/pointing/calibration/affine.ts';
import type { Calibration } from '../../interaction/pointing/calibration/affine.ts';
import { CalibrationPage } from '../../pages/calibration/CalibrationPage.tsx';
import './LandmarkDebugView.css';

function TestTarget({ registry, id, snapshot }: { registry: TargetRegistry; id: string; snapshot: EngineSnapshot | null }) {
  const ref = useRegisteredTarget<HTMLButtonElement>(registry, id);
  const intent = snapshot?.intent.targets.find(t => t.targetId === id);
  const state = snapshot?.state;
  const active = state && 'targetId' in state && state.targetId === id;
  const progress = active ? state.phase === 'POINTING' ? state.lockProgress : state.phase === 'LOCKED' ? state.selectionProgress : 0 : 0;
  return <button ref={ref} className={`test-target ${active ? 'leading' : ''}`}>
    {id}<small>P {((intent?.probability ?? 0) * 100).toFixed(0)}% · belief {((intent?.belief ?? 0) * 100).toFixed(0)}%</small>
    <progress aria-label={`${id} progress`} max={1} value={progress} />
  </button>;
}

const chains = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12], [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]];
export function LandmarkDebugView() {
  const { videoRef, provider, status, error, start, stop } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rawRef = useRef<HTMLDivElement>(null), cursorRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<HTMLParagraphElement>(null);
  const [preview, setPreview] = useState(true);
  const [landmarks, setLandmarks] = useState(true);
  const [vectors, setVectors] = useState({ finger: true, hand: true, arm: false });
  const [method, setMethod] = useState<FilterOptions['method']>('ema');
  const [alpha, setAlpha] = useState(0.07);
  const [processNoise, setProcessNoise] = useState(10000);
  const [measurementNoise, setMeasurementNoise] = useState(100);
  const [distance, setDistance] = useState(0.2);
  const [trackingMethod, setTrackingMethod] = useState<'blend' | 'finger' | 'hand'>('blend');
  const [selectionMethod, setSelectionMethod] = useState<SelectionMethod>('dwell');
  const [lockThreshold, setLockThreshold] = useState(defaultSelectionConfig.lockThreshold);
  const [dwellDurationMs, setDwellDurationMs] = useState(1200);
  const [registry] = useState(() => new TargetRegistry());
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [selections, setSelections] = useState<string[]>([]);
  const [calibration, setCalibration] = useState<Calibration | null>(() => {
    try {
      if (localStorage.getItem(`${calibrationKey}.projection`) !== 'blend:0.2') return null;
      return loadCalibration(localStorage, { width: window.innerWidth, height: window.innerHeight }, true);
    } catch { return null; }
  });
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationMessage, setCalibrationMessage] = useState('');
  const latestPointing = useRef<PointingEstimate | null>(null);
  const mirrored = useRef(true);
  const [calibrationMirrored, setCalibrationMirrored] = useState(true);
  const getPointing = useCallback(() => latestPointing.current, []);
  const clearCalibration = () => {
    setCalibration(null);
    try { localStorage.removeItem(calibrationKey); } catch { setCalibrationMessage('Local storage is unavailable.'); }
  };
  useEffect(() => {
    if (!provider) return;
    const filter = createPointingFilter(method === 'ema' ? { method, alpha } : { method, processNoise, measurementNoise });
    const interaction = new LiveInteraction(registry, () => ({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }), { ...defaultSelectionConfig, selectionMethod, lockThreshold, dwellDurationMs });
    const unsubscribeSnapshot = interaction.subscribe(() => setSnapshot(interaction.getSnapshot()));
    const unsubscribeEvents = interaction.subscribeEvents(event => {
      if (event.type === 'select') setSelections(items => [`${event.targetId} · ${event.method} · ${(event.confidence * 100).toFixed(0)}%`, ...items].slice(0, 8));
    });
    let last = 0, lastReceived = 0, fps = 0, width = window.innerWidth, height = window.innerHeight;
    const clear = () => {
      filter.reset(); latestPointing.current = null;
      for (const node of [rawRef.current, cursorRef.current]) if (node) node.hidden = true;
      const canvas = canvasRef.current;
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    };
    const unsubscribe = provider.subscribe(frame => {
      lastReceived = performance.now();
      const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      canvas.width = frame.imageSize.width || 640; canvas.height = frame.imageSize.height || 480;
      if (videoRef.current) videoRef.current.style.transform = frame.previewMirrored ? 'scaleX(-1)' : '';
      const map = (p: { x: number; y: number }) => ({ x: (frame.previewMirrored ? 1 - p.x : p.x) * canvas.width, y: p.y * canvas.height });
      const line = (a: { x: number; y: number }, b: { x: number; y: number }, color: string) => {
        const from = map(a), to = map(b);
        ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
      };
      for (const hand of frame.hands) {
        if (landmarks) {
          for (const chain of chains) for (let i = 1; i < chain.length; i++) line(hand.landmarks[chain[i - 1]], hand.landmarks[chain[i]], '#5eead4');
          for (const landmark of hand.landmarks) { const p = map(landmark); ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); }
        }
        const raw = pointingVectors(hand);
        for (const key of ['finger', 'hand', 'arm'] as const) {
          const vector = raw[key];
          if (!vectors[key] || !vector) continue;
          const origin = key === 'finger' ? hand.landmarks[5] : key === 'hand' ? hand.landmarks[0] : hand.elbow!;
          line(origin, { x: origin.x + vector.x * 2, y: origin.y + vector.y * 2 }, key === 'finger' ? '#fbbf24' : key === 'hand' ? '#c084fc' : '#60a5fa');
        }
        const wrist = map(hand.landmarks[0]);
        ctx.font = '16px sans-serif'; ctx.fillStyle = 'white';
        ctx.fillText(`${hand.handedness} · quality ${hand.confidence.toFixed(2)} · handedness ${hand.handednessConfidence.toFixed(2)}`, Math.max(4, Math.min(wrist.x, canvas.width - 360)), Math.max(20, wrist.y));
      }
      if (last && frame.timestamp > last) fps = fps ? fps * 0.8 + 0.2 * 1000 / (frame.timestamp - last) : 1000 / (frame.timestamp - last);
      last = frame.timestamp;
      if (metricsRef.current) metricsRef.current.textContent = `${fps.toFixed(1)} inference FPS · ${frame.hands.length} hand(s) · ${frame.status}`;
      if (width !== window.innerWidth || height !== window.innerHeight) { filter.reset(); width = window.innerWidth; height = window.innerHeight; }
      mirrored.current = frame.previewMirrored;
      const raw = estimatePointing(frame, { x: 0, y: 0, width, height }, {
        ...defaultPointingOptions, fingerWeight: trackingMethod === 'hand' ? 0 : trackingMethod === 'finger' ? 1 : 0.7,
        handWeight: trackingMethod === 'finger' ? 0 : trackingMethod === 'hand' ? 1 : 0.3, projectionDistance: distance,
      });
      latestPointing.current = raw;
      const validCalibration = calibration && calibration.viewportSize.width === width && calibration.viewportSize.height === height && calibration.previewMirrored === frame.previewMirrored ? calibration : null;
      if (calibration && !validCalibration) { setCalibration(null); setCalibrationMessage('Viewport or mirroring changed. Please recalibrate.'); }
      const filtered = raw ? filter.update(validCalibration ? applyCalibration(raw, validCalibration) : raw) : null;
      const smooth = filtered;
      interaction.process(frame, calibrating ? null : smooth, calibrating ? { status: 'collecting', completedSamples: 0, totalSamples: 5 } : validCalibration ?? { status: 'uncalibrated' });
      if (!raw) { filter.reset(); for (const node of [rawRef.current, cursorRef.current]) if (node) node.hidden = true; return; }

      for (const [node, estimate] of [[rawRef.current, raw], [cursorRef.current, smooth!]] as const) {
        if (node) { node.hidden = false; node.style.left = `${estimate.position.x}px`; node.style.top = `${estimate.position.y}px`; }
      }
    });
    const timer = window.setInterval(() => { interaction.tick(performance.now()); if (performance.now() - lastReceived > 250) { clear(); if (metricsRef.current) metricsRef.current.textContent = 'Waiting for camera frames'; } }, 100);
    return () => { unsubscribe(); unsubscribeSnapshot(); unsubscribeEvents(); interaction.dispose(); clearInterval(timer); clear(); };
  }, [provider, videoRef, landmarks, vectors, method, alpha, processNoise, measurementNoise, distance, registry, trackingMethod, selectionMethod, lockThreshold, dwellDurationMs, calibration, calibrating]);
  return <main className="vision-debug">
    <header><a href="?">ZenTouch</a><h1>Pointing lab</h1><p>Start the camera and hold up one hand. Move and point to compare raw and filtered positions.</p></header>
    <div className="debug-layout"><section>
      <div className="camera-stage"><video ref={videoRef} muted playsInline style={{ opacity: preview ? 1 : 0 }} /><canvas ref={canvasRef} aria-label="Hand landmarks and pointing vectors" /></div>
    <section className="selection-lab"><h2>Live selection test · {snapshot?.state.phase ?? 'IDLE'}</h2>
      <p>No target: P {(noTargetMass(snapshot?.intent.targets ?? [], 'probability') * 100).toFixed(0)}% · belief {(noTargetMass(snapshot?.intent.targets ?? [], 'belief') * 100).toFixed(0)}%</p>
      <div className="test-targets">{['Target A', 'Target B', 'Target C'].map(id => <TestTarget key={id} id={id} registry={registry} snapshot={snapshot} />)}</div>
      <p>Highlight: within 24 px of the target and both P and belief above 60%. Lock and selection: pointer inside the target and both above {(lockThreshold * 100).toFixed(0)}%. Lock takes 300 ms; cooldown lasts 900 ms. Leaving the target cancels lock and selection progress.</p>
      <div role="log" aria-label="Gesture selections">{selections.length ? selections.map((selection, i) => <p key={`${selection}-${i}`}>{selection}</p>) : <p>No gesture selections yet.</p>}</div>
      <button onClick={() => setSelections([])}>Clear selection log</button>
    </section>
      <p ref={metricsRef}>Camera stopped</p><p role="status">{status}{error ? `: ${error.message}` : ''}</p>
      <button onClick={() => void start()} disabled={status === 'initializing' || status === 'tracking' || status === 'no-hand' || status === 'multiple-hands' || status === 'low-confidence'}>Start camera</button> <button onClick={stop}>Stop camera</button>
      <p>Camera access requires localhost or HTTPS. Video stays on this device. After an interruption, press Start camera again.</p>
    </section><aside>
      <h2>Debug controls</h2>
      <label><input type="checkbox" checked={preview} onChange={e => setPreview(e.target.checked)} /> Camera preview</label>
      <label><input type="checkbox" checked={landmarks} onChange={e => setLandmarks(e.target.checked)} /> Landmarks</label>
      {(['finger', 'hand', 'arm'] as const).map(key => <label key={key}><input type="checkbox" checked={vectors[key]} onChange={e => setVectors({ ...vectors, [key]: e.target.checked })} /> {key} vector{key === 'arm' ? ' (requires pose; unavailable)' : key === 'finger' ? ' (amber)' : ' (purple)'}</label>)}
      <label>Tracking method <select value={trackingMethod} onChange={e => { setTrackingMethod(e.target.value as typeof trackingMethod); clearCalibration(); }}>
        <option value="blend">Finger + hand blend</option><option value="finger">Finger direction</option><option value="hand">Hand direction</option><option disabled>Arm direction (pose unavailable)</option>
      </select></label>
      <label>Selection method <select value={selectionMethod} onChange={e => setSelectionMethod(e.target.value as SelectionMethod)}>
        <option value="dwell">Dwell</option><option value="pinch">Pinch</option><option value="push">Push (experimental)</option><option value="fist">Open palm → fist</option>
      </select></label>
      <p>{selectionMethod === 'dwell' ? 'Hold the leading target through lock and dwell.' : selectionMethod === 'pinch' ? 'After lock, separate thumb and index, then pinch.' : selectionMethod === 'fist' ? 'After lock, open your fingers, then close your fist.' : 'After lock, move your hand toward the camera. Apparent hand width estimates push depth.'}</p>
      <label>Lock P & belief threshold: {lockThreshold}<input type="range" min="0.65" max="0.98" step="0.01" value={lockThreshold} onChange={e => setLockThreshold(Number(e.target.value))} /></label>
      <label>Dwell duration: {dwellDurationMs} ms<input type="range" min="300" max="2000" step="50" value={dwellDurationMs} onChange={e => setDwellDurationMs(Number(e.target.value))} /></label>
      <button onClick={() => { setCalibrationMirrored(mirrored.current); setCalibrating(true); }} disabled={status !== 'tracking'}>Calibrate pointing</button> <button onClick={clearCalibration}>Clear calibration</button>
      <p>{calibration ? 'Calibration applied' : 'Uncalibrated'} · {calibrationMessage}</p>
      <label>Filter <select value={method} onChange={e => setMethod(e.target.value as FilterOptions['method'])}><option value="ema">EMA</option><option value="kalman">Kalman (position + velocity)</option></select></label>
      {method === 'ema' ? <label>EMA alpha: {alpha}<input type="range" min="0.01" max="1" step="0.01" value={alpha} onChange={e => setAlpha(Number(e.target.value))} /></label> : <>
        <label>Process noise: {processNoise}<input type="range" min="0" max="100000" step="100" value={processNoise} onChange={e => setProcessNoise(Number(e.target.value))} /></label>
        <label>Measurement noise: {measurementNoise}<input type="range" min="1" max="2000" value={measurementNoise} onChange={e => setMeasurementNoise(Number(e.target.value))} /></label></>}

      <label>Projection distance: {distance}<input type="range" min="0" max="0.8" step="0.01" value={distance} onChange={e => { setDistance(Number(e.target.value)); clearCalibration(); }} /></label>
      <p>Amber ring: raw. Teal dot: filtered. Both use viewport coordinates and may move offscreen. Point at the test targets below to exercise locking and selection.</p>
      <p>Quality is MediaPipe’s geometry gate (0 or 1), not a measured tracking probability. Handedness confidence is shown separately.</p>
    </aside></div>
    {calibrating && <CalibrationPage getPointing={getPointing} mirrored={calibrationMirrored} onCancel={() => setCalibrating(false)} onComplete={value => {
      setCalibration(value); setCalibrating(false);
      try { saveCalibration(localStorage, value); localStorage.setItem(`${calibrationKey}.projection`, `${trackingMethod}:${distance}`); setCalibrationMessage('Saved on this device.'); } catch { setCalibrationMessage('Applied for this session; local storage is unavailable.'); }
    }} />}
    <div ref={rawRef} hidden className="pointing-cursor raw" aria-hidden="true" /><div ref={cursorRef} hidden className="pointing-cursor filtered" aria-hidden="true" />
  </main>;
}
