let modContext;

function isEnabled() {
  return modContext.settings.section('General').get('enabled') !== false;
}

function hideOwned() {
  return modContext.settings.section('General').get('hide-owned') === true;
}

/** True when the player meets the requirements and holds the costs for this purchase */
function canBuy(purchase) {
  if (!game.checkRequirements(purchase.purchaseRequirements, false)) return false;

  const quantity = game.shop.capPurchaseQuantity(purchase, game.shop.buyQuantity);
  if (quantity < 1) return false;

  return game.shop.getPurchaseCosts(purchase, quantity).checkIfOwned();
}

/** Total held across the bank and every equipment set */
function ownedCount(item) {
  let total = game.bank.getQty(item);

  game.combat.player.equipmentSets.forEach((set) => {
    total += set.equipment.getQuantityOfItem(item);
  });

  return total;
}

/** Adds or updates the "In bank" line on a shop item */
function renderOwned(tabItem, purchase) {
  const parent = tabItem.item?.mediaBody ?? tabItem.container;
  if (parent === undefined || parent === null) return;

  const items = purchase.contains?.items ?? [];
  const text = items
    .map(({ item }) => `${item.name}: ${numberWithCommas(ownedCount(item))}`)
    .join(', ');

  let line = parent.querySelector('.eerie-shop-owned');

  if (text === '') {
    line?.remove();
    return;
  }

  if (line === null) {
    line = document.createElement('div');
    line.className = 'eerie-shop-owned font-size-sm text-info';
    parent.append(line);
  }

  line.textContent = `In bank: ${text}`;
}

/** True when every item this purchase gives is already in the bank or on an equipment set */
function alreadyOwned(purchase) {
  const items = purchase.contains?.items ?? [];
  if (items.length === 0) return false;

  return items.every(({ item }) => ownedCount(item) > 0);
}

function filterTab(tabMenu) {
  const hideUnaffordable = isEnabled();
  const skipOwned = hideOwned();

  tabMenu.items.forEach((tabItem, purchase) => {
    const container = tabItem.container;
    if (container === undefined) return;

    // Leave anything the game already hid alone
    if (container.dataset.eerieShopFilter !== '1' && container.classList.contains('d-none')) return;

    const hide =
      (hideUnaffordable && !canBuy(purchase)) || (skipOwned && alreadyOwned(purchase));
    container.classList.toggle('d-none', hide);
    container.dataset.eerieShopFilter = hide ? '1' : '0';

    if (!hide) renderOwned(tabItem, purchase);
  });

  buildShopToggles(tabMenu);
  renderToggles();
}

let toggleButtons = [];

function renderToggles() {
  toggleButtons.forEach(({ button, on }) => {
    const active = on();
    button.classList.toggle('esf-on', active);
  });
}

function setSetting(name, value) {
  modContext.settings.section('General').set(name, value);
  renderToggles();
  queueShopRender();
}

function makeToggle(label, isOn, onClick) {
  const button = document.createElement('button');
  button.className = 'esf-btn';
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  toggleButtons.push({ button, on: isOn });
  return button;
}

/** Puts the same toggles as Mod Settings above the shop categories */
function buildShopToggles(tabMenu) {
  if (document.getElementById('esf-bar') !== null) return;

  const parent = tabMenu.parent;
  if (parent === undefined || parent === null) return;

  const bar = document.createElement('div');
  bar.id = 'esf-bar';

  bar.append(
    makeToggle('Only what I can buy', isEnabled, () => setSetting('enabled', !isEnabled())),
    makeToggle('Hide what I own', hideOwned, () => setSetting('hide-owned', !hideOwned()))
  );

  parent.insertAdjacentElement('afterbegin', bar);
  renderToggles();
}

function queueShopRender() {
  setTimeout(() => {
    game.shop.renderQueue.upgrades = true;
    game.shop.renderQueue.costs = true;
    game.shop.renderQueue.requirements = true;
  }, 0);
}

export function setup(ctx) {
  modContext = ctx;

  ctx.settings.section('General').add({
    type: 'switch',
    name: 'enabled',
    label: 'Enabled',
    hint: 'Hide shop items you cannot buy right now.',
    default: true,
    onChange: queueShopRender,
  });

  ctx.settings.section('General').add({
    type: 'switch',
    name: 'hide-owned',
    label: 'Hide what I already own',
    hint: 'Also hide items you already have in the bank or on an equipment set.',
    default: false,
    onChange: queueShopRender,
  });

  ['updateItemSelection', 'updatePurchaseCosts', 'updatePurchaseRequirements'].forEach((method) => {
    ctx.patch(ShopTabMenu, method).after(function () {
      filterTab(this);
    });
  });
}
