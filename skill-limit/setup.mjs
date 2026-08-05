const STORAGE_KEY = 'targets';

const MODE_ACTIONS = 0;
const MODE_ITEMS = 1;

const WOODCUTTING_ID = 'melvorD:Woodcutting';
const FISHING_ID = 'melvorD:Fishing';
const FIREMAKING_ID = 'melvorD:Firemaking';
const COOKING_ID = 'melvorD:Cooking';
const MINING_ID = 'melvorD:Mining';
const THIEVING_ID = 'melvorD:Thieving';
const HARVESTING_ID = 'melvorItA:Harvesting';
const ARCHAEOLOGY_ID = 'melvorAoD:Archaeology';

/** Skills that place a bar on each of their own cards instead of one for the whole skill */
const PER_ACTION_SKILLS = new Set([
  WOODCUTTING_ID,
  FISHING_ID,
  COOKING_ID,
  MINING_ID,
  THIEVING_ID,
  HARVESTING_ID,
  ARCHAEOLOGY_ID,
]);

/** targetID -> { amount, enabled, mode }. A skill id, or the id of a tree, area, rock, vein and so on. */
const targets = new Map();
/** targetID -> { actions, items } counted since the target was last reset */
const counts = new Map();
/** targetID -> { input, actionsButton, itemsButton, toggleButton, progress } */
const panels = new Map();
/** skillID -> Set of targetIDs belonging to that skill */
const skillTargets = new Map();
/** skillID -> the targetID of the most recent action */
const lastTargetID = new Map();

let modContext;

function getTarget(targetID) {
  let target = targets.get(targetID);
  if (target === undefined) {
    target = { amount: 0, enabled: false, mode: MODE_ACTIONS };
    targets.set(targetID, target);
  }
  return target;
}

function getCount(targetID) {
  let count = counts.get(targetID);
  if (count === undefined) {
    count = { actions: 0, items: 0 };
    counts.set(targetID, count);
  }
  return count;
}

function resetCount(targetID) {
  counts.set(targetID, { actions: 0, items: 0 });
}

function isArmed(target) {
  return target.enabled && target.amount > 0;
}

function currentCount(targetID, target) {
  const count = getCount(targetID);
  return target.mode === MODE_ITEMS ? count.items : count.actions;
}

function registerTarget(skillID, targetID) {
  let owned = skillTargets.get(skillID);
  if (owned === undefined) {
    owned = new Set();
    skillTargets.set(skillID, owned);
  }
  owned.add(targetID);
}

function loadTargets() {
  const saved = modContext.characterStorage.getItem(STORAGE_KEY);
  if (saved === undefined) return;
  Object.entries(saved).forEach(([targetID, value]) => {
    targets.set(targetID, {
      amount: value[0],
      enabled: value[1] === 1,
      mode: value[2] === MODE_ITEMS ? MODE_ITEMS : MODE_ACTIONS,
    });
  });
}

function saveTargets() {
  const out = {};
  targets.forEach((target, targetID) => {
    if (target.amount > 0) out[targetID] = [target.amount, target.enabled ? 1 : 0, target.mode];
  });
  modContext.characterStorage.setItem(STORAGE_KEY, out);
}

function renderPanel(targetID) {
  const panel = panels.get(targetID);
  if (panel === undefined) return;

  const target = getTarget(targetID);
  if (document.activeElement !== panel.input) {
    panel.input.value = target.amount > 0 ? String(target.amount) : '';
  }

  panel.actionsButton.classList.toggle('eal-selected', target.mode === MODE_ACTIONS);
  panel.itemsButton.classList.toggle('eal-selected', target.mode === MODE_ITEMS);

  panel.toggleButton.textContent = target.enabled ? 'On' : 'Off';
  panel.toggleButton.classList.toggle('eal-on', target.enabled);

  const unit = target.mode === MODE_ITEMS ? 'items' : 'actions';
  panel.progress.textContent = isArmed(target)
    ? `${currentCount(targetID, target)} / ${target.amount} ${unit}`
    : '';
}

function makeButton(text) {
  const button = document.createElement('button');
  button.className = 'eal-btn';
  button.type = 'button';
  button.textContent = text;
  return button;
}

