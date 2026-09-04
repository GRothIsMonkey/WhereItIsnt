/* PHASE 26 — XP REMOVAL AND DIRECT PROGRESSION.

   WHAT THIS FILE CLAIMS, AND HOW IT PROVES IT.

   Two halves, and they are different kinds of claim on purpose.

   The first half is an ABSENCE, and an absence cannot be demonstrated by calling a
   function — the whole point is that there is no function to call. So it is proved
   lexically, against the real shipped source: no XP symbol is defined, no call site
   survives, no markup carries an XP bar, no recipe carries a level gate, and the one
   place that legitimately still says "xp" (the save migration that DROPS the field) is
   named and allowed rather than swept under a looser pattern. A lexical test is exactly
   right for "this system is gone" and exactly wrong for anything else, and nothing here
   pretends otherwise.

   The second half is a BEHAVIOUR, and it is exercised for real: the milestone table and
   its grant path are run against the shipped code, legacy saves are pushed through the
   shipped migration ladder and validator, and crafting, mining and combat are driven
   against real objects out of the real script to show that removing XP took none of them
   with it.

   NOT TESTED HERE. No browser. `Game` cannot be constructed offline (its first statement
   builds a WebGLRenderer), so `_reachMilestone` is invoked as an unbound method against a
   hand-built receiver — which tests the logic exactly and tests the wiring not at all.
   The wiring is asserted structurally, from the source, and said so where it is claimed.
   NOBODY PLAYED THIS. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { makeWorld } = require('./harness/util.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'game.html'), 'utf8');
/* The executable body only, so a comment that merely NAMES the removed system cannot
   pass or fail anything. Phase 26 left a lot of gravestones and every one of them says
   "XP". */
const SCRIPT = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const MARKUP = SRC.split('<script>')[0];

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);

console.log('booting world...');
const A = makeWorld();
const g = (n) => vm.runInContext(n, A.S);

