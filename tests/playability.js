/* =====================================================================================
   PHASE 36 — THE PLAYABLE-ALPHA GATE, OFFLINE.

   Phase 36 is not a feature. It asks one question of the build that Phases 13-35 left
   behind: CAN AN ORDINARY PLAYER GET FROM THE MAIN MENU TO THE CREDITS WITHOUT THE GAME
   TAKING THE RUN AWAY FROM THEM. Everything in this file is a regression test for a way
   the answer was NO, and every one of them was found by reading the shipped build rather
   than by a suite going red — which is the point worth recording. Thirty-one offline
   files and nine browser files were green on the build this phase started from.

   THE FIVE FAULTS, IN THE ORDER THEY COULD END A RUN:

     1. THE BEHEMOTH GATE WAS A ONE-SHOT BOOLEAN. `behemothSpawned` is saved; the mob is
        not. Save on the third night and load — or refresh the page and press CONTINUE —
        and the gate had fired on a Behemoth that no longer existed. It carries the only
        Level 1 Core Disk in the game, so the Farmlands, Suburbia, the Haven and the
        finale were all unreachable for the rest of that save. The same state was
        reachable with no save at all: walk away from it far enough and its chunk is
        disposed, at which point it falls out of the world.

     2. A POWERED ANCHOR COULD BE MINED, AND THE DISK WENT WITH IT. Feeding a Disk to the
        monument consumes it; the monument is a block with three seconds of hardness and
        no tool requirement. One left click on the thing that had just lit up destroyed
        both the rift and the only key that could open it. There are three Cores in the
        game and no second source of any of them.

     3. THE BOSS SCREEN'S BUTTON DID NOT DO WHAT IT SAID. It read ENTER THE SHATTERED
        FARMLANDS; `pendingLevel2Transition` is only true on the frame a player walks into
        a rift, so it fell through to the stage handler — difficulty up, nights required
        three to four, and the player teleported back to the world spawn away from the
        Anchor they had just raised. The screen covers the viewport and has one exit, so
        nobody could decline it.

     4. THE WORLD SIMULATED BEHIND THAT SCREEN. Pointer lock released, viewport covered,
        mobs still attacking — on the third night, which is the only night it appears.

     5. THE ENDING'S FULL-SCREEN LAYERS WERE NEVER TAKEN DOWN. #blackCut and
        #creditsScreen sit above the settings panel and nothing ever removed either, so a
        New Game taken from the ending — which Phase 33 made reachable on purpose — ran
        the whole next session under an opaque sheet.

   OFFLINE. This drives the real VoxelWorld, the real AnchorMonumentManager, the real
   MobManager, the real Inventory and the real save validator. The live end-to-end — a
   real New Game walked all the way to the credits in a real browser, with no debug
   command in it — is browser-playability.js, and every claim that needs a browser is
   made there and nowhere else.
   ===================================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const THREE = require('three');
const { makeWorld } = require('./harness/world.js');

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));

const GAME = path.join(__dirname, '..', 'game.html');
const SRC = fs.readFileSync(GAME, 'utf8');

const { S, ev, w } = makeWorld();
S.__w = w;
S.__THREE = THREE;

/* The body of one method, brace-matched from its signature. Some of what this phase
   repaired lives inside Game, which cannot be constructed without a browser, so those
   claims are made against the source and say so. Same helper transitions.js uses. */
function methodBody(src, name, from) {
  const sig = new RegExp('(?:^|\\n)\\s*(?:function\\s+)?' + name + '\\s*\\(', 'g');
  sig.lastIndex = from || 0;
  const m = sig.exec(src);
  if (!m) return null;
  let i = src.indexOf('(', m.index + m[0].length - 1);
  let d = 0, j = i;
  for (; j < src.length; j++) {
    if (src[j] === '(') d++;
    else if (src[j] === ')') { d--; if (d === 0) break; }
  }
  const open = src.indexOf('{', j);
  if (open < 0) return null;
  d = 0;
  for (let k = open; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(open + 1, k); }
  }
  return null;
}
/* Comments stripped, so a claim about executable code cannot be satisfied — or defeated —
   by prose. The same technique progression.js uses to prove XP is gone. */
