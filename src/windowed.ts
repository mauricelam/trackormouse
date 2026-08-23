import {
  InputDevice,
  WheelClassification,
  WheelClassifier,
  WindowedClassifierOptions,
} from './types.js';

interface WheelSample {
  t: number;
  dx: number;
  dy: number;
  deltaMode: number;
}

/**
 * Stateful windowed (statistical) classifier.
 * Buffers recent events within a sliding window and calculates statistics
 * on delta variance, two-axis movement, inter-event cadence, and delta modes.
 */
export class WindowedClassifier implements WheelClassifier {
  private buffer: WheelSample[] = [];
  private readonly windowSize: number;
  private readonly idleResetMs: number;

  /**
   * Constructs a new WindowedClassifier.
   *
   * @param opts - Configuration options for window size and idle reset timeout.
   */
  constructor(opts: WindowedClassifierOptions = {}) {
    this.windowSize = opts.windowSize ?? 8;
    this.idleResetMs = opts.idleResetMs ?? 400;
  }

  /**
   * Clears the event buffer.
   */
  reset(): void {
    this.buffer = [];
  }

  /**
   * Records a WheelEvent sample and computes a classification based on buffered events.
   *
   * @param e - The WheelEvent to classify.
   * @returns The aggregated classification result.
   */
  classify(e: WheelEvent): WheelClassification {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const last = this.buffer[this.buffer.length - 1];
    if (last && now - last.t > this.idleResetMs) {
      this.reset();
    }

    this.buffer.push({ t: now, dx: e.deltaX, dy: e.deltaY, deltaMode: e.deltaMode });
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }

    return this.score();
  }

  /**
   * Evaluates statistical signals across the current sample buffer.
   */
  private score(): WheelClassification {
    const n = this.buffer.length;
    if (n < 2) {
      // Not enough data yet — fall back to unknown.
      return { device: 'unknown', confidence: 0 };
    }

    const fractionalCount = this.buffer.filter(
      (s) => !Number.isInteger(s.dy) || !Number.isInteger(s.dx)
    ).length;
    const twoAxisCount = this.buffer.filter((s) => s.dx !== 0 && s.dy !== 0).length;

    const intervals = this.buffer.slice(1).map((s, i) => s.t - this.buffer[i].t);
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    const DOM_DELTA_LINE = typeof WheelEvent !== 'undefined' ? WheelEvent.DOM_DELTA_LINE : 1;

    let trackpadScore = 0;
    if (fractionalCount / n > 0.3) trackpadScore += 0.4;
    if (twoAxisCount / n > 0.2) trackpadScore += 0.2;
    if (avgInterval < 20) trackpadScore += 0.3;
    if (this.buffer.some((s) => s.deltaMode === DOM_DELTA_LINE)) {
      trackpadScore -= 0.5;
    }

    const device: InputDevice = trackpadScore > 0.3 ? 'trackpad' : 'mouse';
    const confidence = Math.min(1, Math.abs(trackpadScore - 0.3) + 0.5);

    return {
      device,
      confidence,
      reasons: [`fractional=${fractionalCount}/${n}`, `avgInterval=${avgInterval.toFixed(1)}ms`],
    };
  }
}