// =====================================================================================
// 1. THE ABSENCE. Every symbol the XP system was made of, and every call site it had.
// =====================================================================================
{
  const defined = (name) => {
    try { return vm.runInContext(`typeof ${name}`, A.S) !== 'undefined'; }
    catch (e) { return false; }
  };
  const gone = ['XP_REWARDS', 'CHEST_XP_REWARD', 'xpForLevel', 'LEVEL_XP_BASE', 'LEVEL_XP_GROWTH'];
  const alive = gone.filter(defined);
  chk(alive.length === 0,
      'no XP symbol is defined anywhere in the loaded script' + (alive.length ? ' — STILL THERE: ' + alive.join(', ') : ''));

  const Player = g('PlayerController');
  chk(typeof Player.prototype.addXP !== 'function',
      'PlayerController has no addXP() — there is no function a kill, a break or a chest could call');
  const UI = g('UIManager');
  chk(typeof UI.prototype.announceLevelUp !== 'function',
      'UIManager has no announceLevelUp() — nothing can put a level on the screen');
}
{
  /* Call sites, in the executable source. `xp` is deliberately matched as a whole word
     so `_shpExpand`, `bxp`, `SIGN_ARROW_XP` and the rest of the legitimate traffic in
     those two letters cannot mask a real one. */
  const banned = [
    [/\.addXP\s*\(/, 'an addXP call'],
    [/xpForLevel\s*\(/, 'an xpForLevel call'],
    [/\bxpReward\b/, 'a mob xpReward'],
    [/XP_REWARDS\s*\[/, 'an XP reward lookup'],
    [/\bCHEST_XP_REWARD\b/, 'the chest XP reward'],
    [/\bannounceLevelUp\b/, 'a level-up announcement'],
    [/\blevelReq\b/, 'a recipe level requirement'],
    [/\bplayer\.level\b/, 'a read of player.level'],
    [/\bthis\.level\s*=/, 'a write to a player level'],
    [/\bthis\.xp\b/, 'a player XP counter'],
  ];
  /* The two migration deletes are excised first and asserted separately below, so the
     scan below is a scan of everything that is not the documented compatibility shim. */
  const RUNTIME = SCRIPT.replace(/delete player\.(level|xp);/g, '');
  const found = banned.filter(b => b[0].test(RUNTIME)).map(b => b[1]);
  chk(found.length === 0,
      'and no call site survives in executable code' + (found.length ? ' — STILL THERE: ' + found.join(', ') : ''));

  /* The ONE allowed mention, named rather than pattern-excused: the migration that
     deletes the fields. It is compatibility logic and it is marked as such. */
  const migrationMentions = (SCRIPT.match(/delete player\.(level|xp);/g) || []).length;
  chk(migrationMentions === 2,
      `the only executable mentions left are the ${migrationMentions} deletes in the schema 2 -> 3 migration`);
}
{
  // The HUD. An XP bar cannot be hidden if it is not in the document at all.
  const ui = [
    [/id="xpBar/, '#xpBarInner / #xpBarOuter'],
    [/id="xpWrap"/, '#xpWrap'],
    [/id="xpIcon"/, '#xpIcon'],
    [/id="levelLabel"/, '#levelLabel'],
    [/id="statLevel"/, 'the FINAL LEVEL credits row'],
    [/id="levelUpToast"/, '#levelUpToast'],
  ];
  const left = ui.filter(u => u[0].test(MARKUP)).map(u => u[1]);
  chk(left.length === 0, 'no XP element is in the document' + (left.length ? ' — STILL THERE: ' + left.join(', ') : ''));
  chk(!/#xpBarInner|#xpBarOuter|#levelLabel|#xpWrap|#xpIcon/.test(MARKUP.replace(/\/\*[\s\S]*?\*\//g, '')),
      'and no stylesheet rule still paints one');
  chk(/id="hudToast"/.test(MARKUP),
      'while the one transient HUD line survives, renamed off its level-up heritage (#hudToast)');
  /* \bXP\b, not /XP/: "EXPEDITION" is a real word this game's start screen uses, and a
     substring match on two letters would fail on it forever for no reason. */
  chk(!/\bLv\.|LEVEL UP|Requires Level|Next Level|\bXP\b/.test(MARKUP.replace(/\/\*[\s\S]*?\*\//g, '')),
      'and no player-facing string anywhere in the document says Lv., LEVEL UP, Requires Level or XP');
}

// =====================================================================================
// 2. RECIPES. The level gate is gone and the MATERIAL is the gate.
// =====================================================================================
{
  const RECIPES = g('CRAFTING_RECIPES');
  const gated = RECIPES.filter(r => 'levelReq' in r);
  chk(gated.length === 0,
      `none of the ${RECIPES.length} recipes carries a level requirement` +
      (gated.length ? ' — STILL GATED: ' + gated.map(r => r.id).join(', ') : ''));
  chk(RECIPES.every(r => Array.isArray(r.reqs) && r.reqs.length > 0),
      'and every one of them still states materials — the gate moved to the world, it did not vanish');

  /* The recipes that used to need levels 3, 4 and 7 are exactly the ones whose materials
     the player cannot have without going somewhere: ore is underground, obsidian is deep,
     Corrupted Stone comes out of a Rift. That is the direct progression that replaced the
     threshold, and it is a property of the table, not a hope. */
  const ITEM = g('ITEM');
  const deep = { iron_ingot: ITEM.IRON_ORE, iron_sword: ITEM.IRON_INGOT,
                 void_shield: ITEM.OBSIDIAN, soul_anchor: ITEM.CORRUPTED_STONE_ITEM };
  const bad = Object.keys(deep).filter(id => {
    const r = RECIPES.find(x => x.id === id);
    return !r || !r.reqs.some(q => q.item === deep[id]);
  });
  chk(bad.length === 0,
      'the four formerly level-gated recipes are each gated by a material found somewhere' +
      (bad.length ? ' — NOT: ' + bad.join(', ') : ''));
}
{
  // And crafting still WORKS, driven against the real Inventory.
  const Inventory = g('Inventory'), ITEM = g('ITEM'), RECIPES = g('CRAFTING_RECIPES');
  const inv = new Inventory();
  const r = RECIPES.find(x => x.id === 'iron_sword');
  chk(!inv.hasIngredients(r.reqs), 'with an empty pack the Iron Sword is not craftable');
  for (const q of r.reqs) inv.addItem(q.item, q.count);
  chk(inv.hasIngredients(r.reqs), 'with the ingots and the stick in the pack it is — and nothing else was consulted');
  inv.consumeIngredients(r.reqs);
  inv.addItem(r.result, r.count);
  chk(inv.hasItem(ITEM.IRON_SWORD) && !inv.hasItem(ITEM.IRON_INGOT),
      'crafting it consumes the materials and yields the sword');
}

// =====================================================================================
// 3. THE MILESTONE TABLE, AND THE ONE PLACE A CAPABILITY IS GRANTED
// =====================================================================================
{
  const T = g('PROGRESSION_MILESTONES'), IDS = g('PROGRESSION_MILESTONE_IDS');
  chk(Array.isArray(T) && T.length === 3, `there are exactly ${T.length} milestones — sparse, authored, not a curve`);
  chk(T.every(m => typeof m.id === 'string' && typeof m.toast === 'string'),
      'each is a named event with a line to show for it');
  chk(new Set(IDS).size === IDS.length, 'the ids are unique');
  chk(T.every(m => !('xp' in m) && !('threshold' in m) && !('cost' in m) && !('requires' in m)),
      'and not one of them carries a threshold, a cost or a requirement — nothing counts toward these');
  chk(IDS.join(',') === 'shelter,firstNight,behemoth',
      `the three are: ${IDS.join(', ')}`);
  note('placing the first Anchor, surviving the first night, felling the Behemoth — each once, ever');
}
{
  const Game = g('Game');
  const T = g('PROGRESSION_MILESTONES');
  const reach = Game.prototype._reachMilestone;
  chk(typeof reach === 'function', 'Game._reachMilestone is the single grant path');

  const toasts = [];
  const mk = () => ({
    milestones: new Set(),
    player: { maxHp: 100, hp: 55 },
    ui: { showToast: (t) => toasts.push(t), updateVitals: () => {} },
  });

  const one = mk();
  chk(reach.call(one, 'shelter') === true, 'reaching one for the first time returns true');
  chk(one.player.maxHp === 120, `it grants max health (100 -> ${one.player.maxHp})`);
  chk(one.player.hp === 75, `and the health itself, not just an emptier bar (55 -> ${one.player.hp})`);
  chk(toasts.length === 1 && !/\d/.test(toasts[0]),
      `the player is told once, with no number in it ("${toasts[0]}")`);

  const before = one.player.maxHp;
  let again = 0;
  for (let i = 0; i < 500; i++) if (reach.call(one, 'shelter')) again++;
  chk(again === 0 && one.player.maxHp === before,
      '500 more attempts at the same milestone grant nothing — it is a latch, not a rate');

  const all = mk();
  for (const m of T) reach.call(all, m.id);
  chk(all.milestones.size === 3, 'all three can be reached');
  chk(all.player.maxHp === 100 + T.reduce((a, m) => a + (m.maxHp || 0), 0),
      `a full run ends at ${all.player.maxHp} max health, and that is the ceiling — there is no fourth`);

  const bogus = mk();
  chk(reach.call(bogus, 'grind') === false && bogus.milestones.size === 0,
      'and a name the table does not know grants nothing');
}
{
  /* THE WIRING, asserted structurally because Game cannot be built offline. Each of the
     three has to hang off the event it claims to, and none of them may hang off a
     counter. */
  const sites = [
    [/this\.dayCount\+\+;[\s\S]{0,400}_reachMilestone\('firstNight'\)/, "'firstNight' fires from the dawn branch, once per night survived"],
    [/this\.behemothDefeated = true;[\s\S]{0,300}_reachMilestone\('behemoth'\)/, "'behemoth' fires from the defeat latch, not from a kill count"],
    [/milestones\.has\('shelter'\) && this\.anchorManager\.activeAnchor[\s\S]{0,200}_reachMilestone\('shelter'\)/, "'shelter' fires from the anchor actually standing"],
  ];
  for (const s of sites) chk(s[0].test(SCRIPT), s[1]);
  chk((SCRIPT.match(/_reachMilestone\(/g) || []).length === 4,
      'and there are four mentions in all: the definition and its three callers — no other route in');
}

// =====================================================================================
// 4. LEGACY SAVES. Remove the currency, keep the consequences.
// =====================================================================================
const validateSaveState = g('validateSaveState');
const defaultSaveState = g('defaultSaveState');
const SAVE_VERSION = g('SAVE_VERSION');
const SAVE_MIGRATIONS = g('SAVE_MIGRATIONS');
const ITEM = g('ITEM');
const DIMENSION = g('DIMENSION');

/* A REPRESENTATIVE XP-ERA SAVE. Schema 2 is what the Phase 25 build wrote, and this is
   what it wrote for a player who had ground their way to level 6: max health well past
   the baseline, an attack bonus and a mining bonus they paid for, a pack, a position, a
   dimension, an anchor, and the Behemoth behind them. The `xp` field is here even though
   the shipped game never wrote one, because a hand-edited file may carry it and the
   migration has to survive that too. */
function xpEraSave(over) {
  const inv = new Array(g('INVENTORY_SIZE')).fill(null);
  inv[0] = { item: ITEM.IRON_PICKAXE, count: 1 };
  inv[3] = { item: ITEM.TORCH, count: 20 };
  inv[7] = { item: ITEM.CORE_DISK, count: 1 };
  return Object.assign({
    version: 2, savedAt: 1700000000000, dimension: 'farmlands',
    player: {
      position: { x: -60000.5, y: 30, z: -33272.5 }, yaw: -1.5708, pitch: 0,
      hp: 96, maxHp: 175, dead: false,
      xp: 41, level: 6, attackBonus: 5, miningSpeedBonus: 0.9,
      chestsOpened: 4, selectedSlot: 0, inventory: inv,
    },
    sanity: 44,
    progression: {
      stage: 2, dayCount: 9, memoryFragments: 2, nightsRequired: 4,
      awaitingAdvance: false, behemothDefeated: true, behemothSpawned: true,
      compassAcquired: true, pendingLevel2Transition: false, fakeHavenTriggered: false,
      farmCrossroadsRecalled: true, farmJourneyOrd: 11, farmHouseSeen: true,
      killCount: 88, riftDisks: [ITEM.CORE_DISK], dimensionsBreached: [DIMENSION.OVERWORLD, DIMENSION.FARMLANDS],
    },
    time: { cycleSeconds: 300, wasNight: false },
    anchor: { x: -60004, y: 29, z: -33270, fuel: 90, riftActive: false, riftTargetLevel: null },
    world: { edits: { '-3751,-2080': [500, 0] }, openedChests: ['-60010,28,-33270'] },
    objectives: { overworld: 5, farmlands: 2, suburbia: 0, haven: 0 },
    settings: { masterVolume: 0.7 },
  }, over || {});
}
{
  const r = validateSaveState(xpEraSave());
  chk(r.ok, 'a schema 2 XP-era save still loads' + (r.ok ? '' : ': ' + r.error));
  const s = r.state;
  chk(s.version === SAVE_VERSION, `and comes out at schema ${s.version}`);
  chk(r.repairs.some(x => /migrated from schema 2/.test(x)), 'with the migration reported rather than silent');

  // THE CURRENCY IS GONE.
  chk(!('xp' in s.player), 'the XP counter did not survive the migration');
  chk(!('level' in s.player), 'nor did the level it fed');

  // THE CONSEQUENCES ARE NOT.
  chk(s.player.maxHp === 175, `the max health XP already bought survives exactly (${s.player.maxHp})`);
  chk(s.player.attackBonus === 5 && Math.abs(s.player.miningSpeedBonus - 0.9) < 1e-9,
      `so do the attack (+${s.player.attackBonus}) and mining (+${s.player.miningSpeedBonus}) bonuses`);
  chk(s.player.hp === 96, 'and their current health');

  // EVERYTHING ELSE THE SAVE WAS.
  chk(s.dimension === 'farmlands' && Math.abs(s.player.position.x + 60000.5) < 1e-9,
      'the dimension and the position are untouched');
  chk(s.player.inventory[0].item === ITEM.IRON_PICKAXE && s.player.inventory[3].count === 20 &&
      s.player.inventory[7].item === ITEM.CORE_DISK,
      'the pack is untouched');
  chk(s.progression.compassAcquired === true, 'THE COMPASS SURVIVES');
  chk(s.progression.behemothDefeated === true && s.progression.stage === 2 && s.progression.dayCount === 9,
      'the Behemoth latch, the stage and the day count survive');
  chk(s.progression.farmJourneyOrd === 11 && s.progression.farmHouseSeen === true,
      'so does the Farmland journey progress');
  chk(s.objectives.overworld === 5 && s.objectives.farmlands === 2, 'and the Phase 25 objective marks');
  chk(Object.keys(s.world.edits).length === 1 && s.world.openedChests.length === 1,
      'and the world edits and opened chests');
}
{
  /* THE DOUBLE-GRANT TRAP, and it is the whole reason the migration is not two deletes.
     This player has already survived nine days, already felled the Behemoth and already
     has an anchor. If they came back with an empty milestone set, the next dawn would
     hand them health for a night they survived weeks ago. */
  const s = validateSaveState(xpEraSave()).state;
  chk(s.progression.milestones.join(',') === 'shelter,firstNight,behemoth',
      `the migration derives all three as already lived (${s.progression.milestones.join(', ')})`);

  const Game = g('Game');
  const receiver = { milestones: new Set(s.progression.milestones), player: { maxHp: s.player.maxHp, hp: s.player.hp }, ui: null };
  for (const id of g('PROGRESSION_MILESTONE_IDS')) Game.prototype._reachMilestone.call(receiver, id);
  chk(receiver.player.maxHp === 175,
      `so replaying every milestone against the restored player grants NOTHING (${receiver.player.maxHp} max health, unchanged)`);
}
{
  // The other side of it: a save from a player who genuinely has not done these things.
  const early = xpEraSave();
  early.progression = Object.assign({}, early.progression,
    { dayCount: 1, behemothDefeated: false, behemothSpawned: false });
  early.anchor = null;
  const s = validateSaveState(early).state;
  chk(s.progression.milestones.length === 0,
      'a schema 2 save from day 1, with no anchor and no Behemoth, derives NO milestones');
  note('so the three ahead of that player are the three they genuinely have not reached');

  const mid = xpEraSave();
  mid.progression = Object.assign({}, mid.progression, { behemothDefeated: false });
  const sm = validateSaveState(mid).state;
  chk(sm.progression.milestones.join(',') === 'shelter,firstNight',
      'and one who has an anchor and survived nights, but never met the Behemoth, derives exactly two');
}
{
  // The whole ladder, from the oldest schema the game ever wrote.
  chk(typeof SAVE_MIGRATIONS[1] === 'function' && typeof SAVE_MIGRATIONS[2] === 'function',
      'both rungs of the migration ladder exist');
  const v1 = xpEraSave({ version: 1 });
  delete v1.objectives;
  const r = validateSaveState(v1);
  chk(r.ok && r.state.version === SAVE_VERSION,
      `a version 1 Phase 23 save climbs the whole ladder to ${SAVE_VERSION}`);
  chk(!('level' in r.state.player) && r.state.player.maxHp === 175 &&
      r.state.progression.milestones.length === 3 && r.state.progression.compassAcquired === true,
      'losing its XP, keeping its health, its compass and its lived milestones');
}
{
  // A hostile / dented milestone list must not become progression.
  /* Written at the CURRENT schema, so the validator is what handles them: on a schema 2
     file the migration replaces a missing-or-malformed list before the validator ever
     sees it, which is correct but tests the wrong layer. */
  const cur = () => xpEraSave({ version: SAVE_VERSION });
  const inv1 = cur(); inv1.progression = Object.assign({}, inv1.progression, { milestones: 'shelter' });
  const r1 = validateSaveState(inv1);
  chk(r1.ok && r1.state.progression.milestones.length === 0 && r1.repairs.some(x => /milestones/.test(x)),
      'a milestone list that is not a list is repaired to none, and reported');
  const inv2 = cur();
  inv2.progression = Object.assign({}, inv2.progression, { milestones: ['behemoth', 'behemoth', 'ascend', 'shelter'] });
  const r2 = validateSaveState(inv2);
  chk(r2.ok && r2.state.progression.milestones.join(',') === 'shelter,behemoth',
      'duplicates collapse, unknown ids are dropped, and the order is the table’s, not the file’s');
  const inv3 = cur(); delete inv3.progression.milestones;
  chk(validateSaveState(inv3).state.progression.milestones.length === 0,
      'and an absent list is simply none reached, with no repair reported');
}

// =====================================================================================
// 5. A NEW GAME, AND REPEATED CYCLES
// =====================================================================================
{
  const d = defaultSaveState(null);
  chk(!('xp' in d.player) && !('level' in d.player), 'a New Game has no XP and no level');
  chk(d.player.maxHp === 100 && d.player.attackBonus === 0 && d.player.miningSpeedBonus === 0,
      'it starts at the baseline: 100 health, no bonuses');
  chk(d.progression.milestones.length === 0, 'and no milestone reached');
  chk(JSON.stringify(d).indexOf('"xp"') < 0 && JSON.stringify(d).indexOf('"level"') < 0,
      'the serialised new-game state contains neither word anywhere');
}
{
  /* NO STATE ACCUMULATES BETWEEN SAVES. Twenty round trips through the validator: if
     anything in the progression model were additive, this is where it would show. */
  let s = validateSaveState(xpEraSave()).state;
  const first = JSON.stringify(s);
  for (let i = 0; i < 20; i++) {
    const r = validateSaveState(JSON.parse(JSON.stringify(s)));
    if (!r.ok) { chk(false, 'cycle ' + i + ' failed: ' + r.error); break; }
    s = r.state;
  }
  chk(JSON.stringify(s) === first, '20 save/load cycles are byte-stable — nothing accumulates, nothing drifts');
  chk(s.progression.milestones.length === 3 && s.player.maxHp === 175,
      'and the milestones and the health they represent are exactly where they started');
}

// =====================================================================================
// 6. WHAT XP REMOVAL WAS NOT ALLOWED TO TAKE WITH IT
// =====================================================================================
{
  // MINING. The break maths still run, and they no longer need a bonus to do it.
  const computeBreakTime = g('computeBreakTime');
  const BLOCK = g('BLOCK'), ITEM_DATA = g('ITEM_DATA');
  const bare = computeBreakTime(BLOCK.STONE, null, 0);
  const iron = computeBreakTime(BLOCK.STONE, ITEM_DATA[ITEM.IRON_PICKAXE], 0);
  chk(bare.time > 0 && bare.needsPickaxe && !bare.willDrop,
      `bare hands still cannot take stone (${bare.time.toFixed(2)}s, drops nothing)`);
  chk(iron.willDrop && iron.time < bare.time,
      `and an Iron Pickaxe still takes it faster and keeps it (${iron.time.toFixed(2)}s)`);
  note('THE TOOL is the mining progression now — no bonus was involved in either number');
  const legacy = computeBreakTime(BLOCK.STONE, ITEM_DATA[ITEM.IRON_PICKAXE], 0.9);
  chk(legacy.time < iron.time,
      'a legacy mining bonus off an old save still applies, so a returning player loses nothing');
}
{
  // COMBAT. A real mob, real damage, a real death and a real loot drop.
  const THREE = require('./harness/world.js').THREE;
  const Mob = g('Mob'), MobManager = g('MobManager'), MOB_TYPE = g('MOB_TYPE');
  const ItemEntityManager = g('ItemEntityManager');
  const scene = new THREE.Scene();
  const items = new ItemEntityManager(scene);
  items.setWorld(A.w);
  const mm = new MobManager(scene, A.w, items, null);
  const mob = new Mob(scene, MOB_TYPE.ZOMBIE, new THREE.Vector3(8, 40, 8), 1);
  mm.mobs.push(mob);
  chk(!('xpReward' in mob), 'a spawned mob carries no XP reward at all');
  const hp0 = mob.hp;
  const dir = new THREE.Vector3(1, 0, 0);
  const survived = mm.damageMob(mob, 5, dir, 3);
  chk(mob.hp === hp0 - 5 && survived === false, `a hit still lands (${hp0} -> ${mob.hp} hp)`);
  let killed = false;
  for (let i = 0; i < 20 && !killed; i++) killed = mm.damageMob(mob, 5, dir, 3);
  chk(killed === true && mob.hp <= 0, 'and enough of them still kill it');
  note('the kill pays its loot table and nothing else — there is no reward path left to pay');
}
{
  // The damage the player deals is the WEAPON's, plus whatever an old save carried.
  const ITEM_DATA = g('ITEM_DATA');
  chk(ITEM_DATA[ITEM.IRON_SWORD].damage > ITEM_DATA[ITEM.STONE_SWORD].damage &&
      ITEM_DATA[ITEM.STONE_SWORD].damage > ITEM_DATA[ITEM.WOODEN_SWORD].damage,
      `combat progression is the weapon: wood ${ITEM_DATA[ITEM.WOODEN_SWORD].damage} < stone ` +
      `${ITEM_DATA[ITEM.STONE_SWORD].damage} < iron ${ITEM_DATA[ITEM.IRON_SWORD].damage} damage`);
  chk(/this\.baseAttackDamage \+ this\.attackBonus \+ weaponDmg/.test(SCRIPT),
      'and the attack damage getter still adds a legacy save’s earned bonus on top');
}
{
  // RIFT / BEHEMOTH / DIMENSION progression: direct state, and no number in front of it.
  chk(/powerRiftCore\(targetLevel\)/.test(SCRIPT) && /riftActive = true/.test(SCRIPT),
      'the Rift still opens because a Core Disk was fed to the Anchor');
  chk(/if \(!this\.behemothDefeated && this\.player\.inventory\.hasItem\(ITEM\.CORE_DISK\)\)/.test(SCRIPT),
      'the Behemoth bridge is still its Core Disk landing in the pack');
  chk(/pendingLevel2Transition/.test(SCRIPT) && /_transitionToLevel2/.test(SCRIPT),
      'and the dimension transition still runs off that latch');
  note('none of these three consults a total of anything');
}
{
  // NO HIDDEN REPLACEMENT. The words a re-skinned XP would hide behind.
  const ITEM = g('ITEM');
  const suspects = ['corruption', 'insightPoints', 'fearPoints', 'memoryPoints', 'skillPoints',
                    'progressPoints', 'reputation', 'currency', 'playerRank'];
  const found = suspects.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(SCRIPT));
  chk(found.length === 0,
      'no renamed currency appeared in XP’s place' + (found.length ? ' — FOUND: ' + found.join(', ') : ''));
  /* memoryFragments is a real, pre-existing, player-facing survival counter ("2 / 4
     nights"), not a stat currency: it buys nothing, it is spent on nothing, and Phase 26
     did not touch it. Named here so it is an allowed exception rather than an oversight. */
  chk(/memoryFragments\+\+/.test(SCRIPT) && !/memoryFragments[\s\S]{0,80}maxHp \+=/.test(SCRIPT),
      'and memoryFragments — the nights-survived counter — still buys no stat, as it never did');
}

console.log('');
if (fail) { console.log(fail + ' FAILURES'); process.exit(1); }
console.log('ALL PHASE 26 PROGRESSION CHECKS PASS');
note('Offline. No browser, no WebGL, and no human played this.');
