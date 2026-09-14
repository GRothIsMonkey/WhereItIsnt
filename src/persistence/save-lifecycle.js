"use strict";
/* =====================================================================================
   PHASE 23 — THE SAVE LIFECYCLE
   ERA 1.5.4 — EXTRACTED VERBATIM FROM game.html.

   Migrations, validation, world capture/restore, safe landing, and SaveSystem itself.
   Era 1.5.2 moved the save SCHEMA constants and left this here on purpose: it is the
   lifecycle, not the schema, and it only made sense to move once Game moved with it.

   This is a CLASSIC script, not an ES module. It shares one global lexical scope with
   every other file in src/ and with game.html's inline <script>, which is why the move
   needed no code change. Load order is declared in game.html and mirrored by
   tests/harness/load.js; see ARCHITECTURE.md.
   ===================================================================================== */

/* =====================================================================================
   PHASE 23 — SAVE / LOAD

   WHAT IS SAVED, AND WHAT IS NOT.

   Nothing here serialises the runtime. No renderer, no scene graph, no mesh, no
   material, no texture, no DOM node, no AudioContext, no listener, no generated
   geometry and no frame-local timer ever reaches the storage layer. What is written is
   the STATE the world is a function of:

       deterministic generation  +  the player's persistent edits  =  the current world

   so a load reconstructs the world by running the same generators against the same
   coordinates and then replaying the edit deltas over them — which is exactly what the
   chunk streamer already does every time a chunk unloads and comes back.

   THE THREE LAYERS, kept apart on purpose so each can be tested without the other two:

     1. VALIDATION      validateSaveState() — a pure function. No world, no DOM, no
                        THREE. Takes anything at all (a parsed JSON blob from storage,
                        a hand-edited file, garbage) and returns either a rejection with
                        a reason, or a fully-typed state object plus the list of repairs
                        it had to make to get there. Nothing downstream ever reads a
                        field this function did not construct.
     2. WORLD STATE     captureWorldState() / restoreWorldState() — take a VoxelWorld and
                        nothing else, so the offline suite can round-trip real edits
                        through a real generated world with no Game and no browser.
     3. ORCHESTRATION   Game.captureSaveState() / Game.applySaveState() — the one
                        authoritative teardown-and-rebuild path. Save, Load, Continue and
                        New Game all funnel through it; there is no second route that
                        could drift from it.

   THE STORAGE CONTRACT. A failed write must never cost the player the save they already
   had, so SaveSystem copies the current payload to a backup key BEFORE overwriting the
   primary, and puts the backup back if the write throws. A read that cannot validate the
   primary falls through to the backup rather than reporting "no save".

   PHASE 26 — WHAT THE SCHEMA CARRIES NOW THAT XP IS GONE. Neither `xp` nor `level` is in
   the schema: the first was never in it, and the second went out with schema 3. What the
   player has already EARNED — max health, attack bonus, mining bonus — is still
   persisted, because deleting those on load would be destroying progress rather than
   declining to store a number. Schema 3 adds `progression.milestones`, the latch set for
   PROGRESSION_MILESTONES, and its migration is the interesting one: see SAVE_MIGRATIONS.
   ===================================================================================== */

/* MIGRATION HOOKS. Keyed by the version being migrated FROM; each returns the state one
   version newer. The ladder is run by validateSaveState before anything is validated, so
   a migration only has to produce the SHAPE of the newer schema — the validator still
   checks every field afterwards.

   1 -> 2 (PHASE 25). Version 2 adds the objective chains' high-water marks. A version 1
   save has none, and zeroing them is lossless rather than merely safe: the objective
   system re-derives its position on the first evaluation after the load, so a Phase 23
   save of a player who already has torches, an Anchor and a Core Disk is credited with
   all three the moment the world comes back. Nothing regresses and nothing is lost.

   2 -> 3 (PHASE 26). XP REMOVAL, AND THE ONE THING IT COULD HAVE GOT WRONG. Dropping
   `player.level` (and `player.xp`, which some hand-written or third-party file may carry
   even though this game never wrote it) is the easy half — nothing reads either field any
   more. The hard half is `progression.milestones`.

   A schema-2 save was written by a player who has already lived through the three events
   PROGRESSION_MILESTONES now grants max health for, and whose saved `maxHp` ALREADY
   includes whatever the old XP curve paid them for it. Defaulting their milestone set to
   empty would leave every milestone armed, so the next night they survived would hand
   them a second helping of health for a night they survived weeks ago. So the migration
   DERIVES which milestones that save has already lived, from state it already carries —
   an anchor in the file, a day count past the first, the Behemoth latch — and marks them
   reached WITHOUT granting anything. The player's max health comes across exactly as they
   left it, and the milestones ahead of them are the ones they genuinely have not reached.

   This consumes old XP-era data (`dayCount`, `behemothDefeated`, the anchor) exactly once,
   at migration, to preserve progression. It does not keep XP alive: nothing it writes is a
   currency, and the runtime it hands the save to has no XP in it.

   3 -> 4 (PHASE 28). TUTORIAL REMOVAL, AND THE ONE THING IT COULD HAVE GOT WRONG.
   Version 4 adds `progression.onboarding`: which of the three contextual cues the player
   has already answered. A new game starts with none, which is correct — nobody has
   pressed anything yet.

   A SCHEMA-3 SAVE IS NOT A NEW GAME. It was written by somebody who reached the start
   screen when the six-page tutorial was still in front of it, who therefore either read
   it or deliberately skipped it, and who has in any case been playing long enough to have
   a save. Defaulting them to "has learned nothing" would greet a returning player with
   LMB · CHOP over the first tree they looked at — the exact patronising beat this phase
   exists to delete. So the migration marks every cue answered. This is the same shape of
   reasoning as 2 -> 3 above: derive what the old save has already lived rather than
   letting a new field default to a lie.

   4 -> 5 (PHASE 31). Version 5 adds `progression.noticed`: which pieces of environmental
   storytelling the player has stood in front of. Unlike every migration above it, this
   one derives nothing and defaults to empty — and that is the correct answer rather than
   the lazy one. The three objects the latch tracks are new in this phase, so no version-4
   player can have seen any of them; an empty set is what actually happened. Marking them
   noticed would put a Suburbia callback and a Haven callback in front of a player who has
   never met the original, which is precisely the prop this phase exists not to build.

   Nothing else in the schema moved at any step. Every version-3 field is carried across
   untouched, and a version-3 file remains fully loadable. */
