"use strict";
/* =====================================================================================
   D1 TERRAIN — THE ROAD / PATH FOUNDATION
   ERA 2, PHASE E2.2 — NEW.

   ─────────────────────────────────────────────────────────────────────────────────────
   THIS FILE SHIPS A REPRESENTATION AND NO ROUTES. THAT IS THE POINT.

   `D1_ROAD_NETWORK` is EMPTY, and `tests/terrain.js` fails if it is not. The route a road
   takes through D1 is authored content — it decides what the player sees first, which
   landmark is visible from which stretch, where the journey bends and where it forks. The
   brief for this phase says in as many words: do not choose the road route, do not
   randomly scatter roads, the eventual D1 road network is part of the authored world.

   So what is here is the machinery a route will be authored INTO: a polyline with a width
   and a kind, arc-length parameterised, with distance queries, terrain conformity and
   surface classification. Adding the real network is a data edit — a list of points — and
   no code changes.

   ─────────────────────────────────────────────────────────────────────────────────────
   A ROAD IS A CUT IN THE GROUND, NOT A RIBBON ON TOP OF IT

   A decal laid over noise rides every bump and reads as painted-on. A real rural road sits
   in a shallow cutting with a crown, its verges graded into the field, and it FLATTENS
   ACROSS its width — that lateral flattening is most of what makes it look built.

   So `d1ApplyRoadsToHeight` is called from inside `d1TerrainHeight` itself. The road is
   part of the ground function, which means collision, scatter, vegetation exclusion and
   the mesh all agree about it automatically and none of them needs to know roads exist.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHY POLYLINES AND NOT SPLINES

   A Catmull-Rom through sparse control points is prettier to author and worse to query:
   the nearest-point problem stops being closed-form and every height sample pays an
   iterative solve. A polyline with points every 15-30 m is visually indistinguishable once
   the corner smoothing below is applied, and its nearest-point query is exact arithmetic.
   Height is sampled a great many times per region build; this is the right trade.

   CLASSIC script. See src/world/terrain/LAYER.md.
   ===================================================================================== */

/* The kinds a route may be. Widths in METRES, and they are real: a single-track rural lane
   is about 3.5 m of made surface, a two-lane country road about 6, a farm track about 3
   with no formal edge. VISUAL_RULE_BIBLE section 15 says do not eyeball a measurement that
   exists in the real world. */
const D1_ROAD_KIND = Object.freeze({
  LANE:  Object.freeze({ id: 'lane',  width: 6.0, verge: 2.5, cut: 0.55, crown: 0.12 }),
  TRACK: Object.freeze({ id: 'track', width: 3.2, verge: 1.6, cut: 0.30, crown: 0.05 }),
  PATH:  Object.freeze({ id: 'path',  width: 1.4, verge: 0.8, cut: 0.12, crown: 0.00 }),
});

/* ─────────────────────────────────────────────────────────────────────────────────────
   THE AUTHORED NETWORK — DELIBERATELY EMPTY.

   A route is added as:
       { id: 'main-east', kind: D1_ROAD_KIND.LANE, points: [[x, z], [x, z], …] }

   CREATIVE DECISION NEEDED before anything goes in here. `tests/terrain.js` asserts this
   array is empty, so a route cannot be added by accident or by a later phase that has not
   read this comment.
   ───────────────────────────────────────────────────────────────────────────────────── */
const D1_ROAD_NETWORK = Object.freeze([]);

/* The network actually in force. The shipped game uses the authored one; a TEST may
   install a fixture route to exercise the machinery, exactly as the asset pipeline uses a
   validation asset to exercise loading without shipping content. Installing a fixture in
   the running game would be a content change and `tests/terrain.js` checks the shipped
   default is the empty authored network. */
let _d1Roads = D1_ROAD_NETWORK;

function d1SetRoadNetwork(routes) {
  _d1Roads = Object.freeze((routes || []).map(_d1PrepareRoute));
  return _d1Roads.length;
}
function d1RoadNetwork() { return _d1Roads; }
function d1ResetRoadNetwork() { _d1Roads = D1_ROAD_NETWORK; }

/* Precompute per-segment vectors and a bounding box. A route is prepared once and queried
   a great many times. */
function _d1PrepareRoute(route) {
  const pts = route.points || [];
  const segs = [];
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
    if (p[1] < minZ) minZ = p[1]; if (p[1] > maxZ) maxZ = p[1];
    if (i === 0) continue;
    const a = pts[i - 1], b = p;
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len2 = dx * dx + dz * dz;
    segs.push({ ax: a[0], az: a[1], dx, dz, len2: len2 || 1e-9 });
  }
  const kind = route.kind || D1_ROAD_KIND.TRACK;
  const reach = kind.width / 2 + kind.verge;
  return Object.freeze({
    id: route.id, kind, points: pts, segs: Object.freeze(segs), reach,
    bounds: Object.freeze({ minX: minX - reach, minZ: minZ - reach,
                            maxX: maxX + reach, maxZ: maxZ + reach }),
  });
}

