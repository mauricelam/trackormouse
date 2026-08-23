import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HeuristicClassifier, WindowedClassifier, WheelDetector } from '../src/index.js';

function createWheelEvent(init: Partial<WheelEventInit> = {}): WheelEvent {
  return new WheelEvent('wheel', {
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0,
    ...init,
  });
}

describe('HeuristicClassifier', () => {
  const classifier = new HeuristicClassifier();

  it('classifies DOM_DELTA_LINE as mouse with 0.7 confidence', () => {
    const event = createWheelEvent({ deltaMode: WheelEvent.DOM_DELTA_LINE, deltaY: 3 });
    const result = classifier.classify(event);
    expect(result.device).toBe('mouse');
    expect(result.confidence).toBe(0.7);
    expect(result.reasons).toContain('deltaMode=LINE');
  });

  it('classifies integer step deltas (e.g., dy = 100 or 120) as mouse with 0.6 confidence', () => {
    const event100 = createWheelEvent({ deltaY: 100, deltaX: 0, deltaMode: 0 });
    const result100 = classifier.classify(event100);
    expect(result100.device).toBe('mouse');
    expect(result100.confidence).toBe(0.6);
    expect(result100.reasons).toContain('integer step delta');

    const event120 = createWheelEvent({ deltaY: -120, deltaX: 0, deltaMode: 0 });
    const result120 = classifier.classify(event120);
    expect(result120.device).toBe('mouse');
    expect(result120.confidence).toBe(0.6);
  });

  it('classifies fractional/pixel deltas as trackpad with 0.5 confidence', () => {
    const event = createWheelEvent({ deltaY: 2.399999, deltaX: 0, deltaMode: 0 });
    const result = classifier.classify(event);
    expect(result.device).toBe('trackpad');
    expect(result.confidence).toBe(0.5);
    expect(result.reasons).toContain('fractional/pixel delta');
  });
});

describe('WindowedClassifier', () => {
  let classifier: WindowedClassifier;

  beforeEach(() => {
    classifier = new WindowedClassifier({ windowSize: 5, idleResetMs: 200 });
  });

  it('returns unknown device with 0 confidence when less than 2 events', () => {
    const event = createWheelEvent({ deltaY: 2.5 });
    const result = classifier.classify(event);
    expect(result.device).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('detects trackpad input with fractional deltas and high cadence', () => {
    const e1 = createWheelEvent({ deltaY: 2.5, deltaX: 1.2 });
    const e2 = createWheelEvent({ deltaY: 3.1, deltaX: 1.0 });
    classifier.classify(e1);
    const result = classifier.classify(e2);

    expect(result.device).toBe('trackpad');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('resets buffer after idle timeout', async () => {
    vi.useFakeTimers();
    const e1 = createWheelEvent({ deltaY: 2.5 });
    const e2 = createWheelEvent({ deltaY: 3.1 });

    classifier.classify(e1);
    classifier.classify(e2);

    vi.advanceTimersByTime(300); // Exceeds idleResetMs of 200

    const e3 = createWheelEvent({ deltaY: 4.0 });
    const result = classifier.classify(e3);

    // Should reset and have 1 sample in buffer -> return unknown
    expect(result.device).toBe('unknown');
    expect(result.confidence).toBe(0);

    vi.useRealTimers();
  });
});

describe('WheelDetector (Hybrid)', () => {
  it('falls back to heuristic classifier on first event (when windowed is unknown)', () => {
    const detector = new WheelDetector();
    const e = createWheelEvent({ deltaY: 100, deltaMode: 0 });
    const result = detector.classify(e);

    expect(result.device).toBe('mouse');
    expect(result.confidence).toBe(0.6);
  });

  it('uses windowed classifier once enough samples arrive', () => {
    const detector = new WheelDetector();
    const e1 = createWheelEvent({ deltaY: 2.5, deltaX: 1.5 });
    const e2 = createWheelEvent({ deltaY: 3.5, deltaX: 1.2 });

    detector.classify(e1);
    const r2 = detector.classify(e2);

    expect(r2.device).toBe('trackpad');
    expect(r2.confidence).toBeGreaterThan(0.5);
  });

  it('honors minConfidence option', () => {
    // Set minConfidence high (0.95), windowed returns lower confidence
    const detector = new WheelDetector(null, { minConfidence: 0.95 });
    const e1 = createWheelEvent({ deltaY: 2.5, deltaX: 1.5 });
    const e2 = createWheelEvent({ deltaY: 3.5, deltaX: 1.2 });

    detector.classify(e1);
    const r2 = detector.classify(e2);

    // Because windowed confidence < 0.95, it degenerates/falls back to heuristic
    expect(r2.reasons).toContain('fractional/pixel delta');
    expect(r2.confidence).toBe(0.5);
  });

  it('attaches to EventTarget and triggers onChange on device change', () => {
    const target = document.createElement('div');
    const onChange = vi.fn();
    const detector = new WheelDetector(target, { onChange });

    // First event: mouse
    const eMouse = createWheelEvent({ deltaY: 100 });
    target.dispatchEvent(eMouse);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ device: 'mouse' }));

    // Subsequent mouse events: device doesn't change, so no new onChange call
    target.dispatchEvent(createWheelEvent({ deltaY: 100 }));
    expect(onChange).toHaveBeenCalledTimes(1);

    detector.destroy();
  });
});