const SAVE_MIGRATIONS = {
  4: (state) => {
    const out = Object.assign({}, state);
    out.version = 5;
    const rawG4 = _svPlainObject(out.progression) || {};
    const progression4 = Object.assign({}, rawG4);
    /* NOTHING TO DERIVE, AND THAT IS THE POINT. Every previous migration in this ladder
       had to work out what an old save had already LIVED, because it was adding a field
       for something the player had been doing all along. This one is not: the objects
       `noticed` tracks did not exist in any build that wrote a version-4 file, so nobody
       has stood in front of one, and an empty set is the literal truth rather than a
       convenient default. Marking them noticed would hand a returning player two
       Suburbia callbacks and a Haven callback for originals they have never seen. */
    if (!Array.isArray(progression4.noticed)) progression4.noticed = [];
    out.progression = progression4;
    return out;
  },
  1: (state) => {
    const out = Object.assign({}, state);
    out.version = 2;
    out.objectives = { overworld: 0, farmlands: 0, suburbia: 0, haven: 0 };
    return out;
  },
  3: (state) => {
    const out = Object.assign({}, state);
    out.version = 4;
    const rawG3 = _svPlainObject(out.progression) || {};
    const progression3 = Object.assign({}, rawG3);
    /* Everything, because this player was shown the tutorial. See the note above. */
    if (!Array.isArray(progression3.onboarding)) progression3.onboarding = ONBOARDING_CUE_IDS.slice();
    out.progression = progression3;
    return out;
  },
  2: (state) => {
    const out = Object.assign({}, state);
    out.version = 3;

    /* The XP-era player fields, dropped rather than carried. maxHp / attackBonus /
       miningSpeedBonus are deliberately NOT touched: they are what XP bought. */
    const rawP = _svPlainObject(out.player);
    if (rawP) {
      const player = Object.assign({}, rawP);
      delete player.level;
      delete player.xp;
      out.player = player;
    }

    const rawG = _svPlainObject(out.progression) || {};
    const progression = Object.assign({}, rawG);
    if (!Array.isArray(progression.milestones)) {
      const reached = [];
      if (_svPlainObject(out.anchor)) reached.push('shelter');
      const day = Number(rawG.dayCount);
      if (Number.isFinite(day) && day > 1) reached.push('firstNight');
      if (rawG.behemothDefeated === true) reached.push('behemoth');
      progression.milestones = reached;
    }
    out.progression = progression;
    return out;
  },
};

/* ---------------------------------------------------------------------------------
   VALIDATION PRIMITIVES

   Every one of them takes the repair log, so a save that is merely dented is repaired
   and the player is told what was repaired, while a save that is structurally wrong is
   rejected outright. `undefined` always means "field absent" and takes the default
   silently: that is what lets a future schema add a field without every older save
   reporting a repair.
   --------------------------------------------------------------------------------- */
function _svNum(rep, path, raw, def, min, max) {
  if (raw === undefined || raw === null) return def;
  const n = typeof raw === 'number' ? raw : (typeof raw === 'string' ? parseFloat(raw) : NaN);
  if (!Number.isFinite(n)) { rep.push(path + ' was not a finite number; using ' + def); return def; }
  if (n < min) { rep.push(path + ' was ' + n + ', below ' + min + '; clamped'); return min; }
  if (n > max) { rep.push(path + ' was ' + n + ', above ' + max + '; clamped'); return max; }
  return n;
}
function _svInt(rep, path, raw, def, min, max) {
  return Math.round(_svNum(rep, path, raw, def, min, max));
}
function _svBool(rep, path, raw, def) {
  if (raw === undefined || raw === null) return !!def;
  if (typeof raw === 'boolean') return raw;
  rep.push(path + ' was not a boolean; using ' + !!def);
  return !!def;
}
function _svPlainObject(raw) {
  return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : null;
}
function _svArray(raw) { return Array.isArray(raw) ? raw : []; }

/* PHASE 26 — the milestone latch set, validated against the authored table rather than
   accepted as written. A save cannot invent a milestone, cannot list one twice, and
   cannot control the order they come back in. Absent means "none reached", which is
   correct for a new game and is never what a migrated schema-2 save gets (see the 2 -> 3
   migration, which derives the set the player has actually lived). */
function _svMilestones(rep, raw) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) { rep.push('progression.milestones was not a list; using none'); return []; }
  const seen = new Set();
  for (const v of raw) { if (typeof v === 'string') seen.add(v); }
  const out = PROGRESSION_MILESTONE_IDS.filter(id => seen.has(id));
  if (out.length !== raw.length) rep.push('progression.milestones contained entries this build does not know; they were dropped');
  return out;
}

/* PHASE 28 — which onboarding cues have been answered, filtered against the authored
   table exactly the way the milestone set is. A save cannot invent a cue, cannot list one
   twice and cannot control the order. Absent means "none answered", which is correct for
   a new game and is never what a migrated schema-3 save gets (see the 3 -> 4 migration,
   which marks all of them, because that player was shown the tutorial). */
function _svOnboarding(rep, raw) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) { rep.push('progression.onboarding was not a list; using none'); return []; }
  const seen = new Set();
  for (const v of raw) { if (typeof v === 'string') seen.add(v); }
  const out = ONBOARDING_CUE_IDS.filter(id => seen.has(id));
  if (out.length !== raw.length) rep.push('progression.onboarding contained entries this build does not know; they were dropped');
  return out;
}

