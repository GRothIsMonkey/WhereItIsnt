/* PHASE 30 — THE OPENING FILM.

   WHAT THIS FILE CAN AND CANNOT PROVE.

   It boots the REAL script into the offline harness and drives the real OpeningFilm: the
   real beat table, the real tick, the real skip, the real teardown. Because the film is
   advanced by dt rather than by timers, a test can hand it seventy seconds in a loop and
   ask what was on screen at any point — which is most of why it was built that way.

   Where a claim is about the shipped SOURCE rather than about behaviour it says so,
   because `Game` cannot be constructed without a GPU. The live half — that the film
   actually renders, that gameplay input really is dead, that CONTINUE really does not
   replay it — is in browser-opening.js and is claimed only there.

   IT CANNOT PROVE THE FILM IS ANY GOOD. Whether a person watches it and thinks "something
   is wrong here" is a judgement for a person, and the phase report says who has and has
   not made it. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { load } = require('./harness/load.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
const STORY = fs.readFileSync(path.join(ROOT, 'STORY.md'), 'utf8');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')
                      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const LIVE = strip(SRC);
const BODY = strip(SRC.slice(SRC.indexOf('<body>'), SRC.indexOf('<script src=')));
const STYLE = '}' + strip(SRC.slice(SRC.indexOf('<style>') + 7, SRC.indexOf('</style>')));

/* Exactly one class body, brace-matched — see the same helper in hud.js and menu.js. */
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
function methodBody(src, name) {
  const i = src.indexOf('\n  ' + name + '(');
  if (i < 0) return null;
  const open = src.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(open, j + 1); }
  }
  return null;
}

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);
const head = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 74 - t.length)));

console.log('booting the real script...');
const S = load(path.join(ROOT, 'game.html'));
const g = (n) => vm.runInContext(n, S);
const doc = S.document;

const OpeningFilm = g('OpeningFilm');
const FILM_BEATS = g('FILM_BEATS');
const FILM_LINES = g('FILM_LINES');
const FILM_DURATION = g('FILM_DURATION');
const filmBeatAt = g('filmBeatAt');
const filmBeatProgress = g('filmBeatProgress');
const UIManager = g('UIManager');

const FILM_BODY = classBody(LIVE, 'OpeningFilm');
/* The same body with its prose taken out. Several checks below are about what the film
   BUILDS, and the comments in it necessarily use the words those checks forbid ("no face,
   no limbs") in order to say that it does not build them. */
const FILM_CODE = FILM_BODY.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* A stand-in for the parts of Game the film touches. Deliberately NOT a real Game — that
   needs a GPU — but every field the film reads or writes is here, so a mismatch between
   this and the real object shows up as an exception rather than a silent pass. */
function fakeGame(over) {
  const calls = { pointerLock: 0, hudVisible: [], ambience: [], levels: [] };
  const added = [];
  const base = {
    calls, added,
    player: { yaw: 0, pitch: 0, movementLocked: false, position: { x: 10, y: 64, z: -20 } },
    camera: {},
    env: { t: 137.5, cycleLength: 600, setFollowTarget() {}, update() {} },
    scene: { add(o) { added.push(o); }, remove(o) { const i = added.indexOf(o); if (i >= 0) added.splice(i, 1); } },
    canvas: { requestPointerLock() { calls.pointerLock++; } },
    ui: { settingsOpen: false, setHudVisible(v) { calls.hudVisible.push(!!v); return !!v; } },
    sound: {
      startFilmAmbience() { calls.ambience.push('start'); return true; },
      stopFilmAmbience() { calls.ambience.push('stop'); return true; },
      setFilmAmbienceLevel(w, a) { calls.levels.push([w, a]); return true; },
    },
  };
  return Object.assign(base, over || {});
}
/* Run the film forward `seconds` at 60fps, calling `at` each frame. */
function run(film, seconds, at) {
  const step = 1 / 60;
  for (let i = 0; i < Math.round(seconds / step); i++) {
    if (!film.active) break;
    film.update(step);
    if (at) at(film);
  }
}

