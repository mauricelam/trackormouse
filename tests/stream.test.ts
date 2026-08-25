import { describe, it } from 'vitest';
import { runStreamTestCase, WheelStreamTestCase } from './stream_runner.js';

import macMouseFixture from './fixtures/mac_mouse.json';
import macTrackpadFixture from './fixtures/mac_trackpad.json';
import winMouseFixture from './fixtures/win_mouse.json';
import winLineMouseFixture from './fixtures/win_line_mouse.json';
import winTrackpadFixture from './fixtures/win_trackpad.json';

const fixtures: WheelStreamTestCase[] = [
  macMouseFixture as WheelStreamTestCase,
  macTrackpadFixture as WheelStreamTestCase,
  winMouseFixture as WheelStreamTestCase,
  winLineMouseFixture as WheelStreamTestCase,
  winTrackpadFixture as WheelStreamTestCase,
];

describe('JSON Stream Tests', () => {
  for (const testCase of fixtures) {
    it(`runs JSON stream test: ${testCase.name}`, () => {
      runStreamTestCase(testCase);
    });
  }
});
