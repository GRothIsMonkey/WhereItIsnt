"use strict";
/* =====================================================================================
   HOTBAR ITEM ICONS
   ERA 1.5.1 — EXTRACTED VERBATIM FROM game.html.

   Canvas drawing only. Reads ITEM; touches no block, chunk, mesh or gameplay value.

   This is a CLASSIC script, not an ES module. It shares one global lexical scope with
   every other file in src/ and with game.html's inline <script>, which is why the move
   needed no code change. Load order is declared in game.html and mirrored by
   tests/harness/load.js; see ARCHITECTURE.md.
   ===================================================================================== */

/* ---------------------------------------------------------------------------------
   HOTBAR ITEM ICONS (Canvas-drawn mini icons, cached per item type)
   --------------------------------------------------------------------------------- */
const _itemIconCache = new Map();

function getItemIconCanvas(itemId) {
  if (_itemIconCache.has(itemId)) return _itemIconCache.get(itemId);
  const size = 16;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  _drawItemIcon(ctx, itemId, size);
  _itemIconCache.set(itemId, c);
  return c;
}

function _drawItemIcon(ctx, itemId, s) {
  ctx.clearRect(0, 0, s, s);
  switch (itemId) {
    case ITEM.WOOD_PLANK: _iconPlank(ctx, s); break;
    case ITEM.STICK: _iconStick(ctx, s); break;
    case ITEM.COAL: _iconCoal(ctx, s); break;
    case ITEM.TORCH: _iconTorch(ctx, s); break;
    case ITEM.STONE_PICKAXE: _iconPickaxe(ctx, s); break;
    case ITEM.WOODEN_PICKAXE: _iconPickaxe(ctx, s, '#b58a59'); break;
    case ITEM.WOODEN_AXE: _iconAxe(ctx, s, '#b58a59'); break;
    case ITEM.STONE_AXE: _iconAxe(ctx, s, '#9a9a9a'); break;
    case ITEM.IRON_AXE: _iconAxe(ctx, s, '#e2ddd0'); break;
    case ITEM.CORE_DISK: _iconOre(ctx, s, '#0a2a28', '#7effe8'); break;
    case ITEM.SAFEHOUSE_ANCHOR: _iconAnchor(ctx, s); break;
    case ITEM.COBBLESTONE: _iconCobblestone(ctx, s); break;
    case ITEM.OAK_LOG: _iconOakLog(ctx, s); break;
    case ITEM.ASH_LOG: _iconOakLog(ctx, s, '#4c4239', '#2c2620'); break;
    case ITEM.WOODEN_SWORD: _iconSword(ctx, s, '#b58a59', '#8a6238'); break;
    case ITEM.STONE_SWORD: _iconSword(ctx, s, '#b8b8b8', '#777777'); break;
    case ITEM.IRON_INGOT: _iconIngot(ctx, s); break;
    case ITEM.IRON_PICKAXE: _iconIronPickaxe(ctx, s); break;
    case ITEM.IRON_ORE: _iconOre(ctx, s, '#8a8a8a', '#c9a98a'); break;
    case ITEM.BONE: _iconBone(ctx, s); break;
    case ITEM.STRING: _iconString(ctx, s); break;
    case ITEM.OBSIDIAN: _iconOre(ctx, s, '#180a24', '#5a2fae'); break;
    case ITEM.VOID_SHIELD: _iconShield(ctx, s); break;
    case ITEM.BOW: _iconBow(ctx, s); break;
    case ITEM.ARROW: _iconArrow(ctx, s); break;
    case ITEM.IRON_SWORD: _iconSword(ctx, s, '#e2ddd0', '#a8a196'); break;
    case ITEM.TREASURE_CHEST: _iconChest(ctx, s); break;
    case ITEM.CORRUPTED_STONE_ITEM: _iconOre(ctx, s, '#3a1030', '#8a3a6a'); break;
    case ITEM.CORE_DISK_L2: _iconOre(ctx, s, '#241238', '#b98cff'); break;
    case ITEM.LANTERN: _iconLantern(ctx, s); break;
    case ITEM.SOUL_ANCHOR: _iconSoulAnchor(ctx, s); break;
    case ITEM.CORE_DISK_L3: _iconOre(ctx, s, '#3a341a', '#ffe066'); break;
    default: _iconGeneric(ctx, s, itemId);
  }
}

