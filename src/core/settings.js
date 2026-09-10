"use strict";
/* =====================================================================================
   PHASE 22 — SETTINGS
   ERA 1.5.1 — EXTRACTED VERBATIM FROM game.html.

   The one owner of every option: defaults, validation, persistence, presets.

   This is a CLASSIC script, not an ES module. It shares one global lexical scope with
   every other file in src/ and with game.html's inline <script>, which is why the move
   needed no code change. Load order is declared in game.html and mirrored by
   tests/harness/load.js; see ARCHITECTURE.md.
   ===================================================================================== */

/* =====================================================================================
   PHASE 22 — SETTINGS

   ONE PLACE THAT OWNS EVERY OPTION. Defaults, validation, persistence and application
   all live here; nothing else in the game reads localStorage or decides what a legal
   value is. Phase 23 will want to fold settings into the save file, so the whole state
   is a flat, JSON-shaped object with an explicit schema — `toJSON()` hands it over and
   `apply(obj)` takes it back, with the same clamping either way.

   DEFAULTS ARE TODAY'S BEHAVIOUR, EXACTLY. Every volume defaults to 1.0 because the
   three multipliers scale the mix the game already ships (master 0.55, music 0.82, SFX
   1.35/1.0); sensitivity defaults to 1.0 against the hard-coded 0.0022 rad/px it has
   always used; quality defaults to 'high', which is the pixel ratio, render scale and
   shadow map size the build already had. A player who never opens this menu sees and
   hears precisely what they saw and heard before it existed.

   NOTHING MALFORMED CAN STOP THE GAME STARTING. Storage is attacker-adjacent in the
   sense that matters here: a user can edit it, a half-written value can survive a crash,
   and a future version can change the shape. Every read goes through the schema —
   missing, NaN, Infinity, wrong type, out of range and unknown enum all fall back to the
   default rather than propagating; a value that is merely out of range is clamped rather
   than discarded, so a hand-edited 500% volume becomes 100% instead of silence. The
   whole load is wrapped, so even a storage accessor that throws (private browsing, or a
   browser configured to block site data) leaves the game running on defaults. */
const SETTINGS_STORAGE_KEY = 'whereitisnt.settings.v1';
const GRAPHICS_QUALITIES = ['low', 'medium', 'high'];

/* The schema IS the validation. Each entry knows its default and its legal range, and
   `coerce` below is the only path a value can take into the live settings object. */
const SETTINGS_SCHEMA = {
  //                      default    min    max
  masterVolume:     { kind: 'num', def: 1.0, min: 0, max: 1 },
  musicVolume:      { kind: 'num', def: 1.0, min: 0, max: 1 },
  sfxVolume:        { kind: 'num', def: 1.0, min: 0, max: 1 },
  /* PHASE 34 — THE FOURTH VOLUME, AND WHY THE THREE WERE NOT ENOUGH.

     Ambience is neither music nor an effect. A player who turns music off wants to keep
     the wind; a player who turns effects down wants the footsteps quieter, not the field.
     Before the sample library there was nothing on this bus so the question never came
     up; now every recorded room tone, bed and distant event goes through `ambienceBus`
     and answers to this. Defaults to 1.0 like the other three, so an existing save's
     settings block — which does not contain this key — loads at the shipped mix. */
  ambienceVolume:   { kind: 'num', def: 1.0, min: 0, max: 1 },
  /* A MULTIPLIER, NOT A RAW RATE. 1.0 reproduces the 0.0022 rad/px the game has always
     used; the bounds are deliberately modest — a quarter speed is still usable and three
     times is already very fast, and anything wider is a way to make the game unplayable
     by accident rather than a feature. */
  mouseSensitivity: { kind: 'num', def: 1.0, min: 0.25, max: 3.0 },
  graphicsQuality:  { kind: 'enum', def: 'high', values: GRAPHICS_QUALITIES },
  fullscreen:       { kind: 'bool', def: false },
};

function coerceSetting(key, raw) {
  const spec = SETTINGS_SCHEMA[key];
  if (!spec) return undefined;
  if (spec.kind === 'num') {
    const n = typeof raw === 'number' ? raw : parseFloat(raw);
    if (!Number.isFinite(n)) return spec.def;          // undefined, null, NaN, Infinity, "abc"
    return Math.min(spec.max, Math.max(spec.min, n));  // out of range clamps, never defaults
  }
  if (spec.kind === 'enum') {
    return spec.values.indexOf(raw) >= 0 ? raw : spec.def;
  }
  // bool: only a real boolean counts. "false" and 0 are not booleans and fall back.
  return typeof raw === 'boolean' ? raw : spec.def;
}

function defaultSettings() {
  const o = {};
  for (const k of Object.keys(SETTINGS_SCHEMA)) o[k] = SETTINGS_SCHEMA[k].def;
  return o;
}

/* THE GRAPHICS PRESETS, and why these three knobs.

   These are the rendering costs the build ALREADY has, turned down — not new machinery.
   The brief is explicit that a quality setting must not become an excuse to rewrite
   rendering, so nothing here removes a visual: no effect is switched off, no draw call
   disappears, and every preset renders the same scene with the same shaders.

     renderScale   the size of the PostFX render target. THIS is the real lever: the
                   scene is drawn once into that target and then blitted through the
                   grading shader, so target area is very nearly the whole frame cost.
                   The blit itself is one quad and is effectively free.
     pixelRatio    caps the final blit's resolution. Cheap by comparison, but on a 3x
                   phone screen an uncapped blit is still worth capping.
     shadowMap     the sun's shadow map is 2048 square at High. Halving it is a real
                   saving and, at this art style's contrast, a small visual change.

   Low is deliberately conservative: 70% render scale still reads clearly and shadows
   are still on. "Distinguishable but conservative" is the instruction. */
