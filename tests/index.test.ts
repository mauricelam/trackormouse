import { describe, it, expect } from 'vitest';
import { WheelClassifier } from '../src/index.js';
import { stubChromiumMacOS, stubChromiumWindows } from './browser_stub.js';

function createWheelEvent(init: Partial<WheelEventInit> = {}): WheelEvent {
  return new WheelEvent('wheel', {
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0,
    ...init,
  });
}

describe('WheelClassifier', () => {

  it('classifies DOM_DELTA_LINE as mouse', () => {
    const classifier = new WheelClassifier();
    const event = createWheelEvent({ deltaMode: WheelEvent.DOM_DELTA_LINE, deltaY: 3 });
    classifier.addEvent(event);
    const result = classifier.inferDeviceType();
    expect(result, classifier.debugString()).toBe('mouse');
  });

  it('classifies integer step deltas (e.g., dy = 120) as mouse', () => {
    stubChromiumWindows()
    const classifier = new WheelClassifier();
    const event = createWheelEvent({ deltaY: -120, deltaX: 0, deltaMode: WheelEvent.DOM_DELTA_PIXEL });
    classifier.addEvent(event);
    const result = classifier.inferDeviceType();
    expect(result, classifier.debugString()).toBe('mouse');
  });

  it('classifies integer step deltas (e.g., dy = 40) as mouse', () => {
    stubChromiumMacOS()
    const classifier = new WheelClassifier();
    const event = createWheelEvent({ deltaY: -40, deltaX: 0, deltaMode: WheelEvent.DOM_DELTA_PIXEL });
    classifier.addEvent(event);
    const result = classifier.inferDeviceType();
    expect(result, classifier.debugString()).toBe('mouse');
  });

  it('classifies fractional/pixel deltas as trackpad', () => {
    const classifier = new WheelClassifier();
    const event = createWheelEvent({ deltaY: 2.399999, deltaX: 0, deltaMode: WheelEvent.DOM_DELTA_PIXEL });
    classifier.addEvent(event);
    const result = classifier.inferDeviceType();
    expect(result, classifier.debugString()).toBe('trackpad');
  });
});
