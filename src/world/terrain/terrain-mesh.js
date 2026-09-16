"use strict";
/* =====================================================================================
   D1 TERRAIN — MESH CONSTRUCTION
   ERA 2, PHASE E2.2 — NEW.

   ─────────────────────────────────────────────────────────────────────────────────────
   THE MESH IS A PICTURE OF THE HEIGHTFIELD AND OWNS NOTHING

   It samples `d1TerrainHeight`. It decides nothing. Change the LOD and the picture gets
   coarser while the ground the player walks on is unchanged, because the ground is the
   function and this is a rendering of it. That separation is the whole architecture of
   this phase and it is why a region can be thrown away and rebuilt at a different
   resolution mid-stride without the player feeling anything.

   ─────────────────────────────────────────────────────────────────────────────────────
   A REGION'S MESH OVERLAPS ITS NEIGHBOUR BY ONE ROW, DELIBERATELY

   A grid built exactly to a region's bounds leaves a hairline crack at every seam, because
   the last vertex column of one region and the first of the next are the same position
   computed twice and the triangles between them do not exist. Sampling one row PAST the
   far edge — i.e. building 0..size inclusive — makes adjacent regions share their boundary
   vertices exactly, since both evaluate the same function at the same coordinates and
   floating-point is deterministic.

   That fixes same-LOD seams completely. It does NOT fix a seam between two DIFFERENT LODs,
   where a fine edge has vertices a coarse edge does not; the standard answer is a skirt,
   and a skirt is what this builds — a short vertical apron around each region that hides
   any gap without pretending the geometry matched. Measured at 2.5 m, which covers the
   worst 2 m-vs-16 m mismatch this terrain's slopes produce.

   ─────────────────────────────────────────────────────────────────────────────────────
   WHAT IT COSTS, MEASURED RATHER THAN ASSUMED

   A 256 m region at the finest 2 m spacing is a 129 x 129 vertex grid: 16,641 vertices and
   32,768 triangles. `tests/browser-terrain.js` reports the real build time, triangle count
   and draw calls; CLAUDE.md section 14 says measure before optimising, and nothing here is
   optimised beyond sharing one material and one geometry per region.

   CLASSIC script. See src/world/terrain/LAYER.md.
   ===================================================================================== */

/* How far the apron hangs below the terrain edge. Metres. */
const D1_SKIRT_DEPTH = 2.5;

/* Build one region's terrain geometry at a vertex spacing, in metres.

   Returns a THREE.BufferGeometry positioned in WORLD space — not local space with a
   transform — because the heightfield is queried in world coordinates and a mesh whose
   vertices are the same numbers is one less place for a transform to disagree with the
   ground. Region meshes therefore sit at the origin and carry no position. */