/* Perpendicular distance in metres from a point to a route's centreline, or Infinity if
   the point is outside the route's bounding box. Exact, closed form, no iteration. */
function d1DistanceToRoute(route, x, z) {
  const b = route.bounds;
  if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return Infinity;
  let best = Infinity;
  for (const s of route.segs) {
    let t = ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.len2;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const px = s.ax + s.dx * t, pz = s.az + s.dz * t;
    const dx = x - px, dz = z - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

/* The nearest route and the distance to it, or null. */
function d1NearestRoad(x, z) {
  let bestRoute = null, bestDist = Infinity;
  for (const r of _d1Roads) {
    const d = d1DistanceToRoute(r, x, z);
    if (d < bestDist) { bestDist = d; bestRoute = r; }
  }
  return bestRoute ? { route: bestRoute, distance: bestDist } : null;
}

/* THE HEIGHT CUT. Called from inside d1TerrainHeight, so nothing downstream has to know.

   Across the made width the ground is pulled toward the route's own smoothed longitudinal
   profile and dropped into a shallow cutting, with a slight crown so water sheds. Across
   the verge it eases back to the natural field with a smoothstep, so there is no crease
   where the works end. */
function d1ApplyRoadsToHeight(x, z, h) {
  if (_d1Roads.length === 0) return h;
  const near = d1NearestRoad(x, z);
  if (!near) return h;

  const k = near.route.kind;
  const half = k.width / 2;
  const edge = half + k.verge;
  if (near.distance > edge) return h;

  /* The road's own height is the LONGITUDINAL profile — the natural ground sampled along
     the centreline and smoothed — not the ground at this point, which is what stops the
     road from rolling sideways across a slope. */
  const profile = _d1RouteProfileHeight(near.route, x, z);

  if (near.distance <= half) {
    const across = near.distance / half;
    const crown = k.crown * (1 - across * across);
    return profile - k.cut + crown;
  }

  const t = (near.distance - half) / k.verge;
  const s = t * t * (3 - 2 * t);
  const roadEdge = profile - k.cut;
  return roadEdge + (h - roadEdge) * s;
}

/* The smoothed natural ground along the centreline nearest this point. Sampled from
   d1BaseElevation — NOT d1TerrainHeight — because calling the full height function here
   would recurse straight back into this one. */
function _d1RouteProfileHeight(route, x, z) {
  let bestT = 0, bestSeg = null, best = Infinity;
  for (const s of route.segs) {
    let t = ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.len2;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const px = s.ax + s.dx * t, pz = s.az + s.dz * t;
    const dx = x - px, dz = z - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 < best) { best = d2; bestT = t; bestSeg = s; }
  }
  if (!bestSeg) return d1BaseElevation(x, z);

  const cx = bestSeg.ax + bestSeg.dx * bestT;
  const cz = bestSeg.az + bestSeg.dz * bestT;

  /* Average the natural ground along a short run of the centreline. This is what makes a
     road climb a hill at a steady grade instead of following every bump in it. */
  const len = Math.sqrt(bestSeg.len2);
  const ux = bestSeg.dx / len, uz = bestSeg.dz / len;
  const SPAN = 9, STEP = 4.5;
  let sum = 0, n = 0;
  for (let i = -SPAN; i <= SPAN; i++) {
    sum += d1BaseElevation(cx + ux * i * STEP, cz + uz * i * STEP);
    n++;
  }
  return sum / n;
}

/* ROAD or VERGE or null, for the surface classifier. */
function d1RoadSurfaceAt(x, z) {
  if (_d1Roads.length === 0) return null;
  const near = d1NearestRoad(x, z);
  if (!near) return null;
  const k = near.route.kind;
  if (near.distance <= k.width / 2) return D1_SURFACE.ROAD;
  if (near.distance <= k.width / 2 + k.verge) return D1_SURFACE.VERGE;
  return null;
}

/* Does a road claim this point at all? Scatter and vegetation ask this to keep trees out
   of the carriageway without needing to understand road geometry. */
function d1IsOnRoad(x, z, extra) {
  if (_d1Roads.length === 0) return false;
  const near = d1NearestRoad(x, z);
  if (!near) return false;
  const k = near.route.kind;
  return near.distance <= k.width / 2 + k.verge + (extra || 0);
}
