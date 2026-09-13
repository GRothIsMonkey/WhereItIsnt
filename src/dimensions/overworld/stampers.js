"use strict";
/* =====================================================================================
   THE OVERWORLD — WHAT IT IS MADE OF
   ERA 1.5.3 — MOVED VERBATIM OUT OF VoxelWorld.

   Terrain generation, trees, cave carving and the treasure chests. These are the
   methods that put voxels down, which is what makes them stampers and what makes them
   the part Era 2 replaces wholesale.

   Every method below is byte-identical to the text that was in game.html, comments and
   all. It is attached to VoxelWorld's prototype by registerWorldContent, which copies
   property descriptors so a moved method is indistinguishable from a declared one.
   See src/world/world-content.js and ARCHITECTURE.md.
   ===================================================================================== */

registerWorldContent('overworld', 'stampers', class {

  // Scatters rare Ancient Chests on the overworld surface — deterministic per-chunk
  // pseudo-random pass so world layout stays stable across a session.
  _generateTreasureChests(chunk) {
    let seed = (chunk.cx * 92821 + chunk.cz * 68917 + 5) >>> 0;
    const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return (seed % 10000) / 10000; };
    for (let x = 2; x < CHUNK_SX - 2; x++) {
      for (let z = 2; z < CHUNK_SZ - 2; z++) {
        if (rand() > 0.9985) {
          let surfaceY = -1;
          for (let y = CHUNK_SY - 1; y > 0; y--) {
            const id = chunk.data[chunk.idx(x, y, z)];
            if (id === BLOCK.GRASS || id === BLOCK.DIRT) { surfaceY = y; break; }
          }
          if (surfaceY < 0) continue;
          if (chunk.data[chunk.idx(x, surfaceY + 1, z)] !== BLOCK.AIR) continue;
          chunk.set(x, surfaceY + 1, z, BLOCK.TREASURE_CHEST);
        }
      }
    }
  }

  _carveCaveMouth(chunk, s) {
    const baseX = chunk.cx * CHUNK_SX, baseZ = chunk.cz * CHUNK_SZ;

    // Clears one world voxel if it belongs to this chunk and is safe to remove.
    const clear = (wx, wy, wz) => {
      const x = wx - baseX, z = wz - baseZ;
      if (x < 0 || x >= CHUNK_SX || z < 0 || z >= CHUNK_SZ) return;
      if (wy < 1 || wy >= CHUNK_SY) return;
      const idx = chunk.idx(x, wy, z);
      const id = chunk.data[idx];
      if (id === BLOCK.AIR || CAVE_MOUTH_NEVER_CARVE.has(id)) return;
      chunk.data[idx] = BLOCK.AIR;
    };
    // Paints exposed rock on a surface column that belongs to this chunk.
    const expose = (wx, wy, wz, id) => {
      const x = wx - baseX, z = wz - baseZ;
      if (x < 0 || x >= CHUNK_SX || z < 0 || z >= CHUNK_SZ) return;
      if (wy < 1 || wy >= CHUNK_SY) return;
      const idx = chunk.idx(x, wy, z);
      const cur = chunk.data[idx];
      if (cur !== BLOCK.GRASS && cur !== BLOCK.DIRT) return;
      chunk.data[idx] = id;
    };

    /* ---- 1. THE TUNNEL ----------------------------------------------------------
       Marched in small steps from just outside the hillside inward. The cross-section
       is an ellipse whose radii wobble per-step from a world-coordinate hash, so the
       bore is irregular rather than a clean rectangular or cylindrical tube. */
    let floorY = s.h - 1 - s.sink;
    let broke = false;
    const STEP = CAVE_MOUTH_STEP;
    for (let t = -CAVE_MOUTH_LIP; t <= s.depth; t += STEP) {
      const px = s.wx + s.inX * t, pz = s.wz + s.inZ * t;
      const ipx = Math.round(px), ipz = Math.round(pz);

      if (t > 0) floorY -= s.drop * STEP;
      const localH = this._overworldHeightAt(ipx, ipz);

      // Per-step irregularity.
      const wob = this._cmHash(ipx, ipz, 41);
      const wob2 = this._cmHash(ipx, ipz, 43);
      // Mouths flare open at the entrance and narrow as they drive inward.
      const flare = t < 0 ? 1.25 : 1 + Math.max(0, (3 - t) / 3) * 0.35;
      const rw = (s.rw * flare) * (0.82 + wob * 0.36);
      const rh = (s.rh * flare) * (0.85 + wob2 * 0.30);

      /* ROOF CLEARANCE. The bore is an ellipsoid of half-height rh, so capping its
         CENTRE at the surface still shaves rh blocks off the hillside for the tunnel's
         whole length — which scars the terrain instead of tunnelling under it. Once
         past the mouth (t > 0) the centre is therefore capped a full rh + 1 below the
         local surface, guaranteeing at least one block of rock overhead. Outside the
         mouth (t <= 0) no clearance is required: breaking the surface there is exactly
         what forms the opening. */
      const roof = t > 0 ? rh + 1 : 0;
      const capY = localH - 1 - roof - s.sink * 0.5;
      const cy = Math.min(floorY + rh * 0.5, capY);

      const ri = Math.ceil(rw) + 1, rj = Math.ceil(rh) + 1;
      for (let ox = -ri; ox <= ri; ox++) {
        for (let oz = -ri; oz <= ri; oz++) {
          for (let oy = -rj; oy <= rj; oy++) {
            const vx = ipx + ox, vy = Math.round(cy) + oy, vz = ipz + oz;
            // Ellipsoid test, with a per-voxel nibble so the wall isn't a smooth shell.
            const nib = this._cmHash(vx, vy, vz) * CAVE_MOUTH_NIBBLE;
            const d = (ox * ox + oz * oz) / (rw * rw) + (oy * oy) / (rh * rh);
            if (d > 1 - nib) continue;
            if (vy > localH) continue;          // don't carve open sky
            clear(vx, vy, vz);
          }
        }
      }

      // Stop as soon as the bore breaks into real cave space — the connection is the
      // point, and boring further would just make an unnaturally long corridor.
      if (t > 1 && this._isCaveAt(ipx, Math.round(cy), ipz)) { broke = true; }
      if (broke && t > 2) break;
      if (floorY < CAVE_MOUTH_MIN_Y) break;
    }

    /* ---- 2. SURFACE READABILITY --------------------------------------------------
       An apron of exposed stone around the mouth, plus a one-block depression on some
       columns. Both are hashed from world coordinates so neighbouring chunks agree.
       This also suppresses grass decor and trees here for free, since both passes run
       after this one and require a GRASS top — giving the bare, scree-like ground that
       reads as "something opens here" from a distance. */
    const AR = CAVE_MOUTH_APRON + Math.round(s.rw);
    for (let ox = -AR; ox <= AR; ox++) {
      for (let oz = -AR; oz <= AR; oz++) {
        const wx = s.wx + ox, wz = s.wz + oz;
        const x = wx - baseX, z = wz - baseZ;
        if (x < 0 || x >= CHUNK_SX || z < 0 || z >= CHUNK_SZ) continue;
        const dist = Math.hypot(ox, oz);
        if (dist > AR) continue;
        // Fade out with distance so the patch has a ragged edge, not a stamped circle.
        const falloff = 1 - dist / AR;
        const hsh = this._cmHash(wx, wz, 53);
        if (hsh > falloff * CAVE_MOUTH_APRON_DENSITY) continue;

        // Find this column's current surface.
        let sy = -1;
        for (let y = CHUNK_SY - 1; y > 0; y--) {
          const id = chunk.data[chunk.idx(x, y, z)];
          if (id === BLOCK.GRASS || id === BLOCK.DIRT) { sy = y; break; }
          if (id !== BLOCK.AIR) break;
        }
        if (sy < 0 || sy <= SEA_LEVEL) continue;

        /* Slight depression, tight around the mouth. Using a hash-modulated RADIUS
           rather than a per-column coin flip matters: a coin flip scatters isolated
           one-block dents across the apron, which reads as noise, whereas a wobbling
           radius carves a single coherent bowl with a ragged edge. */
        const bowlR = AR * CAVE_MOUTH_BOWL_FRAC * (0.65 + this._cmHash(wx, wz, 59) * 0.7);
        if (dist < bowlR) {
          clear(wx, sy, wz);
          sy -= 1;
          if (sy <= SEA_LEVEL) continue;
        }
        // Exposed rock. Andesite/Granite are already used as cave-wall variety by the
        // terrain generator, so no new materials are introduced here.
        const v = this._cmHash(wx, wz, 61);
        expose(wx, sy, wz, v < 0.72 ? BLOCK.STONE : (v < 0.88 ? BLOCK.ANDESITE : BLOCK.GRANITE));
      }
    }
  }

  _generateTerrain(chunk) {
    for (let x = 0; x < CHUNK_SX; x++) {
      for (let z = 0; z < CHUNK_SZ; z++) {
        const wx = chunk.cx * CHUNK_SX + x, wz = chunk.cz * CHUNK_SZ + z;
        // FLATTER SURFACE NOISE: lower frequency + fewer octaves than before reads as
        // gentle rolling hills instead of steep jagged peaks. The raw fbm is then
        // asymmetrically compressed — the below-midline half (valley floors) is
        // squashed much harder than the above-midline half (hill crests) — so low
        // ground flattens out into spacious building zones while hills still get to
        // roll softly rather than spike.
        const h = this._overworldSurfaceY(wx, wz);
        for (let y = 0; y < CHUNK_SY; y++) {
          let id = BLOCK.AIR;
          if (y < h) {
            const caveVal = this.caveNoise.noise3D(wx * 0.085, y * 0.085, wz * 0.085);
            // SUBTERRANEAN CAVE POLISH: ridged transform (1 - |noise|) turns the
            // blobby pocket carving into thin, winding "worm" tunnels, gated strictly
            // below Y=32 so surface build zones stay solid and untouched.
            const wormVal = 1 - Math.abs(caveVal);
            const isCave = y < 32 && y > 2 && y < h - 3 && wormVal > 0.89;
            if (!isCave) {
              if (y === h - 1) id = BLOCK.GRASS;
              else if (y >= h - 4) id = BLOCK.DIRT;
              else {
                id = BLOCK.STONE;
                // Cave wall variety: blocks close to a carved-out cave (moderate cave
                // noise, just under the excavation threshold) get intermixed with
                // Andesite/Granite patches instead of plain Stone.
                if (caveVal > 0.35) {
                  const andVal = this.andesiteNoise.noise3D(wx * 0.1, y * 0.1, wz * 0.1);
                  const graVal = this.graniteNoise.noise3D(wx * 0.1, y * 0.1, wz * 0.1);
                  if (andVal > 0.55) id = BLOCK.ANDESITE;
                  else if (graVal > 0.58) id = BLOCK.GRANITE;
                }
                // Coal ore nodes: only deep underground, well below the dirt/grass layer
                if (y < h - 6) {
                  const coalVal = this.coalNoise.noise3D(wx * 0.13, y * 0.13, wz * 0.13);
                  if (coalVal > 0.58) id = BLOCK.COAL_ORE;
                  // Iron ore: rarer, deeper veins
                  const ironVal = this.ironNoise.noise3D(wx * 0.11, y * 0.11, wz * 0.11);
                  if (ironVal > 0.68 && y < h - 10) id = BLOCK.IRON_ORE;
                  // Obsidian: sparse deep pockets
                  const obsVal = this.obsidianNoise.noise3D(wx * 0.08, y * 0.08, wz * 0.08);
                  if (obsVal > 0.74 && y < 10) id = BLOCK.OBSIDIAN;
                }
              }
            }
          } else if (y <= SEA_LEVEL) {
            // Low-lying air below sea level naturally forms lakes/rivers
            id = BLOCK.WATER;
          }
          chunk.data[chunk.idx(x, y, z)] = id;
        }
      }
    }
  }

  _generateTrees(chunk) {
    let seed = (chunk.cx * 7919 + chunk.cz * 104729 + 17) >>> 0;
    const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return (seed % 10000) / 10000; };
    for (let x = 2; x < CHUNK_SX - 2; x++) {
      for (let z = 2; z < CHUNK_SZ - 2; z++) {
        if (rand() > 0.985) {
          let surfaceY = -1;
          for (let y = CHUNK_SY - 1; y > 0; y--) {
            if (chunk.data[chunk.idx(x, y, z)] === BLOCK.GRASS) { surfaceY = y; break; }
          }
          if (surfaceY < 0) continue;
          // Tree validation: only spawn on dry surface grass, never underwater —
          // grass at/below sea level, or with water sitting directly on top of it,
          // is disqualified.
          if (surfaceY <= SEA_LEVEL) continue;
          if (chunk.data[chunk.idx(x, surfaceY + 1, z)] !== BLOCK.AIR) continue;
          const trunkH = 4 + Math.floor(rand() * 2);
          for (let ty = 1; ty <= trunkH; ty++) {
            chunk.set(x, surfaceY + ty, z, BLOCK.OAK_LOG);
          }
          const topY = surfaceY + trunkH;
          for (let lx = -2; lx <= 2; lx++) {
            for (let lz = -2; lz <= 2; lz++) {
              for (let ly = -1; ly <= 2; ly++) {
                if (Math.abs(lx) + Math.abs(lz) + Math.abs(ly) > 3) continue;
                if (lx === 0 && lz === 0 && ly <= 0) continue;
                const bx = x + lx, by = topY + ly, bz = z + lz;
                if (bx >= 0 && bx < CHUNK_SX && bz >= 0 && bz < CHUNK_SZ && by < CHUNK_SY) {
                  if (chunk.data[chunk.idx(bx, by, bz)] === BLOCK.AIR) chunk.set(bx, by, bz, BLOCK.LEAVES);
                }
              }
            }
          }
        }
      }
    }
  }

  // Scatters 3D cross-mesh flowers and tall grass across dry surface grass tops.
  // Purely visual (no voxel data / no collision) — added straight to the scene.
  _generateDecor(chunk) {
    let seed = (chunk.cx * 51329 + chunk.cz * 12841 + 71) >>> 0;
    const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return (seed % 10000) / 10000; };
    if (!this.decorGroup) {
      this.decorGroup = new THREE.Group();
      this.scene.add(this.decorGroup);
    }
    for (let x = 0; x < CHUNK_SX; x++) {
      for (let z = 0; z < CHUNK_SZ; z++) {
        if (rand() > 0.06) continue; // ~6% of surface columns get decor
        let surfaceY = -1;
        for (let y = CHUNK_SY - 1; y > 0; y--) {
          if (chunk.data[chunk.idx(x, y, z)] === BLOCK.GRASS) { surfaceY = y; break; }
        }
        if (surfaceY < 0 || surfaceY <= SEA_LEVEL) continue; // dry surface grass only
        if (chunk.data[chunk.idx(x, surfaceY + 1, z)] !== BLOCK.AIR) continue; // never underwater/obstructed
        const wx = chunk.cx * CHUNK_SX + x, wz = chunk.cz * CHUNK_SZ + z;
        const mesh = rand() < 0.35 ? buildFlowerCross(rand) : buildTallGrassCross(rand);
        mesh.position.set(wx + 0.5, surfaceY + 1, wz + 0.5);
        mesh.rotation.y = rand() * Math.PI;
        this.decorGroup.add(mesh);
        // Track this chunk's decor so disposeChunk can remove + dispose it — each
        // flower/grass cross owns its own unique geometry+material (see
        // _buildCrossMesh), so left untracked these accumulate forever in
        // decorGroup as the player streams through chunks (a real, unbounded
        // memory leak, since decorGroup itself is never cleared by unload).
        if (!chunk.decorMeshes) chunk.decorMeshes = [];
        chunk.decorMeshes.push(mesh);
      }
    }
  }
});
