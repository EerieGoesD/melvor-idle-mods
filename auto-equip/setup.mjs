const SHIELD_SLOT_ID = 'melvorD:Shield';
const FISHING_ID = 'melvorD:Fishing';
const SUMMONING_ID = 'melvorD:Summoning';
const CARTOGRAPHY_ID = 'melvorAoD:Cartography';
const WOODCUTTING_ID = 'melvorD:Woodcutting';
const FIREMAKING_ID = 'melvorD:Firemaking';
const ASTROLOGY_ID = 'melvorD:Astrology';

const STARDUST_ID = 'melvorF:Stardust';
const GOLDEN_STARDUST_ID = 'melvorF:Golden_Stardust';
const ASH_ID = 'melvorF:Ash';

/** Slots left alone so Summoning synergies are never touched */
const SKIPPED_SLOT_IDS = new Set(['melvorD:Summon1', 'melvorD:Summon2']);

/** Empty slots hold a placeholder item, not undefined */
function wornItem(player, slotID) {
  const item = player.equipment.getItemInSlot(slotID);
  if (item === undefined || item === game.emptyEquipmentItem) return undefined;
  return item;
}

function sellValue(item) {
  return item.sellsFor?.quantity ?? 0;
}

function equipStat(item, key) {
  let total = 0;
  (item.equipmentStats ?? []).forEach((stat) => {
    if (stat.key === key) total += stat.value;
  });
  return total;
}

/**
 * Sums a modifier on an item.
 * Pass a skillID to count only entries tied to that skill.
 * Pass no skillID to count only entries that apply to every skill.
 */
/** Resistance stats are stored per damage type */
function resistanceStat(item, damageTypeID) {
  let total = 0;
  (item.equipmentStats ?? []).forEach((stat) => {
    if (stat.key !== 'resistance') return;
    if (stat.damageType?.id !== damageTypeID) return;
    total += stat.value;
  });
  return total;
}

function modifierTotal(item, modifierID, skillID) {
  let total = 0;
  (item.modifiers ?? []).forEach((entry) => {
    if (entry.modifier?.id !== modifierID) return;

    if (skillID === undefined) {
      if (entry.skill !== undefined) return;
    } else if (entry.skill?.id !== skillID) {
      return;
    }

    total += entry.value;
  });
  return total;
}

/** Sums a modifier on an item, matching both the skill and the item it applies to */
function scopedModifierTotal(item, modifierID, skillID, targetItemID) {
  let total = 0;
  (item.modifiers ?? []).forEach((entry) => {
    if (entry.modifier?.id !== modifierID) return;
    if (entry.skill?.id !== skillID) return;
    if (entry.item?.id !== targetItemID) return;
    total += entry.value;
  });
  return total;
}

/** Modifiers where a negative value is the good one, so only reductions score */
function reductionScore(item, modifierID, skillID) {
  const total = modifierTotal(item, modifierID, skillID);
  return total < 0 ? -total : 0;
}

/** Interval modifiers are better when negative, so only reductions score */
function intervalScore(item, skillID) {
  const percent = modifierTotal(item, 'melvorD:skillInterval', skillID);
  const flat = modifierTotal(item, 'melvorD:flatSkillInterval', skillID);
  const total = percent + flat / 1000;
  return total < 0 ? -total : 0;
}