function makeBar(skillID, targetID, extraClass) {
  const bar = document.createElement('div');
  bar.className = extraClass === undefined ? 'eal-bar' : `eal-bar ${extraClass}`;

  const label = document.createElement('span');
  label.className = 'eal-label';
  label.textContent = 'Stop after';

  const input = document.createElement('input');
  input.className = 'eal-input';
  input.type = 'number';
  input.min = '1';
  input.step = '1';
  input.placeholder = 'Amount';

  const actionsButton = makeButton('Actions');
  const itemsButton = makeButton('Items');
  const toggleButton = makeButton('Off');

  const progress = document.createElement('span');
  progress.className = 'eal-progress';

  bar.append(label, input, actionsButton, itemsButton, toggleButton, progress);
  panels.set(targetID, { input, actionsButton, itemsButton, toggleButton, progress });
  registerTarget(skillID, targetID);

  input.addEventListener('input', () => {
    const target = getTarget(targetID);
    const amount = Math.floor(Number(input.value));
    target.amount = Number.isFinite(amount) && amount > 0 ? amount : 0;
    saveTargets();
    renderPanel(targetID);
  });

  const setMode = (mode) => {
    getTarget(targetID).mode = mode;
    resetCount(targetID);
    saveTargets();
    renderPanel(targetID);
  };

  actionsButton.addEventListener('click', () => setMode(MODE_ACTIONS));
  itemsButton.addEventListener('click', () => setMode(MODE_ITEMS));

  toggleButton.addEventListener('click', () => {
    const target = getTarget(targetID);
    target.enabled = !target.enabled;
    resetCount(targetID);
    saveTargets();
    renderPanel(targetID);
  });

  renderPanel(targetID);
  return bar;
}

/** Bar for a clickable card. Clicks inside must not select the card. */
function makeCardBar(skillID, targetID) {
  const bar = makeBar(skillID, targetID, 'eal-bar-card');
  ['click', 'mousedown', 'touchstart'].forEach((type) => {
    bar.addEventListener(type, (event) => event.stopPropagation());
  });
  return bar;
}

function notifyStopped(targetID, name, media) {
  const target = getTarget(targetID);
  const unit = target.mode === MODE_ITEMS ? 'items' : 'actions';
  game.notifications.createInfoNotification(
    `eerieSkillLimit:${targetID}`,
    `${name} stopped at ${currentCount(targetID, target)} of ${target.amount} ${unit}.`,
    media
  );
}

/* ---------- placement ---------- */

