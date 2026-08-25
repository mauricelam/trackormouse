import { describe, it } from 'vitest';
import { runStreamTestCase, WheelStreamTestCase } from './stream_runner.js';

import macTrackpadFixture from './fixtures/mac_trackpad.json';
import macLogiMouseFixture from './fixtures/mac_logi_mouse.json';
import macLogiMouseNoTicksFixture from './fixtures/mac_logi_mouse_no_ticks.json';
import macEvoluentMouseFixture from './fixtures/mac_evoluent_mouse.json';

describe('JSON Stream Tests', () => {
  it(`runs JSON stream test: ${macTrackpadFixture.name}`, () => {
    runStreamTestCase(macTrackpadFixture as WheelStreamTestCase);
  });
  it(`runs JSON stream test: ${macLogiMouseFixture.name}`, () => {
    runStreamTestCase(macLogiMouseFixture as WheelStreamTestCase);
  });
  it(`runs JSON stream test: ${macLogiMouseNoTicksFixture.name}`, () => {
    runStreamTestCase(macLogiMouseNoTicksFixture as WheelStreamTestCase);
  });
  it(`runs JSON stream test: ${macEvoluentMouseFixture.name}`, () => {
    runStreamTestCase(macEvoluentMouseFixture as WheelStreamTestCase);
  });
});
