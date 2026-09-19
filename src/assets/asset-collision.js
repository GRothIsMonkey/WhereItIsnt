"use strict";
/* =====================================================================================
   ASSET COLLISION — WHAT SHAPE A PLACED MODEL IS, WITHOUT A SINGLE VOXEL
   ERA 2, PHASE E2.0a — NEW.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHY THIS IS A SEPARATE THING FROM THE MESH

   An asset does not bring its own physics. The render mesh is an appearance; the
   collision proxy is a fact about the world, and conflating them is how a renderer ends
   up load-bearing. E2.1 made gameplay stop asking the voxel engine voxel questions; this
   is the other end of the same rule — when gameplay asks "what shape is the world here"
   about a model, the answer comes from a declared proxy, never from triangles.

   So `tests/architecture.js` asserts this file names no block id, no chunk, no voxel
   coordinate and nothing from `src/world/`, and `tests/assets.js` asserts no asset in the
   registry may declare a `mesh` collision mode, because there isn't one.

   ─────────────────────────────────────────────────────────────────────────────────────
   IT ANSWERS THE SAME QUESTIONS `VoxelPhysicalWorld` DOES, DELIBERATELY

       collidesAABB(aabb)     -> bool
       groundHeightAt(x, z)   -> y | null
       isSolid(x, y, z)       -> bool

   Same names, same kinds of answer, different representation — which is the whole claim
   E2.1 makes about its contract, tested here for the first time against something that is
   not a voxel world. If these three can be answered over placed meshes, the contract is
   representation-neutral in fact and not merely in its header comment.

   `groundHeightAt` returns **null** where this set has nothing, rather than a number.
   That is not the voxel world's behaviour and it is not supposed to be: a set of props
   knows about props, and "no opinion" is a different answer from "the ground is at zero".
   Whoever composes this with terrain decides what a null means.

   ─────────────────────────────────────────────────────────────────────────────────────
   NOT WIRED INTO LIVE GAMEPLAY, AND THAT IS A DECISION

   Nothing in the shipped game calls this yet, because nothing is placed yet. Composing
   it with the live physical world means building a COMPOSITE PhysicalWorld — terrain plus
   props plus architecture, with a resolution order — and that belongs to the phase that
   introduces mesh terrain, not to the phase that introduces the loader. Deferred
   explicitly, and recorded in ERA2-PLAN.md rather than half-built here.

   CLASSIC script. See src/assets/LAYER.md.
   ===================================================================================== */

