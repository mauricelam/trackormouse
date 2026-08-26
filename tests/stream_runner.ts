import { expect } from 'vitest';
import { WheelClassifier, InputDevice } from '../src/index.js';
import { stubChromiumMacOS, stubChromiumWindows, stubGenericBrowser } from './browser_stub.js';

export interface WheelEventData {
  deltaX?: number;
  deltaY?: number;
  deltaMode?: number;
  timeStamp?: number;
}

export interface WheelStreamTestCase {
  name: string;
  platform?: 'macOS' | 'Windows';
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

export function runStreamTestCase(testCase: WheelStreamTestCase, warmUpEventsNeeded: number = 3): WheelClassifier {
  if (testCase.platform === 'macOS') {
    stubChromiumMacOS();
  } else if (testCase.platform === 'Windows') {
    stubChromiumWindows();
  } else {
    stubGenericBrowser();
  }

  const classifier = new WheelClassifier();
  for (const [i, eventData] of testCase.events.entries()) {
    const evt = createWheelEventFromData(eventData);
    classifier.addEvent(evt);
    if (i >= warmUpEventsNeeded) {
      // Assert that the device type is correctly inferred after 3 events
      const inferred = classifier.inferDeviceTypeWithReason();
      expect(inferred!!.deviceType, `Reason: ${inferred!!.reason}\n${classifier.debugString()}`).toBe(testCase.expectedDeviceType);
    }
  }

  const inferred = classifier.inferDeviceTypeWithReason();
  expect(inferred!!.deviceType, `Reason: ${inferred!!.reason}\n${classifier.debugString()}`).toBe(testCase.expectedDeviceType);
  return classifier;
}
