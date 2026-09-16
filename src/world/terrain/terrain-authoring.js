"use strict";
/* =====================================================================================
   D1 — THE AUTHORED CONTENT SEAM
   ERA 2, PHASE E2.2 — NEW. **This file is the reason the phase exists.**

   ─────────────────────────────────────────────────────────────────────────────────────
   THE WHOLE POINT OF A FINITE AUTHORED WORLD IS THAT SOMEBODY DECIDES WHERE THINGS ARE

   Everything else in `src/world/terrain/` is the ground. This is the interface through
   which the ground receives content that was DECIDED rather than generated.

   It is the same shape Phase 31 found for environmental storytelling and CLAUDE.md
   section 57 wrote down as the Era 2 seam — content / sites / stampers, where the site
   table is the one place a coordinate lives. That structure survived the entire voxel
   rebuild once already. It is used again here for the same reason.

   ─────────────────────────────────────────────────────────────────────────────────────
   ⚠ THE TABLE IS EMPTY AND IT MUST STAY EMPTY UNTIL THE DESIGNS EXIST

   `D1_AUTHORED_SITES` is EMPTY, and `tests/terrain.js` fails if anything is in it.

   The seven landmarks — Farm Compound + Water Tower, Schoolhouse, Electrical Substation,
   Rural Church, Abandoned Motel, Abandoned Grain Elevator, Ordinary Barn + underground
   elevator facility — are a roster, not a design. Their coordinates, their architecture,
   their interiors, their relationships, their sightlines and the route between them are
   all **CREATIVE DECISION NEEDED**, and this phase was told in as many words not to invent
   them. Not one of them appears in this file, not even as a placeholder position, because
   a placeholder coordinate is a decision that somebody later mistakes for approval.

   What this phase guarantees is that when those designs arrive, placing them costs a ROW
   — an id, a position, a footprint, a terrain treatment — and no engine work.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHAT A SITE GETS, AND WHY EACH PIECE IS NEEDED

     FOOTPRINT      A building cannot stand on rolling ground. A site declares the area it
                    occupies and how the terrain should be treated under it — levelled to a
                    pad, graded to a slope, or left alone for something that follows the
                    land. `d1SiteTerrainAdjust` applies it INSIDE the height function, the
                    same way roads are applied, so collision, scatter and the mesh all
                    agree without any of them knowing a site is there.

     EXCLUSION      Scatter must not plant a tree through a wall. A site's footprint plus a
                    margin suppresses procedural placement automatically.

     APPROACH       A landmark the player arrives at from a decided direction is composed;
                    one they wander into is furniture. The field exists so that decision
                    can be recorded when it is made. It is not used yet.

     VISIBILITY     ROADMAP section 36 requires the water tower to be visible from a long
                    way off and explicitly not hidden by fog. That is a property of a SITE,
                    not of a renderer, so it is declared here and read by whatever draws
                    distant silhouettes.

   ─────────────────────────────────────────────────────────────────────────────────────
   THIS FILE PLACES NOTHING BY ITSELF

   It has no generator, no geometry, no material and no asset. It answers questions about
   authored sites and adjusts terrain under them. The thing that BUILDS a landmark is that
   landmark's own module, written in the phase that designs it.

   CLASSIC script. See src/world/terrain/LAYER.md.
   ===================================================================================== */

/* How the ground under a site is treated. */
const D1_SITE_TERRAIN = Object.freeze({
  NONE:  'none',    // the structure follows the land
  PAD:   'pad',     // levelled flat to the site's own height
  GRADE: 'grade',   // eased toward the site's height without flattening
});

/* ─────────────────────────────────────────────────────────────────────────────────────
   THE AUTHORED SITE TABLE — EMPTY BY DESIGN.

   A row, when the designs exist:

     Object.freeze({
       id: 'water-tower',
       x: <metres>, z: <metres>,          // CREATIVE DECISION NEEDED
       radius: 22,                        // footprint
       terrain: D1_SITE_TERRAIN.PAD,
       padHeight: null,                   // null = use the natural height at (x, z)
       blend: 18,                         // metres over which the pad eases into the field
       excludeScatter: 8,                 // extra clearance beyond the footprint
       visibleFrom: 1800,                 // metres; a long-range silhouette
       approach: null,                    // CREATIVE DECISION NEEDED
     })

   `tests/terrain.js` asserts this is empty. Adding a row is a creative act, not a
   refactor.
   ───────────────────────────────────────────────────────────────────────────────────── */
