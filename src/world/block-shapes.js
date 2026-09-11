"use strict";
/* =====================================================================================
   THE SUB-VOXEL SHAPE SYSTEM — WHAT A BLOCK LOOKS LIKE
   ERA 1.5.2 — EXTRACTED VERBATIM FROM game.html.

   Pure geometry. Shape primitives are flattened once at load into flat quad arrays, and
   the mesher then walks pre-computed floats with no branching and no allocation.

   Depends only on BLOCK_ID_COUNT, which is why block-catalog.js loads first.

   ERA 2 REPLACES THIS WHOLE FILE. It is the clearest example in the build of geometry
   that only exists because the world is made of voxels.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md and src/world/LAYER.md.
   ===================================================================================== */

/* =====================================================================================
   PHASE 13 — SUB-VOXEL SHAPE SYSTEM

   WHY THIS EXISTS. Static Suburbia was built entirely out of full cubes, and no amount
   of texturing fixes that: a gable made of cubes is a staircase, a kerb made of cubes
   is a wall, and a lamp post made of cubes is a pillar. This phase adds real sub-voxel
   geometry — slabs, quarter pieces, stair treads, angled roof planes, ridge prisms,
   thin walls, poles, rails, trim — WITHOUT touching chunk storage, streaming, editing
   or persistence.

   HOW IT WORKS. A shaped block is still one byte in chunk.data. What changes is only
   what the mesher draws for it. Each shape is authored once, at load, as a short list
   of primitives:

       ['box',   tile, x0,y0,z0, x1,y1,z1]
       ['wedge', tile, x0,y0,z0, x1,y1,z1, axis, dir]   // one genuine sloped plane
       ['prism', tile, x0,y0,z0, x1,y1,z1, axis]        // symmetric ridge cap

   ...and is then FLATTENED ONCE into a plain array of quads (position/normal/uv/shade
   per corner, plus a cull tag). Meshing a shaped block at run time is a flat loop over
   pre-computed floats with no branching, no allocation and no geometry construction —
   the same per-quad cost as the cube path it sits beside, which is what keeps an
   infinite suburb inside the Phase 11 frame budget.

   FACE CULLING. Two mechanisms, both precomputed:
     FACE_COVER[id*6 + face] — a 4x4 bitmask of the quarter-cells this block's material
       fully covers on that cell face. A full opaque cube is 0xFFFF; air/glass is 0. A
       quad is dropped when the neighbour's opposing mask covers everything the quad
       touches. This generalises the old "neighbour is solid" test and resolves to one
       flat typed-array lookup plus an AND — cheaper than the Set.has() it replaces.
     SHAPE_TILES[id][axis] — true when the shape's opposing faces along that axis are
       geometrically identical, so a RUN of the same piece (a kerb line, a sidewalk, a
       roof plane, a fence) drops every internal face. This is the single biggest quad
       saving in the suburb, and it is why the rebuilt streets cost LESS than the cubes
       they replaced rather than more.

   COLLISION. SHAPE_AABB[id] holds the shape's solid boxes. isSolid() is unchanged (a
   shaped block is still a block for mining, raycasting and light), but the player and
   dropped items test against the real boxes, so a kerb is a step and a railing is
   knee-high instead of both being full cubes.
   ===================================================================================== */

// Face order matches the FACES table below: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z.
const SHAPE_FACE_OPPOSITE = [1, 0, 3, 2, 5, 4];
const _SHP_FACE_AXIS = [0, 0, 1, 1, 2, 2];

/* Corner layouts identical to the legacy FACES table, so winding (and therefore
   backface culling) matches between cube faces and shape faces exactly. */
const _SHP_FACE_CORNERS = [
  [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], // +x
  [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], // -x
  [[0,1,0],[0,1,1],[1,1,1],[1,1,0]], // +y
  [[0,0,1],[0,0,0],[1,0,0],[1,0,1]], // -y
  [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], // +z
  [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], // -z
];
const _SHP_FACE_NORMAL = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

