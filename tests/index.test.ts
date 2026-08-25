import { describe, it, expect } from 'vitest';
import { WheelClassifier } from '../src/index.js';
import { stubChromiumMacOS, stubChromiumWindows } from './browser_stub.js';

function createWheelEvent(init: Partial<WheelEventInit> & { timeStamp?: number } = {}): WheelEvent {
  const { timeStamp, ...wheelInit } = init;
  const evt = new WheelEvent('wheel', {
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0,
    ...wheelInit,
  });
  if (timeStamp !== undefined) {
    Object.defineProperty(evt, 'timeStamp', {
      value: timeStamp,
      writable: false,
      configurable: true,
      enumerable: true,
    });
  }
  return evt;
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
      // Mouse wheel tilt generates deltaX events with dy = 0
      const events = [
        { dx: 120, dy: 0 },
        { dx: 120, dy: 0 },
        { dx: -120, dy: 0 },
      ];

      for (const { dx, dy } of events) {
        classifier.addEvent(createWheelEvent({ deltaX: dx, deltaY: dy, deltaMode: WheelEvent.DOM_DELTA_PIXEL }));
      }

      expect(classifier.numEvents).toBe(3);
      expect(classifier.inferDeviceType(), classifier.debugString()).toBe('trackpad');
    });

    it('does not treat dy = 0 as a mouse tick on Windows or macOS', () => {
      stubChromiumWindows();
      const windowsClassifier = new WheelClassifier();
      windowsClassifier.addEvent(createWheelEvent({ deltaY: 0, deltaX: 0, deltaMode: WheelEvent.DOM_DELTA_PIXEL }));
      expect(windowsClassifier.inferDeviceType(), windowsClassifier.debugString()).toBe('trackpad');

      stubChromiumMacOS();
      const macClassifier = new WheelClassifier();
      macClassifier.addEvent(createWheelEvent({ deltaY: 0, deltaX: 0, deltaMode: WheelEvent.DOM_DELTA_PIXEL }));
      expect(macClassifier.inferDeviceType(), macClassifier.debugString()).toBe('trackpad');
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

  describe('peakEventsPerSec heuristic', () => {
    it('calculates peak events per second correctly using timestamps', () => {
      const classifier = new WheelClassifier();
      const baseTime = 1000;

      // Send 5 events at time 1000ms
      for (let i = 0; i < 5; i++) {
        classifier.addEvent(createWheelEvent({ deltaY: 120, timeStamp: baseTime }));
      }
      expect(classifier.peakEventsPerSec).toBe(5);

      // Send 10 events at time 1500ms (window: 1000ms..1500ms has 15 events)
      for (let i = 0; i < 10; i++) {
        classifier.addEvent(createWheelEvent({ deltaY: 120, timeStamp: baseTime + 500 }));
      }
      expect(classifier.peakEventsPerSec).toBe(15);

      // Send 2 events at time 2500ms (1000ms event expired, window: 1500ms..2500ms has 10 + 2 = 12 events)
      for (let i = 0; i < 2; i++) {
        classifier.addEvent(createWheelEvent({ deltaY: 120, timeStamp: baseTime + 1500 }));
      }
      // Peak remains 15
      expect(classifier.peakEventsPerSec).toBe(15);
    });

    it('classifies high frequency events (>30 events/sec) as trackpad even if deltas look like ticks', () => {
      stubChromiumWindows();
      const classifier = new WheelClassifier();
      const baseTime = 1000;

      // Send 35 events (multiples of 120 tick quantum) within 500ms
      for (let i = 0; i < 35; i++) {
        classifier.addEvent(createWheelEvent({
          deltaY: 120,
          deltaX: 0,
          deltaMode: WheelEvent.DOM_DELTA_PIXEL,
          timeStamp: baseTime + i * 10,
        }));
      }

      expect(classifier.peakEventsPerSec).toBe(35);
      expect(classifier.deltaYLooksLikeTick).toBe(35);
      expect(classifier.inferDeviceType(), classifier.debugString()).toBe('trackpad');
    });
  });
});