/* A world-space axis-aligned box, and the only geometry vocabulary this file has. */
function assetBox(minX, minY, minZ, maxX, maxY, maxZ) {
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

function assetBoxesOverlap(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX &&
         a.minY < b.maxY && a.maxY > b.minY &&
         a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/* The proxy a registry row implies, in the asset's own local space, before placement.

   `none`  -> []                       nothing to walk into
   `box`   -> the asset's measured bounds, which is what BOX means
   `boxes` -> exactly what the row authored, because a row that bothered to list boxes
              knows something about the shape that a bounding box does not */
function assetLocalProxy(key, source) {
  const spec = MODEL_ASSETS[key];
  if (!spec || spec.collision === ASSET_COLLISION.NONE) return [];
  if (spec.collision === ASSET_COLLISION.BOXES && Array.isArray(spec.boxes)) {
    return spec.boxes.map((b) => assetBox(b[0], b[1], b[2], b[3], b[4], b[5]));
  }
  if (spec.collision === ASSET_COLLISION.BOX && source && source.bounds) {
    const b = source.bounds;
    return [assetBox(b.min[0], b.min[1], b.min[2], b.max[0], b.max[1], b.max[2])];
  }
  return [];
}

/* D1 PHASE 2 — THE PROXY ID COUNTER, AND IT IS DELIBERATELY NOT PER-SET.

   It exists for the raycast tie-break: when two proxies are struck at effectively the same
   distance, something has to choose, and "whichever happens to be earlier in the array" is
   not a rule — a removal shifts every later index.

   IT IS SHARED BY EVERY SET BECAUSE A PER-SET COUNTER IS NOT A TIE-BREAK. Two sets composed
   as two providers would both mint id 1, the tie-break would find them equal, and the winner
   would fall back to the order the composite happened to consult them in — which is the one
   thing the rule exists to forbid. `tests/raycast.js` catches exactly that: with per-set ids
   its two-provider tie test passed while comparing two DIFFERENT entries that merely shared
   a number.

   It is a runtime handle and nothing else. It is never saved, never hashed, never fed into
   generation, and carries no meaning beyond "not the same proxy as that one" — so it is not
   a determinism surface in the sense of CLAUDE.md section 11. */
let _assetProxyNextId = 1;

/* A set of placed proxies. Bounded, flat, and deliberately unindexed: E2.0a places one
   asset, and a spatial index chosen before there is a distribution to measure is a guess.
   The phase that places thousands adds one, with a benchmark — CLAUDE.md section 14. */
class AssetCollisionSet {
  constructor() {
    this.entries = [];        // { id, instance, key, boxes: [world-space] }
  }

  get size() { return this.entries.length; }

  /* Place one instance's proxy. `instance` must already carry its final world transform;
     the boxes are baked at add time and this set does not watch for later movement —
     a prop that moves is a different problem and does not exist yet. */
  add(instance, source) {
    if (!instance) return 0;
    const key = instance.userData && instance.userData.assetKey;
    if (!key) return 0;
    const local = assetLocalProxy(key, source);
    if (!local.length) return 0;

    instance.updateMatrixWorld(true);
    const m = instance.matrixWorld;
    const boxes = local.map((b) => {
      /* Transform all eight corners and re-fit, so a rotated instance gets an honest
         world-space box rather than a rotated one pretending to be axis-aligned. */
      let nx = Infinity, ny = Infinity, nz = Infinity;
      let xx = -Infinity, xy = -Infinity, xz = -Infinity;
      for (let i = 0; i < 8; i++) {
        const v = new THREE.Vector3(
          (i & 1) ? b.maxX : b.minX,
          (i & 2) ? b.maxY : b.minY,
          (i & 4) ? b.maxZ : b.minZ,
        ).applyMatrix4(m);
        if (v.x < nx) nx = v.x; if (v.x > xx) xx = v.x;
        if (v.y < ny) ny = v.y; if (v.y > xy) xy = v.y;
        if (v.z < nz) nz = v.z; if (v.z > xz) xz = v.z;
      }
      return assetBox(nx, ny, nz, xx, xy, xz);
    });
    this.entries.push({ id: _assetProxyNextId++, instance, key, boxes });
    return boxes.length;
  }

  remove(instance) {
    const i = this.entries.findIndex((e) => e.instance === instance);
    if (i < 0) return false;
    this.entries.splice(i, 1);
    return true;
  }

  clear() { this.entries.length = 0; }

  /* ---- THE PHYSICAL QUESTIONS ----------------------------------------------------- */

  collidesAABB(aabb) {
    for (const e of this.entries)
      for (const b of e.boxes)
        if (assetBoxesOverlap(aabb, b)) return true;
    return false;
  }

  isSolid(x, y, z) {
    for (const e of this.entries)
      for (const b of e.boxes)
        if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && z >= b.minZ && z <= b.maxZ) return true;
    return false;
  }

  /* The highest proxy surface over this column, or null where this set has nothing. */
  groundHeightAt(x, z) {
    let best = null;
    for (const e of this.entries)
      for (const b of e.boxes)
        if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ)
          if (best === null || b.maxY > best) best = b.maxY;
    return best;
  }

  /* ---- D1 PHASE 2 — THE NORMALIZED RAYCAST ---------------------------------------- */

  /* THE NEAREST PROXY ALONG THIS RAY, or null.

     This is the MESH/ARCHITECTURE provider for the composite's raycast, and it deliberately
     raycasts the DECLARED COLLISION PROXIES — never the render mesh. A decorative object
     with `ASSET_COLLISION.NONE` contributes no boxes at `add` time and is therefore not
     hittable here at all, which is the same rule `collidesAABB` already follows and is why
     "an asset does not bring its own physics" survives into interaction.

     `direction` must already be normalized — one convention for every provider, stated in
     src/world/raycast.js. Distances are world units along the ray.

     The `ref` on the returned hit is the entry's STABLE ID, not the instance and not the
     mesh: the id is what a later system keys an interaction target on, and handing out the
     THREE object here would put the renderer back into gameplay's hands. */
  raycast(origin, direction, maxDistance) {
    const ox = origin.x, oy = origin.y, oz = origin.z;
    const dx = direction.x, dy = direction.y, dz = direction.z;
    let best = null;

    for (const e of this.entries) {
      for (const b of e.boxes) {
        const t = rayAabbDistance(ox, oy, oz, dx, dy, dz, b, maxDistance);
        if (t === null || t > maxDistance) continue;
        const hit = makeRayHit(
          t,
          { x: ox + dx * t, y: oy + dy * t, z: oz + dz * t },
          rayAabbNormal(ox, oy, oz, dx, dy, dz, b, t),
          RAYCAST_CATEGORY.ASSET,
          e.id,
          e.id,
        );
        if (rayHitBeats(hit, best)) best = hit;
      }
    }
    return best;
  }
}