/* Per-face (s,t) extraction, derived from the legacy cube UV order, so a slab of
   siding and the full siding cube above it show one continuous correctly-scaled
   texture instead of a squashed copy each. */
function _shpUV(face, x, y, z) {
  switch (face) {
    case 0: return [z, y];
    case 1: return [1 - z, y];
    case 2: return [x, z];
    case 3: return [x, 1 - z];
    case 4: return [1 - x, y];
    default: return [x, y];
  }
}

/* Directional shading, matching the cube path (top 1.0, bottom 0.55, sides 0.78) and
   interpolated for sloped normals, so a roof plane reads between a wall and a ceiling
   rather than snapping to one of them. */
function _shpShade(ny) { return ny >= 0 ? 0.78 + 0.22 * ny : 0.78 + 0.23 * ny; }

// Plane coordinates of a local point on `face`, in the SHARED frame both sides of a
// cell boundary agree on.
function _shpPlaneCoords(face, x, y, z) {
  if (face === 0 || face === 1) return [z, y];
  if (face === 2 || face === 3) return [x, z];
  return [x, y];
}

/* Which of the 16 quarter-cells on a face a rectangle spans. `full` picks between
   "every quarter-cell it touches at all" (a quad's own footprint) and "every
   quarter-cell it completely contains" (coverage). Under-claiming coverage costs a
   hidden quad; over-claiming would punch a visible hole, so coverage is conservative. */
function _shpRectMask(a0, b0, a1, b1, full) {
  let m = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const lo0 = c * 0.25, hi0 = lo0 + 0.25, lo1 = r * 0.25, hi1 = lo1 + 0.25;
      const ok = full
        ? (a0 <= lo0 + 1e-6 && a1 >= hi0 - 1e-6 && b0 <= lo1 + 1e-6 && b1 >= hi1 - 1e-6)
        : (a1 > lo0 + 1e-6 && a0 < hi0 - 1e-6 && b1 > lo1 + 1e-6 && b0 < hi1 - 1e-6);
      if (ok) m |= (1 << (r * 4 + c));
    }
  }
  return m;
}

/* Pushes one quad, auto-correcting its winding against the intended normal. Doing the
   orientation numerically rather than by hand is what makes wedges and ridge prisms
   safe to author: a mis-ordered corner list can no longer produce an invisible face.
   Triangles are passed as degenerate quads (last corner repeated) so the shared
   index-buffer pattern is untouched. */
function _shpPush(out, tile, pts, nrm, cull, uvFace) {
  let gn = null;
  for (let i = 0; i < 4 && !gn; i++) {
    const a = pts[i], b = pts[(i + 1) & 3], c = pts[(i + 2) & 3];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - b[0], vy = c[1] - b[1], vz = c[2] - b[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz);
    if (L > 1e-9) gn = [nx / L, ny / L, nz / L];
  }
  if (!gn) return;  // fully degenerate — nothing to draw
  if (gn[0] * nrm[0] + gn[1] * nrm[1] + gn[2] * nrm[2] < 0) pts = [pts[3], pts[2], pts[1], pts[0]];

  const p = [], uv = [];
  for (const q of pts) {
    p.push(q[0], q[1], q[2]);
    const st = _shpUV(uvFace, q[0], q[1], q[2]);
    uv.push(st[0], st[1]);
  }
  let mask = 0xFFFF;
  if (cull >= 0) {
    let a0 = 9, b0 = 9, a1 = -9, b1 = -9;
    for (const q of pts) {
      const pc = _shpPlaneCoords(cull, q[0], q[1], q[2]);
      a0 = Math.min(a0, pc[0]); a1 = Math.max(a1, pc[0]);
      b0 = Math.min(b0, pc[1]); b1 = Math.max(b1, pc[1]);
    }
    mask = _shpRectMask(a0, b0, a1, b1, false);
  }
  out.push({ p, n: nrm, uv, tile, shade: _shpShade(nrm[1]), cull, mask });
}

