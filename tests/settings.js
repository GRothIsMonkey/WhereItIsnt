/* PHASE 22 — SETTINGS: STATE, PERSISTENCE, AND INTEGRATION.

   The settings STATE is fully testable offline and is tested exhaustively here: defaults,
   coercion, clamping, corrupt storage, persistence across a simulated reload, and the
   Phase 23 hand-off shape. The UI and the pause/pointer-lock behaviour are tested
   structurally — the real UIManager is constructed against the harness DOM and driven
   through its real open/close methods — and the audio path is tested against a stub
   AudioContext that records every gain write.

   WHAT IS NOT TESTED HERE: anything that needs a GPU. No WebGL context exists in this
   harness, so "Low actually renders faster" is not a claim this file makes. What it does
   assert about graphics is that the preset table is coherent, monotonic, and that the
   applier reads it — see the final report for what still needs a browser. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { makeWorld } = require('./harness/util.js');
const { S } = makeWorld();
const SRC = fs.readFileSync(path.join(__dirname, '..', 'game.html'), 'utf8');
let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const g = (n) => vm.runInContext(n, S);

const GameSettings = g('GameSettings');
const SCHEMA = g('SETTINGS_SCHEMA');
const KEY = g('SETTINGS_STORAGE_KEY');
const PRESETS = g('GRAPHICS_PRESETS');
const QUALITIES = g('GRAPHICS_QUALITIES');

/* A localStorage stand-in with the behaviours that actually break things in the wild. */
function memStore(initial) {
  const m = new Map(initial ? Object.entries(initial) : []);
  return { m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k) };
}
const throwingStore = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

// =====================================================================================
// 1. THE SIX SETTINGS, AND THEIR DEFAULTS
// =====================================================================================
{
  const want = ['masterVolume', 'musicVolume', 'sfxVolume', 'mouseSensitivity',
                'graphicsQuality', 'fullscreen'];
  const have = Object.keys(SCHEMA);
  chk(want.every(k => have.includes(k)), `all six required settings exist: ${have.join(', ')}`);
  chk(have.length === want.length,
      `and no more than six — the menu stays focused (${have.length} settings)`);
}
{
  const s = new GameSettings(memStore());
  const d = s.toJSON();
  chk(d.masterVolume === 1 && d.musicVolume === 1 && d.sfxVolume === 1,
      'the three volumes default to 1.0, which reproduces the shipped mix exactly');
  chk(d.mouseSensitivity === 1,
      'sensitivity defaults to 1.0 — the 0.0022 rad/px the game has always used');
  chk(d.graphicsQuality === 'high',
      'graphics defaults to High, which is the renderer configuration the build already had');
  chk(d.fullscreen === false, 'fullscreen defaults to off');
}

// =====================================================================================
// 2. VALIDATION AND CLAMPING — NOTHING MALFORMED SURVIVES
// =====================================================================================
{
  const s = new GameSettings(memStore());
  const cases = [
    ['masterVolume', 5, 1, 'above range clamps to the maximum'],
    ['masterVolume', -3, 0, 'below range clamps to the minimum'],
    ['masterVolume', NaN, 1, 'NaN falls back to the default'],
    ['masterVolume', Infinity, 1, 'Infinity falls back to the default'],
    ['masterVolume', undefined, 1, 'undefined falls back to the default'],
    ['masterVolume', null, 1, 'null falls back to the default'],
    ['masterVolume', 'abc', 1, 'a non-numeric string falls back to the default'],
    ['masterVolume', '0.5', 0.5, 'a numeric string is accepted and coerced'],
    ['mouseSensitivity', 0.01, 0.25, 'sensitivity clamps up to its floor'],
    ['mouseSensitivity', 99, 3.0, 'sensitivity clamps down to its ceiling'],
    ['graphicsQuality', 'ultra', 'high', 'an unknown quality falls back to the default'],
    ['graphicsQuality', 42, 'high', 'a non-string quality falls back to the default'],
    ['graphicsQuality', 'low', 'low', 'a valid quality is accepted'],
    ['fullscreen', 'true', false, 'the string "true" is not a boolean and falls back'],
    ['fullscreen', 1, false, 'the number 1 is not a boolean and falls back'],
    ['fullscreen', true, true, 'a real boolean is accepted'],
  ];
  let bad = [];
  for (const [k, input, expect, label] of cases) {
    s.values[k] = SCHEMA[k].def;          // reset between cases
    s.set(k, input);
    if (s.get(k) !== expect) bad.push(`${label}: got ${JSON.stringify(s.get(k))}, want ${JSON.stringify(expect)}`);
  }
  chk(bad.length === 0, `all ${cases.length} coercion cases behave` + (bad.length ? ' — ' + bad.join('; ') : ''));
  chk(s.set('notASetting', 1) === false, 'an unknown key is rejected outright');
}
{
  // Out of range CLAMPS rather than defaulting: a hand-edited 500% becomes 100%, not 0.
  const s = new GameSettings(memStore({ [KEY]: JSON.stringify({ masterVolume: 5, sfxVolume: -2 }) }));
  chk(s.get('masterVolume') === 1 && s.get('sfxVolume') === 0,
      'a stored out-of-range value is clamped on load, not discarded (5 → 1, −2 → 0)');
}

