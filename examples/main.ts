import { WheelClassifier } from '../src/index.ts';

const scrollTarget = document.getElementById('scrollTarget') as HTMLElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
const autoResetCheckbox = document.getElementById('autoResetCheckbox') as HTMLInputElement;

const deviceBadge = document.getElementById('deviceBadge') as HTMLElement;
const deviceText = document.getElementById('deviceText') as HTMLElement;
const reasonsList = document.getElementById('reasonsList') as HTMLElement;
const rulesList = document.getElementById('rulesList') as HTMLElement;

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
  const inference = classifier.inferDeviceTypeWithReason();
  const device = inference?.deviceType || 'unknown';
  const winningReason = inference?.reason || null;

  deviceBadge.className = `result-badge ${device}`;
  deviceText.textContent = device;

  if (classifier.numEvents > 0) {
    reasonsList.innerHTML = `
      <li>Total events: ${classifier.numEvents}</li>
      <li>Peak events/sec: ${classifier.peakEventsPerSec}</li>
      <li>Delta X events: ${classifier.deltaXEvents}</li>
      <li>Delta X & Y events: ${classifier.deltaXAndYEvents}</li>
      <li>Delta Y looks like tick: ${classifier.deltaYLooksLikeTick}</li>
      <li>Delta Y fractional: ${classifier.deltaYFractional}</li>
      <li>Delta mode not pixels: ${classifier.deltaModeNotPixels}</li>
    `;

    // Definition of all inference rules evaluated by WheelClassifier
    const rules = [
      {
        id: 'deltaModeNotPixels',
        name: 'deltaModeNotPixels',
        description: 'deltaMode is DOM_DELTA_LINE (>0)',
        deviceType: 'mouse' as const,
        active: classifier.deltaModeNotPixels > 0,
      },
      {
        id: 'deltaXAndYEvents',
        name: 'deltaXAndYEvents',
        description: 'Simultaneous deltaX and deltaY (>0)',
        deviceType: 'trackpad' as const,
        active: classifier.deltaXAndYEvents > 0,
      },
      {
        id: 'deltaXEvents',
        name: 'deltaXEvents',
        description: 'Horizontal deltaX present (>0)',
        deviceType: 'trackpad' as const,
        active: classifier.deltaXEvents > 0,
      },
      {
        id: 'deltaYLooksLikeTick',
        name: 'deltaYLooksLikeTick',
        description: 'All deltaY values match wheel tick quantum (100%)',
        deviceType: 'mouse' as const,
        active: classifier.deltaYLooksLikeTick === classifier.numEvents,
      },
      {
        id: 'peakEventsPerSec',
        name: 'peakEventsPerSec',
        description: 'High frequency scroll (>9 events/sec)',
        deviceType: 'trackpad' as const,
        active: classifier.peakEventsPerSec > 9,
      },
      {
        id: 'default',
        name: 'default',
        description: 'Fallback default rule',
        deviceType: 'mouse' as const,
        active: true,
      },
    ];

    rulesList.innerHTML = rules.map(rule => {
      const isWinning = rule.id === winningReason;
      const classes = [
        'rule-item',
        `signal-${rule.deviceType}`,
        rule.active ? 'signal-active' : '',
        isWinning ? 'winning-rule' : '',
      ].filter(Boolean).join(' ');

      return `
        <div class="${classes}">
          <div class="rule-info">
            <span class="rule-name">${rule.name}</span>
            <span class="rule-desc">${rule.description}</span>
          </div>
          <div class="rule-tags">
            ${rule.active ? `<span class="rule-tag signal-badge-${rule.deviceType}">${rule.deviceType} signal</span>` : ''}
            ${isWinning ? '<span class="rule-tag winning-badge">Winning Decision</span>' : ''}
          </div>
        </div>
      `;
    }).join('');
  } else {
    reasonsList.innerHTML = '<li>No wheel events received yet</li>';
    rulesList.innerHTML = '<div class="empty-rules">No wheel events received yet</div>';
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