/* PHASE 31 — which pieces of environmental storytelling have been noticed, filtered
   against the authored table exactly the way the milestone and onboarding sets are. A
   save cannot invent an event, cannot list one twice and cannot control the order. Absent
   means "none", which is correct both for a new game and for a save written before this
   phase existed — see the 4 -> 5 migration for why that needs no derivation. */
function _svNoticed(rep, raw) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) { rep.push('progression.noticed was not a list; using none'); return []; }
  const seen = new Set();
  for (const v of raw) { if (typeof v === 'string') seen.add(v); }
  const out = ENV_STORY_IDS.filter(id => seen.has(id));
  if (out.length !== raw.length) rep.push('progression.noticed contained entries this build does not know; they were dropped');
  return out;
}

/* Keys are re-parsed and re-emitted rather than trusted, which is what keeps a crafted
   file from smuggling "__proto__" or "constructor" in as a chunk key: only strings this
   function BUILDS from parsed integers ever become object keys downstream. */
function _svChunkKey(raw) {
  if (typeof raw !== 'string') return null;
  const m = /^(-?\d{1,8}),(-?\d{1,8})$/.exec(raw);
  if (!m) return null;
  const cx = parseInt(m[1], 10), cz = parseInt(m[2], 10);
  const lim = SAVE_COORD_LIMIT / CHUNK_SX;
  if (!Number.isFinite(cx) || !Number.isFinite(cz)) return null;
  if (Math.abs(cx) > lim || Math.abs(cz) > lim) return null;
  return cx + ',' + cz;
}
function _svBlockKey(raw) {
  if (typeof raw !== 'string') return null;
  const m = /^(-?\d{1,8}),(-?\d{1,8}),(-?\d{1,8})$/.exec(raw);
  if (!m) return null;
  const x = parseInt(m[1], 10), y = parseInt(m[2], 10), z = parseInt(m[3], 10);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  if (Math.abs(x) > SAVE_COORD_LIMIT || Math.abs(z) > SAVE_COORD_LIMIT) return null;
  if (y < 0 || y >= CHUNK_SY) return null;
  return x + ',' + y + ',' + z;
}

/* Which dimension does a world position belong to? The regions are disjoint bands of the
   single shared coordinate space, so this is decidable from the position alone — which
   is what lets the loader catch "dimension says farmlands, coordinates say overworld"
   instead of teleporting the player into empty sky. */
function saveDimensionAtWorldPos(wx, wz) {
  if (isFakeHavenWorldPos(wx, wz)) return 'fake_haven';
  if (isFarmlandsWorldPos(wx, wz)) return 'farmlands';
  if (isStaticSuburbiaWorldPos(wx, wz)) return 'suburbia';
  return 'overworld';
}

/* ---------------------------------------------------------------------------------
   THE VALIDATOR

   Returns { ok, error, state, repairs }. `ok:false` means the save must not be applied
   at all; `ok:true` with a non-empty `repairs` means it was applied after being fixed,
   and the player is told so. JSON.parse succeeding is not validity and is never treated
   as such — every branch below is a thing a syntactically perfect JSON file can get
   wrong.
   --------------------------------------------------------------------------------- */
