# `wheel-device-detector` — Design Document

## The problem

Browsers give no first-class signal for "was this `wheel` event a mouse wheel or a
trackpad gesture." Everything we can do is inference from indirect signals on the
`WheelEvent`:

| Signal | What it tends to look like on a mouse | What it tends to look like on a trackpad |
|---|---|---|
| `deltaMode` | Often `DOM_DELTA_LINE` (1) — especially Firefox/Windows | Almost always `DOM_DELTA_PIXEL` (0) |
| `deltaY` / `deltaX` magnitude | Large, fixed steps (multiples of ~100 or ~120 on Windows "precision" mice) | Small, variable, often fractional (`-2.399999...`) |
| Event cadence | Discrete "notches" — sparse events, often >50ms apart | Dense stream of events, often <16ms apart during a gesture |
| `deltaX` presence | Usually 0 unless a horizontal-scroll wheel | Frequently nonzero (two-axis gesture) |
| `ctrlKey` + wheel | Rare (only if user holds Ctrl) | Synthesized by the OS for pinch-zoom gestures |
| Start/stop shape | Starts instantly at full magnitude | Often ramps up/down (inertial scrolling) |

None of these is reliable alone — precision mice defeat the `deltaMode` signal,
trackpad drivers on some platforms round to integers, and Safari/Chrome/Firefox
all normalize differently. So the real design question is **how many signals to
combine, and whether to look at a single event or a stream of events**.

Below are four designs, from simplest to most robust, followed by a
recommendation.

---

## Shared type surface

All four options can share the same public types, so consumers can swap
implementations without changing call sites.

```ts
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
```

---

## Option A — Stateless single-event heuristic

Classify each `wheel` event in isolation using `deltaMode` + integer/step checks.
No memory, no timers.

```ts
export class HeuristicClassifier implements WheelClassifier {
  classify(e: WheelEvent): WheelClassification {
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
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
```

**API shape:**

```ts
const classifier = new HeuristicClassifier();
el.addEventListener('wheel', (e) => {
  const { device } = classifier.classify(e);
});
```

**Pros**
- Trivial to implement, zero state, zero memory overhead.
- Synchronous, per-event answer — good when you need a decision on the *first*
  event (e.g. deciding whether to start a zoom gesture immediately).
- Easy to unit test (pure function of one event).

**Cons**
- Fragile: modern "precision" mice and some mouse drivers report pixel deltas
  too, so the integer-step check misses them.
- No use of timing/cadence, which is actually one of the strongest signals.
- Flip-flops event to event — a single misclassified event changes the answer,
  which is bad for UI that shouldn't jitter (e.g. toggling a "trackpad mode" UI
  affordance).

---

## Option B — Stateful windowed (statistical) classifier

Buffer the last *N* events (or events within the current gesture, reset after
an idle gap) and classify based on aggregate statistics: delta variance,
fraction of non-integer deltas, and inter-event timing.

```ts
interface WheelSample {
  t: number;
  dx: number;
  dy: number;
  deltaMode: number;
}

export interface WindowedClassifierOptions {
  windowSize?: number;      // default 8
  idleResetMs?: number;     // default 400 — gap that starts a new "gesture"
}

export class WindowedClassifier implements WheelClassifier {
  private buffer: WheelSample[] = [];
  private readonly windowSize: number;
  private readonly idleResetMs: number;

  constructor(opts: WindowedClassifierOptions = {}) {
    this.windowSize = opts.windowSize ?? 8;
    this.idleResetMs = opts.idleResetMs ?? 400;
  }

  reset(): void {
    this.buffer = [];
  }

  classify(e: WheelEvent): WheelClassification {
    const now = performance.now();
    const last = this.buffer[this.buffer.length - 1];
    if (last && now - last.t > this.idleResetMs) this.reset();

    this.buffer.push({ t: now, dx: e.deltaX, dy: e.deltaY, deltaMode: e.deltaMode });
    if (this.buffer.length > this.windowSize) this.buffer.shift();

    return this.score();
  }

  private score(): WheelClassification {
    const n = this.buffer.length;
    if (n < 2) {
      // Not enough data yet — fall back to a single-event heuristic.
      return { device: 'unknown', confidence: 0 };
    }

    const fractionalCount = this.buffer.filter(
      (s) => !Number.isInteger(s.dy) || !Number.isInteger(s.dx)
    ).length;
    const twoAxisCount = this.buffer.filter((s) => s.dx !== 0 && s.dy !== 0).length;

    const intervals = this.buffer.slice(1).map((s, i) => s.t - this.buffer[i].t);
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    let trackpadScore = 0;
    if (fractionalCount / n > 0.3) trackpadScore += 0.4;
    if (twoAxisCount / n > 0.2) trackpadScore += 0.2;
    if (avgInterval < 20) trackpadScore += 0.3;
    if (this.buffer.some((s) => s.deltaMode === WheelEvent.DOM_DELTA_LINE)) {
      trackpadScore -= 0.5;
    }

    const device: InputDevice = trackpadScore > 0.3 ? 'trackpad' : 'mouse';
    return {
      device,
      confidence: Math.min(1, Math.abs(trackpadScore - 0.3) + 0.5),
      reasons: [`fractional=${fractionalCount}/${n}`, `avgInterval=${avgInterval.toFixed(1)}ms`],
    };
  }
}
```

**Pros**
- Uses cadence and multi-axis behavior — the strongest real-world signals —
  not just a single event's shape.
- More stable output: a single odd event doesn't flip the classification.
- Naturally resets between distinct scroll gestures, so it adapts if a user
  switches input devices mid-session (e.g. laptop trackpad + external mouse).