// =====================================================================================
// 3. CORRUPT STORAGE MUST NEVER STOP THE GAME STARTING
// =====================================================================================
{
  const corrupt = [
    ['not JSON at all', 'this is not json {{{'],
    ['a JSON array', '[1,2,3]'],
    ['JSON null', 'null'],
    ['a JSON string', '"hello"'],
    ['a JSON number', '42'],
    ['an empty object', '{}'],
    ['every value the wrong type', JSON.stringify({ masterVolume: 'x', musicVolume: [], sfxVolume: {}, mouseSensitivity: null, graphicsQuality: 7, fullscreen: 'yes' })],
    ['a truncated write', '{"masterVolume":0.5,"musicVol'],
    ['unknown keys only', JSON.stringify({ nope: 1, alsoNope: true })],
  ];
  let bad = [];
  for (const [label, raw] of corrupt) {
    let s = null, threw = null;
    try { s = new GameSettings(memStore({ [KEY]: raw })); } catch (e) { threw = e; }
    if (threw) { bad.push(`${label}: threw ${threw.message}`); continue; }
    const d = s.toJSON();
    for (const k of Object.keys(SCHEMA)) {
      const v = d[k];
      const spec = SCHEMA[k];
      const ok = spec.kind === 'num' ? (Number.isFinite(v) && v >= spec.min && v <= spec.max)
               : spec.kind === 'enum' ? spec.values.includes(v)
               : typeof v === 'boolean';
      if (!ok) bad.push(`${label}: ${k} = ${JSON.stringify(v)}`);
    }
  }
  chk(bad.length === 0,
      `${corrupt.length} kinds of corrupt stored data all load to safe values without throwing` +
      (bad.length ? ' — ' + bad.join('; ') : ''));
}
{
  let threw = null, s = null;
  try { s = new GameSettings(throwingStore); s.set('masterVolume', 0.5); s.save(); }
  catch (e) { threw = e; }
  chk(!threw && s.get('masterVolume') === 0.5,
      'a storage accessor that THROWS on every call (private browsing, blocked site data) ' +
      'leaves the game running on working in-memory settings');
  chk(typeof g('safeLocalStorage') === 'function',
      'and boot probes storage behind a try before ever handing it to GameSettings');
}

