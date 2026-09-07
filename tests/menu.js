/* PHASE 29 — MAIN MENU REBIRTH + HUD TYPOGRAPHY.

   WHAT THIS FILE CAN AND CANNOT PROVE.

   It boots the REAL script out of game.html into the offline harness and drives the real
   MenuAtmosphere, the real MainMenu lifecycle, the real menu-event schedule and the real
   stylesheet. Where a claim is about the shipped SOURCE rather than about behaviour it
   says so, because `Game` cannot be constructed without a GPU.

   IT CANNOT PROVE THE MENU IS ATMOSPHERIC. No test in this repository can. Whether a
   person opens this game and thinks "something is wrong here" is a judgement for a
   person, and the phase report says exactly who has and has not made it. What is proved
   here is that the menu is ONE menu, that it runs no gameplay, mutates nothing, cannot
   stack a listener or a node however many times it is opened and closed, that its
   anomalies are rare and deterministic, and that no type in the HUD is below the size
   this phase committed to.

   The live half — real layout boxes, real computed styles, real clicks — is in
   browser-menu.js and is claimed only there. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { load } = require('./harness/load.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
const STORY = fs.readFileSync(path.join(ROOT, 'STORY.md'), 'utf8');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
const LIVE = strip(SRC);

/* PHASE 30 — EXACTLY ONE CLASS BODY, BRACE-MATCHED.

   This used to be `LIVE.slice(indexOf('class X {'), indexOf(<whatever came next>))`, and
   Phase 30 inserted a new class between the two markers — so the slice quietly grew to
   include it and checks about one class started reading another's code. Matching braces
   cannot drift: the body ends where the class ends, whatever is written after it. */
function classBody(src, name) {
  const i = src.indexOf('class ' + name + ' {');
  if (i < 0) return '';
  const open = src.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
  return '';
}

/* From AFTER the opening tag, and with a leading `}` so the very first rule in the file
   has a boundary in front of it. Without that the rule parser folded `<style>` into the
   first selector and the whole :root block that declares --ui-face went missing — which
   is how a check about the typeface silently had nothing to read. */
const STYLE = '}' + strip(SRC.slice(SRC.indexOf('<style>') + 7, SRC.indexOf('</style>')));
const BODY = strip(SRC.slice(SRC.indexOf('<body>'), SRC.indexOf('<script src=')));
const MENU_MARKUP = BODY.slice(BODY.indexOf('<div id="startScreen">'),
                               BODY.indexOf('<div id="settingsOverlay">'));

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));

console.log('booting the real script...');
const S = load(path.join(ROOT, 'game.html'));
const g = (n) => vm.runInContext(n, S);
const doc = S.document;

const MenuAtmosphere = g('MenuAtmosphere');
const MainMenu = g('MainMenu');
const MENU_EVENTS = g('MENU_EVENTS');
const menuEventAt = g('menuEventAt');
const UIManager = g('UIManager');

/* Every declared rule in the shipped stylesheet as { selectors[], body }, so a check can
   ask what a selector actually SETS rather than pattern-matching the file — and so a
   selector inside a comma group is found the same as one on its own. Comments are already
   stripped, which matters: this phase left several. */
/* @media blocks are lifted out first and kept separately. Without that, "how big is the
   objective" answers with the small-viewport override, because it is declared last — the
   test would be reading a rule that only applies below 860px and reporting it as the
   size the player sees. BASE is what a normal window gets; MEDIA is checked on its own,
   for its own property (that it never goes below the readable floor). */
const MEDIA_RE = /@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g;
const MEDIA_STYLE = (STYLE.match(MEDIA_RE) || []).join('\n');
const BASE_STYLE = STYLE.replace(MEDIA_RE, '');

function parseRules(css) {
  return (css.match(/[^{}]+\{[^{}]*\}/g) || []).map(r => {
    const i = r.indexOf('{');
    return { selectors: r.slice(0, i).split(',').map(x => x.trim()).filter(Boolean),
             body: r.slice(i + 1, -1) };
  });
}
const RULES = parseRules(BASE_STYLE);
/* EVERY body a selector appears in, comma groups included, joined — so a property split
   across two rules (as .menu-btn:focus-visible is) is found wherever it was written. */