function code(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/* MobManager talks to two collaborators the Game owns. Both are stubbed to the two
   methods it actually calls, so what runs below is the real manager and the real Mob. */
S.__im = { entities: [], spawnDrop() {} };
S.__sound = new Proxy({}, { get: () => () => {} });

const ITEM = ev('ITEM');
const BLOCK = ev('BLOCK');
const MOB_TYPE = ev('MOB_TYPE');

// =====================================================================================
head('1. THE BEHEMOTH GATE IS LIVE STATE, NOT A LATCH');
// =====================================================================================
{
  /* The gate is four lines inside Game._animate, which needs a renderer. What can be
     driven for real here is the thing it now ASKS, and the thing that used to answer for
     it. Both are below; the gate's own wiring is read out of the source. */
  const anim = code(methodBody(SRC, '_animate', SRC.indexOf('\nclass Game {')) || '');
  chk(!!anim, 'Game._animate was found');

  const gateAt = anim.indexOf('this.mobs.spawnBehemoth');
  chk(gateAt > 0, 'and the Behemoth gate inside it');
  const gate = anim.slice(anim.lastIndexOf('if (', gateAt), gateAt + 40);
  chk(/dayCount >= 3/.test(gate),
      'the gate opens on the third night OR ANY NIGHT AFTER IT — a run that lost its Behemoth on night three can recover on night four');
  chk(!/dayCount === 3/.test(gate),
      'and no longer only on the exact third night');
  chk(/!this\.behemothDefeated/.test(gate),
      'it closes on the Disk having been COLLECTED, which is the thing that actually ends this step');
  chk(/!this\.mobs\.hasBehemoth\(\)/.test(gate),
      'it asks whether one is STANDING rather than whether one was once spawned');
  chk(/!this\._coreDiskAwaitingPickup\(\)/.test(gate),
      'and whether its Disk is already lying on the ground, so a kill is never answered with a second Behemoth');
  chk(!/!this\.behemothSpawned/.test(gate),
      'the saved one-shot latch no longer decides anything');
  chk(/this\.behemothSpawned = true/.test(gate),
      'though it is still written, so an older save and the debug report still read what they always did');

  /* AND THE THING THE GATE NOW ASKS, DRIVEN FOR REAL. */
  const scene = new THREE.Scene();
  S.__scene2 = scene;
  const mm = ev('new MobManager(__scene2, __w, __im, __sound)');
  chk(mm.hasBehemoth() === false, 'an empty world has no Behemoth standing in it');

  const boss = mm.spawnBehemoth(new THREE.Vector3(40, 40, 40));
  chk(mm.hasBehemoth() === true, 'one spawned by the real spawner is found');
  chk(boss.isBoss === true && boss.alive === true, 'and it is the boss, alive');

  boss.hp = 0; boss.alive = false;
  mm.update(0.016, { position: new THREE.Vector3(0, 40, 0), inFarmlands: false, inSuburbia: false, inFakeHaven: false }, true);
  chk(mm.hasBehemoth() === false, 'and once it is dead and reaped the answer is no again');

  /* An ordinary mob is not a Behemoth. If it were, a skeleton wandering past would hold
     the gate shut on the third night. */
  const mm2 = ev('new MobManager(__scene2, __w, __im, __sound)');
  S.__mm2 = mm2;
  const ordinary = Object.keys(MOB_TYPE).find(k => k !== 'BEHEMOTH');
  ev(`(function(){ const m = new Mob(__scene2, MOB_TYPE.${ordinary}, new __THREE.Vector3(10,40,10), 1); __mm2.mobs.push(m); })()`);
  chk(mm2.mobs.length === 1 && mm2.hasBehemoth() === false,
      `and an ordinary hostile (${ordinary}) standing in the world is not mistaken for one`);
}

// =====================================================================================
head('2. A MOB THAT FALLS OUT OF THE WORLD IS REAPED, NOT LEFT FALLING');
// =====================================================================================
{
  const VOID = ev('MOB_VOID_Y');
  chk(VOID < 0, `MOB_VOID_Y is below the world floor (${VOID})`);
  /* The number has to sit under the deepest ground in the game or a player standing in a
     basin would watch a mob evaporate beside them. The Disconnected Home's cellar is the
     lowest authored floor anywhere. */
  chk(VOID <= -4, 'and well under the lowest authored floor in any dimension');

  const scene = new THREE.Scene();
  S.__scene3 = scene;
  const mm = ev('new MobManager(__scene3, __w, __im, __sound)');
  /* Spawning off: this section is about what the loop REMOVES, and a manager left free
     to top itself up would answer a different question. */
  mm.spawningDisabled = true;
  const boss = mm.spawnBehemoth(new THREE.Vector3(80, 40, 80));
  boss.position.y = VOID - 1;
  const before = mm.killCount || 0;
  mm.update(0.016, { position: new THREE.Vector3(0, 40, 0), inFarmlands: false, inSuburbia: false, inFakeHaven: false }, true);
  chk(mm.mobs.length === 0, 'a mob below the floor is removed from the simulation');
  chk((mm.killCount || 0) === before,
      'and it is NOT counted as a kill — it was never killed, it simply is not there');
  chk(mm.hasBehemoth() === false,
      'so the Behemoth gate can see that there is nothing standing and send another one');

  /* And a mob on real ground is untouched by any of it. */
  const mm2 = ev('new MobManager(__scene3, __w, __im, __sound)');
  mm2.spawningDisabled = true;
  const ok = mm2.spawnBehemoth(new THREE.Vector3(120, 40, 120));
  const y0 = ok.position.y;
  mm2.update(0.016, { position: new THREE.Vector3(121, 40, 121), inFarmlands: false, inSuburbia: false, inFakeHaven: false }, true);
  chk(mm2.mobs.length === 1, `a Behemoth standing on real terrain at y=${y0.toFixed(1)} is left alone`);
}

// =====================================================================================
head('3. A POWERED ANCHOR HANDS ITS DISK BACK WHEN IT IS TAKEN APART');
// =====================================================================================
{
  const am = ev('new AnchorMonumentManager(__scene, __w, null)');
  w.anchorManager = am;
  const drops = [];
  const realIM = w.itemManager;
  w.itemManager = { spawnDrop: (item, count) => drops.push([item, count]) };

  /* A real column of real Overworld terrain, so the block being broken is a block that
     is genuinely there. */
  const bx = 24, bz = 24;
  const by = w.findSpawnHeight(bx, bz);
  w.setBlockWorld(bx, by, bz, BLOCK.SAFEHOUSE_ANCHOR);
  chk(!!am.activeAnchor, 'placing the block raises the monument');

  chk(am.powerRiftCore(2) === true, 'and the Level 1 Disk powers its rift');
  drops.length = 0;
  w.destroyBlock(bx, by, bz, null, true);
  const gave = drops.map(d => d[0]);
  chk(gave.indexOf(ITEM.SAFEHOUSE_ANCHOR) >= 0, 'breaking it returns the Anchor Monument itself, as it always did');
  chk(gave.indexOf(ITEM.CORE_DISK) >= 0,
      'AND the Core Disk it had swallowed — without this the run was over and nothing said so');
  chk(!am.riftActive && !am.activeAnchor, 'the rift is closed and the monument is gone');

  /* The Level 2 Disk comes back as the Level 2 Disk. Returning the wrong one would be a
     second, quieter softlock: a Level 1 Disk is inert against a Farmlands Anchor. */
  const fx = -33268, fz = -33282;
  const fy = w.findSpawnHeight(fx, fz);
  w.setBlockWorld(fx, fy, fz, BLOCK.SAFEHOUSE_ANCHOR);
  chk(am.powerRiftCore(3) === true, 'a Farmlands Anchor powers a rift toward Static Suburbia');
  drops.length = 0;
  w.destroyBlock(fx, fy, fz, null, true);
  const gave2 = drops.map(d => d[0]);
  chk(gave2.indexOf(ITEM.CORE_DISK_L2) >= 0 && gave2.indexOf(ITEM.CORE_DISK) < 0,
      'breaking that one returns the LEVEL 2 Disk, not the Level 1 one');

  /* An unpowered Anchor is untouched by any of this. A player who raises one for the
     night and takes it with them in the morning must not be handed a Core Disk. */
  const ux = 40, uz = 40;
  const uy = w.findSpawnHeight(ux, uz);
  w.setBlockWorld(ux, uy, uz, BLOCK.SAFEHOUSE_ANCHOR);
  drops.length = 0;
  w.destroyBlock(ux, uy, uz, null, true);
  const gave3 = drops.map(d => d[0]);
  chk(gave3.length === 1 && gave3[0] === ITEM.SAFEHOUSE_ANCHOR,
      'an UNPOWERED Anchor returns exactly one thing, and it is not a Disk');

  w.itemManager = realIM;
}

// =====================================================================================
head('4. THE BOSS SCREEN IS PUNCTUATION, NOT A DOOR');
// =====================================================================================
{
  const boss = code(methodBody(SRC, 'triggerBossVictory') || '');
  chk(!!boss, 'UIManager.triggerBossVictory was found');
  chk(/winScreenMode = 'boss'/.test(boss), "it records which of the two screens is up ('boss')");
  chk(!/SHATTERED FARMLANDS/.test(boss),
      'and its button no longer offers to enter a dimension it cannot enter');
  chk(!/UNLOCKED/.test(boss),
      'nor claims a dimension is unlocked by a screen that does not unlock one');

  const stage = code(methodBody(SRC, 'triggerWinScreen') || '');
  chk(/winScreenMode = 'stage'/.test(stage), "the stage screen records itself as the other one ('stage')");

  const hide = code(methodBody(SRC, 'hideWinScreen') || '');
  chk(/winScreenMode = null/.test(hide), 'and closing either clears the record');

  /* THE BUTTON. One element, three possible meanings, and it used to guess. */
  const bind = SRC.slice(SRC.indexOf("getElementById('nextLevelBtn').addEventListener"));
  const handler = code(bind.slice(0, bind.indexOf('\n    });') + 8));
  chk(/winScreenMode === 'boss'/.test(handler) && /_dismissBossVictory\(\)/.test(handler),
      'the button asks which screen it is on and dismisses the Behemoth’s');
  chk(/_advanceStage\(\)/.test(handler), 'and still advances the stage on the stage screen');

  const dismiss = code(methodBody(SRC, '_dismissBossVictory') || '');
  chk(!!dismiss, 'Game._dismissBossVictory exists');
  for (const [re, what] of [
    [/this\.stage\+\+/, 'raise the stage'],
    [/spawnPosition/, 'teleport the player'],
    [/nightsRequired/, 'make the nights longer'],
    [/difficultyMult/, 'raise the difficulty'],
  ]) {
    chk(!re.test(dismiss), `dismissing it does not ${what}`);
  }
  chk(/hideWinScreen\(\)/.test(dismiss) && /_refreshObjective\(\)/.test(dismiss),
      'it takes the screen down and re-resolves the line that says what to do with the Disk');

  /* And the flag that means "a stage is waiting to be advanced past" means only that. */
  const anim = code(methodBody(SRC, '_animate', SRC.indexOf('\nclass Game {')) || '');
  const pickup = anim.slice(anim.indexOf('behemothDefeated = true') - 300,
                            anim.indexOf('behemothDefeated = true') + 300);
  chk(/triggerBossVictory\(\)/.test(pickup), 'the Disk landing in the pack raises the screen');
  chk(!/awaitingAdvance = true/.test(pickup),
      'and does NOT set awaitingAdvance — the two screens are no longer indistinguishable in a save file');

  const restore = code(methodBody(SRC, '_applyRestoredState') || '');
  chk(/if \(this\.awaitingAdvance\) this\.ui\.triggerWinScreen\(this\.stage\)/.test(restore),
      'so a save that carries the flag can only ever be restoring the stage screen');
  chk(!/triggerBossVictory/.test(restore),
      'and a reload never brings the Behemoth’s screen back wearing the stage screen’s job');
}

// =====================================================================================
head('5. THE WORLD DOES NOT SIMULATE BEHIND A FULL-SCREEN PANEL');
// =====================================================================================
{
  const anim = code(methodBody(SRC, '_animate', SRC.indexOf('\nclass Game {')) || '');
  const winGate = anim.indexOf('this.ui.winScreenMode');
  const setGate = anim.indexOf('this.ui.settingsOpen');
  const stream = anim.indexOf('updateChunks');
  const mobs = anim.indexOf('this.mobs.update');
  chk(winGate > 0, 'the frame loop asks whether a win screen is up');
  chk(winGate < stream && winGate < mobs,
      'and returns before streaming or a single mob moves, exactly as the settings pause does');
  chk(Math.abs(winGate - setGate) < 900,
      'the two pauses are written together, so neither can drift away from the other');

  /* The pause has to be keyed on the SCREEN, not on progression state: `awaitingAdvance`
     no longer covers the Behemoth's screen, which is the one that appears at night. */
  const gateLine = anim.slice(winGate - 40, winGate + 60);
  chk(!/awaitingAdvance/.test(gateLine), 'and it is keyed on the screen itself, not on a progression flag');
}

// =====================================================================================
head('6. NOTHING FULL-SCREEN SURVIVES A NEW GAME');
// =====================================================================================
{
  const reset = code(methodBody(SRC, 'resetPresentation') || '');
  chk(!!reset, 'UIManager.resetPresentation was found');
  for (const [re, what] of [
    [/blackCut[\s\S]*?remove\('on'\)/, 'the hard cut to black (z 65)'],
    [/creditsScreen[\s\S]*?remove\('active'\)/, 'the credits screen (z 70)'],
    [/fadeWhite[\s\S]*?opacity = '0'/, 'the Haven’s white wash (z 60)'],
    [/hideWinScreen\(\)/, 'the win screen (z 60)'],
  ]) {
    chk(re.test(reset), `it takes down ${what}`);
  }
  note('all four sit ABOVE the settings panel at z 56, which is where a New Game is taken from');

  /* And it is still reached from the one teardown both a New Game and a Load run. */
  const teardown = code(methodBody(SRC, '_teardownForRestore') || '');
  chk(/this\.ui\.resetPresentation\(\)/.test(teardown),
      'and the one teardown a New Game and a Load both run still calls it');
}

// =====================================================================================
head('7. A DISK THE PLAYER HELD AND HAS NOT SPENT COMES BACK ON LOAD');
// =====================================================================================
{
  /* A Disk lives in a container, then on the ground as an ItemEntity, then in the pack.
     The middle one is not saved and there is no second source of any Core, so the gap
     between a container opening and the drop reaching the player's feet — and the Q key,
     which drops the held stack — were both unrecoverable. */
  const restore = code(methodBody(SRC, '_applyRestoredState') || '');
  chk(/riftDisksCollected\.has\(disk\)/.test(restore),
      'the loader asks which Disks the player has ever HELD, which the save already records');
  chk(/inventory\.hasItem\(disk\)/.test(restore),
      'whether each is in the pack now');
  chk(/dimensionsBreached\.has\(DIMENSION\.FARMLANDS\)/.test(restore) &&
      /dimensionsBreached\.has\(DIMENSION\.SUBURBIA\)/.test(restore) &&
      /this\.fakeHavenTriggered/.test(restore),
      'and whether each has been SPENT — three different questions, all answered by fields the save already carries');
  chk(/notes\.push\('returned the '/.test(restore),
      'a Disk put back is REPORTED, like every other repair the loader makes');
  chk(/addItem\(disk, 1\)\)/.test(restore),
      'and the note is only written if the pack actually accepted it');
  /* AND BOTH DOORS REPORT IT. `continueFromSave` discarded the loader's notes, which was
     harmless while a repair only ever moved the player off a block. */
  const cont = code(methodBody(SRC, 'continueFromSave') || '');
  chk(/setSaveStatus\(/.test(cont) && /repairs/.test(cont),
      'CONTINUE reports its repairs as well as LOAD, in the settings panel and nowhere else');
  chk(!/showToast/.test(cont.slice(cont.indexOf('repairs'))),
      'and never in the HUD or the world — sections 53 and 57 are not suspended for a technical message');
  chk(!/SAVE_VERSION = 6/.test(SRC), 'and the schema did not have to change to do it');
  chk(/const SAVE_VERSION = 5;/.test(SRC), 'it is still version 5');

  /* The three "spent" tests, evaluated as the loader evaluates them, against real save
     shapes. A wrong answer either way is a bug: too eager mints a Disk the player spent,
     too shy leaves the run dead. */
  const DIMENSION = ev('DIMENSION');
  const spentFor = (disk, breached, anchor, havenFired) => {
    if (disk === ITEM.CORE_DISK) {
      return breached.indexOf(DIMENSION.FARMLANDS) >= 0 ||
             !!(anchor && anchor.riftActive && anchor.riftTargetLevel === 2);
    }
    if (disk === ITEM.CORE_DISK_L2) {
      return breached.indexOf(DIMENSION.SUBURBIA) >= 0 ||
             !!(anchor && anchor.riftActive && anchor.riftTargetLevel === 3);
    }
    return !!havenFired;
  };
  chk(spentFor(ITEM.CORE_DISK, [1], null, false) === false,
      'a Level 1 Disk dropped in the Overworld with no rift open reads as NOT spent');
  chk(spentFor(ITEM.CORE_DISK, [1], { riftActive: true, riftTargetLevel: 2 }, false) === true,
      'one that is already standing in an open rift reads as spent');
  chk(spentFor(ITEM.CORE_DISK, [1, 2], null, false) === true,
      'and so does one belonging to a player who is already through');
  chk(spentFor(ITEM.CORE_DISK_L2, [1, 2], null, false) === false,
      'a Level 2 Disk lost in the Farmlands reads as NOT spent');
  chk(spentFor(ITEM.CORE_DISK_L2, [1, 2, 3], null, false) === true,
      'and one belonging to a player standing in Suburbia reads as spent');
  chk(spentFor(ITEM.CORE_DISK_L3, [1, 2, 3], null, false) === false,
      'a Level 3 Disk lost in Suburbia reads as NOT spent');
  chk(spentFor(ITEM.CORE_DISK_L3, [1, 2, 3], null, true) === true,
      'and once the Haven has fired it reads as spent');

  /* It can never mint one the player never had. A New Game arrives here with an empty
     riftDisks list, which is what makes this safe to run on every load. */
  const dflt = ev('defaultSaveState(null)');
  chk(Array.isArray(dflt.progression.riftDisks) && dflt.progression.riftDisks.length === 0,
      'a New Game has held no Disk, so nothing is ever returned to one');
}

// =====================================================================================
head('8. THE CHAIN STILL HAS EXACTLY ONE OF EACH OF ITS HINGES');
// =====================================================================================
{
  /* Not new to this phase — a re-assertion, because everything above touched the spine.
     STORY.md section 9: three Cores, each a hinge, and no fourth. */
  const c = (re) => (code(SRC).match(re) || []).length;
  chk(c(/spawnBehemoth\(/g) === 2,
      'the Behemoth is defined in one place and spawned from one place');
  chk(c(/_beginFakeHavenSequence\(\)/g) === 2,
      'the Haven is defined in one place and entered from one place');
  chk(c(/this\.finale\.begin\(\)/g) === 1,
      'the finale begins from one place');
  chk(c(/_triggerHavenShift\(/g) === 2,
      'and the boundary between them is still one method with one caller');
  chk(c(/loot: \[\{ item: ITEM\.CORE_DISK,/g) === 1,
      'exactly one loot table anywhere carries the Level 1 Core Disk');
  chk(c(/spawnDrop\(ITEM\.CORE_DISK_L2/g) === 1 || c(/spawnDrop\(ITEM\.CORE_DISK_L2/g) === 2,
      'the Level 2 Disk comes from the guaranteed chest (and, since this phase, back out of the Anchor it was fed to)');
  chk(c(/spawnDrop\(ITEM\.CORE_DISK_L3/g) === 1,
      'and the Level 3 Disk from exactly one container');
}

// =====================================================================================
head('9. AND NO DEBUG COMMAND IS ON THE PATH');
// =====================================================================================
{
  /* Requirement: the intended game must be finishable without a developer teleport. The
     dev block exists and is welcome; nothing the player walks through may call into it. */
  const devAt = SRC.indexOf('debugTeleportToFarmlands');
  chk(devAt > 0, 'the developer teleports exist');
  for (const m of ['_transitionToLevel2', '_transitionToLevel3', '_transitionToLevel4',
                   '_beginFakeHavenSequence', '_triggerHavenShift', '_triggerClimax']) {
    const body = code(methodBody(SRC, m) || '');
    chk(!/debug/i.test(body), `${m} calls nothing in the debug block`);
  }
}

// =====================================================================================
head('10. STATIC SUBURBIA DOES NOT PIN THE PLAYER AT THE BOTTOM OF THE SCALE');
// =====================================================================================
{
  /* Both rates were negative and neither was bounded, so a player who arrived at 100
     reached zero in about a minute and stayed there for the whole of the longest search
     in the game — looking for one wrong house through full-strength grain, a 1.15
     vignette, radial channel split and the edge mirage. Rendered rather than reasoned
     about: tests/renders/sanity-suburbia-{100,60,34,30,8,0}.png. */
  S.__env = {};
  S.__ui = { setSanity() {} };
  const ss = ev('new SanitySystem(__env, __w, __ui)');
  const run = (secs, still) => { for (let i = 0; i < secs * 60; i++) ss.updateSuburbia(1 / 60, still ? 10 : 0); };
  const state = (v) => v >= 70 ? 'p-calm' : v >= 45 ? 'p-drifting' : v >= 20 ? 'p-breaking' : 'p-lost';

  ss.value = 100;
  run(20, false);
  chk(ss.value < 100 && ss.value > 34,
      `arrival still slides: 20 seconds of walking takes 100 to ${ss.value.toFixed(1)}`);
  run(200, false);
  const walking = ss.value;
  chk(walking > 25 && walking < 45,
      `and it SETTLES rather than bottoming out — three and a half minutes of walking holds ${walking.toFixed(1)} (${state(walking)})`);

  run(30, true);
  const still = ss.value;
  chk(still < walking - 15,
      `standing still is still the punishment, and it is now a punishment you can feel: ${walking.toFixed(1)} -> ${still.toFixed(1)} (${state(still)})`);
  chk(still > 0, 'without hitting the bottom of the scale, where nothing can get worse');
  chk(state(walking) !== state(still),
      'so the perception instrument reports two different things instead of one thing forever');

  run(30, false);
  chk(ss.value > still + 10 && Math.abs(ss.value - walking) < 2,
      `and walking away from it recovers, slowly, back to the same steady value (${ss.value.toFixed(1)})`);

  /* It still cannot climb out of the dimension's unease, and it still does no damage. */
  run(600, false);
  chk(ss.value < 45, `ten minutes of walking never gets back to comfortable (${ss.value.toFixed(1)})`);
  const drain = code(methodBody(SRC, 'updateSuburbia') || '');
  chk(!/hp|damage|die/i.test(drain), 'and Sanity in Suburbia still costs no health');
  chk(!/anchorManager|torch|Stalker/i.test(drain),
      'and is still answered by nothing but whether the player is moving');
}

// =====================================================================================
head('11. THE LEVEL 3 DISK CAN BE WALKED TO, ON FOOT, FROM THE STREET');
// =====================================================================================
{
  /* core-disk.js does this for the FARMLANDS Home, and has since Phase 20 — a body with
     the player's real dimensions walked from the field, through the house, down the cellar
     stair and into the room at the end. Nothing had ever done it for the SUBURBIA one, and
     that Home is the stranger structure of the two: the roof is laid on the ground with the
     walls rising out of it, so the front door is four blocks up a face of shingle, and the
     chest hangs in the dead centre of the volume with nothing holding it up and nothing
     underneath it to stand on.

     Everything here goes through VoxelWorld.collidesAABB with the real box (halfWidth 0.3,
     height 1.8) and the real step-up ceiling. A route this finds is a route a player can
     walk; one it cannot find is one they cannot. */
  const { walkReach, settle } = require('./harness/walk.js');
  const SUBURBIA_BASE_Y = ev('SUBURBIA_BASE_Y');

  w._genStaticSuburbiaRegion();
  const t = w._subDisconnectedTarget();
  const lot = w._subLot(t.bx, t.bz, t.row, t.col);
  w._eagerLoadAround(lot.hx + 5, lot.hz + 4, 3);

  chk(!!w.level3HomeChestKey,
      'streaming the lot registers the guaranteed chest' +
      (w.level3HomeChestKey ? ' (' + w.level3HomeChestKey + ')' : ' — IT DID NOT'));

  if (w.level3HomeChestKey) {
    const [cx, cy, cz] = w.level3HomeChestKey.split(',').map(Number);
    chk(w.getBlockWorld(cx, cy, cz) === BLOCK.TREASURE_CHEST,
        'and there is a real Ancient Chest at that coordinate');

    const baseY = SUBURBIA_BASE_Y;
    const REACH = 6, EYE = 1.62;   // PlayerController.reach and its eye height
    const startX = lot.hx + 5.5, startZ = lot.hz - 18.5;   // out on the street
    const sy = settle(w, startX, baseY + 6, startZ, 12);
    chk(sy !== null, 'there is standable street eighteen blocks out from the lot');

    const canReach = (p) => Math.hypot(p.x - (cx + 0.5), (p.y + EYE) - (cy + 0.5),
                                       p.z - (cz + 0.5)) <= REACH;
    const r = walkReach(w, { x: startX, y: sy, z: startZ },
      { x0: lot.hx - 22, x1: lot.hx + 11 + 22, z0: lot.hz - 22, z1: lot.hz + 9 + 22,
        y0: baseY - 4, y1: baseY + 14 }, canReach, 300000);
    chk(r.ok, 'A PLAYER CAN WALK FROM THE STREET TO WITHIN REACH OF IT' +
        (r.ok ? '' : ' — ' + r.why));
    if (r.ok) {
      const d = Math.hypot(r.at.x - (cx + 0.5), (r.at.y + EYE) - (cy + 0.5), r.at.z - (cz + 0.5));
      note(`landed at ${r.at.x.toFixed(1)}, ${r.at.y.toFixed(1)}, ${r.at.z.toFixed(1)} — ` +
           `${d.toFixed(2)} blocks from eye to chest, against a reach of ${REACH} ` +
           `(${r.visited} positions searched)`);
      chk(d <= REACH - 0.1, 'with something in hand to spare, rather than exactly on the limit');
    }

    /* AND NOTHING WAS BROKEN TO GET THERE. The prover only ever moves a body; it cannot
       mine. Recording it because the answer being YES is what makes the structure
       acceptable as it stands, and section 6 of the report says plainly that it is
       awkward rather than gracious. */
    note('no block was broken: walkReach moves a body and cannot mine');
  }
}

console.log('');
if (fail) { console.log(`${fail} PHASE 36 PLAYABILITY CHECK(S) FAILED`); process.exit(1); }
console.log('ALL PHASE 36 OFFLINE PLAYABILITY CHECKS PASS');
note('These are the ways the build could take a run away from a player, and each of them');
note('is now a test. Whether the game is worth playing is a judgement for a person;');
note('nothing here claims otherwise. The live end-to-end is browser-playability.js.');