const GRAPHICS_PRESETS = {
  low:    { renderScale: 0.70, pixelRatio: 1.0, shadowMap: 1024 },
  medium: { renderScale: 0.85, pixelRatio: 1.5, shadowMap: 1536 },
  high:   { renderScale: 1.00, pixelRatio: 2.0, shadowMap: 2048 },
};

/* PHASE 22 — FULLSCREEN, DEFENSIVELY.

   Three separate hazards, all handled here so nothing else has to think about them:

     NOT EVERY BROWSER HAS IT, and the vendor-prefixed spellings still exist in the wild.
     fullscreenSupported() reports honestly and the UI disables the control rather than
     offering a button that does nothing.

     THE REQUEST NEEDS A USER GESTURE. requestFullscreenState is only ever called from
     inside a click handler; calling it from a settings listener or a deferred apply would
     be rejected by the browser, which is why fullscreen is the one setting the panel
     actions directly rather than through the generic apply path.

     IT CAN CHANGE BEHIND OUR BACK. F11 and Escape both toggle fullscreen without going
     anywhere near this menu, so the document's own fullscreenchange event is the source
     of truth and the stored value is corrected from it — see Game's listener.

   Every call is wrapped: a rejected promise or a throwing implementation must never take
   the game down with it. */
/* PHASE 22 — localStorage, but survivable. Private-browsing modes and "block site data"
   settings make even TOUCHING window.localStorage throw in some browsers, so the access
   is probed once behind a try and the game runs on defaults if it fails. */
function safeLocalStorage() {
  try {
    const s = window.localStorage;
    if (!s) return null;
    const probe = '__wii_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch (e) { return null; }
}

function fullscreenSupported() {
  const d = document.documentElement;
  return !!(d && (d.requestFullscreen || d.webkitRequestFullscreen || d.msRequestFullscreen));
}
function isDocumentFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
}
function requestFullscreenState(on) {
  try {
    if (on) {
      if (isDocumentFullscreen()) return true;
      const d = document.documentElement;
      const fn = d.requestFullscreen || d.webkitRequestFullscreen || d.msRequestFullscreen;
      if (!fn) return false;
      const r = fn.call(d);
      if (r && typeof r.catch === 'function') r.catch(() => {});   // denied: not an error
    } else {
      if (!isDocumentFullscreen()) return true;
      const fn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (!fn) return false;
      const r = fn.call(document);
      if (r && typeof r.catch === 'function') r.catch(() => {});
    }
    return true;
  } catch (e) { return false; }
}

class GameSettings {
  constructor(storage) {
    /* The storage handle is injected so the class is testable without a browser and so a
       throwing accessor is survivable. Anything with getItem/setItem will do. */
    this.storage = storage || null;
    this.values = defaultSettings();
    this._saveTimer = null;
    this._listeners = [];
    this.load();
  }

  get(key) { return this.values[key]; }

  /* The only way a value changes. Returns true if it actually moved, so callers can skip
     re-applying an unchanged setting — which is what keeps dragging a slider from
     re-creating renderer state on every input event. */
  set(key, raw) {
    if (!SETTINGS_SCHEMA[key]) return false;
    const v = coerceSetting(key, raw);
    if (this.values[key] === v) return false;
    this.values[key] = v;
    this._emit(key, v);
    this.saveSoon();
    return true;
  }

  onChange(fn) { this._listeners.push(fn); }
  _emit(key, v) { for (const fn of this._listeners) { try { fn(key, v, this); } catch (e) { /* a listener must never break a setting */ } } }

  /* Every stored key is re-validated on the way in, so a file written by a different
     version, a hand-edited value or a truncated write all degrade to defaults rather
     than to a broken game. Unknown keys are ignored rather than kept. */
  load() {
    this.values = defaultSettings();
    let raw = null;
    try { raw = this.storage && this.storage.getItem(SETTINGS_STORAGE_KEY); }
    catch (e) { return this.values; }                    // storage blocked entirely
    if (!raw) return this.values;
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { return this.values; }   // not JSON
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return this.values;
    for (const k of Object.keys(SETTINGS_SCHEMA)) {
      if (Object.prototype.hasOwnProperty.call(parsed, k)) this.values[k] = coerceSetting(k, parsed[k]);
    }
    return this.values;
  }

  /* DEBOUNCED, because a slider fires an input event per pixel of travel and localStorage
     writes are synchronous. The value is live immediately; only the write waits. */
  saveSoon(delay = 250) {
    if (this._saveTimer !== null) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => { this._saveTimer = null; this.save(); }, delay);
  }

  save() {
    if (this._saveTimer !== null) { clearTimeout(this._saveTimer); this._saveTimer = null; }
    try { if (this.storage) this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.values)); }
    catch (e) { /* quota, private mode, blocked storage: the session still works */ }
  }

  reset() {
    this.values = defaultSettings();
    for (const k of Object.keys(this.values)) this._emit(k, this.values[k]);
    this.saveSoon();
  }

  // --- Phase 23 hand-off: a flat snapshot in, a validated snapshot out. -------------
  toJSON() { return Object.assign({}, this.values); }
  applyJSON(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(SETTINGS_SCHEMA)) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) this.set(k, obj[k]);
    }
  }

  get graphicsPreset() { return GRAPHICS_PRESETS[this.values.graphicsQuality] || GRAPHICS_PRESETS.high; }
}