**Cons**
- Needs a few events (typically 2–4) before it's confident — there's an
  inherent "warm-up" lag, which matters if you need a decision on `wheel` #1.
- More state to manage and reset correctly (per-element vs. global, idle
  timeout tuning).
- Still heuristic — tuning the score thresholds is empirical and can drift
  across browser/OS combinations; needs real-device testing, not just review.

---

## Option C — Hybrid: instant heuristic + converging confidence (recommended)

Combine A and B: answer immediately using the Option A heuristic (so the
consumer never gets `'unknown'`), then let the Option B windowed analysis
*revise* that answer as more events arrive, emitting updates via a callback
rather than only a pull-based `classify()`.

```ts
export interface WheelDetectorOptions extends WindowedClassifierOptions {
  onChange?: (result: WheelClassification) => void;
}

export class WheelDetector {
  private readonly fast = new HeuristicClassifier();
  private readonly windowed: WindowedClassifier;
  private last?: InputDevice;
  private readonly onChange?: (r: WheelClassification) => void;

  constructor(private el: EventTarget, opts: WheelDetectorOptions = {}) {
    this.windowed = new WindowedClassifier(opts);
    this.onChange = opts.onChange;
    this.el.addEventListener('wheel', this.handleWheel as EventListener, { passive: true });
  }

  private handleWheel = (e: WheelEvent): void => {
    const windowedResult = this.windowed.classify(e);
    const result =
      windowedResult.device === 'unknown' ? this.fast.classify(e) : windowedResult;

    if (result.device !== this.last) {
      this.last = result.device;
      this.onChange?.(result);
    }
  };

  destroy(): void {
    this.el.removeEventListener('wheel', this.handleWheel as EventListener);
  }
}
```

**Usage:**

```ts
const detector = new WheelDetector(el, {
  onChange: ({ device, confidence }) => {
    console.log(`Now scrolling with a ${device} (${confidence.toFixed(2)})`);
  },
});
```

**Pros**
- No "unknown" gap — there's always an answer, and it only gets more accurate.
- `onChange` fires only when the *classification* changes, not on every event,
  so it's cheap to hook into UI (e.g. swap zoom sensitivity, show a hint).
- Reasonable default for most product use cases (zoom/pan tools, custom
  scroll implementations, gesture-aware canvases).

**Cons**
- Most complex of the three to implement and test correctly (two classifiers,
  a reconciliation rule, change-detection on top).
- The "first answer might later be revised" behavior is a footgun for
  consumers who assume `classify()` results are final — needs clear docs and
  a `confidence` field they're expected to actually check.
- Still fundamentally heuristic-on-heuristic; doesn't fix the underlying
  ambiguity, just manages it better.

---

## Option D — Pluggable strategy architecture

Instead of picking one algorithm, expose a `WheelClassifier` interface (as
defined above) and let `WheelDetector` accept any implementation. Ship A and B
as built-ins, but let consumers supply their own (e.g. one that also factors
in `navigator.userAgentData` platform hints, or one tuned from telemetry).

```ts
export class WheelDetector {
  constructor(
    private el: EventTarget,
    private classifier: WheelClassifier,
    private onChange?: (r: WheelClassification) => void
  ) {
    el.addEventListener('wheel', this.handleWheel as EventListener, { passive: true });
  }
  // ...same handleWheel/destroy as Option C, delegating to this.classifier
}

// Consumer chooses / composes:
const detector = new WheelDetector(el, new WindowedClassifier({ windowSize: 12 }));
```

This isn't really a competing detection algorithm — it's an architectural
choice layered on top of A/B/C.

**Pros**
- Testable in isolation: swap in a fake/deterministic classifier in unit
  tests without simulating real wheel event timing.
- Lets consumers tune or replace behavior per-platform without forking the
  library (e.g. a stricter classifier for a design tool vs. a looser one for
  a marketing site's parallax effect).
- Keeps the library's core (`WheelDetector`) small and stable even as
  detection heuristics evolve — you can ship new classifiers as minor
  versions.

**Cons**
- Extra abstraction for consumers who just want "give me mouse or trackpad" —
  slightly more to learn (interface + which built-in to pick).
- Risk of the library shipping several classifiers that all drift out of sync
  with real-world browser behavior if not tested against actual devices.

---

## Comparison summary

| | A: Heuristic | B: Windowed | C: Hybrid | D: Pluggable |
|---|---|---|---|---|
| First-event answer | ✅ instant | ❌ needs warm-up | ✅ instant, revises | depends on chosen strategy |
| Accuracy on real devices | Low–medium | Medium–high | Medium–high | Depends on strategy |
| Stability (no jitter) | Low | High | High | Depends on strategy |
| Implementation complexity | Trivial | Moderate | Higher | Moderate (+ interface design) |
| Good for | Cheap first guess, tests | Steady gesture classification | General-purpose library default | Teams that need to customize/tune |

## Recommendation

Implement options A, B, and C, but leave options A and B as internal implementation details for the hybrid option C.
Don't implement option D.

Allow clients to configure the minimum confidence (minimum confidence of zero will degenerate into option A).

1. **Test against real hardware**, not synthetic events — Chrome, Firefox,
   and Safari all normalize `deltaMode`/`deltaY` differently, and Windows
   "precision touchpads" vs. older PS/2-style trackpads vs. Apple trackpads
   vs. Magic Mouse all behave differently.
2. **Expose `confidence`, don't hide it.** Any consumer building something
   where a misclassification is costly (e.g. gating a destructive zoom
   action) should be able to see how sure the library is, not just get a
   binary label.
