const SUMMON_SLOTS = ['melvorD:Summon1', 'melvorD:Summon2'];

let modContext;

function isEnabled() {
  return modContext.settings.section('General').get('enabled') !== false;
}

/** True while a Summoning synergy is equipped and both tablet slots still hold tablets */
function hasActiveSynergy(player) {
  return (
    player.equippedSummoningSynergy !== undefined &&
    SUMMON_SLOTS.every((slotID) => player.equipment.getQuantityInSlot(slotID) > 0)
  );
}

function stopActiveSkill() {
  const action = game.activeAction;
  if (action === undefined || !action.isActive) return;
  if (!(action instanceof GatheringSkill)) return;
  if (!action.stop()) return;

  game.notifications.createErrorNotification(
    'eerieSynergyGuard:stopped',
    `${action.name} stopped: Summoning synergy ended.`
  );
}

export function setup(ctx) {
  modContext = ctx;

  ctx.settings.section('General').add({
    type: 'switch',
    name: 'enabled',
    label: 'Enabled',
    hint: 'Stop the skill when your Summoning synergy ends.',
    default: true,
  });

  const tabletPatch = ctx.patch(Player, 'consumeSynergyTablets');
  let synergyWasActive = false;

  tabletPatch.before(function () {
    synergyWasActive = isEnabled() && hasActiveSynergy(this);
  });

  tabletPatch.after(function () {
    if (!synergyWasActive || hasActiveSynergy(this)) return;
    synergyWasActive = false;
    stopActiveSkill();
  });
}
