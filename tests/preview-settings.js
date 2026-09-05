/* PHASE 22 — A PREVIEW OF THE SETTINGS PANEL.

   Extracts the REAL #settingsOverlay markup and the REAL stylesheet out of game.html and
   writes them into a standalone page, with the panel forced open and populated from the
   REAL GameSettings defaults. What it shows is exactly the markup and CSS the game ships.

   IT IS NOT A BROWSER SCREENSHOT and no WebGL is involved. It is a static HTML page for
   eyeballing layout, colour and density. Writes tests/renders/settings-panel.html */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { makeWorld } = require('./harness/util.js');
const { S } = makeWorld();
const SRC = fs.readFileSync(path.join(__dirname, '..', 'game.html'), 'utf8');

// The real stylesheet and the real panel markup, lifted verbatim.
const css = SRC.slice(SRC.indexOf('<style>') + 7, SRC.indexOf('</style>'));
const start = SRC.indexOf('<div id="settingsOverlay">');
/* PHASE 28 deleted #tutorialScreen, which used to be the element immediately after the
   settings overlay and therefore this slice's end marker. #winScreen is what follows it
   now; the HTML comment left in the tutorial's place renders nothing. */
const end = SRC.indexOf('<div id="winScreen">');
let panel = SRC.slice(start, end).replace(/<!--[\s\S]*?-->/g, '').trim();
panel = panel.replace('<div id="settingsOverlay">', '<div id="settingsOverlay" class="active">');

// Populate it from the real defaults, the same way syncSettingsUI would.
const GameSettings = vm.runInContext('GameSettings', S);
const s = new GameSettings(null);
const pct = (v) => Math.round(v * 100) + '%';
const set = (id, attr, val) => {
  const re = new RegExp(`(id="${id}"[^>]*)>`);
  panel = panel.replace(re, (m, g1) => `${g1} ${attr}="${val}">`);
};
set('setMaster', 'value', Math.round(s.get('masterVolume') * 100));
set('setMusic', 'value', Math.round(s.get('musicVolume') * 100));
set('setSfx', 'value', Math.round(s.get('sfxVolume') * 100));
set('setSens', 'value', Math.round(s.get('mouseSensitivity') * 100));
const txt = (id, v) => { panel = panel.replace(new RegExp(`(<span class="settings-value" id="${id}">)[^<]*`), `$1${v}`); };
txt('setMasterVal', pct(s.get('masterVolume')));
txt('setMusicVal', pct(s.get('musicVolume')));
txt('setSfxVal', pct(s.get('sfxVolume')));
txt('setSensVal', s.get('mouseSensitivity').toFixed(2) + '&times;');
txt('setQualityVal', s.get('graphicsQuality').toUpperCase());
panel = panel.replace(`<button data-q="high">HIGH</button>`, `<button data-q="high" class="on">HIGH</button>`);

const body = SRC.slice(SRC.indexOf('<body'), SRC.indexOf('<body')) || '';
const bodyStyle = /body\s*\{[^}]*\}/.exec(css);
const out = `<!doctype html><html><head><meta charset="utf-8"><title>Where It Isn't — Settings (Phase 22 preview)</title>
<style>
${css}
/* preview only: a plausible dark world behind the scrim, so the panel is judged in context */
html,body{height:100%;margin:0;}
body{background:
  radial-gradient(ellipse 900px 600px at 50% 40%, #3a4034 0%, #232820 45%, #14170f 100%);}
#settingsOverlay.active{display:flex;}
</style></head><body>
${panel}
</body></html>`;

const dir = path.join(__dirname, 'renders');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'settings-panel.html');
fs.writeFileSync(file, out);
console.log('wrote ' + file);
console.log('Real markup + real stylesheet + real defaults. Static HTML, not a browser render.');