function d1BuildRegionGeometry(rx, rz, spacing) {
  const b = d1RegionBounds(rx, rz);
  const n = Math.max(1, Math.round(D1_REGION_SIZE / spacing));   // cells across
  const v = n + 1;                                               // vertices across

  const count = v * v;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  /* ONE HEIGHT SAMPLE PER VERTEX, AND THAT IS THE WHOLE OPTIMISATION.

     The first version of this loop called d1TerrainHeight for the position, then
     d1TerrainNormal (four more evaluations), then d1SurfaceAt — which internally called
     d1TerrainHeight again and d1TerrainSlope for four more. Eleven evaluations per vertex,
     and a 2 m region measured **290 ms**, against a 4 ms frame budget.

     Sampling a grid with a ONE-CELL BORDER means every vertex's four neighbours are
     already in hand, so the normal and the slope are central differences over an array
     instead of eight more noise evaluations. The border is what makes the vertices on a
     region's own edge correct rather than one-sided — without it every region would have a
     visibly mis-shaded rim. */
  const gw = v + 2;                                   // sample grid width, with border
  const grid = new Float32Array(gw * gw);
  for (let gz = 0; gz < gw; gz++) {
    const z = b.minZ + (gz - 1) * spacing;
    for (let gx = 0; gx < gw; gx++) {
      grid[gz * gw + gx] = d1TerrainHeight(b.minX + (gx - 1) * spacing, z);
    }
  }

  let p = 0;
  for (let iz = 0; iz < v; iz++) {
    const z = b.minZ + iz * spacing;
    const gz = iz + 1;
    for (let ix = 0; ix < v; ix++) {
      const x = b.minX + ix * spacing;
      const gx = ix + 1;
      const h = grid[gz * gw + gx];
      positions[p] = x; positions[p + 1] = h; positions[p + 2] = z;

      const hL = grid[gz * gw + (gx - 1)], hR = grid[gz * gw + (gx + 1)];
      const hD = grid[(gz - 1) * gw + gx], hU = grid[(gz + 1) * gw + gx];
      const nrm = d1NormalFromHeights(hL, hR, hD, hU, spacing);
      normals[p] = nrm.x; normals[p + 1] = nrm.y; normals[p + 2] = nrm.z;

      const c = d1SurfaceColor(d1SurfaceAtPrecomputed(x, z, h, d1SlopeFromNormal(nrm)));
      colors[p] = c.r; colors[p + 1] = c.g; colors[p + 2] = c.b;
      p += 3;
    }
  }

  /* Indices. Two triangles per cell, wound counter-clockwise when viewed from above. */
  const quadCount = n * n;
  const IndexArray = count > 65535 ? Uint32Array : Uint16Array;
  const indices = new IndexArray(quadCount * 6 + n * 4 * 6);
  let q = 0;
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const a = iz * v + ix, bb = a + 1, c = a + v, d = c + 1;
      indices[q++] = a; indices[q++] = c; indices[q++] = bb;
      indices[q++] = bb; indices[q++] = c; indices[q++] = d;
    }
  }

  /* THE SKIRT. An apron of vertices duplicated from the border and pushed down, stitched
     to the border ring. It is invisible from above and from any normal eye height, and it
     means an LOD seam shows ground instead of sky. */
  const skirtStart = count;
  const extraPositions = [];
  const extraNormals = [];
  const extraColors = [];
  const border = [];
  for (let ix = 0; ix < v; ix++) border.push({ i: ix, edge: 0 });                 // z min
  for (let iz = 1; iz < v; iz++) border.push({ i: (iz * v) + (v - 1), edge: 1 }); // x max
  for (let ix = v - 2; ix >= 0; ix--) border.push({ i: (v - 1) * v + ix, edge: 2 });
  for (let iz = v - 2; iz >= 1; iz--) border.push({ i: iz * v, edge: 3 });        // x min

  for (const bp of border) {
    const o = bp.i * 3;
    extraPositions.push(positions[o], positions[o + 1] - D1_SKIRT_DEPTH, positions[o + 2]);
    extraNormals.push(normals[o], normals[o + 1], normals[o + 2]);
    extraColors.push(colors[o], colors[o + 1], colors[o + 2]);
  }

  const skirtIdx = [];
  for (let i = 0; i < border.length; i++) {
    const j = (i + 1) % border.length;
    const top0 = border[i].i, top1 = border[j].i;
    const bot0 = skirtStart + i, bot1 = skirtStart + j;
    skirtIdx.push(top0, bot0, top1, top1, bot0, bot1);
  }

  const totalVerts = count + border.length;
  const allPositions = new Float32Array(totalVerts * 3);
  const allNormals = new Float32Array(totalVerts * 3);
  const allColors = new Float32Array(totalVerts * 3);
  allPositions.set(positions); allNormals.set(normals); allColors.set(colors);
  allPositions.set(extraPositions, count * 3);
  allNormals.set(extraNormals, count * 3);
  allColors.set(extraColors, count * 3);

  const FinalIndex = totalVerts > 65535 ? Uint32Array : Uint16Array;
  const allIndices = new FinalIndex(quadCount * 6 + skirtIdx.length);
  allIndices.set(indices.subarray(0, quadCount * 6));
  allIndices.set(skirtIdx, quadCount * 6);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(allPositions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(allNormals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(allColors, 3));
  geo.setIndex(new THREE.BufferAttribute(allIndices, 1));

  /* Bounds set by hand from the declared vertical budget rather than computed, so a
     frustum test never has to walk sixteen thousand vertices. */
  geo.boundingBox = new THREE.Box3(
    new THREE.Vector3(b.minX, D1_MIN_Y - D1_SKIRT_DEPTH, b.minZ),
    new THREE.Vector3(b.maxX, D1_MAX_Y, b.maxZ));
  geo.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(b.centreX, (D1_MIN_Y + D1_MAX_Y) / 2, b.centreZ),
    Math.sqrt(2) * D1_REGION_SIZE / 2 + (D1_MAX_Y - D1_MIN_Y) / 2);

  geo.userData.d1 = { rx, rz, spacing, vertices: totalVerts,
                      triangles: allIndices.length / 3 };
  return geo;
}

/* Standing water for a region, or null where the region has none. One flat plane clipped
   to the region — not a mesh that follows the bottom, because the surface of still water
   IS flat and the bottom is already the terrain. */
function d1BuildRegionWater(rx, rz) {
  const b = d1RegionBounds(rx, rz);

  /* Probe coarsely: if nothing in the region is below the table, there is no water here
     and the region pays one 25-sample sweep to find that out. */
  let wet = false;
  for (let i = 0; i <= 4 && !wet; i++)
    for (let j = 0; j <= 4 && !wet; j++)
      if (d1TerrainHeight(b.minX + i * D1_REGION_SIZE / 4,
                          b.minZ + j * D1_REGION_SIZE / 4) < D1_WATER_LEVEL) wet = true;
  if (!wet) return null;

  const geo = new THREE.PlaneGeometry(D1_REGION_SIZE, D1_REGION_SIZE);
  geo.rotateX(-Math.PI / 2);
  geo.translate(b.centreX, D1_WATER_LEVEL, b.centreZ);
  geo.userData.d1 = { rx, rz, water: true };
  return geo;
}
