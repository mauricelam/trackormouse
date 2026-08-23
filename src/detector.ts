import { HeuristicClassifier } from './heuristic.js';
import {
  InputDevice,
  WheelClassification,
  WheelClassifier,
  WheelDetectorOptions,
} from './types.js';
import { WindowedClassifier } from './windowed.js';

/**
 * Hybrid classifier combining stateless instant heuristics and stateful windowed analysis.
 *
 * Provides an immediate result on the first wheel event using HeuristicClassifier,
 * and revises the answer as more events arrive in WindowedClassifier.
 * Emits updates via the `onChange` callback when the detected input device changes.
 */
export class WheelDetector implements WheelClassifier {
  private readonly fast = new HeuristicClassifier();
  private readonly windowed: WindowedClassifier;
  private lastDevice?: InputDevice;
  private lastClassification?: WheelClassification;
  private readonly onChange?: (r: WheelClassification) => void;
  private readonly minConfidence: number;
  private readonly el?: EventTarget | null;

  /**
   * Constructs a new WheelDetector.
   *
   * @param el - Target DOM element or EventTarget to attach passive wheel listeners to (optional).
   * @param opts - Detector configuration options.
   */
  constructor(el?: EventTarget | WheelDetectorOptions | null, opts: WheelDetectorOptions = {}) {
    if (el && typeof (el as any).addEventListener !== 'function') {
      opts = el as WheelDetectorOptions;
      el = null;
    }
    this.el = el as EventTarget | null;
    this.windowed = new WindowedClassifier(opts);
    this.onChange = opts.onChange;
    this.minConfidence = opts.minConfidence ?? 0;

    if (this.el) {
      this.el.addEventListener('wheel', this.handleWheel as EventListener, { passive: true });
    }
  }

  /**
   * Classifies a WheelEvent using windowed statistical analysis, falling back to instant
   * single-event heuristics if windowed confidence is insufficient or unknown.
   *
   * @param e - The WheelEvent to classify.
   * @returns The classification result.
   */
  public classify(e: WheelEvent): WheelClassification {
    const windowedResult = this.windowed.classify(e);
    const result =
      windowedResult.device === 'unknown' || windowedResult.confidence < this.minConfidence
        ? this.fast.classify(e)
        : windowedResult;

    this.lastClassification = result;
    if (result.device !== this.lastDevice) {
      this.lastDevice = result.device;
      this.onChange?.(result);
    }
    return result;
  }

  /**
   * Internal passive wheel listener.
   */
  private handleWheel = (e: WheelEvent): void => {
    this.classify(e);
  };

  /**
   * Resets internal classifiers and device state.
   */
  public reset(): void {
    this.windowed.reset();
    this.lastDevice = undefined;
    this.lastClassification = undefined;
  }

  /**
   * Cleans up event listeners attached to the target element.
   */
  public destroy(): void {
    if (this.el) {
      this.el.removeEventListener('wheel', this.handleWheel as EventListener);
    }
  }

  /**
   * Gets the last classification result computed by this detector.
   */
  public get lastResult(): WheelClassification | undefined {
    return this.lastClassification;
  }
}