// BOX — the workhorse: slabs, thin walls, poles, trim, panels, sills, treads.
function _shpEmitBox(out, tile, x0, y0, z0, x1, y1, z1, skip) {
  /* PHASE 14 — `skip` is a per-face suppression mask. The furniture compiler slices a
     model's boxes onto the voxel grid and flags every face that exists only because of
     the cut, so a two-cell sofa draws as one sofa: no seam, and not one wasted quad
     buried inside the object.

     The edge tests are also now TWO-SIDED. A cull tag is only meaningful for a face lying
     exactly on a cell boundary, and Phase 14 introduces primitives that legitimately
     reach outside the cell (a door leaf swinging into a hall). The old one-sided test
     read a coordinate of -0.32 as "on the low edge" and would have culled a face that is
     nowhere near a boundary. Every Phase 13 shape lives inside [0,1] and is unaffected. */
  skip = skip || 0;
  const on = _shpOnEdge(x0, y0, z0, x1, y1, z1);
  for (let f = 0; f < 6; f++) {
    if (skip & (1 << f)) continue;
    const pts = _SHP_FACE_CORNERS[f].map(c => [c[0] ? x1 : x0, c[1] ? y1 : y0, c[2] ? z1 : z0]);
    _shpPush(out, tile, pts, _SHP_FACE_NORMAL[f], on[f] ? f : -1, f);
  }
}

// Which of a box's six faces lie exactly on a cell boundary.
function _shpOnEdge(x0, y0, z0, x1, y1, z1) {
  const E = 1e-6;
  return [Math.abs(x1 - 1) < E, Math.abs(x0) < E, Math.abs(y1 - 1) < E,
          Math.abs(y0) < E, Math.abs(z1 - 1) < E, Math.abs(z0) < E];
}

/* PLANE — a genuine sloped surface, not a stack of steps. The top is defined by four
   corner heights (h00 at (x0,z0), h10 at (x1,z0), h01 at (x0,z1), h11 at (x1,z1)) and
   the solid fills down to y0. One primitive covers every roof plane in the suburb: a
   straight slope has two pairs of equal heights, a hip corner has a single raised
   corner, a kerb ramp is a shallow version of the same thing. Side faces collapse to
   triangles automatically wherever a corner meets the floor. */
function _shpEmitPlane(out, tile, x0, y0, z0, x1, z1, h00, h10, h01, h11, skip) {
  skip = skip || 0;   // bit 1 = skip -z side, 2 = +z, 4 = -x, 8 = +x, 16 = underside
  const P = (x, z, h) => [x, h, z];

  // Top surface. Normal taken from the h00/h10/h01 triangle, which is the plane the
  // roof is actually built on.
  const ux = x1 - x0, uz = z1 - z0;
  const nx = -(h10 - h00) * uz, ny = ux * uz, nz = -(h01 - h00) * ux;
  const nl = Math.hypot(nx, ny, nz) || 1;
  _shpPush(out, tile, [P(x0, z0, h00), P(x1, z0, h10), P(x1, z1, h11), P(x0, z1, h01)],
           [nx / nl, ny / nl, nz / nl], -1, 2);

  // Underside.
  if (!(skip & 16)) {
    _shpPush(out, tile, [P(x0, z0, y0), P(x1, z0, y0), P(x1, z1, y0), P(x0, z1, y0)],
             [0, -1, 0], y0 <= 1e-6 ? 3 : -1, 3);
  }
  /* Four sides. Each is a quad from the floor up to two corner heights; where both
     heights sit on the floor the quad is fully degenerate and _shpPush drops it, which
     is what turns a straight slope's ends into clean triangles with no extra code. */
  if (!(skip & 1))
    _shpPush(out, tile, [P(x0, z0, y0), P(x0, z0, h00), P(x1, z0, h10), P(x1, z0, y0)],
             [0, 0, -1], z0 <= 1e-6 ? 5 : -1, 5);
  if (!(skip & 2))
    _shpPush(out, tile, [P(x0, z1, y0), P(x0, z1, h01), P(x1, z1, h11), P(x1, z1, y0)],
             [0, 0, 1], z1 >= 1 - 1e-6 ? 4 : -1, 4);
  if (!(skip & 4))
    _shpPush(out, tile, [P(x0, z0, y0), P(x0, z0, h00), P(x0, z1, h01), P(x0, z1, y0)],
             [-1, 0, 0], x0 <= 1e-6 ? 1 : -1, 1);
  if (!(skip & 8))
    _shpPush(out, tile, [P(x1, z0, y0), P(x1, z0, h10), P(x1, z1, h11), P(x1, z1, y0)],
             [1, 0, 0], x1 >= 1 - 1e-6 ? 0 : -1, 0);
}

