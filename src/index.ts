// Known information about wheel event handling:
// * Windows API defines the constant WHEEL_DELTA as 120.
//   https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-mousehwheel
// * Mac has `NSEvent.hasPreciseScrollingDeltas`
//   https://developer.apple.com/documentation/appkit/nsevent/hasprecisescrollingdeltas
// * Blink / Chromium
//   * "Almost always fire wheel events as DOM_DELTA_PIXEL".
//     https://github.com/w3c/pointerevents/issues/592
//   * On Mac, the scaling from wheel-tick to pixels is done via the
//     `kScrollbarPixelsPerCocoaTick = 40` constant.
//     https://source.chromium.org/chromium/chromium/src/+/main:ui/events/cocoa/cocoa_event_utils.h;l=18;drc=21ee2cded24bba63af70dc1a15332a6fb2b07486
//   * Empirically the value 4.000244140625 shows up a lot for mice on Mac. This
//     is que to a quirk of how NSEvent stores the deltaY of 0.1 in a
//     fixed-point Q16.16 field, which is then scaled up by 40 by Chromium.
// * Gecko / Firefox
//   * On Windows reports deltaMode uses LINE / PAGE for both mice and
//     trackpads, depending on `SPI_GETWHEELSCROLLLINES`.
//   * On Mac returns either DOM_DELTA_PIXEL or DOM_DELTA_LINE depending on
//     `NSEvent.hasPreciseScrollingDeltas`, which is per-device.
//     https://searchfox.org/firefox-main/source/widget/cocoa/nsCocoaWindow.mm#2771
//   * In Firefox 88 or above, delta values are reported in pixels if
//     `WheelEvent.deltaMode` is not read.
//     https://bugzilla.mozilla.org/show_bug.cgi?id=1689127
//   * TODO: Figure out how this translation happens, whether it has a fixed
//     scaling amount similar to `kScrollbarPixelsPerCocoaTick` in Blink.

import { isMacOS, isWebkitDescendant, isWindows } from "./browser";

/**
 * Represents the detected input device type.
 * - `'mouse'`: Mouse scroll wheel
 * - `'trackpad'`: Trackpad touch gesture
 * - `'unknown'`: Unclassified input (e.g. before sufficient samples arrive)
 */
export type InputDevice = 'mouse' | 'trackpad' | 'unknown';

// On Windows, there are no APIs for reporting whether a device is "precise" or
// "smooth" scrolling, but old tick-based mouse wheels report a delta that is
// scaled by this constant value.
// https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-mousehwheel
const WINDOWS_WHEEL_DELTA = 120;

// Empirically the value 4.000244140625 shows up a lot for mice on Mac. This is
// due to a quirk of how NSEvent stores the deltaY of 0.1 in a fixed-point
// Q16.16 field, which is then scaled up by 40 by Chromium.
//
// MacOS also accelerates the scroll, so values won't be exact multiples of this.
const MAC_WHEEL_TICK_VALUE = 4.000244140625;

// Corresponds to `kScrollbarPixelsPerCocoaTick` constant defined by Chromium
// for macOS.
// https://source.chromium.org/chromium/chromium/src/+/main:ui/events/cocoa/cocoa_event_utils.h;l=18;drc=21ee2cded24bba63af70dc1a15332a6fb2b07486
const CHROMIUM_MAC_TICK = 40;

function gcd(a: number, b: number): number {
  if (b === 0) {
    return Math.abs(a);
  }
  return gcd(b, a % b);
}

export interface ClassifierState {
  /**
   * Number of events that contains non-zero delta X.
   */
  deltaXEvents: number;
  /**
   * Number of events that contain both non-zero delta X and non-zero delta Y at the same time.
   */
  deltaXAndYEvents: number;
  /**
   * Number of events where the deltaY looks like a wheel tick.
   */
  deltaYLooksLikeTick: number;
  /**
   * Number of events where the deltaY contains non-integer values.
   */
  deltaYFractional: number;
  /**
   * Number of events where the deltaMode is not pixels.
   */
  deltaModeNotPixels: number;
  /**
   * Total number of accumulated events.
   */
  numEvents: number;
  /**
   * Peak number of events received within a 1-second window.
   */
  peakEventsPerSec: number;
  /**
   * Estimated tick size based on the events, assuming no acceleration curve is applied.
   */
  estimatedTickSize: number;
  /**
   * Minimum non-zero deltaY seen in the events.
   */
  minimumDeltaY: number;
}

/**
 * Classifies whether one or more wheel events are from a mouse or trackpad.
 */
export class WheelClassifier {

