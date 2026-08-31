const STYLES = ['melee', 'ranged', 'magic'];

const STYLE_NAMES = {
  melee: 'Melee',
  ranged: 'Ranged',
  magic: 'Magic',
};

const SKIPPED_SLOT_IDS = new Set(['melvorD:Summon1', 'melvorD:Summon2']);
const TOP_PER_SLOT = 5;

/** Strength and damage matter more per point than accuracy, so they weigh heavier */
const STRENGTH_WEIGHT = 4;

function equipStat(item, key) {
  let total = 0;
  (item.equipmentStats ?? []).forEach((stat) => {
    if (stat.key === key) total += stat.value;
  });
  return total;
}

function resistanceStat(item, damageType) {
  if (damageType === undefined) return 0;
  let total = 0;
  (item.equipmentStats ?? []).forEach((stat) => {
    if (stat.key !== 'resistance') return;
    if (stat.damageType?.id !== damageType.id) return;
    total += stat.value;
  });
  return total;
}

function offenceScore(item, style) {
  if (style === 'ranged') {
    return (
      equipStat(item, 'rangedAttackBonus') +
      equipStat(item, 'rangedStrengthBonus') * STRENGTH_WEIGHT
    );
  }
  if (style === 'magic') {
    return (
      equipStat(item, 'magicAttackBonus') +
      equipStat(item, 'magicDamageBonus') * STRENGTH_WEIGHT
    );
  }

  const accuracy = Math.max(
    equipStat(item, 'stabAttackBonus'),
    equipStat(item, 'slashAttackBonus'),
    equipStat(item, 'blockAttackBonus')
  );
  return accuracy + equipStat(item, 'meleeStrengthBonus') * STRENGTH_WEIGHT;
}

function defenceScore(item, enemyStyle, damageType) {
  const key =
    enemyStyle === 'ranged'
      ? 'rangedDefenceBonus'
      : enemyStyle === 'magic'
        ? 'magicDefenceBonus'
        : 'meleeDefenceBonus';

  return equipStat(item, key) + resistanceStat(item, damageType) * STRENGTH_WEIGHT;
}

function currentTriangle(area) {
  const set = area?.combatTriangleSet ?? game.normalCombatTriangleSet;
  const type = game.currentGamemode?.combatTriangleType ?? 'Standard';
  return set?.[type];
}

function bestStyleAgainst(monster) {
  const triangle = currentTriangle(undefined);
  const enemyStyle = monster.attackType;
  if (triangle === undefined || !STYLES.includes(enemyStyle)) return 'melee';

  let best = 'melee';
  let bestValue = -Infinity;

  STYLES.forEach((style) => {
    const value = triangle.damageModifier?.[style]?.[enemyStyle];
    if (!Number.isFinite(value) || value <= bestValue) return;
    best = style;
    bestValue = value;
  });

  return best;
}

function ownedCount(item) {
  let total = game.bank.getQty(item);
  game.combat.player.equipmentSets.forEach((set) => {
    total += set.equipment.getQuantityOfItem(item);
  });
  return total;
}

/** Every equipment item in the game that fits this slot, best first */
function rankSlot(slot, scorer) {
  const rows = [];

  game.items.equipment.forEach((item) => {
    if (!item.validSlots.includes(slot)) return;

    const score = scorer(item);
    if (score <= 0) return;

    rows.push({
      name: item.name,
      score,
      owned: ownedCount(item) > 0,
      allowed: game.checkRequirements(item.equipRequirements, false),
    });
  });

  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, TOP_PER_SLOT);
}

function statusText(row) {
  if (!row.owned) return '<span class="egp-missing">not owned</span>';
  if (!row.allowed) return '<span class="egp-locked">level too low</span>';
  return 'ready';
}

function buildTable(monster) {
  const style = bestStyleAgainst(monster);
  const enemyStyle = STYLE_NAMES[monster.attackType] ?? monster.attackType;
  const player = game.combat.player;

  const header = `Attacks with <b>${enemyStyle}</b>. Best against it: <b>${STYLE_NAMES[style]}</b>.`;

  const bodyRows = [];

  game.equipmentSlots.allObjects.forEach((slot) => {
    if (SKIPPED_SLOT_IDS.has(slot.id)) return;
    if (!player.isEquipmentSlotUnlocked(slot)) return;

    const isWeapon = slot.id === 'melvorD:Weapon' || slot.id === 'melvorD:Quiver';
    const scorer = isWeapon
      ? (item) => offenceScore(item, style)
      : (item) => defenceScore(item, monster.attackType, monster.damageType);

    const rows = rankSlot(slot, scorer);
    if (rows.length === 0) return;

    rows.forEach((row, index) => {
      const slotCell = index === 0 ? `<span class="egp-slot">${slot.id.split(':')[1]}</span>` : '';
      bodyRows.push(
        `<tr><td>${slotCell}</td><td>${row.name}</td><td>${row.score}</td><td>${statusText(row)}</td></tr>`
      );
    });
  });

  return `
    <div id="egp-summary">${header}</div>
    <table class="egp-table">
      <thead><tr><th>Slot</th><th>Item</th><th>Score</th><th>Status</th></tr></thead>
      <tbody>${bodyRows.join('')}</tbody>
    </table>
  `;
}

function openPlanner() {
  const monsters = game.monsters.allObjects
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  if (monsters.length === 0) return;

  const options = monsters
    .map((monster) => `<option value="${monster.id}">${monster.name}</option>`)
    .join('');

  Swal.fire({
    title: 'Gear planner',
    width: '52em',
    html: `<select id="egp-monster">${options}</select><div id="egp-body"></div>`,
    confirmButtonText: 'Close',
    didOpen: () => {
      const select = document.getElementById('egp-monster');
      const body = document.getElementById('egp-body');

      const draw = () => {
        const monster = game.monsters.getObjectByID(select.value);
        if (monster === undefined) return;
        body.innerHTML = buildTable(monster);
      };

      select.addEventListener('change', draw);
      draw();
    },
  });
}

function buildButton() {
  document.querySelectorAll('equipment-grid').forEach((grid) => {
    if (grid._egpAdded === true) return;
    grid._egpAdded = true;

    const bar = document.createElement('div');
    bar.className = 'egp-bar';

    const button = document.createElement('button');
    button.className = 'egp-btn';
    button.type = 'button';
    button.textContent = 'Gear planner';
    button.addEventListener('click', openPlanner);

    bar.append(button);
    grid.insertAdjacentElement('afterend', bar);
  });
}

export function setup(ctx) {
  ctx.onInterfaceReady(() => {
    buildButton();
  });
}