function validateSaveState(input) {
  const rep = [];
  const fail = (msg) => ({ ok: false, error: msg, state: null, repairs: rep });

  const root = _svPlainObject(input);
  if (!root) return fail('The save is not a save object.');

  // --- VERSION, and the migration ladder ------------------------------------------
  const version = root.version;
  if (typeof version !== 'number' || !Number.isFinite(version) || Math.floor(version) !== version) {
    return fail('The save has no usable schema version.');
  }
  if (version > SAVE_VERSION) {
    return fail('This save was written by a newer version of the game (schema ' +
                version + '; this build reads up to ' + SAVE_VERSION + ').');
  }
  let src = root;
  for (let v = version; v < SAVE_VERSION; v++) {
    const mig = SAVE_MIGRATIONS[v];
    if (typeof mig !== 'function') return fail('No migration exists from schema ' + v + '.');
    src = _svPlainObject(mig(src));
    if (!src) return fail('Migration from schema ' + v + ' produced nothing usable.');
    rep.push('migrated from schema ' + v + ' to ' + (v + 1));
  }

  // --- DIMENSION. Unknown dimensions are a hard reject, never a guess. -------------
  const dimension = src.dimension;
  if (typeof dimension !== 'string' || SAVE_DIMENSIONS.indexOf(dimension) < 0) {
    return fail('The save names a dimension this build cannot open (' +
                (typeof dimension === 'string' ? dimension : typeof dimension) + ').');
  }

  // --- PLAYER ----------------------------------------------------------------------
  const rawP = _svPlainObject(src.player);
  if (!rawP) return fail('The save has no player state.');

  const maxHp = _svInt(rep, 'player.maxHp', rawP.maxHp, 100, 1, 10000);
  let hp = _svNum(rep, 'player.hp', rawP.hp, maxHp, 0, maxHp);
  /* A SAVE IS NEVER RESTORED DEAD. The game's own death handling is a respawn at full
     health, so a save written with no health left (or with the death latch set) comes
     back alive rather than dropping the player straight back into the death handler on
     the first frame after a load. */
  if (hp <= 0 || rawP.dead === true) {
    rep.push('the save was written with the player dead or at zero health; restored alive');
    hp = maxHp;
  }

  const finite3 = (o) => o && Number.isFinite(o.x) && Number.isFinite(o.y) && Number.isFinite(o.z);
  const rawPos = _svPlainObject(rawP.position);
  let posValid = true, pos = { x: 0, y: 0, z: 0 };
  if (!finite3(rawPos)) {
    posValid = false;
    rep.push('player.position was missing or not finite; a safe landing will be chosen');
  } else if (Math.abs(rawPos.x) > SAVE_COORD_LIMIT || Math.abs(rawPos.z) > SAVE_COORD_LIMIT ||
             rawPos.y < -64 || rawPos.y > CHUNK_SY + 64) {
    posValid = false;
    rep.push('player.position was outside the world; a safe landing will be chosen');
  } else if (saveDimensionAtWorldPos(rawPos.x, rawPos.z) !== dimension) {
    posValid = false;
    rep.push('player.position is not inside ' + dimension + '; a safe landing will be chosen');
  } else {
    pos = { x: rawPos.x, y: rawPos.y, z: rawPos.z };
  }

  /* ORIENTATION is a resume comfort, not a safety property, so a broken one is simply
     replaced with "facing north, level" instead of invalidating the save. */
  const yaw = _svNum(rep, 'player.yaw', rawP.yaw, 0, -1e6, 1e6);
  const pitch = _svNum(rep, 'player.pitch', rawP.pitch, 0, -Math.PI / 2, Math.PI / 2);

  const rawInv = _svArray(rawP.inventory);
  const inventory = new Array(INVENTORY_SIZE).fill(null);
  for (let i = 0; i < INVENTORY_SIZE; i++) {
    const slot = _svPlainObject(rawInv[i]);
    if (!slot) continue;
    const item = slot.item;
    if (typeof item !== 'number' || !Number.isFinite(item) || item === ITEM.NONE) continue;
    if (!ITEM_DATA[item]) { rep.push('inventory slot ' + i + ' held unknown item ' + item + '; dropped'); continue; }
    /* AN EMPTY OR NEGATIVE STACK IS A SLOT THAT SHOULD NOT EXIST, so it is dropped
       rather than clamped up to one — clamping would MINT an item the save never had,
       which is the one thing a loader must never do. */
    const rawCount = slot.count;
    let count = 1;
    if (rawCount !== undefined && rawCount !== null) {
      const n = typeof rawCount === 'number' ? rawCount : parseFloat(rawCount);
      if (!Number.isFinite(n)) { rep.push('inventory slot ' + i + ' had no usable count; treated as one'); }
      else if (n <= 0) { rep.push('inventory slot ' + i + ' held an empty stack; dropped'); continue; }
      else if (n > 64) { rep.push('inventory slot ' + i + ' held ' + n + '; clamped to one stack'); count = 64; }
      else count = Math.round(n) || 1;
    }
    inventory[i] = { item: item, count: count };
  }
  const selectedSlot = _svInt(rep, 'player.selectedSlot', rawP.selectedSlot, 0, 0, HOTBAR_SIZE - 1);

  const player = {
    position: pos,
    positionValid: posValid,
    yaw: yaw,
    pitch: pitch,
    hp: hp,
    maxHp: maxHp,
    /* PHASE 26 — what XP already bought, kept. The `level` that sat here is gone: it
       existed only because XP incremented it, and nothing reads it any more. A schema-2
       save's level field is dropped by the 2 -> 3 migration before this ever sees it. */
    attackBonus: _svNum(rep, 'player.attackBonus', rawP.attackBonus, 0, 0, 999),
    miningSpeedBonus: _svNum(rep, 'player.miningSpeedBonus', rawP.miningSpeedBonus, 0, 0, 999),
    chestsOpened: _svInt(rep, 'player.chestsOpened', rawP.chestsOpened, 0, 0, 1e6),
    selectedSlot: selectedSlot,
    inventory: inventory,
  };

  // --- SANITY ----------------------------------------------------------------------
  const sanity = _svNum(rep, 'sanity', src.sanity, 100, 0, 100);

  // --- PROGRESSION -----------------------------------------------------------------
  const rawG = _svPlainObject(src.progression) || {};
  const stage = _svInt(rep, 'progression.stage', rawG.stage, 1, 1, 999);
  const progression = {
    stage: stage,
    dayCount: _svInt(rep, 'progression.dayCount', rawG.dayCount, 1, 1, 1e6),
    memoryFragments: _svInt(rep, 'progression.memoryFragments', rawG.memoryFragments, 0, 0, 1e6),
    nightsRequired: _svInt(rep, 'progression.nightsRequired', rawG.nightsRequired, 2 + stage, 1, 1e6),
    awaitingAdvance: _svBool(rep, 'progression.awaitingAdvance', rawG.awaitingAdvance, false),
    behemothDefeated: _svBool(rep, 'progression.behemothDefeated', rawG.behemothDefeated, false),
    behemothSpawned: _svBool(rep, 'progression.behemothSpawned', rawG.behemothSpawned, false),
    compassAcquired: _svBool(rep, 'progression.compassAcquired', rawG.compassAcquired, false),
    pendingLevel2Transition: _svBool(rep, 'progression.pendingLevel2Transition', rawG.pendingLevel2Transition, false),
    fakeHavenTriggered: _svBool(rep, 'progression.fakeHavenTriggered', rawG.fakeHavenTriggered, false),
    farmCrossroadsRecalled: _svBool(rep, 'progression.farmCrossroadsRecalled', rawG.farmCrossroadsRecalled, false),
    /* PHASE 26 — the milestone latch set. Rebuilt from scratch out of the known ids
       rather than trusted: an unknown id in the file is dropped, a duplicate collapses,
       and the order is the table's, so what comes out is always a legal set. */
    milestones: _svMilestones(rep, rawG.milestones),
    /* PHASE 28 — the onboarding cue latch set, validated the same way and for the same
       reason. It gates nothing but three two-word lines above the hotbar. */
    onboarding: _svOnboarding(rep, rawG.onboarding),
    /* PHASE 31 — the notice latch set. It gates whether two objects exist in Static
       Suburbia and one in the Haven, so an invented id here would be a callback the
       player never earned; the filter is what makes that impossible. */
    noticed: _svNoticed(rep, rawG.noticed),
    farmJourneyOrd: _svInt(rep, 'progression.farmJourneyOrd', rawG.farmJourneyOrd, 0, -1e6, 1e6),
    farmHouseSeen: _svBool(rep, 'progression.farmHouseSeen', rawG.farmHouseSeen, false),
    killCount: _svInt(rep, 'progression.killCount', rawG.killCount, 0, 0, 1e9),
    riftDisks: [],
    dimensionsBreached: [DIMENSION.OVERWORLD],
  };
  for (const d of _svArray(rawG.riftDisks)) {
    if (typeof d === 'number' && ITEM_DATA[d] && progression.riftDisks.indexOf(d) < 0) progression.riftDisks.push(d);
  }
  for (const d of _svArray(rawG.dimensionsBreached)) {
    if (typeof d === 'number' && d >= DIMENSION.OVERWORLD && d <= DIMENSION.FAKE_HAVEN &&
        progression.dimensionsBreached.indexOf(d) < 0) progression.dimensionsBreached.push(d);
  }

  // --- TEMPORAL --------------------------------------------------------------------
  /* The clock is stored as SECONDS WITHIN THE CURRENT CYCLE, not as the raw accumulating
     `t`. Gameplay reads nothing else from it (isDay/isNight/dayFraction are all derived
     from `t % cycleLength`), so this is lossless for the state that matters, bounded,
     and immune to a save carrying an ever-growing float. Frame-local animation timers
     are not saved at all. */
  const rawT = _svPlainObject(src.time) || {};
  const time = {
    cycleSeconds: _svNum(rep, 'time.cycleSeconds', rawT.cycleSeconds, 60, 0, 86400),
    wasNight: _svBool(rep, 'time.wasNight', rawT.wasNight, false),
  };

  // --- ANCHOR ----------------------------------------------------------------------
  let anchor = null;
  const rawA = _svPlainObject(src.anchor);
  if (rawA) {
    const ax = _svInt(rep, 'anchor.x', rawA.x, NaN, -SAVE_COORD_LIMIT, SAVE_COORD_LIMIT);
    const ay = _svInt(rep, 'anchor.y', rawA.y, NaN, 0, CHUNK_SY - 1);
    const az = _svInt(rep, 'anchor.z', rawA.z, NaN, -SAVE_COORD_LIMIT, SAVE_COORD_LIMIT);
    if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(az)) {
      rep.push('the anchor record had no usable position; the anchor was dropped');
    } else {
      const lvl = _svInt(rep, 'anchor.riftTargetLevel', rawA.riftTargetLevel, 0, 0, 4);
      anchor = {
        x: ax, y: ay, z: az,
        fuel: _svNum(rep, 'anchor.fuel', rawA.fuel, 0, 0, 300),
        riftActive: _svBool(rep, 'anchor.riftActive', rawA.riftActive, false),
        riftTargetLevel: (lvl === 2 || lvl === 3) ? lvl : null,
      };
      if (anchor.riftActive && anchor.riftTargetLevel === null) {
        rep.push('the anchor claimed an open rift with no destination; the rift was closed');
        anchor.riftActive = false;
      }
      /* PHASE 35 — AN ANCHOR BELONGS TO ONE DIMENSION, AND IT IS THE ONE IT STANDS IN.

         The three dimensions occupy disjoint bands of the same coordinate space, so
         "which dimension is this monument in" is a pure coordinate test. A record that
         fails it is not a recoverable Anchor: the block it stands for is not in the
         world the player is about to load into, so restoring it would put an invisible
         safe zone, a fuel counter and — far worse — a POWERED RIFT into a dimension that
         has no monument to walk up to. That is exactly the state a save written by a
         pre-Phase-35 build carries, because crossing a rift did not put the Anchor down;
         see Game._leaveDimension. Dropping it repairs those saves in place.

         Nothing the player earned is lost: an Anchor is four planks and the block itself
         is still standing where they left it. */
      if (anchor && dimensionOfWorldPos(anchor.x, anchor.z) !== dimension) {
        rep.push('the anchor stood in a different dimension from the one saved; it was dropped');
        anchor = null;
      }
    }
  }

  // --- WORLD -----------------------------------------------------------------------
  const rawW = _svPlainObject(src.world) || {};
  const edits = {};
  let editCount = 0, editsDropped = 0;
  const rawEdits = _svPlainObject(rawW.edits) || {};
  for (const rawKey of Object.keys(rawEdits)) {
    const key = _svChunkKey(rawKey);
    if (!key) { editsDropped++; continue; }
    const flat = _svArray(rawEdits[rawKey]);
    const out = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const idx = flat[i], id = flat[i + 1];
      if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= SAVE_CHUNK_VOXELS) { editsDropped++; continue; }
      if (typeof id !== 'number' || !Number.isInteger(id) || id < 0 || id >= BLOCK_ID_COUNT) { editsDropped++; continue; }
      if (editCount >= SAVE_MAX_EDITS) { editsDropped++; continue; }
      out.push(idx, id);
      editCount++;
    }
    if (out.length) edits[key] = out;
  }
  if (editsDropped) rep.push(editsDropped + ' malformed world edit(s) were discarded');

  const keySet = (raw, label) => {
    const out = [];
    let dropped = 0;
    for (const k of _svArray(raw)) {
      const ok = _svBlockKey(k);
      if (ok) { if (out.indexOf(ok) < 0) out.push(ok); } else dropped++;
    }
    if (dropped) rep.push(dropped + ' malformed ' + label + ' entr(ies) were discarded');
    return out;
  };
  const countMap = (raw, label, min, max) => {
    const out = [];
    let dropped = 0;
    for (const pair of _svArray(raw)) {
      if (!Array.isArray(pair) || pair.length < 2 || typeof pair[0] !== 'string' || !/^[-0-9,]{1,40}$/.test(pair[0])) { dropped++; continue; }
      const n = pair[1];
      if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) { dropped++; continue; }
      out.push([pair[0], Math.round(n)]);
    }
    if (dropped) rep.push(dropped + ' malformed ' + label + ' entr(ies) were discarded');
    return out;
  };

  const world = {
    edits: edits,
    editCount: editCount,
    openedChests: keySet(rawW.openedChests, 'opened-chest'),
    doors: keySet(rawW.doors, 'open-door'),
    torchDecay: countMap(rawW.torchDecay, 'torch-decay', 0, 1e6),
    suburbiaVisits: countMap(rawW.suburbiaVisits, 'suburb-visit', 0, 1e6),
    suburbiaStage: countMap(rawW.suburbiaStage, 'suburb-stage', 0, 1e6),
    suburbiaDoorOverrides: countMap(rawW.suburbiaDoorOverrides, 'suburb-door-override', 0, 3),
    mailboxSeen: _svBool(rep, 'world.mailboxSeen', rawW.mailboxSeen, false),
    mailboxGone: _svBool(rep, 'world.mailboxGone', rawW.mailboxGone, false),
  };

  /* --- OBJECTIVES ------------------------------------------------------------------
     Four small integers, each clamped to the length of the chain it indexes. A mark that
     is too large would silently skip the player past guidance they never received; one
     that is too small is harmless, because the system re-derives upward. Both are
     repaired rather than rejected — a broken objective mark is never worth refusing a
     save over. */
  const objectives = {};
  const rawO = _svPlainObject(src.objectives) || {};
  for (const k of OBJECTIVE_CHAIN_IDS) {
    const chain = OBJECTIVE_CHAINS[k] || [];
    objectives[k] = _svInt(rep, 'objectives.' + k, rawO[k], 0, 0, chain.length);
  }

  // --- SETTINGS (a snapshot; the browser-global settings remain the authority) ------
  const settings = {};
  const rawS = _svPlainObject(src.settings);
  if (rawS) {
    for (const k of Object.keys(SETTINGS_SCHEMA)) {
      if (Object.prototype.hasOwnProperty.call(rawS, k)) settings[k] = coerceSetting(k, rawS[k]);
    }
  }

  return {
    ok: true,
    error: null,
    repairs: rep,
    state: {
      version: SAVE_VERSION,
      savedAt: _svInt(rep, 'savedAt', src.savedAt, 0, 0, 1e15),
      dimension: dimension,
      player: player,
      sanity: sanity,
      progression: progression,
      time: time,
      anchor: anchor,
      world: world,
      objectives: objectives,
      settings: settings,
    },
  };
}

