const STYLES = ['melee', 'ranged', 'magic'];

const STYLE_NAMES = {
  melee: 'Melee',
  ranged: 'Ranged',
  magic: 'Magic',
};

/** The stat that matters most for each style when picking gear */
const STYLE_STAT = {
  melee: 'meleeStrengthBonus',
  ranged: 'rangedStrengthBonus',
  magic: 'magicDamageBonus',
};

const SKIPPED_SLOT_IDS = new Set(['melvorD:Summon1', 'melvorD:Summon2']);
const SHIELD_SLOT_ID = 'melvorD:Shield';

let modContext;
let allowSelection = false;

function isEnabled() {
  return modContext.settings.section('General').get('enabled') !== false;
}

function equipStat(item, key) {
  let total = 0;
  (item.equipmentStats ?? []).forEach((stat) => {
    if (stat.key === key) total += stat.value;
  });
  return total;
}

function wornItem(player, slotID) {
  const item = player.equipment.getItemInSlot(slotID);
  if (item === undefined || item === game.emptyEquipmentItem) return undefined;
  return item;
}

/** The triangle in use for this area, falling back to the game default */
function currentTriangle(area) {
  const set = area?.combatTriangleSet ?? game.normalCombatTriangleSet;
  const type = game.currentGamemode?.combatTriangleType ?? 'Standard';
  return set?.[type];
}

/** The style that hits this monster hardest, or undefined if it cannot be worked out */
function bestStyleAgainst(monster, area) {
  const triangle = currentTriangle(area);
  if (triangle === undefined) return undefined;

  const enemyStyle = monster.attackType;
  if (!STYLES.includes(enemyStyle)) return undefined;

  let best;
  let bestValue = -Infinity;

  STYLES.forEach((style) => {
    const value = triangle.damageModifier?.[style]?.[enemyStyle];
    if (!Number.isFinite(value) || value <= bestValue) return;
    best = style;
    bestValue = value;
  });

  return best === undefined ? undefined : { style: best, multiplier: bestValue };
}

function equipForStyle(style) {
  const key = STYLE_STAT[style];
  const player = game.combat.player;
  const set = player.selectedEquipmentSet;
  let equipped = 0;

  game.equipmentSlots.allObjects.forEach((slot) => {
    if (SKIPPED_SLOT_IDS.has(slot.id)) return;
    if (!player.isEquipmentSlotUnlocked(slot)) return;
    if (slot.id === SHIELD_SLOT_ID && player.equipment.isWeapon2H) return;

    let best;
    let bestScore = 0;

    game.bank.items.forEach((_bankItem, item) => {
      if (!(item instanceof EquipmentItem)) return;
      if (!item.validSlots.includes(slot)) return;
      if (!game.checkRequirements(item.equipRequirements, false)) return;

      const score = equipStat(item, key);
      if (score <= bestScore) return;

      best = item;
      bestScore = score;
    });

    if (best === undefined) return;

    const current = wornItem(player, slot.id);
    if (current === best) return;
    if (current !== undefined && equipStat(current, key) >= bestScore) return;

    if (player.equipItem(best, set, slot, 1)) equipped += 1;
  });

  if (equipped === 0) {
    game.notifications.createErrorNotification(
      'eerieFightAdvisor:equip',
      `Nothing better in the bank for ${STYLE_NAMES[style]}.`
    );
    return;
  }

  game.notifications.createSuccessNotification(
    'eerieFightAdvisor:equip',
    `Equipped ${equipped} slot${equipped === 1 ? '' : 's'} for ${STYLE_NAMES[style]}.`,
    'assets/media/skills/combat/combat.png'
  );
}

function askBeforeFight(monster, area, proceed) {
  const advice = bestStyleAgainst(monster, area);

  if (advice === undefined) {
    proceed();
    return;
  }

  const styleName = STYLE_NAMES[advice.style];
  const enemyName = STYLE_NAMES[monster.attackType] ?? monster.attackType;

  Swal.fire({
    title: monster.name,
    html: `Attacks with <b>${enemyName}</b>.<br>Best against it: <b>${styleName}</b>.<br>Do you want to equip your best ${styleName} gear first?`,
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: `Equip ${styleName}`,
    denyButtonText: 'Fight as I am',
    cancelButtonText: 'Cancel',
  }).then((result) => {
    if (result.isConfirmed) {
      equipForStyle(advice.style);
      proceed();
      return;
    }
    if (result.isDenied) proceed();
  });
}

export function setup(ctx) {
  modContext = ctx;

  ctx.settings.section('General').add({
    type: 'switch',
    name: 'enabled',
    label: 'Enabled',
    hint: 'Ask which style to use before starting a fight.',
    default: true,
  });

  ctx.patch(CombatManager, 'selectMonster').replace(function (original, monster, area) {
    if (allowSelection || !isEnabled()) {
      original(monster, area);
      return;
    }

    askBeforeFight(monster, area, () => {
      allowSelection = true;
      try {
        original(monster, area);
      } finally {
        allowSelection = false;
      }
    });
  });
}
