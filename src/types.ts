/**
 * Represents the detected input device type.
 * - `'mouse'`: Mouse scroll wheel
 * - `'trackpad'`: Trackpad touch gesture
 * - `'unknown'`: Unclassified input (e.g. before sufficient samples arrive)
 */
export type InputDevice = 'mouse' | 'trackpad' | 'unknown';

/**
 * Result of a wheel event classification.
 */
export interface WheelClassification {
  /** The detected input device. */
  device: InputDevice;
  /**
   * Confidence score from 0 to 1 indicating how confident the classifier is.
   * Pure single-event heuristics have fixed confidence (e.g., 0.5 - 0.7).
   */
  confidence: number;
  /**
   * Optional debug signals or heuristics that drove the decision.
   */
  reasons?: string[];
}

/**
 * Interface implemented by wheel classifiers.
 */
export interface WheelClassifier {
  /**
   * Classifies a single wheel event.
   * @param event The WheelEvent to classify.
   * @returns The classification result including device, confidence, and reasons.
   */
  classify(event: WheelEvent): WheelClassification;

  /**
   * Resets internal state or sample buffers.
   */
  reset?(): void;
}

/**
 * Options for configuring a statistical windowed classifier.
 */
export interface WindowedClassifierOptions {
  /**
   * Maximum number of recent wheel events to keep in buffer for statistical analysis.
   * @default 8
   */
  windowSize?: number;

  /**
   * Idle time gap in milliseconds that resets the current sample buffer (marking a new gesture).
   * @default 400
   */
  idleResetMs?: number;
}

/**
 * Options for configuring the hybrid WheelDetector.
 */
export interface WheelDetectorOptions extends WindowedClassifierOptions {
  /**
   * Minimum confidence threshold required for windowed classification to take precedence.
   * If windowed confidence is below this value, falls back to the stateless heuristic classifier.
   * @default 0
   */
  minConfidence?: number;

  /**
   * Callback invoked whenever the detected input device changes.
   * @param result The latest WheelClassification result.
   */
  onChange?: (result: WheelClassification) => void;
}
