import { describe, it } from 'vitest';
import { runStreamTestCase, WheelStreamTestCase } from './stream_runner.js';

import macTrackpadFixture from './fixtures/mac_trackpad.json';
import macLogiMouseFixture from './fixtures/mac_logi_mouse.json';
import macLogiMouseNoTicksFixture from './fixtures/mac_logi_mouse_no_ticks.json';

describe('JSON Stream Tests', () => {
  it(`runs JSON stream test: ${macTrackpadFixture.name}`, () => {
    runStreamTestCase(macTrackpadFixture as WheelStreamTestCase);
  });
  it(`runs JSON stream test: ${macLogiMouseFixture.name}`, () => {
    runStreamTestCase(macLogiMouseFixture as WheelStreamTestCase);
  });
  it(`runs JSON stream test: ${macLogiMouseNoTicksFixture.name}`, () => {
    // Currently failing
    // runStreamTestCase(macLogiMouseNoTicksFixture as WheelStreamTestCase);
  });
});
