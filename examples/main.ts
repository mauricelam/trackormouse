import { WheelClassifier } from '../src/index.ts';

const scrollTarget = document.getElementById('scrollTarget') as HTMLElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
const autoResetCheckbox = document.getElementById('autoResetCheckbox') as HTMLInputElement;

const deviceBadge = document.getElementById('deviceBadge') as HTMLElement;
const deviceText = document.getElementById('deviceText') as HTMLElement;
const reasonsList = document.getElementById('reasonsList') as HTMLElement;

let classifier = new WheelClassifier();
let autoResetTimer: any = null;

function resetState() {
  if (autoResetTimer) {
    clearTimeout(autoResetTimer);
    autoResetTimer = null;
  }
  classifier = new WheelClassifier();
  updateOutput();
}

function scheduleAutoReset() {
  if (autoResetTimer) {
    clearTimeout(autoResetTimer);
    autoResetTimer = null;
  }
  if (autoResetCheckbox.checked) {
    autoResetTimer = setTimeout(() => {
      resetState();
    }, 3000);
  }
}

function updateOutput() {
  const device = classifier.inferDeviceType() || 'unknown';

  deviceBadge.className = `result-badge ${device}`;
  deviceText.textContent = device;

  if (classifier.numEvents > 0) {
    reasonsList.innerHTML = `
      <li>Total events: ${classifier.numEvents}</li>
      <li>Peak events/sec: ${classifier.peakEventsPerSec}</li>
      <li>Delta X events: ${classifier.deltaXEvents}</li>
      <li>Delta Y looks like tick: ${classifier.deltaYLooksLikeTick}</li>
      <li>Delta Y fractional: ${classifier.deltaYFractional}</li>
      <li>Delta mode not pixels: ${classifier.deltaModeNotPixels}</li>
    `;
  } else {
    reasonsList.innerHTML = '<li>No wheel events received yet</li>';
  }
}

function handleWheel(e: WheelEvent) {
  console.log('Wheel event', e);
  classifier.addEvent(e);
  updateOutput();
  scheduleAutoReset();
}

scrollTarget.addEventListener('wheel', handleWheel, { passive: true });

autoResetCheckbox.addEventListener('change', () => {
  if (!autoResetCheckbox.checked && autoResetTimer) {
    clearTimeout(autoResetTimer);
    autoResetTimer = null;
  } else if (autoResetCheckbox.checked && classifier.numEvents > 0) {
    scheduleAutoReset();
  }
});

resetBtn.addEventListener('click', () => {
  resetState();
});

// Initialize
updateOutput();