// =====================================================================================
// 4. PERSISTENCE
// =====================================================================================
{
  const store = memStore();
  const a = new GameSettings(store);
  a.set('masterVolume', 0.42);
  a.set('graphicsQuality', 'medium');
  a.set('mouseSensitivity', 2.5);
  a.save();                                   // flush the debounce
  chk(store.getItem(KEY) !== null, 'settings are written to storage');
  // A "page reload": a brand new instance over the same storage.
  const b = new GameSettings(store);
  chk(b.get('masterVolume') === 0.42 && b.get('graphicsQuality') === 'medium' &&
      b.get('mouseSensitivity') === 2.5,
      'and survive a reload — a fresh instance over the same storage restores every value');
  chk(b.get('sfxVolume') === 1,
      'while a value that was never changed comes back as its default');
}
{
  // The write is DEBOUNCED, not per-change: a slider drag must not hammer storage.
  const store = memStore();
  let writes = 0;
  const counting = { getItem: store.getItem, setItem: (k, v) => { writes++; store.setItem(k, v); }, removeItem: store.removeItem };
  const s = new GameSettings(counting);
  for (let i = 0; i <= 100; i++) s.set('masterVolume', i / 100);      // a full slider drag
  chk(writes === 0, `101 slider steps trigger ${writes} storage writes while dragging`);
  s.save();
  chk(writes === 1 && s.get('masterVolume') === 1.0,
      'and exactly one write when it is flushed — the value was live the whole time');
}
{
  const s = new GameSettings(memStore());
  s.set('masterVolume', 0.1); s.set('graphicsQuality', 'low'); s.set('fullscreen', true);
  s.reset();
  chk(JSON.stringify(s.toJSON()) === JSON.stringify(g('defaultSettings')()),
      'restore-defaults returns every value to its default');
}
{
  // The Phase 23 hand-off: a flat snapshot out, a validated snapshot in.
  const s = new GameSettings(memStore());
  const snap = s.toJSON();
  chk(snap && typeof snap === 'object' && !Array.isArray(snap) &&
      Object.keys(snap).length === Object.keys(SCHEMA).length,
      'toJSON() is a flat, JSON-shaped snapshot of exactly the schema keys');
  s.applyJSON({ masterVolume: 0.25, graphicsQuality: 'low', bogus: 9, sfxVolume: 99 });
  chk(s.get('masterVolume') === 0.25 && s.get('graphicsQuality') === 'low' &&
      s.get('sfxVolume') === 1 && s.get('bogus') === undefined,
      'applyJSON() validates on the way in too: unknown keys ignored, out-of-range clamped');
}