  state: ClassifierState = {
    deltaXEvents: 0,
    deltaXAndYEvents: 0,
    deltaYLooksLikeTick: 0,
    deltaYFractional: 0,
    deltaModeNotPixels: 0,
    numEvents: 0,
    peakEventsPerSec: 0,
    estimatedTickSize: 0,
    minimumDeltaY: 0,
  };

  private timestamps: number[] = [];

  addEvent(e: WheelEvent) {
    this.state.numEvents++;

    const timestamp = e.timeStamp;
    this.timestamps.push(timestamp);
    while (this.timestamps.length > 0 && this.timestamps[0] <= timestamp - 1000) {
      this.timestamps.shift();
    }
    if (this.timestamps.length > this.state.peakEventsPerSec) {
      this.state.peakEventsPerSec = this.timestamps.length;
    }

    // Reading `deltaMode` has the side-effect on Firefox to make it turn off
    // the pixel-reporting-by-default compatibility mode.
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1689127#c2
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      this.state.deltaModeNotPixels++;
    }

    const dy = e.deltaY;
    const dx = e.deltaX;

    if (dx !== 0) {
      this.state.deltaXEvents++;
    }

    if (dx !== 0 && dy !== 0) {
      this.state.deltaXAndYEvents++;
    }

    if (!Number.isInteger(dy)) {
      this.state.deltaYFractional++;
    }

    if (isWindows() && Math.abs(dy) > 0) {
      if (isWebkitDescendant()) {
        const div = Math.abs(dy) / (100 / 3);
        if (Math.abs(Math.round(div) - div) < 1e-6) {
          this.state.deltaYLooksLikeTick++;
        }
      } else {
        if (Math.abs(dy) % WINDOWS_WHEEL_DELTA === 0) {
          this.state.deltaYLooksLikeTick++;
        }
      }
    } else if (isMacOS() && Math.abs(dy) === MAC_WHEEL_TICK_VALUE) {
      this.state.deltaYLooksLikeTick++;
    }

    if (this.state.estimatedTickSize === 0) {
      this.state.estimatedTickSize = Math.abs(dy);
    } else {
      this.state.estimatedTickSize = gcd(Math.abs(dy), this.state.estimatedTickSize);
    }

    if (dy !== 0) {
      this.state.minimumDeltaY = this.state.minimumDeltaY > 0 ? Math.min(this.state.minimumDeltaY, Math.abs(dy)) : Math.abs(dy);
    }
  }

  /**
   * Infers the device type from the collected features.
   * @returns The inferred device type, or null if it cannot be determined.
   */
  inferDeviceType(): InputDevice | null {
    return this.inferDeviceTypeWithReason()?.deviceType || null
  }

  inferDeviceTypeWithReason(): { deviceType: InputDevice; reason: string } | null {
    if (this.state.numEvents === 0) {
      return null
    }
    if (this.state.deltaModeNotPixels > 0) {
      return { deviceType: 'mouse', reason: 'deltaModeNotPixels' }
    }
    if (this.state.deltaXAndYEvents > 0) {
      return { deviceType: 'trackpad', reason: 'deltaXAndYEvents' }
    }
    if (this.state.deltaXEvents > 0) {
      return { deviceType: 'trackpad', reason: 'deltaXEvents' }
    }
    if (this.state.deltaYLooksLikeTick === this.state.numEvents) {
      return { deviceType: 'mouse', reason: 'deltaYLooksLikeTick' }
    }
    if (isMacOS() && this.state.deltaYLooksLikeTick / this.state.numEvents > 0.1) {
      return { deviceType: 'mouse', reason: 'deltaYLooksLikeTickMac' }
    }
    if (isMacOS() && this.state.peakEventsPerSec <= 9) {
      // Macs send trackpad scroll events at 60fps
      return { deviceType: 'mouse', reason: 'peakEventsPerSec' }
    }
    if (this.state.numEvents > 3 && this.state.estimatedTickSize > 66) {
      // In Chromium, the "line height" used for scrolling is 100/3
      // In Firefox, it's computed from the actual line height which is
      // typically around 15-30px.
      // If the tick size is more than 2 lines, it's likely reported
      // at the line level by the OS instead of at the pixel level, indicating
      // that it's a mouse.
      return { deviceType: 'mouse', reason: 'estimatedTickSize' }
    }
    if (isMacOS() && this.state.minimumDeltaY > 8) {
      return { deviceType: 'mouse', reason: 'minimumDeltaY' }
    }
    return { deviceType: 'trackpad', reason: 'default' }
  }

  debugString(): string {
    let str = ''
    for (const key in this.state) {
      str += `  ${key}: ${this.state[key as keyof ClassifierState]}\n`
    }
    return str
  }
}
