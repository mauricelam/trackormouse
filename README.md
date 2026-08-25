# trackormouse

A library for detecting whether the current input is from a physical mouse or trackpad based on javascript wheel events.

Since browsers do not provide a direct API signal indicating the type of pointing device, this library uses heuristics to determine that.

## Usage

```typescript
import { WheelClassifier } from 'trackormouse'

const classifier = new WheelClassifier()

window.addEventListener('wheel', (e) => {
    classifier.addEvent(e)

    const deviceType = classifier.inferDeviceType()
    console.log('Detected device type:', deviceType)
})
```

## Signals

The signals used to determine the pointing device type is exposed via the `WheelClassifier` class, which allows usages to customize the classification based on their specific needs.

For example, some use cases may want to set a minimum number of events before changing the configuration based on the inferred device type, or disable filter by horizontal scrolling.

* `deltaXEvents`: Number of events that contains non-zero delta X.
* `deltaYLooksLikeTick`: Number of events where the deltaY looks like a wheel tick. This is determined by checking deltaY against known constants per-platform that translates a traditional mouse wheel tick into pixel-deltas.
* `deltaYFractional`: Number of events where the deltaY contains non-integer values.
* `deltaModeNotPixels`: Number of events where the deltaMode is not pixels.
* `numEvents`: Total number of accumulated events.
* `peakEventsPerSec`: Peak number of events received within a 1-second window.

The default classification heuristic used by `inferDeviceType()` is as follows:

1. Any events with deltaMode != PIXEL → `'mouse'`
2. Any events with fractional deltaY → `'trackpad'`
3. Any events with non-zero deltaX → `'trackpad'`
4. Any events with deltaY that doesn't look like a tick → `'trackpad'`
5. Otherwise → `'mouse'`
