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

import { isMacOS, isWindows } from "./browser";

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

// Corresponds to `kScrollbarPixelsPerCocoaTick` constant defined by Chromium
// for macOS.
// https://source.chromium.org/chromium/chromium/src/+/main:ui/events/cocoa/cocoa_event_utils.h;l=18;drc=21ee2cded24bba63af70dc1a15332a6fb2b07486
const CHROMIUM_MAC_TICK = 40;

/**
 * Classifies whether one or more wheel events are from a mouse or trackpad.
 */
export class WheelClassifier {

  /**
   * Number of events that contains non-zero delta X.
   */
  deltaXEvents: number = 0;
  /**
   * Number of events that contain both non-zero delta X and non-zero delta Y at the same time.
   */
  deltaXAndYEvents: number = 0;
  /**
   * Number of events where the deltaY looks like a wheel tick.
   */
  deltaYLooksLikeTick: number = 0;
  /**
   * Number of events where the deltaY contains non-integer values.
   */
  deltaYFractional: number = 0;
  /**
   * Number of events where the deltaMode is not pixels.
   */
  deltaModeNotPixels: number = 0;
  /**
   * Total number of accumulated events.
   */
  numEvents: number = 0;
  /**
   * Peak number of events received within a 1-second window.
   */
  peakEventsPerSec: number = 0;

  private timestamps: number[] = [];

  addEvent(e: WheelEvent) {
    this.numEvents++;

    const timestamp = e.timeStamp;
    this.timestamps.push(timestamp);
    while (this.timestamps.length > 0 && this.timestamps[0] <= timestamp - 1000) {
      this.timestamps.shift();
    }
    if (this.timestamps.length > this.peakEventsPerSec) {
      this.peakEventsPerSec = this.timestamps.length;
    }

    // Reading `deltaMode` has the side-effect on Firefox to make it turn off
    // the pixel-reporting-by-default compatibility mode.
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1689127#c2
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      this.deltaModeNotPixels++;
    }

    const dy = e.deltaY;
    const dx = e.deltaX;

    if (dx !== 0) {
      this.deltaXEvents++;
    }

    if (dx !== 0 && dy !== 0) {
      this.deltaXAndYEvents++;
    }

    if (!Number.isInteger(dy)) {
      this.deltaYFractional++;
    }

    if (isWindows() && Math.abs(dy) > 0 && Math.abs(dy) % WINDOWS_WHEEL_DELTA === 0) {
      this.deltaYLooksLikeTick++;
    } else if (isMacOS() && Math.abs(dy) > 0 && Math.abs(dy) % CHROMIUM_MAC_TICK === 0) {
      this.deltaYLooksLikeTick++;
    }
  }

  /**
   * Infers the device type from the collected features.
   * @returns The inferred device type, or null if it cannot be determined.
   */
  inferDeviceType(): InputDevice | null {
    if (this.numEvents === 0) {
      return null
    }
    if (this.deltaModeNotPixels > 0) {
      return 'mouse'
    }
    if (this.deltaXAndYEvents > 0) {
      return 'trackpad'
    }
    if (this.deltaXEvents > 0) {
      return 'trackpad'
    }
    if (this.deltaYLooksLikeTick < this.numEvents) {
      return 'trackpad'
    }
    return 'mouse'
  }

  debugString(): string {
    return `deltaXEvents: ${this.deltaXEvents}, deltaXAndYEvents: ${this.deltaXAndYEvents}, deltaYLooksLikeTick: ${this.deltaYLooksLikeTick}, deltaYFractional: ${this.deltaYFractional}, deltaModeNotPixels: ${this.deltaModeNotPixels}, numEvents: ${this.numEvents}, peakEventsPerSec: ${this.peakEventsPerSec}`
  }
}
