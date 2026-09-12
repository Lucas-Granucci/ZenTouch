import { useEffect, useState } from 'react';
import { KioskPage } from '../pages/kiosk/KioskPage.tsx';
import { SimulatedInputDemo } from '../pages/kiosk/SimulatedInputDemo.tsx';
import { LandmarkDebugView } from '../components/debug/LandmarkDebugView.tsx';
import { KioskStateProvider } from '../state/kiosk/KioskStateProvider.tsx';
import { useCamera } from '../hooks/useCamera.ts';
import { InteractionProvider } from '../interaction/react/InteractionProvider.tsx';
import { InteractionOverlay } from '../interaction/react/InteractionOverlay.tsx';
import { createInput, connectLandmarks } from '../interaction/engine/createInput.ts';
import type { KioskInput } from '../interaction/engine/createInput.ts';
import { InteractionEngine, defaultPipelineSettings } from '../interaction/engine/InteractionEngine.ts';
import { SimulatedInputProvider } from '../interaction/simulated/SimulatedInputProvider.ts';
import { OperatorPanel, OperatorLandmarks } from '../pages/operator/OperatorPanel.tsx';
import { CalibrationPage, defaultCalibrationPositions } from '../pages/calibration/CalibrationPage.tsx';
import { calibrationKey, fitCalibration, loadCalibration, saveCalibration } from '../interaction/pointing/calibration/affine.ts';
import type { InputSource } from '../types/interaction.ts';

export default function App() {
  const query = new URLSearchParams(window.location.search);
  if (query.get('mode') === 'lab') return <LandmarkDebugView />;
  if (query.get('mode') === 'simulator') return <SimulatedInputDemo />;
  return <KioskStateProvider><KioskSession operator={query.get('mode') === 'operator'} initialSource={query.get('input') === 'simulated' ? 'simulated' : 'camera'} /></KioskStateProvider>;
}

function KioskSession({ operator, initialSource }: { operator: boolean; initialSource: InputSource }) {
  const { videoRef, provider: cameraProvider, status, error, start, stop } = useCamera();
  const [source, setSource] = useState(initialSource);
  const [settings, setSettings] = useState(defaultPipelineSettings);
  const [input, setInput] = useState<KioskInput | null>(null);
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState(true), [landmarks, setLandmarks] = useState(true);
  const [probabilities, setProbabilities] = useState(true), [fps, setFps] = useState(true);
  const [calibrating, setCalibrating] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let calibration = null;
    try {
      if (localStorage.getItem(`${calibrationKey}.projection`) === 'blend:0.2') calibration = loadCalibration(localStorage, { width: window.innerWidth, height: window.innerHeight }, true);
    } catch { /* Camera interaction also works without persistence. */ }
    const instance = createInput(source, settings, undefined, calibration);
    // Publish the effect-owned session after its resources have been created.
    // oxlint-disable-next-line react/set-state-in-effect
    setInput(instance);
    return () => instance.dispose();
  }, [source, settings]);

  useEffect(() => {
    if (input instanceof SimulatedInputProvider && surface) return input.connectMouse(surface);
  }, [input, surface]);

  useEffect(() => {
    if (input instanceof InteractionEngine && cameraProvider) return connectLandmarks(input, cameraProvider);
  }, [input, cameraProvider]);

  // Settings replace the engine, so reconnecting restarts a stopped camera too.
  useEffect(() => {
    if (source === 'camera' && input instanceof InteractionEngine && cameraProvider) void start();
    else if (source === 'simulated') stop();
  }, [source, input, cameraProvider, start, stop]);

  const finishCalibration = () => { if (input instanceof InteractionEngine) input.setSuspended(false); setCalibrating(false); };
  const cameraRunning = ['initializing', 'tracking', 'no-hand', 'multiple-hands', 'low-confidence'].includes(status);
  return <InteractionProvider input={input} settings={settings}><div className={operator ? 'operator-layout' : undefined}>
    <aside className="operator-panel" hidden={!operator} aria-label="Operator mode">
      <div className="operator-camera" hidden={!operator || source !== 'camera' || (!preview && !landmarks)}>
        <video ref={videoRef} muted playsInline style={{ opacity: preview ? 1 : 0 }} />
        {input && <OperatorLandmarks input={input} visible={landmarks} />}
      </div>
      {input && <>
        <OperatorPanel input={input} source={source} onSource={setSource} settings={settings} onSettings={setSettings}
          preview={preview} onPreview={setPreview} landmarks={landmarks} onLandmarks={setLandmarks} probabilities={probabilities} onProbabilities={setProbabilities} fps={fps} onFps={setFps}
          onCalibrate={() => { if (input instanceof InteractionEngine) { input.setSuspended(true); setCalibrating(true); } }}
          onClearCalibration={() => {
            if (input instanceof InteractionEngine) input.setCalibration(null);
            try { localStorage.removeItem(calibrationKey); localStorage.removeItem(`${calibrationKey}.projection`); setMessage('Calibration cleared.'); } catch { setMessage('Calibration cleared for this session. Storage is unavailable.'); }
          }}>
          {source === 'camera' && <><button onClick={() => void start()} disabled={cameraRunning}>Start camera</button> <button onClick={stop}>Stop camera</button></>}
          <p role="status">{error?.message ?? message}</p>
        </OperatorPanel>
      </>}
    </aside>
    {input && <>
      <div ref={setSurface} inert={calibrating}><KioskPage /></div>
      {!calibrating && <InteractionOverlay />}
    </>}
    {!operator && source === 'camera' && !cameraRunning && <button className="camera-start" onClick={() => void start()}>Enable touchless input{error ? ` · ${error.message}` : ''}</button>}
    {calibrating && input instanceof InteractionEngine && <CalibrationPage positions={defaultCalibrationPositions} fit={fitCalibration} getPointing={() => input.rawPointing} mirrored={input.frame?.previewMirrored ?? true} onCancel={finishCalibration} onComplete={value => {
      input.setCalibration(value); finishCalibration();
      try { saveCalibration(localStorage, value); localStorage.setItem(`${calibrationKey}.projection`, 'blend:0.2'); setMessage('Calibration saved on this device.'); } catch { setMessage('Calibration applied for this session; storage is unavailable.'); }
    }} />}
  </div></InteractionProvider>;
}
