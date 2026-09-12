import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackingStatus } from '../types/interaction.ts';
import { CameraLandmarkProvider } from '../interaction/vision/CameraLandmarkProvider.ts';

/** Attach videoRef to a video element. Start explicitly from a user action. */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const providerRef = useRef<CameraLandmarkProvider | null>(null);
  const [provider, setProvider] = useState<CameraLandmarkProvider | null>(null);
  const [status, setStatus] = useState<TrackingStatus>('unavailable');
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!videoRef.current) return;
    const input = new CameraLandmarkProvider(videoRef.current);
    providerRef.current = input;
    setProvider(input);
    const unsubscribe = input.subscribe(frame => setStatus(frame.status));
    return () => { unsubscribe(); input.stop(); providerRef.current = null; };
  }, []);
  const start = useCallback(async () => {
    const input = providerRef.current;
    if (!input) return;
    setError(null);
    try { await input.start(); }
    catch (failure) {
      if (providerRef.current === input) setError(failure instanceof Error ? failure : new Error(String(failure)));
    }
  }, []);
  const stop = useCallback(() => {
    providerRef.current?.stop();
    setStatus('unavailable');
  }, []);
  return { videoRef, provider, status, error, start, stop };
}
