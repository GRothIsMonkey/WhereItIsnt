/* PHASE 27 — HEALTH / SANITY / HUD REBIRTH.

   WHAT THIS FILE CAN AND CANNOT PROVE.

   It runs the REAL UIManager out of game.html, in the offline harness, against a DOM
   stub that actually records what was written to it — a real classList backed by a Set,
   a style object that remembers custom properties, an innerHTML that genuinely empties
   an element. Everything below is therefore a statement about what the shipped HUD code
   DOES when it is driven, not about what its source looks like, except where a check
   says plainly that it is structural.

   IT CANNOT PROVE THE HUD LOOKS GOOD. No test in this repository can. It can prove that
   health is not hearts, that perception is not a second health bar, that the two are
   built out of different materials and answer to different state, that nothing is
   painted twice, that nothing survives a New Game, and that the whole thing costs
   almost nothing per frame. Whether a person looks at it and thinks "indie horror game"
   is a judgement for a person, and the final report says so.

   The before/after cost comparison needs the Phase 26 build:

       git show c05efbe:game.html > tests/phase26.html
       # ...or: WII_PRE27=/path/to/old.html node hud.js

   Without it that section prints a SKIP and the rest of the file still runs. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { load } = require('./harness/load.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
const STYLE = SRC.slice(SRC.indexOf('<style>'), SRC.indexOf('</style>'));
const BODY = SRC.slice(SRC.indexOf('<body>'), SRC.indexOf('<script src='));
/* Comments are stripped wherever a check is about what the build DOES rather than what
   it says about itself: this phase, like Phase 26 before it, left gravestones. */
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
/* Exactly one method body, brace-matched. A fixed-size window would run off the end of a
   short method into the next one, and then a check about `updateVitals` would really be
   reading whatever happened to follow it — which is how a structural test quietly starts
   asserting nothing (or, worse, failing on someone else's code). */
function methodBody(src, name) {
  const i = src.indexOf('\n  ' + name + '(');
  if (i < 0) return null;
  const open = src.indexOf('{', i);
  if (open < 0) return null;
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
  return null;
}
const LIVE = strip(SRC);
const LIVE_STYLE = strip(STYLE);
const LIVE_BODY = strip(BODY);

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));

console.log('booting the real script...');
const S = load(path.join(ROOT, 'game.html'));
const g = (n) => vm.runInContext(n, S);
const doc = S.document;
const ITEM = g('ITEM');
const ITEM_DATA = g('ITEM_DATA');
const BLOCK = g('BLOCK');
const INVENTORY_SIZE = g('INVENTORY_SIZE');
const UIManager = g('UIManager');
const PlayerController = g('PlayerController');
const DOOR_LOOKUP = g('DOOR_LOOKUP');

/* A body in the shape UIManager reads. It is deliberately NOT a PlayerController: the
   HUD must be drivable from plain state, which is the Era 2 requirement (nothing in the
   HUD may know about voxels, chunks or meshes) asserted by construction. */
function fakePlayer(over) {
  const slots = [];
  for (let i = 0; i < INVENTORY_SIZE; i++) slots.push({ item: ITEM.NONE, count: 0 });
  return Object.assign({
    hp: 100, maxHp: 100, dead: false, selectedSlot: 0,
    inFarmlands: false, inSuburbia: false, inFakeHaven: false,
    inventory: { slots },
  }, over || {});
}

const ui = new UIManager();
const player = fakePlayer();
ui.bindPlayer(player);

const el = (id) => doc.getElementById(id);
const ticks = () => el('conditionTicks').children;
const litCount = () => ticks().filter(t => t.classList.contains('lit')).length;
const vitalClass = (prefix) =>
  ['steady','worn','failing','critical','gone','calm','drifting','breaking','lost']
    .map(k => prefix + '-' + k).find(c => el('vitals').classList.contains(c)) || null;

