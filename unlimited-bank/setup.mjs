const EXTRA_SLOTS = 1000000;

let modContext;
let originalDescriptor;

function isEnabled() {
  return modContext.settings.section('General').get('enabled') !== false;
}

function applyCap() {
  if (originalDescriptor === undefined) return;

  if (!isEnabled()) {
    Object.defineProperty(Bank.prototype, 'maximumSlots', originalDescriptor);
    return;
  }

  const original = originalDescriptor.get;

  Object.defineProperty(Bank.prototype, 'maximumSlots', {
    configurable: true,
    enumerable: originalDescriptor.enumerable,
    get() {
      return original.call(this) + EXTRA_SLOTS;
    },
  });
}

export function setup(ctx) {
  modContext = ctx;

  originalDescriptor = Object.getOwnPropertyDescriptor(Bank.prototype, 'maximumSlots');

  ctx.settings.section('General').add({
    type: 'switch',
    name: 'enabled',
    label: 'Enabled',
    hint: 'Removes the bank slot limit. Turn off and reload to go back to normal.',
    default: true,
    onChange: () => {
      setTimeout(applyCap, 0);
    },
  });

  applyCap();
}