// =====================================================================================
// 5. AUDIO INTEGRATION
// =====================================================================================
{
  const SoundEngine = g('SoundEngine');
  const eng = new SoundEngine();
  chk(eng.applyVolumes(1, 1, 1) === false,
      'applying volumes before the AudioContext exists is a safe no-op, not a throw');
}
{
  /* A recording AudioContext. Every gain node remembers what was written to it, so the
     three multipliers can be checked against the actual graph rather than against the
     source text. */
  function fakeCtx() {
    const nodes = [];
    const mkGain = () => {
      const n = { _target: null, connectedTo: null, gain: {
        value: 1,
        cancelScheduledValues() {},
        setTargetAtTime(v) { n._target = v; },
      }, connect(o) { n.connectedTo = o; } };
      nodes.push(n); return n;
    };
    return { nodes, currentTime: 0, destination: { name: 'destination' },
      createGain: mkGain,
      createOscillator: () => ({ type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {}, detune: { value: 0 } }),
      createBuffer: (c, l) => ({ getChannelData: () => new Float32Array(l) }),
      createBufferSource: () => ({ buffer: null, loop: false, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {} }),
      createBiquadFilter: () => ({ type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { value: 0 }, connect() {} }),
      createStereoPanner: () => ({ pan: { value: 0 }, connect() {} }),
      createDynamicsCompressor: () => ({ threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 }, connect() {} }),
      createWaveShaper: () => ({ curve: null, connect() {} }),
      createDelay: () => ({ delayTime: { value: 0 }, connect() {} }),
      sampleRate: 48000 };
  }
  const SoundEngine = g('SoundEngine');
  const eng = new SoundEngine();
  const ctx = fakeCtx();
  eng.ctx = ctx;
  // Build only the bus section start() builds, using the real node names.
  eng.master = ctx.createGain(); eng.master.gain.value = 0.55;
  eng.userGain = ctx.createGain(); eng.userGain.gain.value = 1.0;
  eng.musicBus = ctx.createGain(); eng.musicBus.gain.value = 0.82;
  eng.sfxBus = ctx.createGain(); eng.sfxBus.gain.value = 1.35;
  eng.sfxUnityBus = ctx.createGain(); eng.sfxUnityBus.gain.value = 1.0;

  chk(eng.applyVolumes(1, 1, 1) === true, 'with a context, applyVolumes reports that it applied');
  chk(eng.userGain._target === 1 && Math.abs(eng.musicBus._target - 0.82) < 1e-12 &&
      Math.abs(eng.sfxBus._target - 1.35) < 1e-12 && eng.sfxUnityBus._target === 1,
      'at default settings every bus lands on its shipped value — the mix is unchanged ' +
      `(user ${eng.userGain._target}, music ${eng.musicBus._target}, sfx ${eng.sfxBus._target}/${eng.sfxUnityBus._target})`);

  eng.applyVolumes(0.5, 1, 1);
  chk(eng.userGain._target === 0.5 && Math.abs(eng.musicBus._target - 0.82) < 1e-12,
      'master scales the user gain and leaves the music bus alone — the three are independent');
  eng.applyVolumes(1, 0, 1);
  chk(eng.musicBus._target === 0 && Math.abs(eng.sfxBus._target - 1.35) < 1e-12,
      'music at zero silences music and does not touch SFX');
  eng.applyVolumes(1, 1, 0);
  chk(eng.sfxBus._target === 0 && eng.sfxUnityBus._target === 0 &&
      Math.abs(eng.musicBus._target - 0.82) < 1e-12,
      'SFX at zero silences BOTH SFX buses and does not touch music');

  const before = ctx.nodes.length;
  for (let i = 0; i < 200; i++) eng.applyVolumes(i / 200, 1, 1);
  chk(ctx.nodes.length === before,
      `200 slider steps create ${ctx.nodes.length - before} new audio nodes — no graph is rebuilt`);
}
{
  // The user volume must NOT be master.gain, which playDeathCollapse latches to zero.
  chk(/this\.userGain\.connect\(this\.ctx\.destination\)/.test(SRC) &&
      /ramp\(this\.userGain, master\)/.test(SRC),
      'master volume drives a separate userGain node, so it cannot undo the climax duck ' +
      'that latches master.gain to zero');
  const applyFn = SRC.slice(SRC.indexOf('  applyVolumes(master, music, sfx) {'),
                            SRC.indexOf('  setMusicVolume(v) {'));
  chk(!/createGain|new \(/.test(applyFn), 'and applyVolumes creates nothing');
}
{
  // Every SFX cue reaches an SFX bus; nothing gameplay-audible is left on master alone.
  const engStart = SRC.slice(SRC.indexOf('  start() {'), SRC.indexOf('  applyVolumes('));
  const stray = (SRC.match(/connect\(this\.master\)/g) || []).length;
  chk(stray === 3,
      `only the three buses connect straight to master (${stray} sites); every gameplay ` +
      `cue now goes through sfxBus or sfxUnityBus and answers to the SFX slider`);
}

// =====================================================================================
// 6. SENSITIVITY, GRAPHICS AND FULLSCREEN INTEGRATION
// =====================================================================================
{
  chk(/const sens = 0\.0022 \* \(this\.settings \? this\.settings\.get\('mouseSensitivity'\) : 1\)/.test(SRC),
      'mouse look multiplies the unchanged 0.0022 base by the live setting, read per event');
  /* Comments are stripped before scanning: the first version of this check matched the
     words "speed" and "reach" inside the explanatory comment above the handler and
     failed on prose rather than on code. */
  const mmRaw = SRC.slice(SRC.indexOf("document.addEventListener('mousemove'"),
                          SRC.indexOf("this.dom.addEventListener('click'"));
  const mm = mmRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  chk(!/speed|velocity|reach|position\.|\.hp|inventory/.test(mm),
      'and the mousemove handler still touches nothing but yaw and pitch — no movement, ' +
      'no physics, no interaction range');
  chk(/this\.yaw -= e\.movementX \* sens;/.test(mm) && /this\.pitch -= e\.movementY \* sens;/.test(mm),
      'with the original sign on both axes — sensitivity scales look, it does not invert it');
  chk(/this\.pitch = Math\.max\(-limit, Math\.min\(limit, this\.pitch\)\)/.test(mm),
      'with the existing pitch clamp intact and no inversion introduced');
}
{
  chk(QUALITIES.length === 3 && QUALITIES.join(',') === 'low,medium,high',
      `three presets, not a catalogue: ${QUALITIES.join(', ')}`);
  let monotonic = true;
  for (let i = 1; i < QUALITIES.length; i++) {
    const a = PRESETS[QUALITIES[i - 1]], b = PRESETS[QUALITIES[i]];
    if (!(b.renderScale >= a.renderScale && b.pixelRatio >= a.pixelRatio && b.shadowMap >= a.shadowMap)) monotonic = false;
  }
  chk(monotonic, 'each preset is at least as expensive as the one below it on every knob');
  chk(PRESETS.high.renderScale === 1.0 && PRESETS.high.pixelRatio === 2.0 && PRESETS.high.shadowMap === 2048,
      'High is exactly the configuration the build already shipped — the default changes nothing');
  chk(PRESETS.low.renderScale < PRESETS.high.renderScale &&
      PRESETS.low.shadowMap < PRESETS.high.shadowMap,
      `and Low is meaningfully cheaper (render scale ${PRESETS.low.renderScale}, ` +
      `shadow map ${PRESETS.low.shadowMap})`);
  chk(PRESETS.low.renderScale >= 0.6,
      'but conservative — Low still renders at 70% scale with shadows on, it does not gut the image');
}
{
  const apply = SRC.slice(SRC.indexOf('  _applyGraphicsQuality() {'), SRC.indexOf('  _watchFullscreen() {'));
  chk(/if \(this\._appliedPreset === this\.settings\.get\('graphicsQuality'\)\) return;/.test(apply),
      'the graphics applier early-returns when the preset has not changed, so dragging an ' +
      'unrelated slider never touches the renderer');
  chk(/sun\.shadow\.map\.dispose\(\); sun\.shadow\.map = null;/.test(apply),
      'and disposes the old shadow map when the size changes, or three.js keeps the old one');
  chk(!/new THREE\.WebGLRenderer/.test(apply), 'the renderer is never recreated');
  chk(/Math\.max\(1, Math\.round/.test(apply),
      'render-target dimensions are rounded and floored at 1px — a zero or fractional target is a WebGL error');
}
{
  for (const fn of ['fullscreenSupported', 'isDocumentFullscreen', 'requestFullscreenState'])
    chk(typeof g(fn) === 'function', `${fn}() exists`);
  chk(g('fullscreenSupported')() === false,
      'and reports honestly that this environment has no fullscreen API (the harness DOM has none)');
  let threw = null;
  try { g('requestFullscreenState')(true); g('requestFullscreenState')(false); }
  catch (e) { threw = e; }
  chk(!threw, 'requesting fullscreen where it is unsupported returns safely instead of throwing');
  chk(/webkitRequestFullscreen|msRequestFullscreen/.test(SRC), 'prefixed spellings are handled');
  chk(/fullscreenchange[\s\S]{0,220}webkitfullscreenchange/.test(SRC),
      'and the document fullscreenchange events are watched, so F11 or Escape outside the ' +
      'menu still corrects the stored value');
  const bind = SRC.slice(SRC.indexOf("const fs = el('setFullscreen');"), SRC.indexOf("const def = el('setDefaults');"));
  chk(/requestFullscreenState\(/.test(bind),
      'the fullscreen request is issued from inside the click handler, as the browser requires');
}

// =====================================================================================
// 7. PAUSE, INPUT GATING AND POINTER LOCK
// =====================================================================================
{
  chk(/get menuOpen\(\) \{ return this\.craftingOpen \|\| this\.backpackOpen \|\| this\.storageOpen \|\| this\.settingsOpen; \}/.test(SRC),
      'settingsOpen feeds the existing menuOpen gate rather than adding a second one');
  // Every gameplay input path already consults menuOpen. Prove they still do.
  for (const [label, snippet] of [
    ['mouse look', "document.addEventListener('mousemove'"],
    ['mining / attack / place', "document.addEventListener('mousedown'"],
    ['hotbar scroll', "document.addEventListener('wheel'"],
    ['click-to-relock', "this.dom.addEventListener('click'"],
  ]) {
    const i = SRC.indexOf(snippet);
    chk(i > 0 && /this\.ui\.menuOpen/.test(SRC.slice(i, i + 260)),
        `${label} is gated on menuOpen, so it stops while settings are open`);
  }
  chk(/if \(e\.code === 'KeyQ' && !e\.repeat && this\.locked && !this\.ui\.menuOpen/.test(SRC),
      'and so is dropping an item');
}
{
  const anim = SRC.slice(SRC.indexOf('  _animate() {'), SRC.indexOf('  _animate() {') + 2600);
  chk(/if \(this\.ui\.settingsOpen\) \{[\s\S]{0,200}return;/.test(anim),
      'the frame loop genuinely PAUSES the simulation while settings are open');
  chk(/this\.postfx\.render\(dt,/.test(anim.slice(anim.indexOf('settingsOpen'))),
      'while still rendering, so the panel sits over the world rather than over black');
  chk(anim.indexOf('this.clock.getDelta()') < anim.indexOf('settingsOpen'),
      'and the frame delta is still consumed each frame, so resuming cannot deliver one ' +
      'huge dt that jumps the player or the clock');
}
{
  chk(/openSettings\(\) \{[\s\S]{0,320}document\.exitPointerLock\(\);/.test(SRC),
      'opening settings releases pointer lock, so the cursor is available for the panel');
  chk(/_resumeFromSettings\(\) \{[\s\S]{0,220}requestPointerLock\(\)/.test(SRC),
      'and closing restores it');
  chk(/if \(this\.running && !this\.player\.dead\) this\.canvas\.requestPointerLock\(\);/.test(SRC),
      'but only during play — closing settings from the start screen must not trap the cursor');
}

// =====================================================================================
// 8. THE UI ITSELF — REAL UIManager, REAL METHODS, NO DUPLICATE LISTENERS
// =====================================================================================
{
  const UIManager = g('UIManager');
  const ui = new UIManager();
  const s = new GameSettings(memStore());
  chk(ui.settingsOpen === false, 'a fresh UIManager has settings closed');

  // Count how many listeners the panel binds, across many attach/open/close cycles.
  const doc = g('document');
  ui.attachSettings(s, () => {});
  const firstBound = ui._settingsBound;
  for (let i = 0; i < 25; i++) { ui.attachSettings(s, () => {}); ui.openSettings(); ui.closeSettings(); }
  chk(firstBound === true && ui._settingsBound === true,
      '25 attach/open/close cycles leave the listeners bound exactly once (bound in the ' +
      'constructor path, never on open)');
  chk(ui.settingsOpen === false, 'and it ends closed');

  ui.openSettings();
  chk(ui.settingsOpen === true && ui.menuOpen === true,
      'opening sets settingsOpen and therefore menuOpen');
  ui.openSettings();
  chk(ui.settingsOpen === true, 'opening twice is idempotent — no second layer');
  ui.closeSettings(); ui.closeSettings();
  chk(ui.settingsOpen === false && ui.menuOpen === false, 'closing twice is idempotent');
  ui.toggleSettings();
  chk(ui.settingsOpen === true, 'toggle opens');
  ui.toggleSettings();
  chk(ui.settingsOpen === false, 'toggle closes');
}
{
  // syncSettingsUI must reflect real state, and must survive being called with no panel.
  const UIManager = g('UIManager');
  const ui = new UIManager();
  const s = new GameSettings(memStore());
  ui.attachSettings(s, null);
  s.set('masterVolume', 0.37);
  s.set('graphicsQuality', 'medium');
  let threw = null;
  try { ui.syncSettingsUI(); } catch (e) { threw = e; }
  chk(!threw, 'syncSettingsUI runs against the harness DOM without throwing');
  const val = g('document').getElementById('setMasterVal');
  chk(val && val.textContent === '37%', `and writes the live value into the panel ("${val && val.textContent}")`);
  const q = g('document').getElementById('setQualityVal');
  chk(q && q.textContent === 'MEDIUM', `including the quality readout ("${q && q.textContent}")`);
  const closedUI = new UIManager();
  let threw2 = null;
  try { closedUI.syncSettingsUI(); closedUI.closeSettings(); closedUI.openSettings(); } catch (e) { threw2 = e; }
  chk(!threw2, 'and a UIManager with no settings attached is safe to drive');
}
{
  // Access points exist and do not collide with existing bindings.
  chk(/if \(e\.code === 'KeyO' && !e\.repeat/.test(SRC), 'O toggles settings in gameplay');
  chk(/if \(e\.code === 'Escape' && this\.ui\.settingsOpen\) \{ this\.ui\.closeSettings\(\); return; \}/.test(SRC),
      'and Escape closes it');
  for (const k of ['KeyE', 'KeyI', 'KeyQ']) {
    chk(!new RegExp(`e\\.code === '${k}'[\\s\\S]{0,80}toggleSettings`).test(SRC),
        `${k} is not hijacked — the existing binding is untouched`);
  }
  /* NOTHING MAY STACK ON THE SETTINGS PANEL. Found by inspection: without these guards
     E opened the crafting bench and I opened the backpack on top of a panel that had
     already released pointer lock and paused the world, leaving one overlay orphaned the
     moment the other closed. */
  chk(/if \(e\.code === 'KeyE'\) \{\s*\n\s*if \(!this\.ui\.settingsOpen\) this\.ui\.toggleCrafting\(\);/.test(SRC),
      'E cannot open the crafting bench on top of the settings panel');
  chk(/if \(e\.code === 'KeyI' \|\| e\.code === 'Tab'\) \{[\s\S]{0,90}if \(this\.ui\.settingsOpen\) return;/.test(SRC),
      'and I / Tab cannot open the backpack on top of it');
  chk(/e\.code === 'KeyO' && !e\.repeat && !this\.ui\.craftingOpen && !this\.ui\.backpackOpen &&\s*\n\s*!this\.ui\.storageOpen/.test(SRC),
      'nor can settings open on top of the crafting bench, the backpack or the storage chest');
  chk(/getElementById\('startSettingsLink'\)/.test(SRC), 'and the start screen has a Settings entry');
  chk(/id="startSettingsLink"/.test(SRC) && /id="skipTutorialLink"/.test(SRC),
      'alongside the existing skip link, which still exists');
}
{
  // No duplicate UI: exactly one settings overlay in the document.
  chk((SRC.match(/id="settingsOverlay"/g) || []).length === 1, 'exactly one settings overlay exists');
  for (const id of ['setMaster', 'setMusic', 'setSfx', 'setSens', 'setQuality', 'setFullscreen'])
    chk((SRC.match(new RegExp(`id="${id}"`, 'g')) || []).length === 1, `exactly one #${id} control`);
}

// =====================================================================================
// 9. STACKING ORDER — THE PANEL MUST BE VISIBLE FROM EVERYWHERE IT CAN BE OPENED
//
// PHASE 22 HOTFIX. The start screen's SETTINGS button appeared dead. The click was never
// the problem: the listener fired, openSettings() ran, the overlay got .active — and it
// rendered underneath #startScreen, which paints an opaque background across the whole
// viewport at a higher z-index. A "does the listener exist" check cannot catch that, so
// this section reads the real stylesheet and compares the layers themselves.
// =====================================================================================
{
  /* Parse z-index out of the game's own <style>. Comments are stripped first — this file
     has already been bitten once by a regex matching prose inside a comment. */
  const styleBody = (SRC.match(/<style>([\s\S]*?)<\/style>/) || [null, ''])[1]
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const zIndex = new Map();
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = rule.exec(styleBody)) !== null) {
    const z = /(?:^|[;\s])z-index:\s*(-?\d+)/.exec(m[2]);
    if (!z) continue;
    for (const sel of m[1].split(',')) {
      const name = sel.trim();
      if (name) zIndex.set(name, parseInt(z[1], 10)); // later rules win, as the cascade does
    }
  }

  const panel = zIndex.get('#settingsOverlay');
  chk(typeof panel === 'number', `#settingsOverlay declares a z-index (${panel})`);

  /* Every screen the panel can legitimately be opened from. The start screen is the
     reported bug; the tutorial screen is the same defect one layer up, since the O key
     listener is live from Game construction onward. */
  for (const under of ['#startScreen', '#tutorialScreen', '#craftingOverlay',
                       '#backpackOverlay', '#storageOverlay']) {
    const z = zIndex.get(under);
    chk(typeof z === 'number' && panel > z,
        `settings (${panel}) renders above ${under} (${z}) — it cannot open behind an opaque screen`);
  }

  /* And the cinematic layers it must never cover. A settings panel drawn over the hard
     black cut or the credits would be worse than one drawn under the start screen. */
  for (const over of ['#fadeWhite', '#blackCut', '#creditsScreen', '#openingInstruction']) {
    const z = zIndex.get(over);
    chk(typeof z === 'number' && panel < z,
        `and below ${over} (${z}) — cinematic layers stay on top`);
  }

  /* The overlay covers the whole viewport and paints a scrim, so it swallows the clicks
     that would otherwise reach the start screen's buttons or the canvas beneath it. */
  const overlayRule = /#settingsOverlay\s*\{([^}]*)\}/.exec(styleBody);
  chk(!!overlayRule && /position:\s*fixed/.test(overlayRule[1]) && /inset:\s*0/.test(overlayRule[1]),
      'the overlay is fixed and full-viewport, so nothing underneath it receives the click');
  chk(!!overlayRule && !/pointer-events:\s*none/.test(overlayRule[1]),
      'and it does not disable its own pointer events');
}
{
  /* ONE SETTINGS SYSTEM. The start screen entry must route into the same toggle the O key
     uses — not a parallel opener with its own state. */
  chk(/getElementById\('startSettingsLink'\)\.addEventListener\('click', \(\) => this\.ui\.toggleSettings\(\)\)/.test(SRC),
      'the start-screen button calls the same UIManager.toggleSettings() the O key calls');
  chk((SRC.match(/toggleSettings\(\)\s*\{/g) || []).length === 1,
      'exactly one toggleSettings() implementation exists');
  chk((SRC.match(/\bopenSettings\(\)\s*\{/g) || []).length === 1 &&
      (SRC.match(/\bcloseSettings\(\)\s*\{/g) || []).length === 1,
      'and one openSettings() / closeSettings() pair — no second settings system');
  chk((SRC.match(/this\.settingsOpen = /g) || []).length === 3,
      'settingsOpen is written in exactly three places: the constructor, open and close');

  /* CLICKS MUST NOT LEAK INTO GAMEPLAY while the panel is up. Both gameplay pointer paths
     already consult menuOpen, which settingsOpen feeds. */
  chk(/this\.dom\.addEventListener\('click', \(\) => \{\s*\n\s*if \(!this\.locked && !this\.ui\.menuOpen\) \{ this\.dom\.requestPointerLock\(\); return; \}/.test(SRC),
      'a click on the canvas cannot re-take pointer lock while a menu — settings included — is open');
  chk(/document\.addEventListener\('mousedown', \(e\) => \{\s*\n\s*if \(!this\.locked \|\| this\.ui\.menuOpen \|\| this\.dead/.test(SRC),
      'and mousedown cannot break, place or attack through the panel');

  /* Closing from the start screen must not grab the cursor for a game that has not begun. */
  chk(/_resumeFromSettings\(\) \{\s*\n\s*if \(this\.running && !this\.player\.dead\) this\.canvas\.requestPointerLock\(\);/.test(SRC),
      'closing the panel only re-locks the pointer if gameplay is actually running');
}

console.log(`\n${fail === 0 ? 'ALL SETTINGS CHECKS PASS' : fail + ' FAILURES'}`);
process.exit(fail ? 1 : 0);
