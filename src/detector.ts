import { HeuristicClassifier } from './heuristic.js';
import {
  InputDevice,
  WheelClassification,
  WheelClassifier,
  WheelDetectorOptions,
} from './types.js';
import { WindowedClassifier } from './windowed.js';

export class WheelDetector implements WheelClassifier {
  private readonly fast = new HeuristicClassifier();
  private readonly windowed: WindowedClassifier;
  private lastDevice?: InputDevice;
  private lastClassification?: WheelClassification;
  private readonly onChange?: (r: WheelClassification) => void;
  private readonly minConfidence: number;
  private readonly el?: EventTarget | null;

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

  private handleWheel = (e: WheelEvent): void => {
    this.classify(e);
  };

  public reset(): void {
    this.windowed.reset();
    this.lastDevice = undefined;
    this.lastClassification = undefined;
  }

  public destroy(): void {
    if (this.el) {
      this.el.removeEventListener('wheel', this.handleWheel as EventListener);
    }
  }

  public get lastResult(): WheelClassification | undefined {
    return this.lastClassification;
  }
}
