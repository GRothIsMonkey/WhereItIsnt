"use strict";
/* =====================================================================================
   STATIC SUBURBIA — WHAT IT IS MADE OF
   ERA 1.5.3 — MOVED VERBATIM OUT OF VoxelWorld.

   The house shell, its openings, porch, driveway, yard, interiors, garage and street
   details. The methods that encode the block composition of the suburb.

   Every method below is byte-identical to the text that was in game.html, comments and
   all. It is attached to VoxelWorld's prototype by registerWorldContent, which copies
   property descriptors so a moved method is indistinguishable from a declared one.
   See src/world/world-content.js and ARCHITECTURE.md.
   ===================================================================================== */

registerWorldContent('suburbia', 'stampers', class {

  // THE DISCONNECTED HOME (LEVEL 3) — PROGRESSION KEY STRUCTURE (PHASE 5A PART 2).
  // A second, standalone "Disconnected Home" — same wrongness as the Level 1->2
  // one, but stranded out in the ordinary overworld at a fixed, walkable location
  // (DISCONNECTED_HOME_L3_X/Z) rather than tucked inside a sealed pocket dimension,
  // which is the whole point of its name. Eagerly generates + permanently pins
  // every chunk its footprint touches (same pattern as the Farmlands/Suburbia
  // pockets), levels a small pad, and builds a Stone/Granite shell with inverted
  // interior geometry: the walkable floor is capped in roofing stone while an Oak
  // Log "floorboard" pattern lines the ceiling upside down, a pair of doorways are
  // carved into interior walls with solid Stone sitting directly behind them
  // (open onto nothing), and a cluster of furniture floats upside-down against the
  // ceiling. A glowing Ancient Chest hangs dead-center from that inverted ceiling
  // holding the guaranteed Level 3 Rift Core Disk (see openChest()'s
  // level3HomeChestKey branch).
  // CRITICAL DIMENSION GATE (PHASE 5A PART 3): `dimension` is REQUIRED and must be
  // DIMENSION.SUBURBIA. Three independent guards below have to all pass before a
  // single block is written:
  //   1. the caller must explicitly declare it is generating Level 3;
  //   2. the home's own coordinates must actually fall inside the Static Suburbia
  //      pocket (isStaticSuburbiaWorldPos), so a bad constant can't smuggle it out;
  //   3. every chunk it touches must ALREADY EXIST as a Suburbia chunk — this method
  //      never calls _generateChunk(), which is what previously caused ordinary
  //      Overworld terrain to be generated (and permanently pinned) at (0, 500).
  // Any guard failing makes this a silent no-op rather than a partial stamp.
  /* SUPERSEDED IN PHASE 9 — kept only so the historical dimension-gating notes above
     remain readable. It has NO call sites; the Disconnected Home is now stamped by
     _stampDisconnectedHome during Suburbia chunk generation. */
  _genDisconnectedHomeL3(dimension) {
    return false; // dead path, retained for documentation only
    if (dimension !== DIMENSION.SUBURBIA) return false;
    const cx = DISCONNECTED_HOME_L3_X, cz = DISCONNECTED_HOME_L3_Z;
    if (!isStaticSuburbiaWorldPos(cx, cz)) return false;

    const W = 9, H = 5;
    const half = Math.floor(W / 2);
    // Fixed pocket ground plane — NOT _overworldHeightAt(), which is an Overworld
    // terrain formula and has no meaning inside a flat pocket dimension.
    const baseY = SUBURBIA_BASE_Y;

    // Collect only the Suburbia chunks the footprint (plus a 1-chunk margin) already
    // occupies. getChunk() returns undefined for anything outside the pocket, so a
    // footprint that somehow straddled the pocket edge simply drops those cells
    // instead of spawning fresh Overworld chunks to hold them.
    const minCx = Math.floor((cx - half - CHUNK_SX) / CHUNK_SX), maxCx = Math.floor((cx + half + CHUNK_SX) / CHUNK_SX);
    const minCz = Math.floor((cz - half - CHUNK_SZ) / CHUNK_SZ), maxCz = Math.floor((cz + half + CHUNK_SZ) / CHUNK_SZ);
    const touched = [];
    for (let ccx = minCx; ccx <= maxCx; ccx++) {
      for (let ccz = minCz; ccz <= maxCz; ccz++) {
        const existing = this.getChunk(ccx, ccz);
        if (!existing) continue; // never generate — see guard 3 above
        touched.push(existing);
        this.pinnedChunkKeys.add(this.key(ccx, ccz));
      }
    }
    if (!touched.length) return false;

    // Clear the reserved lot and lay a Concrete pad under the footprint (the pocket
    // is paved, so Grass here would read as a seam in the street grid).
    for (let dx = -half - 1; dx <= half + 1; dx++) {
      for (let dz = -half - 1; dz <= half + 1; dz++) {
        const wx = cx + dx, wz = cz + dz;
        for (let dy = 0; dy <= H + 1; dy++) this._writeBlockRaw(wx, baseY + dy, wz, BLOCK.AIR);
        this._writeBlockRaw(wx, baseY - 1, wz, BLOCK.CONCRETE);
      }
    }

    // Shell: ordinary Stone suburb-style walls with a flat Granite roof cap, so
    // it visually reads as "a house" before anything about it feels wrong.
    for (let dx = -half; dx <= half; dx++) {
      for (let dz = -half; dz <= half; dz++) {
        const onEdge = dx === -half || dx === half || dz === -half || dz === half;
        const wx = cx + dx, wz = cz + dz;
        if (onEdge) {
          for (let dy = 0; dy < H; dy++) this._writeBlockRaw(wx, baseY + dy, wz, BLOCK.STONE);
        }
        this._writeBlockRaw(wx, baseY + H - 1, wz, BLOCK.GRANITE);
      }
    }

    // The one working entrance: a plain 2-tall gap on the south wall.
    this._writeBlockRaw(cx, baseY, cz + half, BLOCK.AIR);
    this._writeBlockRaw(cx, baseY + 1, cz + half, BLOCK.AIR);

    // INVERTED INTERIOR GEOMETRY: floor is capped in roofing stone (walkable, but
    // reads as "ceiling material"); the true ceiling overhead is an upside-down
    // Oak Log floorboard pattern — the Level 1->2 Home's trick, re-skinned here.
    for (let dx = -half + 1; dx <= half - 1; dx++) {
      for (let dz = -half + 1; dz <= half - 1; dz++) {
        const wx = cx + dx, wz = cz + dz;
        this._writeBlockRaw(wx, baseY, wz, (Math.abs(dx + dz) % 2 === 0) ? BLOCK.ANDESITE : BLOCK.GRANITE);
        for (let dy = 1; dy < H - 1; dy++) this._writeBlockRaw(wx, baseY + dy, wz, BLOCK.AIR);
        this._writeBlockRaw(wx, baseY + H - 1, wz, BLOCK.OAK_LOG);
      }
    }

    // DOORS LEADING INTO SOLID WALLS: two interior doorway gaps carved into the
    // room's own solid partitions, each with an unbroken Stone block sitting
    // immediately behind it — walk up expecting a threshold and there's simply
    // nowhere for it to lead.
    const fakeDoorSpots = [{ wx: cx - 2, wz: cz - 1 }, { wx: cx + 2, wz: cz + 1 }];
    for (const { wx, wz } of fakeDoorSpots) {
      this._writeBlockRaw(wx, baseY + 1, wz, BLOCK.OAK_LOG);
      this._writeBlockRaw(wx, baseY + 2, wz, BLOCK.OAK_LOG);
      // The Stone directly behind (north of) each fake door frame is left
      // untouched by the interior-hollowing loop above only where it falls
      // outside dx/dz -half+1..half-1 — for these interior spots it's already
      // solid Andesite/Granite floor material, so the "door" opens onto a
      // flush wall rather than another room.
    }

    // FLOATING FURNITURE: pinned mid-air and upside down against the inverted
    // ceiling, as if gravity only runs backward in this one room.
    if (!this.decorGroup) { this.decorGroup = new THREE.Group(); this.scene.add(this.decorGroup); }
    const furniture = buildFloatingFurnitureProp();
    furniture.position.set(cx + 1.5, baseY + H - 1.6, cz - 1.5);
    furniture.rotation.z = Math.PI; // upside down
    furniture.rotation.y = 0.4;
    this.decorGroup.add(furniture);
    this.disconnectedHomeL3Props = [furniture];

    // THE GLOWING CONTAINER: an Ancient Chest hanging from the inverted ceiling
    // dead-center, wrapped in a slow-pulsing point light (see
    // updateDisconnectedHomeGlow) so it reads as clearly "the important thing in
    // the room" — holds the guaranteed Level 3 Rift Core Disk.
    const chestY = baseY + H - 2;
    this._writeBlockRaw(cx, chestY, cz, BLOCK.TREASURE_CHEST);
    this.level3HomeChestKey = cx + ',' + chestY + ',' + cz;
    const glow = new THREE.PointLight(0xffe066, 1.6, 10, 2);
    glow.position.set(cx + 0.5, chestY + 0.5, cz + 0.5);
    this.scene.add(glow);
    this.disconnectedHomeL3Glow = glow;

    for (const chunk of touched) { chunk.dirty = true; this.generateChunkMesh(chunk); }
    return true;
  }

  // LEVEL 3 — STATIC SUBURBIA GENERATION (PHASE 5A). Same enclosed/permanently-
  // pinned pocket shape as the Farmlands (Corrupted Stone perimeter wall), but
  // inside it: a perfectly repeating grid of uniform, IDENTICAL 1990s suburban
  // house shells (every lot uses the exact same footprint, wall height, door
  // side and window placement — no per-house randomness at all), separated by
  // Asphalt roads running the street grid between lot rows/columns with a strip
  // of Concrete sidewalk lining each house, plus a cleared landing pad at the
  // exact center so the Level 3 rift never drops the player inside a wall.
  /* PHASE 9 — Suburbia is streamed, so "generating the region" now only means
     establishing the arrival point and pinning a tiny core around it so the Level 2->3
     rift can never drop the player into an ungenerated chunk. Everything else is
     produced on demand by _genSuburbiaChunk via the ordinary radial streamer. */
  _genStaticSuburbiaRegion() {
    const cx = SUBURBIA_SPAWN_CHUNK, cz = SUBURBIA_SPAWN_CHUNK;
    const centerX = cx * CHUNK_SX + 8, centerZ = cz * CHUNK_SZ + 8;
    this.suburbiaWindows = [];
    this.suburbiaLots = [];
    // A 3x3 pinned core only — nine chunks, not sixty-four, and no perimeter wall.
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const c = this._generateChunk(cx + dx, cz + dz);
        this.pinnedChunkKeys.add(this.key(cx + dx, cz + dz));
        this.generateChunkMesh(c);
      }
    }
    /* PHASE 13 — ARRIVAL. The rift used to drop the player onto a fixed chunk-relative
       offset, which with the rebuilt grid could land them in a carriageway or inside a
       front yard. It now searches the pinned core for a SIDEWALK column and stands them
       there, facing a street — the correct first frame for this dimension, and it keeps
       the player out of the road on the very first step. Falls back to the old fixed
       offset if (impossibly) no sidewalk is in range, so arrival can never fail. */
    const baseY = SUBURBIA_BASE_Y;
    let sx = cx * CHUNK_SX + 3, sz = cz * CHUNK_SZ + 3;
    let found = false;
    const originX = cx * CHUNK_SX, originZ = cz * CHUNK_SZ;
    for (let r = 0; r < 24 && !found; r++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        for (let dz = -r; dz <= r && !found; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const wx = originX + 8 + dx, wz = originZ + 8 + dz;
          if (this._subSurfaceAt(wx, wz) !== SURF.WALK) continue;
          sx = wx; sz = wz; found = true;
        }
      }
    }
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (let dy = 0; dy <= 4; dy++) this._writeBlockRaw(sx + dx, baseY + dy, sz + dz, BLOCK.AIR);
    this.suburbiaSpawn = new THREE.Vector3(sx + 0.5, baseY, sz + 0.5);
  }

  _genSuburbiaChunk(chunk) {
    const x0 = chunk.cx * CHUNK_SX, z0 = chunk.cz * CHUNK_SZ;
    const baseY = SUBURBIA_BASE_Y;

    /* --- GROUND PLANE. Lawns, sidewalks and kerbs are full cubes topping out at baseY
       (the historical ground plane, unmoved); the carriageway and gutter pans are half
       slabs topping out half a block lower. That single difference is the whole street
       hierarchy, and it costs nothing: a road of identical slabs culls every internal
       face exactly as a flat plane of cubes did. */
    const SLICE = CHUNK_SX * CHUNK_SZ;
    chunk.data.fill(BLOCK.STONE, 0, (baseY - 4) * SLICE);
    chunk.data.fill(BLOCK.DIRT, (baseY - 4) * SLICE, (baseY - 1) * SLICE);
    const surfBase = (baseY - 1) * SLICE;
    for (let z = 0; z < CHUNK_SZ; z++) {
      const rowBase = surfBase + z * CHUNK_SX, wz = z0 + z;
      for (let x = 0; x < CHUNK_SX; x++) {
        chunk.data[rowBase + x] = this._subSurfaceBlock(this._subSurfaceAt(x0 + x, wz));
      }
    }
    // Everything above the ground plane is already AIR: Uint8Array arrives zeroed.

    // --- Houses ---------------------------------------------------------------------
    for (const lot of this._subLotsNear(chunk)) {
      if (this._subIsDisconnectedLot(lot)) { this._stampDisconnectedHome(chunk, lot); continue; }
      const ov = this.suburbiaDoorOverrides.get(this._subLotKey(lot));
      this._stampSuburbHouse(chunk, lot, lot.arch, ov);
    }

    // --- Street furniture ------------------------------------------------------------
    this._subStreetDetails(chunk);
    /* PHASE 31 — the two callbacks, which exist only if the player has already stood in
       front of their originals in another dimension. A chunk resident when that happens
       does not re-stamp; the object is there the next time the street streams in, which
       is the correct behaviour rather than a limitation (STORY.md section 16: change is
       discovered, never witnessed). */
    this._envStoryStamp(chunk, 'suburbia');
  }

  /* ===================================================================================
     STREET FURNITURE

     Drawn as voxel data through _subSet exactly as Phase 12 established, so every piece
     is clipped to the generating chunk, streams and frees with it, collides for free and
     adds nothing to the scene graph. Placement is a pure function of world coordinates,
     so a prop is identical every time its chunk streams back in.

     THE LIGHT BUDGET IS THE HARD CONSTRAINT. Phase 11 traced multi-second freezes to
     unbounded resident point lights, and Phase 12 held the count by putting exactly one
     TORCH on each lamp at one lamp per 20 blocks of a single sidewalk row. Lamps are now
     placed on BOTH axes so side streets are not pitch dark, and the spacing is widened
     to 28 to compensate — the superblock also grew from 46 to 64, so lamps per unit AREA
     come out within a few percent of Phase 12 either way. Everything else added here —
     utility poles, signs, hydrants, mailboxes, porch fixtures — is GEOMETRY ONLY and
     creates no light source whatsoever.
     =================================================================================== */
  _subStreetDetails(chunk) {
    const x0 = chunk.cx * CHUNK_SX, z0 = chunk.cz * CHUNK_SZ, baseY = SUBURBIA_BASE_Y;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    // Props overhang into neighbouring chunks, so scan a margin and let the clipped
    // writer discard the rest. Every chunk a prop touches stamps an identical portion.
    const M = 6;
    for (let x = -M; x < CHUNK_SX + M; x++) {
      for (let z = -M; z < CHUNK_SZ + M; z++) {
        const wx = x0 + x, wz = z0 + z;
        const bx = Math.floor(wx / SUB_P), bz = Math.floor(wz / SUB_P);
        const u = wx - bx * SUB_P, v = wz - bz * SUB_P;
        /* Fast reject. Every piece of street furniture lives on the carriageway, the
           kerb or the verge — never deeper into a lot — so most columns can be skipped
           before a single hash is computed. This is the difference between scanning the
           prop margin cheaply and paying for it on every chunk. */
        if (u > SUB_VERGE_U && v > SUB_VERGE_U) continue;
        const hv = this._subHash(wx, wz, 71);

        /* --- STREET LAMPS. A slim tapered mast on the verge with a bracket arm reaching
           out over the carriageway and a pale cobra head on the end — the silhouette of
           a real suburban lamp, and the explicit end of the pillar-and-torch solution.
           The single TORCH hangs beneath the head, which is the ONLY light source any
           of this adds. */
        if (v === SUB_VERGE_U && u % 28 === 6 && u >= SUB_LOT_LO) {
          this._subStampLamp(S, wx, baseY, wz, 2, hv);      // arm reaches -z, over the road
        }
        if (u === SUB_VERGE_U && v % 28 === 20 && v >= SUB_LOT_LO) {
          this._subStampLamp(S, wx, baseY, wz, 1, hv);      // arm reaches -x
        }

        /* --- UTILITY POLES. Back-lot poles carrying a span of cable between them, which
           is the single most recognisable thing on an American residential street and
           costs almost nothing: the cable spans its cell on the run axis, so a whole
           span culls to a couple of quads per block. Geometry only — no light. */
        if (v === SUB_VERGE_U && u % 28 === 20 && u >= SUB_LOT_LO) {
          for (let dy = 0; dy < 7; dy++) S(wx, baseY + dy, wz, BLOCK.UTIL_POLE);
          S(wx, baseY + 7, wz, BLOCK.CROSSARM_X);
        }
        if (v === SUB_VERGE_U && u > SUB_LOT_LO && u % 28 !== 20) {
          S(wx, baseY + 7, wz, BLOCK.WIRE_X);
        }

        // --- INTERSECTIONS. Crosswalk bars across each approach and a stop sign on the
        // corner of every collector.
        const inCrossU = u < SUB_ROAD_W && v >= SUB_WALK_U && v < SUB_WALK_U + SUB_WALK_W;
        const inCrossV = v < SUB_ROAD_W && u >= SUB_WALK_U && u < SUB_WALK_U + SUB_WALK_W;
        if (inCrossU && (u & 1) === 0) S(wx, baseY - 1, wz, BLOCK.CROSSWALK_X);
        if (inCrossV && (v & 1) === 0) S(wx, baseY - 1, wz, BLOCK.CROSSWALK_Z);
        // Kerb ramps where each crossing meets the sidewalk.
        if (u === SUB_CURB_U && v >= SUB_WALK_U && v < SUB_WALK_U + SUB_WALK_W)
          S(wx, baseY - 1, wz, BLOCK.CURB_RAMP_E);
        if (v === SUB_CURB_U && u >= SUB_WALK_U && u < SUB_WALK_U + SUB_WALK_W)
          S(wx, baseY - 1, wz, BLOCK.CURB_RAMP_S);
        if (u === SUB_VERGE_U && v === SUB_VERGE_U && this._subCollector(bx)) {
          S(wx, baseY, wz, BLOCK.STOP_SIGN);
          S(wx, baseY + 1, wz, BLOCK.SIGN_POST);
          S(wx, baseY + 2, wz, BLOCK.SIGN_X);
        }

        /* --- STORM DRAINS. A catch basin in the gutter pan with a matching inlet cut
           through the kerb face beside it, placed once per superblock edge near each
           intersection where water would actually collect. */
        if (v === SUB_ROAD_W - 1 && u === SUB_LOT_LO + 4) {
          S(wx, baseY - 1, wz, BLOCK.DRAIN_GRATE);
          S(wx, baseY - 1, wz + 1, BLOCK.CURB_INLET_N);
        }
        if (u === SUB_ROAD_W - 1 && v === SUB_LOT_LO + 20) {
          S(wx, baseY - 1, wz, BLOCK.DRAIN_GRATE);
          S(wx + 1, baseY - 1, wz, BLOCK.CURB_INLET_W);
        }

        // --- FIRE HYDRANTS. One per superblock, on the verge.
        if (v === SUB_VERGE_U && u === SUB_LOT_LO + 9) S(wx, baseY, wz, BLOCK.HYDRANT);

        /* --- STREET TREES on the verge of residential side streets only. Collectors get
           lamps and poles instead, which is both how it looks in reality and how the two
           road classes stay visually distinct. */
        if (v === SUB_VERGE_U && !this._subCollector(bz) && u >= SUB_LOT_LO &&
            u % 9 === 4 && hv < 0.72) {
          this._subStampTree(S, wx, baseY, wz, hv);
        }
        if (u === SUB_VERGE_U && !this._subCollector(bx) && v >= SUB_LOT_LO &&
            v % 9 === 7 && hv < 0.72) {
          this._subStampTree(S, wx, baseY, wz, hv);
        }
      }
    }
  }

  /* ===================================================================================
     ONE SUBURBAN HOUSE

     A house is a list of MASSES — rectangular volumes, each with its own plate height
     and its own roof. That is what turns a box into a building: the garage projects two
     blocks forward under a lower gable, a split-level's front wing sits two blocks below
     its main ridge, and a two-storey reads against its single-storey entry. Every mass
     gets a real roof with a one-block overhang, a soffit closing the underside, fascia
     on every edge and gutters along the eaves.

     `doorSide` overrides the archetype's default facing; the rearrangement system
     re-stamps a lot with a different value to silently move its entrance. UNCHANGED
     mechanic — it just has considerably more to move now.
     =================================================================================== */
  _stampSuburbHouse(chunk, lot, arch, doorSideOverride) {
    const baseY = SUBURBIA_BASE_Y;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const doorSide = doorSideOverride === undefined ? lot.facing : doorSideOverride;
    const masses = this._subMasses(lot, arch, doorSide);
    const side = arch.siding;
    // PHASE 15 — signature-keyed, so a twin's siding, planting, fencing and chimney all
    // land identically on both lots.
    const h = this._subSigHash(lot);
    const chimney = this._subChimney(lot);

    // --- Site: pad under the footprint, driveway, walks --------------------------------
    const main = masses[0];
    if (this._subHits(chunk, main.x - 1, main.z - 1, main.x + main.w, main.z + main.d)) {
      for (let dx = -1; dx <= main.w; dx++)
        for (let dz = -1; dz <= main.d; dz++)
          S(main.x + dx, baseY - 1, main.z + dz, BLOCK.SIDEWALK);
    }

    /* --- Shells. Wings FIRST, main mass LAST: where a projecting garage or a split
       wing shares a wall plane with the main house, the main house must win, or its
       front wall would be replaced by the wing's hollow interior. */
    for (let i = masses.length - 1; i >= 0; i--) this._subStampShell(chunk, masses[i], side, baseY);

    // --- Roofs. Wings first, then the main mass, so where they overlap the taller roof
    //     wins and no eave pokes through a wall.
    for (let i = masses.length - 1; i >= 0; i--) {
      this._subStampRoof(chunk, masses[i], masses, arch.roofMat, baseY, side, chimney);
    }

    // --- Openings, and the window list the CRT static spatialises against.
    this._subRegisterWindows(chunk, this._subOpenings(chunk, lot, arch, doorSide, baseY, arch.w, arch.d, 0));

    // --- Driveway and garage apron.
    if (arch.garage) this._subDriveway(chunk, lot, arch, doorSide, baseY, arch.w, arch.d, masses);

    // --- Porch / entrance.
    this._subPorch(chunk, lot, arch, doorSide, baseY, masses);

    // --- Yard.
    this._subYard(chunk, lot, arch, doorSide, baseY, masses, h);

    // --- Interior.
    this._subInterior(chunk, lot, arch, doorSide, baseY, arch.w, arch.d, main.plateY - baseY, masses);

    /* PHASE 15 — THE MAILBOX GOES LAST. It used to be written inside _subYard, before the
       interior; on a tier-2 lot the impossible room reaches several blocks past the wall
       and, on one lot in the sample, buried the mailbox under its own drywall. Nothing
       else the house writes reaches the verge, so putting this single block at the end of
       the stamp makes it unbury-able — and a revision that MOVES the mailbox can no longer
       have the side effect of deleting it. */
    this._subMailbox(chunk, lot, arch, doorSide, baseY, masses);
  }

  /* Writes the one mailbox this lot is entitled to, in whichever of its legal columns the
     lot's revision count selects, and clears the other one if a mailbox is standing in it
     from a previous stamp. */
  _subMailbox(chunk, lot, arch, doorSide, baseY, masses) {
    const spots = this._subMailboxSpots(lot, arch, doorSide, masses);
    if (!spots.length) return;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const alongX = (doorSide % 2 === 0);
    const at = spots[this._subStageHas(lot, 4) && spots.length > 1 ? 1 : 0];
    S(at[0], baseY, at[1], alongX ? BLOCK.MAILBOX_X : BLOCK.MAILBOX_Z);
    for (const s of spots) {
      if (s === at) continue;
      const cur = this._subGet(chunk, s[0], baseY, s[1]);
      if (cur === BLOCK.MAILBOX_X || cur === BLOCK.MAILBOX_Z) S(s[0], baseY, s[1], BLOCK.AIR);
    }
  }

  /* OPENINGS. A front door with jambs and a painted leaf, a garage bay where the
     archetype calls for one, and real windows — sill, head, jambs, mullion and a pane
     set back inside the wall — arranged the way a facade actually is: a picture window
     beside the entrance, paired windows on the flanks, upper-floor windows lined up over
     the lower ones. Returns the window positions the CRT static spatialises against. */
  _subOpenings(chunk, lot, arch, doorSide, baseY, W, D, _H) {
    if (!this._subHits(chunk, lot.hx - 1, lot.hz - 1, lot.hx + W, lot.hz + D)) return [];
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const alongX = (doorSide % 2 === 0);
    const along = alongX ? W : D;
    const mid = this._subDoorOffset(lot, arch, doorSide, W, D);
    const wins = [];
    const winFor = (f, shuttered) => {
      const wallAlongX = (f % 2 === 0);
      if (shuttered) return wallAlongX ? BLOCK.SHUTTER_X : BLOCK.SHUTTER_Z;
      return wallAlongX ? BLOCK.WIN_X : BLOCK.WIN_Z;
    };
    /* PHASE 15 — shutters are a property of the HOUSE (so a twin's elevation matches its
       double), and REVISION 3 inverts them: a facade whose shutters were open is closed
       next time, or the other way about. Nothing else on the elevation moves, which is
       what makes it hard to be sure about. */
    const shut = (this._subSigHash(lot)(88) < 0.45) !== this._subStageHas(lot, 3);
    /* REVISION 5 — one flank window is made good with siding, inside and out. The blank
       panel is the same lined variant the shell would have written for that cell, so from
       inside the room the wall simply has no window in it rather than an obvious patch. */
    const gone = this._subStageHas(lot, 5)
      ? Math.floor(this._subHash(lot.hx, lot.hz, 941) * 6) % 6 : -1;
    const blankFor = (f) => {
      const mask = f === 3 ? 1 : f === 1 ? 2 : f === 0 ? 4 : 8;
      return (SIDE_LINED && SIDE_LINED.get(arch.siding + ':' + mask)) || arch.siding;
    };
    let winSeq = 0;

    /* --- FRONT DOOR (PHASE 14). A real functional door rather than a painted panel:
       jambs, head casing, threshold, a leaf with a lever and a vision panel, and two
       states. It is stamped in whichever state the player left it in — that lookup is
       the whole of the door persistence system, and because the door is stamped HERE it
       automatically follows the wall when the rearrangement mechanic moves it. */
    const [ddx, ddz] = this._subFaceCell(doorSide, mid, W, D);
    const dwx = lot.hx + ddx, dwz = lot.hz + ddz;
    const dset = FRONT_DOOR[arch.doorIdx % FRONT_DOOR.length];
    const dopen = this.suburbiaDoorState && this.suburbiaDoorState.has(dwx + ',' + baseY + ',' + dwz);
    furnStamp(S, dopen ? dset.open : dset.closed, dwx, baseY, dwz, doorSide);
    // Threshold outside it.
    const outX = doorSide === 3 ? 1 : (doorSide === 1 ? -1 : 0);
    const outZ = doorSide === 0 ? 1 : (doorSide === 2 ? -1 : 0);
    S(lot.hx + ddx + outX, baseY - 1, lot.hz + ddz + outZ, BLOCK.SIDEWALK);

    /* --- Picture window beside the entrance. Deliberately jamb-free so a run of three
       reads as one wide window, which is the single most characteristic thing about a
       post-war American front elevation. */
    const wideId = alongX ? BLOCK.WIN_WIDE_X : BLOCK.WIN_WIDE_Z;
    const wideStart = mid + 2;
    if (wideStart + 2 < along - 1) {
      for (let i = 0; i < 3; i++) {
        const [wdx, wdz] = this._subFaceCell(doorSide, wideStart + i, W, D);
        S(lot.hx + wdx, baseY + 1, lot.hz + wdz, wideId);
        if (i === 1) wins.push(new THREE.Vector3(lot.hx + wdx + 0.5, baseY + 1.5, lot.hz + wdz + 0.5));
      }
    }

    // --- Windows on the other three walls, in pairs, aligned floor to floor.
    for (let f = 0; f < 4; f++) {
      if (f === doorSide) continue;
      const len = (f % 2 === 0) ? W : D;
      for (const off of [2, len - 3]) {
        if (off < 1 || off >= len - 1) continue;
        const [wdx, wdz] = this._subFaceCell(f, off, W, D);
        const wx = lot.hx + wdx, wz = lot.hz + wdz;
        const vanished = (winSeq++ === gone);
        if (vanished) {
          // Blank wall where a window was — and no CRT-static source here any more, which
          // is the only audible consequence and is exactly the right one.
          const b = blankFor(f);
          S(wx, baseY + 1, wz, b);
          if (arch.storeys === 2) S(wx, baseY + 5, wz, b);
          continue;
        }
        S(wx, baseY + 1, wz, winFor(f, shut));
        // The upper deck sits at baseY+4, so baseY+5 is chest height on the upper floor —
        // which is exactly where this window already was. No exterior change.
        if (arch.storeys === 2) S(wx, baseY + 5, wz, winFor(f, shut));
        wins.push(new THREE.Vector3(wx + 0.5, baseY + 1.5, wz + 0.5));
      }
    }
    return wins;
  }

  /* DRIVEWAY. The relationship the brief asks for, built end to end: a garage bay in the
     wall, an apron in front of it, a drive crossing the yard, a flush cut through the
     sidewalk and verge, and a genuine sloped kerb ramp dropping onto the carriageway.
     No step anywhere along it. */
  _subDriveway(chunk, lot, arch, doorSide, baseY, W, D, massesIn) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const masses = massesIn || this._subMasses(lot, arch, doorSide);
    const wing = masses.find(m => m.garage);
    // A flush garage has no wing of its own: the bay is cut straight into the main
    // facade, which is what the larger two-storey does.
    const g = wing || masses[0];
    const [fx, fz] = _propFace(arch.garage === 'side' ? 3 : doorSide);

    // --- Garage door: the full bay, two high, in the outward wall of whichever mass
    //     holds it. One continuous panel, so it reads as one door, not four.
    const gFace = arch.garage === 'side' ? 3 : doorSide;
    const bay = [];
    if (fz !== 0) {
      const z = fz < 0 ? g.z : g.z + g.d - 1;
      if (wing) { for (let dx = 1; dx < g.w - 1; dx++) bay.push([g.x + dx, z]); }
      else { for (let i = 0; i < 4; i++) bay.push([g.x + 1 + i, z]); }
    } else {
      const x = fx < 0 ? g.x : g.x + g.w - 1;
      if (wing) { for (let dz = 1; dz < g.d - 1; dz++) bay.push([x, g.z + dz]); }
      else { for (let i = 0; i < 4; i++) bay.push([x, g.z + 1 + i]); }
    }
    /* PHASE 14 — the bay is a real sectional door in two states, on the same toggle and
       the same persistence as the front door. Open, it has no collision below the head,
       so the bay is genuinely walkable. */
    for (const [bx, bz] of bay) {
      const gopen = this.suburbiaDoorState && this.suburbiaDoorState.has(bx + ',' + baseY + ',' + bz);
      furnStamp(S, gopen ? GARAGE_DOOR.open : GARAGE_DOOR.closed, bx, baseY, bz, gFace);
      S(bx, baseY + 2, bz, BLOCK.TRIM);
    }
    // Garage floor, inside the wing only — a flush bay opens onto the house floor.
    if (wing) {
      for (let dx = 1; dx < g.w - 1; dx++)
        for (let dz = 1; dz < g.d - 1; dz++) S(g.x + dx, baseY - 1, g.z + dz, BLOCK.DRIVEWAY);
    }

    /* --- The drive itself, run from the bay out to the kerb. Walks cell by cell so it
       crosses the sidewalk and verge flush and finishes on a ramp, rather than stopping
       at a step the player has to jump. */
    const roadV = lot.bz * SUB_P + (fz < 0 ? SUB_ROAD_W : SUB_P - SUB_ROAD_W);
    const sideRoadU = lot.bx * SUB_P + (fx < 0 ? SUB_ROAD_W : SUB_P - SUB_ROAD_W);
    for (const [bx, bz] of bay) {
      if (fz !== 0) {
        const from = fz < 0 ? roadV : bz + 1, to = fz < 0 ? bz : roadV;
        for (let z = from; z <= to; z++) {
          const code = this._subSurfaceAt(bx, z);
          if (code === SURF.CURB) S(bx, baseY - 1, z, fz < 0 ? BLOCK.CURB_RAMP_S : BLOCK.CURB_RAMP_N);
          else if (code === SURF.LAWN || code === SURF.VERGE || code === SURF.WALK)
            S(bx, baseY - 1, z, BLOCK.DRIVEWAY);
        }
      } else {
        const from = fx < 0 ? sideRoadU : bx + 1, to = fx < 0 ? bx : sideRoadU;
        for (let x = from; x <= to; x++) {
          const code = this._subSurfaceAt(x, bz);
          if (code === SURF.CURB) S(x, baseY - 1, bz, fx < 0 ? BLOCK.CURB_RAMP_E : BLOCK.CURB_RAMP_W);
          else if (code === SURF.LAWN || code === SURF.VERGE || code === SURF.WALK)
            S(x, baseY - 1, bz, BLOCK.DRIVEWAY);
        }
      }
    }
  }

  /* PORCH / ENTRANCE. Four kinds, so an entrance reads as an entrance: a plain stoop
     with a step, a recessed entry, a full-width covered porch on posts, and a wrap-around
     for corner lots. The covered kinds get a real shed roof of their own, which is what
     the brief means by porch roofs. */
  _subPorch(chunk, lot, arch, doorSide, baseY, masses) {
    const m0 = masses[0];
    if (!this._subHits(chunk, m0.x - 4, m0.z - 4, m0.x + m0.w + 4, m0.z + m0.d + 4)) return;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const m = masses[0];
    const [fx, fz] = _propFace(doorSide);
    const alongX = (doorSide % 2 === 0);
    const along = alongX ? m.w : m.d;
    const mid = this._subDoorOffset(lot, arch, doorSide, m.w, m.d);
    const [ddx, ddz] = this._subFaceCell(doorSide, mid, m.w, m.d);
    const dx0 = lot.hx + ddx, dz0 = lot.hz + ddz;

    /* Everything on a lot sits at grade — the yard, the sidewalk, the house floor and
       the porch deck are all one level — so an entrance needs a threshold and a mat,
       not a step. The one real level change in the whole suburb is the half-block kerb,
       and that is where the stair pieces are used (see _subYard). */
    S(dx0 + fx, baseY - 1, dz0 + fz, BLOCK.SIDEWALK);
    S(dx0 + fx, baseY, dz0 + fz, BLOCK.DOORMAT);

    if (arch.porch === 'stoop' || arch.porch === 'entry') {
      // A pair of low railings flanking the door is what turns a hole in a wall into a
      // front entrance.
      const px = fz, pz = -fx;
      const railId = px !== 0 ? BLOCK.RAIL_X : BLOCK.RAIL_Z;
      S(dx0 + fx - px, baseY, dz0 + fz - pz, railId);
      S(dx0 + fx + px, baseY, dz0 + fz + pz, railId);
      if (arch.porch === 'entry') {
        // A small covered entry: two posts and a shed roof over the threshold.
        S(dx0 + fx * 2 - px, baseY, dz0 + fz * 2 - pz, BLOCK.POST);
        S(dx0 + fx * 2 - px, baseY + 1, dz0 + fz * 2 - pz, BLOCK.POST);
        S(dx0 + fx * 2 + px, baseY, dz0 + fz * 2 + pz, BLOCK.POST);
        S(dx0 + fx * 2 + px, baseY + 1, dz0 + fz * 2 + pz, BLOCK.POST);
        for (let i = -1; i <= 1; i++)
          for (let j = 1; j <= 2; j++)
            S(dx0 + fx * j + px * i, baseY + 2, dz0 + fz * j + pz * i, BLOCK.SLAB_TRIM);
        S(dx0 + fx, baseY + 2, dz0 + fz, BLOCK.PORCH_LIGHT_X);
      }
      return;
    }

    // --- Covered porch: a deck, a colonnade and a shallow shed roof of its own.
    const depth = 2;
    // Shed roof pieces for this facing: LOW half at the outer edge, HIGH half against
    // the wall, in the house's own roof colour.
    const shedLo = fz < 0 ? 4 : fz > 0 ? 0 : fx < 0 ? 2 : 6;
    const wrap = arch.porch === 'wrap';
    const spanStart = wrap ? -1 : 1, spanEnd = wrap ? along : along - 1;
    for (let s = spanStart; s < spanEnd; s++) {
      const [cdx, cdz] = this._subFaceCell(doorSide, Math.max(0, Math.min(along - 1, s)), m.w, m.d);
      const bx = lot.hx + cdx, bz = lot.hz + cdz;
      const ox = alongX ? (s - Math.max(0, Math.min(along - 1, s))) : 0;
      const oz = alongX ? 0 : (s - Math.max(0, Math.min(along - 1, s)));
      for (let t = 1; t <= depth; t++) {
        const px = bx + fx * t + ox, pz2 = bz + fz * t + oz;
        S(px, baseY - 1, pz2, BLOCK.DECK);
        for (let y = baseY; y < baseY + 3; y++) S(px, y, pz2, BLOCK.AIR);
        // Porch roof: a shallow shed plane running out from the wall, matching the house.
        S(px, baseY + 3, pz2, arch.roofMat + shedLo + (t === depth ? 0 : 1));
      }
      // Colonnade and railing along the outer edge.
      const ex = bx + fx * depth + ox, ez = bz + fz * depth + oz;
      const colStep = alongX ? (s - spanStart) : (s - spanStart);
      if (colStep % 3 === 0 && Math.abs(s - mid) > 1) {
        S(ex, baseY, ez, BLOCK.COLUMN);
        S(ex, baseY + 1, ez, BLOCK.COLUMN);
        S(ex, baseY + 2, ez, BLOCK.COLUMN);
      } else if (Math.abs(s - mid) > 1) {
        S(ex, baseY, ez, alongX ? BLOCK.RAIL_X : BLOCK.RAIL_Z);
      }
    }
    S(dx0 + fx, baseY + 3, dz0 + fz, BLOCK.PORCH_LIGHT_Z);
  }

  /* THE YARD. Restrained on purpose — the brief is explicit that not every property
     should be dressed, and it is right: planting only reads as a sign of habitation
     because most lots are plain grass. Roughly half of all houses get nothing beyond a
     mailbox and a path. */
  _subYard(chunk, lot, arch, doorSide, baseY, masses, h) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const m = masses[0];
    const [fx, fz] = _propFace(doorSide);
    const alongX = (doorSide % 2 === 0);
    const along = alongX ? m.w : m.d;
    const mid = this._subDoorOffset(lot, arch, doorSide, m.w, m.d);
    const [ddx, ddz] = this._subFaceCell(doorSide, mid, m.w, m.d);
    const dx0 = lot.hx + ddx, dz0 = lot.hz + ddz;

    /* --- Front path, from the entrance out to the sidewalk, continuing as a STEPPED
       KERB where it crosses the kerb line. That kerb is the only place in the suburb
       where the ground actually changes level, and a tread there is what stops the
       player having to jump off their own front lawn into the road. */
    for (let t = 2; t < 18; t++) {
      const px = dx0 + fx * t, pz = dz0 + fz * t;
      const code = this._subSurfaceAt(px, pz);
      if (code === SURF.LAWN || code === SURF.VERGE) S(px, baseY - 1, pz, BLOCK.SIDEWALK);
      else if (code === SURF.CURB) {
        S(px, baseY - 1, pz, fz < 0 ? BLOCK.STEP_S : fz > 0 ? BLOCK.STEP_N
                            : fx < 0 ? BLOCK.STEP_E : BLOCK.STEP_W);
        break;
      }
    }

    /* --- The mailbox used to be written here. PHASE 15 moved it to the end of
       _stampSuburbHouse (see _subMailbox): it is the one piece of a lot that a revision
       relocates, and it has to survive everything else the house writes. */

    /* --- Foundation planting either side of the entrance, on some houses only.
       PHASE 15 — planting is now confined to LAWN. A hedge belongs against the house, not
       on the public verge, and on the one house at the head of a cul-de-sac (whose verge
       is a single cell from its threshold) the old unguarded write laid the hedge line
       straight over that house's own mailbox. Every ordinary lot is unaffected: those
       cells were already lawn. */
    const plantable = (x, z) => this._subSurfaceAt(x, z) === SURF.LAWN;
    if (h(31) < 0.5) {
      const px = fz, pz = -fx;
      for (let i = 2; i <= 4; i++) {
        const ax = dx0 + fx + px * i, az = dz0 + fz + pz * i;
        const bx = dx0 + fx - px * i, bz = dz0 + fz - pz * i;
        if (plantable(ax, az)) S(ax, baseY, az, i === 3 ? BLOCK.SHRUB : BLOCK.HEDGE_LOW);
        if (plantable(bx, bz)) S(bx, baseY, bz, i === 3 ? BLOCK.SHRUB : BLOCK.HEDGE_LOW);
      }
    }
    if (h(32) < 0.22) {
      // A flower bed under the picture window on a small minority of lots.
      const [wdx, wdz] = this._subFaceCell(doorSide, Math.min(along - 2, mid + 3), m.w, m.d);
      for (let i = 1; i <= 2; i++) {
        const px = lot.hx + wdx + fx * i, pz = lot.hz + wdz + fz * i;
        if (plantable(px, pz)) S(px, baseY, pz, BLOCK.FLOWERS);
      }
    }

    // --- One yard tree, on about a third of lots.
    if (h(33) < 0.34) {
      const tx = lot.hx - 3, tz = lot.hz + m.d + 3;
      if (this._subSurfaceAt(tx, tz) === SURF.LAWN) this._subStampTree(S, tx, baseY, tz, h(34));
    }

    // --- The air-conditioner beside the house: the one detail nobody notices until it
    //     is missing.
    if (h(35) < 0.6) S(lot.hx - 2, baseY, lot.hz + 2, BLOCK.AC_UNIT);

    /* --- PHASE 15 — A CHAIR ON THE FRONT LAWN, on about one lot in nine, turned to face
       the house rather than the street. It is an ordinary dining chair, from the same
       catalogue as the ones in every dining room on the block, standing on the grass. No
       lighting, no marker, nothing to interact with. It costs a handful of quads and it
       is the single cheapest thing in this dimension that makes a street feel occupied by
       somebody who is not there. */
    if (h(39) < 0.11) {
      for (const t of [3, 4]) {
        const cx0 = dx0 + fx * t + (alongX ? 3 : 0), cz0 = dz0 + fz * t + (alongX ? 0 : 3);
        if (this._subSurfaceAt(cx0, cz0) !== SURF.LAWN) continue;
        furnStamp(S, 'chairWalnut', cx0, baseY, cz0, (doorSide + 2) % 4);
        break;
      }
    }

    // --- Trash bins at the kerb on collection day, so to speak.
    if (h(36) < 0.3) {
      for (let t = 3; t < 16; t++) {
        const px = dx0 + fx * t, pz = dz0 + fz * t;
        if (this._subSurfaceAt(px, pz) === SURF.VERGE) {
          S(px + (alongX ? -1 : 0), baseY, pz + (alongX ? 0 : -1), BLOCK.BIN);
          break;
        }
      }
    }

    /* --- BACK BOUNDARY. A board fence along the rear property line, which is where the
       two rows of houses back onto each other. One thin panel per cell, spanning its
       cell on the run axis, so a whole neighbourhood of boundary fences costs almost
       nothing to draw. */
    if (h(37) < 0.62) {
      const bz = lot.facing === 2 ? lot.hz + m.d + 5 : lot.hz - 5;
      for (let i = -1; i <= m.w + 1; i++) {
        const bx = lot.hx + i;
        if (this._subSurfaceAt(bx, bz) !== SURF.LAWN) continue;
        S(bx, baseY, bz, BLOCK.PRIVACY_X);
        S(bx, baseY + 1, bz, BLOCK.PRIVACY_X);
      }
    }
    // --- A picket fence across the front of a small minority of lots.
    if (h(38) < 0.14) {
      const fzLine = lot.facing === 2 ? lot.hz - 5 : lot.hz + m.d + 5;
      for (let i = -1; i <= m.w + 1; i++) {
        const bx = lot.hx + i;
        if (this._subSurfaceAt(bx, fzLine) !== SURF.LAWN) continue;
        if (bx === dx0) continue;                       // leave the path through
        S(bx, baseY, fzLine, (i % 4 === 0) ? BLOCK.PICKET_POST : BLOCK.PICKET_X);
      }
    }
  }

  /* =====================================================================================
     PHASE 14 — INTERIOR STAMPING

     Everything above is planning; this is the pass that writes it. Order matters and is
     the same every time: floors and partitions, then doorways and their leaves, then the
     ceiling, then the staircase (which has to cut through the ceiling and the mid-floor
     it passes), then the furniture, then — for the one house in twenty that gets one —
     the anomaly.

     Every write goes through _subSet, so a house that straddles four chunks is written
     correctly from all four and identically every time it streams back in.
     ===================================================================================== */
  _subInterior(chunk, lot, arch, doorSide, baseY, W, D, H, masses) {
    // The impossible-room anomaly reaches several blocks past the east wall, so the
    // early-out is widened to match rather than clipping a room the player is meant to find.
    if (!this._subHits(chunk, lot.hx - 8, lot.hz - 8, lot.hx + W + 8, lot.hz + D + 8)) return;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const hx = lot.hx, hz = lot.hz;
    // PHASE 15 — signature-keyed, so a twin is furnished identically to its double.
    const h = this._subSigHash(lot);

    const storeys = arch.storeys === 2 ? 2 : 1;
    const plan0 = this._subFloorPlan(lot, arch, doorSide, W, D, 0);
    const plan1 = storeys === 2 ? this._subFloorPlan(lot, arch, doorSide, W, D, 1) : null;

    this._subStampPlan(S, plan0, hx, hz, baseY, 0, arch, h);
    if (plan1) this._subStampPlan(S, plan1, hx, hz, baseY + 4, 1, arch, h);

    /* --- STAIRCASE. Cut after BOTH floors have their partitions, because a flight has to
       satisfy both at once: clear headroom through the ground-floor rooms it climbs
       through, and a landing that arrives in a real upper-floor room rather than inside an
       upstairs wall. It is also reserved on both floors before either is furnished. */
    const stairInfo = plan1 ? { placed: false, cells: [] } : null;
    if (stairInfo) this._subStampStair(S, plan0, plan1, hx, hz, baseY, stairInfo);
    const blocked = stairInfo ? stairInfo.cells : [];

    /* PHASE 15 — the motif is resolved from the plan BEFORE furnishing so its cells can
       be reserved, and stamped AFTER so it is never overwritten. The occupancy grid the
       furnisher hands back is then the ground truth the revision pass reads: it is the
       only way to know which cells of this house are genuinely empty. */
    const motif = this._subMotifPlan(plan0, lot, arch, doorSide);
    const occ0 = this._subFurnish(S, plan0, hx, hz, baseY, h, arch, 0, blocked,
                                  motif ? motif.cells : null);
    if (plan1) this._subFurnish(S, plan1, hx, hz, baseY + 4, h, arch, 1, blocked);
    if (motif) furnStamp(S, motif.model, hx + motif.dx, baseY + motif.y, hz + motif.dz, motif.face);
    this._subInteriorAnomaly(S, plan0, lot, arch, hx, hz, baseY, 0, W, D, h, blocked);
    /* LAST. A revision is a change to a house the player has already been inside, so it
       has to be applied on top of everything else that house is — including its tier
       anomaly, if it has one. */
    this._subRecognitionPass(S, plan0, lot, arch, hx, hz, baseY, W, D, occ0, doorSide, blocked, motif);

    // --- GARAGE. Its own mass, its own floor, and dressed as a garage rather than as a
    //     spare room: a car if the bay is deep enough, a bench, shelving, the boiler.
    if (masses) {
      for (const m of masses) {
        if (!m.garage) continue;
        this._subGarageInterior(S, m, baseY, h);
      }
    }
  }

  _stampDisconnectedHome(chunk, lot) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const baseY = SUBURBIA_BASE_Y;
    const W = 11, D = 9, H = 6;
    const hx = lot.hx, hz = lot.hz;

    // Clear the lot: no lawn, no driveway — the ground around it is bare concrete,
    // as though the house was set down rather than built.
    for (let dx = -3; dx <= W + 2; dx++)
      for (let dz = -3; dz <= D + 2; dz++) {
        S(hx + dx, baseY - 1, hz + dz, BLOCK.CONCRETE);
        for (let dy = 0; dy <= H + 5; dy++) S(hx + dx, baseY + dy, hz + dz, BLOCK.AIR);
      }

    /* INVERTED SHELL. The roof is laid flat on the ground and the walls rise from it,
       so the whole silhouette is upside down: eaves at your feet, foundation in the
       air. Walls flare outward with height, which is what makes it read as wrong from
       a distance even before you can see the door. */
    const roofSpan = Math.floor(D / 2);
    for (let dx = -1; dx <= W; dx++) {
      for (let dz = -1; dz <= D; dz++) {
        const rise = Math.max(0, roofSpan - Math.abs(dz - roofSpan));
        // Inverted gable: the ridge points DOWN, buried, so the roof surface rises to
        // the eaves at the outer edges.
        const y = baseY + Math.min(3, 3 - Math.min(rise, 3));
        S(hx + dx, y, hz + dz, BLOCK.SHINGLE);
        for (let f = baseY; f < y; f++) S(hx + dx, f, hz + dz, BLOCK.SHINGLE);
      }
    }
    const wallBase = baseY + 4;
    for (let dx = 0; dx < W; dx++) {
      for (let dz = 0; dz < D; dz++) {
        const edge = dx === 0 || dx === W - 1 || dz === 0 || dz === D - 1;
        const wx = hx + dx, wz = hz + dz;
        if (edge) {
          for (let dy = 0; dy < H; dy++) S(wx, wallBase + dy, wz, BLOCK.SIDE_SKY);
        } else {
          for (let dy = 0; dy < H; dy++) S(wx, wallBase + dy, wz, BLOCK.AIR);
          S(wx, wallBase + H, wz, BLOCK.POLISHED_OAK);   // the FLOOR, now a ceiling
        }
      }
    }
    // Foundation slab on top — the last thing that should ever be above you.
    for (let dx = -1; dx <= W; dx++)
      for (let dz = -1; dz <= D; dz++) S(hx + dx, wallBase + H + 1, hz + dz, BLOCK.CONCRETE);

    // Front door, upside down: a dark rectangle high on the wall, opening onto nothing.
    const mid = Math.floor(W / 2);
    for (let dy = H - 2; dy < H; dy++) {
      S(hx + mid, wallBase + dy, hz + D - 1, BLOCK.AIR);
      S(hx + mid + 1, wallBase + dy, hz + D - 1, BLOCK.AIR);
    }
    // Windows likewise inverted — high where sills should be low.
    for (const dxw of [2, W - 3]) {
      S(hx + dxw, wallBase + H - 3, hz + D - 1, BLOCK.HAVEN_GLASS);
      S(hx + dxw, wallBase + H - 3, hz, BLOCK.HAVEN_GLASS);
    }

    // Way in: the buried ridge leaves a gap under the eaves at ground level.
    for (let dy = 0; dy < 3; dy++) {
      S(hx + mid, baseY + 4 + dy - 4 + 4, hz + D - 1, BLOCK.AIR);
    }
    for (let dz = 0; dz < D; dz++) {
      S(hx + mid, baseY + 4, hz + dz, BLOCK.AIR);
      S(hx + mid + 1, baseY + 4, hz + dz, BLOCK.AIR);
    }
    for (let dy = 0; dy < 4; dy++) S(hx + mid, baseY + 4 + dy, hz + D - 1, BLOCK.AIR);

    /* INTERIOR. Furniture hangs from what is now the ceiling — that is, it is still
       bolted to the floor of a house that happens to be upside down. */
    const ceil = wallBase + H - 1;
    for (let i = 0; i < 3; i++) S(hx + 2 + i, ceil, hz + 2, BLOCK.ANDESITE);   // couch
    S(hx + 3, ceil, hz + 4, BLOCK.POLISHED_OAK);                                // table
    S(hx + W - 3, ceil, hz + D - 3, BLOCK.CONCRETE);                            // counter
    S(hx + W - 3, ceil - 1, hz + D - 3, BLOCK.ASPHALT);
    /* A door in an interior wall that opens directly onto solid wall. Deliberately
       kept off the centre column — the Core Disk hangs there with nothing above or
       below it, and a partition through that column would quietly give it a floor. */
    for (let dz = 2; dz < D - 2; dz++)
      for (let dy = 0; dy < 3; dy++) S(hx + 3, wallBase + dy + 1, hz + dz, BLOCK.CONCRETE);

    /* THE RIFT CORE DISK CHEST, suspended in the dead centre of the inverted volume
       with nothing holding it up. PROGRESSION IS UNTOUCHED: it is the same
       TREASURE_CHEST registered under the same level3HomeChestKey the existing loot
       branch already special-cases, so opening it still grants the guaranteed
       CORE_DISK_L3 and still fires the Fake Haven trigger. Only its location moved. */
    const cx = hx + mid, cz = hz + Math.floor(D / 2), cy = wallBase + Math.floor(H / 2);
    S(cx, cy, cz, BLOCK.TREASURE_CHEST);
    const chestKey = cx + ',' + cy + ',' + cz;
    if (this.level3HomeChestKey !== chestKey) {
      this.level3HomeChestKey = chestKey;
      this.disconnectedCorePos = new THREE.Vector3(cx + 0.5, cy + 0.5, cz + 0.5);
    }
  }

  applyMimicHallucination(playerPos, camera) {
    const R = 10;
    const px = Math.floor(playerPos.x), pz = Math.floor(playerPos.z), py = Math.floor(playerPos.y);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    let swaps = 0;
    for (let dx = -R; dx <= R && swaps < 2; dx++) {
      for (let dz = -R; dz <= R && swaps < 2; dz++) {
        for (let dy = -3; dy <= 3 && swaps < 2; dy++) {
          const wx = px + dx, wy = py + dy, wz = pz + dz;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (dist > R || dist < 2) continue;
          const id = this.getBlockWorld(wx, wy, wz);
          if (id !== BLOCK.STONE && id !== BLOCK.OAK_LOG) continue;
          const toBlock = new THREE.Vector3(wx + 0.5 - playerPos.x, wy + 0.5 - playerPos.y, wz + 0.5 - playerPos.z).normalize();
          const angle = forward.angleTo(toBlock);
          if (angle < 0.5) continue;
          if (Math.random() < 0.02) {
            this.setBlockWorld(wx, wy, wz, BLOCK.CORRUPTED_STONE);
            swaps++;
          }
        }
      }
    }
  }

  // Block written at baseY-1 for a surface code. Road surfaces are HALF SLABS, which is
  // the single change that produces the entire kerb hierarchy.
  _subSurfaceBlock(code) {
    switch (code) {
      case SURF.ROAD: return BLOCK.ROAD;
      case SURF.LINE: return BLOCK.ROAD_LINE;
      case SURF.SEAM: return BLOCK.ROAD_SEAM;
      case SURF.GUTTER: return BLOCK.SLAB_GUTTER;
      case SURF.CURB: return BLOCK.CURB;
      case SURF.WALK: return BLOCK.SIDEWALK;
      case SURF.VERGE: return BLOCK.LAWN;
      default: return BLOCK.LAWN;
    }
  }

  // STREET LAMP. `face` points the arm at the carriageway. Exactly one TORCH.
  _subStampLamp(S, x, y, z, face, v) {
    const H = 6 + (v < 0.5 ? 0 : 1);
    const [fx, fz] = _propFace(face);
    for (let dy = 0; dy < H - 1; dy++) S(x, y + dy, z, BLOCK.LAMP_POST);
    const arm = face === 0 ? BLOCK.LAMP_ARM_S : face === 1 ? BLOCK.LAMP_ARM_W
              : face === 2 ? BLOCK.LAMP_ARM_N : BLOCK.LAMP_ARM_E;
    S(x, y + H - 1, z, arm);
    // The light itself, hanging under the cobra head — the same single resident light
    // per lamp that Phase 11 bounded and Phase 12 preserved.
    S(x + fx, y + H - 2, z + fz, BLOCK.TORCH);
  }

  // ORNAMENTAL TREE. A thin trunk under a small rounded canopy — a street tree, not an
  // Overworld oak. Deliberately modest: two sizes, and never on a collector.
  _subStampTree(S, x, y, z, v) {
    const h = v < 0.4 ? 3 : 4;
    for (let dy = 0; dy < h; dy++) S(x, y + dy, z, BLOCK.TREE_TRUNK);
    const r = v < 0.4 ? 1 : 1;
    for (let dy = 0; dy < 2; dy++)
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && dy === 1) continue;
          S(x + dx, y + h + dy, z + dz, BLOCK.TREE_CANOPY);
        }
    S(x, y + h + 2, z, BLOCK.TREE_CANOPY);
  }

  /* Partitions, doorways, ceiling. `plan` is pure data; this is the only thing that turns
     it into voxels. */
  _subStampPlan(S, plan, hx, hz, floorY, storey, arch, h) {
    const RH = this._subRoomH();

    // --- Partitions, three cells tall.
    for (const w of plan.wallCells) {
      const id = PART_WALL[w.mask];
      for (let y = 0; y < RH; y++) S(hx + w.dx, floorY + y, hz + w.dz, id);
    }

    // --- Doorways. Two cells of opening, a lintel above, and a hung leaf on the private
    //     rooms. A cased opening and a door use the same reveal, so a house reads as one
    //     set of joinery rather than two.
    for (const dw of plan.doorways) {
      const axis = dw.axis;   // 0 = wall runs along X, 1 = along Z
      let lower;
      if (dw.leaf === 'door') {
        const rec = INT_DOOR[axis + ':' + (dw.swing > 0 ? 1 : -1)];
        lower = dw.startClosed ? rec.closedId : rec.openId;
      } else {
        lower = axis === 0 ? CASE_X : CASE_Z;
      }
      S(hx + dw.dx, floorY, hz + dw.dz, lower);
      S(hx + dw.dx, floorY + 1, hz + dw.dz, lower);
      S(hx + dw.dx, floorY + 2, hz + dw.dz, axis === 0 ? HEADER_X : HEADER_Z);
    }

    /* --- Ceiling. The first flat ceiling Suburbia interiors have ever had. Only the
       ground floor gets one: on a two-storey top floor the roof plane IS the ceiling,
       which is what an upstairs bedroom under a shallow gable actually looks like. */
    if (storey === 0 && arch.storeys === 1) {
      const entryCell = plan.at(plan.entry.dx, plan.entry.dz);
      for (let dx = plan.x0; dx <= plan.x1; dx++) {
        for (let dz = plan.z0; dz <= plan.z1; dz++) {
          const isEntry = plan.at(dx, dz) === entryCell;
          S(hx + dx, floorY + RH, hz + dz, isEntry ? CEIL_ROSE : CEIL_PANEL);
        }
      }
      // A loft hatch, because a ceiling with nothing in it reads as a lid.
      if (arch.storeys === 1) {
        const r = plan.rooms.find(rm => rm.type === 'hall') || plan.rooms[0];
        S(hx + r.x0, floorY + RH, hz + r.z0, ATTIC_HATCH);
      }
    }
  }

  /* =====================================================================================
     PHASE 14 — THE FURNISHER

     Rooms are furnished by RECIPE, not by scatter. Every recipe works the same way: pick
     the wall a piece belongs against, ask the occupancy grid whether the whole footprint
     is free, and only then commit. Because the footprint test uses the compiled model's
     own cells, a piece can never overlap another piece, a partition, a doorway, a door
     swing, a reserved circulation cell, or the cell in front of a window.
     ===================================================================================== */
  _subFurnish(S, plan, ox, oz, floorY, hsh, arch, storey, blocked, pre) {
    const { W, D, at, rooms } = plan;
    const N = W * D;
    const LAY = 3;
    const occ = new Uint8Array(N * LAY);     // 0 free, 1 taken
    const oat = (dx, dz, dy) => (dy * N) + at(dx, dz);
    const inBounds = (dx, dz) => dx >= plan.x0 && dx <= plan.x1 && dz >= plan.z0 && dz <= plan.z1;

    // Partitions, doorways and reserved circulation are occupied before anything starts.
    for (const w of plan.wallCells) for (let y = 0; y < LAY; y++) occ[oat(w.dx, w.dz, y)] = 1;
    for (let dx = plan.x0; dx <= plan.x1; dx++)
      for (let dz = plan.z0; dz <= plan.z1; dz++)
        if (plan.reserved[at(dx, dz)]) occ[oat(dx, dz, 0)] = 2;
    /* PHASE 14 — DOORWAY APPROACHES. The circulation reserve protects a route through the
       house, but it does not protect the cell you stand in to walk through a given
       doorway, and nothing else did either. That is how a television unit came to be
       seated square across a bedroom door — the recipe puts the screen on the wall
       opposite the sofa, that wall had the doorway in it, and the doorway was invisible to
       the placement test. Three houses in the sample had a fully furnished room behind a
       door no player could ever open.

       Both flanks of every opening are now reserved. Reserved is not sealed: flat dressing
       may still lie there, so rugs still run through doorways, and only pieces you would
       have to climb over are excluded. */
    for (const dw of plan.doorways) {
      const flanks = dw.axis === 1
        ? [[dw.dx - 1, dw.dz], [dw.dx + 1, dw.dz]]
        : [[dw.dx, dw.dz - 1], [dw.dx, dw.dz + 1]];
      for (const [ax, az] of flanks) {
        if (!inBounds(ax, az)) continue;
        if (occ[oat(ax, az, 0)] === 0) occ[oat(ax, az, 0)] = 2;
      }
    }
    // The chimney breast, on every floor it passes through.
    if (plan.solidCells) for (const k of plan.solidCells) {
      const p = k.split(':'), cdx = +p[0], cdz = +p[1];
      if (cdx >= 0 && cdx < W && cdz >= 0 && cdz < D)
        for (let y = 0; y < LAY; y++) occ[oat(cdx, cdz, y)] = 1;
    }
    // The staircase, its landing and its guarding, on whichever floor they pass through.
    for (const b of (blocked || [])) {
      if (b[0] < 0 || b[0] >= W || b[1] < 0 || b[1] >= D) continue;
      for (let y = 0; y < LAY; y++) occ[oat(b[0], b[1], y)] = 1;
    }
    /* PHASE 15 — MOTIF RESERVATION. The house's motif, if it has one, is resolved from
       the plan alone and its cells are claimed HERE, before the first recipe runs. That
       is the whole reason a motif can be an ordinary-looking object in an ordinary-looking
       room and still never collide with anything: the furnisher simply never sees those
       cells as free. Nothing else about the furnisher changes, and a house with no motif
       is furnished byte-for-byte as it was in Phase 14. */
    for (const p of (pre || [])) {
      if (p[0] < 0 || p[0] >= W || p[2] < 0 || p[2] >= D) continue;
      if (p[1] < 0 || p[1] >= LAY) continue;
      occ[oat(p[0], p[2], p[1])] = 1;
    }

    /* Cells that must stay clear of anything tall, so a window is never bricked up from
       the inside. The window cell itself is in the shell; this is the room cell in front
       of it, and the one above. */
    const windowFront = new Uint8Array(N);
    for (const win of plan.windows) {
      const f = _propFace(win.face);
      const ix = win.dx - f[0], iz = win.dz - f[1];
      if (inBounds(ix, iz)) windowFront[at(ix, iz)] = 1;
    }

    let seq = 0;
    const rnd = () => hsh(500 + (seq++));

    /* The single test every placement goes through. Returns the cell list on success so
       the caller can commit it, or null.

       PHASE 14 FIX — `room` confines a piece to the room it is being placed in. Without
       it the only bounds check was the whole floor plan, and wall cells are not marked in
       the occupancy grid, so a piece seated against a partition could put half of itself
       through that partition and into the next room. That is how a bathroom vanity ended
       up standing in a bedroom, and how three ordinary bedrooms lost the only floor space
       a bed could have used. Every room recipe now passes its own room. */
    const fits = (name, face, ox2, oz2, room) => {
      const m = FURN[name];
      if (!m) return null;
      const cells = furnCells(name, face);
      // 1 = solid, 2 = reserved for circulation. Flat dressing may lie on 2, never on 1.
      const bar = m.flat ? 1 : 0;
      for (const c of cells) {
        const dx = ox2 + c[0], dz = oz2 + c[2], dy = c[1];
        if (!inBounds(dx, dz)) return null;
        if (room && plan.inRoom[at(dx, dz)] !== room.id) return null;
        if (dy < 0 || dy >= LAY) return null;
        const o = occ[oat(dx, dz, dy)];
        if (o === 1 || (o === 2 && !m.flat)) return null;
        if (m.tall && windowFront[at(dx, dz)]) return null;
      }
      return cells;
    };
    const commit = (name, face, ox2, oz2, cells) => {
      for (const c of cells) occ[oat(ox2 + c[0], oz2 + c[2], c[1])] = 1;
      furnStamp(S, name, ox + ox2, floorY, oz + oz2, face);
    };
    const place = (name, face, ox2, oz2, room) => {
      const cells = fits(name, face, ox2, oz2, room);
      if (!cells) return false;
      commit(name, face, ox2, oz2, cells);
      return true;
    };

    /* Place a piece against one wall of a room, trying offsets outward from a preferred
       start so a sofa lands centred on its wall rather than jammed into a corner. */
    const againstWall = (room, side, name, prefer) => {
      const face = (side + 2) % 4;
      const [FW, FD] = furnFootprint(name, face);
      const runLen = (side % 2 === 0) ? room.w : room.d;
      const span = (side % 2 === 0) ? FW : FD;
      if (span > runLen) return false;
      const maxOff = runLen - span;
      const start = prefer === undefined ? Math.floor(maxOff / 2) : Math.max(0, Math.min(maxOff, prefer));
      for (let k = 0; k <= maxOff; k++) {
        for (const off of (k === 0 ? [start] : [start - k, start + k])) {
          if (off < 0 || off > maxOff) continue;
          let px, pz;
          if (side === 2) { px = room.x0 + off; pz = room.z0; }
          else if (side === 0) { px = room.x0 + off; pz = room.z1 - FD + 1; }
          else if (side === 1) { px = room.x0; pz = room.z0 + off; }
          else { px = room.x1 - FW + 1; pz = room.z0 + off; }
          if (place(name, face, px, pz, room)) return { px, pz, face, off };
        }
      }
      return false;
    };

    // Longest wall of a room, optionally excluding a side.
    const wallsByLength = (room, exclude) => {
      const sides = [0, 1, 2, 3].filter(s => s !== exclude);
      sides.sort((a, b) => ((b % 2 === 0) ? room.w : room.d) - ((a % 2 === 0) ? room.w : room.d));
      return sides;
    };

    /* PHASE 14 — LAST RESORT. Some pieces are not decoration: a bedroom without a bed and
       a dining room without a table do not read as those rooms at all, and the player
       walks into what looks like an unfinished house rather than an unsettling one. When
       againstWall cannot seat one of those pieces — a short wall, an awkward doorway, a
       chimney breast eating the only long run — this sweeps every cell of the room in
       every orientation and takes the first that fits. It is only ever called for the one
       piece that defines the room, never for dressing. */
    const placeAnywhere = (room, names, faces) => {
      for (const name of names) {
        for (const face of (faces || [0, 1, 2, 3])) {
          const [FW, FD] = furnFootprint(name, face);
          for (let dz = room.z0; dz + FD - 1 <= room.z1; dz++)
            for (let dx = room.x0; dx + FW - 1 <= room.x1; dx++) {
              // Stay inside the room proper: a piece must not straddle a partition.
              let inside = true;
              for (let a = 0; a < FW && inside; a++)
                for (let b = 0; b < FD; b++)
                  if (plan.inRoom[at(dx + a, dz + b)] !== room.id) { inside = false; break; }
              if (!inside) continue;
              if (place(name, face, dx, dz, room)) return { px: dx, pz: dz, face };
            }
        }
      }
      return false;
    };

    // Which side of a room the doorway into it is on — furniture should not be dumped
    // directly opposite a door, and a bed's headboard should not be on the door wall.
    const doorSideOf = (room) => {
      for (const dw of plan.doorways) {
        if (dw.a !== room.id && dw.b !== room.id) continue;
        if (dw.axis === 1) return dw.dx < room.x0 ? 1 : 3;
        return dw.dz < room.z0 ? 2 : 0;
      }
      return -1;
    };

    /* Wall dressing sits one cell up, on the room cell in front of a wall, so it never
       competes with the furniture on the floor. */
    const hangArt = (room, name, side, prefer) => {
      const face = (side + 2) % 4;
      const [FW, FD] = furnFootprint(name, face);
      const runLen = (side % 2 === 0) ? room.w : room.d;
      const span = (side % 2 === 0) ? FW : FD;
      if (span > runLen) return false;
      const maxOff = runLen - span;
      const start = prefer === undefined ? Math.floor(maxOff / 2) : Math.max(0, Math.min(maxOff, prefer));
      for (let k = 0; k <= maxOff; k++) {
        for (const off of (k === 0 ? [start] : [start - k, start + k])) {
          if (off < 0 || off > maxOff) continue;
          let px, pz;
          if (side === 2) { px = room.x0 + off; pz = room.z0; }
          else if (side === 0) { px = room.x0 + off; pz = room.z1 - FD + 1; }
          else if (side === 1) { px = room.x0; pz = room.z0 + off; }
          else { px = room.x1 - FW + 1; pz = room.z0 + off; }
          const cells = furnCells(name, face);
          let ok = true;
          for (const c of cells) {
            const dx = px + c[0], dz = pz + c[2];
            if (!inBounds(dx, dz) || occ[oat(dx, dz, 1)] === 1) { ok = false; break; }
            if (windowFront[at(dx, dz)]) { ok = false; break; }
          }
          if (!ok) continue;
          for (const c of cells) occ[oat(px + c[0], pz + c[2], 1)] = 1;
          furnStamp(S, name, ox + px, floorY + 1, oz + pz, face);
          return true;
        }
      }
      return false;
    };

    // Curtains at every window that has a free cell in front of it.
    const dressWindows = () => {
      for (const win of plan.windows) {
        const f = _propFace(win.face);
        const ix = win.dx - f[0], iz = win.dz - f[1];
        if (!inBounds(ix, iz)) continue;
        if (occ[oat(ix, iz, 1)] === 1) continue;
        occ[oat(ix, iz, 1)] = 1;
        // Face the curtain at the window: the model hangs on the wall behind it.
        furnStamp(S, 'curtains', ox + ix, floorY + 1, oz + iz, (win.face + 2) % 4);
      }
    };

    // A rug drops into the largest run of still-free floor in a room.
    const layRug = (room, name) => {
      const [FW, FD] = furnFootprint(name, 0);
      for (let dz = room.z0; dz + FD - 1 <= room.z1; dz++)
        for (let dx = room.x0; dx + FW - 1 <= room.x1; dx++)
          if (place(name, 0, dx, dz, room)) return true;
      return false;
    };

    const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];
    const fabricSet = Math.floor(hsh(470) * 4) % 4;
    const couchName = ['couchOat', 'couchOlive', 'couchRust', 'couchNavy'][fabricSet];
    const chairName = ['armchairOat', 'armchairOlive', 'armchairRust', 'armchairOat'][fabricSet];
    const loveName = ['loveseatOat', 'loveseatOlive', 'loveseatRust', 'loveseatOat'][fabricSet];
    const woodChair = hsh(471) < 0.5 ? 'chairWalnut' : 'chairOak';

    let torchPlaced = false;

    /* ---- FLOOR FINISHES ---------------------------------------------------------------
       Boards in the public rooms, carpet in the bedrooms, tile in the wet rooms. Laid per
       ROOM rather than per half-house, which is the first thing that makes a plan read as
       a plan when you walk through it. */
    const floorFor = (t) => t === 'bedroom' ? BLOCK.CARPET
      : (t === 'kitchen' || t === 'bathroom' || t === 'laundry') ? BLOCK.TILE_FLOOR
      : BLOCK.WOOD_FLOOR;
    /* The stairwell is a HOLE through this floor, so nothing may be laid across it — this
       is the deck the flight arrives through, and the top tread lives in it. */
    const stairCell = new Set();
    for (const b of (blocked || [])) stairCell.add(b[0] + ':' + b[1]);
    for (const r of rooms) {
      const f = floorFor(r.type);
      for (let dx = r.x0; dx <= r.x1; dx++)
        for (let dz = r.z0; dz <= r.z1; dz++) {
          if (stairCell.has(dx + ':' + dz)) continue;
          S(ox + dx, floorY - 1, oz + dz, f);
        }
    }
    for (const w of plan.wallCells) {
      if (stairCell.has(w.dx + ':' + w.dz)) continue;
      S(ox + w.dx, floorY - 1, oz + w.dz, BLOCK.WOOD_FLOOR);
    }

    // ---- ROOM RECIPES --------------------------------------------------------------------
    for (const room of rooms) {
      const dside = doorSideOf(room);
      const sides = wallsByLength(room, dside);

      if (room.type === 'living') {
        // Sofa on the longest wall; screen opposite it; table between; a chair square on.
        let sofa = false, sofaSide = -1;
        for (const s of sides) {
          const r2 = againstWall(room, s, room.area >= 15 ? couchName : loveName);
          if (r2) { sofa = true; sofaSide = s; break; }
        }
        if (!sofa) { for (const s of sides) { if (againstWall(room, s, chairName)) { sofaSide = s; break; } } }
        const opposite = sofaSide >= 0 ? (sofaSide + 2) % 4 : sides[0];
        // Coffee table one cell off the sofa, then the television against the far wall.
        if (sofaSide >= 0) {
          const step = _propFace((sofaSide + 2) % 4);
          const base = sofaSide === 2 ? { x: room.x0, z: room.z0 } :
                       sofaSide === 0 ? { x: room.x0, z: room.z1 } :
                       sofaSide === 1 ? { x: room.x0, z: room.z0 } : { x: room.x1, z: room.z0 };
          const cx = (room.x0 + room.x1) >> 1, cz = (room.z0 + room.z1) >> 1;
          const tx = (sofaSide % 2 === 0) ? cx : base.x + step[0];
          const tz = (sofaSide % 2 === 0) ? base.z + step[1] : cz;
          if (!place('coffeeTable', (sofaSide + 2) % 4, tx - 1, tz, room)) place('coffeeTable', (sofaSide + 2) % 4, tx, tz, room);
        }
        if (room.area >= 12) againstWall(room, opposite, 'tvUnit');
        if (room.area >= 16) againstWall(room, sides[1] !== undefined ? sides[1] : opposite, chairName);
        if (room.area >= 15 && rnd() < 0.6) againstWall(room, pick(sides), 'bookshelf');
        if (rnd() < 0.45) againstWall(room, pick(sides), 'sideTable');
        if (rnd() < 0.5) againstWall(room, pick(sides), 'plant');
        hangArt(room, rnd() < 0.5 ? 'artLandscape' : 'artPortrait', sofaSide >= 0 ? sofaSide : sides[0]);
        // THE house light: a floor lamp with a real flame inside its shade. Exactly one
        // per house, which keeps the Phase 11 resident-light bound exactly where it was.
        if (!torchPlaced) {
          for (const corner of [[room.x1, room.z1], [room.x0, room.z1], [room.x1, room.z0], [room.x0, room.z0]]) {
            if (windowFront[at(corner[0], corner[1])]) continue;
            if (place('lampBase', 0, corner[0], corner[1], room)) {
              S(ox + corner[0], floorY + 1, oz + corner[1], BLOCK.TORCH);
              furnStamp(S, 'lampShade', ox + corner[0], floorY + 2, oz + corner[1], 0);
              occ[oat(corner[0], corner[1], 1)] = 1;
              occ[oat(corner[0], corner[1], 2)] = 1;
              torchPlaced = true; break;
            }
          }
        }
        layRug(room, rnd() < 0.5 ? 'rugSmall' : 'rugSmallBlue');

      } else if (room.type === 'kitchen') {
        /* A run of worktop down the longest wall, sink centred on it (which is where a
           window usually is), hob two along, tall fridge at the far end, wall cabinets
           over the run. An L-return if the room is deep enough. */
        /* A worktop run down the longest wall. The run is laid FIRST and the appliances
           are then dropped into positions that actually took a unit — the old version
           picked the sink and hob slots up front, and any kitchen whose chosen slot happened
           to fall on a circulation cell simply had no sink in it. */
        const s = sides[0];
        const face = (s + 2) % 4;
        const runLen = (s % 2 === 0) ? room.w : room.d;
        const slot = (i) => {
          if (s === 2) return [room.x0 + i, room.z0];
          if (s === 0) return [room.x0 + i, room.z1];
          if (s === 1) return [room.x0, room.z0 + i];
          return [room.x1, room.z0 + i];
        };
        const laid = [];
        for (let i = 0; i < runLen; i++) {
          const [px, pz] = slot(i);
          if (place('counter', face, px, pz, room)) laid.push([i, px, pz]);
        }
        const swap = (name, idx) => {
          if (idx < 0 || idx >= laid.length) return false;
          const [, px, pz] = laid[idx];
          furnStamp(S, name, ox + px, floorY, oz + pz, face);
          laid[idx][0] = -1;   // taken
          return true;
        };
        // Sink in the middle of the run, hob a couple along, fridge at the end.
        swap('counterSink', Math.floor(laid.length / 2));
        if (laid.length >= 3) swap('stove', laid.length >= 5 ? 1 : 0);
        /* The fridge is tall, so it goes through the same fit test as everything else —
           stamping it straight onto the end of the run put it in front of a window. */
        let fridged = false;
        for (let k = laid.length - 1; k >= 0 && !fridged; k--) {
          const [tag, fx, fz] = laid[k];
          if (tag < 0) continue;                       // already a sink or a hob
          if (windowFront[at(fx, fz)]) continue;
          furnStamp(S, 'fridge', ox + fx, floorY, oz + fz, face);
          occ[oat(fx, fz, 1)] = 1; occ[oat(fx, fz, 2)] = 1;
          laid[k][0] = -1;
          fridged = true;
        }
        if (!fridged) for (const s2 of sides) if (againstWall(room, s2, 'fridge')) break;
        // Wall units over whatever is left of the plain run.
        for (const [i, px, pz] of laid) {
          if (i < 0) continue;
          if (occ[oat(px, pz, 1)] === 1) continue;
          if (rnd() < 0.75) {
            occ[oat(px, pz, 1)] = 1; occ[oat(px, pz, 2)] = 1;
            furnStamp(S, 'wallCabinet', ox + px, floorY + 1, oz + pz, face);
            /* PHASE 14 FIX — the carcase is authored 2.06 tall, so its topmost cell lands
               on the ceiling COURSE and replaced the panel there, leaving a hole in the
               ceiling above every run of wall units in the suburb. The overhang is six
               centimetres and invisible; the missing ceiling was not. Putting the panel
               back costs one write per cabinet and keeps every block id where it is. */
            S(ox + px, floorY + this._subRoomH(), oz + pz, CEIL_PANEL);
          }
        }
        // A short return along the next wall makes it read as a fitted kitchen.
        if (room.area >= 12) {
          const s2 = sides[1];
          if (s2 !== undefined) {
            const run2 = (s2 % 2 === 0) ? room.w : room.d;
            for (let i = 0; i < Math.min(3, run2); i++) {
              let px, pz;
              if (s2 === 2) { px = room.x0 + i; pz = room.z0; }
              else if (s2 === 0) { px = room.x0 + i; pz = room.z1; }
              else if (s2 === 1) { px = room.x0; pz = room.z0 + i; }
              else { px = room.x1; pz = room.z0 + i; }
              place(i === 0 ? 'counterCorner' : 'counter', (s2 + 2) % 4, px, pz, room);
            }
          }
        }
        // Somewhere to sit and eat, if the room can take it. Tried across the whole floor
        // rather than only dead centre, which is why it almost never used to appear.
        if (room.area >= 14 && rnd() < 0.8) {
          const [TW, TD] = furnFootprint('diningTable', 0);
          let done = false;
          for (let dz = room.z0; dz + TD - 1 <= room.z1 && !done; dz++)
            for (let dx = room.x0; dx + TW - 1 <= room.x1 && !done; dx++)
              if (place('diningTable', 0, dx, dz, room)) {
                done = true;
                place(woodChair, 0, dx, dz - 1, room);
                place(woodChair, 2, dx + TW - 1, dz + TD, room);
              }
        }
        againstWall(room, sides[sides.length - 1], 'binSmall');

      } else if (room.type === 'dining') {
        const c = { x: (room.x0 + room.x1) >> 1, z: (room.z0 + room.z1) >> 1 };
        const big = room.w >= 4 && room.d >= 4;
        const tbl = big ? 'diningTableLong' : 'diningTable';
        const [TW, TD] = furnFootprint(tbl, 0);
        let placed = false;
        for (let dz = room.z0; dz + TD - 1 <= room.z1 && !placed; dz++)
          for (let dx = room.x0; dx + TW - 1 <= room.x1 && !placed; dx++)
            if (place(tbl, 0, dx, dz, room)) {
              placed = true;
              // Chairs down both long sides, facing the table.
              for (let i = 0; i < TW; i++) {
                place(woodChair, 0, dx + i, dz - 1, room);
                place(woodChair, 2, dx + i, dz + TD, room);
              }
            }
        /* PHASE 14 FIX — thirteen ordinary dining rooms in the sample had no table in
           them, because the one orientation tried here did not fit and nothing followed.
           A dining room with a dresser and a picture in it is not a dining room, it is a
           room. Try the small table, then the table turned, and only then give up — and
           if the table really cannot be seated, two chairs and a side table at least read
           as somewhere people sat down. */
        if (!placed) {
          const seat = placeAnywhere(room, big ? ['diningTable', 'diningTableLong'] : ['diningTable']);
          if (seat) {
            placed = true;
            const [SW, SD] = furnFootprint('diningTable', seat.face);
            for (let i = 0; i < SW; i++) {
              place(woodChair, 0, seat.px + i, seat.pz - 1, room);
              place(woodChair, 2, seat.px + i, seat.pz + SD, room);
            }
          }
        }
        if (!placed) {
          placeAnywhere(room, ['sideTable']);
          for (const s of sides) if (againstWall(room, s, woodChair)) break;
          for (const s of sides.slice(1)) if (againstWall(room, s, woodChair)) break;
        }
        againstWall(room, sides[0], 'dresser');
        hangArt(room, 'artLandscape', sides[0]);
        if (rnd() < 0.5) againstWall(room, sides[1] === undefined ? sides[0] : sides[1], 'plant');

      } else if (room.type === 'bedroom') {
        // Headboard against the longest wall that is not the door wall.
        const bedName = room.area >= 12 ? (rnd() < 0.5 ? 'bedDouble' : 'bedDoubleWarm') : 'bedSingle';
        let bedR = false, bedSide = -1;
        for (const s of sides) {
          bedR = againstWall(room, s, bedName);
          if (bedR) { bedSide = s; break; }
        }
        if (!bedR) { for (const s of sides) { bedR = againstWall(room, s, 'bedSingle'); if (bedR) { bedSide = s; break; } } }
        /* PHASE 14 FIX — a bed against a wall is what a bedroom looks like, but seven
           ordinary bedrooms had no bed at all rather than a bed in an odd place. A single
           bed standing free in the middle of a small room still reads as a bedroom; an
           empty room does not read as anything. */
        if (!bedR) bedR = placeAnywhere(room, ['bedSingle']);
        /* PHASE 14 — THE BOX ROOM. Three ordinary bedrooms in the sample genuinely cannot
           hold a bed: a 3x2 room with the chimney breast standing in one corner and the
           circulation reserve running an L through it leaves two free cells that are not
           next to each other, and the smallest bed is two cells long. Forcing one in would
           mean either standing it on the reserved route to the door or clipping it through
           the stack, and both are worse than the room not being a bedroom.

           So it is furnished as what a room like that actually is in a real house — the
           box room. Shelves and a chair in the two corners it has, which reads at a glance
           as a small study, keeps the carpet and the picture and the light it already had,
           and looks deliberate rather than unfinished. */
        if (!bedR) {
          const deskR = againstWall(room, sides[0], 'desk') || placeAnywhere(room, ['desk']);
          if (deskR) {
            for (const s of sides) if (againstWall(room, s, woodChair)) break;
          } else {
            if (!againstWall(room, sides[0], 'bookshelf')) placeAnywhere(room, ['bookshelf']);
            let seated = false;
            for (const s of sides) if (!seated && againstWall(room, s, woodChair)) seated = true;
            if (!seated) placeAnywhere(room, [woodChair, 'sideTable', 'boxes']);
          }
        }
        if (bedR && bedSide < 0) bedSide = bedR.face === undefined ? -1 : (bedR.face + 2) % 4;
        if (bedR && bedSide >= 0) {
          // A nightstand at the head end, on whichever side has room.
          const nsFace = (bedSide + 2) % 4;
          const cand = (bedSide % 2 === 0)
            ? [[bedR.px - 1, bedR.pz], [bedR.px + furnFootprint(bedName, nsFace)[0], bedR.pz]]
            : [[bedR.px, bedR.pz - 1], [bedR.px, bedR.pz + furnFootprint(bedName, nsFace)[1]]];
          for (const [nx, nz] of cand) if (place('nightstand', nsFace, nx, nz, room)) break;
        }
        const rest = sides.filter(s => s !== bedSide);
        if (rest.length) againstWall(room, rest[0], rnd() < 0.5 ? 'dresser' : 'dresserOak');
        if (rest.length > 1 && room.area >= 12 && rnd() < 0.55) againstWall(room, rest[1], 'desk');
        if (room.area >= 15 && rnd() < 0.4) againstWall(room, pick(rest.length ? rest : sides), 'bookshelf');
        hangArt(room, rnd() < 0.5 ? 'artFamily' : 'artPortrait', bedSide >= 0 ? bedSide : sides[0]);
        layRug(room, rnd() < 0.5 ? 'rugSmall' : 'rugSmallBlue');

      } else if (room.type === 'bathroom') {
        const s0 = sides[0];
        let wash = false;
        if (room.w >= 2 && room.d >= 2 && rnd() < 0.7) {
          for (const s of sides) if (!wash && againstWall(room, s, 'bathtub')) wash = true;
        }
        if (!wash) for (const s of sides) if (!wash && againstWall(room, s, 'shower')) wash = true;
        const rest = sides.filter(s => s !== s0);
        let done = false;
        for (const s of rest) if (!done && againstWall(room, s, 'toilet')) done = true;
        if (!done) againstWall(room, s0, 'toilet');
        let van = false;
        for (const s of rest) if (!van && againstWall(room, s, 'vanity')) van = true;
        if (!van) againstWall(room, s0, 'vanity');
        layRug(room, 'bathMat');

      } else if (room.type === 'laundry') {
        againstWall(room, sides[0], 'washer', 0);
        againstWall(room, sides[0], 'dryer', 1);
        if (sides[1] !== undefined) againstWall(room, sides[1], 'waterHeater');
        if (sides[2] !== undefined && rnd() < 0.6) againstWall(room, sides[2], 'utilityShelf');
        if (rnd() < 0.5) againstWall(room, sides[0], 'boxes');

      } else if (room.type === 'hall') {
        // A hall is supposed to be nearly empty. A console, a mirror, somewhere for keys.
        if (rnd() < 0.6) againstWall(room, sides[0], 'sideTable');
        hangArt(room, 'mirrorHall', sides[0]);
        if (rnd() < 0.35) againstWall(room, sides[sides.length - 1], 'plant');
      }

      /* A ceiling fixture in every room. Purely decorative — the phase adds no light
         sources beyond the single existing torch.
         PHASE 14 FIX — laundries were excluded here, which left eleven windowless utility
         rooms in the sample as unlit boxes that read as unfinished rather than as
         ordinary. The occupancy guard below already stops the fitting clashing with a
         water heater or a shelf, so the exclusion was buying nothing. */
      const cx = (room.x0 + room.x1) >> 1, cz = (room.z0 + room.z1) >> 1;
      if (!occ[oat(cx, cz, 2)]) {
        occ[oat(cx, cz, 2)] = 1;
        furnStamp(S, 'ceilingLight', ox + cx, floorY + 2, oz + cz, 0);
      }
    }

    dressWindows();
    return occ;
  }

  /* --------------------------------------------------------------------------------------
     THE STAIRCASE.

     A straight flight of five cells rising one block per cell, landing exactly on the upper
     deck. Every tread is a quarter block, so the flight is WALKED, not jumped —
     PLAYER_STEP_HEIGHT is 0.62 and nothing here ever asks for more than 0.25.

     Choosing where it goes is the whole problem, and it has to satisfy four constraints
     that only make sense once BOTH floors are known:

       GROUND CLEARANCE. Ground-floor partitions are three cells tall, so only the approach
         cell and the first three treads can possibly meet one — by the fourth tread the
         player's feet are already above every partition in the house. Requiring the whole
         run to miss every wall is what made a flight impossible in a 10x8 plan that had
         been cut into four rooms: there is no straight line of six free cells in one.

       DOORWAY CLEARANCE. A tread beside a doorway puts the player's head into the lintel
         halfway up, which reads as an invisible wall in the middle of a corridor. That is
         exactly what sealed two rooms of the narrow archetype. No part of a flight, and no
         cell you approach it from, may touch a doorway.

       THE LANDING is on the UPPER floor, so it is validated against the upper plan rather
         than the ground one. A flight that arrives over a downstairs wall is perfectly fine.

       THE VOID. Upper partitions standing in the stairwell would hang over a hole, so any
         that fall inside the opening come out with it.
     -------------------------------------------------------------------------------------- */
  _subStampStair(S, plan, up, hx, hz, baseY, info) {
    const RUN = 4;   // four treads, one block each, arriving on the deck at baseY+4
    const inB = (p, dx, dz) => dx >= p.x0 && dx <= p.x1 && dz >= p.z0 && dz <= p.z1;
    const wall = (p, dx, dz) => p.wallAt.has(p.at(dx, dz)) ||
      (p.solidCells && p.solidCells.has(dx + ':' + dz));
    // The chimney is full height, so it blocks a tread at ANY point of the flight.
    const solid = (dx, dz) => (plan.solidCells && plan.solidCells.has(dx + ':' + dz)) ||
      (up.solidCells && up.solidCells.has(dx + ':' + dz));
    const door = (p, dx, dz) => p.doorAt.has(p.at(dx, dz));
    const nearDoor = (p, dx, dz) => door(p, dx, dz) ||
      door(p, dx - 1, dz) || door(p, dx + 1, dz) || door(p, dx, dz - 1) || door(p, dx, dz + 1);

    const dirs = [[0, 1, 0], [0, -1, 2], [1, 0, 3], [-1, 0, 1]];   // ax, az, facing
    const cands = [];
    for (const [ax, az, face] of dirs)
      for (let dx = plan.x0; dx <= plan.x1; dx++)
        for (let dz = plan.z0; dz <= plan.z1; dz++)
          cands.push({ x: dx, z: dz, ax, az, face, gx: az !== 0 ? 1 : 0, gz: az !== 0 ? 0 : 1 });

    const score = (c, strict) => {
      /* The cell directly BEHIND the flight, which is the only place you can start from.
         A 45-degree tread is already a full block up by the middle of its own cell, so a
         side approach would ask for a one-block step and simply fails — this was measured,
         not assumed. */
      const apx = c.x - c.ax, apz = c.z - c.az;
      if (!inB(plan, apx, apz)) return -1;
      if (wall(plan, apx, apz) || nearDoor(plan, apx, apz) || solid(apx, apz)) return -1;
      for (let p = 0; p < RUN; p++) {
        const dx = c.x + c.ax * p, dz = c.z + c.az * p;
        if (!inB(plan, dx, dz)) return -1;
        if (nearDoor(plan, dx, dz) || solid(dx, dz)) return -1;
        if (p <= 2 && wall(plan, dx, dz)) return -1;
        if (strict && p >= 1 && wall(up, dx, dz)) return -1;
      }
      const lx = c.x + c.ax * RUN, lz = c.z + c.az * RUN;
      if (!inB(up, lx, lz)) return -1;
      if (wall(up, lx, lz) || nearDoor(up, lx, lz) || solid(lx, lz)) return -1;
      const L = plan.lane;
      const inLane = L ? (L.axis === 1 ? (c.x === L.at && c.ax === 0) : (c.z === L.at && c.az === 0)) : false;
      const edge = (c.x === plan.x0 || c.x === plan.x1 || c.z === plan.z0 || c.z === plan.z1) ? 8 : 0;
      const near = 14 - Math.min(14, Math.abs(c.x - plan.entry.dx) + Math.abs(c.z - plan.entry.dz));
      return (inLane ? 100 : 0) + edge + near + 1;
    };

    let best = null, bestScore = -1;
    for (const strict of [true, false]) {
      for (const c of cands) {
        const s = score(c, strict);
        if (s > bestScore) { bestScore = s; best = c; }
      }
      if (best) break;
    }
    if (!best) return;

    info.cells.push([best.x - best.ax, best.z - best.az]);   // the approach
    const stairId = FURN['stair'].rot[furnRotIndex('stair', best.face)].cells[0][3];
    for (let p = 0; p < RUN; p++) {
      const dx = best.x + best.ax * p, dz = best.z + best.az * p;
      S(hx + dx, baseY + p, hz + dz, stairId);
      info.cells.push([dx, dz]);
      /* Open the ceiling course and the upper deck above the flight. Nothing BELOW the
         ceiling is touched, so a partition the flight passes over on its fourth tread is
         left standing rather than punched through. */
      /* Open the deck above the flight. The bottom tread keeps its soffit — head height
         there is baseY+2.8 against a deck at baseY+3 — and the top tread IS the deck
         course, so neither is cut. Upstairs partitions left hanging over the hole go too. */
      /* The deck comes out over the WHOLE flight including the bottom tread. Keeping a
         soffit there looked reasonable on paper — head height at the bottom step is
         baseY+2.8 — but the player is already at 1.25 a quarter of a cell later, which
         puts their head through it. Measured, not assumed. */
      if (p < 3) S(hx + dx, baseY + 3, hz + dz, BLOCK.AIR);
      if (p >= 1) for (let y = baseY + 4; y <= baseY + 7; y++) S(hx + dx, y, hz + dz, BLOCK.AIR);
    }

    /* The landing at the head of the flight is left COMPLETELY clear. A newel post in it
       is only 0.2 across, but a 0.6 body walking through the middle of the cell still
       clips it, which put an unclimbable one-block lip at the top of every staircase in
       the game. It is reserved from furniture and nothing is stamped in it. */
    const lx = best.x + best.ax * RUN, lz = best.z + best.az * RUN;
    info.cells.push([lx, lz]);

    /* Guard the long sides of the opening upstairs, wherever there is a cell to guard from
       that is not itself a wall, a doorway or part of the flight. The newel goes at the
       head of that run, beside the landing rather than in it. */
    const gx = best.ax !== 0 ? 0 : 1, gz = best.ax !== 0 ? 1 : 0;
    let newelDone = false;
    for (let p = 1; p <= RUN; p++) {
      const dx = best.x + best.ax * p, dz = best.z + best.az * p;
      for (const s of [-1, 1]) {
        const bx = dx + gx * s, bz = dz + gz * s;
        if (!inB(up, bx, bz)) continue;
        if (wall(up, bx, bz) || nearDoor(up, bx, bz)) continue;
        if (bx === lx && bz === lz) continue;
        info.cells.push([bx, bz]);
        const face = s > 0 ? (gx ? 1 : 2) : (gx ? 3 : 0);
        if (p === RUN && !newelDone) { furnStamp(S, 'newel', hx + bx, baseY + 4, hz + bz, face); newelDone = true; }
        else furnStamp(S, 'banister', hx + bx, baseY + 4, hz + bz, face);
      }
    }
    info.placed = true;
  }

  /* =====================================================================================
     PHASE 14 — INTERIOR ANOMALIES

     THE RATIO IS UNCHANGED: ~75% of houses are completely ordinary, ~20% subtly wrong,
     ~5% impossible, exactly as Phase 9 set it and Phase 13 preserved it. What changes is
     that the anomalies now happen to a believable house rather than to a box, which is
     the only reason any of them land. A repeated painting is only unsettling if you have
     already walked through four houses whose paintings were all different.

     Every anomaly below is additive and non-blocking: none of them seals a room, removes
     a doorway, or puts anything solid in a reserved circulation cell.
     ===================================================================================== */
  _subInteriorAnomaly(S, plan, lot, arch, hx, hz, floorY, storey, W, D, h, blocked) {
    if (arch.tier === 0) return;
    if (storey !== 0) return;
    const RH = this._subRoomH();
    /* The staircase is structure, not dressing. An anomaly that empties a room or drops its
       ceiling must leave the flight — and the cells at its head and foot — exactly alone,
       or the upper floor stops being reachable. */
    const keep = new Set();
    for (const b of (blocked || [])) keep.add(b[0] + ':' + b[1]);
    const stairIn = (r) => {
      for (let dx = r.x0; dx <= r.x1; dx++)
        for (let dz = r.z0; dz <= r.z1; dz++) if (keep.has(dx + ':' + dz)) return true;
      return false;
    };

    if (arch.tier === 1) {
      const a = h(11);
      if (a < 0.22) {
        /* THE SAME PICTURE, IN EVERY ROOM. Not a copy of a picture — the same picture,
           at the same height, on the wall you face as you come in. */
        for (const r of plan.rooms) {
          furnStamp(S, 'artPortrait', hx + r.x0, floorY + 1, hz + r.z0, 0);
          if (r.w >= 2) furnStamp(S, 'artPortrait', hx + r.x1, floorY + 1, hz + r.z1, 2);
        }
      } else if (a < 0.42) {
        /* THE TELEVISION IS FACING THE WALL. Everything else in the room is normal.

           PHASE 14 FIX — the set is stamped straight into the world, so it never saw the
           occupancy grid, and on four houses it landed square across a doorway and sealed
           a fully furnished room behind it. The anomaly is a television turned to face the
           wall; it was never a barricade. The screen still goes on the same wall of the
           same room, facing the same way — the position along that wall now just steps
           past any cell that is the approach to a doorway. */
        const liv = plan.rooms.find(r => r.type === 'living');
        if (liv) {
          const flank = new Set();
          for (const dw of plan.doorways) {
            if (dw.axis === 1) { flank.add((dw.dx - 1) + ':' + dw.dz); flank.add((dw.dx + 1) + ':' + dw.dz); }
            else { flank.add(dw.dx + ':' + (dw.dz - 1)); flank.add(dw.dx + ':' + (dw.dz + 1)); }
            flank.add(dw.dx + ':' + dw.dz);
          }
          const clear = (px) => {
            for (const c of furnCells('tvUnit', 2))
              if (flank.has((px + c[0]) + ':' + (liv.z0 + c[2]))) return false;
            return true;
          };
          const mid = Math.max(liv.x0, Math.min(liv.x1 - 1, (liv.x0 + liv.x1 >> 1) - 1));
          let px = clear(mid) ? mid : -1;
          for (let k = 1; px < 0 && k <= liv.w; k++) {
            for (const t of [mid - k, mid + k]) {
              if (t < liv.x0 || t > liv.x1 - 1) continue;
              if (clear(t)) { px = t; break; }
            }
          }
          // If every position on that wall would block a door, the anomaly is skipped
          // rather than made passable-but-wrong. A house with no anomaly is just a house.
          if (px >= 0) furnStamp(S, 'tvUnit', hx + px, floorY, hz + liv.z0, 2);
        }
      } else if (a < 0.60) {
        /* AN OVERLY EMPTY ROOM. The furniture is cleared out of one room and its floor
           is left bare — the room is still finished, still lit, still has a door. */
        const target = plan.rooms.filter(r =>
          (r.type === 'bedroom' || r.type === 'dining' || r.type === 'laundry') &&
          !stairIn(r) && r.id !== plan.entryRoomId)[0];
        if (target) {
          for (let dx = target.x0; dx <= target.x1; dx++)
            for (let dz = target.z0; dz <= target.z1; dz++) {
              if (keep.has(dx + ':' + dz)) continue;
              for (let y = 0; y < RH; y++) S(hx + dx, floorY + y, hz + dz, BLOCK.AIR);
            }
        }
      } else if (a < 0.78) {
        // A CEILING ONE COURSE TOO LOW, in one room only. Still walkable — the clearance
        // is 2.0 against a 1.8 player — but you feel it before you can name it.
        const pool = plan.rooms.filter(r => !stairIn(r));
        const target = pool[Math.floor(h(12) * pool.length) % pool.length];
        if (target) {
          for (let dx = target.x0; dx <= target.x1; dx++)
            for (let dz = target.z0; dz <= target.z1; dz++) {
              if (keep.has(dx + ':' + dz)) continue;
              S(hx + dx, floorY + RH - 1, hz + dz, CEIL_PANEL);
            }
        }
      } else {
        /* TWO IDENTICAL ROOMS. The second bedroom is furnished exactly like the first —
           same bed, same wall, same nightstand on the same side. */
        const beds = plan.rooms.filter(r => r.type === 'bedroom');
        if (beds.length >= 2) {
          const b = beds[1];
          furnStamp(S, 'bedSingle', hx + b.x0, floorY, hz + b.z0, 0);
          furnStamp(S, 'nightstand', hx + b.x1, floorY, hz + b.z0, 0);
          furnStamp(S, 'artPortrait', hx + b.x0, floorY + 1, hz + b.z0, 0);
        }
      }
      return;
    }

    /* --- GENUINELY IMPOSSIBLE. About one house in twenty. These only work because
       everything the player walked through to get here was normal. */
    const b = h(13);
    if (b < 0.25) {
      /* A ROOM THAT DOES NOT FIT INSIDE THE HOUSE. It runs eight blocks past the east
         wall, is fully finished — floor, walls, ceiling, a bed, a lamp — and from the
         street the wall it is behind is blank siding. */
      const ex = W - 1, depth = 8, half = Math.floor(D / 2);
      for (let dx = 0; dx <= depth; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          const wx = hx + ex + dx, wz = hz + half + dz;
          const wall = dx === depth || dz === -2 || dz === 2;
          S(wx, floorY - 1, wz, BLOCK.CARPET);
          for (let y = 0; y < RH; y++) S(wx, floorY + y, wz, wall ? BLOCK.DRYWALL : BLOCK.AIR);
          S(wx, floorY + RH, wz, CEIL_PANEL);
        }
      }
      for (let y = 0; y < 2; y++) S(hx + ex, floorY + y, hz + half, BLOCK.AIR);
      S(hx + ex, floorY + 2, hz + half, HEADER_X);
      furnStamp(S, 'bedDouble', hx + ex + depth - 2, floorY, hz + half - 1, 1);
      furnStamp(S, 'lampBase', hx + ex + 1, floorY, hz + half - 1, 0);
      furnStamp(S, 'lampShade', hx + ex + 1, floorY + 2, hz + half - 1, 0);

    } else if (b < 0.45) {
      /* A HALLWAY THAT CANNOT FIT. One cell wide, running twelve blocks out of the back
         of the house, lit, carpeted, skirted with doorway casings that open onto nothing,
         and ending in a blank wall. */
      const sx = Math.floor(W / 2), len = 12;
      for (let i = 1; i <= len; i++) {
        const wz = hz + D - 1 + i;
        S(hx + sx, floorY - 1, wz, BLOCK.WOOD_FLOOR);
        S(hx + sx - 1, floorY - 1, wz, BLOCK.WOOD_FLOOR);
        for (let y = 0; y < RH; y++) {
          S(hx + sx, floorY + y, wz, BLOCK.AIR);
          S(hx + sx - 1, floorY + y, wz, BLOCK.AIR);
          S(hx + sx + 1, floorY + y, wz, BLOCK.DRYWALL);
          S(hx + sx - 2, floorY + y, wz, BLOCK.DRYWALL);
        }
        S(hx + sx, floorY + RH, wz, CEIL_PANEL);
        S(hx + sx - 1, floorY + RH, wz, CEIL_PANEL);
        if (i % 4 === 0) furnStamp(S, 'artPortrait', hx + sx, floorY + 1, wz, 0);
      }
      for (let y = 0; y < RH; y++) {
        S(hx + sx, floorY + y, hz + D - 1 + len + 1, BLOCK.DRYWALL);
        S(hx + sx - 1, floorY + y, hz + D - 1 + len + 1, BLOCK.DRYWALL);
      }
      for (let y = 0; y < 2; y++) {
        S(hx + sx, floorY + y, hz + D - 1, BLOCK.AIR);
        S(hx + sx - 1, floorY + y, hz + D - 1, BLOCK.AIR);
      }

    } else if (b < 0.65) {
      /* A WINDOW SHOWING THE WRONG OUTSIDE. Set into an internal partition, with a metre
         of sunlit lawn sealed behind it that cannot be reached from anywhere. */
      const w = plan.wallCells[Math.floor(h(14) * plan.wallCells.length) % plan.wallCells.length];
      if (w) {
        const along = (w.mask & 3) ? 0 : 1;
        S(hx + w.dx, floorY + 1, hz + w.dz, along === 0 ? BLOCK.WIN_X : BLOCK.WIN_Z);
        // The impossible outside: a lit strip of lawn behind a wall that has no depth.
        const off = along === 0 ? [0, 1] : [1, 0];
        const bx = hx + w.dx + off[0], bz = hz + w.dz + off[1];
        S(bx, floorY - 1, bz, BLOCK.LAWN);
        S(bx, floorY + 3, bz, BLOCK.SIDE_SKY);
      }

    } else if (b < 0.85) {
      /* AN IMPOSSIBLE DOORWAY. A full cased opening, lintel and all, lying in the ceiling
         of the hall — the right joinery, in a place a doorway cannot be. */
      const r = plan.rooms.find(rm => rm.type === 'hall') || plan.rooms[0];
      const cx = (r.x0 + r.x1) >> 1, cz = (r.z0 + r.z1) >> 1;
      S(hx + cx, floorY + RH, hz + cz, CASE_X);
      S(hx + cx, floorY + RH + 1, hz + cz, HEADER_X);
      // And a second one flat against a wall, opening onto solid drywall.
      S(hx + r.x0, floorY, hz + r.z0, CASE_Z);
      S(hx + r.x0, floorY + 1, hz + r.z0, CASE_Z);

    } else {
      /* A SEALED ROOM. Four walls, a made bed, a light on, and no door — you can only see
         into it through the window of the room next door. */
      const target = plan.rooms.filter(r => !stairIn(r) && r.id !== plan.entryRoomId).pop();
      if (target && target.w >= 2 && target.d >= 2) {
        for (const dw of plan.doorways) {
          if (dw.a !== target.id && dw.b !== target.id) continue;
          for (let y = 0; y < RH; y++) {
            S(hx + dw.dx, floorY + y, hz + dw.dz, PART_WALL[dw.axis === 0 ? 3 : 12]);
          }
        }
        furnStamp(S, 'bedSingle', hx + target.x0, floorY, hz + target.z0, 0);
        furnStamp(S, 'lampBase', hx + target.x1, floorY, hz + target.z1, 0);
        furnStamp(S, 'lampShade', hx + target.x1, floorY + 2, hz + target.z1, 0);
      }
    }
  }

  _subRecognitionPass(S, plan, lot, arch, hx, hz, floorY, W, D, occ, doorSide, blocked, motif) {
    const n = this._subStageOf(lot);
    if (!n || !occ) return;
    const RH = this._subRoomH();
    const N = plan.W * plan.D;
    const oat = (dx, dz, dy) => dy * N + plan.at(dx, dz);
    const keep = new Set();
    for (const b of (blocked || [])) keep.add(b[0] + ':' + b[1]);
    const winFront = new Set();
    for (const win of plan.windows) {
      const f = _propFace(win.face);
      winFront.add((win.dx - f[0]) + ':' + (win.dz - f[1]));
    }
    const rooms = plan.rooms.filter(r => !r.lane);
    if (!rooms.length) return;

    /* Each interior effect reports whether it actually managed to change anything. A
       revision that silently does nothing is worse than no revision at all — the player
       walks back into a house they were told (by the fiction, not by the UI) had shifted
       and finds it identical — so when the chosen effect cannot apply, the next one in the
       table is tried instead. In practice the first choice succeeds the great majority of
       the time; the chain exists so that the small houses and the tightly furnished ones
       are not quietly exempt. */
    const effChair = (k) => {
      /* A CHAIR. Not moved, not knocked over, not turned to face the door: simply
         standing in the corner of a room that did not have one, facing the wall, the way
         a chair looks when somebody put it down and never came back for it. */
      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[(i + k + Math.floor(this._subHash(lot.hx, lot.hz, 943) * rooms.length)) % rooms.length];
        // Corners first, because that is where a chair nobody is using ends up; then any
        // free cell in the room, so a tightly furnished house is not silently exempt.
        const cand = [[room.x0, room.z0, 2], [room.x1, room.z0, 2],
                      [room.x0, room.z1, 0], [room.x1, room.z1, 0]];
        for (let dx = room.x0; dx <= room.x1; dx++)
          for (let dz = room.z0; dz <= room.z1; dz++) cand.push([dx, dz, dz === room.z0 ? 2 : 0]);
        for (const [dx, dz, face] of cand) {
          if (plan.inRoom[plan.at(dx, dz)] !== room.id) continue;
          if (keep.has(dx + ':' + dz) || winFront.has(dx + ':' + dz)) continue;
          if (occ[oat(dx, dz, 0)] !== 0) continue;      // 0 free; 1 solid; 2 circulation
          furnStamp(S, 'chairWalnut', hx + dx, floorY, hz + dz, face);
          occ[oat(dx, dz, 0)] = 1;
          return true;
        }
      }
      return false;
    };

    const effDoorway = (k) => {
        /* A DOORWAY, ONE CELL ALONG. The rooms either side are unchanged, the opening is
           the same width and the same joinery, and the wall it was in is made good — so
           there is nothing to notice except that the way through is not where you left
           it. Only cased openings are eligible (a hung leaf carries state), and only when
           the destination's flanking cells are both reserved circulation, which is the
           furnisher's own guarantee that nothing solid is standing in either of them. */
        const cands = plan.doorways.filter(d => d.leaf === 'none' && !d.forced &&
                                                d.a >= 0 && d.b >= 0);
        let moved = false;
        for (let i = 0; i < cands.length && !moved; i++) {
          const d = cands[(i + k) % cands.length];
          for (const s of [1, -1]) {
            const nx = d.axis === 1 ? d.dx : d.dx + s;
            const nz = d.axis === 1 ? d.dz + s : d.dz;
            if (nx < plan.x0 || nx > plan.x1 || nz < plan.z0 || nz > plan.z1) continue;
            const wc = plan.wallAt.get(plan.at(nx, nz));
            if (!wc) continue;                                   // not a partition cell
            if (plan.doorAt.has(plan.at(nx, nz))) continue;      // already an opening
            if (keep.has(nx + ':' + nz)) continue;               // the staircase
            // The two cells the new opening joins must be the same two rooms...
            const ax = d.axis === 1 ? nx - 1 : nx, az = d.axis === 1 ? nz : nz - 1;
            const bx = d.axis === 1 ? nx + 1 : nx, bz = d.axis === 1 ? nz : nz + 1;
            const ra = plan.inRoom[plan.at(ax, az)], rb = plan.inRoom[plan.at(bx, bz)];
            if (!((ra === d.a && rb === d.b) || (ra === d.b && rb === d.a))) continue;
            // ...and both must be circulation the furnisher was forbidden to build in.
            if (occ[oat(ax, az, 0)] === 1 || occ[oat(bx, bz, 0)] === 1) continue;
            if (!plan.reserved[plan.at(ax, az)] || !plan.reserved[plan.at(bx, bz)]) continue;
            // Make the old opening good, then cut the new one with the same joinery.
            const oldMask = plan.wallAt.get(plan.at(d.dx, d.dz));
            const fill = PART_WALL[oldMask ? oldMask.mask : (d.axis === 0 ? 3 : 12)];
            for (let y = 0; y < RH; y++) S(hx + d.dx, floorY + y, hz + d.dz, fill);
            const lower = d.axis === 0 ? CASE_X : CASE_Z;
            S(hx + nx, floorY, hz + nz, lower);
            S(hx + nx, floorY + 1, hz + nz, lower);
            S(hx + nx, floorY + 2, hz + nz, d.axis === 0 ? HEADER_X : HEADER_Z);
            moved = true;
            break;
          }
        }
        if (moved) return true;
        /* NOTHING COULD MOVE. Rather than give up on the revision, rehang one interior
           door on the opposite jamb — the same doorway, opening the other way. Cheap,
           safe, and exactly the kind of thing nobody can be sure about. */
        const hung = plan.doorways.filter(d => d.leaf === 'door');
        if (hung.length) {
          const d = hung[k % hung.length];
          const rec = INT_DOOR[d.axis + ':' + (d.swing > 0 ? -1 : 1)];
          if (rec) {
            const id = d.startClosed ? rec.closedId : rec.openId;
            S(hx + d.dx, floorY, hz + d.dz, id);
            S(hx + d.dx, floorY + 1, hz + d.dz, id);
            return true;
          }
        }
        return false;
    };

    const effPicture = (k) => {
      /* ANOTHER ONE. Whatever this house already hangs on the wall you face coming in, it
         now hangs in one more room as well — same object, same height, same wall relative
         to the door. A house with no motif borrows the commonest one, which is how the
         photograph starts turning up in places it has no business being. */
      const model = (motif && SUB_MOTIFS[motif.idx].layer === 1)
        ? motif.model : SUB_MOTIFS[0].model;
      const side = (doorSide + 2) % 4;
      const motifRoom = motif ? plan.inRoom[plan.at(motif.dx, motif.dz)] : -1;
      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[(i + k) % rooms.length];
        if (room.id === motifRoom) continue;
        const runLen = (side % 2 === 0) ? room.w : room.d;
        for (let o = Math.floor((runLen - 1) / 2), c = 0; c < runLen; c++) {
          const off = (o + c) % runLen;
          const dx = (side === 3) ? room.x1 : (side === 1) ? room.x0 : room.x0 + off;
          const dz = (side === 0) ? room.z1 : (side === 2) ? room.z0 : room.z0 + off;
          if (plan.inRoom[plan.at(dx, dz)] !== room.id) continue;
          if (winFront.has(dx + ':' + dz) || keep.has(dx + ':' + dz)) continue;
          if (occ[oat(dx, dz, 1)] === 1) continue;
          furnStamp(S, model, hx + dx, floorY + 1, hz + dz, (side + 2) % 4);
          occ[oat(dx, dz, 1)] = 1;
          return true;
        }
      }
      return false;
    };

    const effLoneFigure = () => {
      /* PHASE 31 — ONE OF THE TWO PEOPLE IS NOT IN IT.

         The frame does not move. The wall does not move. The height does not move. The
         picture is re-hung in exactly the cell it already occupies, with the model whose
         only difference is that the second figure is not there.

         IT ONLY APPLIES TO A HOUSE THAT HANGS THE PHOTOGRAPH, and roughly a quarter of
         them do — which is the right rarity by construction rather than by a tuned
         number, and is why this returns false rather than substituting something else.
         A house with a mirror in the bedroom has nothing to lose a figure from.

         STORY.md section 22 forbids ever explaining why human imagery behaves like this,
         and nothing here does: it is a photograph, on a wall, in a house. */
      if (!motif || SUB_MOTIFS[motif.idx].model !== 'artFamily') return false;
      furnStamp(S, 'artFamilyAlone', hx + motif.dx, floorY + motif.y, hz + motif.dz, motif.face);
      return true;
    };

    /* The interior effects, and which stage effect id each one answers to. Two lists
       rather than one, because the ids are not contiguous — 3, 4 and 5 belong to the
       shell and the yard — and because the fallback chain below walks the LIST, so an
       effect that cannot apply hands over to its neighbour rather than to whichever id
       happens to be numerically next. */
    const interior = [effChair, effDoorway, effPicture, effLoneFigure];
    const INTERIOR_AT = { 0: 0, 1: 1, 2: 2, 6: 3 };
    for (let k = 1; k <= n; k++) {
      const e = this._subStageEffect(lot, k);
      // Effects 3, 4 and 5 are exterior; _subOpenings and _subYard have already applied
      // them by the time this runs, so there is nothing to do for them here.
      const start = INTERIOR_AT[e];
      if (start === undefined) continue;
      for (let t = 0; t < interior.length; t++) {
        if (interior[(start + t) % interior.length](k)) break;
      }
    }
  }
});