/* PRISM — a symmetric ridge cap rising from both edges to a centre line along `axis`.
   Roof ridges and the clipped tops of hedges. Two planes with the inner faces
   suppressed: they meet at the ridge and would be pure hidden geometry. */
function _shpEmitPrism(out, tile, x0, y0, z0, x1, z1, axis, hEdge, hPeak) {
  if (axis === 'x') {           // ridge line runs along X, so the roof slopes across Z
    const m = (z0 + z1) / 2;
    _shpEmitPlane(out, tile, x0, y0, z0, x1, m, hEdge, hEdge, hPeak, hPeak, 2);
    _shpEmitPlane(out, tile, x0, y0, m, x1, z1, hPeak, hPeak, hEdge, hEdge, 1 | 16);
  } else {                      // ridge along Z, slopes across X
    const m = (x0 + x1) / 2;
    _shpEmitPlane(out, tile, x0, y0, z0, m, z1, hEdge, hPeak, hEdge, hPeak, 8);
    _shpEmitPlane(out, tile, m, y0, z0, x1, z1, hPeak, hEdge, hPeak, hEdge, 4 | 16);
  }
}

/* -------------------------------------------------------------------------------------
   SHAPE REGISTRY. SUB_SHAPE_DEF is authored further down (see the SUB_SHAPES block);
   everything here is the machinery that turns it into flat run-time tables.

     SUB_SHAPE_DEF[id] = {
       parts:   [primitive, ...],        // opaque geometry
       glass:   [primitive, ...],        // routed to the transparent window pass
       collide: [[x0,y0,z0,x1,y1,z1]],   // optional override of the derived boxes
       noclip:  true,                    // decorative only (gutters, wires, doormats)
       light:   true                     // thin enough not to cast a skylight column
     }
   ------------------------------------------------------------------------------------- */
/* Full cubes that must NOT cast a skylight column. buildShapeTables sets LIGHT_PASSABLE
   from the shape table, and a full cube has no shape entry, so anything here is applied
   afterwards — the same exception LEAVES already gets, expressed as a list so a later
   phase adding a translucent cube does not have to find that one line. */
const LIGHT_PASSABLE_LATE = [];

const SUB_SHAPE_DEF = {};
const SHAPE_QUADS = new Array(BLOCK_ID_COUNT).fill(null);
const SHAPE_GLASS_QUADS = new Array(BLOCK_ID_COUNT).fill(null);
const SHAPE_AABB = new Array(BLOCK_ID_COUNT).fill(null);
/* Geometric bounds used by the block raycaster. Kept separate from SHAPE_AABB so a
   decorative, non-colliding piece (a gutter, a cable, a doormat) can still be aimed
   at and mined even though the player walks straight through it. */
const SHAPE_PICK = new Array(BLOCK_ID_COUNT).fill(null);
const SHAPE_TILES = new Array(BLOCK_ID_COUNT).fill(null);
const FACE_COVER = new Uint16Array(BLOCK_ID_COUNT * 6);
const LIGHT_PASSABLE = new Uint8Array(BLOCK_ID_COUNT);   // 1 = a skylight column passes through

function _shpPrimBoxes(list, into) {
  for (const prim of list) into.push([prim[2], prim[3], prim[4], prim[5], prim[6], prim[7]]);
}

/* Every primitive tuple shares one layout, so the collision, bounds and run-tiling
   passes below can read x0,y0,z0,x1,y1,z1 out of any of them without caring which kind
   it is:
     ['box',   tile, x0,y0,z0, x1,y1,z1]
     ['plane', tile, x0,y0,z0, x1,y1,z1, h00,h10,h01,h11, skipMask]
     ['prism', tile, x0,y0,z0, x1,y1,z1, axis, hEdge, hPeak]                        */
