/* PHASE 28 — REMOVE TUTORIAL / ORGANIC ONBOARDING.

   WHAT THIS FILE CAN AND CANNOT PROVE.

   It boots the REAL script out of game.html into the offline harness and drives the real
   ObjectiveSystem, the real ONBOARDING_CUES table through the real
   PlayerController._onboardingCue, the real Game.prototype.learnOnboarding, and the real
   save validator and migration ladder. Where a claim is about the shipped SOURCE rather
   than about behaviour — "no tutorial element exists in the document", "BEGIN EXPEDITION
   is wired to _start()" — the check says so plainly, because `Game` cannot be constructed
   without a GPU and those are the honest limits of an offline run.

   IT CANNOT PROVE THE ONBOARDING WORKS. No test in this repository can. Whether a person
   who has never seen this game can start it, understand "Gather wood.", find the button
   that fells a tree and reach a torch before dark is a question for a person, and the
   phase report says exactly who has and has not answered it.

   The live-document half — that no tutorial DOM survives in a real browser, that the
   first objective is on screen before the first frame, that a cue really does appear over
   a real tree and really does go away — is in browser-onboarding.js and is claimed only
   there. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { makeWorld } = require('./harness/util.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
/* Comments are stripped wherever a check is about what the build DOES rather than what it
   says about itself: this phase left gravestones, and every one of them says "tutorial". */
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')
                      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const LIVE = strip(SRC);
const BODY = SRC.slice(SRC.indexOf('<body>'), SRC.indexOf('<script src='));
const LIVE_BODY = strip(BODY);
const LIVE_STYLE = strip(SRC.slice(SRC.indexOf('<style>'), SRC.indexOf('</style>')));

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));

console.log('booting the real script...');
const S = makeWorld().S;
const g = (n) => vm.runInContext(n, S);

const ONBOARDING_CUES = g('ONBOARDING_CUES');
const ONBOARDING_CUE_IDS = g('ONBOARDING_CUE_IDS');
const PlayerController = g('PlayerController');
const Game = g('Game');
const Inventory = g('Inventory');
const ObjectiveSystem = g('ObjectiveSystem');
const OBJECTIVE_CHAINS = g('OBJECTIVE_CHAINS');
const OBJECTIVE_CHAIN_IDS = g('OBJECTIVE_CHAIN_IDS');
const ITEM = g('ITEM');
const ITEM_DATA = g('ITEM_DATA');
const BLOCK = g('BLOCK');
const DOOR_LOOKUP = g('DOOR_LOOKUP');
const WOOD_BLOCKS = g('WOOD_BLOCKS');
const validateSaveState = g('validateSaveState');
const defaultSaveState = g('defaultSaveState');
const SAVE_VERSION = g('SAVE_VERSION');
const SAVE_MIGRATIONS = g('SAVE_MIGRATIONS');

/* Exactly one method body, brace-matched, so a structural check about one method can
   never quietly end up reading the next one. */
function methodBody(src, name) {
  const i = src.indexOf('\n  ' + name + '(');
  if (i < 0) return null;
  const open = src.indexOf('{', i);
  if (open < 0) return null;
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
  return null;
}

/* A stand-in for the parts of PlayerController the cue resolver reads. Deliberately NOT a
   real PlayerController: constructing one needs a world, a camera and a renderer, and the
   resolver's whole contract is that it reads three things — what has been learned, what is
   held, and what is under the crosshair. */
function cueSelf(learned, held) {
  const inv = new Inventory();
  if (held) for (const [item, count] of held) inv.addItem(item, count);
  return {
    progression: { onboarding: new Set(learned || []) },
    inventory: inv,
    selectedSlot: 0,
  };
}
const cueFor = (self, targetId) => PlayerController.prototype._onboardingCue.call(self, targetId);
const label = (c) => (c ? c.key + ' · ' + c.verb : null);

