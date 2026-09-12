import { useEffect, useRef, useState } from 'react';
import { useCamera } from '../../hooks/useCamera.ts';
import { defaultPointingOptions, estimatePointing, pointingVectors } from '../../interaction/pointing/estimate.ts';
import { createPointingFilter } from '../../interaction/filtering/PointingFilter.ts';
import type { FilterOptions } from '../../interaction/filtering/PointingFilter.ts';
import './LandmarkDebugView.css';

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
  const [alpha, setAlpha] = useState(0.25);
  const [processNoise, setProcessNoise] = useState(10000);
  const [measurementNoise, setMeasurementNoise] = useState(100);
  const [distance, setDistance] = useState(0.2);
  useEffect(() => {
    if (!provider) return;
    const filter = createPointingFilter(method === 'ema' ? { method, alpha } : { method, processNoise, measurementNoise });
    let last = 0, lastReceived = 0, fps = 0, width = window.innerWidth, height = window.innerHeight;
    const clear = () => {
      filter.reset();
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
      const raw = estimatePointing(frame, { x: 0, y: 0, width, height }, { ...defaultPointingOptions, projectionDistance: distance });
      if (!raw) { filter.reset(); for (const node of [rawRef.current, cursorRef.current]) if (node) node.hidden = true; return; }
      const smooth = filter.update(raw);
      for (const [node, estimate] of [[rawRef.current, raw], [cursorRef.current, smooth]] as const) {
        if (node) { node.hidden = false; node.style.left = `${estimate.position.x}px`; node.style.top = `${estimate.position.y}px`; }
      }
    });
    const timer = window.setInterval(() => { if (performance.now() - lastReceived > 250) { clear(); if (metricsRef.current) metricsRef.current.textContent = 'Waiting for camera frames'; } }, 100);
    return () => { unsubscribe(); clearInterval(timer); clear(); };
  }, [provider, videoRef, landmarks, vectors, method, alpha, processNoise, measurementNoise, distance]);
  return <main className="vision-debug">
    <header><a href="?">ZenTouch</a><h1>Pointing lab</h1><p>Start the camera and hold up one hand. Move and point to compare raw and filtered positions.</p></header>
    <div className="debug-layout"><section>
      <div className="camera-stage"><video ref={videoRef} muted playsInline style={{ opacity: preview ? 1 : 0 }} /><canvas ref={canvasRef} aria-label="Hand landmarks and pointing vectors" /></div>
      <p ref={metricsRef}>Camera stopped</p><p role="status">{status}{error ? `: ${error.message}` : ''}</p>
      <button onClick={() => void start()} disabled={status === 'initializing' || status === 'tracking' || status === 'no-hand' || status === 'multiple-hands' || status === 'low-confidence'}>Start camera</button> <button onClick={stop}>Stop camera</button>
      <p>Camera access requires localhost or HTTPS. Video stays on this device. After an interruption, press Start camera again.</p>
    </section><aside>
      <h2>Debug controls</h2>
      <label><input type="checkbox" checked={preview} onChange={e => setPreview(e.target.checked)} /> Camera preview</label>
      <label><input type="checkbox" checked={landmarks} onChange={e => setLandmarks(e.target.checked)} /> Landmarks</label>
      {(['finger', 'hand', 'arm'] as const).map(key => <label key={key}><input type="checkbox" checked={vectors[key]} onChange={e => setVectors({ ...vectors, [key]: e.target.checked })} /> {key} vector{key === 'arm' ? ' (requires pose; unavailable)' : key === 'finger' ? ' (amber)' : ' (purple)'}</label>)}
      <label>Filter <select value={method} onChange={e => setMethod(e.target.value as FilterOptions['method'])}><option value="ema">EMA</option><option value="kalman">Kalman (position + velocity)</option></select></label>
      {method === 'ema' ? <label>EMA alpha: {alpha}<input type="range" min="0.01" max="1" step="0.01" value={alpha} onChange={e => setAlpha(Number(e.target.value))} /></label> : <>
        <label>Process noise: {processNoise}<input type="range" min="0" max="100000" step="100" value={processNoise} onChange={e => setProcessNoise(Number(e.target.value))} /></label>
        <label>Measurement noise: {measurementNoise}<input type="range" min="1" max="2000" value={measurementNoise} onChange={e => setMeasurementNoise(Number(e.target.value))} /></label></>}
      <label>Projection distance: {distance}<input type="range" min="0" max="0.8" step="0.01" value={distance} onChange={e => setDistance(Number(e.target.value))} /></label>
      <p>Amber ring: raw. Teal dot: filtered. Both use viewport coordinates and may move offscreen. This is an uncalibrated pointing preview with no selection.</p>
      <p>Quality is MediaPipe’s geometry gate (0 or 1), not a measured tracking probability. Handedness confidence is shown separately.</p>
    </aside></div>
    <div ref={rawRef} hidden className="pointing-cursor raw" aria-hidden="true" /><div ref={cursorRef} hidden className="pointing-cursor filtered" aria-hidden="true" />
  </main>;
}