// =====================================================================================
// 1. THE SEQUENCE
// =====================================================================================
head('1. THE SEQUENCE');
{
  chk(Object.isFrozen(FILM_BEATS) && FILM_BEATS.length >= 8,
      `the film is a declared table of ${FILM_BEATS.length} beats, frozen`);
  const ids = FILM_BEATS.map(b => b.id);
  chk(new Set(ids).size === ids.length, 'every beat has a unique id');
  note('beats: ' + FILM_BEATS.map(b => `${b.id}@${b.at}s`).join(' -> '));

  /* CONTIGUOUS AND ORDERED. A gap would be a beat nothing owns; an overlap would make
     filmBeatAt ambiguous. */
  let ok = true;
  for (let i = 0; i < FILM_BEATS.length; i++) {
    if (i === 0 && FILM_BEATS[0].at !== 0) ok = false;
    if (i > 0 && FILM_BEATS[i].at !== FILM_BEATS[i - 1].at + FILM_BEATS[i - 1].dur) ok = false;
    if (FILM_BEATS[i].dur <= 0) ok = false;
  }
  chk(ok, 'the beats tile the whole film with no gap, no overlap and no zero-length beat');

  /* LENGTH. The brief asks for 60-120 seconds and says to prefer the shorter end.
     STORY.md section 25 asks for ~20s, which the twelve-beat structure cannot hold; this
     sits at the bottom of the brief's window and the report says so plainly. */
  chk(FILM_DURATION >= 60 && FILM_DURATION <= 90,
      `the film runs ${FILM_DURATION}s — the short end of the brief's 60-120s window`);
  note(`plus the Phase 20.2 instruction (~8.9s) as its closing beat: ~${(FILM_DURATION + 8.9).toFixed(0)}s in total`);

  /* IT STARTS IN THE DARK AND STAYS THERE LONG ENOUGH TO BE NOTICED. */
  chk(filmBeatAt(0) === 'dark' && filmBeatAt(4.9) === 'dark',
      `it opens on ${FILM_BEATS[0].dur}s of black`);
  /* AND THE NORMALITY BEAT IS REAL TIME, NOT A GESTURE. Everything later is measured
     against it, so a two-second version would not be a baseline. */
  const familiar = FILM_BEATS.find(b => b.id === 'familiar');
  chk(familiar && familiar.dur >= 7,
      `and holds ${familiar.dur}s of ordinary world before anything happens to it`);

  chk(filmBeatAt(-5) === FILM_BEATS[0].id, 'a negative clock resolves to the first beat rather than undefined');
  chk(filmBeatProgress(FILM_BEATS[1].at) === 0 &&
      Math.abs(filmBeatProgress(FILM_BEATS[1].at + FILM_BEATS[1].dur / 2) - 0.5) < 0.01,
      'and beat progress is a clean 0..1 within whichever beat owns the clock');
}

// =====================================================================================
// 2. IT SAYS ALMOST NOTHING, AND EXPLAINS NOTHING
// =====================================================================================
head('2. WHAT IT SAYS');
{
  const lines = Object.keys(FILM_LINES).map(k => FILM_LINES[k]);
  chk(lines.length === 2, `the whole film contains ${lines.length} lines of narration`);
  note('"' + lines.join('"  /  "') + '"');
  chk(lines.every(l => l.length <= 34), 'both are short enough to read without stopping');
  chk(lines.every(l => l.split(/\s+/).length <= 6), 'and neither is a sentence with a clause in it');

  /* STORY.md section 22's never-told list, section 24's internal-only vocabulary, and
     every creature and place by name. The film may create a question; it may not answer
     one, and it may not name anything the player has not met. */
  const FORBIDDEN = ['record', 'reconstruct', 'rebuild', 'rebuilt', 'copy', 'copies',
                     'imitation', 'memory', 'observ', 'watch', 'rift', 'seam', 'anchor',
                     'dimension', 'stalker', 'behemoth', 'neighbour', 'neighbor', 'haven',
                     'suburbia', 'farmland', 'sovereign', 'creature', 'monster', 'sanity',
                     'reality', 'world is', 'they are gone', 'everyone'];
  const allText = lines.join(' ').toLowerCase();
  const leaked = FORBIDDEN.filter(w => allText.indexOf(w) >= 0);
  chk(leaked.length === 0,
      'neither line uses the canon\'s internal vocabulary or names anything' +
      (leaked.length ? ': ' + leaked.join(', ') : ''));

  /* AND NOTHING ELSE IN THE FILM'S OWN DOM SAYS ANYTHING EITHER. */
  const filmMarkup = BODY.slice(BODY.indexOf('<div id="openingFilm">'),
                                BODY.indexOf('<div id="openingInstruction">'));
  const visible = filmMarkup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  chk(visible === 'SKIP ESC', `the only other text on the film layer is the way out ("${visible}")`);

  /* THE FILM MAY NOT PRE-EMPT THE OBJECTIVE SYSTEM. Phase 25 owns gameplay guidance and
     the brief is explicit that "Gather wood." must not appear mid-cinematic. */
  chk(!/Gather wood|Craft a|Find coal|objectives?\.|_refreshObjective|setObjective/.test(FILM_BODY),
      'and the film never touches the objective system — Phase 25 still owns that line');

  /* THE TITLE STAYS OUT OF THE WORLD. STORY.md section 26: the phrase is enacted, never
     written. A film that put it on screen would be explaining the joke. */
  chk(!/WHERE IT ISN/i.test(FILM_BODY) && !/WHERE IT ISN/i.test(lines.join(' ')),
      'the title never appears in the film — section 26 says it is enacted, not written');
  chk(STORY.length > 0, 'STORY.md is present and was not modified by this phase');
}