/* A one-line description of a save, for the Continue button and the menu. Derived, never
   stored, so it can never disagree with the state it describes. */
/* ERA 1.5.2 — DERIVED, from each descriptor's `saveLabel`. Note that a descriptor
   carries BOTH `canonicalName` ('Shattered Farmlands', which is what STORY.md calls it)
   and `saveLabel` ('The Shattered Farmlands', which is what this button has always
   shown). They are two different strings and deriving one from the other would have
   silently changed what a player reads. */
const SAVE_DIMENSION_NAMES = SAVEABLE_DIMENSION_NAMES;
function describeSaveState(state) {
  if (!state) return '';
  const where = SAVE_DIMENSION_NAMES[state.dimension] || state.dimension;
  return where + ' • Day ' + state.progression.dayCount;
}

/* ---------------------------------------------------------------------------------
   WORLD STATE — CAPTURE AND RESTORE

   Both take a VoxelWorld and nothing else. The edit map is written as a flat
   [idx, id, idx, id, ...] array per chunk rather than as an object of index keys: it is
   roughly a third of the JSON, and it round-trips through a Map with no key parsing.

   Nothing here generates, disposes or meshes a chunk. Restoring the registries is
   separate from rebuilding the world on purpose — the caller replaces the registries
   FIRST and regenerates AFTER, so the replay in _generateChunk sees the restored edits
   the first time each chunk is built rather than having to be re-applied over the top.
   --------------------------------------------------------------------------------- */
