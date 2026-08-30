const NO_TAB = -1;
const MAX_TAB_OPTIONS = 12;

let modContext;
function generalSection() {
  return modContext.settings.section('General');
}

function tabSetting(name) {
  const value = generalSection().get(name);
  return Number.isFinite(value) ? value : NO_TAB;
}

/** The tab an item should live in, or NO_TAB to leave it alone */
function targetTabFor(bankItem, gearTab, otherTab) {
  return bankItem.item instanceof EquipmentItem ? gearTab : otherTab;
}

/**
 * Moves every item into the tab chosen for its kind.
 * Each move shifts the positions of other items, so one item is moved at a
 * time and its tab and position are read fresh right before the move.
 */
function sortIntoTabs() {
  const gearTab = tabSetting('gear-tab');
  const otherTab = tabSetting('other-tab');
  if (gearTab === NO_TAB && otherTab === NO_TAB) return;

  const bank = game.bank;
  const lastTab = bank.tabCount - 1;
  let moved = 0;
  let guard = 0;
  const limit = bank.items.size * 2 + 10;

  for (;;) {
    guard += 1;
    if (guard > limit) break;

    let next;
    for (const bankItem of bank.items.values()) {
      const target = targetTabFor(bankItem, gearTab, otherTab);
      if (target === NO_TAB || target > lastTab) continue;
      if (bankItem.tab === target) continue;
      next = { bankItem, target };
      break;
    }

    if (next === undefined) break;

    bank.moveItemToNewTab(next.bankItem.tab, next.target, next.bankItem.tabPosition);
    moved += 1;
  }

  if (moved === 0) {
    game.notifications.createErrorNotification(
      'eerieBankGearFilter:sort',
      'Nothing to move. Check the tabs you picked exist.'
    );
    return;
  }

  game.notifications.createSuccessNotification(
    'eerieBankGearFilter:sort',
    `Moved ${moved} item${moved === 1 ? '' : 's'}.`,
    'assets/media/main/bank_header.png'
  );
}

function tabOptions() {
  const options = [{ value: NO_TAB, display: 'Do not move' }];
  for (let index = 0; index < MAX_TAB_OPTIONS; index += 1) {
    options.push({ value: index, display: `Tab ${index + 1}` });
  }
  return options;
}

export function setup(ctx) {
  modContext = ctx;

  ctx.settings.section('General').add([
    {
      type: 'dropdown',
      name: 'gear-tab',
      label: 'Equippable gear goes to',
      color: 'secondary',
      default: NO_TAB,
      options: tabOptions(),
    },
    {
      type: 'dropdown',
      name: 'other-tab',
      label: 'Everything else goes to',
      color: 'secondary',
      default: NO_TAB,
      options: tabOptions(),
    },
    {
      type: 'button',
      name: 'sort-now',
      label: 'Sort the bank',
      display: 'Sort now',
      color: 'success',
      onClick: sortIntoTabs,
    },
  ]);

}
