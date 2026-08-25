# `wheel-device-detector` — Design Document

## Problem Overview

Browsers do not provide a direct API signal indicating whether a `WheelEvent` originated from a physical mouse scroll wheel or a trackpad gesture. Detecting the input device requires inferring input device type based on indirect signals present in `WheelEvent` objects and OS/browser platform specifics:

| Signal | Mouse Scroll Wheel | Trackpad Gesture |
|---|---|---|
| `deltaMode` | Often `DOM_DELTA_LINE` (1) on Firefox/Windows | Typically `DOM_DELTA_PIXEL` (0) |
| `deltaY` Step Size | Multiples of OS/browser tick constants (e.g., 120 on Windows `WM_MOUSEHWHEEL`, 40 on macOS Chromium `kScrollbarPixelsPerCocoaTick`) | Small, variable, often fractional pixel deltas |
| `deltaX` Presence | Non-zero deltaX usually indicates horizontal wheel step or device axis | Multi-axis scrolling gestures |
| Fractional Deltas | Integer values for physical ticks | Non-integer floating point values (e.g. `2.399999...`) |

---

## Technical Context & Browser Specifics

- **Windows API (`WM_MOUSEHWHEEL`)**: Defines a standard step quantum `WHEEL_DELTA` of 120 (`WINDOWS_WHEEL_DELTA = 120`).
- **macOS / AppKit (`NSEvent.hasPreciseScrollingDeltas`)**: macOS distinguishes precise trackpad scrolling from wheel steps. Chromium maps Cocoa wheel ticks on macOS using `kScrollbarPixelsPerCocoaTick = 40` (`CHROMIUM_MAC_TICK = 40`).
- **Firefox / Gecko**: Reading `WheelEvent.deltaMode` turns off pixel-reporting compatibility mode (Bug 1689127). Line/Page modes are reported based on system scroll line settings.

---

## System Architecture

The current implementation provides feature extraction and classification logic via `WheelClassifier` along with OS platform helpers (`isMacOS`, `isWindows`).

```ts
export type InputDevice = 'mouse' | 'trackpad' | 'unknown';
```

### Platform Helpers (`src/browser.ts`)

- `isMacOS()`: Detects macOS via `navigator.userAgentData.platform` or userAgent/platform string matching (`Mac|iPhone|iPod|iPad`).
- `isWindows()`: Detects Windows via `navigator.userAgentData.platform` or userAgent/platform string matching (`Win|Windows`).

### Core Classifier (`src/index.ts`)

The `WheelClassifier` class accumulates feature counts across incoming `WheelEvent` samples and infers the device type based on evaluated heuristics.

#### Internal Counters & State

- `deltaXEvents: number` — Count of events where `deltaX !== 0`.
- `deltaYLooksLikeTick: number` — Count of events where `Math.abs(deltaY)` is a multiple of platform tick quantum (`120` on Windows or `40` on macOS).
- `deltaYFractional: number` — Count of events where `deltaY` is a non-integer value.
- `deltaModeNotPixels: number` — Count of events where `deltaMode === WheelEvent.DOM_DELTA_LINE`.
- `numEvents: number` — Total accumulated events added to classifier.
- `peakEventsPerSec: number` — Maximum event frequency observed in a 1-second sliding window.

#### API Surface

```ts
export class WheelClassifier {
  deltaXEvents: number;
  deltaYLooksLikeTick: number;
  deltaYFractional: number;
  deltaModeNotPixels: number;
  numEvents: number;
  peakEventsPerSec: number;

  addEvent(e: WheelEvent): void;
  inferDeviceType(): InputDevice | null;
  debugString(): string;
}
```

---

## Classification Heuristics Logic

When `inferDeviceType()` is called:

1. **No Data Check**: If `numEvents === 0`, returns `null`.
2. **Line Mode Check**: If `deltaModeNotPixels > 0`, infers `'mouse'`.
3. **Fractional Delta Check**: If `deltaYFractional > 0`, infers `'trackpad'`.
4. **Horizontal Axis Check**: If `deltaXEvents > 0`, infers `'trackpad'`.
5. **Event Frequency Check**: If `peakEventsPerSec > 30`, infers `'trackpad'`.
6. **Tick Step Quantum Check**: If `deltaYLooksLikeTick === numEvents`, infers `'mouse'`.
7. **Default Fallback**: Otherwise, infers `'trackpad'`.
