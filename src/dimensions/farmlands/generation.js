"use strict";
/* =====================================================================================
   THE SHATTERED FARMLANDS — WHAT IS THERE, AND WHERE
   ERA 1.5.3 — MOVED VERBATIM OUT OF VoxelWorld.

   The parcel lattice, the Phase 18.1 curved route spine, field and soil state, farmstead
   and landmark site selection, the journey resolution, the water simulation's bookkeeping,
   animal cells, the water tower's lamp and the landmark proxies.

   Creative D1 in the canon, stable technical id 2. The two numbers are different things
   and neither is derived from the other — see dimension-descriptors.js.

   Every method below is byte-identical to the text that was in game.html, comments and
   all. It is attached to VoxelWorld's prototype by registerWorldContent, which copies
   property descriptors so a moved method is indistinguishable from a declared one.
   See src/world/world-content.js and ARCHITECTURE.md.
   ===================================================================================== */

registerWorldContent('farmlands', 'generation', class {

  /* ===================================================================================
     PHASE 16 — THE INFINITE SHATTERED FARMLANDS

     BOOT. "Generating the region" now means only: establish the arrival point, register
     the Disconnected Home's chest key, and pin a 3x3 core around the rift landing pad so
     the Level 1->2 transition can never drop the player into an ungenerated chunk. Nine
     chunks, not sixty-four, and no perimeter wall. Everything else in the dimension is
     produced on demand by _genFarmlandsChunk through the ordinary radial streamer.

     Deliberately safe to re-run: it routes through _generateChunk, which returns an
     existing chunk rather than overwriting the map entry, so the dev teleports can call
     it repeatedly without orphaning meshes in the scene graph. The old implementation
     built chunks with `new Chunk(...)` and clobbered the map, which is exactly why
     ensureFarmlands() had to guard against calling it twice.
     =================================================================================== */
  _genFarmlandsRegion() {
    /* THE CHEST KEY IS COMPUTED BEFORE ANY CHUNK EXISTS. In the pocket implementation
       homeChestKey was assigned as a side effect of stamping the building, which was
       safe only because the whole region was built up front. In a streamed world the
       home's chunks may not be resident when the player opens something, so the key is
       derived here from the resolved plot and the heightfield alone, before a single
       voxel exists. Progression can therefore never depend on visit order, and the
       guaranteed Level 2 Rift Core Disk cannot be lost to a chunk that streamed out. */
    /* PHASE 20 — THE JOURNEY IS RESOLVED FIRST, BEFORE ANYTHING READS THE HEIGHTFIELD.
       The water tower and the Disconnected Home are no longer fixed coordinate pairs:
       both are placed into the clear window the Phase 18.1 routes actually leave in
       their parcel, which is a pure function of the lane hashes and therefore identical
       on every boot — but it is not knowable at module load, because the route maths
       lives on the world. Nothing below may run before it, because _farmPadAt reads the
       two plots it produces. */
    this._farmResolveJourney();

    const chest = this.farmHome.chest;
    this.homeChestKey = chest.x + ',' + chest.y + ',' + chest.z;
    this.farmlandsHomePos = new THREE.Vector3(chest.x + 0.5, chest.y + 0.5, chest.z + 0.5);

    const cx = FARMLANDS_SPAWN_CHUNK, cz = FARMLANDS_SPAWN_CHUNK;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const c = this._generateChunk(cx + dx, cz + dz);
        this.pinnedChunkKeys.add(this.key(cx + dx, cz + dz));
        this.generateChunkMesh(c);
      }
    }

    /* ARRIVAL. The landing pad is part of the HEIGHTFIELD (see _farmPadAt), not a hole
       punched afterwards, so every chunk that overlaps it agrees on the ground level
       without needing to know a pad exists. The generator also suppresses all decor
       inside the pad radius, which means there is nothing to clear: the player cannot
       arrive inside a crop, a fence or a tree because none was ever written there. */
    /* PHASE 20 — THE PLAYER ARRIVES ON THE ROAD, NOT BESIDE IT.

       Phase 18 forced both arrival grid lines to carry a lane, which put a real crossroads
       a few paces from the landing point — but the landing point itself is at parcel
       offset 8 and the route spine wanders, so where the player actually stood was the
       verge, four or five blocks off the carriageway, looking at a field. Requirement 2
       asks for a spawn ON a meaningful rural path and it is worth the three lines: the
       arrival x is now the lane's own centreline at the arrival z, which is inside the
       landing pad by construction (the spine is clamped to FARM_ROUTE_A = 14 and the pad
       is cleared to FARM_PAD_R + 2), so the player steps out of the rift standing in the
       ruts. */
    /* THE SPAWN FOLLOWS THE ROAD, NOT THE PAD. The landing pad is eight blocks square and
       the Phase 18.1 spine wanders up to fourteen, so on this seed the lane's centreline
       is eleven blocks from the pad centre — clamping the spawn to the pad put the player
       on the VERGE looking at a field, which is exactly the first impression requirement 2
       exists to prevent. The arrival point is therefore the carriageway itself. Nothing
       grows on a cart track, so the pad's "nothing to clear" guarantee still holds where
       it matters.

       THE CAUSEWAY LIFT HAS TO BE REPLICATED HERE. _farmCache raises a TRACK column to a
       block clear of the water table and _farmHeightAt does not know about it, so a lane
       crossing low ground would spawn the player inside the embankment. */
    const sz = Math.round(this._farmJourneyLaneZ(FARM_SPAWN_X));
    const h = Math.max(this._farmHeightAt(FARM_SPAWN_X, sz), FARM_WATER_Y + 1);
    this.farmlandsSpawn = new THREE.Vector3(FARM_SPAWN_X + 0.5, h + 1, sz + 0.5);
    /* ...and FACING DOWN IT. The journey runs east, and a player who arrives looking the
       other way has to be told where to go by something other than the world. forward is
       (-sin y, 0, -cos y), so -PI/2 looks along +x. This is guidance by composition,
       which is the only kind requirement 66 allows. */
    this.farmlandsSpawnYaw = -Math.PI / 2;
  }

  /* ===================================================================================
     THE HEIGHTFIELD

     Two octave sets: a broad swell at ~180 blocks that gives the dimension its rolling
     shape, and a field-scale undulation at ~48 blocks that keeps a single parcel from
     reading as a table. Watercourses are cut afterwards by a ridged noise, and the
     agricultural layer sinks its own ditches on top of that.

     THE CLAMP IS NOT COSMETIC. SanitySystem.update()'s Day Phase floor is gated on
     py > 30. The finite pocket ran 20..28, so that gate never fired inside the
     Farmlands, and every tuned sanity behaviour in this dimension — the night drain,
     the torch bonus, the Soul Anchor hold — is defined against it never firing. A hill
     that reached y=31 would silently switch daytime sanity to "hard-locked, no drain"
     on its summit and nowhere else. FARM_MAX_Y = 29 keeps a standing player at py <= 29
     everywhere in an infinite world.
     =================================================================================== */
  _farmHeightAt(wx, wz) {
    const pad = this._farmPadAt(wx, wz);
    if (pad >= 0) return pad;
    // PHASE 17 — settlement and landmark plots are levelled by the same mechanism.
    const sp = this._farmStructPadAt(wx, wz);
    if (sp >= 0) return sp;
    return this._farmBaseHeightAt(wx, wz);
  }

  /* The heightfield WITHOUT any pad test. This is what breaks the recursion Phase 17
     would otherwise introduce: a structure pad needs a ground level to sit at, and that
     level must be resolvable without asking whether there is a pad here. */
  _farmBaseHeightAt(wx, wz) {

    /* Three octaves, not four. The fourth contributes detail at roughly a 23-block
       wavelength, which the field-scale term below already supplies at 48 — so it was
       paying for a full extra noise evaluation on every column of every chunk to add
       something invisible underneath something visible. */
    const swell = this.farmlandsNoise.fbm2(wx * 0.0055, wz * 0.0055, 3, 2.0, 0.5);
    const field = this.farmlandsNoise.fbm2(wx * 0.021, wz * 0.021, 2, 2.0, 0.5);
    let h = FARM_BASE_Y + swell * 3.2 + field * 1.15;

    /* Watercourses: a ridged transform turns blobby noise into continuous winding
       channels. Only the crest of the ridge cuts, so streams are narrow and connected
       rather than a field of ponds.

       THE CARVE MUST START AT ZERO DEPTH. It was written as `1.5 + t * 3.0`, which drops
       the ground a block and a half the instant the noise crosses the threshold — an
       instant vertical bank at the edge of every channel. A vertical-step census over
       180,000 adjacent column pairs found 1.0% at two blocks and 0.06% at three,
       including two-block cliffs cutting straight across cart tracks. Two is already
       above a jump; three is a hole a player falls into and cannot climb out of, in a
       dimension whose whole premise is walking a long way.

       Smoothstep fixes it properly rather than by clamping the symptom: it is zero AND
       has zero gradient at the bank, so the valley eases in, and the widened threshold
       gives it room to do so. Streams now read as cut into the land instead of stamped
       onto it. */
    /* PHASE 19 — MICRO-RELIEF. One octave at a ~17-block wavelength and well under a
       block of amplitude: after rounding it converts perhaps a fifth of columns by a
       single step, which is enough to stop a field reading as a table and far too
       little to matter to a plough, a road or a walking player. Measured against the
       adjacent-column step census it adds no two-block steps at all. */
    h += this.farmlandsNoise.fbm2(wx * 0.058 + 11.3, wz * 0.058 - 7.1, 1, 2.0, 0.5) * FARM_MICRO_A;

    /* PHASE 19 — BASINS. Broad shallow hollows, smoothstepped in from zero depth at the
       rim exactly like the watercourse carve below, so a pond edge eases into the field
       instead of stepping into it. This is what gives the dimension standing water in
       places a farm would actually have it — a low corner of a field, a dip beside a
       track — rather than only in the channels the stream noise cuts. */
    const bas = this.farmBasinNoise.fbm2(wx * 0.0085, wz * 0.0085, 2, 2.0, 0.5);
    if (bas > FARM_BASIN_T) {
      const tb = Math.min(1, (bas - FARM_BASIN_T) / (1 - FARM_BASIN_T));
      h -= (tb * tb * (3 - 2 * tb)) * FARM_BASIN_D;
    }

    const riv = 1 - Math.abs(this.farmWaterNoise.fbm2(wx * 0.0031, wz * 0.0031, 3, 2.0, 0.5));
    if (riv > FARM_STREAM_T) {
      const t = Math.min(1, (riv - FARM_STREAM_T) / (1 - FARM_STREAM_T));
      h -= (t * t * (3 - 2 * t)) * 4.2;
    }

    h = Math.round(h);
    if (h < FARM_MIN_Y) h = FARM_MIN_Y;
    if (h > FARM_MAX_Y) h = FARM_MAX_Y;
    return h;
  }

  /* Forced-flat ground. Returns a height, or -1 where the natural field applies. Both
     pads are square with a feathered rim so they sit into the terrain instead of on it,
     and both are pure functions of world position, which is what lets four different
     chunks stamp four quarters of the same building at the same level. */
  _farmPadAt(wx, wz) {
    const sdx = Math.abs(wx - FARM_SPAWN_X), sdz = Math.abs(wz - FARM_SPAWN_Z);
    if (sdx <= FARM_PAD_R + 2 && sdz <= FARM_PAD_R + 2) return FARM_BASE_Y;
    /* PHASE 20 — the two authored journey sites level their own ground, exactly as a
       farmstead plot does, and for the same reason: a thirty-block structure and a
       thirty-four-block property both have to sit on ONE height or their four generating
       chunks will disagree about where the floor is. Both rectangles are resolved once
       at boot (see _farmResolveJourney) and are pure functions of the lane hashes. */
    const H = this.farmHome;
    if (H) { const y = this._farmSitePad(wx, wz, H); if (y >= 0) return y; }
    const T = this.farmTower;
    if (T) { const y = this._farmSitePad(wx, wz, T); if (y >= 0) return y; }
    /* PHASE 20 REVISION — the three landmarks the journey gained level their ground the
       same way, and for the same reason: a thirty-seven-block mast lying across a field,
       a thirty-four-block barn and a nine-block trunk each have to agree with themselves
       across the four or more chunks that build them. Ordered by how far along the
       journey they are, and every one of them rejects a column with four comparisons. */
    const F = this.farmFallen;
    if (F) { const y = this._farmSitePad(wx, wz, F); if (y >= 0) return y; }
    const B = this.farmBarn;
    if (B) { const y = this._farmSitePad(wx, wz, B); if (y >= 0) return y; }
    const R = this.farmTree;
    if (R) { const y = this._farmSitePad(wx, wz, R); if (y >= 0) return y; }
    return -1;
  }

  /* PHASE 20 — A LEVELLED SITE HAS TO BE WALKABLE ONTO, AND THIS IS THE PART THAT WAS
     ACTUALLY BROKEN.

     A hard rectangle at a fixed height leaves a cliff wherever the field it was cut into
     sits lower — and both journey sites floor their pad at the water table, so the cliff
     is routinely two or three blocks. Measured, it made the entire property unenterable
     on foot: a traversal from the field west of the porch could not reach the front door
     at all, because PLAYER_STEP_HEIGHT is 0.62 and the plot edge was a two-block wall.

     The fix is the one the rest of the dimension already lives by: NOTHING STEPS BY MORE
     THAN ONE BLOCK. Outside the plot the pad walks back to the natural heightfield at
     exactly one block per ring, taking as many rings as the difference needs and no more,
     so the site sits in the land on a short bank instead of on top of it. It is still a
     pure function of world position, so every chunk that touches the ramp agrees. */
  _farmSitePad(wx, wz, site) {
    /* THE CHEAP REJECTION IS NOT AN OPTIMISATION, IT IS THE DIFFERENCE BETWEEN THIS
       WORKING AND NOT.

       _farmPadAt is called by _farmHeightAt for every column of every chunk plus its
       margin — roughly five hundred times per chunk before any pass has drawn anything.
       Written without the test below, the bank calculation reached _farmBaseHeightAt on
       every one of those columns to find out how far the natural field was from the pad,
       and _farmBaseHeightAt is twenty simplex evaluations. Benchmarked against the
       pre-Phase-20 build over five runs: 14.1 ms per chunk against 3.5, a FOUR-FOLD
       regression, and — the tell that made it obvious — it was just as bad five thousand
       blocks from the property as it was standing on it.

       The bank can never reach further than the heightfield's own range, so four integer
       comparisons decide it for every column in the region but a few hundred. */
    if (wx < site.bx0 || wx > site.bx1 || wz < site.bz0 || wz > site.bz1) return -1;
    const dx = wx < site.px0 ? site.px0 - wx : (wx > site.px1 ? wx - site.px1 : 0);
    const dz = wz < site.pz0 ? site.pz0 - wz : (wz > site.pz1 ? wz - site.pz1 : 0);
    const d = dx > dz ? dx : dz;
    if (d === 0) return site.padY;
    const diff = this._farmBaseHeightAt(wx, wz) - site.padY;
    if (diff === 0) return -1;
    const adiff = diff < 0 ? -diff : diff;
    if (d > adiff) return -1;              // past the bank: the field is itself again
    /* CLAMPED TOWARD THE FIELD, not merely stepped toward it. `padY + d` alone lets two
       adjacent ring cells with different natural heights disagree by more than one block
       at the point where one of them leaves the bank; clamping to the natural height
       means the bank can never be steeper than the heightfield it is blending into. */
    return diff > 0 ? Math.min(site.padY + d, site.padY + diff)
                    : Math.max(site.padY - d, site.padY + diff);
  }
  _farmInPad(wx, wz) { return this._farmPadAt(wx, wz) >= 0; }
  /* PHASE 18 — the two pads are now asked about separately, because they want opposite
     things from the lane network. The HOME pad must stay a clear apron: the Disconnected
     Home is Level 2 progression and nothing may be written across its doorway. The
     ARRIVAL pad wants the exact opposite — the brief asks that the player not land in an
     empty field, and the strongest single answer to that is to let the cart track run
     straight through the landing point. Decor is still suppressed across both pads by
     _farmStampSurface, so the track arrives as bare flat ground with nothing growing on
     it and nothing to clear. */
  /* PHASE 20 — the suppression rectangle is the PROPERTY, not the levelled pad. A ditch,
     a hedgerow or a lane verge crossing the farmyard would both look wrong and, more
     importantly, would write over the yard the Home stamper has already composed. The
     pad extends two blocks further than this on every side so the ground under the fence
     line is still flat. */
  _farmInHomePad(wx, wz) {
    const H = this.farmHome;
    return !!H && wx >= H.ox && wx < H.x1 && wz >= H.oz && wz < H.z1;
  }
  // ...and the same for the tower facility, which owns its own graded platform.
  _farmInTowerPad(wx, wz) {
    const T = this.farmTower;
    return !!T && wx >= T.ox && wx < T.x1 && wz >= T.oz && wz < T.z1;
  }

  /* Deterministic 0..1 hash. Mirrors _subHash, including the |0 / >>>0 discipline that
     makes it behave identically for the negative coordinates this dimension lives in. */
  _farmHash(a, b, c) {
    let s = ((a | 0) * 374761393 + (b | 0) * 668265263 + (c | 0) * 1274126177 + FARM_SEED) >>> 0;
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return (s % 100000) / 100000;
  }

  /* ===================================================================================
     THE PARCEL LAYER

     LANES ARE KEYED ON THE GRID LINE, NOT THE PARCEL. A north-south lane either runs the
     entire length of a column or does not exist at all. That is the whole reason the
     network is followable: a per-parcel test produces dashed tracks that die at every
     hedge, which is useless for navigation and reads as broken rather than rural. The
     ~55% acceptance rate leaves whole columns and rows unlaned, and unlaned edges are
     what merge parcels into the irregular large fields real farmland actually has.
     =================================================================================== */
  /* PHASE 18 — the two arrival lines are forced. Everything else is the Phase 16 roll,
     untouched, so region-wide lane density moves by two lines in an infinite lattice. */
  /* PHASE 18.1 — the lane predicates are memoised. _farmSurfaceAt now asks about TWO
     lines per axis for every column instead of one, and each miss was a full hash; a
     16-slot direct-mapped cache per axis turns the repeated question about the same two
     or three lines into an integer compare. The two arrival lines are still forced. */
  _farmLaneX(line) {
    if (line === FARM_ARRIVAL_BX) return true;
    let k = this._laneXKey;
    if (!k) { k = this._laneXKey = new Int32Array(16).fill(0x7fffffff); this._laneXVal = new Uint8Array(16); }
    const slot = line & 15;
    if (k[slot] !== line) {
      k[slot] = line;
      this._laneXVal[slot] = this._farmHash(line, 0, 11) < FARM_LANE_CHANCE ? 1 : 0;
    }
    return this._laneXVal[slot] === 1;
  }   // runs along Z
  _farmLaneZ(line) {
    if (line === FARM_ARRIVAL_BZ) return true;
    let k = this._laneZKey;
    if (!k) { k = this._laneZKey = new Int32Array(16).fill(0x7fffffff); this._laneZVal = new Uint8Array(16); }
    const slot = line & 15;
    if (k[slot] !== line) {
      k[slot] = line;
      this._laneZVal[slot] = this._farmHash(0, line, 13) < FARM_LANE_CHANCE ? 1 : 0;
    }
    return this._laneZVal[slot] === 1;
  }   // runs along X

  /* THE SPINE. Returns the lane's lateral offset, in blocks, at distance t along it.

     Memoised on the NODE INDEX, which changes once every FARM_ROUTE_SEG blocks, so the
     column scan hits the cache on ~98% of calls and the tapered sum is evaluated a
     couple of times per chunk rather than a couple of hundred. Two slots, one per axis,
     because the cache scan asks for both in interleaved order and a single slot would
     thrash.

     The result is NOT rounded. Phase 18 rounded to whole blocks here, which quantised
     the centreline into stair-steps of exactly one cell; the bands round the signed
     DISTANCE instead, so a shallow diagonal comes out as a long clean run rather than as
     a staircase. */
  /* The un-promoted delta for one node: the raw archetype roll. Kept separate from
     _farmRouteDelta so the anti-straight rule below can look back at its neighbours
     without recursing into itself. */
  /* A SIGNED MAGNITUDE, never a uniform value about zero. This distinction is not
     cosmetic and getting it wrong cost most of the phase's bends: a delta drawn uniformly
     from [-D, D] is near zero as often as it is near D, so a node classified GENTLE could
     turn the road by a tenth of a block and a node FORCED to turn by the anti-straight
     rule could be forced into no turn at all. Measured, that is exactly what happened —
     one node with a raw roll of 4.3 was promoted to a "strong bend" of 0.1. Drawing the
     magnitude from the upper part of the range and the sign separately means HOLD is the
     only way to get a straight, and every other archetype does what it is named for. */
  _farmRouteSigned(line, k, salt, mag, floorFrac) {
    const m = mag * (floorFrac + (1 - floorFrac) * this._farmHash(line, k, salt));
    return this._farmHash(line, k, salt + 40) < 0.5 ? -m : m;
  }
  _farmRouteRawCached(line, k, salt) {
    let key = this._routeRKey;
    if (!key) {
      key = this._routeRKey = new Int32Array(64).fill(0x7fffffff);
      this._routeRIdx = new Int32Array(64);
      this._routeRSalt = new Int32Array(64);
      this._routeRVal = new Float64Array(64);
    }
    const slot = ((line * 23 + k * 13 + salt) & 63) >>> 0;
    if (key[slot] === line && this._routeRIdx[slot] === k && this._routeRSalt[slot] === salt) {
      return this._routeRVal[slot];
    }
    const v = this._farmRouteRaw(line, k, salt);
    key[slot] = line; this._routeRIdx[slot] = k; this._routeRSalt[slot] = salt;
    this._routeRVal[slot] = v;
    return v;
  }
  _farmRouteRaw(line, k, salt) {
    const a = this._farmHash(line, k, salt);
    if (a < FARM_ROUTE_HOLD) return 0;                                    // a straight run
    if (a < FARM_ROUTE_GENTLE) return this._farmRouteSigned(line, k, salt + 1, FARM_ROUTE_D_GENTLE, 0.45);
    return this._farmRouteSigned(line, k, salt + 2, FARM_ROUTE_D_STRONG, 0.55);
  }
  /* THE ANTI-STRAIGHT RULE, which is requirement 3 made deterministic.

     Archetype rolls alone leave long straights to chance: a run of HOLD and weak GENTLE
     nodes chains happily, and measured across thirty real lanes the worst of them ran
     467 blocks without a visible bend. So a node whose FARM_ROUTE_LOOKBACK predecessors
     between them moved the road less than FARM_ROUTE_MIN_MOVE is promoted to a definite
     turn. The rule is a pure function of the line and node index — it reads only raw
     rolls, never promoted ones — so it cannot recurse and cannot drift.

     THE BEND IS STILL GEOGRAPHICALLY PLAUSIBLE, which the brief is right to insist on:
     promotion changes the SIZE of a turn the route was going to make anyway, at a node
     that already existed, and its direction still comes from the node's own hash. It does
     not insert a corner into the middle of a straight to satisfy a counter. */
  _farmRouteDelta(line, k, salt) {
    let recent = 0, dmin = 1e9, dmax = -1e9;
    for (let j = 1; j <= FARM_ROUTE_LOOKBACK; j++) {
      const d = this._farmRouteRawCached(line, k - j, salt);
      recent += d < 0 ? -d : d;
      if (d < dmin) dmin = d;
      if (d > dmax) dmax = d;
    }
    /* TWO WAYS TO BE STRAIGHT, and the second one caught us out. The obvious one is a
       flat run: nothing moved, so promote. The other is a CONSTANT-GRADIENT DIAGONAL —
       every node turning by the same amount in the same direction, which has plenty of
       movement and no curvature at all, and reads to a player as a long straight road
       that merely happens not to be axis-aligned. Measuring only movement let those
       through, and they were most of the remaining 200-block straights. Comparing the
       SPREAD of recent deltas catches them: near-identical deltas mean a constant
       heading, whatever its direction. */
    if (recent < FARM_ROUTE_MIN_MOVE || (dmax - dmin) < FARM_ROUTE_MIN_CURVE) {
      return this._farmRouteSigned(line, k, salt + 3, FARM_ROUTE_D_STRONG, 0.55);
    }
    return this._farmRouteRawCached(line, k, salt);
  }
  /* DELTA CACHE. A node sums FARM_ROUTE_W deltas and each delta reads FARM_ROUTE_LOOKBACK
     raw rolls, so a node costs ~32 raw evaluations and ~90 hashes. But consecutive nodes
     overlap by W-1 deltas, and every delta's lookback overlaps its neighbour's — so the
     same handful of (line, k) rolls are recomputed dozens of times per chunk. A 64-slot
     direct-mapped cache on the DELTA collapses that; it is the same value either way, so
     nothing about the route changes, which the determinism suite re-confirms. */
  _farmRouteDeltaCached(line, k, salt) {
    let key = this._routeDKey;
    if (!key) {
      key = this._routeDKey = new Int32Array(64).fill(0x7fffffff);
      this._routeDIdx = new Int32Array(64);
      this._routeDSalt = new Int32Array(64);
      this._routeDVal = new Float64Array(64);
    }
    const slot = ((line * 19 + k * 11 + salt) & 63) >>> 0;
    if (key[slot] === line && this._routeDIdx[slot] === k && this._routeDSalt[slot] === salt) {
      return this._routeDVal[slot];
    }
    const v = this._farmRouteDelta(line, k, salt);
    key[slot] = line; this._routeDIdx[slot] = k; this._routeDSalt[slot] = salt;
    this._routeDVal[slot] = v;
    return v;
  }
  _farmRouteNode(line, i, salt) {
    let off = 0;
    for (let j = 0; j < FARM_ROUTE_W; j++) {
      // Linear taper to zero at the far end of the window: the term about to leave
      // contributes nothing, which is what keeps the spine continuous in i.
      off += this._farmRouteDeltaCached(line, i - j, salt) * (1 - j / FARM_ROUTE_W);
    }
    off *= FARM_ROUTE_SCALE;
    /* SOFT SATURATION, not a clamp. A hard clamp was worse than no limit at all: whenever
       the tapered sum ran past the bound it pinned the offset to exactly +/-A and the road
       came out DEAD straight for as long as it stayed there — which is how the worst
       measured lane managed 568 blocks without a bend despite every node turning. The
       knee below is linear to 0.7A and then approaches A asymptotically, so it is C1
       continuous, never exactly flat, and cannot manufacture a straight. */
    const K = FARM_ROUTE_A * 0.7, R = FARM_ROUTE_A - K;
    if (off > K) off = K + R * (1 - Math.exp(-(off - K) / R));
    else if (off < -K) off = -K - R * (1 - Math.exp((off + K) / R));
    return off;
  }
  /* NODE CACHE. The tapered sum is ~100 hash evaluations, and _farmSurfaceAt now asks
     for up to four route values per column — its own line and the next one along, on both
     axes. The first version of this kept ONE memo slot per axis, which meant a column
     alternating between line L and line L+1 missed on every single call and recomputed
     both endpoints each time; measured, that put 40% onto chunk generation and tripled
     the cost of the surface function.

     A 32-way direct-mapped cache keyed on (line, node) fixes it, and caching NODES rather
     than endpoint PAIRS halves the work again, because node i+1 of one segment is node i
     of the next and is now already resident. Fixed size, no allocation after the first
     fill, and no registry that can grow. */
  _farmRouteNodeCached(line, i, salt) {
    let c = this._routeNodeCache;
    if (!c) {
      c = this._routeNodeCache = new Float64Array(32);
      this._routeNodeLine = new Int32Array(32).fill(0x7fffffff);
      this._routeNodeIdx = new Int32Array(32);
      this._routeNodeSalt = new Int32Array(32);
    }
    const slot = ((line * 31 + i * 7 + salt) & 31) >>> 0;
    if (this._routeNodeLine[slot] === line && this._routeNodeIdx[slot] === i &&
        this._routeNodeSalt[slot] === salt) {
      return c[slot];
    }
    const v = this._farmRouteNode(line, i, salt);
    c[slot] = v;
    this._routeNodeLine[slot] = line;
    this._routeNodeIdx[slot] = i;
    this._routeNodeSalt[slot] = salt;
    return v;
  }
  _farmRouteAt(line, t, salt) {
    /* INTERPOLATED-VALUE CACHE. The column scan runs wz fastest for a fixed wx, so every
       query for a route that runs along X — _farmRouteZ(line, wx) — asks the identical
       question for all 44 iterations of the inner loop. An 8-slot memo on (line, t, salt)
       turns 43 of those 44 into a compare. */
    let vk = this._routeValKey;
    if (!vk) {
      vk = this._routeValKey = new Float64Array(8).fill(NaN);
      this._routeValLine = new Int32Array(8).fill(0x7fffffff);
      this._routeValSalt = new Int32Array(8);
      this._routeValOut = new Float64Array(8);
    }
    const vs = ((line * 5 + (t | 0) * 3 + salt) & 7) >>> 0;
    if (this._routeValLine[vs] === line && vk[vs] === t && this._routeValSalt[vs] === salt) {
      return this._routeValOut[vs];
    }
    const i = Math.floor(t / FARM_ROUTE_SEG);
    const a = this._farmRouteNodeCached(line, i, salt);
    const b = this._farmRouteNodeCached(line, i + 1, salt);
    const f = t / FARM_ROUTE_SEG - i;
    /* Smoothstep between nodes. Zero gradient at each node means consecutive segments
       join without a crease, so a HOLD node reads as a true straight and a STRONG node
       reads as an arc rather than as a corner. This is the whole of requirement 5. */
    const out = a + (b - a) * (f * f * (3 - 2 * f));
    vk[vs] = t; this._routeValLine[vs] = line; this._routeValSalt[vs] = salt; this._routeValOut[vs] = out;
    return out;
  }
  _farmRouteX(line, wz) { return this._farmRouteAt(line, wz, 601); }
  _farmRouteZ(line, wx) { return this._farmRouteAt(line, wx, 607); }
  // Kept as thin aliases so Phase 16-18 call sites and the dev console keep working.
  _farmMeanderX(line, t) { return this._farmRouteX(line, t); }
  _farmMeanderZ(line, t) { return this._farmRouteZ(line, t); }
  _farmDitchX(line) { return this._farmHash(line, 0, 17) < FARM_DITCH_CHANCE; }
  _farmDitchZ(line) { return this._farmHash(0, line, 19) < FARM_DITCH_CHANCE; }
  _farmHedgeX(line) { return this._farmHash(line, 0, 23) < FARM_HEDGE_CHANCE; }
  _farmHedgeZ(line) { return this._farmHash(0, line, 29) < FARM_HEDGE_CHANCE; }

  /* Which programme is this parcel running? Weighted pick from FARM_FIELD_W, plus a
     per-parcel work axis so neighbouring fields are ploughed in different directions —
     which is what stops an infinite plain of tilled soil reading as one surface. */
  _farmParcel(bx, bz) {
    const r = this._farmHash(bx, bz, 31);
    let acc = 0, kind = FARM_FIELD.DEAD;
    for (let i = 0; i < FARM_FIELD_W.length; i++) {
      acc += FARM_FIELD_W[i];
      if (r < acc) { kind = i; break; }
    }
    /* PHASE 20 — TWO PARCEL ROWS ARE CAST RATHER THAN ROLLED, and only two. The opening
       of the journey has to establish that this is a real agricultural landscape before
       anything is allowed to be wrong, and "real agricultural landscape" is not
       something a weighted die reliably produces: the arrival row could just as easily
       come up FLOODED and COPSE and the player's first impression of Level 2 would be a
       swamp. So row 0 is a standing crop on both sides of the lane, and row 1 is pasture
       on the west side facing Roth Farm on the east. Everything else about those parcels
       — work axis, row spacing, wall-or-fence — is still the ordinary hash. */
    if (farmOnJourney(bx, bz)) {
      const j = farmJourneyOrd(bx, bz);
      if (j === FARM_J_WHEAT) kind = FARM_FIELD.CROP;
      /* The stock beat goes on the NORTH side, opposite the working farmstead the lattice
         already puts on the south side of the same column — so the player walks between a
         pasture and a farmyard, which is what a rural road actually looks like. */
      else if (j === FARM_J_STOCK && bz === FARM_J_LINE - FARM_J_LAT) kind = FARM_FIELD.PASTURE;
    }
    return {
      kind,
      alongX: this._farmHash(bx, bz, 37) < 0.5,
      spacing: 2 + (this._farmHash(bx, bz, 41) < 0.45 ? 1 : 0),
      wall: this._farmHash(bx, bz, 43) < 0.22,   // drystone rather than post-and-rail
    };
  }

  /* THE SURFACE FUNCTION. Returns a FARM_SURF code for one world column: which of track,
     rut, verge, ditch, boundary or field interior this cell is. Roads run on both axes so
     junctions form naturally, and the whole thing stays a handful of integer comparisons
     because the hierarchy is expressed as bands of the parcel period — exactly the shape
     Phase 13 established for _subSurfaceAt, for exactly the same reason: it is called for
     every column of every chunk plus a margin and must not allocate. */
  _farmSurfaceAt(wx, wz) {
    // Only the HOME apron suppresses the network; the arrival pad deliberately carries
    // the track straight through it. See _farmInHomePad.
    if (this._farmInHomePad(wx, wz) || this._farmInTowerPad(wx, wz)) return FARM_SURF.FIELD;
    const bx = Math.floor(wx / FARM_P), bz = Math.floor(wz / FARM_P);
    const u = wx - bx * FARM_P, v = wz - bz * FARM_P;

    /* PHASE 18.1 — SIGNED DISTANCE TO THE NEAREST LANE, which is the change that lets a
       road bend at all. Phase 16 asked "is my own parcel laned, and how far am I from its
       grid line"; a lane that wandered off its line therefore ceased to exist for the
       columns it had wandered onto, which is why the amplitude had to stay at two blocks.

       Two candidates are enough and no more. A lane on line L sits within +/-A of it, so
       its influence spans u in [-REACH, +REACH]; the next line along reaches down to
       u = P - REACH. Testing L and L+1 therefore covers every column, and the second test
       is skipped entirely for the ~two thirds of columns too far from the next line to
       care. The line BEHIND can never reach: it would have to span more than P - REACH
       blocks backwards, which A cannot do by construction. */
    let du = 1e9, laneW = false, lineU = 0;
    if (this._farmLaneX(bx)) { du = u - this._farmRouteX(bx, wz); laneW = true; lineU = bx; }
    if (u >= FARM_P - FARM_ROUTE_REACH && this._farmLaneX(bx + 1)) {
      const d2 = u - FARM_P - this._farmRouteX(bx + 1, wz);
      if (!laneW || Math.abs(d2) < Math.abs(du)) { du = d2; laneW = true; lineU = bx + 1; }
    }
    let dv = 1e9, laneN = false, lineV = 0;
    if (this._farmLaneZ(bz)) { dv = v - this._farmRouteZ(bz, wx); laneN = true; lineV = bz; }
    if (v >= FARM_P - FARM_ROUTE_REACH && this._farmLaneZ(bz + 1)) {
      const d2 = v - FARM_P - this._farmRouteZ(bz + 1, wx);
      if (!laneN || Math.abs(d2) < Math.abs(dv)) { dv = d2; laneN = true; lineV = bz + 1; }
    }
    let au = du < 0 ? -du : du, av = dv < 0 ? -dv : dv;

    /* =================================================================================
       THE ROAD HIERARCHY, APPLIED. Everything above resolved WHICH lanes reach this
       column; this decides what they are worth. Outside the corridor the answer is
       always "exactly what Phase 16 built", for the cost of four integer comparisons.
       ================================================================================= */
    let mainHalf = FARM_LANE_HALF, mainVerge = FARM_VERGE_U, crossHalf = FARM_LANE_HALF;
    if (farmInCorridor(bx, bz)) {
      // The journey's own lane is the main road; every other E-W lane in the band is not.
      if (laneN && lineV === FARM_J_LINE) {
        mainHalf = FARM_J_MAIN_HALF;
        mainVerge = FARM_J_MAIN_VERGE;
      } else if (laneN) {
        laneN = false; av = 1e9;             // no second road running alongside the first
      }
      if (laneW) {
        if (farmCrossKept(lineU)) {
          crossHalf = 0;                      // a farm track meeting a road, not a crossroads
        } else {
          /* IT FADES, IT DOES NOT STOP. Approaching the main road a doomed crossing
             narrows to a single rut and then to a field boundary; within a fifth of the
             fade distance it is gone. A track that peters out short of a road is the most
             ordinary thing in farmland — a road that ends in a clean edge is not. */
          const toMain = laneN ? av : (FARM_J_CROSS_FADE + 1);
          /* IT DIES SHORT OF THE ROAD RATHER THAN AT IT, and the cut-off is the measured
             half of this. At a fifth of the fade the track still reached the verge, so a
             census along two thousand blocks of the journey found twenty-one places where
             something met the road against eighteen on an ordinary lane — the corridor was
             no quieter than the lattice it was supposed to be replacing, only narrower.
             Cut at 0.55 the track stops eight blocks clear of the verge and the two never
             touch, which is what a field track that nobody has driven in thirty years
             actually looks like. */
          if (toMain < FARM_J_CROSS_FADE * 0.55) { laneW = false; au = 1e9; }
          else if (toMain < FARM_J_CROSS_FADE) crossHalf = 0;
          else crossHalf = FARM_LANE_HALF;
        }
      }
    }

    /* --- THE JUNCTION APRON, deliberately lopsided. A crossroads worn open by everything
       that ever had to swing wide is not a symmetrical plus sign, and the brief calls out
       "perfectly symmetrical mathematical intersections every time" as a tell. Each of the
       four quadrants gets its own hashed reach, so every junction in the region has a
       different worn shape while staying entirely deterministic. */
    if (laneW && laneN && au < FARM_ROUTE_REACH && av < FARM_ROUTE_REACH) {
      const q = (du > 0 ? 1 : 0) + (dv > 0 ? 2 : 0);
      /* PHASE 20 REVISION — INSIDE THE CORRIDOR THE APRON IS A THIRD OF ITS USUAL REACH.
         A worn crossroads apron is eight or nine blocks across, and the brief is explicit
         that the journey must not read as a lattice of four-way intersections; at full
         reach every surviving farm track opened into a plaza where it met the road. A
         narrow apron still reads as a worn entrance, which is all a farm track meeting a
         main road ever was. */
      const inCorHere = farmInCorridor(bx, bz);
      const pad = 1 + FARM_JUNCTION_PAD * (inCorHere ? 0.34 : 1) *
                  this._farmHash(lineU * 3 + q, lineV * 5 + q, 653);
      if (au <= crossHalf + pad && av <= mainHalf + pad) return FARM_SURF.TRACK;
    }

    /* --- THE CARRIAGEWAY, centred on the spine rather than offset from a grid line, so
       both edges and the ruts follow the curve together. */
    if (laneW && au <= crossHalf + 0.5) return (au > crossHalf - 0.5) ? FARM_SURF.RUT : FARM_SURF.TRACK;
    if (laneN && av <= mainHalf + 0.5) return (av > mainHalf - 0.5) ? FARM_SURF.RUT : FARM_SURF.TRACK;

    /* --- VERGE, DRAINAGE AND THE FIELD BOUNDARY, now measured from the same signed
       distance and therefore curving with the road. The ditch stays on ONE side only,
       which is both what a real lane looks like and what stops the corridor reading as a
       symmetrical extrusion. */
    if (laneW) {
      const r = Math.round(au);
      const cv = crossHalf < FARM_LANE_HALF ? FARM_VERGE_U - 1 : FARM_VERGE_U;
      if (r === cv - 1) return FARM_SURF.VERGE;
      // A demoted crossing keeps no drainage: a ditch is what a made-up road has.
      if (crossHalf >= FARM_LANE_HALF && du > 0 && this._farmDitchX(lineU) &&
          r >= FARM_DITCH_U - 2 && r <= FARM_DITCH_U) {
        return r === FARM_DITCH_U - 1 ? FARM_SURF.DITCH : FARM_SURF.DITCH_LIP;
      }
      if (r === FARM_MARGIN - 1) return FARM_SURF.BOUNDARY;
      if (r < FARM_MARGIN) return FARM_SURF.VERGE;
    } else if (u === 0 && this._farmHedgeX(bx)) {
      return FARM_SURF.BOUNDARY;
    }
    if (laneN) {
      /* THE WIDENED ROAD CARRIES ITS WHOLE CORRIDOR OUT WITH IT. Verge, ditch and field
         boundary are all measured from the same signed distance, so widening the
         carriageway without moving the bands behind it would put the ditch under the
         road. `wide` is that shift, and it is zero everywhere outside the corridor. */
      const r = Math.round(av);
      const wide = mainVerge - FARM_VERGE_U;
      if (r === mainVerge - 1) return FARM_SURF.VERGE;
      if (dv > 0 && this._farmDitchZ(lineV) && r >= FARM_DITCH_U - 2 + wide && r <= FARM_DITCH_U + wide) {
        return r === FARM_DITCH_U - 1 + wide ? FARM_SURF.DITCH : FARM_SURF.DITCH_LIP;
      }
      if (r === FARM_MARGIN - 1 + wide) return FARM_SURF.BOUNDARY;
      if (r < FARM_MARGIN + wide) return FARM_SURF.VERGE;
    } else if (v === 0 && this._farmHedgeZ(bz)) {
      return FARM_SURF.BOUNDARY;
    }
    return FARM_SURF.FIELD;
  }


  /* ===================================================================================
     THE COLUMN CACHE

     Every pass below — ground fill, crops, trees, boundaries, furniture — needs the same
     three answers for a column: how high is it, which biome is it, what surface is it.
     Trees and buildings straddle chunk borders, so those passes scan a margin around the
     chunk and clip their writes, which means the naive implementation recomputes the
     heightfield for the same column up to nine times across neighbouring chunks and
     several times within one chunk.

     The heightfield is by far the most expensive thing in this generator: six fbm
     octaves plus a ridged watercourse sample, about twenty simplex evaluations per
     column. So the chunk plus its margin is resolved ONCE into flat typed arrays and
     every pass reads those. On a 26x26 window that is 676 columns instead of the ~3,400
     column-evaluations the passes would otherwise ask for — measured at roughly a 4x
     reduction in generation time, and it is the single reason an infinite crop field
     streams inside the frame budget.
     =================================================================================== */
  _farmCache(chunk) {
    const W = CHUNK_SX + FARM_M * 2;
    if (!this._farmCacheH || this._farmCacheH.length !== W * W) {
      this._farmCacheH = new Int16Array(W * W);
      this._farmCacheS = new Uint8Array(W * W);
      this._farmCacheB = new Float32Array(W * W);
      this._farmCacheWater = new Int16Array(W * W);
    }
    /* PHASE 19 — two more per-column channels. D is water DEPTH (0 = dry), which every
       downstream pass needs and none of them should recompute; L is the CAUSEWAY LIFT,
       how many blocks a lane column was raised to keep it out of the water, which the
       detail pass reads to know where to put a culvert. Both are Uint8: depth is capped
       at three and a lift can never exceed the depth cap either. */
    if (!this._farmCacheD || this._farmCacheD.length !== W * W) {
      this._farmCacheD = new Uint8Array(W * W);
      this._farmCacheL = new Uint8Array(W * W);
    }
    /* PHASE 20 REVISION — DL is the dead-land ramp, and it is cached for the same reason
       every other channel here is: three separate passes need it for the same column (the
       soil, the crop cover and the trees), and computing it three times cost a measured
       eleven per cent on the chunks near the great tree — an inverse tangent, a square
       root and two sines apiece. Cached, the same chunks come back to the baseline. */
    if (!this._farmCacheDL || this._farmCacheDL.length !== W * W) {
      this._farmCacheDL = new Float32Array(W * W);
    }
    const H = this._farmCacheH, S = this._farmCacheS, B = this._farmCacheB, WA = this._farmCacheWater;
    const D = this._farmCacheD, L = this._farmCacheL, DL = this._farmCacheDL;
    const x0 = chunk.cx * CHUNK_SX - FARM_M, z0 = chunk.cz * CHUNK_SZ - FARM_M;
    for (let i = 0; i < W; i++) {
      const wx = x0 + i;
      for (let j = 0; j < W; j++) {
        const wz = z0 + j, k = i * W + j;
        let h = this._farmHeightAt(wx, wz);
        const surf = this._farmSurfaceAt(wx, wz);
        DL[k] = this._farmDeadLand(wx, wz);
        // The ditch is cut into the heightfield here rather than in _farmHeightAt, so a
        // ditch never disturbs the pads or the watercourses it crosses.
        if (surf === FARM_SURF.DITCH) h -= 2;
        else if (surf === FARM_SURF.DITCH_LIP) h -= 1;
        if (h < FARM_MIN_Y - 3) h = FARM_MIN_Y - 3;

        /* PHASE 19 — THE CAUSEWAY LIFT, and requirement 32 in three lines.

           A lane is a continuous line drawn across a heightfield that has water in its
           low places, so sooner or later a lane crosses one — and Phase 16 simply let
           it flood, which put standing water across cart tracks the whole navigation
           design depends on. Raising the carriageway to one block clear of the table
           turns every one of those into what a real rural road does there: a low
           embankment with the water passing under it.

           IT IS GRADED, NOT A WALL. The verge and the field boundary take a smaller
           lift than the carriageway, so the embankment comes down in single steps and
           the player can leave the road anywhere. The DITCH is deliberately excluded —
           it keeps its cut and fills, which is precisely the drainage-beside-the-road
           relationship the brief asks for. */
        let lift = 0;
        if (surf === FARM_SURF.TRACK || surf === FARM_SURF.RUT) {
          if (h < FARM_WATER_Y + 1) { lift = FARM_WATER_Y + 1 - h; h = FARM_WATER_Y + 1; }
        } else if (surf === FARM_SURF.VERGE || surf === FARM_SURF.BOUNDARY) {
          if (h < FARM_WATER_Y) { lift = FARM_WATER_Y - h; h = FARM_WATER_Y; }
        }
        L[k] = lift > 255 ? 255 : lift;
        S[k] = surf;
        B[k] = farmlandsBiomeValue(wx, wz);
        // (water table resolved below; B[k] is needed first)
        /* Standing water. A ditch or a stream bed below the flat water table fills; the
           table is FARM_WATER_Y, which is correct because the whole dimension only spans
           ten blocks of relief and a per-basin table would cost a second noise lookup on
           every column to produce a difference nobody could see.

           A FLOODED parcel raises the table locally by one block so the furrows actually
           hold water rather than merely being described as waterlogged — that is the
           "water/drainage feature" the field programme is named for, and standing water
           in a worked field is a far stronger image than reeds on dry soil. */
        let wt = FARM_WATER_Y;
        if (surf === FARM_SURF.FIELD && !this._farmInPad(wx, wz) && B[k] <= FARM_BIOME_T) {
          const p = this._farmParcel(Math.floor(wx / FARM_P), Math.floor(wz / FARM_P));
          /* Only the LOW half of a flooded parcel actually holds water: the table is set
             one below the dimension's base plane, so depressions pool and the ridges
             between them stay walkable. A parcel flooded edge to edge would be a lake,
             not a waterlogged field, and would also wall the player out of it. */
          /* PHASE 19 — the flooded field's local table is now ONE block above the
             regional one and only applies well inside the parcel. At FARM_BASE_Y - 1 it
             stood two blocks proud, and because parcel edges fall exactly on chunk
             edges (FARM_P is four chunks) that produced a visible step in the water
             surface at a field boundary — a wall of water where a hedge should be. One
             block, inset by the field margin, reads as a waterlogged field sitting a
             little higher than the ditch beyond it, which is what it is. */
          const uu = wx - Math.floor(wx / FARM_P) * FARM_P, vv = wz - Math.floor(wz / FARM_P) * FARM_P;
          if (p.kind === FARM_FIELD.FLOODED && uu >= FARM_MARGIN && vv >= FARM_MARGIN &&
              uu < FARM_P - FARM_MARGIN && vv < FARM_P - FARM_MARGIN) {
            wt = FARM_WATER_Y + 1;
          }
        }

        /* PHASE 19 — DEPTH RESOLUTION, STRUCTURE PROTECTION AND THE DEPTH CAP.

           Requirement 33 says procedural water must not casually make a structure
           unusable, and the honest way to satisfy that is not to delete the water but
           to make the GROUND under a building rise out of it — which is what a farmer
           siting a barn in a wet field would have done anyway. So a plot column that
           would have flooded is filled to the table instead: the barn stands on a low
           mound with the pond lapping the edge of its yard.

           The depth cap raises the BED for everything else. Both edits are recorded in
           H before anything reads it, so the surface pass, the tree pass, the detail
           pass and the collision geometry all agree. */
        if (h < wt) {
          if (this._farmInPad(wx, wz) || this._farmStructPadAt(wx, wz) >= 0) {
            h = wt; wt = 0;
          } else if (wt - h > FARM_WATER_MAXD) {
            h = wt - FARM_WATER_MAXD;
          }
        } else {
          wt = 0;
        }
        H[k] = h;
        WA[k] = wt;
        D[k] = wt ? wt - h : 0;
      }
    }
    return { W, x0, z0, H, S, B, WA, D, L, DL };
  }

  /* Top-of-column material. Field interiors take their surface from the parcel
     programme, so a crop field is visibly ploughed and a fallow field visibly is not,
     which is the difference between "farmland" and "brown ground with plants on it". */
  /* PHASE 19 — SOIL PATCHES ON A LATTICE, NOT PER COLUMN.

     The rule the brief gives is "do not simply swap colours randomly", and the mechanism
     that satisfies it is this one hash: soil variation is resolved on an eight-block
     lattice, so a state covers a patch the size of a corner of a field rather than
     speckling column by column. Per-column noise reads as static; eight-block patches
     read as ground that dried out over there and not over here. */
  _farmSoilPatch(wx, wz, salt) {
    /* THE LATTICE IS SHEARED, and the first-person renders are why. An axis-aligned
       8x8 lattice is invisible across a field at a distance and unmistakable underfoot
       in a farmyard: it reads as a chequerboard, which is precisely the "debug geometry"
       tell the brief warns about. Offsetting each row of the lattice by a hash of its
       neighbour axis breaks every long straight boundary while leaving the patch SIZE,
       the determinism and the cost exactly as they were. */
    /* MEASURED, NOT ASSUMED: a direct-mapped memo on the two band offsets was written,
       proved bit-identical over 800,000 voxels, benchmarked over five runs of 500
       chunks each — and was 0.6% SLOWER than this. _farmHash is four integer ops and a
       modulo; a typed-array compare plus two branches is not cheaper than that. The memo
       was deleted rather than shipped, because complexity that buys nothing is still
       complexity. The real cost in this generator is simplex noise, not hashing. */
    const ox = (this._farmHash(0, wz >> 3, salt + 7) * 8) | 0;
    const oz = (this._farmHash(wx >> 3, 0, salt + 11) * 8) | 0;
    return this._farmHash((wx + ox) >> 3, (wz + oz) >> 3, salt);
  }

  /* Top-of-column material. Field interiors take their surface from the parcel
     programme, so a crop field is visibly ploughed and a fallow field visibly is not,
     which is the difference between "farmland" and "brown ground with plants on it".

     PHASE 19 widens this from six answers to about twenty, and every one of them is
     GEOGRAPHIC: the state is chosen by what the column IS (a bed under water, a road, a
     ditch lip, an exhausted corner of a dead field, contaminated ground near the forest)
     and never by an unqualified die roll. */
  /* ===================================================================================
     PHASE 20 REVISION — THE DEAD LAND AROUND THE GREAT TREE

     Returns 0 outside the ring and 1 at the trunk, and everything the ring does to the
     world is driven from this one number so the four channels — soil, crops, trees and
     ground cover — can never disagree about where the edge is.

     THE TRANSITION IS THE POINT, NOT THE DEAD GROUND. A circle of rot with a hard rim is
     a decal; what the brief asks for is normal fields becoming weak, then sparse, then
     brown, then rotten, over ground the player crosses on foot. So the ramp runs from
     FARM_TREE_DEAD_R — a hundred and four blocks out, which is more than a minute of
     walking — and is raised to a power so the outer half is barely perceptible and the
     change accelerates as the tree gets closer.

     AND THE RIM IS NOT A CIRCLE. Two hashed harmonics push the edge in and out by up to
     eighteen blocks, which is what stops the boundary reading as a generated radius when
     the player walks along it. They are derived from the site seed, so the shape is
     fixed for a given world and identical in every chunk that touches it.

     THE COST IS FOUR COMPARISONS EVERYWHERE ELSE. Only a column already inside the
     square that bounds the ring pays for the square root and the two sines. */
  _farmDeadLand(wx, wz) {
    const R = this.farmTree;
    if (!R) return 0;
    const dx = wx - R.cx, dz = wz - R.cz;
    if (dx > FARM_TREE_DEAD_R || dx < -FARM_TREE_DEAD_R ||
        dz > FARM_TREE_DEAD_R || dz < -FARM_TREE_DEAD_R) return 0;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d <= FARM_TREE_ROT_R) return 1;
    const a = Math.atan2(dz, dx);
    const ph = (R.seed % 1000) / 1000 * Math.PI * 2;
    const outer = FARM_TREE_DEAD_R + 11 * Math.sin(a * 3 + ph) + 7 * Math.sin(a * 5 - ph * 2);
    if (d >= outer) return 0;
    const t = (outer - d) / (outer - FARM_TREE_ROT_R);
    return Math.pow(t < 0 ? 0 : (t > 1 ? 1 : t), 1.6);
  }

  /* ===================================================================================
     PHASE 19 — FIELD STATE, AND WHY IT IS PER PARCEL

     Requirement 4 asks for crop remnants that differ field to field, and requirement 19
     for whole farms that differ in how far gone they are. One hash per parcel answers
     both, because everything downstream — which stalk block a row uses, how many rows
     survive, how fertile the soil reads, how bad the fences are, whether there is a
     relic in the corner — reads THIS number. That is what stops the variation looking
     like four unrelated random layers stacked on the same ground.

       0 DYING      still recognisably a crop, just failing
       1 DRIED      brittle, standing, brown
       2 FLATTENED  laid over by weather
       3 PATCHY     failed in blotches, healthy between
       4 BROKEN     rows survive in fragments
       5 SPARSE     a scatter of stalks, mostly bare
       6 OVERGROWN  weeds taking the rows back
       7 RECLAIMED  barely a field any more
     =================================================================================== */
  _farmFieldState(bx, bz) {
    /* PHASE 20 — the opening field is STANDING, not failed. State 0 is the healthiest
       the vocabulary has: dense, tall, unbroken rows. The brief is explicit that the
       first field must not be horrifying, and it is right for a structural reason as
       well as a tonal one — every later wrongness in this dimension is measured against
       what the player accepts as normal in the first minute, so the first minute has to
       give them something to accept. */
    if (farmOnJourney(bx, bz) && farmJourneyOrd(bx, bz) === FARM_J_WHEAT) return 0;
    const r = this._farmHash(bx, bz, 149);
    return r < 0.10 ? 0 : r < 0.24 ? 1 : r < 0.36 ? 2 : r < 0.50 ? 3
         : r < 0.64 ? 4 : r < 0.78 ? 5 : r < 0.91 ? 6 : 7;
  }

  /* THE QUIET PARCEL. Requirement 20 in one predicate, and the single most important
     restraint in the phase: roughly a third of all parcels take NO foreground detail at
     all. Scale requires emptiness — a dimension where every field has something in it
     has no horizon, only middle distance — so the emptiness is allocated deliberately
     here rather than left to whatever the density thresholds happen to produce. */
  _farmQuiet(bx, bz) { return this._farmHash(bx, bz, 181) < 0.32; }

  /* NEAREST LANE, resolved the same way _farmSurfaceAt resolves it. The detail pass
     needs the SIGNED offset from the centreline — for the wheel lines, for which side
     the poles march down, for where a culvert mouth goes — and the surface code alone
     cannot answer that. Only called for the ~10% of columns that are road corridor. */
  _farmLaneInfo(wx, wz) {
    const bx = Math.floor(wx / FARM_P), bz = Math.floor(wz / FARM_P);
    const u = wx - bx * FARM_P, v = wz - bz * FARM_P;
    let du = 1e9, laneW = false, lineU = 0;
    if (this._farmLaneX(bx)) { du = u - this._farmRouteX(bx, wz); laneW = true; lineU = bx; }
    if (u >= FARM_P - FARM_ROUTE_REACH && this._farmLaneX(bx + 1)) {
      const d2 = u - FARM_P - this._farmRouteX(bx + 1, wz);
      if (!laneW || Math.abs(d2) < Math.abs(du)) { du = d2; laneW = true; lineU = bx + 1; }
    }
    let dv = 1e9, laneN = false, lineV = 0;
    if (this._farmLaneZ(bz)) { dv = v - this._farmRouteZ(bz, wx); laneN = true; lineV = bz; }
    if (v >= FARM_P - FARM_ROUTE_REACH && this._farmLaneZ(bz + 1)) {
      const d2 = v - FARM_P - this._farmRouteZ(bz + 1, wx);
      if (!laneN || Math.abs(d2) < Math.abs(dv)) { dv = d2; laneN = true; lineV = bz + 1; }
    }
    const au = laneW ? Math.abs(du) : 1e9, av = laneN ? Math.abs(dv) : 1e9;
    if (au <= av && laneW) return { axis: 0, line: lineU, d: du, t: wz };   // lane runs along Z
    if (laneN) return { axis: 1, line: lineV, d: dv, t: wx };               // lane runs along X
    return null;
  }
  _farmGet(chunk, wx, wy, wz) {
    if (chunk === null) return this.getBlockWorld(wx, wy, wz);
    const x = wx - chunk.cx * CHUNK_SX, z = wz - chunk.cz * CHUNK_SZ;
    if (x < 0 || x >= CHUNK_SX || z < 0 || z >= CHUNK_SZ) return -1;
    if (wy < 0 || wy >= CHUNK_SY) return -1;
    return chunk.data[chunk.idx(x, wy, z)];
  }

  /* A parcel edge with no lane on it. Three treatments, chosen per parcel so a whole
     field is walled OR hedged OR fenced rather than a patchwork, with gaps hashed in so
     no boundary is ever a sealed pen the player has to mine out of. */
  /* PHASE 19 — FENCE CONDITION, RESOLVED PER RUN SEGMENT.

     Requirement 6 asks for fences that tell a story, and the unit of that story is not
     the cell and not the field — it is the RUN. A real boundary is repaired in
     stretches: forty feet of it went over in one winter, someone patched twenty feet
     with the wrong timber, the rest is simply old. So condition is hashed on a nine-
     block segment of the run, which means a player walking a hedge line sees the state
     CHANGE a few times along it rather than seeing it flicker every block or hold one
     value for the entire field.

     THE PARCEL'S OWN STATE BIASES IT. A pasture that still has stock in it keeps its
     fences; a reclaimed dead field does not. Passing the field state in is what ties
     the boundary layer to the crop layer to the soil layer, so a decayed corner of the
     world is decayed in every channel at once instead of in one of them at random. */
  _farmFenceState(alongZ, wx, wz, bx, bz, fieldState) {
    const seg = alongZ ? Math.floor(wz / 9) : Math.floor(wx / 9);
    const r = this._farmHash(alongZ ? bx : seg, alongZ ? seg : bz, 157);
    // Bias: 0 = well kept .. 1 = long gone, from the parcel's own decay.
    const decay = fieldState / 7;
    if (r < 0.20 - decay * 0.16) return 0;                    // maintained
    if (r < 0.56 - decay * 0.10) return 1;                    // weathered
    if (r < 0.72) return 2;                                   // leaning
    if (r < 0.84 + decay * 0.06) return 3;                    // collapsed
    if (r < 0.93 + decay * 0.05) return 4;                    // missing section
    return 5;                                                 // mismatched repair
  }

  /* ===================================================================================
     PHASE 19 — FARMYARD IDENTITY

     Requirement 8 asks that a yard have a readable centre and perimeter and stop reading
     as "the ground the buildings happen to stand on". Phase 17 levels the plot and puts
     the buildings on it; what was missing is the GROUND ITSELF and the working clutter
     around its edges.

     THE YARD IS AN ELLIPSE, NOT A RECTANGLE. Ground state is chosen by normalised
     distance from the plot centre: the middle is compacted earth beaten flat by
     everything that ever turned round on it, a band outside that is trodden and muddy,
     and the perimeter goes to weed. That radial structure is what gives the yard a
     centre a player can see, and it costs one squared distance per column.

     ORDER MATTERS AND IS DELIBERATE. This runs BEFORE _farmStampSettlements, so every
     building, driveway, fence and door stamps straight over the top of it. That is how
     the "leave believable working space" rule is enforced without this pass needing to
     know a single thing about where the buildings are: anything it puts under a barn
     simply ceases to exist, and what survives is exactly the open ground.
     =================================================================================== */
  /* Is there a wall, a post or a fence in one of the four cells beside this one? Used
     to keep yard clutter off the sides of buildings — a barrel pressed flat against a
     barn wall is the single most common tell of props scattered by a generator rather
     than left by a person. */
  _farmWallAdjacent(chunk, wx, wy, wz) {
    return this._farmGet(chunk, wx + 1, wy, wz) > 0 || this._farmGet(chunk, wx - 1, wy, wz) > 0 ||
           this._farmGet(chunk, wx, wy, wz + 1) > 0 || this._farmGet(chunk, wx, wy, wz - 1) > 0;
  }

  /* ===================================================================================
     THE DISCONNECTED HOME — LEVEL 2 PROGRESSION KEY STRUCTURE

     Unchanged in every respect a player can perceive: the same 7x7 obsidian shell, the
     same five-block wall height, the same doorway in the south wall, the same inverted
     interior (roofing stone underfoot, an upside-down Oak Log floorboard ceiling
     overhead), and the same Ancient Chest hanging from that ceiling holding the
     guaranteed Level 2 Rift Core Disk.

     WHAT CHANGED IS ONLY HOW IT IS WRITTEN. The pocket version called _writeBlockRaw,
     which requires the target chunk to already exist and silently drops the write if it
     does not — safe only because the whole region was pre-built. A streamed building
     must be stamped by every chunk its footprint touches, so this now writes through the
     clipped setter and is invoked from _genFarmlandsChunk. It sits on a forced-flat pad
     folded into the heightfield, so all four chunks agree on its base level.

     THE CHEST IS PROTECTED THREE WAYS:
       1. its key is registered at boot from constants, never as a side effect of a
          stamp, so it exists before any chunk does;
       2. its pad suppresses every crop, tree, fence and lane inside the footprint, so
          nothing can grow through the building or bury the door;
       3. the stamp runs LAST in chunk generation, after the agricultural and tree
          passes, so it overwrites rather than being overwritten.
     Player edits still win over all of it: editedChunks is replayed after the generator
     returns, which is what lets a player mine the shell and have it stay mined.
     =================================================================================== */
  /* ===================================================================================
     PHASE 17 — ABANDONED SETTLEMENTS AND RURAL HORROR LANDMARKS

     PLACEMENT IS A LOOKUP, NOT A REGISTRY. There is no list of placed structures
     anywhere in the engine. _farmSteadAt(bx, bz) answers "is there a farmstead in this
     parcel, and exactly what is it" from the parcel coordinates and fixed seeds alone,
     in a few integer hashes. Any chunk that overlaps a farmstead asks the same question
     and gets the same answer, so a building stamps identically from any of the nine
     chunks it may touch, in any load order, forever, with nothing retained between
     chunks and nothing to grow without bound.

     RARITY IS THE MECHANIC. A farmstead occupies at most one parcel in eleven and a
     horror landmark at most one cell in three of a 768-block grid. The brief is explicit
     that large empty agricultural stretches are intentional, and it is right: the reason
     a graveyard lands is that the player has walked through twenty minutes of fields to
     reach it. Measured spacing is reported by debugFarmlandsAudit.
     =================================================================================== */

  /* Every farmstead sits on a LANE. A parcel with no track on either of its two owned
     edges cannot host one, which is what produces the "farmhouse -> driveway -> field
     road" relationship the brief asks for instead of buildings appearing in the middle
     of crops. It also means settlements thread along the road network, so a player who
     follows a track is rewarded and a player who strikes out across country is not. */
  _farmSteadAt(bx, bz) {
    // Tiny direct-mapped memo: the column scan asks for the same parcels repeatedly.
    const slot = (((bx * 73856093) ^ (bz * 19349663)) >>> 0) & 63;
    if (!this._farmSteadCache) { this._farmSteadCache = new Array(64); this._farmSteadKey = new Array(64); }
    const key = bx + ':' + bz;
    if (this._farmSteadKey[slot] === key) return this._farmSteadCache[slot];

    /* PLACEMENT IS BOUNDED BY THE REGION. Without this the two grids happily describe
       farmsteads and landmarks outside the Farmlands, which are then never stamped
       because those chunks route to the Overworld generator — harmless in play, but it
       silently poisons every census with placements that do not exist, and a walkability
       sweep reported three "unwalkable landmarks" that were simply beyond the boundary. */
    let st = null;
    const laneW = this._farmLaneX(bx), laneN = this._farmLaneZ(bz);
    /* PHASE 18 — ROTH FARM is a forced acceptance on one named parcel, and nothing else
       about it is special: it takes the same archetypes, the same decay roll and the
       same naming call every other farmstead takes. Forcing only the ACCEPTANCE is what
       keeps it believable — the brief is explicit that it must not read as a reward. */
    const isRoth = (bx === FARM_ROTH_BX && bz === FARM_ROTH_BZ);
    /* PHASE 20 — THE ISOLATION RAMP, applied as a multiplier on the acceptance rate and
       nowhere else. Past the water tower the same die is thrown with the same salt; it
       simply has to come up smaller. Roth Farm is exempt because it is a forced
       acceptance, and it sits four rows before the ramp begins anyway. */
    const iso = farmJourneyIsolation(bx, bz);
    if (isFarmlandsWorldPos(bx * FARM_P + 1, bz * FARM_P + 1) &&
        (laneW || laneN) &&
        (isRoth || this._farmHash(bx, bz, 149) < FARM_STEAD_CHANCE * iso)) {
      /* PHASE 18.1 — THE PLOT NOW SITS IN THE GAP THE ROAD ACTUALLY LEFT.

         A fixed setback was only ever safe because the lane was fixed too. Now that a
         route wanders up to FARM_ROUTE_A either side of its grid line, a constant offset
         would put a farmyard under the carriageway wherever the road happened to swing
         inward. So the bounding routes are SAMPLED across the parcel and the plot is
         placed in the clear window between them.

         This is also the right answer rather than merely a safe one: the yard ends up
         wherever the lane left room for it, which is how real farmsteads sit against real
         roads, and it means the buildings respond to the route instead of the route
         having to stay straight for the buildings. If the window is too narrow — both
         bounding lanes bulging inward at once — the farmstead is declined rather than
         squeezed, and the parcel stays open field. */
      const routeMaxX = (line) => {
        let m = -1e9;
        for (let k = 0; k <= 4; k++) {
          const o = this._farmRouteX(line, bz * FARM_P + k * (FARM_P >> 2));
          if (o > m) m = o;
        }
        return m;
      };
      const routeMinX = (line) => {
        let m = 1e9;
        for (let k = 0; k <= 4; k++) {
          const o = this._farmRouteX(line, bz * FARM_P + k * (FARM_P >> 2));
          if (o < m) m = o;
        }
        return m;
      };
      const routeMaxZ = (line) => {
        let m = -1e9;
        for (let k = 0; k <= 4; k++) {
          const o = this._farmRouteZ(line, bx * FARM_P + k * (FARM_P >> 2));
          if (o > m) m = o;
        }
        return m;
      };
      const routeMinZ = (line) => {
        let m = 1e9;
        for (let k = 0; k <= 4; k++) {
          const o = this._farmRouteZ(line, bx * FARM_P + k * (FARM_P >> 2));
          if (o < m) m = o;
        }
        return m;
      };
      const CLEAR = FARM_MARGIN + 2;   // hedge line plus a working margin
      let loX = 0, hiX = FARM_P, loZ = 0, hiZ = FARM_P;
      if (laneW) loX = Math.ceil(routeMaxX(bx) + CLEAR);
      if (this._farmLaneX(bx + 1)) hiX = Math.floor(FARM_P + routeMinX(bx + 1) - CLEAR);
      if (laneN) loZ = Math.ceil(routeMaxZ(bz) + CLEAR);
      if (this._farmLaneZ(bz + 1)) hiZ = Math.floor(FARM_P + routeMinZ(bz + 1) - CLEAR);
      if (loX < 0) loX = 0;
      if (loZ < 0) loZ = 0;
      const fits = (hiX - loX >= FARM_STEAD_W) && (hiZ - loZ >= FARM_STEAD_D);
      const ox = bx * FARM_P + loX;
      const oz = bz * FARM_P + (isRoth ? Math.max(loZ, FARM_ROTH_OZ_INSET) : loZ);
      // face = which way the front of the farmhouse looks (_propFace convention).
      const face = laneN ? 2 : 1;
      const centreX = ox + (FARM_STEAD_W >> 1), centreZ = oz + (FARM_STEAD_D >> 1);
      st = {
        bx, bz, ox, oz, face,
        x1: ox + FARM_STEAD_W, z1: oz + FARM_STEAD_D,
        padY: this._farmBaseHeightAt(centreX, centreZ),
        seed: Math.floor(this._farmHash(bx, bz, 151) * 1e6),
        decay: this._farmDecayLevel(bx, bz, 157),
        laneW, laneN, isRoth,
      };
      if (!fits) st = null;
      /* THE PROPERTY NAME. Resolved from the parcel coordinates alone, so it survives
         unload, reload and regeneration without anything being stored. Roth is pinned;
         everywhere else the name is a hash into the farm-name subset of the vocabulary.

         SIGNAGE IS DELIBERATELY SPARSE. Only about a third of farmsteads carry a name
         board at all, which is both what real farm roads look like and what keeps a
         three-name vocabulary from repeating often enough to be noticed. The brief
         reserves duplicated destinations as a LATER horror device, and a mechanism that
         fires by accident every few hundred blocks would spend it before it is used. */
      if (st) {
        st.nameIdx = isRoth ? FARM_SIGN_FARM_IDX[0]
          : FARM_SIGN_FARM_IDX[Math.floor(this._farmHash(bx, bz, 611) * FARM_SIGN_FARM_IDX.length) % FARM_SIGN_FARM_IDX.length];
        st.hasSign = isRoth || this._farmHash(bx, bz, 613) < FARM_STEAD_SIGN_CHANCE;
      }
      /* The rectangle every chunk that must help stamp this farmstead has to recognise.
         It is wider than the yard because the driveway, the turnaround and the gate sign
         all reach out to the lane, and a chunk that overlaps only the driveway must
         still draw its share of it or the approach comes out dashed. */
      if (st) {
        st.sx0 = Math.min(st.ox, bx * FARM_P) - 4;
        st.sz0 = Math.min(st.oz, bz * FARM_P) - 4;
        st.sx1 = st.x1 + 4; st.sz1 = st.z1 + 4;
      }
      /* THE DISCONNECTED HOME IS INVIOLABLE. Level 2 progression depends on that
         building and its chest existing exactly where the boot registered them, so any
         plot that comes within a wide margin of it is discarded outright rather than
         moved — moving it would make the exclusion depend on geometry that could drift
         in a later phase, whereas discarding cannot fail open. */
      if (st && this._farmPlotClashesHome(st.ox, st.oz, st.x1, st.z1)) st = null;
      else if (st && (!isFarmlandsWorldPos(st.ox, st.oz) || !isFarmlandsWorldPos(st.x1, st.z1))) st = null;
    }
    this._farmSteadKey[slot] = key;
    this._farmSteadCache[slot] = st;
    return st;
  }

  /* Horror landmarks live on their own much coarser grid so their spacing is decoupled
     from the farmsteads entirely — otherwise landmark frequency would rise and fall with
     lane density and the rarest content in the dimension would cluster. */
  _farmLandmarkAt(gx, gz) {
    const slot = (((gx * 83492791) ^ (gz * 29387167)) >>> 0) & 63;
    if (!this._farmLmCache) { this._farmLmCache = new Array(64); this._farmLmKey = new Array(64); }
    const key = gx + ':' + gz;
    if (this._farmLmKey[slot] === key) return this._farmLmCache[slot];

    let lm = null;
    if (isFarmlandsWorldPos(gx * FARM_LM_P + 1, gz * FARM_LM_P + 1) &&
        this._farmHash(gx, gz, 163) < FARM_LANDMARK_CHANCE) {
      const r = this._farmHash(gx, gz, 167);
      let acc = 0, kind = 0;
      for (let i = 0; i < FARM_LM_W.length; i++) { acc += FARM_LM_W[i]; if (r < acc) { kind = i; break; } }
      /* Landmarks are placed against a lane too, for the same reason farmsteads are: a
         rural cemetery is reached by a path, and one sitting in the middle of a ploughed
         field reads as a video-game prop rather than a place. The search walks parcels
         inside the cell until it finds a laned one, and gives up if there is none —
         which is correct, an unlaned cell simply has no landmark. */
      const p0 = Math.floor(gx * FARM_LM_P / FARM_P), q0 = Math.floor(gz * FARM_LM_P / FARM_P);
      const span = FARM_LM_P / FARM_P;
      /* THE SENTINEL MUST NOT BE A COORDINATE. This search originally initialised
         px = -1 as "not found" and then assigned it a PARCEL INDEX — and every parcel
         index in this dimension is negative, because Phase 16 relocated the Farmlands
         wholesale into negative chunk space. So `px >= 0` rejected every successful
         search inside the actual region, and the only landmarks that survived were in a
         thin band near world origin that the player can never reach.

         The failure was invisible from the output: overall landmark rarity still looked
         plausible, which is exactly why a number that seems reasonable is not evidence
         that the mechanism producing it works. A census proved a laned parcel EXISTS in
         100% of candidate cells while placement succeeded in 13.6% — and 13.6% was
         precisely the fraction of cells with a non-negative parcel index. Found-ness is
         now carried by a boolean, which cannot collide with any coordinate value. */
      let px = 0, pz = 0, found = false;
      for (let i = 0; i < span && !found; i++) {
        const cand = p0 + ((Math.floor(this._farmHash(gx, gz, 173) * span) + i) % span);
        for (let j = 0; j < span; j++) {
          const candz = q0 + ((Math.floor(this._farmHash(gx, gz, 179) * span) + j) % span);
          if (this._farmLaneX(cand) || this._farmLaneZ(candz)) { px = cand; pz = candz; found = true; break; }
        }
      }
      if (found) {
        const size = FARM_LM_SIZE[kind];
        // Sit it on the far side of the parcel from any farmstead corner, so a landmark
        // and a settlement in the same parcel do not fight over ground.
        /* PHASE 18.1 — the landmark is pushed clear of BOTH bounding routes, the same way
           a farmstead is. Phase 18's fixed inset put a 34-block great barn at parcel
           offset 24..58, and the next route along can now reach down to 43 — so a third
           of the barn could have ended up standing in the carriageway. The plot is placed
           against the far corner and then pulled back by however much the next route
           actually intrudes. */
        const lmClearX = this._farmLaneX(px + 1)
          ? Math.max(0, FARM_MARGIN + 2 - this._farmRouteX(px + 1, pz * FARM_P + FARM_P / 2)) : 0;
        const lmClearZ = this._farmLaneZ(pz + 1)
          ? Math.max(0, FARM_MARGIN + 2 - this._farmRouteZ(pz + 1, px * FARM_P + FARM_P / 2)) : 0;
        /* ...but not pulled back so far that it lands on the route on the NEAR side
           instead, which is what pushing a 34-block plot away from one road does when the
           parcel is only 64 wide. The near-side floor is the far bound of that route. */
        const lmNearX = this._farmLaneX(px)
          ? Math.ceil(this._farmRouteX(px, pz * FARM_P + FARM_P / 2)) + FARM_MARGIN + 2 : 0;
        const lmNearZ = this._farmLaneZ(pz)
          ? Math.ceil(this._farmRouteZ(pz, px * FARM_P + FARM_P / 2)) + FARM_MARGIN + 2 : 0;
        const ox = px * FARM_P + Math.max(lmNearX, FARM_P - size - 6 - Math.ceil(lmClearX));
        const oz = pz * FARM_P + Math.max(lmNearZ, FARM_P - size - 6 - Math.ceil(lmClearZ));
        lm = {
          gx, gz, kind, ox, oz, x1: ox + size, z1: oz + size, size, px, pz,
          padY: this._farmBaseHeightAt(ox + (size >> 1), oz + (size >> 1)),
          seed: Math.floor(this._farmHash(gx, gz, 181) * 1e6),
          decay: 2 + (this._farmHash(gx, gz, 191) < 0.5 ? 1 : 0),
        };
        if (this._farmPlotClashesHome(lm.ox, lm.oz, lm.x1, lm.z1)) lm = null;
        else if (!isFarmlandsWorldPos(lm.ox, lm.oz) || !isFarmlandsWorldPos(lm.x1, lm.z1)) lm = null;
        /* PHASE 18 — a much wider arrival exclusion for LANDMARKS specifically. The
           farmstead keep-out is sized for a farmyard; a graveyard or a 34-block great
           barn inside it would still be the first thing the player saw on stepping out
           of the rift, which the brief rules out directly. */
        else if (lm && this._farmLmClashesArrival(lm.ox, lm.oz, lm.x1, lm.z1)) lm = null;
      }
    }
    this._farmLmKey[slot] = key;
    this._farmLmCache[slot] = lm;
    return lm;
  }

  // PHASE 18 — the landmark-only arrival exclusion. Deliberately a separate test from
  // _farmPlotClashesHome so the two radii can never be confused for one another.
  _farmLmClashesArrival(x0, z0, x1, z1) {
    const m = FARM_LM_SPAWN_KEEPOUT;
    return x1 >= FARM_SPAWN_X - m && x0 <= FARM_SPAWN_X + m &&
           z1 >= FARM_SPAWN_Z - m && z0 <= FARM_SPAWN_Z + m;
  }

  // A generous keep-out around the Level 2 progression structure and the rift pad.
  _farmPlotClashesHome(x0, z0, x1, z1) {
    const m = FARM_HOME_KEEPOUT;
    const H = this.farmHome;
    if (H && x1 >= H.cx - m && x0 <= H.cx + m && z1 >= H.cz - m && z0 <= H.cz + m) return true;
    /* PHASE 20 — the water tower facility gets a keep-out of its own, and it is wider
       than the structure by design. The tower is the region's navigation landmark and
       the brief requires it to stand ALONE against open farmland; a barn thirty blocks
       from its legs would give the eye something to measure it against and cost it most
       of its scale. */
    const T = this.farmTower;
    if (T && x1 >= T.cx - FARM_TOWER_KEEPOUT && x0 <= T.cx + FARM_TOWER_KEEPOUT &&
        z1 >= T.cz - FARM_TOWER_KEEPOUT && z0 <= T.cz + FARM_TOWER_KEEPOUT) return true;
    /* PHASE 20 REVISION — THE SCALE HIERARCHY IS ENFORCED BY EMPTINESS.

       The brief's requirement is that the eye reads ordinary farm < fallen tower <
       standing tower < giant barn << great tree with no UI at all, and the only thing
       that lets it do that is having nothing of an intermediate size standing next to
       any of them. Each keep-out is sized to the landmark it protects: the tree's is the
       widest of all, because the dead ground around it is part of the landmark and a
       farmstead inside it would be a farmstead standing in a dead field, which says
       something the story is not ready to say yet. */
    const F = this.farmFallen;
    if (F && x1 >= F.cx - FARM_FALLEN_KEEPOUT && x0 <= F.cx + FARM_FALLEN_KEEPOUT &&
        z1 >= F.cz - FARM_FALLEN_KEEPOUT && z0 <= F.cz + FARM_FALLEN_KEEPOUT) return true;
    const B = this.farmBarn;
    if (B && x1 >= B.cx - FARM_BARN_KEEPOUT && x0 <= B.cx + FARM_BARN_KEEPOUT &&
        z1 >= B.cz - FARM_BARN_KEEPOUT && z0 <= B.cz + FARM_BARN_KEEPOUT) return true;
    const R = this.farmTree;
    if (R && x1 >= R.cx - FARM_TREE_KEEPOUT && x0 <= R.cx + FARM_TREE_KEEPOUT &&
        z1 >= R.cz - FARM_TREE_KEEPOUT && z0 <= R.cz + FARM_TREE_KEEPOUT) return true;
    if (x1 >= FARM_SPAWN_X - m && x0 <= FARM_SPAWN_X + m &&
        z1 >= FARM_SPAWN_Z - m && z0 <= FARM_SPAWN_Z + m) return true;
    return false;
  }

  /* DETERIORATION 0..3. Weighted so that INTACT-BUT-ABANDONED is the most common state.
     The brief is emphatic and correct: a region where every building has collapsed reads
     as a single disaster, and a single disaster is a story the environment has already
     told. A region where most houses are merely empty reads as people leaving one at a
     time over years, which is far worse. */
  _farmDecayLevel(a, b, salt) {
    const r = this._farmHash(a, b, salt);
    if (r < 0.34) return 0;
    if (r < 0.63) return 1;
    if (r < 0.87) return 2;
    return 3;
  }

  /* ===================================================================================
     THE STRUCTURE PAD

     Buildings need level ground, and the level must be agreed by every chunk that
     touches the plot without any of them seeing the whole thing. So the pad is part of
     the HEIGHTFIELD, exactly as the arrival pad and the Disconnected Home already are:
     _farmPadAt answers from the plot descriptor, whose padY was resolved once from the
     raw heightfield at the plot centre.

     _farmBaseHeightAt is the heightfield WITHOUT the pad test, which is what breaks the
     recursion — the pad needs a height, and the height must not need the pad.
     =================================================================================== */
  /* ===================================================================================
     THE PLOT LIST — the same answer Phase 16 reached for the column cache.

     _farmStructPadAt sits inside _farmHeightAt, which runs for every column of every
     chunk plus its margin. Written as a live 3x3 parcel scan plus a 3x3 landmark scan it
     cost roughly 8,700 placement queries per chunk and pushed generation from 2.3 ms to
     6.4 ms — a 2.8x regression paid by EMPTY fields containing no structures at all,
     which is most of the dimension.

     So the plots overlapping a chunk are resolved ONCE, into a list that is almost always
     empty, and the per-column path becomes a scan of zero or one rectangles. The bounds
     are derived from the cache window rather than the chunk, so a plot reaching in from a
     neighbouring parcel is still caught, and the list is cleared after generation so any
     caller outside the chunk path (the audit, the arrival point, the Disconnected Home)
     transparently falls back to the full query and gets an identical answer.
     =================================================================================== */
  _farmBuildPlotList(chunk) {
    const x0 = chunk.cx * CHUNK_SX - FARM_M, x1 = chunk.cx * CHUNK_SX + CHUNK_SX + FARM_M;
    const z0 = chunk.cz * CHUNK_SZ - FARM_M, z1 = chunk.cz * CHUNK_SZ + CHUNK_SZ + FARM_M;
    const L = [];
    const b0 = Math.floor(x0 / FARM_P) - 1, b1 = Math.floor(x1 / FARM_P) + 1;
    const c0 = Math.floor(z0 / FARM_P) - 1, c1 = Math.floor(z1 / FARM_P) + 1;
    for (let bx = b0; bx <= b1; bx++)
      for (let bz = c0; bz <= c1; bz++) {
        const st = this._farmSteadAt(bx, bz);
        if (st) L.push(st);
      }
    const g0 = Math.floor(x0 / FARM_LM_P) - 1, g1 = Math.floor(x1 / FARM_LM_P) + 1;
    const h0 = Math.floor(z0 / FARM_LM_P) - 1, h1 = Math.floor(z1 / FARM_LM_P) + 1;
    const M = [];
    for (let gx = g0; gx <= g1; gx++)
      for (let gz = h0; gz <= h1; gz++) {
        const lm = this._farmLandmarkAt(gx, gz);
        if (lm) M.push(lm);
      }
    const N = [];
    const m0 = Math.floor(x0 / FARM_MINOR_P) - 1, m1 = Math.floor(x1 / FARM_MINOR_P) + 1;
    const n0 = Math.floor(z0 / FARM_MINOR_P) - 1, n1 = Math.floor(z1 / FARM_MINOR_P) + 1;
    for (let mx = m0; mx <= m1; mx++)
      for (let mz = n0; mz <= n1; mz++) {
        const mn = this._farmMinorAt(mx, mz);
        if (mn) N.push(mn);
      }
    /* PHASE 18 — signs resolve into the same per-chunk list as everything else, so an
       empty stretch of farmland pays one junction test per parcel in the window and no
       more. Signs sit at parcel corners, so the same 3x3 parcel window already scanned
       for farmsteads covers every sign a chunk can touch. */
    const G = [];
    for (let bx = b0; bx <= b1; bx++)
      for (let bz = c0; bz <= c1; bz++) {
        const sg = this._farmSignAt(bx, bz);
        if (sg) G.push(sg);
      }
    this._farmPlotSteads = L;
    this._farmPlotLms = M;
    this._farmPlotMinors = N;
    this._farmPlotSigns = G;
  }

  _farmStructPadAt(wx, wz) {
    if (this._farmPlotSteads) {
      const L = this._farmPlotSteads;
      for (let i = 0; i < L.length; i++) {
        const st = L[i];
        if (wx >= st.ox - 2 && wx < st.x1 + 2 && wz >= st.oz - 2 && wz < st.z1 + 2) return st.padY;
      }
      const M = this._farmPlotLms;
      for (let i = 0; i < M.length; i++) {
        const lm = M[i];
        if (wx >= lm.ox - 2 && wx < lm.x1 + 2 && wz >= lm.oz - 2 && wz < lm.z1 + 2) return lm.padY;
      }
      const N = this._farmPlotMinors;
      for (let i = 0; i < N.length; i++) {
        const mn = N[i];
        if (!FARM_MINOR_PAD[mn.kind]) continue;   // props follow the ground; only buildings level it
        if (wx >= mn.ox - 1 && wx < mn.x1 + 1 && wz >= mn.oz - 1 && wz < mn.z1 + 1) return mn.padY;
      }
      return -1;
    }
    // Fallback: the full query, used outside chunk generation.
    const bx = Math.floor(wx / FARM_P), bz = Math.floor(wz / FARM_P);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const st = this._farmSteadAt(bx + i, bz + j);
        if (st && wx >= st.ox - 2 && wx < st.x1 + 2 && wz >= st.oz - 2 && wz < st.z1 + 2) return st.padY;
      }
    }
    const gx = Math.floor(wx / FARM_LM_P), gz = Math.floor(wz / FARM_LM_P);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const lm = this._farmLandmarkAt(gx + i, gz + j);
        if (lm && wx >= lm.ox - 2 && wx < lm.x1 + 2 && wz >= lm.oz - 2 && wz < lm.z1 + 2) return lm.padY;
      }
    }
    const mx = Math.floor(wx / FARM_MINOR_P), mz = Math.floor(wz / FARM_MINOR_P);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const mn = this._farmMinorAt(mx + i, mz + j);
        if (mn && FARM_MINOR_PAD[mn.kind] &&
            wx >= mn.ox - 1 && wx < mn.x1 + 1 && wz >= mn.oz - 1 && wz < mn.z1 + 1) return mn.padY;
      }
    }
    return -1;
  }

  /* ===================================================================================
     THE ARCHETYPE LIBRARY

     Reused, not multiplied. Twelve archetypes across an infinite region, varied by
     footprint jitter, cladding, roof material, deterioration and orientation — which is
     the same discipline Phase 9 used for the suburb and for the same reason: the player
     should recognise a barn instantly, and recognising it means having seen it before.

     Every archetype is a MASS LIST, and mass lists are what the suburb's shell and roof
     stampers already consume. A farmhouse with a rear kitchen wing is two masses at
     different plate heights; a barn with a lean-to is two masses sharing a wall. That is
     the entire difference between rural architecture and a box, and it costs nothing
     because _subStampRoof already resolves any mass into a pitched surface with eaves,
     soffit, fascia and gutters.
     =================================================================================== */
  _farmBuildingMasses(b, baseY) {
    const A = FARM_ARCH[b.arch];
    const out = [{
      x: b.x, z: b.z, w: b.w, d: b.d,
      floorY: baseY, plateY: baseY + A.wallH,
      roof: A.roof, ridge: b.ridge, main: true,
    }];
    /* A WING. Kitchen ell on a farmhouse, lean-to on a barn, tool bay on a workshop —
       always lower than the main mass and always attached to one long side, so the
       silhouette steps down and reads as added-to rather than designed. */
    if (A.wing) {
      const wW = A.wing.w, wD = A.wing.d;
      const alongX = b.ridge === 'x';
      out.push(alongX ? {
        x: b.x + (b.w - wW >> 1), z: b.z + b.d - 1,
        w: wW, d: wD, floorY: baseY, plateY: baseY + A.wing.wallH,
        roof: 'gable', ridge: 'x', wing: true,
      } : {
        x: b.x + b.w - 1, z: b.z + (b.d - wD >> 1),
        w: wD, d: wW, floorY: baseY, plateY: baseY + A.wing.wallH,
        roof: 'gable', ridge: 'z', wing: true,
      });
    }
    return out;
  }

  _farmStampLandmark(chunk, lm) {
    /* PHASE 18 — the bounds now include the approach spur, which reaches back across the
       parcel to the lane. A chunk covering only the track still has to draw its share. */
    if (!this._subHits(chunk, Math.min(lm.ox, lm.px * FARM_P) - 2, Math.min(lm.oz, lm.pz * FARM_P) - 2,
                       lm.x1 + 2, lm.z1 + 2)) return;
    const hsh = (n) => this._farmHash(lm.gx * 13 + n, lm.gz * 17 + n, 307);
    /* THE APPROACH. Every landmark is placed against a lane precisely so it can be
       reached; until now nothing actually connected the two, and a graveyard you cross a
       ploughed field to reach reads as scenery rather than as somewhere people went. */
    this._farmSpurToLane(chunk, lm.ox + (lm.size >> 1), lm.oz + (lm.size >> 1), 1);
    switch (lm.kind) {
      case FARM_LM.GRAVEYARD: return this._farmStampGraveyard(chunk, lm, hsh);
      case FARM_LM.CHAPEL:    return this._farmStampChapel(chunk, lm, hsh);
      case FARM_LM.GREATBARN: return this._farmStampGreatBarn(chunk, lm, hsh);
      case FARM_LM.DEEPWELL:  return this._farmStampDeepWell(chunk, lm, hsh);
      case FARM_LM.MEMORIAL:  return this._farmStampMemorial(chunk, lm, hsh);
    }
  }

  /* Ask the two placement grids what overlaps this chunk, and stamp it. Nine parcel
     probes and nine landmark-cell probes, each a handful of memoised hashes — the cost
     of settlements in a chunk that contains none is a few microseconds. */

  /* ===================================================================================
     PHASE 17.1 — THE MINOR STRUCTURE LAYER

     WHY THIS EXISTS. Phase 17 tuned farmstead density by AREA and then read that number
     as though it were what a player experiences. It is not. A walking player sweeps a
     CORRIDOR, so the distance between encounters is not the areal spacing S but
     S squared divided by the corridor width — at S = 478 and a generous 80-block
     corridor that is 2,860 blocks, about ten minutes, which is exactly what the
     playtest reported. Raising farmstead density alone would fix the arithmetic and
     still leave the world wrong, because a region where the only built thing is a
     complete farmstead reads as a series of set pieces with nothing between them.

     Real farmland is full of small solitary things: a field shed, a collapsed
     outbuilding in a corner, a stock shelter, a well by a gate, bales left out, a
     machine abandoned at a headland. This layer supplies them on a 32-block grid — four
     times finer than the parcel — so that ordinary walking almost always has something
     built in view, while the farmsteads themselves stay meaningful arrivals.

     It is the same lookup discipline as everything else: a pure function of grid
     coordinates, no registry, resolved into the per-chunk plot list so empty chunks pay
     almost nothing.
     =================================================================================== */
  _farmMinorAt(mx, mz) {
    const slot = (((mx * 40503227) ^ (mz * 66600049)) >>> 0) & 127;
    if (!this._farmMinorCache) { this._farmMinorCache = new Array(128); this._farmMinorKey = new Array(128); }
    const key = mx + ':' + mz;
    if (this._farmMinorKey[slot] === key) return this._farmMinorCache[slot];

    let mn = null;
    const bx0 = mx * FARM_MINOR_P, bz0 = mz * FARM_MINOR_P;
    /* PHASE 20 — the same ramp the farmsteads take, on the finer grid. This is the one
       that a walking player actually feels: farmsteads are hundreds of blocks apart
       anyway, but the minor layer is what keeps SOMETHING built almost always in view,
       so thinning it is what makes the country past the tower read as emptying out. */
    const isoM = farmJourneyIsolation(Math.floor((bx0 + FARM_MINOR_P / 2) / FARM_P),
                                      Math.floor((bz0 + FARM_MINOR_P / 2) / FARM_P));
    if (isFarmlandsWorldPos(bx0 + 1, bz0 + 1) &&
        this._farmHash(mx, mz, 401) < FARM_MINOR_CHANCE * isoM) {
      const r = this._farmHash(mx, mz, 409);
      let acc = 0, kind = 0;
      for (let i = 0; i < FARM_MINOR_W.length; i++) { acc += FARM_MINOR_W[i]; if (r < acc) { kind = i; break; } }
      const size = FARM_MINOR_SIZE[kind];
      // Jitter inside the cell so the 32-block lattice never becomes visible, while
      // keeping the whole footprint inside its own cell so neighbours cannot collide.
      const jx = Math.floor(this._farmHash(mx, mz, 419) * (FARM_MINOR_P - size - 2));
      const jz = Math.floor(this._farmHash(mx, mz, 421) * (FARM_MINOR_P - size - 2));
      const ox = bx0 + 1 + jx, oz = bz0 + 1 + jz;

      /* PLACEMENT MUST STILL BE BELIEVABLE. A shed dropped in the middle of a crop field
         is scattering, which the brief rules out. Minor structures sit where rural
         clutter actually accumulates: against a lane, on a field boundary, or on the
         unploughed headland at a parcel edge. A cell whose centre is deep inside worked
         ground is simply skipped, which also keeps crops readable. */
      const cx = ox + (size >> 1), cz = oz + (size >> 1);
      const surf = this._farmSurfaceAt(cx, cz);
      const bxp = Math.floor(cx / FARM_P), bzp = Math.floor(cz / FARM_P);
      const u = cx - bxp * FARM_P, v = cz - bzp * FARM_P;
      const nearEdge = u < FARM_MARGIN + 4 || v < FARM_MARGIN + 4 ||
                       u > FARM_P - 6 || v > FARM_P - 6;
      /* WEIGHTED, NOT GATED. The first version accepted only verges, boundaries and
         field EDGES, which rejected 75% of candidates and left the layer three times
         too sparse. That was over-strict rather than believable: a field shed or a stock
         shelter standing out in the middle of a big field is completely ordinary
         farmland, and it is often the only thing breaking the horizon. Edges are still
         strongly preferred — that is where rural clutter really accumulates — but the
         interior is now admitted at a lower rate instead of being forbidden. */
      const ok = surf === FARM_SURF.VERGE || surf === FARM_SURF.BOUNDARY ||
                 (surf === FARM_SURF.FIELD &&
                  (nearEdge || this._farmHash(mx, mz, 457) < 0.45));
      if (ok) {
        mn = {
          mx, mz, kind, ox, oz, size, x1: ox + size, z1: oz + size,
          padY: this._farmBaseHeightAt(cx, cz),
          decay: this._farmDecayLevel(mx, mz, 431),
          seed: Math.floor(this._farmHash(mx, mz, 433) * 1e6),
        };
        // Never inside the Level 2 keep-out, a farmstead yard, or a landmark plot.
        if (this._farmPlotClashesHome(ox, oz, mn.x1, mn.z1)) mn = null;
        else if (this._farmMinorBlocked(ox, oz, mn.x1, mn.z1)) mn = null;
      }
    }
    this._farmMinorKey[slot] = key;
    this._farmMinorCache[slot] = mn;
    return mn;
  }

  // A minor structure yields to anything larger that already claims the ground.
  _farmMinorBlocked(x0, z0, x1, z1) {
    const b0 = Math.floor(x0 / FARM_P), b1 = Math.floor(x1 / FARM_P);
    const c0 = Math.floor(z0 / FARM_P), c1 = Math.floor(z1 / FARM_P);
    for (let bx = b0 - 1; bx <= b1 + 1; bx++)
      for (let bz = c0 - 1; bz <= c1 + 1; bz++) {
        const st = this._farmSteadAt(bx, bz);
        if (st && x1 >= st.ox - 3 && x0 <= st.x1 + 3 && z1 >= st.oz - 3 && z0 <= st.z1 + 3) return true;
      }
    const g0 = Math.floor(x0 / FARM_LM_P), g1 = Math.floor(x1 / FARM_LM_P);
    const h0 = Math.floor(z0 / FARM_LM_P), h1 = Math.floor(z1 / FARM_LM_P);
    for (let gx = g0 - 1; gx <= g1 + 1; gx++)
      for (let gz = h0 - 1; gz <= h1 + 1; gz++) {
        const lm = this._farmLandmarkAt(gx, gz);
        if (lm && x1 >= lm.ox - 3 && x0 <= lm.x1 + 3 && z1 >= lm.oz - 3 && z0 <= lm.z1 + 3) return true;
      }
    return false;
  }


  /* ===================================================================================
     PHASE 18 — ANIMAL PLACEMENT

     THE SAME DISCIPLINE AS EVERY OTHER FEATURE IN THIS DIMENSION: placement is a pure
     function of grid coordinates, memoised, with no registry anywhere in the engine. The
     manager asks "what animals belong in this cell" and gets the same answer forever, so
     walking away and coming back reproduces the same herd, the same species, the same
     conditions and the same behaviours. Nothing is stored, so nothing can grow.

     ANIMALS BELONG TO PLACES, NOT TO NOISE. A cell only yields livestock if it is
     somewhere livestock would actually be — a pasture, a farmyard, beside a stock
     shelter, or occasionally a stray on a lane — and the acceptance rate differs per
     context so that a pasture reads as stocked and a crop field reads as empty. This is
     what the brief means by animal/farm relationships: the herd is in the pasture
     because the parcel is a pasture, not because a die came up.

     A DERELICT FARM HAS NO LIVESTOCK. A farmyard at decay 3 yields nothing at all, so
     the empty pen Phase 17 already builds there stays empty. That absence is one of the
     strongest pieces of environmental storytelling available and it costs one comparison.
     =================================================================================== */
  _farmAnimalCell(ax, az) {
    const slot = (((ax * 51413) ^ (az * 92821)) >>> 0) & 63;
    if (!this._farmAnimCache) { this._farmAnimCache = new Array(64); this._farmAnimKey = new Array(64); }
    const key = ax + ':' + az;
    if (this._farmAnimKey[slot] === key) return this._farmAnimCache[slot];

    let out = null;
    const bx0 = ax * FARM_ANIM_P, bz0 = az * FARM_ANIM_P;
    // Anchor jittered inside the cell so the 24-block lattice is never visible.
    const cx = bx0 + 4 + Math.floor(this._farmHash(ax, az, 701) * (FARM_ANIM_P - 8));
    const cz = bz0 + 4 + Math.floor(this._farmHash(ax, az, 703) * (FARM_ANIM_P - 8));

    /* PHASE 19 — REQUIREMENT 35. An anchor cell that would put livestock in standing
       water yields nothing: no drowned cows, no sheep floating in a ditch, and no
       change whatsoever to the Phase 18.2 animal system itself, which is exactly the
       constraint the brief sets. Animals still stand BESIDE water constantly — the test
       is on the anchor column only, and a herd disperses several blocks around it. */
    if (isFarmlandsWorldPos(cx, cz) && !this._farmInPad(cx, cz) &&
        this._farmHeightAt(cx, cz) >= FARM_WATER_Y) {
      const bxp = Math.floor(cx / FARM_P), bzp = Math.floor(cz / FARM_P);
      const st = this._farmSteadAt(bxp, bzp);
      const inYard = st && cx >= st.ox && cx < st.x1 && cz >= st.oz && cz < st.z1;
      const mn = this._farmMinorAt(Math.floor(cx / FARM_MINOR_P), Math.floor(cz / FARM_MINOR_P));
      const nearShelter = mn && mn.kind === FARM_MINOR.SHELTER &&
        cx >= mn.ox - 6 && cx < mn.x1 + 6 && cz >= mn.oz - 6 && cz < mn.z1 + 6;
      const parcel = this._farmParcel(bxp, bzp);
      const surf = this._farmSurfaceAt(cx, cz);
      const ashen = farmlandsBiomeValue(cx, cz) > FARM_BIOME_T;

      let chance = 0, nMin = 1, nMax = 1, pool = null;
      if (inYard) {
        /* A working yard: poultry and a beast or two. A DERELICT one: nothing. The pen
           Phase 17 builds stays empty, and the player is left to notice that. */
        if (st.decay < 3) {
          chance = 0.55; nMin = 2; nMax = 4;
          pool = [FARM_ANIM_SPECIES.CHICKEN, FARM_ANIM_SPECIES.CHICKEN, FARM_ANIM_SPECIES.COW];
        }
      } else if (nearShelter) {
        chance = 0.62; nMin = 2; nMax = 3;
        pool = [FARM_ANIM_SPECIES.SHEEP, FARM_ANIM_SPECIES.SHEEP, FARM_ANIM_SPECIES.COW];
      } else if (!ashen && parcel.kind === FARM_FIELD.PASTURE && surf === FARM_SURF.FIELD) {
        // The main home of livestock in this dimension, and the only context that
        // produces a real herd.
        chance = 0.46; nMin = 3; nMax = 6;
        pool = [FARM_ANIM_SPECIES.COW, FARM_ANIM_SPECIES.COW, FARM_ANIM_SPECIES.SHEEP,
                FARM_ANIM_SPECIES.SHEEP, FARM_ANIM_SPECIES.HORSE];
      } else if (!ashen && (parcel.kind === FARM_FIELD.STUBBLE || parcel.kind === FARM_FIELD.DEAD) &&
                 surf === FARM_SURF.FIELD) {
        // Something that got out, or was never brought in. One animal, rarely.
        chance = 0.07; nMin = 1; nMax = 2;
        pool = [FARM_ANIM_SPECIES.SHEEP, FARM_ANIM_SPECIES.COW, FARM_ANIM_SPECIES.HORSE];
      } else if (surf === FARM_SURF.VERGE) {
        // A stray on the roadside. The rarest context, and the one most likely to be
        // the first animal a player ever meets, because they will be on the road.
        chance = 0.05; nMin = 1; nMax = 1;
        pool = [FARM_ANIM_SPECIES.SHEEP, FARM_ANIM_SPECIES.CHICKEN, FARM_ANIM_SPECIES.HORSE];
      }

      /* PHASE 20 — livestock thin out along the journey with everything else, and they
         are the most legible half of it: a pasture with no herd in it reads as
         abandonment far more directly than one fewer shed does. The multiplier is
         applied to the CHANCE, so a pasture past the tower is not forbidden livestock,
         only unlikely to have any — which is what leaves the occasional lone animal
         standing a long way from anything, exactly as the brief asks. */
      chance *= farmJourneyIsolation(bxp, bzp);
      if (pool && this._farmHash(ax, az, 709) < chance) {
        /* SPECIES IS PER GROUP. A herd of one species is livestock; a herd of four is a
           spawn table. Condition and behaviour below are per ANIMAL and drawn from their
           own salts, which is what produces the mixed pasture the brief requires. */
        const species = pool[Math.floor(this._farmHash(ax, az, 719) * pool.length) % pool.length];
        const n = nMin + Math.floor(this._farmHash(ax, az, 727) * (nMax - nMin + 1));
        // A group-wide facing, used only by the ALIGN distortion — but resolved here so
        // every member of a group agrees on it without talking to each other.
        const groupYaw = this._farmHash(ax, az, 733) * Math.PI * 2;
        const list = [];
        for (let i = 0; i < n; i++) {
          const a = this._farmHash(ax * 31 + i, az * 17 + i, 739) * Math.PI * 2;
          const rad = 1.5 + this._farmHash(ax * 13 + i, az * 29 + i, 743) * 5.5;
          const px = cx + Math.cos(a) * rad, pz = cz + Math.sin(a) * rad;
          list.push({
            id: ax + ':' + az + ':' + i,
            x: px, z: pz, species,
            cond: this._farmAnimalCondition(ax, az, i),
            /* PHASE 18.2 — which of the four deterioration archetypes this animal wears.
               Its own salt, so it is independent of both condition and behaviour: two
               severely rotten cows in one field are wrong in different places. */
            variant: Math.floor(this._farmHash(ax * 113 + i, az * 127 + i, 797) * 4) & 3,
            beh: this._farmAnimalBehaviour(ax, az, i),
            // Per-animal seed for gait phase, timings and idle variation.
            seed: Math.floor(this._farmHash(ax * 7 + i, az * 11 + i, 757) * 1e6),
            yaw: this._farmHash(ax * 5 + i, az * 3 + i, 761) * Math.PI * 2,
            groupYaw,
            /* The \"stops when watched\" modifier, available to ANY behaviour including a
               perfectly ordinary one. Kept as a modifier rather than a class precisely so
               it can land on an animal that is otherwise grazing normally. */
            freezeWatched: this._farmHash(ax * 23 + i, az * 19 + i, 769) < 0.10,
          });
        }
        out = { ax, az, cx, cz, species, animals: list };
      }
    }
    this._farmAnimKey[slot] = key;
    this._farmAnimCache[slot] = out;
    return out;
  }

  /* CONDITION. Its own salt, its own hash, and it reads nothing about behaviour. */
  _farmAnimalCondition(ax, az, i) {
    const r = this._farmHash(ax * 101 + i, az * 103 + i, 773);
    let acc = 0;
    for (let k = 0; k < FARM_ANIM_COND_W.length; k++) {
      acc += FARM_ANIM_COND_W[k];
      if (r < acc) return k;
    }
    return FARM_ANIM_COND.HEALTHY;
  }
  /* BEHAVIOUR. A DIFFERENT salt, so the two are statistically independent — which the
     audit checks numerically rather than taking on trust, because "these look unrelated"
     is exactly the sort of claim that turns out to be false. */
  _farmAnimalBehaviour(ax, az, i) {
    const r = this._farmHash(ax * 107 + i, az * 109 + i, 787);
    let acc = 0;
    for (let k = 0; k < FARM_ANIM_BEH_W.length; k++) {
      acc += FARM_ANIM_BEH_W[k];
      if (r < acc) return k;
    }
    return FARM_ANIM_BEH.GRAZE;
  }

  /* Runs a spur from a point back to whichever lane owns its parcel, or does nothing if
     the parcel has no lane. Pure position -> position, so every chunk the spur crosses
     computes the identical line and stamps its own portion of it. */
  _farmSpurToLane(chunk, x, z, halfWidth) {
    const bxp = Math.floor(x / FARM_P), bzp = Math.floor(z / FARM_P);
    /* PHASE 20 REVISION — A SPUR MUST NOT AIM AT A ROAD THAT IS NOT THERE. Inside the
       journey corridor the road hierarchy suppresses most crossing lanes and every
       parallel one, but _farmLaneX/_farmLaneZ still answer for the raw lattice; a spur
       resolved from them alone would run a track fifty blocks across a field to a lane
       the surface pass never wrote. So the corridor's own predicates decide first. */
    const inCor = farmInCorridor(bxp, bzp);
    const hasX = this._farmLaneX(bxp) && (!inCor || farmCrossKept(bxp));
    const hasZ = this._farmLaneZ(bzp) && (!inCor || bzp === FARM_J_LINE);
    if (inCor) {
      if (hasZ) {
        const tz = Math.round(bzp * FARM_P + this._farmRouteZ(bzp, x));
        this._farmStampSpur(chunk, x, z, x, tz, halfWidth);
      } else if (hasX) {
        const tx = Math.round(bxp * FARM_P + this._farmRouteX(bxp, z));
        this._farmStampSpur(chunk, x, z, tx, z, halfWidth);
      }
      return;
    }
    // PHASE 18.1 — aim at the route's actual centreline, not at the grid line plus one.
    if (this._farmLaneX(bxp)) {
      const tx = Math.round(bxp * FARM_P + this._farmRouteX(bxp, z));
      this._farmStampSpur(chunk, x, z, tx, z, halfWidth);
    } else if (this._farmLaneZ(bzp)) {
      const tz = Math.round(bzp * FARM_P + this._farmRouteZ(bzp, x));
      this._farmStampSpur(chunk, x, z, x, tz, halfWidth);
    }
  }

  _farmStampSettlements(chunk) {
    // Same list the heightfield used, so the pad and the building can never disagree
    // about which plots touch this chunk.
    if (!this._farmPlotSteads) this._farmBuildPlotList(chunk);
    for (const st of this._farmPlotSteads) this._farmStampStead(chunk, st);
    for (const lm of this._farmPlotLms) this._farmStampLandmark(chunk, lm);
    // Minors last: they yield to farmsteads and landmarks by construction, so stamping
    // them afterwards can only ever add detail to ground nothing larger claimed.
    for (const mn of this._farmPlotMinors) this._farmStampMinor(chunk, mn);
    // PHASE 18 — signage goes last of all, so a post can never be buried by a building
    // that stamped after it, and so a sign standing on a lane verge is written over
    // ground the surface pass has already finished with.
    for (const sg of this._farmPlotSigns) this._farmStampSign(chunk, sg);
  }

  /* ===================================================================================
     PHASE 18 — THE RURAL SIGN SYSTEM

     A SIGN IS A LOOKUP, exactly like a farmstead. _farmSignAt(bx, bz) answers "is there
     a sign at this crossroads, and precisely what does it say" from the parcel
     coordinates and fixed seeds alone. Nothing is stored, so the text cannot drift
     across an unload/reload cycle: the same integer hashes produce the same name index,
     the same arrow and the same post position forever.

     SIGNS ONLY EXIST AT JUNCTIONS. That is not an arbitrary restriction, it is what
     makes them believable — a fingerpost stands where a decision is possible, and a
     board halfway down an unbranching lane has nothing to tell anyone. It also bounds
     the cost: the test opens with two lane lookups that fail for ~70% of parcels.

     THE VOCABULARY IS HONEST. A destination sign is only ever written after the thing
     it names has been FOUND — the search below walks the cross lane looking for a real
     farmstead, landmark, water tower or orchard, and if it finds nothing the sign
     degrades to naming the road itself or to a weathered board with no legible paint at
     all. The brief is explicit that navigation must be trustworthy in this phase so
     that later phases have something to subvert; a sign pointing at nothing would spend
     that on the first crossroads the player met.
     =================================================================================== */
  _farmSignAt(bx, bz) {
    const slot = (((bx * 22695477) ^ (bz * 39916801)) >>> 0) & 63;
    if (!this._farmSignCache) { this._farmSignCache = new Array(64); this._farmSignKey = new Array(64); }
    const key = bx + ':' + bz;
    if (this._farmSignKey[slot] === key) return this._farmSignCache[slot];

    let sg = null;
    // Junctions only, and inside the region only.
    if (this._farmLaneX(bx) && this._farmLaneZ(bz) &&
        isFarmlandsWorldPos(bx * FARM_P + 1, bz * FARM_P + 1) &&
        this._farmHash(bx, bz, 617) < FARM_JUNCTION_SIGN_CHANCE) {

      /* Which of the two roads does this sign face? A fingerpost is read by someone
         travelling on one road about somewhere down the OTHER, so the board runs
         perpendicular to the road it is read from and its arrow points along the road it
         advertises — which is how a real crossroads sign works and why a player can use
         it without being told to. */
      const readZ = this._farmHash(bx, bz, 619) < 0.5;   // true: read by travellers on the N-S lane
      const run = readZ ? 'x' : 'z';                     // the board's long axis
      const axis = readZ ? 'x' : 'z';                    // the axis the arrow points along

      // The junction corner the post stands on: inside the widened apron, well clear of
      // both carriageways. Offsets are sampled at the junction centre.
      /* PHASE 18.1 — the post is positioned from the ROUTE CENTRELINE, which may now be
         anywhere within FARM_ROUTE_A of the grid line. Resolved in two steps because each
         route is a function of the other axis: fix the crossing z from the E-W route, then
         fix x from the N-S route sampled at that z. Four cells out puts the sign on the
         verge, clear of a carriageway that is only 1.5 cells wide either side. */
      /* PHASE 18.1 — THE POST IS PROBED OUT, NOT OFFSET BY A CONSTANT. A fixed setback
         from the centreline was safe while the junction apron was a fixed size, but the
         apron is now lopsided by design and reaches between two and five cells depending
         on the quadrant — so a constant put 2108 sign cells out of 6529 standing in the
         middle of a worn crossroads. Walking outward until the surface itself stops being
         a driving surface is both correct and self-maintaining: whatever the apron does
         next, the sign lands beside it rather than on it. */
      const cz0 = Math.round(bz * FARM_P + this._farmRouteZ(bz, bx * FARM_P));
      const cx0 = Math.round(bx * FARM_P + this._farmRouteX(bx, cz0));
      const clear = (x, z) => {
        const q = this._farmSurfaceAt(x, z);
        return q !== FARM_SURF.TRACK && q !== FARM_SURF.RUT &&
               q !== FARM_SURF.DITCH && q !== FARM_SURF.BOUNDARY;
      };
      let sx = cx0 + FARM_LANE_HALF + 2, sz = cz0 + FARM_LANE_HALF + 2;
      let placed = false;
      for (let k = 0; k < 8 && !placed; k++) {
        const tx = cx0 + FARM_LANE_HALF + 2 + k;
        for (let m = 0; m < 8; m++) {
          const tz = cz0 + FARM_LANE_HALF + 2 + m;
          // Both cells the board will occupy have to be clear, not just its anchor.
          const bx2 = tx + (run === 'x' ? 1 : 0), bz2 = tz + (run === 'z' ? 1 : 0);
          if (clear(tx, tz) && clear(bx2, bz2)) { sx = tx; sz = tz; placed = true; break; }
        }
      }
      if (!placed) sg = null;

      // --- What can this sign honestly say? Look both ways down the advertised road.
      let nameIdx = -1, arrow = 0, mode = 'blank';
      const fwd = this._farmDestinationAlong(bx, bz, axis, 1);
      const back = this._farmDestinationAlong(bx, bz, axis, -1);
      let pick = null, dir = 0;
      if (fwd && back) {
        // Both ways lead somewhere: name the nearer, which is what a real sign does.
        if (fwd.dist <= back.dist) { pick = fwd; dir = 1; } else { pick = back; dir = -1; }
      } else if (fwd) { pick = fwd; dir = 1; }
      else if (back) { pick = back; dir = -1; }

      if (pick) { nameIdx = pick.nameIdx; arrow = dir; mode = 'dest'; }
      else {
        /* Nothing down there worth naming. A road name is always true — the lane
           exists — so it is the honest fallback, and a proportion of boards have simply
           lost their paint, which is both what abandoned signage looks like and what
           keeps the vocabulary from feeling like a menu. */
        if (this._farmHash(bx, bz, 631) < 0.42) {
          nameIdx = -1; mode = 'blank';
        } else {
          const line = readZ ? bx : bz;
          nameIdx = FARM_SIGN_ROAD_IDX[Math.floor(this._farmHash(line, readZ ? 0 : 1, 641) * FARM_SIGN_ROAD_IDX.length) % FARM_SIGN_ROAD_IDX.length];
          mode = 'road';
        }
      }

      if (placed) sg = {
        bx, bz, x: sx, z: sz, run, mode, nameIdx, arrow,
        baseY: this._farmBaseHeightAt(sx, sz),
        // The rectangle a chunk must overlap to take part in stamping this sign.
        rx0: sx - 2, rz0: sz - 2,
        rx1: sx + (run === 'x' ? 2 : 1) + 2, rz1: sz + (run === 'z' ? 2 : 1) + 2,
      };
      // Never inside the Level 2 keep-out, and never on ground a building already owns.
      if (sg && this._farmPlotClashesHome(sg.rx0, sg.rz0, sg.rx1, sg.rz1)) sg = null;
      else if (sg && this._farmMinorBlocked(sg.rx0, sg.rz0, sg.rx1, sg.rz1)) sg = null;
    }
    this._farmSignKey[slot] = key;
    this._farmSignCache[slot] = sg;
    return sg;
  }

  /* THE DESTINATION SEARCH. Walks one direction along a lane looking for something a
     sign may legitimately name, nearest first, and gives up quickly. Every lookup it
     makes is one of the memoised placement functions, so a repeated search over the same
     ground costs almost nothing after the first.

     ORDER IS PRIORITY, not convenience: a farmstead is the most useful thing to point a
     traveller at, then a landmark, then a water tower, then a field. */
  _farmDestinationAlong(bx, bz, axis, dir) {
    // --- Farmsteads, parcel by parcel along the lane.
    for (let i = 1; i <= FARM_SIGN_SEARCH_PARCELS; i++) {
      const px = axis === 'x' ? bx + dir * i : bx;
      const pz = axis === 'z' ? bz + dir * i : bz;
      const st = this._farmSteadAt(px, pz);
      // Only a farm that actually carries its name at the gate may be named on a
      // fingerpost — otherwise the player follows the sign and arrives at an anonymous
      // yard, which reads as the sign having lied.
      if (st && st.hasSign) return { nameIdx: st.nameIdx, dist: i };
    }
    // --- Landmarks, on their own much coarser grid. A rural fingerpost pointing at a
    // chapel a field back from the road is ordinary, so a lateral tolerance is allowed.
    const originX = bx * FARM_P + FARM_P / 2, originZ = bz * FARM_P + FARM_P / 2;
    const reach = FARM_SIGN_SEARCH_PARCELS * FARM_P;
    const g0 = Math.floor((axis === 'x' ? originX : originZ) / FARM_LM_P);
    for (let k = 0; k <= 1; k++) {
      const gi = g0 + dir * k;
      const gx = axis === 'x' ? gi : Math.floor(originX / FARM_LM_P);
      const gz = axis === 'z' ? gi : Math.floor(originZ / FARM_LM_P);
      const lm = this._farmLandmarkAt(gx, gz);
      if (!lm) continue;
      if (lm.kind !== FARM_LM.CHAPEL && lm.kind !== FARM_LM.GRAVEYARD) continue;
      const cx = lm.ox + (lm.size >> 1), cz = lm.oz + (lm.size >> 1);
      const along = axis === 'x' ? (cx - originX) * dir : (cz - originZ) * dir;
      const lat = axis === 'x' ? Math.abs(cz - originZ) : Math.abs(cx - originX);
      if (along <= 0 || along > reach || lat > FARM_SIGN_LATERAL) continue;
      return { nameIdx: FARM_SIGN_IDX_OF[lm.kind === FARM_LM.CHAPEL ? 'CHAPEL' : 'CEMETERY'],
               dist: along / FARM_P };
    }
    // --- A water tower, on the minor grid. Short reach: it is a landmark you can see,
    // so a sign for one four hundred blocks away would be pointless.
    const mSteps = Math.min(8, (FARM_SIGN_SEARCH_PARCELS * FARM_P) / FARM_MINOR_P);
    for (let i = 1; i <= mSteps; i++) {
      const mx = axis === 'x' ? Math.floor(originX / FARM_MINOR_P) + dir * i : Math.floor(originX / FARM_MINOR_P);
      const mz = axis === 'z' ? Math.floor(originZ / FARM_MINOR_P) + dir * i : Math.floor(originZ / FARM_MINOR_P);
      const mn = this._farmMinorAt(mx, mz);
      if (mn && mn.kind === FARM_MINOR.WATERTOWER) {
        return { nameIdx: FARM_SIGN_IDX_OF.WATERTOWER, dist: i * FARM_MINOR_P / FARM_P };
      }
    }
    /* --- A named field. The weakest destination, and the search is deliberately only
       ONE parcel deep. At three it fired on half of all junctions — 0.11 orchards per
       parcel over six chances — and ORCHARD became the commonest word in the dimension,
       which is exactly the failure the sparse-signage rule exists to prevent. A sign
       may name the field it is standing next to; it may not go looking for one. */
    for (let i = 1; i <= 1; i++) {
      const px = axis === 'x' ? bx + dir * i : bx;
      const pz = axis === 'z' ? bz + dir * i : bz;
      if (this._farmParcel(px, pz).kind === FARM_FIELD.ORCHARD) {
        return { nameIdx: FARM_SIGN_IDX_OF.ORCHARD, dist: i };
      }
    }
    return null;
  }

  /* ===================================================================================
     PHASE 20 — RESOLVING THE JOURNEY

     TWO AUTHORED SITES, PLACED RATHER THAN HOPED FOR, AND NEITHER OF THEM A CONSTANT.

     Phase 16 pinned the Disconnected Home to a fixed coordinate pair, which was safe
     only because the lanes were straight to within two blocks. Phase 18.1's routes
     wander up to fourteen, so a fixed plot in a laned parcel is a plot that will
     eventually have a carriageway through the middle of it. Both sites are therefore
     resolved the way a farmstead resolves its yard: sample the bounding routes across
     the parcel, take the clear window they leave, and sit the plot inside it.

     THIS RUNS ONCE, AT BOOT, BEFORE ANY CHUNK EXISTS, and it reads nothing but the lane
     hashes and the route spine. So it is identical on every launch, identical after any
     unload/reload cycle, and — critically — the Rift Core chest key is derivable from it
     without a single voxel having been written. Level 2 progression cannot depend on
     visit order.
     =================================================================================== */
  _farmClearWindow(bx, bz, clear) {
    /* The widest the two bounding routes get across this parcel, sampled at eight
       stations. Eight rather than four: a FARM_ROUTE_SEG is 40 blocks and a parcel is
       64, so a parcel can contain a whole node and its neighbours, and four stations
       measurably missed the extreme of a strong bend. */
    const spanX = (line) => {
      let lo = 1e9, hi = -1e9;
      for (let k = 0; k <= 8; k++) {
        const o = this._farmRouteX(line, bz * FARM_P + k * (FARM_P / 8));
        if (o < lo) lo = o;
        if (o > hi) hi = o;
      }
      return [lo, hi];
    };
    const spanZ = (line) => {
      let lo = 1e9, hi = -1e9;
      for (let k = 0; k <= 8; k++) {
        const o = this._farmRouteZ(line, bx * FARM_P + k * (FARM_P / 8));
        if (o < lo) lo = o;
        if (o > hi) hi = o;
      }
      return [lo, hi];
    };
    /* THE WINDOW HAS TO AGREE WITH THE ROAD HIERARCHY, or the authored landmarks are
       sized against roads that are not there. Inside the corridor a crossing lane that
       farmCrossKept discarded writes nothing to the ground, and neither does a parallel
       E-W lane — so neither may take a bite out of the window either. Getting this wrong
       is not cosmetic: the fallen tower is 46 blocks long and the first attempt could not
       place it at all, because two lanes that the surface pass had already suppressed
       were still each claiming ten blocks of the parcel. */
    const inCor = farmInCorridor(bx, bz);
    const laneXHere = (line) => this._farmLaneX(line) && (!inCor || farmCrossKept(line));
    const laneZHere = (line) => this._farmLaneZ(line) && (!inCor || line === FARM_J_LINE);
    const clearX = (line) => (inCor && !farmCrossKept(line)) ? 0
                           : (inCor ? clear - 1 : clear);            // a demoted crossing is narrow
    const clearZ = (line) => (inCor && line === FARM_J_LINE)
                           ? clear + (FARM_J_MAIN_VERGE - FARM_VERGE_U) : clear;
    let loX = 0, hiX = FARM_P, loZ = 0, hiZ = FARM_P;
    if (laneXHere(bx)) loX = Math.ceil(spanX(bx)[1] + clearX(bx));
    if (laneXHere(bx + 1)) hiX = Math.floor(FARM_P + spanX(bx + 1)[0] - clearX(bx + 1));
    if (laneZHere(bz)) loZ = Math.ceil(spanZ(bz)[1] + clearZ(bz));
    if (laneZHere(bz + 1)) hiZ = Math.floor(FARM_P + spanZ(bz + 1)[0] - clearZ(bz + 1));
    if (loX < 0) loX = 0;
    if (loZ < 0) loZ = 0;
    if (hiX > FARM_P) hiX = FARM_P;
    if (hiZ > FARM_P) hiZ = FARM_P;
    return { loX, hiX, loZ, hiZ };
  }

  /* Places one authored site in a journey parcel row. `bias` is 'lane' for something the
     road visibly serves (the tower, which sits hard against its own service road) and
     'centre' for something that must NOT read as connected to the road — which is the
     entire point of the Disconnected Home and is why it is centred in its field with a
     clear band of open ground on both sides. */
  _farmJourneySite(bx, w, d, bias) {
    const CLEAR = FARM_MARGIN + 3;
    /* The lane divides two parcel ROWS: FARM_J_LINE is the one SOUTH of it (the lane runs
       along that row's northern edge) and FARM_J_LINE-1 the one north. BOTH are evaluated
       and the better one wins, because "which side of the road" is not arbitrary for
       either of the two things this places:

         'lane'  the water tower, which must stand hard against its own service road AND
                 in the open. Of the two candidate plots in its parcel column one came out
                 at an Ashen Forest field value of 0.155 — the woodland edge, canopy over
                 17% of the columns within forty blocks — and the other at -0.067, open
                 fields. The whole point of a thirty-seven-block landmark is that you see
                 it across country, so the OPENER plot wins and the tie-break is the biome
                 field itself rather than a coin.
         'far'   the Disconnected Home, which must NOT read as served by the road: it
                 takes whichever plot leaves the most open ground between itself and the
                 lane, and that gap is where every piece of missing-farm evidence goes.  */
    let best = null, bestScore = -Infinity;
    for (const bz of [FARM_J_LINE, FARM_J_LINE - 1]) {
      const win = this._farmClearWindow(bx, bz, CLEAR);
      if (win.hiX - win.loX < w || win.hiZ - win.loZ < d) continue;
      const south = (bz === FARM_J_LINE);      // the lane is on this parcel's north edge
      let lz;
      if (bias === 'lane') lz = south ? win.loZ : win.hiZ - d;         // hard against the road
      else lz = south ? win.hiZ - d : win.loZ;                          // as far from it as fits
      const lx = win.loX + Math.floor((win.hiX - win.loX - w) / 2);
      const ox = bx * FARM_P + lx, oz = bz * FARM_P + lz;
      const cx = ox + (w >> 1), cz = oz + (d >> 1);
      const score = bias === 'lane'
        ? -farmlandsBiomeValue(cx, cz)                       // the more open, the better
        : (south ? win.hiZ - d - win.loZ : win.hiZ - d - win.loZ);   // the further off the road
      if (score <= bestScore) continue;
      bestScore = score;
      best = {
        bx, bz, south, ox, oz, w, d, x1: ox + w, z1: oz + d,
        cx, cz,
        px0: ox - 2, px1: ox + w + 1, pz0: oz - 2, pz1: oz + d + 1,
        /* The bank's outer bound. It can never be wider than the heightfield's own
           range, because the ramp walks back one block per ring and stops the moment it
           meets the natural ground. Everything outside this is rejected by four
           comparisons — see _farmSitePad. */
        bx0: ox - 2 - FARM_PAD_BANK, bx1: ox + w + 1 + FARM_PAD_BANK,
        bz0: oz - 2 - FARM_PAD_BANK, bz1: oz + d + 1 + FARM_PAD_BANK,
      };
    }
    return best;
  }

  _farmResolveJourney() {
    /* --- THE FALLEN TOWER, the journey's first "what is THAT?". It is placed with the
       'lane' bias like its standing twin, because the thing that makes it land is walking
       along the road and having it lying across the fields beside you. */
    const fbx = FARM_J_B0 + FARM_J_FALLEN * FARM_J_DIR;
    const F = this._farmJourneySite(fbx, FARM_FALLEN_PLOT_W, FARM_FALLEN_PLOT_D, 'lane');
    if (!F) throw new Error('PHASE 20: no clear window for the fallen water tower');
    F.padY = Math.max(this._farmBaseHeightAt(F.cx, F.cz), FARM_WATER_Y + 1);
    F.seed = Math.floor(this._farmHash(F.bx, F.bz, 953) * 1e6);
    this.farmFallen = F;

    // --- THE WATER TOWER --------------------------------------------------------------
    const tbx = FARM_J_B0 + FARM_J_TOWER * FARM_J_DIR;
    const T = this._farmJourneySite(tbx, FARM_TOWER_PLOT, FARM_TOWER_PLOT, 'lane');
    if (!T) throw new Error('PHASE 20: no clear window for the water tower facility');
    /* THE PLATFORM IS CAPPED, and the cap is arithmetic rather than taste. The lamp sits
       FARM_TOWER_LAMP_DY above the pad and chunk data is CHUNK_SY tall, so a pad above
       CHUNK_SY - FARM_TOWER_LAMP_DY - 2 would truncate the mast. Capping instead of
       clamping the structure means the tower is never shortened: it simply stands on a
       graded platform, which is what a real one does. */
    /* AND FLOORED AT THE WATER TABLE. _farmCache raises any padded column that would
       have flooded up to the table and then suppresses the water — so a pad resolved
       BELOW the table leaves the stamper building at one height and the ground sitting
       at another, which buries the bottom course of whatever stands on it. Both journey
       sites therefore resolve their pad against the table directly. */
    T.padY = Math.min(Math.max(this._farmBaseHeightAt(T.cx, T.cz), FARM_WATER_Y + 1),
                      FARM_TOWER_MAX_BASE);
    T.lampY = T.padY + FARM_TOWER_LAMP_DY;
    T.seed = Math.floor(this._farmHash(T.bx, T.bz, 907) * 1e6);
    this.farmTower = T;

    // --- THE DISCONNECTED HOME --------------------------------------------------------
    const hbx = FARM_J_B0 + FARM_J_HOME * FARM_J_DIR;
    const H = this._farmJourneySite(hbx, FARM_HOME_PLOT_W, FARM_HOME_PLOT_D, 'far');
    if (!H) throw new Error('PHASE 20: no clear window for the Disconnected Home');
    H.padY = Math.max(this._farmBaseHeightAt(H.cx, H.cz), FARM_WATER_Y + 1);
    /* THE HOUSE INSIDE THE PROPERTY. Everything about the building — its walls, its
       rooms, its staircase, its chest — is derived from this one origin, so the plot can
       move without a single interior coordinate being touched. */
    H.hx = H.ox + 11; H.hz = H.oz + 13;
    H.hw = FARM_HOME_HOUSE_W; H.hd = FARM_HOME_HOUSE_D;
    H.upY = H.padY + FARM_HOME_WALL_H;         // the upper floor's walkable level
    /* THE BURIED VOLUME.

       ITS DEPTH IS AN INVARIANT, NOT A PREFERENCE. The ceiling has to stay under the
       lowest ground the heightfield can ever produce, everywhere it runs — and it runs
       seventy blocks east of the property, out from under the levelled pad and into
       terrain the generator is free to shape. FARM_MIN_Y is the floor of that shaping, so
       the volume is pinned at least five blocks below it as well as eleven below the
       farmhouse, and takes whichever is deeper. That is what makes it structurally
       impossible for a basin, a watercourse or a ditch to ever cut into it. */
    H.deepY = Math.min(H.padY - 11, FARM_MIN_Y - 5);
    H.hallZ = H.hz + 8;                        // the pantry's own row, carried east
    H.stairX0 = H.hx + 7;                      // where the floor opens
    H.stairSteps = H.padY - H.deepY;
    H.hallX0 = H.stairX0 + H.stairSteps;
    H.hallX1 = H.hallX0 + 33;                  // thirty-four cells of corridor
    H.bigX0 = H.hallX1 + 2;                    // 16 wide: wider than the farmhouse
    H.bigZ0 = H.hallZ - 5;                     // 12 deep: deeper than the farmhouse
    // The rectangle every chunk overlapping any of it has to help stamp.
    H.deepX0 = H.stairX0 - 2; H.deepX1 = H.bigX0 + 16;
    H.deepZ0 = H.hallZ - 10; H.deepZ1 = H.hallZ + 12;
    // The Ancient Chest, on the hearth of a living room that cannot exist.
    H.chest = { x: H.bigX0 + 8, y: H.deepY, z: H.bigZ0 + 1 };
    H.seed = Math.floor(this._farmHash(H.bx, H.bz, 911) * 1e6);
    this.farmHome = H;

    /* --- THE GIANT BARN, five columns past the tower. 'lane' bias again: an agricultural
       complex this size exists because things were driven in and out of it, so it stands
       on the road, and its silhouette is the next thing on the horizon once the tower is
       behind the player. */
    const bbx = FARM_J_B0 + FARM_J_BARN * FARM_J_DIR;
    const B = this._farmJourneySite(bbx, FARM_BARN_PLOT_W, FARM_BARN_PLOT_D, 'lane');
    if (!B) throw new Error('PHASE 20: no clear window for the giant barn');
    B.padY = Math.max(this._farmBaseHeightAt(B.cx, B.cz), FARM_WATER_Y + 1);
    B.ridgeY = B.padY + FARM_BARN_H + FARM_BARN_ROOF;
    /* THE COMPLEX'S LAYOUT IS RESOLVED HERE, NOT IN THE STAMPER, because three other
       things need it: the silhouette proxy has to stand where the barn stands, and both
       the validation suite and the render script have to look at it. Derived twice, it
       drifts — the loft check went looking for a floor eight blocks up in a barn that had
       moved three blocks west, and found half of it. */
    B.bx = B.ox + 3;                                    // the barn sits at the west end
    B.bw = FARM_BARN_W; B.bd = FARM_BARN_D;
    B.laneEdge = B.south ? B.oz : B.z1 - 1;             // the plot edge the road is on
    B.inward = B.south ? 1 : -1;                        // ...and which way the yard runs
    B.bz = B.south ? B.oz + FARM_BARN_YARD : B.z1 - FARM_BARN_YARD - FARM_BARN_D;
    B.seed = Math.floor(this._farmHash(B.bx, B.bz, 967) * 1e6);
    this.farmBarn = B;

    /* --- THE GREAT TREE. It takes the 'far' bias — set back from the road rather than
       standing on it — because a tree that size was never planted by anybody and owes the
       road nothing. The player sees it across a field of dead ground, which is the whole
       composition.

       ITS PAD IS CAPPED like the tower's, and for the same arithmetic reason: the crown
       reaches FARM_TREE_TOP above the pad and chunk data stops at y=63. */
    const rbx = FARM_J_B0 + FARM_J_TREE * FARM_J_DIR;
    const R = this._farmJourneySite(rbx, FARM_TREE_PLOT, FARM_TREE_PLOT, 'far');
    if (!R) throw new Error('PHASE 20: no clear window for the great tree');
    R.padY = Math.min(Math.max(this._farmBaseHeightAt(R.cx, R.cz), FARM_WATER_Y + 1),
                      FARM_TREE_MAX_BASE);
    R.topY = R.padY + FARM_TREE_TOP;
    R.seed = Math.floor(this._farmHash(R.bx, R.bz, 971) * 1e6);
    this.farmTree = R;

    /* THE APPROACH. The rectangle of open field between the journey lane and the
       property, which is where every piece of "a farm should be here and the ground does
       not agree" evidence is written. Held as a rectangle so the chunk pass can reject
       almost every chunk in the region with one comparison. */
    /* THE APPROACH is the band of open field between the lane and the property. The lane
       runs east-west; the property sits thirty-odd blocks off it; so the band is a
       rectangle spanning the property's width and reaching back to the road. */
    const laneZ = Math.round(this._farmJourneyLaneZ(H.cx));
    this.farmApproach = {
      x0: H.ox - 6, x1: H.x1 + 6,
      z0: Math.min(laneZ + FARM_MARGIN, H.oz - 1), z1: H.oz - 1,
      laneZ, laneX: H.cx, south: H.south,
    };
    if (!H.south) { this.farmApproach.z0 = H.z1 + 1; this.farmApproach.z1 = Math.max(laneZ - FARM_MARGIN, H.z1 + 1); }
  }

  /* World z of the journey lane's centreline at a given x. The journey's authored marks
     are all placed relative to this rather than to the grid line, so a bend that carries
     the road fourteen blocks sideways carries everything hung off it too — a fence post
     "beside the road" stays beside the road. */
  _farmJourneyLaneZ(wx) {
    return FARM_J_LINE * FARM_P + this._farmRouteZ(FARM_J_LINE, wx);
  }

  /* ===================================================================================
     PHASE 20 — THE WATER TOWER'S DISTANT SILHOUETTE

     WHY THIS EXISTS AT ALL. The Farmlands run a fixed exponential fog at 0.028 and the
     streamer holds eight chunks — so past about sixty blocks the real tower is neither
     loaded nor visible, and requirement 36 asks for a landmark readable from a
     substantial distance that fog does NOT hide. The two obvious fixes are both wrong:
     thinning the fog would take the Rotting Fields' close, oppressive horizon with it,
     and widening the stream radius would cost generation time in every direction to
     serve one object.

     So the tower gets what a real game gives a real landmark: a fog-exempt proxy. Ten
     boxes, three shared materials, one group, built once and never rebuilt, standing at
     the tower's true position with its opacity driven by distance and its colour lerped
     toward the fog it is standing against so it reads as far away rather than as pasted
     on. It is depth-tested, so a hill or a barn in front of it still occludes it.

     IT HANDS OVER RATHER THAN OVERLAPPING. Inside FARM_TOWER_PROXY_NEAR the proxy is
     fully faded out and the real voxel structure is doing all the work, so the player is
     never looking at both.
     =================================================================================== */
  _farmTowerBuildBeacon() {
    const T = this.farmTower;
    if (!T || this.farmTowerProxy) return;
    const g = new THREE.Group();
    /* Three materials for ten meshes. The silhouette colour is a desaturated grey-green
       a shade darker than the Rotting Fields fog: dark enough to read as a shape against
       the sky, close enough in hue that it belongs to the same air. */
    /* MEASURED AGAINST THE FOG IT STANDS IN, not chosen. EnvironmentSystem paints the
       Rotting Fields at 0x2D3328 — a very dark olive — so a silhouette DARKER than the
       air disappears into it, which is what the first pass did: rendered from two hundred
       and fifty blocks the tower was a barely-there smudge, and requirement 36 asks for
       something a player cannot casually miss. These are deliberately lighter than the
       fog, so the tower reads as a pale shape against a dark sky the way a real structure
       does at dusk. */
    const steel = new THREE.MeshBasicMaterial({
      color: 0x707A6E, fog: false, transparent: true, opacity: 0, depthWrite: false });
    const dark = new THREE.MeshBasicMaterial({
      color: 0x596052, fog: false, transparent: true, opacity: 0, depthWrite: false });
    this._towerProxyMats = [steel, dark];
    const box = (w, h, d, x, y, z, m) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      g.add(mesh);
      return mesh;
    };
    const LEG = 5, R = FARM_TOWER_R;
    for (const [lx, lz] of [[-LEG, -LEG], [LEG, -LEG], [-LEG, LEG], [LEG, LEG]]) {
      box(1.1, FARM_TOWER_LEG_H, 1.1, lx + 0.5, FARM_TOWER_LEG_H / 2, lz + 0.5, dark);
    }
    // Two bracing bands, so the understructure does not read as four unconnected lines.
    for (const ty of [7, 15]) {
      box(LEG * 2 + 1.4, 0.5, 0.5, 0.5, ty, -LEG + 0.5, dark);
      box(LEG * 2 + 1.4, 0.5, 0.5, 0.5, ty, LEG + 0.5, dark);
      box(0.5, 0.5, LEG * 2 + 1.4, -LEG + 0.5, ty, 0.5, dark);
      box(0.5, 0.5, LEG * 2 + 1.4, LEG + 0.5, ty, 0.5, dark);
    }
    box(R * 2 + 1, FARM_TOWER_TANK_H, R * 2 + 1, 0.5,
        FARM_TOWER_LEG_H + FARM_TOWER_TANK_H / 2, 0.5, steel);
    box(R * 2 - 3, 3, R * 2 - 3, 0.5, FARM_TOWER_LEG_H + FARM_TOWER_TANK_H + 1.5, 0.5, steel);
    box(0.7, 3, 0.7, 0.5, FARM_TOWER_LEG_H + FARM_TOWER_TANK_H + 4, 0.5, dark);
    g.position.set(T.cx, T.padY, T.cz);
    g.visible = false;
    g.renderOrder = -1;      // behind everything: it is scenery, not an object
    this.scene.add(g);
    this.farmTowerProxy = g;

    /* THE LAMP ITSELF. A small emissive core and a soft halo, both fog-exempt, both at
       zero opacity until the schedule says otherwise. The halo carries a generated
       radial texture rather than a flat sprite, because an untextured sprite is a
       square and a square red light at the top of a mast reads as a bug. */
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2f22, fog: false, transparent: true,
                                    opacity: 0, depthWrite: false }));
    core.position.set(T.cx + 0.5, T.lampY + 0.55, T.cz + 0.5);
    core.visible = false;
    this.scene.add(core);
    this.farmTowerCore = core;

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: _farmLampHaloTexture(), color: 0xff4433, fog: false, transparent: true,
      opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(5, 5, 1);
    halo.position.copy(core.position);
    halo.visible = false;
    this.scene.add(halo);
    this.farmTowerHalo = halo;

    /* THE SCHEDULE. Its clock is gameplay state, not world state: nothing it does can
       write a voxel, so it cannot desynchronise the world. Every INTERVAL it uses,
       though, comes from the world seed and the tower's own identity through the same
       integer hash everything else in this dimension uses — so a given flash index has
       the same gap and the same duration on every launch, which is what makes the
       anomaly reproducible for a test while remaining unpredictable for a player. */
    this.farmTowerLight = {
      idx: 0, clock: 0, on: false, onUntil: 0,
      next: this._farmTowerGap(0), gaze: 'far', flashes: 0,
    };
  }

  _farmTowerGap(k) {
    return FARM_TOWER_GAP_MIN + this._farmHash(k, this.farmTower.seed, 811) * FARM_TOWER_GAP_VAR;
  }
  _farmTowerDur(k) {
    return FARM_TOWER_ON_MIN + this._farmHash(k, this.farmTower.seed, 823) * FARM_TOWER_ON_VAR;
  }

  /* THE ANOMALY. Two dozen lines, no objective, no prompt, no sound, no explanation.

     Read it as a state machine on one variable — where the player is looking:

       DIRECT   (< FARM_TOWER_GAZE_DIRECT off the lamp)
                the lamp is forced dark THIS FRAME, and the schedule clock does not
                advance. A player who stares at the tower sees a tower.
       PERIPHER (out to FARM_TOWER_GAZE_PERIPH)
                the clock runs at full rate. This is the band where the lamp is on
                screen but not being looked at, and it is where the flashes land.
       BEHIND   (anything further)
                the clock runs slower, so flashes are not spent on a tower nobody
                could see even out of the corner of an eye.

     A flash in progress is killed the instant the gaze comes back, which is the whole
     trick: the light is never caught lit, only ever just-having-been. */
  updateFarmTowerLight(dt, camera, inFarmlands, fogColor) {
    const T = this.farmTower;
    if (!T) return;
    if (!this.farmTowerProxy) this._farmTowerBuildBeacon();
    const proxy = this.farmTowerProxy, core = this.farmTowerCore, halo = this.farmTowerHalo;
    if (!inFarmlands || !camera) {
      proxy.visible = false; core.visible = false; halo.visible = false;
      return;
    }

    const px = camera.position.x, py = camera.position.y, pz = camera.position.z;
    const lx = T.cx + 0.5 - px, ly = T.lampY + 0.55 - py, lz = T.cz + 0.5 - pz;
    const dist = Math.sqrt(lx * lx + ly * ly + lz * lz);

    // --- THE SILHOUETTE. Opacity by distance, colour lerped toward the fog it stands in.
    let vis = 0;
    if (dist > FARM_TOWER_PROXY_NEAR && dist < FARM_TOWER_PROXY_FAR) {
      if (dist < FARM_TOWER_PROXY_FULL) {
        vis = (dist - FARM_TOWER_PROXY_NEAR) / (FARM_TOWER_PROXY_FULL - FARM_TOWER_PROXY_NEAR);
      } else if (dist > FARM_TOWER_PROXY_FAR - 90) {
        vis = (FARM_TOWER_PROXY_FAR - dist) / 90;
      } else vis = 1;
    }
    proxy.visible = vis > 0.01;
    if (proxy.visible && this._towerProxyMats) {
      /* Aerial perspective, done honestly: the further away the silhouette is, the more
         of the fog colour is mixed into it, so at three hundred blocks it is barely
         separated from the air and at eighty it is nearly its own colour. Without this
         the proxy reads as a cardboard cut-out the moment it appears. */
      /* ...and the haze is capped at half. Blended further than that the silhouette stops
         being a landmark and starts being weather. */
      const haze = Math.min(0.50, dist / FARM_TOWER_PROXY_FAR * 0.60);
      for (let i = 0; i < this._towerProxyMats.length; i++) {
        const m = this._towerProxyMats[i];
        m.opacity = vis * (i === 0 ? 0.95 : 1.0);
        m.color.setHex(i === 0 ? 0x707A6E : 0x596052);
        if (fogColor) m.color.lerp(fogColor, haze);
      }
    }

    // --- THE GAZE.
    const st = this.farmTowerLight;
    if (dist > FARM_TOWER_ACTIVE_R) {
      st.gaze = 'far';
      if (st.on) { st.on = false; }
      core.visible = false; halo.visible = false;
      return;
    }
    /* THE GAZE TEST IS AGAINST THE WHOLE TOWER, NOT AGAINST THE LAMP.

       This mattered more than it looks. Aimed at the lamp alone, a player standing a
       hundred and twenty blocks away and looking level at the structure is seventeen
       degrees off it — the tower is thirty-seven blocks tall and they are looking at its
       legs — so the schedule kept running and the lamp flashed while they were staring
       straight at it. Measured over three minutes of exactly that pose: a hundred and two
       flashes, which is the opposite of the entire design.

       So the offset is taken to the nearest point of the tower's AXIS, sampled at five
       stations from the footings to the mast. Looking anywhere at the tower counts as
       looking at it, which is what a player means by the phrase. */
    _farmTowerFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    let cosBest = -1;
    for (let i = 0; i <= 4; i++) {
      const y = T.padY + (T.lampY - T.padY) * (i / 4);
      const ax = T.cx + 0.5 - px, ay = y - py, az = T.cz + 0.5 - pz;
      const inv = 1 / Math.max(1e-6, Math.sqrt(ax * ax + ay * ay + az * az));
      const c = _farmTowerFwd.x * ax * inv + _farmTowerFwd.y * ay * inv + _farmTowerFwd.z * az * inv;
      if (c > cosBest) cosBest = c;
    }
    const ang = Math.acos(Math.max(-1, Math.min(1, cosBest)));
    const direct = ang < FARM_TOWER_GAZE_DIRECT;
    st.gaze = direct ? 'direct' : (ang < FARM_TOWER_GAZE_PERIPH ? 'peripheral' : 'behind');

    if (direct) {
      // Looking straight at it: the lamp is dark, and time does not pass for it.
      if (st.on) st.on = false;
    } else {
      st.clock += dt * (st.gaze === 'peripheral' ? FARM_TOWER_PERIPH_RATE : FARM_TOWER_BEHIND_RATE);
      if (st.on) {
        if (st.clock >= st.onUntil) {
          st.on = false;
          st.idx++;
          st.next = st.clock + this._farmTowerGap(st.idx);
        }
      } else if (st.clock >= st.next) {
        st.on = true;
        st.flashes++;
        st.onUntil = st.clock + this._farmTowerDur(st.idx);
      }
    }

    /* THE LAMP IS NEVER FULL BRIGHTNESS AT DISTANCE AND NEVER OFF-SCREEN-BRIGHT UP
       CLOSE. Its opacity falls with range the way a real obstruction light does, which is
       also what keeps it deniable: at two hundred blocks it is a pinprick that was
       either there or was not. */
    const near = Math.max(0.30, Math.min(1, 260 / Math.max(40, dist)));
    core.visible = st.on;
    halo.visible = st.on;
    if (st.on) {
      core.material.opacity = 0.85 * near;
      halo.material.opacity = 0.55 * near;
      const s = 3.2 + dist * 0.012;
      halo.scale.set(s, s, 1);
    }
  }


  /* ===================================================================================
     PHASE 20 REVISION — THE REST OF THE CHAIN'S DISTANT SILHOUETTES

     THE PROBLEM THE TOWER ALREADY SOLVED, NOW FOR THREE MORE LANDMARKS. Everything the
     tower's beacon exists for applies to the fallen tower, the giant barn and the great
     tree: exponential fog at 0.028 and an eight-chunk stream radius mean that without a
     proxy the entire chain is invisible until the player is standing sixty blocks from
     it, and a landmark you cannot see from a distance cannot pull anybody anywhere. The
     revision brief's requirement that distant landmarks draw the player forward is not
     achievable with voxels alone in this dimension, and it is not a fog problem to fix.

     THE RANGES ARE STAGED, WHICH IS THE WHOLE COMPOSITION. Each landmark hands over to
     its own voxels at a different distance and fades in at a different one, so they do
     not all appear at once and the horizon changes as the player walks:

       THE FALLEN TOWER   fades in at 240. Low and long: it never dominates a skyline,
                          it resolves into something recognisable as you approach it.
       THE STANDING TOWER fades in at 380 (unchanged from Phase 20).
       THE GIANT BARN     fades in at 340, so it is already on the horizon while the
                          tower is still the nearest thing — the next place to go exists
                          before the player has finished with this one.
       THE GREAT TREE     fades in at 560, further than anything else in the dimension.
                          It is visible as a dark mass long before it can be identified,
                          which is exactly the effect a tree of that size should have.

     THEY ARE SHAPES, NOT MODELS. Between them: nineteen boxes over four shared
     materials, one group each, built once, depth-tested so terrain still occludes them,
     and faded out entirely before the real geometry streams in. Nothing here is
     animated and nothing here is interactive.
     =================================================================================== */
  _farmBuildLandmarkProxies() {
    if (this._farmLandmarkProxies) return;
    const list = [];
    const mkMat = (hex, op) => new THREE.MeshBasicMaterial({
      color: hex, fog: false, transparent: true, opacity: 0, depthWrite: false });
    const build = (site, ranges, base, paint) => {
      if (!site) return;
      const g = new THREE.Group();
      const mats = [];
      const M = (hex) => { const m = mkMat(hex); mats.push({ m, hex }); return m; };
      const box = (w, h, d, x, y, z, m) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
        mesh.position.set(x, y, z);
        g.add(mesh);
      };
      paint(box, M);
      g.position.set(site.cx, base, site.cz);
      g.visible = false;
      g.renderOrder = -1;
      this.scene.add(g);
      list.push({ site, g, mats, ranges, base });
    };

    /* --- THE FALLEN TOWER. Truss, drum and nose, laid end to end along the ground on
       the same axis the voxels use, so the proxy resolves into the real wreck rather
       than swapping for it. */
    const F = this.farmFallen;
    /* ITS HAND-OVER IS EARLIER THAN THE OTHERS', because it is the only landmark in the
       chain that is LOW. At seventy blocks a thirteen-block wreck is down at 14% fog
       transmission and the render showed it as a faint smudge with the proxy not yet
       started; the tower's seventy works because thirty-eight blocks of mast still reads
       through that much air, and a wreck does not. */
    build(F, { near: 50, full: 95, far: 240 }, F ? F.padY : 0, (box, M) => {
      const steel = M(0x6B7468), dark = M(0x555C4F);
      /* Group-relative, and on the SAME road-relative axis the voxels use, so the proxy
         resolves into the real wreck rather than swapping for it. */
      const inward = F.south ? 1 : -1;
      const laneEdge = F.south ? F.oz : F.z1 - 1;
      const at = (t) => (laneEdge + inward * t) - F.cz;
      box(11, 2, 11, 0, 1, at(5), dark);                     // the abandoned footings
      box(11, 10, FARM_TOWER_LEG_H, 0, 5, at(7 + FARM_TOWER_LEG_H / 2), dark);
      box(FARM_TOWER_R * 2, FARM_TOWER_R * 2, FARM_TOWER_TANK_H,
          0, FARM_TOWER_R, at(8 + FARM_TOWER_LEG_H + FARM_TOWER_TANK_H / 2), steel);
      box(5, 5, 8, 0, FARM_TOWER_R, at(12 + FARM_TOWER_LEG_H + FARM_TOWER_TANK_H), dark);
    });

    /* --- THE GIANT BARN. Wall mass, the gable prism above it as a narrower box, and the
       two silos with their cone caps: four masses that between them give the complex the
       lumpy, agricultural profile that stops it reading as a shipping container. */
    const B = this.farmBarn;
    build(B, { near: 70, full: 105, far: 340 }, B ? B.padY : 0, (box, M) => {
      const red = M(0x6A4F44), tin = M(0x6E7469);
      const w = B.bw, d = B.bd;
      const bx = B.bx + (w >> 1) - B.cx;
      const bz = B.bz + (d >> 1) - B.cz;
      box(w, FARM_BARN_H, d, bx, FARM_BARN_H / 2, bz, red);
      box(w + 2, FARM_BARN_ROOF, d * 0.55, bx, FARM_BARN_H + FARM_BARN_ROOF / 2, bz, tin);
      for (let n = 0; n < 2; n++) {
        const sx = B.bx + w + 4 + n * 8 - B.cx;
        const sz = B.bz + 8 + n * 3 - B.cz;
        const hgt = FARM_SILO_H - n * 3;
        box(FARM_SILO_R * 2 + 1, hgt, FARM_SILO_R * 2 + 1, sx, hgt / 2, sz, tin);
        box(FARM_SILO_R * 2 - 1, 2, FARM_SILO_R * 2 - 1, sx, hgt + 1, sz, red);
      }
    });

    /* --- THE GREAT TREE, and it is the only proxy in the dimension that is not grey.
       Everything else on this horizon is dead, rusted or abandoned; the one thing that
       is alive has to announce that from as far away as it can be seen, because the
       contradiction between a green mass and the dead ground around it is the landmark.
       Bole, a broad main crown and four shoulder lobes: five boxes that read as a canopy
       rather than as a ball. */
    const R = this.farmTree;
    build(R, { near: 75, full: 115, far: 560 }, R ? R.padY : 0, (box, M) => {
      const bark = M(0x4B3F30), leaf = M(0x536D3C);
      const CR = FARM_TREE_CANOPY_R;
      box(FARM_TREE_TRUNK_R * 2 + 1, FARM_TREE_TRUNK_H, FARM_TREE_TRUNK_R * 2 + 1,
          0, FARM_TREE_TRUNK_H / 2, 0, bark);
      box(CR * 1.55, 20, CR * 1.55, 0, FARM_TREE_TRUNK_H + 8, 0, leaf);
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        box(CR * 0.95, 13, CR * 0.95, ox * CR * 0.58, FARM_TREE_TRUNK_H + 3, oz * CR * 0.58, leaf);
      }
    });

    this._farmLandmarkProxies = list;
  }

  /* One pass over three groups. Identical distance/haze arithmetic to the tower's, so
     the four landmarks age into the fog at the same rate and no one of them looks like
     it belongs to a different renderer. */
  updateFarmLandmarkProxies(camera, inFarmlands, fogColor) {
    if (!this.farmTree && !this.farmBarn && !this.farmFallen) return;
    if (!this._farmLandmarkProxies) this._farmBuildLandmarkProxies();
    const L = this._farmLandmarkProxies;
    if (!L) return;
    if (!inFarmlands || !camera) {
      for (const e of L) e.g.visible = false;
      return;
    }
    const px = camera.position.x, py = camera.position.y, pz = camera.position.z;
    for (const e of L) {
      const dx = e.site.cx - px, dy = e.base + 12 - py, dz = e.site.cz - pz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const { near, full, far } = e.ranges;
      /* THE OUT-FADE IS PROPORTIONAL, NOT A FIXED NINETY BLOCKS. The tower's ninety is
         a fifth of its three-hundred-and-eighty-block range; applied unchanged to the
         fallen tower's two hundred and forty it left the silhouette at full strength for
         a forty-block window and fading everywhere else, which a render at two hundred
         blocks showed as a landmark already half gone before the player had a chance to
         notice it. Half the gap between full and far, capped at ninety, gives every
         landmark the same shape of appearance at its own scale. */
      const outFade = Math.min(90, (far - full) * 0.5);
      let vis = 0;
      if (dist > near && dist < far) {
        if (dist < full) vis = (dist - near) / (full - near);
        else if (dist > far - outFade) vis = (far - dist) / outFade;
        else vis = 1;
      }
      e.g.visible = vis > 0.01;
      if (!e.g.visible) continue;
      const haze = Math.min(0.50, dist / far * 0.60);
      for (const { m, hex } of e.mats) {
        m.opacity = vis * 0.95;
        m.color.setHex(hex);
        if (fogColor) m.color.lerp(fogColor, haze);
      }
    }
  }

  /* ===================================================================================
     PHASE 19 — BOUNDED LOCAL WATER FLOW

     WHAT THIS IS NOT: a fluid simulator. There is no global tick, no per-cell object, no
     whole-dimension state and no pressure solve. Nothing about water costs anything at
     all until the player edits a block next to some, and the moment it settles the cost
     returns to zero. That is requirement 28 taken literally.

     THE MODEL IS TWO LEVELS OF CONSERVED VOLUME. A deep cell is two units, a shallow
     cell is one, air is none, and every rule below moves units between cells without
     creating or destroying any:

       1. FALL. If the cell below can take units, move as many as fit. Gravity first,
          always — which is what makes a broken dam drain downward rather than smear.
       2. SPLIT. A full cell beside an empty passable cell gives it one unit, so both
          become shallow. This is lateral spread, and it can only happen from a FULL
          cell, which is what stops a puddle creeping across a flat field forever.
       3. RUN DOWNHILL. A shallow cell moves whole into a neighbour whose own floor is
          open — i.e. only where the water would immediately keep falling. Water follows
          the terrain; it does not climb and it does not sprawl.
       4. SETTLE. Nothing applies: the cell leaves the queue and is never looked at
          again until something else disturbs it.

     TERMINATION IS STRUCTURAL, NOT A TIMEOUT. Every rule strictly lowers the total
     potential energy of the system or splits a two into two ones, and the number of
     splits is bounded by the number of reachable cells. On top of that each queued cell
     carries a HOP BUDGET that decrements as the disturbance propagates, so a single
     edit can never influence cells more than FARM_WATER_HOPS away however much water is
     behind it. Two independent bounds, because one of them is the kind of thing that is
     wrong once and then floods a dimension.
     =================================================================================== */
  _wKey(wx, wy, wz) {
    // Exact in a double for |wx|,|wz| < 2^20 — four times the Farmlands span.
    return ((wx + 1048576) * 2097152 + (wz + 1048576)) * 64 + wy;
  }
  _wPush(wx, wy, wz, hops) {
    if (hops <= 0 || wy < 0 || wy >= CHUNK_SY) return;
    if (this._wQ.length >= FARM_WATER_QMAX) return;     // hard queue ceiling
    const k = this._wKey(wx, wy, wz);
    const seen = this._wPending.get(k);
    if (seen !== undefined && seen >= hops) return;
    this._wPending.set(k, hops);
    this._wQ.push(wx, wy, wz, hops);
  }
  /* Called from setBlockWorld for every player edit inside the Farmlands. Seeds the
     cell and its six neighbours; if none of them is water the queue drains on the very
     next tick having done nothing, which is the common case and costs one loop. */
  _farmWaterNotify(wx, wy, wz) {
    if (this._wWriting) return;                       // the sim's own writes
    if (!isFarmlandsWorldPos(wx, wz)) return;         // Farmlands only, by design
    if (!this._wQ) { this._wQ = []; this._wPending = new Map(); this._wAcc = 0; }
    const H = FARM_WATER_HOPS;
    this._wPush(wx, wy, wz, H);
    this._wPush(wx, wy + 1, wz, H);
    this._wPush(wx, wy - 1, wz, H);
    this._wPush(wx + 1, wy, wz, H);
    this._wPush(wx - 1, wy, wz, H);
    this._wPush(wx, wy, wz + 1, H);
    this._wPush(wx, wy, wz - 1, H);
  }
  _wWake(wx, wy, wz, hops) {
    const h = hops - 1;
    this._wPush(wx, wy, wz, h);
    this._wPush(wx, wy + 1, wz, h);
    this._wPush(wx + 1, wy, wz, h);
    this._wPush(wx - 1, wy, wz, h);
    this._wPush(wx, wy, wz + 1, h);
    this._wPush(wx, wy, wz - 1, h);
  }
  /* The per-frame entry point. Does nothing at all — one comparison — unless an edit
     has actually queued something, which is the state the game is in essentially all
     of the time. Runs on a fixed 0.09s tick so flow looks like flow rather than like a
     frame-rate-dependent smear, and processes a hard-capped number of cells per tick so
     a large drain spreads across frames instead of spiking one. */
  updateFarmWater(dt) {
    if (!this._wQ || this._wQ.length === 0) return;
    this._wAcc += dt;
    if (this._wAcc < FARM_WATER_TICK) return;
    this._wAcc = 0;
    let budget = FARM_WATER_STEPS;
    while (budget-- > 0 && this._wQ.length > 0) {
      const wx = this._wQ.shift(), wy = this._wQ.shift(), wz = this._wQ.shift(), hops = this._wQ.shift();
      this._wPending.delete(this._wKey(wx, wy, wz));
      this._wStepCell(wx, wy, wz, hops);
    }
    if (this._wQ.length === 0) this._wPending.clear();
  }
});