// =====================================================================================
// 1. CONDITION — health, without hearts and without a bar
// =====================================================================================
head('1. CONDITION');
{
  ui.updateVitals(player);
  chk(ticks().length === 10,
      `a new game paints the condition readout: ${ticks().length} ticks at 100 max health`);
  chk(litCount() === 10, 'and all of them are lit at full health');

  /* THE LADDER GROWS WITH THE BODY. Phase 26's endurance milestones grant max health;
     ten health per tick is what makes that grant visible instead of silently rescaling
     a bar to look exactly as full as it did before. */
  player.maxHp = 120; player.hp = 120; ui.updateVitals(player);
  chk(ticks().length === 12 && litCount() === 12,
      'an endurance milestone adds ticks rather than rescaling: 120 max health reads as 12');
  player.maxHp = 170; player.hp = 170; ui.updateVitals(player);
  chk(ticks().length === 17 && litCount() === 17,
      'and all three milestones read as 17 — the instrument is as long as the body is durable');

  player.maxHp = 100; player.hp = 100; ui.updateVitals(player);
  player.hp = 63; ui.updateVitals(player);
  chk(litCount() === 7 && ticks()[6].style.getPropertyValue('--f') === '0.3',
      'damage moves it: 63/100 lights 6 whole ticks and fills the seventh three tenths');
  player.hp = 88; ui.updateVitals(player);
  chk(litCount() === 9 && ticks()[8].style.getPropertyValue('--f') === '0.8',
      'and healing moves it back: 88/100 lights nine, the last four fifths');

  const states = [];
  for (const hp of [100, 70, 50, 25, 8]) { player.hp = hp; ui.updateVitals(player); states.push(vitalClass('hp')); }
  chk(JSON.stringify(states) === JSON.stringify(['hp-steady','hp-steady','hp-worn','hp-failing','hp-critical']),
      `the four states are reached in order as the body fails: ${states.join(' -> ')}`);

  /* The thresholds are PROPORTIONS, so a player who earned 170 max health reads
     CRITICAL at the same fraction of themselves rather than at the same number. */
  player.maxHp = 170; player.hp = 20; ui.updateVitals(player);
  chk(vitalClass('hp') === 'hp-critical',
      'and they are proportional: 20/170 is critical, the same as 12/100 would be');
  player.maxHp = 100; player.hp = 100; ui.updateVitals(player);

  chk(/#vitals\.hp-critical \.tick\.lit \{ animation: vitalBreath/.test(LIVE_STYLE) &&
      /@keyframes vitalBreath \{ 0%,100% \{ opacity: 1; \} 50% \{ opacity: 0\.42; \} \}/.test(LIVE_STYLE),
      'critical is a slow breath on the ticks that are left — one opacity keyframe, nothing full-screen');
}