function captureWorldState(world) {
  const edits = {};
  let editCount = 0;
  for (const [key, m] of world.editedChunks) {
    if (!m || m.size === 0) continue;
    const flat = new Array(m.size * 2);
    let i = 0;
    for (const [idx, id] of m) { flat[i++] = idx; flat[i++] = id; }
    edits[key] = flat;
    editCount += m.size;
  }

  /* THE ONE-SHOT FARMLAND ANOMALY is written with _writeBlockRaw, which deliberately
     does not record an edit — it is meant to be forgotten if the chunk streams out. A
     save is not a stream-out: the latch says the mailbox is gone, so the voxel has to
     agree with the latch after a load. Recording it here is the only place the two are
     reconciled, and it costs one entry. */
  const mb = world.farmHomeMailbox;
  if (world._farmMailboxGone && mb) {
    const cx = Math.floor(mb.x / CHUNK_SX), cz = Math.floor(mb.z / CHUNK_SZ);
    const lx = ((mb.x % CHUNK_SX) + CHUNK_SX) % CHUNK_SX;
    const lz = ((mb.z % CHUNK_SZ) + CHUNK_SZ) % CHUNK_SZ;
    const key = cx + ',' + cz, idx = (mb.y * CHUNK_SZ + lz) * CHUNK_SX + lx;
    const flat = edits[key] || (edits[key] = []);
    let present = false;
    for (let i = 0; i < flat.length; i += 2) if (flat[i] === idx) { flat[i + 1] = BLOCK.AIR; present = true; break; }
    if (!present) { flat.push(idx, BLOCK.AIR); editCount++; }
  }

  const pairs = (map, pick) => {
    const out = [];
    for (const [k, v] of map) out.push([k, pick ? pick(v) : v]);
    return out;
  };

  return {
    edits: edits,
    editCount: editCount,
    openedChests: Array.from(world.openedChests),
    doors: Array.from(world.suburbiaDoorState.keys()),
    torchDecay: pairs(world.torchDecay, (rec) => Math.max(0, Math.round(rec.fuel))),
    suburbiaVisits: pairs(world.suburbiaVisits),
    suburbiaStage: pairs(world.suburbiaStage),
    suburbiaDoorOverrides: pairs(world.suburbiaDoorOverrides),
    mailboxSeen: !!world._farmMailboxSeen,
    mailboxGone: !!world._farmMailboxGone,
  };
}