const MODES = [
  {
    value: 'price',
    label: 'By price',
    score: (item) => sellValue(item),
    includeFood: true,
  },
  {
    value: 'meleeDefence',
    label: 'Melee defence bonus',
    score: (item) => equipStat(item, 'meleeDefenceBonus'),
  },
  {
    value: 'stabAttack',
    label: 'Melee stab bonus',
    score: (item) => equipStat(item, 'stabAttackBonus'),
  },
  {
    value: 'slashAttack',
    label: 'Melee slash bonus',
    score: (item) => equipStat(item, 'slashAttackBonus'),
  },
  {
    value: 'blockAttack',
    label: 'Melee block bonus',
    score: (item) => equipStat(item, 'blockAttackBonus'),
  },
  {
    value: 'meleeStrength',
    label: 'Melee strength bonus',
    score: (item) => equipStat(item, 'meleeStrengthBonus'),
  },
  {
    value: 'rangedAttack',
    label: 'Ranged attack bonus',
    score: (item) => equipStat(item, 'rangedAttackBonus'),
  },
  {
    value: 'magicDamage',
    label: 'Magic damage bonus',
    score: (item) => equipStat(item, 'magicDamageBonus'),
  },
  {
    value: 'normalResistance',
    label: 'Damage reduction',
    score: (item) => resistanceStat(item, 'melvorD:Normal'),
  },
  {
    value: 'pureResistance',
    label: 'Pure resistance',
    score: (item) => resistanceStat(item, 'melvorF:Pure'),
  },
  {
    value: 'abyssalResistance',
    label: 'Abyssal resistance',
    score: (item) => resistanceStat(item, 'melvorItA:Abyssal'),
  },
  {
    value: 'rangedDefence',
    label: 'Ranged defence bonus',
    score: (item) => equipStat(item, 'rangedDefenceBonus'),
  },
  {
    value: 'magicDefence',
    label: 'Magic defence bonus',
    score: (item) => equipStat(item, 'magicDefenceBonus'),
  },
  {
    value: 'rangedStrength',
    label: 'Ranged strength bonus',
    score: (item) => equipStat(item, 'rangedStrengthBonus'),
  },
  {
    value: 'magicAttack',
    label: 'Magic attack bonus',
    score: (item) => equipStat(item, 'magicAttackBonus'),
  },
  {
    value: 'astrologyInterval',
    label: 'Astrology interval',
    score: (item) => intervalScore(item, ASTROLOGY_ID),
  },
  {
    value: 'astrologyStardust',
    label: 'Astrology stardust quantity',
    score: (item) =>
      scopedModifierTotal(item, 'melvorD:flatBaseRandomProductQuantity', ASTROLOGY_ID, STARDUST_ID),
  },
  {
    value: 'astrologyGoldenStardust',
    label: 'Astrology golden stardust quantity',
    score: (item) =>
      scopedModifierTotal(
        item,
        'melvorD:flatBaseRandomProductQuantity',
        ASTROLOGY_ID,
        GOLDEN_STARDUST_ID
      ),
  },
  {
    value: 'attackInterval',
    label: 'Attack interval',
    score: (item) => {
      const speed = equipStat(item, 'attackSpeed');
      return speed > 0 ? 10000 - speed : 0;
    },
  },
  {
    value: 'firemakingGP',
    label: 'Firemaking GP gained',
    score: (item) => modifierTotal(item, 'melvorD:currencyGain', FIREMAKING_ID),
  },
  {
    value: 'firemakingStardust',
    label: 'Firemaking stardust chance',
    score: (item) => modifierTotal(item, 'melvorD:randomProductChance', FIREMAKING_ID),
  },
  {
    value: 'firemakingAsh',
    label: 'Firemaking ash chance',
    score: (item) =>
      scopedModifierTotal(item, 'melvorD:randomProductChance', FIREMAKING_ID, ASH_ID),
  },
  {
    value: 'firemakingXP',
    label: 'Firemaking skill XP',
    score: (item) => modifierTotal(item, 'melvorD:skillXP', FIREMAKING_ID),
  },
  {
    value: 'fishingInterval',
    label: 'Fishing interval',
    score: (item) => intervalScore(item, FISHING_ID),
  },
  {
    value: 'woodcuttingInterval',
    label: 'Woodcutting interval',
    score: (item) => intervalScore(item, WOODCUTTING_ID),
  },
  {
    value: 'combatGP',
    label: 'GP from combat',
    score: (item) => modifierTotal(item, 'melvorD:currencyGainFromCombat'),
  },
  {
    value: 'masteryXP',
    label: 'Mastery XP (all skills)',
    score: (item) => modifierTotal(item, 'melvorD:masteryXP'),
  },
  {
    value: 'runePreservation',
    label: 'Rune preservation',
    score: (item) => modifierTotal(item, 'melvorD:runePreservationChance'),
  },
  {
    value: 'skillXP',
    label: 'Skill XP (all skills)',
    score: (item) => modifierTotal(item, 'melvorD:skillXP'),
  },
  {
    value: 'bonusCoalMining',
    label: 'Bonus coal per ore mined',
    score: (item) => modifierTotal(item, 'melvorD:bonusCoalMining'),
  },
  {
    value: 'cartographyMapUpgrade',
    label: 'Cartography dig site map upgrade',
    score: (item) => reductionScore(item, 'melvorD:cartographyMapUpgradeInterval'),
  },
  {
    value: 'cartographyPreserve',
    label: 'Cartography preserve resources',
    score: (item) => modifierTotal(item, 'melvorD:skillPreservationChance', CARTOGRAPHY_ID),
  },
  {
    value: 'mapRefinementCost',
    label: 'Dig site refinement cost',
    score: (item) => reductionScore(item, 'melvorD:mapRefinementCost'),
  },
  {
    value: 'fishingXP',
    label: 'Fishing skill XP',
    score: (item) => modifierTotal(item, 'melvorD:skillXP', FISHING_ID),
  },
  {
    value: 'summoningXP',
    label: 'Summoning skill XP',
    score: (item) => modifierTotal(item, 'melvorD:skillXP', SUMMONING_ID),
  },
].sort((a, b) => a.label.localeCompare(b.label));