const D1_AUTHORED_SITES = Object.freeze([]);

/* The sites actually in force. The game uses the authored table; a TEST may install
   fixtures to exercise the machinery, exactly as roads and scatter do. */
let _d1Sites = D1_AUTHORED_SITES;

function d1SetAuthoredSites(sites) {
  _d1Sites = Object.freeze((sites || []).map((s) => Object.freeze(Object.assign({
    radius: 16, terrain: D1_SITE_TERRAIN.NONE, padHeight: null, blend: 12,
    excludeScatter: 4, visibleFrom: 0, approach: null,
  }, s))));
  return _d1Sites.length;
}
function d1AuthoredSites() { return _d1Sites; }
function d1ResetAuthoredSites() { _d1Sites = D1_AUTHORED_SITES; }

function d1SiteById(id) {
  for (const s of _d1Sites) if (s.id === id) return s;
  return null;
}

/* Every site whose footprint a region touches — the query a region build uses to know
   what it must make room for. */
function d1SitesInRegion(rx, rz) {
  if (_d1Sites.length === 0) return [];
  const b = d1RegionBounds(rx, rz);
  const out = [];
  for (const s of _d1Sites) {
    const reach = s.radius + s.blend;
    if (s.x + reach < b.minX || s.x - reach > b.maxX) continue;
    if (s.z + reach < b.minZ || s.z - reach > b.maxZ) continue;
    out.push(s);
  }
  return out;
}

/* THE TERRAIN TREATMENT UNDER A SITE.

   Called from `d1TerrainHeight`, after roads, so a site wins over a road that runs through
   it — which is correct: a farmyard is not interrupted by the track that enters it.

   With no authored sites this returns immediately and costs one length check. */
function d1ApplySitesToHeight(x, z, h) {
  if (_d1Sites.length === 0) return h;

  for (const s of _d1Sites) {
    if (s.terrain === D1_SITE_TERRAIN.NONE) continue;
    const dx = x - s.x, dz = z - s.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const reach = s.radius + s.blend;
    if (d > reach) continue;

    /* The pad's height is the natural ground at the site's own centre unless the author
       overrode it — sampled from the BASE elevation, because sampling the full height
       function here would recurse straight back into this one. */
    const target = s.padHeight !== null ? s.padHeight : d1BaseElevation(s.x, s.z);

    if (d <= s.radius) {
      h = s.terrain === D1_SITE_TERRAIN.PAD ? target : h + (target - h) * 0.75;
    } else {
      const t = (d - s.radius) / s.blend;
      const k = t * t * (3 - 2 * t);                  // smoothstep out to the natural field
      const inner = s.terrain === D1_SITE_TERRAIN.PAD ? target : h + (target - h) * 0.75;
      h = inner + (h - inner) * k;
    }
  }
  return h;
}

/* Does an authored site forbid procedural placement here? */
function d1IsSiteExcluded(x, z) {
  if (_d1Sites.length === 0) return false;
  for (const s of _d1Sites) {
    const dx = x - s.x, dz = z - s.z;
    const r = s.radius + s.excludeScatter;
    if (dx * dx + dz * dz <= r * r) return true;
  }
  return false;
}

/* Sites that should be drawn as distant silhouettes from a viewpoint. The query
   ROADMAP section 36's water-tower rule will be answered through. */
function d1LongRangeSitesFrom(x, z) {
  const out = [];
  for (const s of _d1Sites) {
    if (!s.visibleFrom) continue;
    const dx = x - s.x, dz = z - s.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d <= s.visibleFrom) out.push({ site: s, distance: d });
  }
  return out.sort((a, b) => a.distance - b.distance);
}

function terrainAuthoringStatus() {
  return {
    stage: 'SEAM READY, NO CONTENT',
    sites: _d1Sites.length,
    landmarkRoster: 7,
    note: 'The seven D1 landmarks are a roster, not a design. Coordinates, architecture, ' +
          'interiors, routes and relationships are all CREATIVE DECISION NEEDED. The table ' +
          'is empty on purpose and the test enforces it.',
  };
}
