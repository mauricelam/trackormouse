import { WheelClassification, WheelClassifier } from './types.js';

/**
 * Stateless single-event classifier.
 * Classifies each `WheelEvent` in isolation using `deltaMode` and integer/step delta checks.
 */
export class HeuristicClassifier implements WheelClassifier {
  /**
   * Classifies a WheelEvent in isolation.
   *
   * @param e - The WheelEvent to classify.
   * @returns The classification indicating mouse wheel vs trackpad.
   */
  classify(e: WheelEvent): WheelClassification {
    const DOM_DELTA_LINE = typeof WheelEvent !== 'undefined' ? WheelEvent.DOM_DELTA_LINE : 1;
    if (e.deltaMode === DOM_DELTA_LINE) {
      return { device: 'mouse', confidence: 0.7, reasons: ['deltaMode=LINE'] };
    }

    const dy = e.deltaY;
    const dx = e.deltaX;
    const isWholeStep =
      Number.isInteger(dy) &&
      Number.isInteger(dx) &&
      (Math.abs(dy) % 100 === 0 || Math.abs(dy) % 120 === 0) &&
      Math.abs(dy) >= 40;

    if (isWholeStep) {
      return { device: 'mouse', confidence: 0.6, reasons: ['integer step delta'] };
    }

    return { device: 'trackpad', confidence: 0.5, reasons: ['fractional/pixel delta'] };
  }
}
