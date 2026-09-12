import type { CursorSettings } from '../../components/zentouch/feedbackModel.ts';
import { useEffect, useRef, type ReactNode } from 'react';
import { useInteraction } from '../../hooks/useInteraction.ts';
import { InteractionEngine, type PipelineSettings } from '../../interaction/engine/InteractionEngine.ts';
import type { InputSource, SelectionMethod } from '../../types/interaction.ts';
import type { KioskInput } from '../../interaction/engine/createInput.ts';
import './operator.css';

export function OperatorPanel({ input, source, onSource, settings, onSettings, cursor, onCursor, preview, onPreview, landmarks, onLandmarks, probabilities, onProbabilities, fps, onFps, onCalibrate, onClearCalibration, children }: {
  input: KioskInput; source: InputSource; onSource: (source: InputSource) => void;
  cursor: CursorSettings; onCursor: (cursor: CursorSettings) => void;
  settings: PipelineSettings; onSettings: (settings: PipelineSettings) => void;
  preview: boolean; onPreview: (value: boolean) => void; landmarks: boolean; onLandmarks: (value: boolean) => void;
  probabilities: boolean; onProbabilities: (value: boolean) => void; fps: boolean; onFps: (value: boolean) => void;
  onCalibrate: () => void; onClearCalibration: () => void; children: ReactNode;
}) {
  const snapshot = useInteraction();
  const selection = settings.selection;
  return <>
    <h1>Operator controls</h1>
    <a href="?mode=lab">Open pointing lab</a>
    <label>Input <select value={source} onChange={e => onSource(e.target.value as InputSource)}><option value="camera">Camera</option><option value="simulated">Simulated mouse dwell</option></select></label>
    {children}
    {([[preview, onPreview, 'Camera preview'], [landmarks, onLandmarks, 'Landmarks'], [probabilities, onProbabilities, 'Probabilities'], [fps, onFps, 'FPS']] as const).map(([checked, change, label]) => <label key={label}><input type="checkbox" checked={checked} onChange={e => change(e.target.checked)} /> {label}</label>)}
    <p role="status">{snapshot.tracking} · {snapshot.state.phase} · {snapshot.calibration.status}</p>
    {fps && <p>{input instanceof InteractionEngine ? input.fps.toFixed(1) : '—'} inference FPS</p>}
    <label>Selection method <select disabled={source === 'simulated'} value={selection.selectionMethod} onChange={e => onSettings({ ...settings, selection: { ...selection, selectionMethod: e.target.value as SelectionMethod } })}>
      <option value="dwell">Dwell</option><option value="pinch">Pinch</option><option value="push">Push (experimental)</option><option value="fist">Palm → fist</option>
    </select></label>
    {source === 'simulated' && <p>Mouse simulation always uses dwell.</p>}
    {(['lockThreshold', 'lockDurationMs', 'dwellDurationMs', 'cooldownDurationMs'] as const).map(key => <label key={key}>
      {{ lockThreshold: 'Lock threshold', lockDurationMs: 'Lock duration (ms)', dwellDurationMs: 'Dwell duration (ms)', cooldownDurationMs: 'Cooldown (ms)' }[key]}: {selection[key]}
      <input type="range" min={key === 'lockThreshold' ? 0.65 : 100} max={key === 'lockThreshold' ? 0.98 : 2000} step={key === 'lockThreshold' ? 0.01 : 50} value={selection[key]} onChange={e => onSettings({ ...settings, selection: { ...selection, [key]: Number(e.target.value) } })} />
    </label>)}
    <label>Cursor size: {cursor.size} px
      <input type="range" min="20" max="200" step="5" value={cursor.size} onChange={e => onCursor({ ...cursor, size: Number(e.target.value) })} />
    </label>
    <label>Snap-to-middle strength: {Math.round(cursor.snapStrength * 100)}%
      <input type="range" min="0" max="1" step="0.05" value={cursor.snapStrength} onChange={e => onCursor({ ...cursor, snapStrength: Number(e.target.value) })} />
    </label>
    <label><input type="checkbox" checked={cursor.hideProgress} onChange={e => onCursor({ ...cursor, hideProgress: e.target.checked })} /> Hide cursor progress circle</label>
    <label>Smoothing <select value={settings.smoothing.method} onChange={e => onSettings({ ...settings, smoothing: e.target.value === 'ema' ? { method: 'ema', alpha: 0.25 } : { method: 'kalman', processNoise: 10000, measurementNoise: 100 } })}><option value="ema">EMA</option><option value="kalman">Kalman</option></select></label>
    {settings.smoothing.method === 'ema' ? <label>EMA alpha: {settings.smoothing.alpha}<input type="range" min="0.01" max="1" step="0.01" value={settings.smoothing.alpha} onChange={e => onSettings({ ...settings, smoothing: { method: 'ema', alpha: Number(e.target.value) } })} /></label> : (['processNoise', 'measurementNoise'] as const).map(key => <label key={key}>{key}: {settings.smoothing.method === 'kalman' && settings.smoothing[key]}<input type="range" min="1" max={key === 'processNoise' ? 100000 : 2000} value={settings.smoothing.method === 'kalman' ? settings.smoothing[key] : 1} onChange={e => { if (settings.smoothing.method === 'kalman') onSettings({ ...settings, smoothing: { ...settings.smoothing, [key]: Number(e.target.value) } }); }} /></label>)}
    <button disabled={source !== 'camera' || snapshot.tracking !== 'tracking'} onClick={onCalibrate}>Calibrate pointing</button>
    <button onClick={onClearCalibration}>Clear calibration</button>
    {probabilities && <table><caption>Live kiosk targets</caption><thead><tr><th>Target</th><th>P</th><th>Belief</th></tr></thead><tbody>{snapshot.intent.targets.map(t => <tr key={t.targetId} data-leading={t.targetId === snapshot.intent.leadingTargetId}><td>{t.targetId}</td><td>{t.probability.toFixed(2)}</td><td>{t.belief.toFixed(2)}</td></tr>)}</tbody></table>}
    <p>Benchmark is not implemented in this checkout. Defaults remain untuned.</p>
  </>;
}

/** Draws the same camera frames consumed by the kiosk, without starting a second camera. */
export function OperatorLandmarks({ input, visible }: { input: KioskInput; visible: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const snapshot = useInteraction();
  useEffect(() => {
    const node = canvas.current, frame = input instanceof InteractionEngine ? input.frame : null;
    const ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    node.width = frame?.imageSize.width || 640; node.height = frame?.imageSize.height || 480;
    if (!visible || !frame || snapshot.tracking !== 'tracking') return;
    for (const hand of frame.hands) for (const p of hand.landmarks) {
      ctx.fillStyle = '#5eead4'; ctx.beginPath(); ctx.arc((frame.previewMirrored ? 1 - p.x : p.x) * node.width, p.y * node.height, 4, 0, Math.PI * 2); ctx.fill();
    }
  }, [input, visible, snapshot]);
  return <canvas ref={canvas} aria-label="Live hand landmarks" />;
}