function _iconGeneric(ctx, s, itemId) {
  const data = ITEM_DATA[itemId];
  ctx.fillStyle = data ? data.color : '#333333';
  ctx.fillRect(1, 1, s - 2, s - 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, s - 2, s - 2);
}

function _iconPlank(ctx, s) {
  ctx.fillStyle = '#b58a59';
  ctx.fillRect(1, 1, s - 2, s - 2);
  ctx.strokeStyle = '#8a6238';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const y = Math.round((i * (s - 2)) / 4) + 1 + 0.5;
    ctx.beginPath();
    ctx.moveTo(1, y);
    ctx.lineTo(s - 1, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#6b4a28';
  ctx.strokeRect(1, 1, s - 2, s - 2);
}

function _iconStick(ctx, s) {
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = '#a07040';
  ctx.fillRect(-s * 0.45, -s * 0.12, s * 0.9, s * 0.24);
  ctx.strokeStyle = '#5c3d1f';
  ctx.lineWidth = 1;
  ctx.strokeRect(-s * 0.45, -s * 0.12, s * 0.9, s * 0.24);
  ctx.restore();
}

function _iconCoal(ctx, s) {
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.moveTo(s * 0.2, s * 0.3);
  ctx.lineTo(s * 0.5, s * 0.1);
  ctx.lineTo(s * 0.85, s * 0.28);
  ctx.lineTo(s * 0.9, s * 0.65);
  ctx.lineTo(s * 0.6, s * 0.9);
  ctx.lineTo(s * 0.15, s * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#161616';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath(); ctx.arc(s * 0.4, s * 0.45, s * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.62, s * 0.58, s * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.5, s * 0.3, s * 0.05, 0, Math.PI * 2); ctx.fill();
}

function _iconTorch(ctx, s) {
  ctx.fillStyle = '#7a5636';
  ctx.fillRect(s * 0.42, s * 0.38, s * 0.16, s * 0.55);
  ctx.strokeStyle = '#4a2f18';
  ctx.lineWidth = 1;
  ctx.strokeRect(s * 0.42, s * 0.38, s * 0.16, s * 0.55);
  const grad = ctx.createRadialGradient(s * 0.5, s * 0.28, 1, s * 0.5, s * 0.28, s * 0.24);
  grad.addColorStop(0, '#fff3b0');
  grad.addColorStop(0.55, '#ffb347');
  grad.addColorStop(1, '#ff7a1a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.25, s * 0.19, s * 0.23, 0, 0, Math.PI * 2);
  ctx.fill();
}

function _iconPickaxe(ctx, s, headColor) {
  ctx.save();
  ctx.translate(s * 0.42, s * 0.62);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#8a6238';
  ctx.fillRect(-s * 0.08, -s * 0.42, s * 0.16, s * 0.8);
  ctx.strokeStyle = '#5c3d1f';
  ctx.lineWidth = 1;
  ctx.strokeRect(-s * 0.08, -s * 0.42, s * 0.16, s * 0.8);
  ctx.restore();
  ctx.strokeStyle = headColor || '#9a9a9a';
  ctx.lineWidth = s * 0.18;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.34, s * 0.32, Math.PI * 0.85, Math.PI * 1.95);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function _iconAxe(ctx, s, headColor) {
  ctx.save();
  ctx.translate(s * 0.42, s * 0.62);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#8a6238';
  ctx.fillRect(-s * 0.08, -s * 0.42, s * 0.16, s * 0.8);
  ctx.strokeStyle = '#5c3d1f';
  ctx.lineWidth = 1;
  ctx.strokeRect(-s * 0.08, -s * 0.42, s * 0.16, s * 0.8);
  ctx.restore();
  ctx.fillStyle = headColor || '#9a9a9a';
  ctx.beginPath();
  ctx.moveTo(s * 0.24, s * 0.18);
  ctx.quadraticCurveTo(s * 0.05, s * 0.28, s * 0.22, s * 0.46);
  ctx.lineTo(s * 0.40, s * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function _iconAnchor(ctx, s) {
  const grad = ctx.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0, '#3fa0ff');
  grad.addColorStop(1, '#ffcf6b');
  ctx.fillStyle = grad;
  ctx.fillRect(s * 0.15, s * 0.15, s * 0.7, s * 0.7);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(s * 0.15, s * 0.15, s * 0.7, s * 0.7);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.5, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function _iconCobblestone(ctx, s) {
  ctx.fillStyle = '#737373';
  ctx.fillRect(1, 1, s - 2, s - 2);
  ctx.fillStyle = '#5c5c5c';
  ctx.fillRect(2, 2, s * 0.35, s * 0.35);
  ctx.fillRect(s * 0.55, s * 0.15, s * 0.3, s * 0.3);
  ctx.fillRect(s * 0.2, s * 0.55, s * 0.3, s * 0.3);
  ctx.fillRect(s * 0.6, s * 0.6, s * 0.3, s * 0.3);
  ctx.strokeStyle = '#404040';
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, s - 2, s - 2);
}

/* PHASE 35 — the two colours are parameters so an Ash Log reuses the log drawing rather
   than adding a second near-identical one. Oak's values are the defaults, so every
   existing call site is unchanged. */
function _iconOakLog(ctx, s, bark, grain) {
  ctx.fillStyle = bark || '#6e4a28';
  ctx.fillRect(1, 1, s - 2, s - 2);
  ctx.strokeStyle = grain || '#4a2f18';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const x = 2 + i * ((s - 4) / 3) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 1);
    ctx.lineTo(x, s - 1);
    ctx.stroke();
  }
  ctx.strokeRect(1, 1, s - 2, s - 2);
}

function _iconSword(ctx, s, bladeColor, edgeColor) {
  ctx.save();
  ctx.translate(s * 0.5, s * 0.5);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = bladeColor;
  ctx.fillRect(-s * 0.08, -s * 0.42, s * 0.16, s * 0.62);
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(-s * 0.08, -s * 0.42, s * 0.16, s * 0.62);
  ctx.fillStyle = '#5c3d1f';
  ctx.fillRect(-s * 0.14, s * 0.18, s * 0.28, s * 0.07);
  ctx.fillStyle = '#3a2410';
  ctx.fillRect(-s * 0.055, s * 0.24, s * 0.11, s * 0.2);
  ctx.restore();
}

function _iconIngot(ctx, s) {
  ctx.fillStyle = '#e2ddd0';
  ctx.beginPath();
  ctx.moveTo(s * 0.18, s * 0.35); ctx.lineTo(s * 0.32, s * 0.22); ctx.lineTo(s * 0.68, s * 0.22);
  ctx.lineTo(s * 0.82, s * 0.35); ctx.lineTo(s * 0.82, s * 0.68); ctx.lineTo(s * 0.68, s * 0.78);
  ctx.lineTo(s * 0.32, s * 0.78); ctx.lineTo(s * 0.18, s * 0.68); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#a8a196'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.moveTo(s * 0.28, s * 0.4); ctx.lineTo(s * 0.72, s * 0.4); ctx.stroke();
}

function _iconIronPickaxe(ctx, s) {
  ctx.save();
  ctx.translate(s * 0.42, s * 0.62);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#8a6238';
  ctx.fillRect(-s * 0.08, -s * 0.42, s * 0.16, s * 0.8);
  ctx.restore();
  ctx.strokeStyle = '#e2ddd0';
  ctx.lineWidth = s * 0.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.34, s * 0.32, Math.PI * 0.85, Math.PI * 1.95);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function _iconOre(ctx, s, base, fleck) {
  ctx.fillStyle = base;
  ctx.fillRect(1, 1, s - 2, s - 2);
  ctx.fillStyle = fleck;
  ctx.fillRect(s * 0.2, s * 0.2, s * 0.2, s * 0.2);
  ctx.fillRect(s * 0.6, s * 0.15, s * 0.2, s * 0.2);
  ctx.fillRect(s * 0.35, s * 0.55, s * 0.2, s * 0.2);
  ctx.fillRect(s * 0.65, s * 0.6, s * 0.15, s * 0.2);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(1, 1, s - 2, s - 2);
}

function _iconBone(ctx, s) {
  ctx.save();
  ctx.translate(s * 0.5, s * 0.5);
  ctx.rotate(-Math.PI / 5);
  ctx.fillStyle = '#e8e2c8';
  ctx.fillRect(-s * 0.35, -s * 0.08, s * 0.7, s * 0.16);
  ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.09, s * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-s * 0.35, s * 0.09, s * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.35, -s * 0.09, s * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.35, s * 0.09, s * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function _iconString(ctx, s) {
  ctx.strokeStyle = '#dedede';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s * 0.15, s * 0.2);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    ctx.lineTo(s * 0.15 + t * s * 0.7, s * 0.2 + t * s * 0.6 + Math.sin(t * Math.PI * 4) * s * 0.06);
  }
  ctx.stroke();
}

function _iconShield(ctx, s) {
  ctx.fillStyle = '#3fc8ff';
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.12); ctx.lineTo(s * 0.85, s * 0.28); ctx.lineTo(s * 0.85, s * 0.55);
  ctx.quadraticCurveTo(s * 0.85, s * 0.82, s * 0.5, s * 0.92);
  ctx.quadraticCurveTo(s * 0.15, s * 0.82, s * 0.15, s * 0.55);
  ctx.lineTo(s * 0.15, s * 0.28); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
}