function _shpExpand(list, out) {
  for (const prim of list) {
    const k = prim[0], tile = prim[1];
    if (k === 'box') _shpEmitBox(out, tile, prim[2], prim[3], prim[4], prim[5], prim[6], prim[7], prim[8]);
    else if (k === 'plane') _shpEmitPlane(out, tile, prim[2], prim[3], prim[4], prim[5], prim[7], prim[8], prim[9], prim[10], prim[11], prim[12]);
    else if (k === 'prism') _shpEmitPrism(out, tile, prim[2], prim[3], prim[4], prim[5], prim[7], prim[8], prim[9], prim[10]);
  }
}

/* Builds every run-time table. Called once at load, right after the shapes are
   authored, so nothing here is computed per frame or per chunk. */
function buildShapeTables() {
  // Baseline: every non-air, non-special block is a full opaque cube.
  for (let id = 0; id < BLOCK_ID_COUNT; id++) {
    const opaque = id !== BLOCK.AIR && !SPECIAL_RENDER_BLOCKS.has(id);
    for (let f = 0; f < 6; f++) FACE_COVER[id * 6 + f] = opaque ? 0xFFFF : 0;
    LIGHT_PASSABLE[id] = opaque ? 0 : 1;
  }
  LIGHT_PASSABLE[BLOCK.LEAVES] = 1;

  for (const key in SUB_SHAPE_DEF) {
    const id = key | 0;
    const def = SUB_SHAPE_DEF[id];
    const quads = [], gquads = [], boxes = [];
    _shpExpand(def.parts || [], quads);
    _shpPrimBoxes(def.parts || [], boxes);
    if (def.glass) { _shpExpand(def.glass, gquads); _shpPrimBoxes(def.glass, boxes); }

    SHAPE_QUADS[id] = quads;
    SHAPE_GLASS_QUADS[id] = gquads.length ? gquads : null;
    SHAPE_AABB[id] = def.noclip ? [] : (def.collide || boxes);
    SHAPE_PICK[id] = boxes;
    LIGHT_PASSABLE[id] = def.light === true ? 1 : 0;

    // Coverage: only full box faces sitting exactly on a cell boundary contribute.
    for (let f = 0; f < 6; f++) FACE_COVER[id * 6 + f] = 0;
    for (const b of (def.parts || [])) {
      if (b[0] !== 'box') continue;
      const x0 = b[2], y0 = b[3], z0 = b[4], x1 = b[5], y1 = b[6], z1 = b[7];
      // Two-sided, for the same reason _shpEmitBox is: a primitive that overhangs the
      // cell must not claim to cover the boundary it overhangs.
      const on = _shpOnEdge(x0, y0, z0, x1, y1, z1);
      for (let f = 0; f < 6; f++) {
        if (!on[f]) continue;
        const a = _shpPlaneCoords(f, x0, y0, z0), c = _shpPlaneCoords(f, x1, y1, z1);
        FACE_COVER[id * 6 + f] |= _shpRectMask(Math.min(a[0], c[0]), Math.min(a[1], c[1]),
                                               Math.max(a[0], c[0]), Math.max(a[1], c[1]), true);
      }
    }

    /* Run tiling. If every primitive spans the full cell along an axis and none of
       them slopes on that axis, two neighbouring copies present identical opposing
       faces and every internal face can be dropped. */
    const tiles = [true, true, true];
    const all = (def.parts || []).concat(def.glass || []);
    for (const prim of all) {
      if (!(prim[2] <= 1e-6 && prim[5] >= 1 - 1e-6)) tiles[0] = false;
      if (!(prim[3] <= 1e-6 && prim[6] >= 1 - 1e-6)) tiles[1] = false;
      if (!(prim[4] <= 1e-6 && prim[7] >= 1 - 1e-6)) tiles[2] = false;
      if (prim[0] === 'plane') {
        tiles[1] = false;                                    // the top is never flush with y=1
        if (prim[8] !== prim[9] || prim[10] !== prim[11]) tiles[0] = false;
        if (prim[8] !== prim[10] || prim[9] !== prim[11]) tiles[2] = false;
      }
      if (prim[0] === 'prism') { tiles[prim[8] === 'x' ? 2 : 0] = false; tiles[1] = false; }
    }
    SHAPE_TILES[id] = tiles;
  }
}

