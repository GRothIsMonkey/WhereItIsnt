/* Offline harness: loads the <script> body of game.html into a Node VM with a
   minimal DOM/WebGL stub, and returns the module scope so tests can reach into
   VoxelWorld and the Farmlands generator directly. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const THREE = require('three');

const SCRATCH = path.join(__dirname, '..');

function stubCanvas(w, h) {
  const px = new Uint8ClampedArray(Math.max(1, (w || 1) * (h || 1) * 4));
  const ctx = {
    canvas: null,
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
    font: '', textAlign: '', textBaseline: '', globalCompositeOperation: 'source-over',
    shadowBlur: 0, shadowColor: '',
    save(){}, restore(){}, beginPath(){}, closePath(){}, moveTo(){}, lineTo(){},
    arc(){}, ellipse(){}, rect(){}, fill(){}, stroke(){}, clip(){},
    fillRect(){}, strokeRect(){}, clearRect(){}, fillText(){}, strokeText(){},
    translate(){}, rotate(){}, scale(){}, setTransform(){}, drawImage(){},
    quadraticCurveTo(){}, bezierCurveTo(){},
    createLinearGradient(){ return { addColorStop(){} }; },
    createRadialGradient(){ return { addColorStop(){} }; },
    createPattern(){ return null; },
    measureText(){ return { width: 0 }; },
    getImageData(x, y, ww, hh) {
      return { width: ww, height: hh, data: new Uint8ClampedArray(Math.max(1, ww * hh * 4)) };
    },
    putImageData(){},
    createImageData(ww, hh) {
      return { width: ww, height: hh, data: new Uint8ClampedArray(Math.max(1, ww * hh * 4)) };
    },
  };
  const c = {
    width: w || 300, height: h || 150, style: {},
    getContext(kind) { if (kind === '2d') return ctx; return null; },
    toDataURL() { return 'data:,'; },
    addEventListener(){}, removeEventListener(){},
    getBoundingClientRect(){ return { left:0, top:0, width:this.width, height:this.height }; },
    requestPointerLock(){},
    offsetWidth: w || 300, offsetHeight: h || 150,
  };
  ctx.canvas = c;
  return c;
}

function stubElement(tag) {
  if (tag === 'canvas') return stubCanvas(300, 150);
  const el = {
    tagName: String(tag).toUpperCase(), style: {}, dataset: {}, children: [],
    className: '', id: '', textContent: '', innerHTML: '', value: '',
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(c){ this.children.push(c); return c; },
    removeChild(c){ return c; }, insertBefore(c){ this.children.push(c); return c; },
    setAttribute(){}, getAttribute(){ return null; }, removeAttribute(){},
    addEventListener(){}, removeEventListener(){}, focus(){}, blur(){}, click(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    getBoundingClientRect(){ return { left:0, top:0, width:0, height:0 }; },
    getContext(){ return null; },
    remove(){},
  };
  return el;
}

function load(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const lines = html.split('\n');
  // The single inline <script> body: everything between the tag on line 541 and </script>.
  let start = -1, end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (start < 0 && /^<script>\s*$/.test(lines[i])) { start = i + 1; continue; }
    if (start >= 0 && /^<\/script>\s*$/.test(lines[i])) { end = i; break; }
  }
  if (start < 0 || end < 0) throw new Error('could not locate the inline <script> body');
  const src = lines.slice(start, end).join('\n');

  const elements = new Map();
  const doc = {
    body: stubElement('body'),
    documentElement: stubElement('html'),
    createElement: stubElement,
    createElementNS: (ns, t) => stubElement(t),
    getElementById(id) {
      if (!elements.has(id)) { const e = stubElement('div'); e.id = id; elements.set(id, e); }
      return elements.get(id);
    },
    querySelector(){ return stubElement('div'); },
    querySelectorAll(){ return []; },
    addEventListener(){}, removeEventListener(){},
    exitPointerLock(){}, pointerLockElement: null,
    hidden: false, visibilityState: 'visible',
  };

  const sandbox = {
    THREE, console, Math, JSON, Date, Number, String, Boolean, Array, Object,
    Map, Set, WeakMap, WeakSet, Promise, Symbol, Error, TypeError, RangeError,
    Uint8Array, Uint8ClampedArray, Int8Array, Uint16Array, Int16Array,
    Uint32Array, Int32Array, Float32Array, Float64Array, ArrayBuffer, DataView,
    isNaN, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    setTimeout, clearTimeout, setInterval, clearInterval,
    performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    document: doc,
    navigator: { userAgent: 'node', language: 'en' },
    localStorage: {
      _m: new Map(),
      getItem(k){ return this._m.has(k) ? this._m.get(k) : null; },
      setItem(k, v){ this._m.set(k, String(v)); },
      removeItem(k){ this._m.delete(k); },
      clear(){ this._m.clear(); },
    },
    AudioContext: function () {
      throw new Error('audio disabled in harness');
    },
    Image: function () { return { addEventListener(){}, src: '' }; },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.addEventListener = () => {};
  sandbox.window.removeEventListener = () => {};
  sandbox.window.innerWidth = 1280;
  sandbox.window.innerHeight = 720;
  sandbox.window.devicePixelRatio = 1;
  sandbox.webkitAudioContext = sandbox.AudioContext;

  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'game.html:script', lineOffset: start });
  return sandbox;
}

module.exports = { load, SCRATCH, THREE };
