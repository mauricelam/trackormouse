export type InputDevice = 'mouse' | 'trackpad' | 'unknown';

export interface WheelClassification {
  device: InputDevice;
  /** 0–1. How confident the classifier is. Always 1 for pure heuristics. */
  confidence: number;
  /** Optional debug payload — signals that drove the decision. */
  reasons?: string[];
}

export interface WheelClassifier {
  classify(event: WheelEvent): WheelClassification;
  reset?(): void;
}

export interface WindowedClassifierOptions {
  windowSize?: number;      // default 8
  idleResetMs?: number;     // default 400 — gap that starts a new "gesture"
}

export interface WheelDetectorOptions extends WindowedClassifierOptions {
  minConfidence?: number;   // default 0
  onChange?: (result: WheelClassification) => void;
}