function restoreWorldState(world, ws) {
  world.editedChunks = new Map();
  for (const key of Object.keys(ws.edits)) {
    const flat = ws.edits[key];
    const m = new Map();
    for (let i = 0; i + 1 < flat.length; i += 2) m.set(flat[i], flat[i + 1]);
    if (m.size) world.editedChunks.set(key, m);
  }

  world.openedChests = new Set(ws.openedChests);

  world.suburbiaDoorState = new Map();
  world._doorStateOrder = [];
  for (const k of ws.doors.slice(-DOOR_STATE_CAP)) {
    world.suburbiaDoorState.set(k, 1);
    world._doorStateOrder.push(k);
  }

  /* The decay ledger is rebuilt from its keys: the record's world coordinates are the
     key, so nothing else has to be stored for it to be exact. */
  world.torchDecay = new Map();
  for (const [k, fuel] of ws.torchDecay) {
    const parts = k.split(',');
    const wx = parseInt(parts[0], 10), wy = parseInt(parts[1], 10), wz = parseInt(parts[2], 10);
    if (!Number.isFinite(wx) || !Number.isFinite(wy) || !Number.isFinite(wz)) continue;
    world.torchDecay.set(k, { wx: wx, wy: wy, wz: wz, fuel: fuel });
  }

  world.suburbiaVisits = new Map(ws.suburbiaVisits);
  world._subVisitOrder = ws.suburbiaVisits.map(p => p[0]);
  world.suburbiaStage = new Map(ws.suburbiaStage);
  world._subStageOrder = ws.suburbiaStage.map(p => p[0]);
  world.suburbiaDoorOverrides = new Map(ws.suburbiaDoorOverrides);

  world._farmMailboxSeen = ws.mailboxSeen;
  world._farmMailboxGone = ws.mailboxGone;
}

/* ---------------------------------------------------------------------------------
   SAFE PLAYER PLACEMENT

   The saved position is a hypothesis, not an instruction. It is only accepted once the
   chunks it needs are resident AND a body of the player's real dimensions fits there.
   Everything below the first branch is repair, and every repair is DETERMINISTIC — the
   same broken save always lands in the same place, so a player who reloads twice does
   not end up somewhere different each time.

     1. the saved spot, if a real collision query says it is clear
     2. straight up from it, then straight down from it, in the same column
     3. the surface of a deterministic ring of nearby columns, nearest first
     4. the dimension's own canonical arrival point

   findSpawnHeight is used for the ring rather than a hand-rolled scan, because it is the
   same function the game's own spawn and respawn paths use.
   --------------------------------------------------------------------------------- */
function findSafeLanding(world, dimension, x, y, z, halfWidth, height) {
  /* A COLUMN IS ONLY A CANDIDATE IF THE WORLD ACTUALLY EXISTS THERE. getBlockWorld
     answers AIR for an ungenerated chunk, so without this test an out-of-range or
     never-generated coordinate would read as beautifully clear and drop the player
     through the bottom of the world. Every corner of the body's footprint is checked,
     not just its centre, because a chunk edge is exactly where this goes wrong. */
  const resident = (px, pz) => {
    if (!Number.isFinite(px) || !Number.isFinite(pz)) return false;
    if (Math.abs(px) > SAVE_COORD_LIMIT || Math.abs(pz) > SAVE_COORD_LIMIT) return false;
    for (const ox of [-halfWidth, halfWidth]) {
      for (const oz of [-halfWidth, halfWidth]) {
        if (!world.getChunk(Math.floor((px + ox) / CHUNK_SX), Math.floor((pz + oz) / CHUNK_SZ))) return false;
      }
    }
    return true;
  };
  const fits = (px, py, pz) => {
    if (py < 1 || py + height >= CHUNK_SY) return false;
    if (!resident(px, pz)) return false;
    return !world.collidesAABB({
      minX: px - halfWidth, maxX: px + halfWidth,
      minY: py, maxY: py + height,
      minZ: pz - halfWidth, maxZ: pz + halfWidth,
    });
  };

  if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
    if (fits(x, y, z)) return { x: x, y: y, z: z, repaired: false, reason: null };
    for (let dy = 1; dy <= 8; dy++) if (fits(x, y + dy, z)) return { x: x, y: y + dy, z: z, repaired: true, reason: 'lifted out of solid ground' };
    for (let dy = 1; dy <= 8; dy++) if (fits(x, y - dy, z)) return { x: x, y: y - dy, z: z, repaired: true, reason: 'dropped onto the surface below' };

    /* A deterministic ring walk: rings outward, and within a ring in a fixed order. No
       randomness anywhere, so the repair is reproducible and explainable. */
    for (let r = 1; r <= 6; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cx = Math.floor(x) + dx + 0.5, cz = Math.floor(z) + dz + 0.5;
          const gy = world.findSpawnHeight(Math.floor(cx), Math.floor(cz));
          if (fits(cx, gy, cz)) return { x: cx, y: gy, z: cz, repaired: true, reason: 'moved to clear ground nearby' };
        }
      }
    }
  }

  const fallback = saveFallbackSpawn(world, dimension);
  return { x: fallback.x, y: fallback.y, z: fallback.z, repaired: true, reason: 'returned to the arrival point for this dimension' };
}

/* The last-resort landing for each dimension: the exact point the game's own transition
   into that dimension uses, so a recovered player arrives somewhere the game already
   guarantees is safe rather than somewhere invented for the occasion. */