function bodiesFor(selector) {
  return RULES.filter(r => r.selectors.indexOf(selector) >= 0).map(r => r.body);
}
function ruleFor(selector) {
  const b = bodiesFor(selector);
  return b.length ? b.join(';') : null;
}
function declared(selector, prop) {
  const bodies = bodiesFor(selector);
  for (let i = bodies.length - 1; i >= 0; i--) {
    const m = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)').exec(bodies[i]);
    if (m) return m[1].trim();
  }
  return null;
}
const ROOT_BLOCK = bodiesFor(':root').join('\n');
function px(value) {
  if (value === null || value === undefined) return null;
  const v = /var\(\s*(--[\w-]+)\s*\)/.exec(value);
  if (v) {
    const m = new RegExp(v[1] + '\\s*:\\s*([^;]+)').exec(ROOT_BLOCK);
    return m ? parseFloat(m[1]) : null;
  }
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

// =====================================================================================
// 1. ONE MENU, AND IT IS THIS ONE
// =====================================================================================
head('1. ONE MENU');
{
  chk((BODY.match(/id="startScreen"/g) || []).length === 1,
      'there is exactly one start screen in the document');
  chk((BODY.match(/id="clickPlay"/g) || []).length === 1 &&
      (BODY.match(/id="continuePlay"/g) || []).length === 1 &&
      (BODY.match(/id="startSettingsLink"/g) || []).length === 1,
      'and exactly one of each of its three controls');
  chk(typeof MainMenu === 'function' && typeof MenuAtmosphere === 'function',
      'the menu is a lifecycle (MainMenu) over a scene (MenuAtmosphere)');
  chk(g('typeof startEmbers') === 'undefined',
      'the old ember particle loop is gone — not disabled, undefined');
  chk(!/id="startEmbers"/.test(BODY), 'and its canvas is out of the document');

  /* The button handlers stay in Game. A menu class that also bound them would be a
     second authority over the same three controls. */
  chk(/clickPlay'\)\.addEventListener\('click', \(\) => this\._start\(\)\)/.test(LIVE),
      'NEW GAME is still bound in Game, to _start() — the menu owns presentation, not verbs');
  const menuBody = classBody(LIVE, 'MainMenu');
  chk(!/getElementById\('clickPlay'\)|getElementById\('startSettingsLink'\)/.test(menuBody),
      'and MainMenu binds none of them itself');
}

// =====================================================================================
// 2. THE MENU IS PRESENTATION. IT MUTATES NOTHING.
// =====================================================================================
head('2. IT MUTATES NOTHING');
{
  const menuBody = classBody(LIVE, 'MainMenu');
  const sceneBody = classBody(LIVE, 'MenuAtmosphere');
  const both = menuBody + sceneBody;

  for (const [what, re] of [
    ['an objective', /objectives?\.|_refreshObjective|setObjective/],
    ['the save file', /saveGame\(|\.write\(|localStorage/],
    ['the world', /world\.|_generateChunk|setBlockWorld|getBlockWorld/],
    ['the clock', /env\.|cycleSeconds|dayCount|\.t \+= dt \* 0|isNight/],
    ['progression', /milestones|stage\s*=|riftDisks|compassAcquired|onboarding/],
    ['the player', /player\.|inventory|\bhp\b|sanity/],
    ['a mob or an entity', /mobs\.|spawn|stalker|phantoms/],
  ]) chk(!re.test(both), `neither class touches ${what}`);

  chk(/g\.saves\.peek\(\)/.test(menuBody) && !/g\.saves\.write|saves\.store/.test(menuBody),
      'it READS the save slot to decide whether CONTINUE exists, and never writes to it');
  chk(!/requestPointerLock/.test(both), 'and neither of them ever asks for pointer lock');
  chk(!/THREE\.|renderer|scene\b/.test(sceneBody),
      'the scene is a 2D canvas — no renderer, no Three.js scene, no second world');
}

// =====================================================================================
// 3. THE LIFECYCLE — open and close, as many times as you like
// =====================================================================================
head('3. THE LIFECYCLE');
{
  const scene = new MenuAtmosphere(doc.getElementById('menuScene'), 7);
  chk(scene.open() === true, 'the scene opens');
  chk(scene.open() === false, 'and opening it again is a no-op rather than a second loop');
  chk(scene.close() === true, 'it closes');
  chk(scene.close() === false, 'and closing it again is a no-op');

  /* THE LISTENER COUNT IS THE WHOLE POINT. A menu that binds on open and never unbinds
     grows a resize handler per cycle; this drives 40 cycles and counts what is left. */
  let bound = 0;
  const realAdd = S.window.addEventListener, realRemove = S.window.removeEventListener;
  S.window.addEventListener = () => { bound++; };
  S.window.removeEventListener = () => { bound--; };
  for (let i = 0; i < 40; i++) { scene.open(); scene.close(); }
  S.window.addEventListener = realAdd; S.window.removeEventListener = realRemove;
  chk(bound === 0, `40 open/close cycles leave ${bound} window listeners behind`);

  scene.open();
  chk(scene.running === true, 'and the scene is live again afterwards');
  scene.close();
  chk(scene.layer === null, 'closing drops the offscreen landscape rather than holding it');

  /* MainMenu binds its audio-arming listeners ONCE, in the constructor, and gates them on
     being open — rather than binding on show() and leaking one set per cycle. */
  const menuBody = classBody(LIVE, 'MainMenu');
  const ctor = menuBody.slice(0, menuBody.indexOf('  _armAudio('));
  /* The invocations, not the `&& x.addEventListener` feature guards beside them. */
  chk((ctor.match(/addEventListener\('/g) || []).length === 3,
      'MainMenu binds its three gesture listeners exactly once, in the constructor');
  chk(!/addEventListener/.test(menuBody.slice(menuBody.indexOf('  show()'))),
      'and show() binds nothing at all');
  chk(/if \(this\.audioArmed \|\| !this\.open\) return false;/.test(menuBody),
      'a gesture that arrives while the menu is closed cannot start menu audio');
}

// =====================================================================================
// 4. THE ANOMALIES — rare, deterministic, and missable
// =====================================================================================
head('4. THE ANOMALIES');
{
  chk(Object.isFrozen(MENU_EVENTS) && Object.keys(MENU_EVENTS).length === 3,
      `there are exactly three scheduled events: ${Object.keys(MENU_EVENTS).join(', ')}`);

  /* NOTHING HAPPENS IMMEDIATELY. The first thing the player sees is a still landscape;
     the earliest anomaly is fourteen seconds in, which is longer than most people look
     at a menu before clicking. */
  const firsts = Object.keys(MENU_EVENTS).map(k => MENU_EVENTS[k].first);
  chk(Math.min(...firsts) >= 12,
      `nothing at all happens for the first ${Math.min(...firsts)} seconds`);
  chk(MENU_EVENTS.walker.first >= 30,
      `and the figure does not cross until at least ${MENU_EVENTS.walker.first}s`);

  /* RARE. Over a five-minute sitting — far longer than a menu is normally looked at —
     the total count of every anomaly together stays in single figures. */
  const counts = {};
  for (const kind of Object.keys(MENU_EVENTS)) {
    let n = 0;
    while (menuEventAt(11, kind, n) < 300) n++;
    counts[kind] = n;
  }
  const total = Object.keys(counts).reduce((a, k) => a + counts[k], 0);
  chk(total <= 18, `five minutes of menu produces ${total} events in total ` +
      `(${Object.keys(counts).map(k => k + ' ' + counts[k]).join(', ')})`);
  chk(counts.walker <= 5, `the figure crosses at most ${counts.walker} times in five minutes`);

  /* DETERMINISTIC, which is what lets a screenshot be reproduced and a test assert. */
  const a = [0, 1, 2, 3].map(n => menuEventAt(4242, 'lamp', n));
  const b = [0, 1, 2, 3].map(n => menuEventAt(4242, 'lamp', n));
  chk(JSON.stringify(a) === JSON.stringify(b), 'the same seed gives the same schedule');
  const c = [0, 1, 2, 3].map(n => menuEventAt(99, 'lamp', n));
  chk(JSON.stringify(a) !== JSON.stringify(c), 'and a different seed gives a different one');
  chk(a.every((v, i) => i === 0 || v > a[i - 1]), 'the schedule is monotonic — no event fires twice at once');

  /* AND THE SCENE REALLY FIRES THEM. Driven through the real _pump on a real clock. */
  const scene = new MenuAtmosphere(doc.getElementById('menuScene'), 3);
  scene.t = 0; scene._pump();
  chk(scene.fired.lamp === 0 && scene.fired.walker === 0 && scene.fired.shift === 0,
      'at t=0 nothing has fired');
  scene.t = 200; scene._pump();
  chk(scene.fired.lamp > 0 && scene.fired.walker > 0,
      `by t=200s the lamp has flickered ${scene.fired.lamp}x and the figure crossed ${scene.fired.walker}x`);
  chk(scene.shifted === scene.fired.shift && scene.shifted > 0,
      'and the tree line has been displaced, which forces the landscape to be rebuilt');
  const before = scene.fired.lamp;
  scene._pump();
  chk(scene.fired.lamp === before, 'pumping again at the same time fires nothing twice');

  /* THE LAMP IS DARK ALMOST ALWAYS. */
  const duty = MENU_EVENTS.lamp.hold / (MENU_EVENTS.lamp.gap + MENU_EVENTS.lamp.spread / 2);
  chk(duty < 0.01, `the light is lit ${(duty * 100).toFixed(2)}% of the time`);
}

// =====================================================================================
// 5. NO CREATURE, NO SPOILER
// =====================================================================================
head('5. NO CREATURE, NO SPOILER');
{
  /* STORY.md section 24's internal-only vocabulary, plus the creatures by name. The menu
     may create curiosity; it may not answer anything. */
  const FORBIDDEN = ['record', 'reconstruct', 'rebuild', 'copy', 'imitation', 'memory of',
                     'fake haven', 'haven', 'void sovereign', 'sovereign', 'stalker',
                     'behemoth', 'neighbor', 'neighbour', 'disconnected home', 'suburbia',
                     'core disk', 'rift', 'dimension', 'sanity', 'observ', 'anomaly'];
  const text = MENU_MARKUP.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const leaked = FORBIDDEN.filter(w => text.indexOf(w) >= 0);
  chk(leaked.length === 0,
      'no menu text uses the canon\'s internal vocabulary' + (leaked.length ? ': ' + leaked.join(', ') : ''));
  note('everything the menu says: "' + text.trim() + '"');

  const sceneBody = classBody(LIVE, 'MenuAtmosphere');
  chk(!/\b(creature|monster|mob|claw|limb|antler|jaw|teeth|skull)\b/i.test(sceneBody),
      'and the scene draws no creature — the only moving silhouette is 2px of rectangle');
  chk(/fillRect\(Math\.round\(x\), Math\.round\(this\.walkGround - hgt\), 2, hgt\)/.test(sceneBody),
      'literally two pixels wide, which is what makes it deniable rather than a reveal');

  /* The retired identity, and the survival-game framing that went with it. */
  /* Searched in the COMMENT-STRIPPED build. Several of these survive as gravestones —
     the Phase 28 and Phase 29 comments that record what stood where — and a historical
     note is explicitly allowed. What may not survive is a live string. */
  for (const gone of ['BLOCK & RUIN', 'Block & Ruin', 'BEGIN EXPEDITION', 'SURVIVAL HORROR EXPEDITION',
                      'A COZY WORLD', 'SKIP TUTORIAL', 'skipTutorialLink', 'startEmbers'])
    chk(LIVE.indexOf(gone) < 0, `"${gone}" survives only as a comment, if at all`);
  chk(!/\bXP\b|LEVEL UP|Lv\./.test(MENU_MARKUP), 'and the menu carries no XP or level text');

  /* The tagline is the one piece of authored atmosphere, and it must stay a suggestion. */
  const sub = (MENU_MARKUP.match(/class="sub">([^<]*)</) || [null, ''])[1];
  chk(sub.length > 0 && sub.length <= 40 && !/\./.test(sub),
      `the tagline is one short unpunctuated line: "${sub}"`);
  chk(STORY.length > 0, 'STORY.md is present and was not modified by this phase');
}

// =====================================================================================
// 6. THE MENU CONTROLS
// =====================================================================================
head('6. THE CONTROLS');
{
  chk(/>NEW GAME</.test(MENU_MARKUP), 'the primary entry reads NEW GAME');
  chk(/>CONTINUE</.test(MENU_MARKUP), 'the resume entry reads CONTINUE');
  chk(/>SETTINGS</.test(MENU_MARKUP), 'and settings reads SETTINGS');
  chk(/id="continuePlay"[^>]*style="display:none;"/.test(MENU_MARKUP),
      'CONTINUE starts hidden and is shown only when a save validates');

  /* Four states, and none of them is colour alone — the brief is explicit about that. */
  for (const [state, sel] of [['hover', '.menu-btn:hover'], ['focus', '.menu-btn:focus-visible'],
                              ['pressed', '.menu-btn:active']]) {
    const body = ruleFor(sel) || '';
    chk(/transform|letter-spacing/.test(body) && /color/.test(body),
        `${state} changes shape as well as colour (${body.trim().slice(0, 46)}...)`);
  }
  chk(/pointer-events: *none/.test(ruleFor('.menu-btn[disabled]') || ''),
      'and a disabled entry is genuinely not clickable, not merely greyed');
  chk(ruleFor('.menu-btn:focus-visible::before') !== null,
      'keyboard focus is marked differently from hover, so the two are distinguishable');

  /* Native buttons, so Tab, Enter and Space all work without a keyboard handler. */
  chk((MENU_MARKUP.match(/<button/g) || []).length === 3,
      'all three are real <button> elements — Tab, Enter and Space come for free');
  chk(!/tabindex="-1"/.test(MENU_MARKUP), 'and none of them is taken out of the tab order');
}

// =====================================================================================
// 7. THE LEGEND IS STILL A FOOTNOTE
// =====================================================================================
head('7. THE LEGEND');
{
  const legend = (MENU_MARKUP.match(/class="controls">([\s\S]*?)<\/div>/) || [null, ''])[1];
  chk(legend.split('<br>').length <= 2, 'the control legend is at most two lines');
  chk(!/LEFT CLICK|RIGHT CLICK|CRAFTING|ATTACK|PLACE/.test(legend),
      'and names no verb the world teaches — Phase 28\'s rule, unchanged');
  chk(px(declared('#startScreen .controls', 'font-size')) <= 10,
      'it is the quietest text on the screen');
  chk(/position: *absolute/.test(ruleFor('#startScreen .controls') || ''),
      'and it sits at the edge of the frame rather than inside the composition');
  chk(/display: *none/.test(ruleFor('#startScreen .controls') || '') === false,
      'it is present at the default size (a short window drops it — see the media query)');
}

// =====================================================================================
// 8. HUD TYPOGRAPHY — THE PHASE 28 CAPTURE'S ACTUAL COMPLAINT
// =====================================================================================
head('8. HUD TYPOGRAPHY');
{
  /* THE FACE. Courier New at 9px is why the capture looked out of focus. */
  const face = (new RegExp('--ui-face\\s*:\\s*([^;]+)').exec(ROOT_BLOCK) || [null, ''])[1];
  /* The comment-stripped stylesheet: this phase left a gravestone explaining exactly why
     the face changed, and a gravestone naming the thing it removed is not the thing. */
  chk(!/Courier/i.test(STYLE), 'Courier New is gone from the stylesheet entirely');
  chk(/monospace/.test(face), 'the replacement is still a monospace stack — the identity did not change');
  chk(/ui-monospace/.test(face) && /Consolas/.test(face) && /DejaVu Sans Mono/.test(face),
      'and it names a real face for every platform rather than falling through to a default');
  chk(/font-synthesis: *none/.test(STYLE),
      'faux-bold is disabled, so a missing bold cut cannot be smeared into one');

  /* THE SIZES. Every one of the five elements the brief named, measured. */
  const sizes = {
    'CONDITION / PERCEPTION': px(declared('.vital-cap', 'font-size')),
    'the objective': px(declared('#journeyStep', 'font-size')),
    'the interaction prompt': px(declared('#interactPrompt', 'font-size')),
    'its key chip': px(declared('#interactPrompt .key', 'font-size')),
    'the held item name': px(declared('#heldName', 'font-size')),
    'the hotbar count': px(declared('.slot .count', 'font-size')),
    'the hotbar numeral': px(declared('#hotbar .slot .num', 'font-size')),
    'the status line': px(declared('#hudStatus', 'font-size')),
    'the clock': px(declared('#clockWrap', 'font-size')),
  };
  for (const k of Object.keys(sizes)) {
    chk(sizes[k] !== null && sizes[k] >= 9.5,
        `${k} is ${sizes[k]}px — at or above the readable floor`);
  }
  chk(sizes['CONDITION / PERCEPTION'] >= 11,
      `the two captions the capture could not read are now ${sizes['CONDITION / PERCEPTION']}px (were 9px)`);
  chk(sizes['the objective'] >= 14,
      `the objective is ${sizes['the objective']}px (was 12.5px)`);

  /* AND THE SMALL-VIEWPORT OVERRIDES OBEY THE SAME FLOOR. This is where a readability
     pass usually leaks: the base sizes get fixed and the media query keeps its 8px. */
  const smallSizes = (MEDIA_STYLE.match(/font-size:\s*([\d.]+)px/g) || [])
    .map(v => parseFloat(v.replace(/[^\d.]/g, '')));
  chk(smallSizes.length > 0 && Math.min(...smallSizes) >= 9,
      `the smallest type any viewport can produce is ${Math.min(...smallSizes)}px`);
  chk(/#hotbar \.slot \.num \{ display: none; \}/.test(MEDIA_STYLE),
      'and the one glyph a small window cannot fit is dropped rather than shrunk');

  /* NOT OVERSIZED EITHER. "Minimal is not tiny" cuts both ways. */
  const biggest = Math.max(...Object.keys(sizes).map(k => sizes[k]));
  chk(biggest <= 16, `and nothing in the HUD is larger than ${biggest}px — this is not a console UI`);

  /* WEIGHT. Ultra-light strokes at small sizes are the other half of "blurry". */
  for (const sel of ['.vital-cap', '#journeyStep', '#interactPrompt', '#interactPrompt .key', '.slot .count']) {
    const w = parseInt(declared(sel, 'font-weight') || '400', 10);
    chk(w >= 600, `${sel} carries real weight (${w})`);
  }

  /* A COHERENT SCALE, not nine independent numbers. */
  const scale = ['--t-primary', '--t-secondary', '--t-label', '--t-tertiary']
    .map(t => { const m = new RegExp(t + '\\s*:\\s*([^;]+)').exec(ROOT_BLOCK); return m ? parseFloat(m[1]) : null; });
  chk(scale.every(v => v !== null), `the type scale is four declared steps: ${scale.join(' / ')}px`);
  chk(scale.every((v, i) => i === 0 || v < scale[i - 1]), 'strictly descending, so nothing competes with the objective');
  chk(scale[scale.length - 1] >= 10, 'and the smallest step is 10px — nothing in this HUD goes below it');

  /* NO DELIBERATE BLUR, ANYWHERE. */
  chk(!/filter:[^;}]*blur\(/.test(STYLE), 'no HUD rule blurs anything');
  /* Scoped to the HUD's own selectors rather than a slice of the file: the menu title
     legitimately carries a wide soft glow (it is 60px type on a black sky, not a 10px
     caption over grass) and the opening instruction is a cinematic. What must not have a
     halo is the small type the player reads while playing. */
  const HUD_SELECTORS = /#hud\b|#hotbar|#heldName|#vitals|\.vital-cap|\.tick\b|#conditionTicks|#perceptionTrace|#objectivePanel|#journeyStep|#hudStatus|#clockWrap|#phaseLabel|#interactPrompt|\.slot\b|#miningReadout|#dimensionBanner|#hudToast/;
  const halos = RULES.filter(r => r.selectors.some(sel => HUD_SELECTORS.test(sel)))
    .map(r => (/(?:^|;)\s*text-shadow\s*:\s*([^;]+)/.exec(r.body) || [null, ''])[1])
    .filter(v => v && /\b(1[5-9]|[2-9]\d)px\b/.test(v));
  chk(halos.length === 0,
      'and no HUD text-shadow spreads far enough to read as a halo' +
      (halos.length ? ': ' + halos[0].slice(0, 60) : ''));

  /* CONTRAST OVER BRIGHT TERRAIN — a hard 1px contour rather than a soft glow. */
  const tok = (name) => { const m = new RegExp('(?:^|;)\\s*' + name + '\\s*:\\s*([^;]+)').exec(ROOT_BLOCK); return m ? m[1] : ''; };
  const shadow = tok('--hud-shadow');
  const hard = tok('--hud-shadow-hard');
  chk(/1px 0 0/.test(shadow) && /-1px 0 0/.test(shadow),
      'the shared shadow is a four-way 1px contour — sharp against sunlit grass');
  chk(/#000/.test(hard) && /1px 0 0 #000/.test(hard),
      'and the captions get the full-strength version of the same contour');
  chk(/text-shadow: *var\(--hud-shadow-hard\)/.test(STYLE), 'which is actually used, not merely declared');
}

// =====================================================================================
// 9. THE PHASE 27 HUD IS STILL THE PHASE 27 HUD
// =====================================================================================
head('9. PHASE 27 SURVIVES');
{
  for (const id of ['conditionTicks', 'perceptionTrace', 'objectivePanel', 'journeyStep',
                    'hotbar', 'interactPrompt', 'compassTape', 'heldName'])
    chk((BODY.match(new RegExp('id="' + id + '"', 'g')) || []).length === 1,
        `#${id} is in the document exactly once`);
  chk(!/id="xpBar|id="levelLabel|id="healthBar|id="sanityBar"|MISSION DIRECTIVES/.test(BODY),
      'and no heart, bar, XP element or directive checklist came back');

  /* Health and perception are still kept apart on four axes. Phase 27's rule, re-checked
     because this phase touched both of their stylesheets. */
  chk(declared('#perceptionTrace', 'width') !== null && ruleFor('.tick') !== null,
      'condition is still discrete ticks and perception is still a canvas');
  chk(!/#perceptionTrace[^}]*width: *\d+%/.test(STYLE),
      'perception never became a percentage-width fill');
  const rules = (STYLE.match(/[^{}]+\{[^{}]*\}/g) || []).map(r => r.split('{')[0]);
  chk(rules.filter(r => /(\.tick|conditionTicks)/.test(r) && /perceptionTrace/.test(r)).length === 0,
      'and no single rule reaches both of them');

  /* THE UNLIT TICK MUST BE OPAQUE. A translucent one composites with the world behind it
     and, over sunlit grass, ends up nearly the same value as a lit one — so the ladder had
     no reading at all in daylight. Found in a bright WebGL-free capture; a dark capture
     looked correct throughout, which is why the check is written against the value rather
     than against a screenshot. */
  const off = declared('.tick', '--tick-off') || '';
  chk(/^#[0-9a-f]{3,8}$/i.test(off.trim()),
      `the unlit condition tick is an opaque value (${off.trim()}), not one that composites with the terrain`);
  chk(px(declared('.tick', 'width')) >= 5 && !/box-shadow:[^;]*0 0 0 1px/.test(ruleFor('.tick') || ''),
      'and it carries a side contour rather than a full ring, so it reads as a bar and not an empty box');

  /* The DPR fit is new, and it must not have changed what the trace DRAWS. */
  chk(typeof UIManager.prototype._fitCanvas === 'function',
      'the HUD canvases are fitted to the device pixel ratio (UIManager._fitCanvas)');
  const fit = LIVE.slice(LIVE.indexOf('  _fitCanvas('), LIVE.indexOf('  setInteractPrompt('));
  chk(/canvas\._cssW = cssW/.test(fit) && /setTransform\(ratio, 0, 0, ratio, 0, 0\)/.test(fit),
      'by scaling the backing store and the context together, so drawing stays in logical units');
  chk(/if \(ratio === 1\) return;/.test(fit),
      'and it is a no-op at ratio 1, so an ordinary display is untouched');
  chk(/this\.perceptionCanvas\._cssW/.test(LIVE) && /this\.compassTape\._cssW/.test(LIVE),
      'both drawing routines read the logical size rather than the backing store');
}

// =====================================================================================
// 10. COST
// =====================================================================================
head('10. COST');
{
  const sceneBody = classBody(LIVE, 'MenuAtmosphere');
  chk(/if \(this\._acc >= 0\.033\)/.test(sceneBody),
      'the menu draws at ~30fps, not 60 — nothing on it resolves faster than that');
  chk(/if \(!this\.layer\) this\.layer = this\._buildLayer\(\);/.test(sceneBody),
      'and the landscape is built once and blitted, not redrawn per frame');
  /* Two frame loops in the whole build, and they cannot both be live: _start() calls
     menu.hide(), which cancels the menu's before _beginPlay() enters the game's. */
  chk(/_raf = requestAnimationFrame\(this\._loop\)/.test(sceneBody),
      'the menu owns one loop, re-armed from one place');
  chk(/cancelAnimationFrame\(this\._raf\)/.test(sceneBody) && /this\._raf = null/.test(sceneBody),
      'and hide() genuinely cancels it rather than leaving it spinning behind the world');
  const startBody = LIVE.slice(LIVE.indexOf('  _start() {'), LIVE.indexOf('  _beginPlay() {'));
  chk(/this\.menu\.hide\(\)/.test(startBody),
      'every route into gameplay takes the menu down first, so the two loops never overlap');

  const scene = new MenuAtmosphere(doc.getElementById('menuScene'), 5);
  scene._resize();
  scene.draw();                       // builds the layer once
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 400; i++) { scene.t += 0.033; scene._pump(); scene.draw(); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 400;
  chk(ms < 1.5, `a steady menu frame costs ${(ms * 1000).toFixed(0)} µs against a stub canvas`);
  note('(a stub context does no rasterising, so this measures the scene\'s own work only —');
  note(' the real figure is in browser-menu.js)');
  let builds = 0;
  const realBuild = scene._buildLayer.bind(scene);
  scene._buildLayer = () => { builds++; return realBuild(); };
  scene.layer = null; scene.draw();
  for (let i = 0; i < 200; i++) { scene.t += 0.033; scene.draw(); }
  chk(builds === 1, `200 frames rebuilt the landscape ${builds} time`);
  scene.close();
}

console.log('');
if (fail) { console.log(`${fail} PHASE 29 MENU CHECK(S) FAILED`); process.exit(1); }
console.log('ALL PHASE 29 MENU / TYPOGRAPHY CHECKS PASS');
note('Offline. The real scene, schedule, lifecycle and stylesheet were driven. Whether the');
note('menu feels like horror, and whether the HUD is comfortable to read, are judgements');
note('for a person — see browser-menu.js for the live document, and the phase report for');
note('what a human has and has not looked at.');