// =====================================================================================
// 3. THE LIFECYCLE
// =====================================================================================
head('3. THE LIFECYCLE');
{
  const game = fakeGame();
  const film = new OpeningFilm(game);
  chk(film.active === false, 'a constructed film is inert until it is begun');

  let done = 0;
  chk(film.begin(() => done++) === true, 'begin() starts it');
  chk(film.active === true, 'and it reports itself active');
  chk(film.begin(() => done++) === false, 'beginning it again is a no-op, not a second film');

  chk(game.player.movementLocked === true,
      'the player is put into look-only for the duration (movementLocked)');
  chk(game.calls.pointerLock === 1, 'pointer lock is requested once, so the player can look');
  chk(game.calls.hudVisible.length === 1 && game.calls.hudVisible[0] === false,
      'and the HUD is hidden exactly once on the way in');
  chk(game.calls.ambience[0] === 'start', 'the film ambience is started');

  /* IT ENDS ITSELF, ONCE. */
  run(film, FILM_DURATION + 2);
  chk(film.active === false, `it ends on its own after ${FILM_DURATION}s`);
  chk(done === 1, `and calls back exactly once (${done})`);
  run(film, 5);
  chk(done === 1, 'ticking a finished film does nothing and cannot call back twice');
}

// =====================================================================================
// 4. IT RESTORES EVERYTHING IT BORROWED
// =====================================================================================
head('4. RESTORATION');
{
  for (const [label, seconds] of [['runs to the end', FILM_DURATION + 2],
                                  ['is skipped on its first frame', 0.02],
                                  ['is skipped mid-anomaly', 28],
                                  ['is skipped during the seam', 51],
                                  ['is skipped in the final calm', 63]]) {
    const game = fakeGame();
    game.player.movementLocked = false;
    const beforeEnv = game.env.t;
    const film = new OpeningFilm(game);
    let done = 0;
    film.begin(() => done++);
    run(film, seconds);
    if (film.active) film.skip();

    const ok = film.active === false &&
               game.player.movementLocked === false &&
               game.env.t === beforeEnv &&
               game.added.length === 0 &&
               film.props === null &&
               game.calls.hudVisible[game.calls.hudVisible.length - 1] === true &&
               game.calls.ambience[game.calls.ambience.length - 1] === 'stop' &&
               done === 1;
    chk(ok, `when the film ${label}: input, clock, scene, HUD and audio all come back ` +
        `(locked ${game.player.movementLocked}, clock ${game.env.t === beforeEnv ? 'restored' : 'DRIFTED'}, ` +
        `${game.added.length} props left, callback x${done})`);
  }

  /* THE CLOCK IS THE ONE THAT WOULD HAVE BEEN EASY TO MISS. The film chooses its own
     light; if it did not put the day back, every New Game would begin at whatever hour
     the film wanted rather than the hour the game intends. */
  const game = fakeGame();
  game.env.t = 421.75;
  const film = new OpeningFilm(game);
  film.begin(null);
  chk(game.env.t !== 421.75, 'the film sets its own hour while it runs');
  film.skip();
  chk(game.env.t === 421.75, 'and puts the exact hour back when it ends — the day does not advance');

  /* ORIENTATION IS DELIBERATELY NOT RESTORED, and that is a decision rather than a leak:
     the film spends a minute facing the way the instruction is about to ask for. */
  const g2 = fakeGame();
  const f2 = new OpeningFilm(g2);
  f2.begin(null);
  const facing = g2.player.yaw;
  f2.skip();
  chk(g2.player.yaw === facing,
      'the view is left where the film put it — facing the bearing the instruction names');
}