/* THE CULL TEST, shared by both mesh passes. A quad survives unless the neighbour
   covers everything it occupies on the boundary, or the neighbour is the same shaped
   piece running along this axis. */
function shapeQuadHidden(id, cull, mask, neighborId) {
  if ((mask & ~FACE_COVER[neighborId * 6 + SHAPE_FACE_OPPOSITE[cull]]) === 0) return true;
  if (neighborId === id) {
    const t = SHAPE_TILES[id];
    if (t && t[_SHP_FACE_AXIS[cull]]) return true;
  }
  return false;
}

/* Precise per-cell collision, used by the player body and by dropped items. Mobs and
   the block raycaster keep the whole-cell test, which stays correct for them: a shaped
   block is still a mineable, targetable, light-blocking block. */
function cellBlocksAABB(id, cx, cy, cz, minX, minY, minZ, maxX, maxY, maxZ) {
  const boxes = SHAPE_AABB[id];
  if (!boxes) {
    return minX < cx + 1 && maxX > cx && minY < cy + 1 && maxY > cy && minZ < cz + 1 && maxZ > cz;
  }
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (minX < cx + b[3] && maxX > cx + b[0] &&
        minY < cy + b[4] && maxY > cy + b[1] &&
        minZ < cz + b[5] && maxZ > cz + b[2]) return true;
  }
  return false;
}

/* Nearest intersection of a ray with a shaped block's boxes, in the cell at (cx,cy,cz).
   Returns the hit face normal, or null if the ray passes through the empty part of the
   cell. Without this, aiming at the road beside a kerb would break the kerb, because
   the whole cell would still be a target even where nothing is drawn. */
function shapeRayHit(id, cx, cy, cz, ox, oy, oz, dx, dy, dz) {
  const boxes = SHAPE_PICK[id];
  if (!boxes || !boxes.length) return null;
  let bestT = Infinity, bestFace = null;
  const ix = dx !== 0 ? 1 / dx : 0, iy = dy !== 0 ? 1 / dy : 0, iz = dz !== 0 ? 1 / dz : 0;
  for (const b of boxes) {
    let t0 = -Infinity, t1 = Infinity, axis = -1, sign = 0;
    const lo = [cx + b[0], cy + b[1], cz + b[2]], hi = [cx + b[3], cy + b[4], cz + b[5]];
    const o = [ox, oy, oz], d = [dx, dy, dz], inv = [ix, iy, iz];
    let miss = false;
    for (let a = 0; a < 3; a++) {
      if (d[a] === 0) { if (o[a] < lo[a] || o[a] > hi[a]) { miss = true; break; } continue; }
      let ta = (lo[a] - o[a]) * inv[a], tb = (hi[a] - o[a]) * inv[a], s = -1;
      if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; }
      if (ta > t0) { t0 = ta; axis = a; sign = s; }
      if (tb < t1) t1 = tb;
      if (t0 > t1) { miss = true; break; }
    }
    if (miss || t1 < 0) continue;
    const t = t0 >= 0 ? t0 : 0;
    if (t < bestT) {
      bestT = t;
      const f = [0, 0, 0];
      if (axis >= 0) f[axis] = sign;
      bestFace = f;
    }
  }
  return bestFace ? { t: bestT, face: bestFace } : null;
}

// Tallest point of a shaped block, in cell-local units. Used by the selection outline
// so the highlight box hugs a kerb or a slab instead of floating a full cube over it.
function shapeTopAt(id) {
  const boxes = SHAPE_AABB[id];
  if (!boxes) return 1;
  let top = 0;
  for (const b of boxes) if (b[4] > top) top = b[4];
  return top;
}