function _iconBow(ctx, s) {
  ctx.strokeStyle = '#8a6238';
  ctx.lineWidth = s * 0.1;
  ctx.beginPath();
  ctx.arc(s * 0.3, s * 0.5, s * 0.36, -Math.PI * 0.38, Math.PI * 0.38);
  ctx.stroke();
  ctx.strokeStyle = '#dedede';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(s * 0.42, s * 0.18);
  ctx.lineTo(s * 0.42, s * 0.82);
  ctx.stroke();
}

function _iconArrow(ctx, s) {
  ctx.save();
  ctx.translate(s * 0.5, s * 0.5);
  ctx.rotate(-Math.PI / 4);
  ctx.strokeStyle = '#c9a98a';
  ctx.lineWidth = s * 0.08;
  ctx.beginPath(); ctx.moveTo(-s * 0.4, 0); ctx.lineTo(s * 0.32, 0); ctx.stroke();
  ctx.fillStyle = '#8a8a8a';
  ctx.beginPath();
  ctx.moveTo(s * 0.32, -s * 0.1); ctx.lineTo(s * 0.46, 0); ctx.lineTo(s * 0.32, s * 0.1);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#dedede';
  ctx.beginPath();
  ctx.moveTo(-s * 0.4, 0); ctx.lineTo(-s * 0.3, -s * 0.1); ctx.lineTo(-s * 0.3, s * 0.1); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function _iconLantern(ctx, s) {
  ctx.strokeStyle = '#4a4038'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(s * 0.5, s * 0.06); ctx.lineTo(s * 0.5, s * 0.18); ctx.stroke();
  ctx.fillStyle = '#8a7a58';
  ctx.fillRect(s * 0.3, s * 0.16, s * 0.4, s * 0.08);
  const grad = ctx.createRadialGradient(s * 0.5, s * 0.5, 1, s * 0.5, s * 0.5, s * 0.32);
  grad.addColorStop(0, '#fff6d8');
  grad.addColorStop(0.55, '#FFCC66');
  grad.addColorStop(1, '#c98a2a');
  ctx.fillStyle = grad;
  ctx.fillRect(s * 0.24, s * 0.24, s * 0.52, s * 0.52);
  ctx.strokeStyle = '#7a5636'; ctx.lineWidth = 1;
  ctx.strokeRect(s * 0.24, s * 0.24, s * 0.52, s * 0.52);
  ctx.fillStyle = '#8a7a58';
  ctx.fillRect(s * 0.3, s * 0.76, s * 0.4, s * 0.08);
}

function _iconSoulAnchor(ctx, s) {
  ctx.fillStyle = '#2a2035';
  ctx.fillRect(s * 0.2, s * 0.2, s * 0.6, s * 0.6);
  ctx.strokeStyle = '#160f1c'; ctx.lineWidth = 1;
  ctx.strokeRect(s * 0.2, s * 0.2, s * 0.6, s * 0.6);
  const grad = ctx.createRadialGradient(s * 0.5, s * 0.5, 1, s * 0.5, s * 0.5, s * 0.3);
  grad.addColorStop(0, '#e0fff8');
  grad.addColorStop(0.5, '#5be0c8');
  grad.addColorStop(1, 'rgba(91,224,200,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.5, s * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function _iconChest(ctx, s) {
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(s * 0.14, s * 0.36, s * 0.72, s * 0.46);
  ctx.strokeStyle = '#2f2010'; ctx.lineWidth = 1;
  ctx.strokeRect(s * 0.14, s * 0.36, s * 0.72, s * 0.46);
  ctx.fillStyle = '#7a5028';
  ctx.fillRect(s * 0.14, s * 0.22, s * 0.72, s * 0.16);
  ctx.strokeRect(s * 0.14, s * 0.22, s * 0.72, s * 0.16);
  ctx.fillStyle = '#ffcf6b';
  ctx.fillRect(s * 0.46, s * 0.42, s * 0.08, s * 0.1);
}