// =====================================================================================
// 2. NO HEARTS, NO BAR, NO XP — the vocabulary the phase exists to remove
// =====================================================================================
head('2. THE VOCABULARY THAT IS GONE');
{
  const hearts = [
    [/&#10084;/, 'the &#10084; heart glyph'],
    [/[❤♥♡]/, 'a literal heart character'],
    [/&#129504;/, 'the &#129504; brain glyph'],
    [/id="healthIcon"/, '#healthIcon'],
    [/id="sanityBrain"/, '#sanityBrain'],
    [/id="healthBarInner"|id="healthBarOuter"/, 'the health bar'],
    [/id="sanityBarInner"|id="sanityBarOuter"/, 'the sanity bar'],
  ];
  const left = hearts.filter(h => h[0].test(LIVE)).map(h => h[1]);
  chk(left.length === 0,
      'no heart, no brain and no vital BAR is in the document' + (left.length ? ' — STILL THERE: ' + left.join(', ') : ''));
  chk(!/#healthBarInner|#sanityBarInner|#healthWrap|#sanityWrap|#topContainer/.test(LIVE_STYLE),
      'and no stylesheet rule still paints one');
  chk(!/this\.healthBar\b|this\.sanityBar\b|this\.sanityBrain\b/.test(LIVE),
      'and no runtime handle to one survives in UIManager');

  // Phase 26's guarantee, re-asserted here because this phase rewrote the markup.
  chk(!/id="xpBar|id="levelLabel"|id="xpWrap"|id="levelUpToast"/.test(LIVE),
      'and the rebuilt HUD reintroduced no XP element');
  chk(!/\bLv\.|LEVEL UP|Requires Level|Next Level|\bXP\b/.test(LIVE_BODY + LIVE_STYLE),
      'and no string the player can read says Lv., LEVEL UP or XP (the script keeps its Phase 26 gravestones, which no one reads)');
}

// =====================================================================================
// 3. PERCEPTION — a different instrument, not a second bar
// =====================================================================================
head('3. PERCEPTION');
{
  const cv = el('perceptionTrace');
  chk(cv && cv.width === 176 && cv.height === 18, 'the perception trace is a canvas, drawn like the compass');

  const seen = [];
  for (const v of [100, 80, 60, 30, 8]) { ui.setSanity(v); seen.push(vitalClass('p')); }
  chk(JSON.stringify(seen) === JSON.stringify(['p-calm','p-calm','p-drifting','p-breaking','p-lost']),
      `the four states are reached as perception fails: ${seen.join(' -> ')}`);

  /* THE READING IS THE SHAPE OF THE LINE. Measured, not asserted: the trace is drawn
     into a recording context and the vertical spread of what it drew is compared across
     sanity values. A calm mind draws a near-flat line; a lost one does not. */
  const ctx = cv.getContext('2d');
  function spread(value) {
    const ys = []; let gaps = 0, strokes = 0;
    const realMove = ctx.moveTo, realLine = ctx.lineTo, realStroke = ctx.stroke;
    ctx.moveTo = (x, y) => { ys.push(y); gaps++; };
    ctx.lineTo = (x, y) => { ys.push(y); };
    ctx.stroke = () => { strokes++; };
    ui.view.sanity = value; ui._drawPerception();
    ctx.moveTo = realMove; ctx.lineTo = realLine; ctx.stroke = realStroke;
    return { range: Math.max(...ys) - Math.min(...ys), gaps, strokes, points: ys.length };
  }
  const calm = spread(100), drift = spread(55), lost = spread(6);
  chk(calm.range < 1.2, `at full perception the line is flat (${calm.range.toFixed(2)}px of travel)`);
  chk(drift.range > calm.range * 3, `it becomes unsteady as perception drops (${drift.range.toFixed(2)}px)`);
  chk(lost.range > drift.range * 1.5, `and unstable at the last state (${lost.range.toFixed(2)}px)`);
  chk(calm.gaps <= 2 && lost.gaps > 6,
      `and the signal starts LOSING PIECES OF ITSELF: ${calm.gaps - 1} breaks when calm, ${lost.gaps - 1} when lost`);
  chk(lost.strokes > calm.strokes,
      `with displaced fragments turning up where the line is not (${lost.strokes - calm.strokes} extra)`);
  chk(calm.points < 120, `the whole trace is one path of ${calm.points} points — no SVG, no nodes, no allocation per frame`);

  /* DETERMINISTIC. The trace must LOOK unstable without BEING nondeterministic, or a
     screenshot could never be reproduced and the same state would read differently
     twice. Two draws at the same value and the same clock are identical. */
  const a = spread(30); const before = ui._traceT;
  ui._traceT = before; const b = spread(30);
  chk(a.range === b.range && a.gaps === b.gaps, 'the same state draws the same picture — no Math.random in the trace');

  /* NOT A BAR, NOT A NUMBER, NOT A DIAGNOSTIC. */
  chk(!/Reality|Integrity|Stability|Coherence|Sanity/.test(LIVE_BODY),
      'nothing on screen names the system, gives it a percentage or reports on reality');
  chk(!/#perceptionTrace[^}]*width: *\d+%/.test(LIVE_STYLE),
      'and the perception readout is not a percentage-width fill wearing a different colour');
}

// =====================================================================================
// 4. THE TWO ARE MADE OF DIFFERENT THINGS
// =====================================================================================
head('4. HEALTH IS NOT SANITY');
{
  const cond = el('conditionTicks'), perc = el('perceptionTrace');
  chk(cond.children.length > 0 && cond.getContext('2d') === null,
      `CONDITION is discrete DOM: ${cond.children.length} ticks you can count, and no drawing surface`);
  chk(!!perc.getContext('2d') && (perc.children === undefined || perc.children.length === 0),
      'PERCEPTION is a continuous canvas trace: one surface, nothing to count');

  /* They cannot be recoloured copies of each other if no rule reaches both of them. */
  const rules = LIVE_STYLE.split('}').map(r => r.split('{')[0]);
  const both = rules.filter(r => /(\.tick|conditionTicks)/.test(r) && /perceptionTrace/.test(r));
  chk(both.length === 0, 'no stylesheet rule paints both of them — they share tokens, not appearance');

  const condRules = STYLE.slice(STYLE.indexOf('--- CONDITION'), STYLE.indexOf('--- PERCEPTION'));
  chk(/--tick-lit: var\(--hud-ink\)/.test(condRules) && /#c58a5c|#c7a877/.test(condRules),
      'condition carries a warm ramp that darkens toward the warning colour');
  chk(!/rgba\(206,214,202/.test(condRules) && /rgba\(206,214,202/.test(LIVE),
      'perception carries the cool ash ink and nothing warm — they are not the same colour twice');
  chk(/\.hp-critical/.test(LIVE_STYLE) && !/\.p-critical/.test(LIVE_STYLE) &&
      /\.p-lost/.test(LIVE_STYLE) && !/\.hp-lost/.test(LIVE_STYLE),
      'and they do not even share state names: hp-steady..hp-gone and p-calm..p-lost are separate vocabularies');
}

// =====================================================================================
// 5. THE OBJECTIVE — presentation only, and still owned elsewhere
// =====================================================================================
head('5. THE OBJECTIVE');
{
  ui.setObjective('Gather wood.', false);
  chk(el('journeyStep').textContent === 'Gather wood.' && el('journeyStep').classList.contains('show'),
      'the objective appears on the HUD');
  chk(!el('journeyStep').classList.contains('changed'),
      'the FIRST objective of a run arrives, it does not "change" — nothing flashes at a player who just started');

  ui.setObjective('Craft a basic tool.', false);
  chk(el('journeyStep').textContent === 'Craft a basic tool.' && el('journeyStep').classList.contains('changed'),
      'a later objective replaces it and is marked as changed');

  const anim = LIVE_STYLE.match(/#journeyStep\.changed \{ animation: (\w+) (\d+)ms/);
  chk(anim && Number(anim[2]) <= 1200, `the notification is ${anim ? anim[2] : '?'}ms long and nothing else happens`);
  const kf = LIVE_STYLE.slice(LIVE_STYLE.indexOf('@keyframes objArrive'), LIVE_STYLE.indexOf('#hudStatus'));
  chk(!/scale|width|font-size|background/.test(kf) && /opacity|translateY/.test(kf),
      'it is opacity and four pixels of lift — no banner, no growth, no fill, nothing across the screen');
  chk(!/#objectivePanel[^}]*background:/.test(LIVE_STYLE) && !/#journeyStep[^}]*background/.test(LIVE_STYLE),
      'and the panel it sat in is gone: the objective is text against a hairline, not a quest box');

  ui.setObjective(null, false);
  chk(el('journeyStep').textContent === '' && !el('journeyStep').classList.contains('show'),
      'and it can go silent entirely, which is what every scripted sequence asks it to do');

  /* THE HUD IS A RENDERER. Objective authority stayed in the objective system: the class
     body must not contain a single objective table, rule or condition. */
  const cls = LIVE.slice(LIVE.indexOf('class UIManager {'), LIVE.indexOf('class OpeningInstruction'));
  chk(!/OBJECTIVE_CHAINS|OBJECTIVE_OVERRIDES|ObjectiveSystem|objectives\./.test(cls),
      'UIManager reads no objective table and knows no objective rule — it renders the line it is handed');
  chk(/setObjective\(text, struck\) \{ this\.setJourneyStep\(text, !!struck\); \}/.test(LIVE),
      'and setObjective is literally a forward to the DOM writer');
}

// =====================================================================================
// 6. THE STATUS LINE
// =====================================================================================
head('6. STATUS');
{
  ui.updateObjectiveHUD(false, 0, 0, 1, 3, 1);
  chk(el('objStatus').textContent === '',
      'with no Anchor placed the Anchor readout says NOTHING — "Unplaced | Fuel: 0s" was a permanent reading of nothing');
  chk(el('memStatus').textContent === 'FRAGMENTS 0/3' && el('stageStatus').textContent === 'STAGE 1',
      'the parts that do have something to say are instrument labels, not sentences');
  ui.updateObjectiveHUD(true, 41.2, 2, 2, 3, 5);
  chk(el('objStatus').textContent === 'ANCHOR 42S', 'a burning Anchor reports its fuel, rounded up, in one label');
  chk(/#hudStatus span:not\(:empty\) ~ span:not\(:empty\)::before/.test(LIVE_STYLE),
      'and a separator only ever appears between two parts that both said something');
  const statusFn = methodBody(LIVE, 'updateObjectiveHUD');
  chk(!/day/.test(statusFn) && /this\.dayLabel\.textContent = String\(day\)/.test(LIVE),
      'the day was dropped from this line and is still on the clock in the opposite corner, where it always was');
}

// =====================================================================================
// 7. THE HOTBAR
// =====================================================================================
head('7. THE HOTBAR');
{
  player.inventory.slots[0] = { item: ITEM.TORCH, count: 12 };
  player.inventory.slots[1] = { item: ITEM.WOOD_PLANK, count: 1 };
  player.selectedSlot = 0;
  ui.updateHotbarSelection();
  const cells = el('hotbar').children;
  chk(cells.length === 9, 'the strip still has nine cells');
  chk(cells[0].classList.contains('active') && !cells[1].classList.contains('active'),
      'the selected cell is marked, and only that one');
  chk(String(ui.slots[0].countEl.textContent) === '12', 'a stack still prints its count');
  chk(ui.slots[1].countEl.textContent === '',
      'and a single item does not: a count of one is not information');

  player.selectedSlot = 1; ui.updateHotbarSelection();
  chk(!cells[0].classList.contains('active') && cells[1].classList.contains('active'),
      'changing slot moves the mark');
  chk(el('heldName').textContent === ITEM_DATA[ITEM.WOOD_PLANK].name && el('heldName').classList.contains('show'),
      `and the held item names itself for a moment: "${el('heldName').textContent}"`);

  /* SELECTION IS NOT A GLOWING GOLD BOX. Three quiet cues that agree, on a strip with
     no per-cell border and no gap. */
  chk(/#hotbar \{[^}]*gap: 0;/.test(LIVE_STYLE) && /#hotbar \.slot \{[^}]*border: none;/.test(LIVE_STYLE),
      'the hotbar is one continuous strip: no gap between cells, no border around them');
  chk(/#hotbar \.slot\.active::after/.test(LIVE_STYLE) &&
      /#hotbar \.slot\.active \.swatch \{ transform: scale/.test(LIVE_STYLE),
      'and selection is a brass under-rule plus a slightly larger item, not a box that glows');
  chk(!/box-shadow: 0 0 8px #ffcf6b88/.test(LIVE_STYLE), 'the old gold selection glow is gone');
}

// =====================================================================================
// 8. THE INTERACTION PROMPT
// =====================================================================================
head('8. THE INTERACTION PROMPT');
{
  const doorId = Array.from(DOOR_LOOKUP.keys()).find(k => DOOR_LOOKUP.get(k).state === 'closed');
  const openId = Array.from(DOOR_LOOKUP.keys()).find(k => DOOR_LOOKUP.get(k).state !== 'closed');
  const self = { inFakeHaven: false };
  const pf = (id) => PlayerController.prototype._promptForBlock.call(self, id);
  chk(pf(doorId).verb === 'OPEN' && pf(openId).verb === 'CLOSE', 'a door says what it will do, both ways');
  chk(pf(BLOCK.SAFEHOUSE_ANCHOR).verb === 'FEED THE ANCHOR',
      'the Anchor Monument now has an affordance, which it never had');
  chk(pf(BLOCK.TREASURE_CHEST).verb === 'OPEN', 'and so does an Ancient Chest');
  chk(pf(BLOCK.STONE) === null && pf(BLOCK.DIRT) === null, 'and ordinary blocks offer nothing');

  ui.setInteractPrompt(pf(doorId));
  chk(el('interactPrompt').classList.contains('show') &&
      el('interactKey').textContent === 'RMB' && el('interactVerb').textContent === 'OPEN',
      'the HUD shows it as a key chip and a verb');
  const HUD_MARKUP = LIVE_BODY.slice(LIVE_BODY.indexOf('<div id="hud">'), LIVE_BODY.indexOf('<div id="dimensionBanner">'));
  chk(!/PRESS .* TO/i.test(HUD_MARKUP) && !/Right-click to open|Right-click to close/.test(LIVE),
      'not as "PRESS E TO INTERACT", and the old top-of-screen "Right-click to open" toast is gone entirely');
  ui.setInteractPrompt(null);
  chk(!el('interactPrompt').classList.contains('show'), 'and it goes away when there is nothing to act on');
  /* The fade is asserted here rather than in the browser: under SwiftShader the animated
     opacity read back on the main thread lagged the class by seconds at random, so the
     browser run suppresses the transition and measures the end state instead. */
  chk(/#interactPrompt \{[^}]*opacity: 0;[^}]*transition: opacity 140ms linear;/.test(LIVE_STYLE) &&
      /#interactPrompt\.show \{ opacity: 1; \}/.test(LIVE_STYLE),
      'and it arrives and leaves on a 140ms fade rather than popping');

  /* Every exit path of the highlight update answers the prompt, or a prompt would stick
     to the screen after the player looked away. */
  const fn = methodBody(LIVE, '_updateTargetHighlight');
  const exits = (fn.match(/return;/g) || []).length;
  const answers = (fn.match(/_setPrompt\(/g) || []).length;
  chk(exits === answers && exits >= 4,
      `all ${exits} exit paths of the look-target update answer the prompt — it can never stick`);

  /* AND THE GATE ABOVE IT. PlayerController.update returns before the look-target work
     ever happens when the player is not pointer-locked, has a menu open, or is dead —
     which left the prompt frozen on screen offering an interaction the player could not
     perform. Caught by the browser run, which could not make the prompt go away. */
  const upd = methodBody(LIVE, 'update');
  chk(/if \(!this\.locked \|\| this\.ui\.menuOpen \|\| this\.dead\) \{ this\._setPrompt\(null\); return; \}/.test(LIVE),
      'and losing pointer lock, opening a menu or dying clears it at the gate above that method');
}

// =====================================================================================
// 9. THE COMPASS IS NOT BEING REDESIGNED
// =====================================================================================
head('9. THE COMPASS');
{
  chk(!!el('compassTape') && el('compassTape').width === 252 && el('compassTape').height === 26,
      'the tape is the same 252x26 instrument Phase 20.2 built');
  ui.setCompassVisible(true);
  chk(el('compassWrap').classList.contains('show'), 'and it still shows only when it has been earned');
  ui.setCompassVisible(false);
  chk(!el('compassWrap').classList.contains('show'), 'and hides again');
  const draw = SRC.slice(SRC.indexOf('  updateCompass(yaw) {'), SRC.indexOf('  triggerBossVictory'));
  chk(!/landmark|distance|arrow|marker|destination/i.test(draw),
      'it still draws nothing but heading — no marker, no arrow, no destination');
  chk(!/id="minimap"|id="waypoint"|id="questArrow"/.test(LIVE),
      'and this phase added no second navigation system');
}

// =====================================================================================
// 10. ONE HUD, MOUNTED ONCE
// =====================================================================================
head('10. NO DUPLICATION');
{
  const ids = ['hud','hotbar','heldName','vitals','conditionTicks','perceptionTrace',
               'objectivePanel','journeyStep','hudStatus','objStatus','memStatus','stageStatus',
               'compassWrap','compassTape','clockWrap','interactPrompt','hudToast','miningReadout'];
  const dupes = ids.filter(i => (SRC.match(new RegExp('id="' + i + '"', 'g')) || []).length !== 1);
  chk(dupes.length === 0,
      `each of the ${ids.length} HUD elements is in the document exactly once` +
      (dupes.length ? ' — DUPLICATED: ' + dupes.join(', ') : ''));

  /* Nothing creates a HUD container at runtime, so a dimension crossing or a load has
     nothing it could duplicate. The only elements the HUD builds are the cells inside
     two containers it empties first. */
  const cls = LIVE.slice(LIVE.indexOf('class UIManager {'), LIVE.indexOf('class OpeningInstruction'));
  const creates = (cls.match(/document\.createElement/g) || []).length;
  chk(/this\.conditionTicksEl\.innerHTML = '';/.test(cls) && /this\.hotbarEl\.innerHTML = '';/.test(cls),
      `the ${creates} elements it does build (ticks and cells) are always emptied before rebuilding`);

  // Rebuilding twice must not stack.
  ui._buildConditionTicks(170); ui._buildConditionTicks(170);
  chk(ticks().length === 17, 'building the condition ladder twice leaves 17 ticks, not 34');
  ui._buildHotbar();
  chk(el('hotbar').children.length === 9, 'and rebuilding the hotbar leaves nine cells, not eighteen');
  ui.bindPlayer(player);

  /* No listener is bound from anything the frame loop calls. */
  const perFrame = ['updateVitals','setSanity','_paintCondition','_drawPerception',
                    'updateObjectiveHUD','setJourneyStep','updateHotbarSelection','setInteractPrompt'];
  const bad = perFrame.filter(m => {
    const body = methodBody(cls, m);
    return body === null || /addEventListener/.test(body);
  });
  chk(bad.length === 0,
      'and no per-frame HUD path binds a listener' + (bad.length ? ' — ' + bad.join(', ') : ''));
}

// =====================================================================================
// 11. DEATH, RESPAWN, NEW GAME, LOAD
// =====================================================================================
head('11. STATE TRANSITIONS');
{
  player.maxHp = 100; player.hp = 100; player.dead = false;
  ui.updateVitals(player); ui.setSanity(64);

  player.hp = 0; player.dead = true; ui.updateVitals(player);
  chk(vitalClass('hp') === 'hp-gone' && litCount() === 0, 'death darkens the whole condition ladder');
  const cv = el('perceptionTrace').getContext('2d');
  let lines = 0; const realLine = cv.lineTo; cv.lineTo = () => { lines++; };
  ui._drawPerception(); cv.lineTo = realLine;
  chk(lines === 1,
      'and the perception trace stops reporting — the rule it is measured against is still drawn, ' +
      'and nothing is drawn on it: a dead body has no perception to read');

  player.hp = 100; player.dead = false; ui.updateVitals(player);
  chk(vitalClass('hp') === 'hp-steady' && litCount() === 10, 'respawning restores it in full');

  /* A NEW GAME AND A LOAD BOTH GO THROUGH ONE TEARDOWN, and the HUD is cleared there. */
  ui.showToast('Something happened.', 9999);
  ui.setObjective('Survive until dawn.', false);
  ui.setInteractPrompt({ key: 'RMB', verb: 'OPEN' });
  ui.updateObjectiveHUD(true, 30, 2, 3, 3, 9);
  ui.resetPresentation();
  chk(el('journeyStep').textContent === '' && el('hudToast').textContent === '' &&
      !el('hudToast').classList.contains('show') && !el('interactPrompt').classList.contains('show') &&
      el('objStatus').textContent === '' && el('memStatus').textContent === '' &&
      el('heldName').textContent === '',
      'a New Game clears every transient element the previous run raised');
  chk(vitalClass('hp') === null && vitalClass('p') === null &&
      ui.view.hp === null && ui.view.sanity === null && ui.view.slot === null,
      'and the presentation cache with them, so the restore that follows cannot skip a repaint');

  // The freshly-cleared HUD repaints correctly from restored state.
  const restored = fakePlayer({ hp: 41, maxHp: 120, selectedSlot: 4 });
  restored.inventory.slots[4] = { item: ITEM.TORCH, count: 3 };
  ui.bindPlayer(restored);
  ui.updateVitals(restored); ui.setSanity(55.5); ui.setObjective('Return to the Anchor.', false);
  ui.updateHotbarSelection();
  chk(ticks().length === 12 && litCount() === 5 && vitalClass('hp') === 'hp-failing',
      'a load repaints condition from the restored body (41/120, five ticks, failing)');
  chk(vitalClass('p') === 'p-drifting', 'and perception from the restored value (55.5)');
  chk(el('hotbar').children[4].classList.contains('active') && String(ui.slots[4].countEl.textContent) === '3',
      'and the hotbar from the restored slot');
  chk(el('journeyStep').textContent === 'Return to the Anchor.' &&
      !el('journeyStep').classList.contains('changed'),
      'and the restored objective ARRIVES rather than flashing as a change — a load is not progress');

  /* Structural: the two verbs really do route through that one teardown, and the
     restore really does re-push all four readings. */
  chk(/this\.ui\.resetPresentation\(\);/.test(LIVE) &&
      (LIVE.match(/resetPresentation\(\);/g) || []).length === 1,
      'resetPresentation is called from exactly one place — the single teardown path');
  const td = LIVE.slice(LIVE.indexOf('  _teardownForRestore() {'), LIVE.indexOf('  _applyRestoredState('));
  chk(/resetPresentation/.test(td), 'and that place is _teardownForRestore, which a New Game and a Load both run');
  const ap = LIVE.slice(LIVE.indexOf('  _applyRestoredPresentation(state) {'), LIVE.indexOf('  /* --- THE VERBS'));
  const pushes = ['setSanity','updateVitals','updateHotbarSelection','setDay','setPhase','_refreshObjective'];
  chk(pushes.every(p => ap.indexOf(p) > 0), 'and the restore re-pushes every reading the HUD shows');
}

// =====================================================================================
// 12. LAYERING — the HUD can never cover a menu
// =====================================================================================
head('12. LAYERING');
{
  const z = {};
  const re = /#([A-Za-z][\w-]*)[^{}]*\{[^}]*z-index: (\d+)/g;
  let m; while ((m = re.exec(LIVE_STYLE))) if (z[m[1]] === undefined) z[m[1]] = Number(m[2]);
  chk(z.hud === 15, `#hud sits at z-index ${z.hud} and, being positioned, is a stacking context`);
  const hudKids = ['hotbar','heldName','vitals','objectivePanel','compassWrap','clockWrap','interactPrompt'];
  chk(hudKids.every(k => z[k] === undefined || z[k] < 50),
      'no gameplay HUD element declares a layer that could reach a menu');
  chk(z.settingsOverlay === 56 && z.startScreen === 50 && z.creditsScreen === 70,
      `settings (${z.settingsOverlay}) is above the HUD and the start screen (${z.startScreen}); the credits (${z.creditsScreen}) are above everything`);
  chk(z.craftingOverlay === 40 && z.backpackOverlay === 40 && z.storageOverlay === 40,
      'and the inventory overlays stayed where Phase 22 put them');
  chk(Math.max(...hudKids.map(k => z[k] || 0)) < z.settingsOverlay,
      'so opening SETTINGS can never be covered by the HUD — the Phase 22 stacking bug cannot come back this way');

  /* The pause gate is the existing one and this phase did not add a second. */
  chk(/get menuOpen\(\) \{ return this\.craftingOpen \|\| this\.backpackOpen \|\| this\.storageOpen \|\| this\.settingsOpen; \}/.test(LIVE),
      'and the single input gate is untouched — the HUD introduced no second pause concept');
}

// =====================================================================================
// 13. THE HUD OWNS NOTHING
// =====================================================================================
head('13. NO SECOND SOURCE OF TRUTH');
{
  const cls = LIVE.slice(LIVE.indexOf('class UIManager {'), LIVE.indexOf('class OpeningInstruction'));
  const renderers = ['updateVitals','setSanity','_paintCondition','_buildConditionTicks','_drawPerception',
                     'updateObjectiveHUD','setJourneyStep','updateHotbarSelection','setInteractPrompt',
                     '_flashHeldName','resetPresentation'];
  const mutators = [];
  for (const m of renderers) {
    const body = methodBody(cls, m);
    if (body === null) { mutators.push(m + ' (NOT FOUND)'); continue; }
    if (/(player|this\.player)\.(hp|maxHp|sanity|dead|selectedSlot)\s*=[^=]/.test(body) ||
        /sanity\.value\s*=[^=]/.test(body) ||
        /inventory\.(addItem|consume|swapSlots|dropFromSlot)/.test(body)) mutators.push(m);
  }
  chk(mutators.length === 0,
      'no HUD render path writes health, sanity, death, the selected slot or the inventory' +
      (mutators.length ? ' — ' + mutators.join(', ') : ''));
  chk(!/\bhudHp\b|\bhudSanity\b|\bhudObjective\b/.test(LIVE),
      'and there is no hudHp, hudSanity or hudObjective anywhere — the cache mirrors, it never owns');
  chk(/THIS IS A PRESENTATION CACHE AND NOTHING ELSE/.test(SRC),
      'the view object says so in the source, where the next phase will read it');

  /* ERA 2. The HUD must survive a renderer and world rewrite, so it may not know what a
     voxel is. Asserted against the class body. */
  const voxel = ['getBlockWorld','getChunk','BLOCK\\.','chunkKey','BufferGeometry','THREE\\.Mesh','worldToChunk'];
  const leaks = voxel.filter(v => new RegExp(v).test(cls));
  chk(leaks.length === 0,
      'and it is semantic: no block id, chunk, mesh or geometry is reachable from UIManager' +
      (leaks.length ? ' — ' + leaks.join(', ') : ''));
}

// =====================================================================================
// 14. COST
// =====================================================================================
head('14. COST');
{
  /* A steady frame. Health has not moved, sanity has not moved, the inventory has not
     moved: this is the overwhelming majority of frames in a run, and it is the one that
     has to be free. Counted, not estimated — the recording DOM makes every write
     observable. */
  const steady = fakePlayer({ hp: 100, maxHp: 100 });
  steady.inventory.slots[0] = { item: ITEM.TORCH, count: 5 };
  ui.bindPlayer(steady);
  ui.updateVitals(steady); ui.setSanity(100); ui.updateHotbarSelection();

  let writes = 0, draws = 0, strokes = 0;
  for (const t of ticks()) {
    const real = t.style.setProperty.bind(t.style);
    t.style.setProperty = (k, v) => { writes++; real(k, v); };
  }
  for (const s of ui.slots) {
    const c = s.swatchEl.getContext('2d');
    const rd = c.drawImage; c.drawImage = () => { draws++; };
  }
  const pctx = el('perceptionTrace').getContext('2d');
  const rs = pctx.stroke; pctx.stroke = () => { strokes++; };

  const FRAMES = 600;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < FRAMES; i++) {
    ui.updateVitals(steady); ui.setSanity(100); ui.updateHotbarSelection();
    ui.updateObjectiveHUD(true, 60, 0, 1, 3, 1);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  pctx.stroke = rs;
  chk(writes === 0 && draws === 0 && strokes === 0,
      `${FRAMES} steady frames perform ${writes} style writes, ${draws} icon redraws and ${strokes} canvas strokes — nothing`);
  note(`and cost ${(ms / FRAMES * 1000).toFixed(2)} µs per frame in total ` +
       `(${(ms / FRAMES / 16.67 * 100).toFixed(3)}% of a 60fps frame)`);
  chk(ms / FRAMES < 0.05, 'the whole HUD costs under 50 µs on a steady frame');

  /* The worst frame the HUD can have: perception low enough to be redrawing at its cap.
     Even forced to repaint on every single call it has to stay negligible. */
  let v = 12, dir = -1;
  const t1 = process.hrtime.bigint();
  for (let i = 0; i < 2000; i++) { v += dir * 0.6; if (v < 4 || v > 20) dir = -dir; ui._traceAt = 0; ui.setSanity(v); }
  const ms2 = Number(process.hrtime.bigint() - t1) / 1e6;
  note(`a FORCED perception repaint costs ${(ms2 / 2000 * 1000).toFixed(2)} µs; the cap allows at most ` +
       `${(1000 / 70).toFixed(0)} a second, so the trace's real budget is ` +
       `${(ms2 / 2000 * (1000 / 70)).toFixed(4)} ms/s`);
  chk(ms2 / 2000 < 0.06, 'a forced repaint of the trace costs under 60 µs');
  chk(/HUD_TRACE_INTERVAL_MS = 70/.test(LIVE) && /now - this\._traceAt < HUD_TRACE_INTERVAL_MS/.test(LIVE),
      'and the cap is enforced in code, not assumed: the trace cannot repaint faster than the frame rate allows it to');
}

// =====================================================================================
// 15. BEFORE AND AFTER — against the Phase 26 build
// =====================================================================================
head('15. AGAINST THE BUILD IT REPLACED');
{
  const pre = process.env.WII_PRE27 || path.join(__dirname, 'phase26.html');
  if (!fs.existsSync(pre)) {
    console.log('SKIP  the Phase 26 build is not present — run: git show c05efbe:game.html > tests/phase26.html');
  } else {
    const S2 = load(pre);
    const g2 = (n) => vm.runInContext(n, S2);
    const ui2 = new (g2('UIManager'))();
    const IT2 = g2('ITEM'), SZ2 = g2('INVENTORY_SIZE');
    const slots2 = []; for (let i = 0; i < SZ2; i++) slots2.push({ item: IT2.NONE, count: 0 });
    slots2[0] = { item: IT2.TORCH, count: 5 };
    const p2 = { hp: 100, maxHp: 100, dead: false, selectedSlot: 0,
                 inFarmlands: false, inSuburbia: false, inFakeHaven: false,
                 inventory: { slots: slots2 } };
    ui2.bindPlayer(p2);

    let oldWrites = 0, oldDraws = 0;
    for (const id of ['healthBarInner', 'sanityBarInner']) {
      const e = S2.document.getElementById(id);
      const inner = {};
      e.style = new Proxy(inner, { set(t, k, val) { oldWrites++; t[k] = val; return true; } });
    }
    for (const s of ui2.slots) {
      const c = s.swatchEl.getContext('2d');
      c.drawImage = () => { oldDraws++; };
    }
    const FRAMES = 600;
    for (let i = 0; i < FRAMES; i++) { ui2.updateVitals(p2); ui2.setSanity(100); ui2.updateHotbarSelection(); }

    chk(oldWrites === FRAMES * 2 && oldDraws === FRAMES,
        `the Phase 26 HUD performed ${oldWrites} style writes and ${oldDraws} icon redraws over the same ${FRAMES} steady frames`);
    note('the new HUD performs zero of both — the difference is the "has this actually changed" guard,');
    note('not a cheaper drawing: what it draws is strictly more than what it replaced.');

    const OLD = fs.readFileSync(pre, 'utf8');
    chk(/id="healthBarInner"/.test(OLD) && /id="sanityBarInner"/.test(OLD) && /&#10084;/.test(OLD),
        'and it is the right build to compare against: it still has the heart, the health bar and the sanity bar');
  }
}

console.log('');
if (fail) { console.log(fail + ' FAILURES'); process.exit(1); }
console.log('ALL PHASE 27 HUD CHECKS PASS');
note('Offline. The real UIManager was driven against a recording DOM; no browser and no');
note('WebGL. Presence, state, transitions and cost are proved here. Whether the result');
note('LOOKS like a horror game is a judgement for a person — see browser-save.js for the');
note('live-document checks, and the phase report for what a human actually looked at.');