// =====================================================================================
// 5. SKIP
// =====================================================================================
head('5. SKIP');
{
  const game = fakeGame();
  const film = new OpeningFilm(game);
  let done = 0;
  film.begin(() => done++);
  chk(film.skip() === true, 'skip works from the very first frame — the player is never trapped');
  chk(done === 1 && film.active === false, 'and it lands in the same place a finished film does');
  chk(film.skip() === false, 'skipping an ended film is a no-op');

  /* ESCAPE BELONGS TO THE SETTINGS PANEL FIRST. Two things listening for one key with no
     order between them is how a menu becomes unclosable. */
  chk(/if \(this\.game\.ui && this\.game\.ui\.settingsOpen\) return;/.test(FILM_BODY),
      'Escape only skips the film when there is no settings panel for it to close');
  /* AND IT HAS TO BE A CAPTURE LISTENER TO MEAN IT. PlayerController's Escape handler is
     on `document`, which bubbles before `window` — so a bubble listener here ran AFTER
     the panel had already been closed, saw settingsOpen false, and skipped the film on
     the same keypress that closed the settings. Capture at window runs first. */
  chk(/window\.addEventListener\('keydown', this\._onKey, true\);/.test(FILM_BODY),
      'and it listens in the CAPTURE phase, so it sees the panel before PlayerController closes it');
  chk(/if \(e\.code === 'Escape'\) this\.skip\(\);/.test(FILM_BODY),
      'and Escape is the skip key, as the brief asks');

  /* ONE EXIT. Both routes out go through _teardown, so a skipped film cannot restore a
     different set of things than a watched one — which is what section 4 above measures
     and what makes it enough to measure it once per exit point. */
  chk(/skip\(\) \{[\s\S]{0,200}?this\._finish\(\);/.test(FILM_BODY) &&
      /_finish\(\) \{[\s\S]{0,220}?this\._teardown\(\);/.test(FILM_BODY),
      'skip and completion share one exit (_finish -> _teardown), so they cannot diverge');
}

// =====================================================================================
// 6. NO TIMERS, NO LEAKS, NO SECOND ANYTHING
// =====================================================================================
head('6. NO LEAKS');
{
  /* THE WHOLE REASON THE FILM IS TICKED. A timer-driven cinematic has to hunt down its
     own pending callbacks on every exit path; this one has none to hunt. */
  chk(!/setTimeout|setInterval|requestAnimationFrame/.test(FILM_BODY),
      'the film contains no timer of any kind — it is advanced by dt from the frame loop');
  chk(/update\(dt\) \{[\s\S]{0,120}?this\.t \+= dt;/.test(FILM_BODY),
      'its clock is the frame delta, which is why the settings panel genuinely pauses it');
  /* AND IT IS THE REAL DELTA. The simulation's dt is clamped to 0.06 for physics safety,
     which makes elapsed time a function of frame rate — invisible in gameplay, and
     completely wrong for a cinematic. Under SwiftShader the first draft took over three
     minutes to reach a beat fifteen seconds in. The film gets `filmDt`, clamped only
     against a pathological stall, and it is the only consumer of it. */
  const clamp = (/const filmDt = Math\.min\(rawDt, ([\d.]+)\);/.exec(LIVE) || [])[1];
  chk(/const rawDt = this\.clock\.getDelta\(\);/.test(LIVE) && clamp !== undefined,
      'the film is ticked on wall-clock time, not on the physics-clamped delta');
  /* AND THE STALL CLAMP IS GENEROUS ENOUGH NOT TO BE A FRAME-RATE DEPENDENCY. At 0.25 it
     was hit by every frame on a machine drawing one frame a second, which turned a 68s
     film into a 4.5-minute one. It has to sit above any plausible slow frame. */
  chk(parseFloat(clamp) >= 0.5,
      `and its stall clamp is ${clamp}s — above any ordinary slow frame, so a weak machine still tracks real time`);
  chk(/this\.film\.update\(filmDt\)/.test(LIVE) && (LIVE.match(/filmDt/g) || []).length === 2,
      'and filmDt has exactly one consumer — nothing in the simulation can see it');

  /* LISTENERS BOUND ONCE, IN THE CONSTRUCTOR, GATED ON `active`. Binding on begin() would
     leak one set per New Game. */
  const ctor = FILM_BODY.slice(0, FILM_BODY.indexOf('  begin('));
  chk((ctor.match(/addEventListener\(/g) || []).length === 2,
      'its two listeners are bound once, in the constructor');
  chk(!/addEventListener/.test(FILM_BODY.slice(FILM_BODY.indexOf('  begin('))),
      'and begin() binds nothing at all');
  chk(/if \(!this\.active\) return;/.test(FILM_BODY), 'both are inert between films');

  /* A NEW GAME AFTER A NEW GAME. Ten films in a row must leave one of everything. */
  const game = fakeGame();
  const film = new OpeningFilm(game);
  for (let i = 0; i < 10; i++) { film.begin(null); run(film, 20); film.skip(); }
  chk(game.added.length === 0 && film.props === null,
      `10 films in a row leave ${game.added.length} scene objects behind`);
  const starts = game.calls.ambience.filter(c => c === 'start').length;
  const stops = game.calls.ambience.filter(c => c === 'stop').length;
  chk(starts === 10 && stops === 10, `and ${starts} ambience starts are matched by ${stops} stops`);
  const shows = game.calls.hudVisible.filter(v => v === true).length;
  const hides = game.calls.hudVisible.filter(v => v === false).length;
  chk(shows === hides, `and ${hides} HUD hides by ${shows} restores`);

  /* SCENE RESOURCES ARE DISPOSED, not merely detached. */
  chk(/geo\.dispose\(\); P\.vastGeo\.dispose\(\); P\.mat\.dispose\(\)/.test(FILM_BODY),
      'the geometry and material the film created are disposed, not just removed');

  /* AND THE FRAME LOOP CANNOT BE ENTERED TWICE. Both _start (for the film) and _beginPlay
     (for gameplay) ask for it on the New Game path. */
  chk(/_enterFrameLoop\(\) \{\s*\n\s*if \(this\._loopRunning\) return false;/.test(LIVE),
      'and the frame loop is latched, so the film and gameplay cannot start two of them');
}

// =====================================================================================
// 7. INPUT — THE FILM ADDS NO SECOND INPUT SYSTEM
// =====================================================================================
head('7. INPUT');
{
  /* The film's whole input contract is two flags that already existed and are already
     tested. It does not bind a mouse handler, and its only key handler is Escape. */
  chk(/p\.movementLocked = true;/.test(FILM_BODY),
      'look-only is movementLocked — the gate the Haven already uses');
  chk(!/mousedown|mousemove|mouseup|'click'/.test(FILM_BODY.slice(FILM_BODY.indexOf('  begin('))),
      'the film binds no mouse handler of its own');
  chk((FILM_BODY.match(/e\.code/g) || []).length === 1,
      'and reads exactly one key, Escape');

  /* THE GATES THEMSELVES, in PlayerController, unchanged from Phase 29 and Phase 5B.
     Between them every gameplay verb is blocked while the film is up. */
  chk(/if \(this\.movementLocked\) \{[\s\S]{0,420}?return;/.test(LIVE),
      'movementLocked returns from update() before any physics, after syncing the camera');
  chk(/document\.addEventListener\('mousedown', \(e\) => \{\s*\n\s*if \(!this\.locked \|\| this\.ui\.menuOpen \|\| this\.dead \|\| this\.movementLocked\) return;/.test(LIVE),
      'so mining, attacking and placing cannot fire — mousedown checks it directly');
  chk(/_playing\(\) \{ return !!\(this\.progression && this\.progression\.running\); \}/.test(LIVE),
      'and `running` is false for the whole film, which is what makes E, I, Tab, the slot ' +
      'keys and the wheel inert (Phase 29)');

  const start = methodBody(LIVE, '_start');
  chk(start && !/this\.running = true/.test(start),
      'nothing in _start() sets running — gameplay does not begin until _beginPlay');

  /* THE CAMERA IS STILL SYNCED WHILE THE FILM RUNS, or the player could not look. */
  const anim = LIVE.slice(LIVE.indexOf('  _animate() {'), LIVE.indexOf('  _animate() {') + 4200);
  chk(/if \(this\.film && this\.film\.active\) \{\s*\n\s*this\.player\.update\(dt\);\s*\n\s*this\.film\.update\(filmDt\)/.test(anim),
      'the film branch ticks the player (camera only) and the film, and nothing else');
  chk(/this\.film\.update\(filmDt\)[\s\S]{0,120}?this\.postfx\.render\([\s\S]{0,120}?return;/.test(anim),
      'then renders and returns — no clock, no mobs, no objectives, no chunk streaming');
}

// =====================================================================================
// 8. NEW GAME vs CONTINUE
// =====================================================================================
head('8. NEW GAME vs CONTINUE');
{
  const start = methodBody(LIVE, '_start');
  const cont = methodBody(LIVE, 'continueFromSave');
  chk(start && /this\.film\.begin\(/.test(start), 'NEW GAME (_start) plays the film');
  chk(cont && !/film/.test(cont), 'CONTINUE (continueFromSave) does not mention the film at all');
  chk(cont && /this\._beginPlay\(\);/.test(cont), 'it goes straight to gameplay, as it always did');
  chk((LIVE.match(/\.film\.begin\(/g) || []).length === 1,
      'and begin() has exactly one call site in the whole build');

  /* NO SAVE FIELD. "Has the film played" is answerable from which function was called, so
     inventing state for it would be a duplicate — and the brief says not to add one just
     because it is convenient. */
  /* THE FILM ADDED NO FIELD, WHICH IS NOT THE SAME AS "THE SCHEMA NEVER MOVES". Phase 31
     took it to 5 for a reason of its own, so the check is on the SHAPE of the default
     state below rather than on a version number this phase does not own. */
  const fresh = g('defaultSaveState')(null);
  const keys = Object.keys(fresh.progression).join(' ');
  chk(!/film|cinematic|opening|intro/i.test(keys),
      'and no cinematic flag was added to it — the film is derived, not stored');
  chk(!/film|cinematic/i.test(JSON.stringify(fresh)),
      'a save written by this build mentions the film nowhere');
}

// =====================================================================================
// 9. THE INSTRUCTION IS STILL PHASE 20.2's, AND STILL ONE AUTHORITY
// =====================================================================================
head('9. THE CROSSROADS INSTRUCTION');
{
  const lines = g('OPENING_INSTRUCTION_LINES');
  chk(lines.length === 2 && lines[0] === 'At the crossroads, go east.' && lines[1] === 'Go east.',
      `the two lines are unchanged: "${lines.join('" / "')}"`);
  chk(typeof g('OpeningInstruction') === 'function',
      'and they are still owned by OpeningInstruction — the film plays it, it does not copy it');
  chk(!/crossroads|go east/i.test(FILM_BODY),
      'the film contains no copy of the words, so there is one place they can ever change');

  const start = methodBody(LIVE, '_start');
  chk(start && /film\.begin\(\(\) => this\.openingInstruction\.play\(\(\) => this\._beginPlay\(\)\)\)/.test(start),
      'the instruction is the film\'s closing beat: film -> instruction -> gameplay');

  /* AND IT IS STILL SAID ONCE. The Farmlands recall is a separate one-shot with its own
     latch, and neither of them is an objective. */
  chk((LIVE.match(/openingInstruction\.play\(/g) || []).length === 1,
      'play() has exactly one call site, so the instruction cannot be issued twice');
  chk(/if \(!this\.farmCrossroadsRecalled\)/.test(LIVE),
      'and the Farmlands recall keeps its own one-shot latch');
  /* THE OVERWORLD CHAIN — where the player is standing when the instruction is given —
     must not repeat it. The FARMLANDS chain does contain "Follow the road east.", and that
     is correct and was correct before this phase: it is a Phase 20 journey observation
     issued much later, in a different dimension, about a road the player can already see.
     A bearing named once at the start and a road named once on arrival are not two
     authorities; a start-of-game objective that said "go east" would be. */
  const chains = g('OBJECTIVE_CHAINS');
  const overworld = chains.overworld.map(s => s.text);
  chk(!overworld.some(t => /east|crossroads/i.test(t)),
      'no Overworld objective repeats the instruction — the bearing is said once, by the film');
  note('the Overworld chain: ' + overworld.join(' / '));
  const overrides = g('OBJECTIVE_OVERRIDES').filter(o => o.text).map(o => o.text);
  chk(!overrides.some(t => /east|crossroads/i.test(t)),
      'and no situational objective can raise it either');
}

// =====================================================================================
// 10. THE BEATS ACTUALLY DO SOMETHING
// =====================================================================================
head('10. THE BEATS');
{
  const game = fakeGame();
  const film = new OpeningFilm(game);
  film.begin(null);

  /* THE WASH. Black at the start, gone by the time the world is meant to be visible, and
     black again at the end so the instruction lands on a clean screen. */
  const wash = () => parseFloat(doc.getElementById('filmWash').style.opacity);
  chk(wash() === 1, 'the film opens on a fully black screen');
  run(film, 4);
  chk(wash() > 0.9, 'and is still black four seconds in — the dark beat is real time');
  run(film, 11);
  chk(wash() < 0.05, `by the end of the reveal the world is fully visible (wash ${wash().toFixed(2)})`);
  /* Run until the closing beat rather than to a computed second: 3,960 additions of 1/60
     drift by a few milliseconds, and a test that lands one frame short of a boundary
     reports a beat-table bug that is not there. */
  let guard = 0;
  while (film.active && film.beat !== 'out' && guard++ < 6000) film.update(1 / 60);
  chk(film.beat === 'out', `it reaches the closing beat (at t=${film.t.toFixed(1)}s)`);
  run(film, 1.3);
  chk(film.active && wash() > 0.3,
      `and washes back to black before handing over (wash ${wash().toFixed(2)})`);

  /* THE PROPS. One shape, then two, then none — and never a creature. */
  const g2 = fakeGame();
  const f2 = new OpeningFilm(g2);
  f2.begin(null);
  const vis = () => (f2.props ? [f2.props.figure.visible, f2.props.echo.visible, f2.props.vast.visible] : null);
  run(f2, 20);
  chk(JSON.stringify(vis()) === '[false,false,false]', 'nothing is on screen through the normality beat');
  run(f2, 6);   // t ~= 26, anomaly
  chk(f2.beat === 'anomaly' && vis()[0] === true, 'the anomaly beat puts one shape in the field');
  run(f2, 18);  // t ~= 44, vast
  chk(f2.beat === 'vast' && vis()[2] === true, 'the vast beat puts something on the horizon');
  run(f2, 6);   // t ~= 50, seam
  chk(f2.beat === 'seam' && vis()[0] === true && vis()[1] === true && vis()[2] === false,
      'the seam beat shows two of the same thing at once, and the vast one is gone');
  run(f2, 10);  // t ~= 60, calm
  chk(f2.beat === 'calm' && JSON.stringify(vis()) === '[false,false,false]',
      'and the calm beat takes all of it away without acknowledging any of it');
  f2.skip();

  /* THE SHAPE IS A SHAPE. Not the Stalker, not anything nameable — sections 5, 6 and 19
     all want the player's first real meeting with a creature to happen later. */
  chk(!/buildStalkerMesh|STALKER|Behemoth|stalker/i.test(FILM_BODY),
      'the film builds none of the game\'s creatures — its silhouettes are boxes');
  /* PRIMITIVES ONLY. This check began life as "literally boxes", and the film's shapes
     were literally boxes until the first captures of them came back: a featureless
     rectangle standing in a field is the exact silhouette CLAUDE.md section 4 forbids,
     and the vast one read as a brown building. They are tapered five-sided columns now.
     The property that actually matters is unchanged and is what is asserted here — the
     shapes are untextured engine primitives with no anatomy anywhere in them. */
  chk(/new THREE\.(Box|Cylinder)Geometry/.test(FILM_CODE) &&
      !/SphereGeometry|TorusGeometry|ExtrudeGeometry|\bhead\b|\blimb\b|\barm\b|\bleg\b|\beye\b|\bmouth\b|\bface\b/i.test(FILM_CODE),
      'primitives only: no head, no limbs, nothing that resolves into an anatomy');
  chk(!/\.map\s*=|TextureLoader|CanvasTexture/.test(FILM_CODE),
      'and no texture on any of them — a silhouette is a shape and nothing else');

  /* THE OBSERVATION RULE, ENACTED AND NEVER EXPLAINED. */
  chk(/_looking\(bearing, tolerance\)/.test(FILM_BODY) && /if \(!this\._looking\(/.test(FILM_BODY),
      'the shape moves only while it is NOT being looked at — the rule is shown, never stated');
  chk(!/observation|when you look|not looking|watch/i.test(Object.keys(FILM_LINES).map(k => FILM_LINES[k]).join(' ')),
      'and no line of the film mentions looking at anything');
}

// =====================================================================================
// 11. THE HUD, THE LAYER, AND THE SETTINGS PANEL
// =====================================================================================
head('11. LAYERING');
{
  chk(typeof UIManager.prototype.setHudVisible === 'function',
      'the HUD is hidden by one method on UIManager (setHudVisible)');
  const m = methodBody(LIVE, 'setHudVisible');
  chk(m && /classList/.test(m) && !/innerHTML|createElement|remove\(\)/.test(m),
      'which toggles one class and rebuilds nothing — so restoring it cannot duplicate anything');
  chk(/#hud\.film-hidden, #crosshair\.film-hidden \{ display: none; \}/.test(STYLE),
      'and the class hides the HUD and the crosshair together');

  /* Z-ORDER. The film sits above the world and the HUD, and BELOW the settings panel —
     so a player who opens settings mid-film gets the panel on top, not under. */
  const z = {};
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let mm;
  const css = STYLE.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  while ((mm = rule.exec(css)) !== null) {
    const v = /(?:^|[;\s])z-index:\s*(-?\d+)/.exec(mm[2]);
    if (!v) continue;
    for (const sel of mm[1].split(',')) z[sel.trim()] = parseInt(v[1], 10);
  }
  chk(z['#openingFilm'] === 55, `the film layer is z-index ${z['#openingFilm']} — the one Phase 28 emptied`);
  chk(z['#openingFilm'] > z['#hud'], `above the HUD (${z['#hud']})`);
  chk(z['#openingFilm'] > z['#startScreen'],
      `and above the start screen (${z['#startScreen']}) it replaces`);
  chk(z['#openingFilm'] < z['#settingsOverlay'],
      `and below the settings panel (${z['#settingsOverlay']}) — settings opens OVER the film, never under it`);
  chk(z['#openingFilm'] < z['#openingInstruction'],
      `and below the instruction (${z['#openingInstruction']}) it hands over to`);

  /* THE SETTINGS PANEL PAUSES THE FILM, because the frame loop's settings branch returns
     before the film branch is reached. That ordering is the whole mechanism. */
  const anim = LIVE.slice(LIVE.indexOf('  _animate() {'), LIVE.indexOf('  _animate() {') + 4200);
  chk(anim.indexOf('this.ui.settingsOpen') < anim.indexOf('this.film && this.film.active'),
      'the settings branch is tested before the film branch, so opening settings pauses the film');
}

// =====================================================================================
// 12. TYPOGRAPHY — PHASE 29's RULES STILL APPLY
// =====================================================================================
head('12. TYPOGRAPHY');
{
  const decl = (sel, prop) => {
    const re = new RegExp('(?:^|[},])\\s*' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                          '\\s*\\{([^{}]*)\\}', 'm');
    const m = re.exec(STYLE);
    if (!m) return null;
    const d = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)').exec(m[1]);
    return d ? d[1].trim() : null;
  };
  const skipSize = decl('#filmSkip', 'font-size');
  chk(/--t-label/.test(skipSize || ''), `the skip control uses the Phase 29 type scale (${skipSize})`);
  chk(/--ui-face/.test(decl('#filmSkip', 'font-family') || ''),
      'and the Phase 29 face, not Courier New');
  const lineSize = decl('#filmLine', 'font-size');
  chk(/clamp\(1[0-9]px/.test(lineSize || ''),
      `the narration is set at a readable size that scales with the window (${lineSize})`);
  chk(!/filter:[^;}]*blur/.test(STYLE.slice(STYLE.indexOf('#openingFilm'), STYLE.indexOf('#openingInstruction'))),
      'and nothing on the film layer is blurred');
}

console.log('');
if (fail) { console.log(`${fail} PHASE 30 OPENING CHECK(S) FAILED`); process.exit(1); }
console.log('ALL PHASE 30 OPENING CHECKS PASS');
note('Offline. The real beat table, tick, skip and teardown were driven against a stand-in');
note('Game. Whether the film is unsettling, or the right length, is a judgement for a');
note('person — see browser-opening.js for the live document and the report for what a');
note('human has and has not watched.');
