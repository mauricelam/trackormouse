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

  describe('streams of events', () => {
    it('classifies a stream of Windows mouse wheel tick events', () => {
      stubChromiumWindows();
      const classifier = new WheelClassifier();
      const deltas = [-120, -120, -120, 120, 240, -120];

      for (const dy of deltas) {
        classifier.addEvent(createWheelEvent({ deltaY: dy, deltaX: 0, deltaMode: WheelEvent.DOM_DELTA_PIXEL }));
      }

      expect(classifier.numEvents).toBe(6);
      expect(classifier.inferDeviceType(), classifier.debugString()).toBe('mouse');
    });

    it('classifies a stream of macOS Chromium mouse wheel tick events', () => {
      stubChromiumMacOS();
      const classifier = new WheelClassifier();
      const deltas = [-40, -40, -80, -40, 40, 80, -40];

      for (const dy of deltas) {
        classifier.addEvent(createWheelEvent({ deltaY: dy, deltaX: 0, deltaMode: WheelEvent.DOM_DELTA_PIXEL }));
      }

      expect(classifier.numEvents).toBe(7);
      expect(classifier.inferDeviceType(), classifier.debugString()).toBe('mouse');
    });

    it('classifies a stream of trackpad scroll gesture events with fractional deltas', () => {
      stubChromiumMacOS();
      const classifier = new WheelClassifier();
      // Typical trackpad scroll gesture with acceleration, fractional values, and deceleration
      const deltas = [
        { dx: 0, dy: 0.5 },
        { dx: 0, dy: 1.2 },
        { dx: 0, dy: 3.8 },
        { dx: 0, dy: 7.4 },
        { dx: 0, dy: 12.1 },
        { dx: 0, dy: 8.5 },
        { dx: 0, dy: 3.2 },
        { dx: 0, dy: 1.0 },
      ];

      for (const { dx, dy } of deltas) {
        classifier.addEvent(createWheelEvent({ deltaX: dx, deltaY: dy, deltaMode: WheelEvent.DOM_DELTA_PIXEL }));
      }

      expect(classifier.numEvents).toBe(deltas.length);
      expect(classifier.inferDeviceType(), classifier.debugString()).toBe('trackpad');
    });

    it('classifies a stream with non-zero deltaX as mouse wheel tilt', () => {
      stubChromiumWindows();
      const classifier = new WheelClassifier();
      // Mouse wheel tilt generates deltaX events
      const events = [
        { dx: 120, dy: 0 },
        { dx: 120, dy: 0 },
        { dx: -120, dy: 0 },
      ];

      for (const { dx, dy } of events) {
        classifier.addEvent(createWheelEvent({ deltaX: dx, deltaY: dy, deltaMode: WheelEvent.DOM_DELTA_PIXEL }));
      }

      expect(classifier.numEvents).toBe(3);
      expect(classifier.inferDeviceType(), classifier.debugString()).toBe('mouse');
    });

    it('identifies trackpad when integer deltas do not align with platform tick quantum in a stream', () => {
      stubChromiumMacOS();
      const classifier = new WheelClassifier();
      // Stream of integer deltas, but not multiples of 40 (e.g. 1, 2, 3...)
      const deltas = [1, 2, 3, 5, 8, 13, 21, 13, 8, 5, 3, 1];

      for (const dy of deltas) {
        classifier.addEvent(createWheelEvent({ deltaY: dy, deltaX: 0, deltaMode: WheelEvent.DOM_DELTA_PIXEL }));
      }

      expect(classifier.numEvents).toBe(deltas.length);
      expect(classifier.inferDeviceType(), classifier.debugString()).toBe('trackpad');
    });

    it('switches/maintains classification correctly across accumulated event sequence', () => {
      stubChromiumWindows();
      const classifier = new WheelClassifier();

      // Starts with integer tick
      classifier.addEvent(createWheelEvent({ deltaY: -120, deltaX: 0, deltaMode: WheelEvent.DOM_DELTA_PIXEL }));
      expect(classifier.inferDeviceType()).toBe('mouse');

      // Receives a fractional delta event in the stream
      classifier.addEvent(createWheelEvent({ deltaY: -15.5, deltaX: 0, deltaMode: WheelEvent.DOM_DELTA_PIXEL }));
      expect(classifier.inferDeviceType()).toBe('trackpad');

      // Subsequent events don't clear the fractional delta flag
      classifier.addEvent(createWheelEvent({ deltaY: -120, deltaX: 0, deltaMode: WheelEvent.DOM_DELTA_PIXEL }));
      expect(classifier.inferDeviceType()).toBe('trackpad');
    });
  });
});