/** The single button that starts the skill, when the skill has one */
function getStartButton(skill) {
  try {
    if (skill.id === FIREMAKING_ID) {
      return document.querySelector('firemaking-log-menu')?.burnButton ?? undefined;
    }
    if (skill instanceof ArtisanSkill) {
      return skill.menu?.createButton ?? undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function buildSkillPanel(skill) {
  const bar = makeBar(skill.id, skill.id);

  const startButton = getStartButton(skill);
  if (startButton !== undefined) {
    bar.classList.add('eal-bar-inline');
    startButton.insertAdjacentElement('beforebegin', bar);
    return;
  }

  const pages = game.getPagesForSkill(skill);
  if (pages === undefined || pages.length === 0) return;
  const page = pages.find((p) => p.action === skill) ?? pages[0];
  const container = document.getElementById(page.containerID);
  if (container === null) return;
  container.insertAdjacentElement('afterbegin', bar);
}

/** Puts a bar inside each clickable card of a skill */
function buildCardPanels(skillID, tagName, getAction, getCard) {
  document.querySelectorAll(tagName).forEach((element) => {
    const action = getAction(element);
    if (action === undefined || action === null || panels.has(action.id)) return;

    const card = getCard(element);
    if (card === undefined || card === null) return;

    card.insertAdjacentElement('beforeend', makeCardBar(skillID, action.id));
  });
}

/** Puts a bar above the start button of each panel of a skill */
function buildButtonPanels(skillID, tagName, getAction, getButton) {
  document.querySelectorAll(tagName).forEach((element) => {
    const action = getAction(element);
    if (action === undefined || action === null || panels.has(action.id)) return;

    const button = getButton(element);
    if (button === undefined || button === null) return;

    button.insertAdjacentElement('beforebegin', makeBar(skillID, action.id, 'eal-bar-inline'));
  });
}

function buildCookingPanels() {
  document.querySelectorAll('cooking-menu').forEach((element) => {
    const category = element._skillLimitCategory;
    if (category === undefined || panels.has(category.id)) return;

    const cookButton = element.activeCookButton;
    const passiveButton = element.passiveCookButton;
    if (cookButton === null || cookButton === undefined) return;

    // Insert above the row holding both cook buttons, not inside it
    let anchor = cookButton;
    if (passiveButton !== null && passiveButton !== undefined) {
      while (anchor.parentElement !== null && !anchor.contains(passiveButton)) {
        anchor = anchor.parentElement;
      }
    }

    anchor.insertAdjacentElement('beforebegin', makeBar(COOKING_ID, category.id, 'eal-bar-inline'));
  });
}

function buildAllPanels() {
  buildCardPanels(
    WOODCUTTING_ID,
    'woodcutting-tree',
    (el) => el._skillLimitTree,
    (el) => el.button ?? el.lastElementChild
  );

  buildCardPanels(
    MINING_ID,
    'mining-rock',
    (el) => el._rock ?? el._skillLimitRock,
    (el) => el.unlockedContainer ?? el.lastElementChild
  );

  buildCardPanels(
    HARVESTING_ID,
    'harvesting-vein',
    (el) => el._skillLimitVein,
    (el) => el.button ?? el.lastElementChild
  );

  buildButtonPanels(
    FISHING_ID,
    'fishing-area-menu',
    (el) => el._skillLimitArea,
    (el) => el.startButton
  );

  buildButtonPanels(
    THIEVING_ID,
    'thieving-area-panel',
    (el) => el._skillLimitArea,
    (el) => el.startButton
  );

  buildButtonPanels(
    ARCHAEOLOGY_ID,
    'archaeology-dig-site-container',
    (el) => el._skillLimitDigSite,
    (el) => el.excavateBtn
  );

  buildCookingPanels();
}

/* ---------- counting ---------- */

function countAction(skillID, targetID, event) {
  lastTargetID.set(skillID, targetID);

  const target = getTarget(targetID);
  if (!isArmed(target)) return;

  const count = getCount(targetID);
  count.actions += 1;
  count.items += event.productQuantity ?? 0;
  renderPanel(targetID);
}

function onSkillAction(skill, event) {
  if (skill.id === WOODCUTTING_ID) {
    event.actions.forEach((tree) => countAction(skill.id, tree.id, event));
    return;
  }

  if (skill.id === COOKING_ID) {
    if (event.category === undefined) return;
    countAction(skill.id, event.category.id, event);
    return;
  }

  if (skill.id === FISHING_ID || skill.id === THIEVING_ID) {
    if (event.area === undefined) return;
    countAction(skill.id, event.area.id, event);
    return;
  }

  if (PER_ACTION_SKILLS.has(skill.id)) {
    if (event.action === undefined) return;
    countAction(skill.id, event.action.id, event);
    return;
  }

  countAction(skill.id, skill.id, event);
}

/* ---------- stopping ---------- */

function checkTreeTargets(woodcutting) {
  [...woodcutting.activeTrees].forEach((tree) => {
    const target = getTarget(tree.id);
    if (!isArmed(target)) return;
    if (currentCount(tree.id, target) < target.amount) return;

    notifyStopped(tree.id, tree.name, tree.media);
    woodcutting.selectTree(tree);
    resetCount(tree.id);
    renderPanel(tree.id);
  });
}

function checkTarget(skill) {
  if (skill.id === WOODCUTTING_ID) {
    checkTreeTargets(skill);
    return;
  }

  const targetID = lastTargetID.get(skill.id) ?? skill.id;
  const target = getTarget(targetID);
  if (!isArmed(target) || !skill.isActive) return;
  if (currentCount(targetID, target) < target.amount) return;
  if (!skill.stop()) return;

  notifyStopped(targetID, skill.name, skill.media);
  resetCount(targetID);
  renderPanel(targetID);
}

function resetSkillCounts(skill) {
  const owned = skillTargets.get(skill.id);
  if (owned === undefined) {
    resetCount(skill.id);
    renderPanel(skill.id);
    return;
  }
  owned.forEach((targetID) => {
    resetCount(targetID);
    renderPanel(targetID);
  });
}

/* ---------- setup ---------- */

export function setup(ctx) {
  modContext = ctx;

  ctx.patch(WoodcuttingTreeElement, 'setTree').after(function (_result, tree) {
    this._skillLimitTree = tree;
  });

  ctx.patch(MiningRockElement, 'setRock').after(function (_result, rock) {
    this._skillLimitRock = rock;
  });

  ctx.patch(FishingAreaMenuElement, 'setAreaData').after(function (_result, area) {
    this._skillLimitArea = area;
  });

  ctx.patch(ThievingAreaPanelElement, 'setArea').after(function (_result, area) {
    this._skillLimitArea = area;
  });

  ctx.patch(CookingMenuElement, 'init').after(function (_result, category) {
    this._skillLimitCategory = category;
  });

  if (typeof HarvestingVeinElement !== 'undefined') {
    ctx.patch(HarvestingVeinElement, 'setVein').after(function (_result, vein) {
      this._skillLimitVein = vein;
    });
  }

  if (typeof ArchaeologyDigSiteContainerElement !== 'undefined') {
    ctx.patch(ArchaeologyDigSiteContainerElement, 'setDigSite').after(function (_result, digSite) {
      this._skillLimitDigSite = digSite;
    });
  }

  ctx.patch(GatheringSkill, 'start').after(function (started) {
    if (started) resetSkillCounts(this);
  });

  ctx.patch(GatheringSkill, 'stop').after(function (stopped) {
    if (stopped) resetSkillCounts(this);
  });

  ctx.patch(GatheringSkill, 'action').after(function () {
    checkTarget(this);
  });

  ctx.patch(CraftingSkill, 'action').after(function () {
    checkTarget(this);
  });

  ctx.onCharacterLoaded(() => {
    loadTargets();
  });

  ctx.onInterfaceReady(() => {
    game.skills.allObjects.forEach((skill) => {
      if (!(skill instanceof GatheringSkill)) return;

      skill.on('action', (event) => onSkillAction(skill, event));
      if (!PER_ACTION_SKILLS.has(skill.id)) buildSkillPanel(skill);
    });

    buildAllPanels();
  });
}