const DEFAULT_MODE = MODES.find((mode) => mode.value === 'price') ?? MODES[0];

function getMode(value) {
  return MODES.find((mode) => mode.value === value) ?? DEFAULT_MODE;
}

/** The highest scoring item in the bank that can go in this slot right now */
function bestForSlot(slot, mode) {
  let best;
  let bestScore = 0;

  game.bank.items.forEach((_bankItem, item) => {
    if (!(item instanceof EquipmentItem)) return;
    if (!item.validSlots.includes(slot)) return;
    if (!game.checkRequirements(item.equipRequirements, false)) return;

    const score = mode.score(item);
    if (score <= bestScore) return;

    best = item;
    bestScore = score;
  });

  return best;
}

/** The highest scoring food in the bank */
function bestFood(mode) {
  let best;
  let bestScore = 0;

  game.bank.items.forEach((_bankItem, item) => {
    if (!(item instanceof FoodItem)) return;

    const score = mode.score(item);
    if (score <= bestScore) return;

    best = item;
    bestScore = score;
  });

  return best;
}

function equipBestFood(player, mode) {
  const item = bestFood(mode);
  if (item === undefined) return false;

  const current = player.food.currentSlot?.item;
  if (current === item) return false;
  if (current !== undefined && mode.score(current) >= mode.score(item)) return false;

  const quantity = game.bank.getQty(item);
  if (quantity < 1) return false;

  return player.equipFood(item, quantity) === true;
}

function equipBest(modeValue) {
  const mode = getMode(modeValue);
  const player = game.combat.player;
  const set = player.selectedEquipmentSet;
  let equipped = 0;

  game.equipmentSlots.allObjects.forEach((slot) => {
    if (SKIPPED_SLOT_IDS.has(slot.id)) return;
    if (!player.isEquipmentSlotUnlocked(slot)) return;
    if (slot.id === SHIELD_SLOT_ID && player.equipment.isWeapon2H) return;

    const item = bestForSlot(slot, mode);
    if (item === undefined) return;

    const current = wornItem(player, slot.id);
    if (current === item) return;
    if (current !== undefined && mode.score(current) >= mode.score(item)) return;

    const quantity = slot.allowQuantity ? game.bank.getQty(item) : 1;
    if (quantity < 1) return;

    if (player.equipItem(item, set, slot, quantity)) equipped += 1;
  });

  if (mode.includeFood === true && equipBestFood(player, mode)) equipped += 1;

  if (equipped === 0) {
    game.notifications.createErrorNotification(
      'eerieAutoEquip:none',
      `Nothing better in the bank for ${mode.label.toLowerCase()}.`
    );
    return;
  }

  game.notifications.createSuccessNotification(
    'eerieAutoEquip:done',
    `Equipped ${equipped} slot${equipped === 1 ? '' : 's'} by ${mode.label.toLowerCase()}.`,
    'assets/media/main/coins.png'
  );
}

