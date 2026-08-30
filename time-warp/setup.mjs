const UNIT_MS = {
  seconds: 1000,
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
};

const DEFAULT_SPEED = 10;

let modContext;
let multiplier = 1;
let runningExtraTicks = false;
let lastSpeed = DEFAULT_SPEED;
let speedButton;

function speedSection() {
  return modContext.settings.section('Speed');
}

function fastForwardSection() {
  return modContext.settings.section('Fast forward');
}

function notify(message, isError) {
  if (isError) {
    game.notifications.createErrorNotification('eerieTimeWarp:msg', message);
    return;
  }
  game.notifications.createSuccessNotification(
    'eerieTimeWarp:msg',
    message,
    'assets/media/main/timer.png'
  );
}

function readMultiplier() {
  const value = speedSection().get('multiplier');
  multiplier = Number.isFinite(value) && value > 1 ? Math.floor(value) : 1;
  if (multiplier > 1) lastSpeed = multiplier;
  renderSpeedButton();
}

function renderSpeedButton() {
  if (speedButton === undefined) return;
  speedButton.classList.toggle('etw-on', multiplier > 1);
  speedButton.title = multiplier > 1 ? `Speed ${multiplier}x, click to stop` : `Speed up to ${lastSpeed}x`;
}

function toggleSpeed() {
  speedSection().set('multiplier', multiplier > 1 ? 1 : lastSpeed);
  readMultiplier();
}

function skipMilliseconds(ms) {
  const limit = Math.min(UNIT_MS.days, game.MAX_OFFLINE_TIME);

  if (ms > limit) {
    notify('The game only lets you skip 1 day at a time.', true);
    return;
  }

  game.tickTimestamp -= ms;
  game.triggerOfflineLoop();

  const hours = Math.round((ms / UNIT_MS.hours) * 10) / 10;
  notify(`Fast forwarding ${hours} hour${hours === 1 ? '' : 's'}.`, false);
}

function makeButton(text, title, onClick) {
  const button = document.createElement('button');
  button.className = 'etw-btn';
  button.type = 'button';
  button.textContent = text;
  button.title = title;
  button.addEventListener('click', onClick);
  return button;
}

/** Finds the Force Save button by its label */
function findForceSaveButton() {
  const nodes = document.querySelectorAll('button, a, .btn');
  for (const node of nodes) {
    if (node.textContent.trim().toLowerCase().includes('force save')) return node;
  }
  return null;
}

function makeBar() {
  const bar = document.createElement('div');
  bar.id = 'etw-bar';

  speedButton = makeButton('▶', '', toggleSpeed);
  const skipButton = makeButton('⏩', 'Fast forward', () => fastForward());

  bar.append(speedButton, skipButton);
  return bar;
}

function buildQuickBar(attempt = 0) {
  if (document.getElementById('etw-bar') !== null) return;

  const anchor = findForceSaveButton();

  if (anchor === null) {
    if (attempt < 10) {
      setTimeout(() => buildQuickBar(attempt + 1), 500);
      return;
    }

    // Nothing to anchor to, pin it to the screen so it is still reachable
    const bar = makeBar();
    bar.classList.add('etw-floating');
    document.body.append(bar);
    renderSpeedButton();
    return;
  }

  anchor.insertAdjacentElement('afterend', makeBar());
  renderSpeedButton();
}

function fastForward() {
  const amount = fastForwardSection().get('amount') ?? 0;
  const unit = fastForwardSection().get('unit') ?? 'hours';

  if (!Number.isFinite(amount) || amount <= 0) {
    notify('Enter an amount above 0 first.', true);
    return;
  }

  skipMilliseconds(amount * (UNIT_MS[unit] ?? UNIT_MS.hours));
}

export function setup(ctx) {
  modContext = ctx;

  ctx.patch(Game, 'tick').after(function () {
    if (runningExtraTicks || multiplier <= 1 || this.isPaused) return;
    runningExtraTicks = true;
    const wasRendering = this.enableRendering;
    this.enableRendering = false;
    try {
      this.runTicks(multiplier - 1);
    } finally {
      this.enableRendering = wasRendering;
      runningExtraTicks = false;
    }
  });

  ctx.settings.section('Speed').add({
    type: 'number',
    name: 'multiplier',
    label: 'Speed multiplier',
    hint: '1 is normal speed. Up to 50. Set back to 1 to stop.',
    min: 1,
    max: 50,
    default: 1,
    onChange: () => {
      setTimeout(readMultiplier, 0);
    },
  });

  ctx.settings.section('Fast forward').add([
    {
      type: 'number',
      name: 'amount',
      label: 'Amount',
      hint: 'Maximum 1 day per press.',
      min: 1,
      default: 1,
    },
    {
      type: 'dropdown',
      name: 'unit',
      label: 'Unit',
      color: 'secondary',
      default: 'hours',
      options: [
        { value: 'seconds', display: 'Seconds' },
        { value: 'minutes', display: 'Minutes' },
        { value: 'hours', display: 'Hours' },
        { value: 'days', display: 'Days' },
      ],
    },
    {
      type: 'button',
      name: 'go',
      label: 'Skip ahead',
      display: 'Fast forward now',
      color: 'success',
      onClick: fastForward,
    },
  ]);

  ctx.onInterfaceReady(() => {
    buildQuickBar();
    readMultiplier();
  });
}
