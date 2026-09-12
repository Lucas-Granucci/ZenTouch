import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CameraLandmarkProvider } from '../src/interaction/vision/CameraLandmarkProvider.ts';
import type { CameraOptions } from '../src/interaction/vision/CameraLandmarkProvider.ts';
import type { LandmarkFrame } from '../src/types/interaction.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

function setup(options: CameraOptions = {}) {
  let time = 1;
  let stopped = 0;
  let closed = 0;
  let inferences = 0;
  let requests = 0;
  let callback: FrameRequestCallback | null = null;
  const track = Object.assign(new EventTarget(), { stop: () => { stopped++; } });
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  const video = Object.assign(new EventTarget(), {
    videoWidth: 640, videoHeight: 480, readyState: 2, currentTime: 0,
    muted: false, playsInline: false, srcObject: null,
    play: async () => {}, pause: () => {},
  }) as unknown as HTMLVideoElement;
  const detector = {
    detectForVideo: (_video: HTMLVideoElement, timestamp: number) => {
      inferences++; assert.equal(timestamp, time);
      time += 5; // Frame timestamps must not become inference completion time.
      return { landmarks: [], worldLandmarks: [], handedness: [] };
    },
    close: () => { closed++; },
  };
  const provider = new CameraLandmarkProvider(video, {
    now: () => time,
    getUserMedia: async constraints => {
      requests++; assert.deepEqual(constraints, { audio: false, video: { facingMode: { ideal: 'user' } } }); return stream;
    },
    createDetector: async () => detector,
    requestFrame: cb => { callback = cb; return 1; },
    cancelFrame: () => { callback = null; },
    ...options,
  });
  const frames: LandmarkFrame[] = [];
  provider.subscribe(frame => frames.push(frame));
  return { provider, video, stream, track, detector, frames,
    counts: () => ({ stopped, closed, inferences, requests }),
    tick: (timestamp: number) => { time = timestamp; const cb = callback; callback = null; cb?.(timestamp); },
  };
}

test('idempotent start, unique video frames, capture timestamps, and complete stop', async () => {
  const s = setup();
  const start = s.provider.start();
  assert.equal(s.provider.start(), start);
  await start;
  assert.equal(s.video.muted, true); assert.equal(s.video.playsInline, true);
  s.tick(10); s.tick(20);
  assert.equal(s.counts().inferences, 1);
  assert.equal(s.frames.at(-1)?.timestamp, 10);
  assert.equal(s.frames.at(-1)?.status, 'no-hand');
  s.video.currentTime = 1; s.tick(30);
  assert.equal(s.counts().inferences, 2);
  s.provider.stop(); s.provider.stop(); s.tick(40);
  assert.equal(s.counts().stopped, 1); assert.equal(s.counts().closed, 1);
  assert.equal(s.video.srcObject, null);
  assert.equal(s.frames.length, 3);
});

test('stop cancels pending permission and releases a late stream without frames', async () => {
  const media = deferred<MediaStream>();
  const s = setup({ getUserMedia: () => media.promise });
  const start = s.provider.start(); s.provider.stop();
  await start;
  media.resolve(s.stream); await Promise.resolve(); await Promise.resolve();
  assert.equal(s.counts().stopped, 1); assert.equal(s.frames.length, 1);
});

test('stop during model initialization closes a late detector', async () => {
  const model = deferred<ReturnType<typeof setup>['detector']>();
  const s = setup({ createDetector: () => model.promise });
  const start = s.provider.start();
  await Promise.resolve(); await Promise.resolve();
  s.provider.stop(); await start;
  model.resolve(s.detector); await Promise.resolve(); await Promise.resolve();
  assert.equal(s.counts().stopped, 1); assert.equal(s.counts().closed, 1);
});

test('expected permission failures resolve with a status; model failures reject and release camera', async () => {
  const denied = setup({ getUserMedia: async () => { throw new DOMException('Denied', 'NotAllowedError'); } });
  await denied.provider.start();
  assert.equal(denied.frames.at(-1)?.status, 'permission-denied');
  const broken = setup({ createDetector: async () => { throw new Error('bad model'); } });
  await assert.rejects(broken.provider.start(), /bad model/);
  assert.equal(broken.counts().stopped, 1);
});

test('track interruptions publish empty hands and release resources; restart is supported', async () => {
  const s = setup(); await s.provider.start(); s.tick(10);
  s.track.dispatchEvent(new Event('mute'));
  assert.equal(s.frames.at(-1)?.status, 'interrupted');
  assert.deepEqual(s.frames.at(-1)?.hands, []);
  assert.equal(s.counts().stopped, 1);
  await s.provider.start(); s.video.currentTime = 2; s.tick(30);
  assert.equal(s.counts().requests, 2);
  s.provider.stop();
});

test('native video callbacks preserve capture time, publish tracked hands, and cancel on stop', async () => {
  const s = setup({ requestFrame: undefined });
  let callback: VideoFrameRequestCallback | undefined;
  let cancelled = 0;
  s.video.requestVideoFrameCallback = cb => { callback = cb; return 42; };
  s.video.cancelVideoFrameCallback = id => { assert.equal(id, 42); cancelled++; };
  s.detector.detectForVideo = (_video, timestamp) => {
    assert.equal(timestamp, 10);
    return {
      landmarks: [Array.from({ length: 21 }, (_, i) => ({ x: i / 100, y: 0.2, z: 0 }))],
      worldLandmarks: [], handedness: [],
    };
  };
  await s.provider.start();
  callback!(20, { captureTime: 10 } as VideoFrameCallbackMetadata);
  assert.equal(s.frames.at(-1)?.timestamp, 10);
  assert.equal(s.frames.at(-1)?.status, 'tracking');
  assert.equal(s.frames.at(-1)?.hands[0].landmarks.length, 21);
  assert.equal(s.frames.at(-1)?.previewMirrored, true);
  s.provider.stop(); assert.equal(cancelled, 1);
});

test('a cancelled old start cannot replace the stream from a restart', async () => {
  const oldMedia = deferred<MediaStream>();
  const s = setup();
  let calls = 0;
  const fresh = setup({ getUserMedia: () => ++calls === 1 ? oldMedia.promise : Promise.resolve(s.stream) });
  const first = fresh.provider.start(); fresh.provider.stop(); await first;
  await fresh.provider.start();
  oldMedia.resolve(fresh.stream); await Promise.resolve(); await Promise.resolve();
  assert.equal(fresh.video.srcObject, s.stream);
  assert.equal(fresh.counts().stopped, 1);
  fresh.provider.stop(); assert.equal(s.counts().stopped, 1);
});