/** Builds the score report for a mode as rows of plain text */
function buildScoreReport(mode) {
  const player = game.combat.player;
  const rows = [];

  game.equipmentSlots.allObjects.forEach((slot) => {
    if (SKIPPED_SLOT_IDS.has(slot.id)) return;
    if (!player.isEquipmentSlotUnlocked(slot)) return;

    const current = wornItem(player, slot.id);
    const currentText =
      current === undefined ? 'empty' : `${current.name} (${mode.score(current)})`;

    const candidates = [];
    game.bank.items.forEach((_bankItem, item) => {
      if (!(item instanceof EquipmentItem)) return;
      if (!item.validSlots.includes(slot)) return;

      const score = mode.score(item);
      const allowed = game.checkRequirements(item.equipRequirements, false);
      if (score === 0 && allowed) return;

      candidates.push({ name: item.name, score, allowed });
    });

    if (candidates.length === 0 && current === undefined) return;

    candidates.sort((a, b) => b.score - a.score);

    const lines = [`[${slot.id.split(':')[1]}]`, `worn: ${currentText}`];
    if (candidates.length === 0) {
      lines.push('bank: nothing scoring');
    } else {
      candidates.slice(0, 5).forEach((entry) => {
        lines.push(`bank: ${entry.name}: ${entry.score}${entry.allowed ? '' : ' (locked)'}`);
      });
    }

    rows.push(lines);
  });

  return rows;
}

/** Shows what the selected mode scores, so a surprising result can be checked */
function showScores(modeValue) {
  const mode = getMode(modeValue);
  const rows = buildScoreReport(mode);

  const html =
    rows.map((lines) => lines.join('<br>')).join('<hr>') || 'Nothing to show.';
  const text = [mode.label, ...rows.map((lines) => lines.join(String.fromCharCode(10)))].join(String.fromCharCode(10, 10));

  Swal.fire({
    title: mode.label,
    html,
    width: '40em',
    showCancelButton: true,
    confirmButtonText: 'Copy all',
    cancelButtonText: 'Close',
  }).then((result) => {
    if (result.isConfirmed !== true) return;
    copyText(text);
  });
}

/** Clipboard access is blocked in some builds, so fall back to a hidden textarea */
function copyText(text) {
  const done = () =>
    game.notifications.createSuccessNotification(
      'eerieAutoEquip:copy',
      'Scores copied.',
      'assets/media/main/coins.png'
    );

  const fallback = () => {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    area.remove();

    if (copied) {
      done();
      return;
    }
    game.notifications.createErrorNotification('eerieAutoEquip:copy', 'Could not copy.');
  };

  try {
    navigator.clipboard.writeText(text).then(done, fallback);
  } catch {
    fallback();
  }
}

function buildControls() {
  document.querySelectorAll('equipment-grid').forEach((grid) => {
    if (grid._eaeButtonAdded === true) return;
    grid._eaeButtonAdded = true;

    const bar = document.createElement('div');
    bar.className = 'eae-bar';

    const select = document.createElement('select');
    select.className = 'eae-select';
    MODES.forEach((mode) => {
      const option = document.createElement('option');
      option.value = mode.value;
      option.textContent = mode.label;
      select.append(option);
    });
    select.value = DEFAULT_MODE.value;

    const button = document.createElement('button');
    button.className = 'eae-btn';
    button.type = 'button';
    button.textContent = 'Equip';
    button.addEventListener('click', () => equipBest(select.value));

    const whyButton = document.createElement('button');
    whyButton.className = 'eae-btn eae-btn-secondary';
    whyButton.type = 'button';
    whyButton.textContent = 'Scores';
    whyButton.addEventListener('click', () => showScores(select.value));

    bar.append(select, button, whyButton);
    grid.insertAdjacentElement('afterend', bar);
  });
}

export function setup(ctx) {
  ctx.onInterfaceReady(() => {
    buildControls();
  });
}
