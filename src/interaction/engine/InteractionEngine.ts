import type { InteractionEngine as Engine, LandmarkFrame, ViewportRect } from '../../types/interaction.ts';
import { TargetRegistry } from '../intent/TargetRegistry.ts';
import { LiveInteraction } from '../gestures/LiveInteraction.ts';
import { defaultSelectionConfig, type SelectionConfig } from '../gestures/SelectionMachine.ts';
import { createPointingFilter, type FilterOptions } from '../filtering/PointingFilter.ts';
import { estimatePointing } from '../pointing/estimate.ts';
import { applyCalibration, type Calibration } from '../pointing/calibration/affine.ts';

export interface PipelineSettings {
  selection: SelectionConfig;
  smoothing: FilterOptions;
}
export const defaultPipelineSettings: PipelineSettings = {
  selection: { ...defaultSelectionConfig }, smoothing: { method: 'ema', alpha: 0.07 },
};

/** Owns the complete camera pipeline; no DOM or camera lifecycle is required for replay. */
export class InteractionEngine implements Engine {
  readonly targets = new TargetRegistry();
  private live: LiveInteraction;
  private filter;
  private viewport: () => ViewportRect;
  private calibration: Calibration | null;
  private geometry = '';
  private clock = -1;
  private disposed = false;
  private suspended = false;
  frame: LandmarkFrame | null = null;
  rawPointing: ReturnType<typeof estimatePointing> = null;
  fps = 0;
  constructor(viewport: () => ViewportRect, settings = defaultPipelineSettings, calibration: Calibration | null = null) {
    this.viewport = viewport; this.calibration = calibration;
    this.filter = createPointingFilter(settings.smoothing);
    this.live = new LiveInteraction(this.targets, viewport, settings.selection);
  }
  getSnapshot = () => this.live.getSnapshot();
  subscribe = (listener: () => void) => this.live.subscribe(listener);
  subscribeEvents: Engine['subscribeEvents'] = listener => this.live.subscribeEvents(listener);
  processFrame(frame: LandmarkFrame) {
    if (this.disposed || !Number.isFinite(frame.timestamp) || frame.timestamp <= this.clock) return;
    this.clock = frame.timestamp;
    const viewport = this.viewport();
    const geometry = JSON.stringify([viewport, frame.previewMirrored]);
    if (this.geometry !== geometry) { this.filter.reset(); this.geometry = geometry; }
    if (this.frame && frame.timestamp > this.frame.timestamp) {
      const fps = 1000 / (frame.timestamp - this.frame.timestamp);
      this.fps = this.fps ? this.fps * 0.8 + fps * 0.2 : fps;
    }
    this.frame = frame;
    const c = this.calibration;
    if (c && (c.viewportSize.width !== viewport.width || c.viewportSize.height !== viewport.height || c.previewMirrored !== frame.previewMirrored)) this.calibration = null;
    this.rawPointing = estimatePointing(frame, viewport);
    const raw = this.rawPointing;
    const filtered = raw ? this.filter.update(raw) : null;
    if (!raw) this.filter.reset();
    const calibrated = filtered && this.calibration ? applyCalibration(filtered, this.calibration) : filtered;
    const pointing = calibrated;
    this.live.process(frame, this.suspended ? null : pointing, this.suspended
      ? { status: 'collecting', completedSamples: 0, totalSamples: 5 }
      : this.calibration ?? { status: 'uncalibrated' });
  }
  tick(timestamp: number) {
    if (this.disposed || !Number.isFinite(timestamp) || timestamp < this.clock) return;
    this.clock = timestamp; this.live.tick(timestamp);
    if (this.frame && timestamp - this.frame.timestamp >= 250) { this.rawPointing = null; this.filter.reset(); this.fps = 0; }
  }
  reset(timestamp = performance.now(), options?: { readonly clearCalibration?: boolean }) {
    if (this.disposed || timestamp < this.clock) return;
    this.clock = timestamp; this.filter.reset(); this.rawPointing = null;
    if (options?.clearCalibration) this.calibration = null;
    this.live.reset(timestamp);
  }
  setCalibration(calibration: Calibration | null) { this.calibration = calibration; this.reset(); }
  setSuspended(suspended: boolean) { this.suspended = suspended; this.reset(); }
  dispose() { this.disposed = true; this.live.dispose(); }
}
