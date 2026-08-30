import { describe, it, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect } from 'vitest';
import { WheelClassifier, InputDevice } from '../src/index.js';
import { stubBrowserUserAgent, stubChromiumMacOS, stubChromiumWindows, stubGenericBrowser } from './browser_stub.js';

export interface WheelEventData {
  deltaX?: number;
  deltaY?: number;
  deltaMode?: number;
  timeStamp?: number;
}

export interface WheelStreamTestCase {
  name: string;
  ignore?: boolean;
  userAgent: string;
  platform: 'macOS' | 'Windows';
  events: WheelEventData[];
  expectedDeviceType: InputDevice | null;
}

export function createWheelEventFromData(data: WheelEventData): WheelEvent {
  const { timeStamp, ...wheelInit } = data;
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

// Load all JSON files in ./fixtures dynamically
const fixtures = import.meta.glob('./fixtures/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, WheelStreamTestCase>;

describe('JSON Stream Tests', () => {
  const results: Record<string, any> = {};

  for (const [filePath, testCase] of Object.entries(fixtures)) {
    it(`Test Fixture: ${testCase.name} (${filePath})`, () => {
      stubBrowserUserAgent(testCase.userAgent);

      const classifier = new WheelClassifier();
      for (const [i, eventData] of testCase.events.entries()) {
        const evt = createWheelEventFromData(eventData);
        classifier.addEvent(evt);
        if (i >= 3) {
          // Assert that the device type is correctly inferred after 3 events
          const inferred = classifier.inferDeviceTypeWithReason();
          if (!testCase.ignore) {
            expect(inferred!!.deviceType, `Step: ${i}. Reason: ${inferred!!.reason}\n${classifier.debugString()}`)
              .toBe(testCase.expectedDeviceType);
          }
        }
      }

      const inferred = classifier.inferDeviceTypeWithReason();
      if (!testCase.ignore) {
        expect(inferred!!.deviceType, `Reason: ${inferred!!.reason}\n${classifier.debugString()}`)
          .toBe(testCase.expectedDeviceType);
      }
      results[filePath] = {
        name: testCase.name,
        expectedDeviceType: testCase.expectedDeviceType,
        inferredDeviceType: inferred?.deviceType ?? null,
        reason: inferred?.reason ?? null,
        classifierState: classifier.state,
      };
    });
  }

  afterAll(() => {
    const outputPath = path.resolve(__dirname, 'fixture_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  });
});