function saveFallbackSpawn(world, dimension) {
  if (dimension === 'farmlands' && world.farmlandsSpawn) return world.farmlandsSpawn.clone();
  if (dimension === 'suburbia' && world.suburbiaSpawn) return world.suburbiaSpawn.clone();
  const sx = WORLD_CHUNKS_X * CHUNK_SX / 2, sz = WORLD_CHUNKS_Z * CHUNK_SZ / 2;
  return new THREE.Vector3(sx, world.findSpawnHeight(Math.floor(sx), Math.floor(sz)), sz);
}

/* ---------------------------------------------------------------------------------
   STORAGE

   One slot, plus a backup of the payload it is about to replace. Deliberately not a
   multi-profile manager: the brief asks for robustness, and every additional slot is
   another thing that can half-write.
   --------------------------------------------------------------------------------- */
class SaveSystem {
  constructor(storage) {
    this.storage = storage || null;
    this._cached = undefined;    // undefined = not probed yet; null = nothing loadable
  }

  get available() { return !!this.storage; }

  _readKey(key) {
    try { return this.storage ? this.storage.getItem(key) : null; }
    catch (e) { return null; }
  }

  /* Parses and FULLY VALIDATES, falling through to the backup when the primary is
     unusable. Returns { ok, state, repairs, error, source }. */
  read() {
    if (!this.storage) return { ok: false, state: null, repairs: [], error: 'Browser storage is unavailable.', source: null };
    let lastError = 'No save found.';
    for (const source of ['primary', 'backup']) {
      const raw = this._readKey(source === 'primary' ? SAVE_STORAGE_KEY : SAVE_BACKUP_KEY);
      if (raw === null || raw === undefined || raw === '') continue;
      let parsed = null;
      try { parsed = JSON.parse(raw); }
      catch (e) { lastError = 'The save file is not readable.'; continue; }
      const res = validateSaveState(parsed);
      if (res.ok) return { ok: true, state: res.state, repairs: res.repairs, error: null, source: source };
      lastError = res.error;
    }
    return { ok: false, state: null, repairs: [], error: lastError, source: null };
  }

  /* Cheap for the start screen: probed once, then remembered. */
  peek() {
    if (this._cached === undefined) {
      const r = this.read();
      this._cached = r.ok ? r.state : null;
    }
    return this._cached;
  }

  /* THE WRITE ORDER IS THE WHOLE POINT. The payload is serialised and re-validated
     BEFORE anything is touched, then the existing save is copied to the backup key, and
     only then is the primary replaced. A throw at any step leaves at least one complete,
     valid payload on disk — never a partial one. */
  write(state) {
    if (!this.storage) return { ok: false, error: 'Browser storage is unavailable.', bytes: 0 };

    let text;
    try { text = JSON.stringify(state); }
    catch (e) { return { ok: false, error: 'The game state could not be serialised.', bytes: 0 }; }

    const check = validateSaveState(JSON.parse(text));
    if (!check.ok) return { ok: false, error: 'Refused to write an invalid save (' + check.error + ').', bytes: 0 };

    const previous = this._readKey(SAVE_STORAGE_KEY);
    if (previous) {
      try { this.storage.setItem(SAVE_BACKUP_KEY, previous); }
      catch (e) { /* no room for a backup is not a reason to refuse the save */ }
    }
    try {
      this.storage.setItem(SAVE_STORAGE_KEY, text);
    } catch (e) {
      /* Quota, private mode, or a storage that simply refuses. Put the old payload back
         so a failed save cannot be the thing that loses the good one. */
      if (previous) { try { this.storage.setItem(SAVE_STORAGE_KEY, previous); } catch (e2) { /* nothing more to try */ } }
      return { ok: false, error: 'The save could not be written (storage full or blocked).', bytes: text.length };
    }
    this._cached = check.state;
    return { ok: true, error: null, bytes: text.length };
  }

  clear() {
    try { if (this.storage) this.storage.removeItem(SAVE_STORAGE_KEY); } catch (e) { /* nothing to do */ }
    try { if (this.storage) this.storage.removeItem(SAVE_BACKUP_KEY); } catch (e) { /* nothing to do */ }
    this._cached = null;
  }

  invalidate() { this._cached = undefined; }
}

/* THE DOCUMENTED INITIAL STATE. A New Game is this state applied through the same path a
   load uses, which is what makes "a new game inherits nothing" true by construction
   rather than by a checklist. Routed through the validator so the shape a New Game
   produces and the shape a load produces are provably identical. */
function defaultSaveState(settings) {
  return validateSaveState({
    version: SAVE_VERSION,
    savedAt: 0,
    dimension: 'overworld',
    player: {
      position: null,          // no saved position: the arrival point is resolved for it
      yaw: 0, pitch: 0,
      hp: 100, maxHp: 100,
      attackBonus: 0, miningSpeedBonus: 0,
      chestsOpened: 0, selectedSlot: 0, inventory: [],
    },
    sanity: 100,
    progression: {
      stage: 1, dayCount: 1, memoryFragments: 0, nightsRequired: 3,
      awaitingAdvance: false, behemothDefeated: false, behemothSpawned: false,
      compassAcquired: false, pendingLevel2Transition: false, fakeHavenTriggered: false,
      milestones: [],
      /* PHASE 28 — a new game has answered no cues. This is the field a New Game resets,
         and it is why a New Game gets the cues back while a Load does not. */
      onboarding: [],
      /* PHASE 31 — a new game has noticed nothing, which is not merely the safe default:
         a callback that existed before its original had been seen would be a prop. */
      noticed: [],
      farmCrossroadsRecalled: false, farmJourneyOrd: 0, farmHouseSeen: false,
      killCount: 0, riftDisks: [], dimensionsBreached: [DIMENSION.OVERWORLD],
    },
    time: { cycleSeconds: 60, wasNight: false },
    anchor: null,
    world: {},
    objectives: { overworld: 0, farmlands: 0, suburbia: 0, haven: 0 },
    settings: settings ? settings.toJSON() : {},
  }).state;
}