// =====================================================================================
// 1. THE TUTORIAL IS GONE — every layer of it
//
// Requirements 1, 20, 21: New Game does not open a tutorial, no overlay is left in the
// document, and no page table is still alive behind it.
// =====================================================================================
head('1. THE TUTORIAL IS GONE');
{
  for (const sym of ['TUTORIAL_PAGES', 'TutorialController'])
    chk(g('typeof ' + sym) === 'undefined', `${sym} is not defined anywhere in the running build`);
  chk(typeof Game.prototype._openTutorial === 'undefined',
      'Game._openTutorial no longer exists — nothing can open a tutorial');

  for (const id of ['tutorialScreen', 'tutorialSkip', 'tutorialEyebrow', 'tutorialIcon',
                    'tutorialTitle', 'tutorialLines', 'tutorialDots', 'tutorialBack',
                    'tutorialNext', 'skipTutorialLink'])
    chk(LIVE_BODY.indexOf('id="' + id + '"') < 0, `no #${id} element survives in the document`);

  for (const cls of ['tutorial-panel', 'tutorial-skip', 'tutorial-eyebrow', 'tutorial-icon',
                     'tutorial-title', 'tutorial-lines', 'tutorial-nav', 'tutorial-dots',
                     'tutorial-dot', 'tutorial-btn'])
    chk(LIVE_STYLE.indexOf('.' + cls) < 0, `and no .${cls} rule is left in the stylesheet`);

  /* A hidden element that still exists is the failure mode this phase is most likely to
     leave behind, so this asks the DOCUMENT rather than asking the code. */
  chk(!/tutorial/i.test(LIVE_BODY), 'nothing in the body markup mentions a tutorial at all');
  chk(!/getElementById\(['"]tutorial|classList[^\n]*tutorial/i.test(LIVE),
      'and no code reaches for a tutorial element — there is nothing left to reach for');

  /* The tutorial's own vocabulary, which is what a replacement wall of text would bring
     back with it. Twenty-one instructional sentences went; none of them may return. */
  for (const phrase of ['HOW TO SURVIVE', 'Welcome, Wanderer', 'START EXPEDITION',
                        'Move &amp; Look', 'Mine &amp; Gather', 'Craft &amp; Carry',
                        'Tools Change Everything', 'Survive the Night'])
    chk(LIVE.indexOf(phrase) < 0, `the card titled "${phrase}" is gone`);
}

// =====================================================================================
// 2. NEW GAME ENTERS GAMEPLAY, AND NOTHING STANDS BETWEEN
//
// Requirements 4, 5: normal gameplay input and pointer lock immediately, no stuck states.
// Structural — Game needs a GPU. browser-onboarding.js makes the live claim.
// =====================================================================================
head('2. THE ROUTE IN');
{
  chk(/clickPlay'\)\.addEventListener\('click', \(\) => this\._start\(\)\)/.test(LIVE),
      'BEGIN EXPEDITION calls _start() directly — there is no screen between the click and the game');
  const starts = (LIVE.match(/addEventListener\('click', \(\) => this\._start\(\)\)/g) || []).length;
  chk(starts === 1, `and it is the ONLY button that does (${starts} such listener)`);

  const start = methodBody(LIVE, '_start');
  chk(start && !/classList\.add\('active'\)/.test(start) && !/style\.display = ''/.test(start),
      '_start() opens no overlay of any kind on its way in');
  chk(start && /openingInstruction\.play\(\(\) => this\._beginPlay\(\)\)/.test(start),
      'it ends on the opening instruction, exactly as Phase 20.2 authored it');

  /* The opening instruction is NOT tutorial content and this phase kept it. It says one
     thing, it is a bearing, and it explains no mechanic. */
  const lines = g('OPENING_INSTRUCTION_LINES');
  chk(lines.length === 2 && lines[0] === 'At the crossroads, go east.' && lines[1] === 'Go east.',
      `the opening instruction survives unchanged: "${lines.join('" / "')}"`);
  chk(!lines.some(l => /click|press|key|button|craft|mine|hold/i.test(l)),
      'and it still teaches no mechanic — it is an instruction, not a lesson');

  const begin = methodBody(LIVE, '_beginPlay');
  chk(begin && begin.indexOf('this._refreshObjective();') < begin.indexOf('requestAnimationFrame'),
      'the first objective is resolved BEFORE the first frame, not a tick into it');
  chk(begin && /this\.canvas\.requestPointerLock\(\)/.test(begin),
      'and pointer lock is taken on the way in — the player is in gameplay input immediately');
  chk(begin && /this\.running = true;/.test(begin),
      'with `running` set, which is what re-locks the pointer after the settings panel closes');

  /* Input is only ever gated by things that are still there: a menu, death, lost lock.
     A tutorial-shaped gate would be a fourth. */
  chk(/if \(!this\.locked \|\| this\.ui\.menuOpen \|\| this\.dead\) \{ this\._setPrompt\(null\); return; \}/.test(LIVE),
      'and the only input gates left are pointer lock, an open menu and death');
}

// =====================================================================================
// 3. THE OBJECTIVE CHAIN IS THE ONBOARDING
//
// Requirements 3, 9-12, 15. Driven for real against the shipped table.
// =====================================================================================
head('3. THE OBJECTIVE CHAIN IS THE ONBOARDING');
{
  const base = {
    chain: 'overworld', overworld: true, farmlands: false, suburbia: false, haven: false,
    hasWood: false, hasTool: false, hasCoal: false, hasTorch: false,
    hasAnchor: false, inAnchorZone: false, night: false, hasDisk: false, riftActive: false,
    farmOrd: 0, farmHouseSeen: false, farmTower: true, farmCoreTaken: false,
    subVisits: 0, subCoreTaken: false, havenShifted: false, climax: false,
  };
  const sys = new ObjectiveSystem(null);
  const step = (over) => { sys.evaluate(Object.assign({}, base, over)); return sys.currentText; };

  chk(step({}) === 'Gather wood.',
      `a brand new game's very first objective is "${step({})}" — the first thing a player must do`);

  /* The whole first night, walked in order, each step advanced only by the thing the
     previous one asked for. This is the onboarding path the brief describes, and it is
     the real table answering. */
  const walk = [
    ['gathers wood',      { hasWood: true },                              'Craft a basic tool.'],
    ['crafts a pickaxe',  { hasWood: true, hasTool: true },               'Find coal.'],
    ['finds coal',        { hasTool: true, hasCoal: true },               'Craft torches.'],
    ['crafts torches',    { hasTool: true, hasTorch: true },              'Prepare for night.'],
    ['places an Anchor',  { hasTool: true, hasTorch: true, hasAnchor: true }, 'Endure the nights.'],
  ];
  for (const [what, over, want] of walk)
    chk(step(over) === want, `the player ${what} and is asked next for "${want}"`);

  chk(step({ hasTool: true, hasTorch: true, hasAnchor: true, night: true, inAnchorZone: true })
        === 'Survive until dawn.',
      'night falls and the line becomes "Survive until dawn." without anyone explaining night');
  chk(step({ hasTool: true, hasAnchor: true, night: true, inAnchorZone: false })
        === 'Return to the Anchor.',
      'and standing outside its glow at night says where to go instead');
  chk(step({ hasTool: true, hasAnchor: true, hasDisk: true })
        === 'Bring it to the Anchor.',
      'the first Core Disk routes the player back to the Anchor');
  chk(step({ hasTool: true, hasAnchor: true, riftActive: true }) === 'Enter the Rift.',
      'and a powered Rift outranks everything — the Rift onboarding is one line and no explanation');

  /* Requirement: the chain must not need a tutorial to be understood, which means no step
     may name a key, a mouse button or a UI element. */
  const texts = [];
  for (const k of OBJECTIVE_CHAIN_IDS) for (const s of (OBJECTIVE_CHAINS[k] || [])) texts.push(s.text);
  const leaks = texts.filter(t => /\b(click|press|key|button|hotbar|menu|inventory|LMB|RMB)\b/i.test(t));
  chk(leaks.length === 0,
      'no objective line names a key or a button — direction is the chain\'s job, keys are the cue\'s' +
      (leaks.length ? ': ' + leaks.join(' | ') : ''));
}

// =====================================================================================
// 4. THE CONTEXTUAL CUES — three of them, and only where they are useful
//
// Requirements 6, 7: prompts appear only when intended, and never displace a real
// affordance. Driven for real through PlayerController._onboardingCue.
// =====================================================================================
head('4. THE CONTEXTUAL CUES');
{
  chk(ONBOARDING_CUES.length === 3,
      `there are exactly three cues in the whole game: ${ONBOARDING_CUE_IDS.join(', ')}`);
  chk(Object.isFrozen(ONBOARDING_CUES), 'and the table is frozen — nothing can grow it at runtime');
  chk(ONBOARDING_CUES.every(c => typeof c.when === 'function' && typeof c.verb === 'function'),
      'each one declares when it applies and what verb it teaches');

  /* THE PROMPT PHILOSOPHY IS A LENGTH LIMIT. A cue teaches a verb; the moment it needs a
     clause it has become the tutorial again. */
  const all = [];
  for (const c of ONBOARDING_CUES) {
    for (const t of [BLOCK.OAK_LOG, BLOCK.STONE, BLOCK.DIRT]) {
      const self = cueSelf([], [[ITEM.OAK_LOG, 1]]);
      all.push(c.verb({ target: t, holdingBlock: true, inv: self.inventory }));
    }
  }
  const wordy = all.filter(v => v.split(/\s+/).length > 1 || v !== v.toUpperCase());
  chk(wordy.length === 0,
      `every cue verb is a single upper-case word (${Array.from(new Set(all)).join(', ')})` +
      (wordy.length ? ' — TOO LONG: ' + wordy.join(' | ') : ''));
  chk(!/Right-click to|Left-click to|Hold Left Click|you need to|You can/i.test(
        SRC.slice(SRC.indexOf('const ONBOARDING_CUES'), SRC.indexOf('const ONBOARDING_CUE_IDS'))),
      'and no cue explains itself in a sentence');

  // --- BREAK -----------------------------------------------------------------------
  const fresh = () => cueSelf([]);
  chk(label(cueFor(fresh(), BLOCK.OAK_LOG)) === 'LMB · CHOP',
      'a first tree says "LMB · CHOP" — the verb is about the wood, not about the input');
  chk(label(cueFor(fresh(), BLOCK.STONE)) === 'LMB · MINE',
      'and the same button over stone says MINE');
  chk(label(cueFor(fresh(), BLOCK.DIRT)) === 'LMB · BREAK',
      'and over plain ground, BREAK');
  chk(cueFor(fresh(), null) === null,
      'with nothing under the crosshair and nothing in hand, nothing is said at all');
  chk(cueFor(cueSelf(['break']), BLOCK.OAK_LOG) === null,
      'and once one block has been broken the cue never appears over a tree again');

  // --- CRAFT -----------------------------------------------------------------------
  chk(cueFor(cueSelf(['break']), null) === null,
      'an empty-handed player who has broken something is told nothing');
  chk(label(cueFor(cueSelf(['break'], [[ITEM.OAK_LOG, 1]]), null)) === 'E · CRAFT',
      'but a player HOLDING A LOG is told the one key nothing in the world could show them');
  chk(label(cueFor(cueSelf(['break'], [[ITEM.WOOD_PLANK, 4]]), null)) === 'E · CRAFT',
      'planks do the same — the cue follows the material, not a step counter');
  chk(cueFor(cueSelf(['break', 'craft'], [[ITEM.OAK_LOG, 8]]), null) === null,
      'and pressing E once, ever, retires it permanently');

  // --- PLACE -----------------------------------------------------------------------
  chk(label(cueFor(cueSelf(['break', 'craft'], [[ITEM.WOOD_PLANK, 4]]), BLOCK.DIRT)) === 'RMB · PLACE',
      'holding a placeable block and looking at ground offers "RMB · PLACE"');
  chk(cueFor(cueSelf(['break', 'craft'], [[ITEM.WOOD_PLANK, 4]]), null) === null,
      'but not while pointed at the sky, where the button would do nothing');
  chk(cueFor(cueSelf(['break', 'craft'], [[ITEM.STONE_PICKAXE, 1]]), BLOCK.DIRT) === null,
      'and not while holding a pickaxe, which is not a thing that can be placed');

  // --- THE WHOLE SET ---------------------------------------------------------------
  chk(cueFor(cueSelf(ONBOARDING_CUE_IDS, [[ITEM.OAK_LOG, 9]]), BLOCK.OAK_LOG) === null,
      'a player who has answered all three is never cued again, whatever they hold or look at');

  /* ORDER IS PRIORITY, and it is the order a first night happens in. */
  const both = cueSelf([], [[ITEM.WOOD_PLANK, 4]]);
  chk(label(cueFor(both, BLOCK.OAK_LOG)) === 'LMB · CHOP',
      'when several cues apply at once the earliest unanswered one wins — one line, never two');
}

// =====================================================================================
// 5. A CUE NEVER OUTRANKS THE WORLD
//
// Requirement 7: basic interaction remains functional and visible. The affordances Phase
// 27 authored are properties of the world, not lessons, and they keep the line.
// =====================================================================================
head('5. THE WORLD WINS THE LINE');
{
  const self = { inFakeHaven: false };
  const pf = (id) => PlayerController.prototype._promptForBlock.call(self, id);
  const closedDoor = Array.from(DOOR_LOOKUP.keys()).find(k => DOOR_LOOKUP.get(k).state === 'closed');
  chk(pf(closedDoor).verb === 'OPEN' && pf(BLOCK.SAFEHOUSE_ANCHOR).verb === 'FEED THE ANCHOR' &&
      pf(BLOCK.TREASURE_CHEST).verb === 'OPEN',
      'doors, the Anchor and Ancient Chests still carry the affordances Phase 27 gave them');

  const fn = methodBody(LIVE, '_updateTargetHighlight');
  chk(/_setPrompt\(this\._promptForBlock\(id\) \|\| this\._havenPropPrompt\(\) \|\| this\._onboardingCue\(id\)\)/.test(fn),
      'and a cue is the LAST fallback: a real affordance always takes the line first');
  const exits = (fn.match(/return;/g) || []).length;
  const answers = (fn.match(/_setPrompt\(/g) || []).length;
  chk(exits === answers && exits >= 4,
      `all ${exits} exit paths still answer the prompt — a cue can no more stick than an affordance can`);

  /* ONE PROMPT SYSTEM. The brief forbids a second, and the cheapest way to be sure is to
     count the elements that can render one. */
  chk((LIVE_BODY.match(/id="interactPrompt"/g) || []).length === 1 &&
      !/id="(hint|tip|onboard|tutorialHint|cue)[A-Za-z]*"/.test(LIVE_BODY),
      'there is exactly one prompt element in the document and no second hint layer beside it');
  chk(!/setInteractPrompt/.test(methodBody(LIVE, '_onboardingCue')),
      'the cue resolver returns a spec and paints nothing — the HUD is still the only renderer');
  chk(!/ONBOARDING_CUES|onboarding/.test(SRC.slice(SRC.indexOf('class UIManager'), SRC.indexOf('class Game'))),
      'and UIManager never hears the word "onboarding" — it cannot tell a cue from an affordance');
}

// =====================================================================================
// 6. THE LATCH — three keys, three answers, and nothing in the frame loop
// =====================================================================================
head('6. THE LATCH');
{
  const game = { onboarding: new Set() };
  const learn = (id) => Game.prototype.learnOnboarding.call(game, id);
  chk(learn('break') === true && game.onboarding.has('break'), 'answering a cue records it');
  chk(learn('break') === false && game.onboarding.size === 1, 'and answering it twice changes nothing');
  chk(learn('teleport') === false && game.onboarding.size === 1,
      'an id the table does not know is refused rather than stored');
  for (const id of ONBOARDING_CUE_IDS) learn(id);
  chk(game.onboarding.size === ONBOARDING_CUE_IDS.length,
      `all ${ONBOARDING_CUE_IDS.length} cues can be answered and no more exist to answer`);

  /* Latched from the three places the keys DO THEIR WORK — a break that really broke
     something, an E that really opened the bench, a placement that really placed. */
  chk(/spawnBlockChips\([\s\S]{0,120}this\._learn\('break'\)/.test(LIVE),
      "'break' is latched inside the branch where a block actually broke, not on the click");
  chk(/if \(!this\.ui\.settingsOpen\) \{ this\.ui\.toggleCrafting\(\); this\._learn\('craft'\); \}/.test(LIVE),
      "'craft' is latched where E actually opens the bench (and still not over the settings panel)");
  chk(/if \(this\.world\.placeBlock\([\s\S]{0,140}this\._learn\('place'\)/.test(LIVE),
      "'place' is latched inside the branch where the block was really placed");

  /* Requirement: no per-frame onboarding work. The resolver's first line is the cost. */
  const body = methodBody(LIVE, '_onboardingCue');
  chk(/if \(!learned \|\| learned\.size >= ONBOARDING_CUES\.length\) return null;/.test(body),
      'and a fully-onboarded save pays one size comparison per frame and nothing else');
  chk(!/getBlockWorld|raycast|querySelector|getElementById|for \(let /.test(body),
      'the resolver casts no ray, scans no world and touches no DOM');
}

// =====================================================================================
// 7. SAVE / LOAD — requirements 17, 18, 19
// =====================================================================================
head('7. SAVE / LOAD');
{
  chk(SAVE_VERSION === 4, `the schema is at version ${SAVE_VERSION}`);
  const fresh = defaultSaveState(null);
  chk(Array.isArray(fresh.progression.onboarding) && fresh.progression.onboarding.length === 0,
      'A NEW GAME HAS ANSWERED NOTHING — the cues are owed again, which is the point of a new game');
  chk(!JSON.stringify(fresh).toLowerCase().includes('tutorial'),
      'and no save this build writes contains the word "tutorial" anywhere');

  // Round trip.
  const mid = JSON.parse(JSON.stringify(fresh));
  mid.progression.onboarding = ['craft', 'break'];
  const back = validateSaveState(mid);
  chk(back.ok && JSON.stringify(back.state.progression.onboarding) === JSON.stringify(['break', 'craft']),
      'a partly-onboarded run survives a round trip, in the table\'s order rather than the file\'s');

  // Hostile input.
  const bad = JSON.parse(JSON.stringify(fresh));
  bad.progression.onboarding = ['break', 'break', 'fly', 42, null];
  const fixed = validateSaveState(bad);
  chk(fixed.ok && JSON.stringify(fixed.state.progression.onboarding) === JSON.stringify(['break']),
      'duplicates, unknown ids and non-strings are all dropped rather than trusted');
  const notList = JSON.parse(JSON.stringify(fresh));
  notList.progression.onboarding = 'everything';
  chk(validateSaveState(notList).ok && validateSaveState(notList).state.progression.onboarding.length === 0,
      'and a field of the wrong type is repaired to "none", never thrown over');

  /* THE OLD SAVE. A schema-3 file was written by somebody the tutorial was shown to. */
  const old = JSON.parse(JSON.stringify(fresh));
  old.version = 3;
  delete old.progression.onboarding;
  const mig = validateSaveState(old);
  chk(mig.ok, 'a pre-Phase-28 save still loads');
  chk(mig.state.version === SAVE_VERSION,
      `and is carried up the ladder to version ${mig.state.version}`);
  chk(JSON.stringify(mig.state.progression.onboarding) === JSON.stringify(ONBOARDING_CUE_IDS),
      'with every cue marked answered — a returning player is not taught to hold a pickaxe again');
  chk(typeof SAVE_MIGRATIONS[3] === 'function', 'the 3 -> 4 step is a real migration, not a default');

  /* And the whole ladder still runs from the oldest schema this build knows. */
  const v1 = JSON.parse(JSON.stringify(fresh));
  v1.version = 1;
  delete v1.objectives; delete v1.progression.milestones; delete v1.progression.onboarding;
  v1.player.level = 7; v1.player.xp = 900;
  const climbed = validateSaveState(v1);
  chk(climbed.ok && climbed.state.version === SAVE_VERSION,
      'a version 1 save still climbs the entire ladder to 4');
  chk(climbed.state.progression.onboarding.length === ONBOARDING_CUE_IDS.length &&
      climbed.state.player.level === undefined && climbed.state.player.xp === undefined,
      'arriving fully onboarded and with no XP — every earlier migration still holds');

  /* Nothing in the save can bring a tutorial back. */
  chk(!/tutorial/i.test(strip(SRC.slice(SRC.indexOf('function validateSaveState'),
                                        SRC.indexOf('function describeSaveState')))),
      'the validator has no tutorial field to resurrect, migrate or ignore');
  chk(/this\.onboarding = new Set\(g\.onboarding\);/.test(LIVE),
      'and a restore applies the set the file carried rather than re-deriving it');
}

// =====================================================================================
// 8. NOTHING ELSE MOVED — requirements 16, 22, 23, 24
// =====================================================================================
head('8. NOTHING ELSE MOVED');
{
  // The Phase 27 HUD, intact.
  for (const id of ['conditionTicks', 'perceptionTrace', 'objectivePanel', 'journeyStep', 'hotbar', 'interactPrompt'])
    chk(LIVE_BODY.indexOf('id="' + id + '"') >= 0, `the Phase 27 HUD keeps #${id}`);
  chk(!/id="xpBar|id="levelLabel|id="healthBar|id="sanityBar"/.test(LIVE_BODY),
      'and none of the retired vocabulary came back to compensate for the tutorial');

  // XP stays dead — including any tutorial-era mention of it.
  chk(!/\bxp\b/i.test(LIVE_BODY) && !/Each <b>Stage<\/b>|gain XP|level up/i.test(SRC),
      'no XP or level text survives anywhere, in the document or in the deleted card text');

  // Mission Directives stay retired.
  chk(!/MISSION DIRECTIVES/.test(LIVE) && !/id="step[1-6]"/.test(LIVE),
      'the MISSION DIRECTIVES checklist is still gone');

  // The compass is untouched and is still the only navigation instrument.
  chk(typeof Game.prototype.grantCompass === 'function' && LIVE_BODY.indexOf('id="compassTape"') >= 0,
      'the compass is still earned from the first Ancient Chest and still drawn as a tape');
  chk(!/id="minimap"|id="waypoint"|id="questArrow"|id="questLog"/.test(LIVE),
      'and this phase added no minimap, waypoint, quest arrow or quest log');

  // No replacement wall of text.
  const controls = BODY.slice(BODY.indexOf('<div class="controls">'), BODY.indexOf('</div>', BODY.indexOf('<div class="controls">')));
  const keys = (controls.match(/&bull;/g) || []).length + 1;
  chk(controls.split('<br>').length <= 2 && keys <= 8,
      `the start screen's control legend is down to ${controls.split('<br>').length} lines — it is a legend, not a manual`);
  chk(!/LEFT CLICK|RIGHT CLICK|E CRAFTING/.test(controls),
      'and the verbs the world now teaches were taken off it, so nothing is said twice');
  const longStrings = (LIVE.match(/'[^'\n]{140,}'/g) || []).concat(LIVE.match(/"[^"\n]{140,}"/g) || []);
  chk(longStrings.length === 0,
      'and no instructional paragraph was added anywhere to replace the deleted ones' +
      (longStrings.length ? ': ' + longStrings[0].slice(0, 80) : ''));
}

console.log('');
if (fail) { console.log(`${fail} PHASE 28 ONBOARDING CHECK(S) FAILED`); process.exit(1); }
console.log('ALL PHASE 28 ONBOARDING CHECKS PASS');
note('Offline. The real cue table, objective chain, latch and save ladder were driven; the');
note('tutorial\'s absence is asserted against the real document and the real stylesheet. No');
note('browser ran here (see browser-onboarding.js) and no human played this.');
