"use strict";
/* =====================================================================================
   THE SHATTERED FARMLANDS — WHAT IT IS MADE OF
   ERA 1.5.3 — MOVED VERBATIM OUT OF VoxelWorld.

   Every Farmland structure's block composition: farmsteads, fields, boundaries, lanes
   and spurs, the water tower and the fallen tower, the great barn, the chapel, the
   graveyard, the deep well, the memorial, the great tree, the journey marks, and the
   Disconnected Home inside and out.

   The `_home*` helpers are here rather than in suburbia/ despite their prefix: every
   caller is a Farmlands method. They are Phase 20's Disconnected Home, not a suburb.

   Every method below is byte-identical to the text that was in game.html, comments and
   all. It is attached to VoxelWorld's prototype by registerWorldContent, which copies
   property descriptors so a moved method is indistinguishable from a declared one.
   See src/world/world-content.js and ARCHITECTURE.md.
   ===================================================================================== */

registerWorldContent('farmlands', 'stampers', class {

  /* ===================================================================================
     THE CHUNK GENERATOR

     Ground fill first, then the agricultural layer, then trees. Everything after the
     ground fill writes through the clipped setter, so a structure can never touch a
     chunk other than the one being generated and every chunk overlapping a feature
     stamps an identical portion of it in any load order.
     =================================================================================== */
  _genFarmlandsChunk(chunk) {
    this._farmBuildPlotList(chunk);     // PHASE 17 — before the heightfield touches it
    const C = this._farmCache(chunk);
    const W = C.W, H = C.H, S = C.S, B = C.B, WA = C.WA, D = C.D;
    const x0 = chunk.cx * CHUNK_SX, z0 = chunk.cz * CHUNK_SZ;
    const SLICE = CHUNK_SX * CHUNK_SZ;

    /* --- GROUND FILL. Bedrock-to-subsoil is a flat fill of the deepest common layer,
       which is much cheaper than a per-column loop over 64 cells and is exactly what
       _genSuburbiaChunk does. Only the top few blocks of each column vary. */
    const deepest = FARM_MIN_Y - 8;
    chunk.data.fill(BLOCK.STONE, 0, deepest * SLICE);

    for (let z = 0; z < CHUNK_SZ; z++) {
      for (let x = 0; x < CHUNK_SX; x++) {
        const k = (x + FARM_M) * W + (z + FARM_M);
        const h = H[k], surf = S[k], water = WA[k];
        const wx = x0 + x, wz = z0 + z;
        const ashen = B[k] > FARM_BIOME_T;

        for (let y = deepest; y < h - 4; y++) chunk.data[chunk.idx(x, y, z)] = BLOCK.STONE;
        for (let y = Math.max(deepest, h - 4); y < h - 1; y++) chunk.data[chunk.idx(x, y, z)] = BLOCK.ROTTED_SOIL;
        if (h - 1 >= 0) chunk.data[chunk.idx(x, h - 1, z)] = this._farmTopBlock(wx, wz, surf, ashen, D[k], B[k], C.DL[k]);
        /* PHASE 19 — DEPTH AS A BLOCK ID. One block of water is WADEABLE and gets the
           shallow id; two or three is swimmable and gets the deep one. Because the
           heightfield never steps by more than one block, a depth-2 cell is always
           reachable from a depth-1 cell, so every pool in the dimension carries its own
           shallow rim — which is the whole of the escape guarantee in requirement 30,
           built into the terrain rather than bolted onto the controller. */
        const depth = D[k];
        if (depth === 1) {
          chunk.data[chunk.idx(x, h, z)] = BLOCK.WATER_SHALLOW;
        } else {
          for (let y = h; y < water; y++) chunk.data[chunk.idx(x, y, z)] = BLOCK.WATER;
        }
        // Everything above is already AIR: chunk.data arrives zeroed.
      }
    }

    // --- The agricultural layer, then vegetation. Both scan the margin and clip.
    this._farmStampSurface(chunk, C);
    this._farmStampTrees(chunk, C);
    /* --- PHASE 19. The foreground layer runs AFTER the trees because half of what it
       does is decide where debris accumulates, and canopy overhead is one of the things
       it reads. Relics run after that and before the settlements, so a building always
       wins over an abandoned plough that happened to roll onto its footprint. */
    this._farmStampDetail(chunk, C);
    this._farmStampRelics(chunk, C);
    /* --- PHASE 17. Settlements and landmarks stamp AFTER the fields and trees so a
       building is never grown through, and BEFORE the Disconnected Home so nothing can
       ever overwrite Level 2 progression. Both scan a 3x3 neighbourhood of their own
       placement grid, because a plot near a parcel edge reaches into the next one. */
    this._farmStampSettlements(chunk);
    /* --- PHASE 19. The yard pass runs AFTER the buildings, not before, and this was
       measured rather than assumed: stamped first, 1,700 of its 1,900 writes were
       repainted by the farmstead's own yard fill and 110 tyre cells survived as zero.
       Running after means it can SEE the buildings — so it only ever recolours ground
       it recognises as open yard, and only ever puts a prop where there is air above
       open ground with no wall against it. That is what "leave believable working
       space" has to mean when the buildings are stamped by somebody else. */
    this._farmStampYards(chunk, C);
    /* --- PHASE 20. The journey's authored layer, and its order inside the pass is the
       whole of its integration story. It runs AFTER everything Phases 16-19 build, so a
       crop, a tree, a hedge, a relic or a farmyard can never grow through the water
       tower, the missing-farm evidence or the property — and it runs in the order the
       player meets it, so a later beat always wins over an earlier one where two
       overlap. Every one of these opens with a rectangle test that rejects essentially
       every chunk in an infinite region for the cost of four comparisons. */
    /* PHASE 20 REVISION — the landmark chain stamps in the order the player meets it,
       so where two authored beats ever overlap the later one wins. The great tree runs
       after the barn and before the missing-farm evidence because the dead land it owns
       reaches a hundred blocks and has to be able to overwrite ordinary field cover. */
    this._farmStampFallenTower(chunk);
    this._farmStampTower(chunk);
    this._farmStampJourneyBarn(chunk);
    this._farmStampGreatTree(chunk);
    this._farmStampJourneyMarks(chunk);
    this._farmStampApproach(chunk);
    /* PHASE 31 — after every Phase 16-20 pass so the yard vocabulary is laid on top of a
       finished farmyard, and BEFORE the Home so nothing this phase does can ever reach
       Level 2 progression. */
    this._envStoryStamp(chunk, 'farmlands');
    // --- The Disconnected Home last of all, so nothing can ever overwrite Level 2
    // progression — the same guarantee Phase 16 gave it, on a much larger structure.
    this._farmStampHome(chunk);
    this._farmPlotSteads = null; this._farmPlotLms = null; this._farmPlotMinors = null;
    this._farmPlotSigns = null;
  }

  /* Clipped voxel write, and the only way any Farmlands feature touches the world. Shares
     its contract with _subSet: chunk === null writes through to whichever loaded chunk
     owns the voxel, which the audit harness uses. */
  _farmSet(chunk, wx, wy, wz, id) {
    if (chunk === null) { this._writeBlockRaw(wx, wy, wz, id); return; }
    const x = wx - chunk.cx * CHUNK_SX, z = wz - chunk.cz * CHUNK_SZ;
    if (x < 0 || x >= CHUNK_SX || z < 0 || z >= CHUNK_SZ) return;
    if (wy < 0 || wy >= CHUNK_SY) return;
    chunk.data[chunk.idx(x, wy, z)] = id;
  }

  /* ===================================================================================
     THE AGRICULTURAL LAYER — crops, boundaries, drainage planting and field furniture.

     Runs over the chunk only (not the margin): everything it writes is a single column
     tall or one block wide, so nothing here can overhang into a neighbour. Trees, which
     can, get their own margin pass below.
     =================================================================================== */
  _farmStampSurface(chunk, C) {
    const W = C.W, H = C.H, S = C.S, B = C.B, WA = C.WA, D = C.D;
    const x0 = chunk.cx * CHUNK_SX, z0 = chunk.cz * CHUNK_SZ;

    for (let z = 0; z < CHUNK_SZ; z++) {
      for (let x = 0; x < CHUNK_SX; x++) {
        const k = (x + FARM_M) * W + (z + FARM_M);
        const wx = x0 + x, wz = z0 + z;
        if (this._farmInPad(wx, wz)) continue;      // arrival pad and home pad stay clear
        const h = H[k], surf = S[k], water = WA[k];
        if (h >= water && h >= CHUNK_SY - 1) continue;
        const ashen = B[k] > FARM_BIOME_T;
        const submerged = water > h;

        /* --- DRAINAGE PLANTING. Reeds are held to genuinely wet cells — the floor of a
           ditch, or the first block of a shallow margin — so they read as a waterline
           rather than as a texture sprayed over the dimension. A dry ditch lip gets
           tussock grass instead, which is what actually grows on a bank. */
        if (surf === FARM_SURF.DITCH || surf === FARM_SURF.DITCH_LIP || submerged) {
          if (submerged) {
            if (water - h <= 1 && this._farmHash(wx, wz, 59) < 0.22) {
              this._farmSet(chunk, wx, water, wz, BLOCK.REEDS);
            }
          } else if (surf === FARM_SURF.DITCH) {
            if (this._farmHash(wx, wz, 53) < 0.26) this._farmSet(chunk, wx, h, wz, BLOCK.REEDS);
          } else if (this._farmHash(wx, wz, 103) < 0.30) {
            this._farmSet(chunk, wx, h, wz, BLOCK.DRY_TUSSOCK);
          }
          continue;
        }

        // --- Verges: dry tussock grass, thicker beside a track than in the open.
        if (surf === FARM_SURF.VERGE) {
          if (this._farmHash(wx, wz, 61) < 0.34) {
            const rv = C.DL[k];
            this._farmSet(chunk, wx, h, wz,
              (rv > 0 && this._farmHash(wx, wz, 1009) < rv)
                ? (rv > 0.6 ? BLOCK.ROTTEN_STUBBLE : BLOCK.STICKS) : BLOCK.DRY_TUSSOCK);
          }
          continue;
        }
        if (surf === FARM_SURF.TRACK || surf === FARM_SURF.RUT) continue;

        // --- Field boundaries on unlaned parcel edges.
        if (surf === FARM_SURF.BOUNDARY) {
          this._farmStampBoundary(chunk, wx, h, wz);
          continue;
        }
        /* --- THE DEAD LAND THINS THE CROP BEFORE IT KILLS IT. The soil ramp alone is a
           colour change the player can walk over without registering; what actually
           reads is the standing vegetation getting shorter, then patchier, then gone,
           and finally being replaced by the rotten stubble that grows in its place. */
        const rot = C.DL[k];
        if (rot > 0) {
          if (this._farmHash(wx, wz, 979) < rot) {
            if (rot > 0.55 && this._farmHash(wx, wz, 983) < (rot - 0.55) * 0.9) {
              this._farmSet(chunk, wx, h, wz, BLOCK.ROTTEN_STUBBLE);
            }
            continue;
          }
        }
        if (ashen) continue;   // the Ashen Forest has no agriculture; trees handle it

        this._farmStampField(chunk, wx, h, wz, D[k]);
      }
    }
  }

  _farmStampBoundary(chunk, wx, h, wz) {
    if (this._farmHash(wx, wz, 67) < 0.14) return;    // gateways and collapses
    const bx = Math.floor(wx / FARM_P), bz = Math.floor(wz / FARM_P);
    const p = this._farmParcel(bx, bz);
    /* Which way does this run? A boundary cell is either on the parcel's own N-S edge
       (u === 0) or on the inner edge of a north-south lane setback (u === FARM_MARGIN-1);
       both run along Z. Anything else runs along X. */
    /* PHASE 18.1 — the hedge sits at FARM_MARGIN-1 from the MEANDERED centreline, and the
       centreline may now be up to FARM_ROUTE_A off its grid line, so the orientation test
       has to resolve the same nearest-lane distance the surface function did. Deriving it
       from the raw parcel offset instead would flip the hedgerow's axis wherever the road
       had wandered, which shows as a hedge that turns ninety degrees for a few cells. */
    const u = wx - bx * FARM_P;
    let ad = 1e9;
    if (this._farmLaneX(bx)) ad = Math.abs(u - this._farmRouteX(bx, wz));
    if (u >= FARM_P - FARM_ROUTE_REACH && this._farmLaneX(bx + 1)) {
      const d2 = Math.abs(u - FARM_P - this._farmRouteX(bx + 1, wz));
      if (d2 < ad) ad = d2;
    }
    const alongZ = (u === 0) || (Math.round(ad) === FARM_MARGIN - 1);
    if (p.wall) {
      this._farmSet(chunk, wx, h, wz, alongZ ? BLOCK.FARM_STONE_Z : BLOCK.FARM_STONE_X);
      return;
    }
    if (p.kind === FARM_FIELD.PASTURE || p.kind === FARM_FIELD.ORCHARD ||
        p.kind === FARM_FIELD.DEAD || p.kind === FARM_FIELD.STUBBLE) {
      /* Post-and-rail: a post every fourth cell, rails between — now in one of six
         conditions. PHASE 19 also extends fencing to dead and stubble fields, which
         Phase 16 left to hedgerow alone: an abandoned arable field with a collapsed
         fence around it is one of the strongest single images the brief asks for, and
         it cannot exist if only pastures are ever fenced. */
      const t = alongZ ? wz : wx;
      const st = this._farmFieldState(bx, bz);
      const cond = this._farmFenceState(alongZ, wx, wz, bx, bz, st);
      const post = (t & 3) === 0;
      switch (cond) {
        case 0:   // maintained
          this._farmSet(chunk, wx, h, wz, post ? BLOCK.FENCE_POST
                        : (alongZ ? BLOCK.FARM_FENCE_Z : BLOCK.FARM_FENCE_X));
          break;
        case 1:   // weathered — same fence, forty years unpainted
          this._farmSet(chunk, wx, h, wz, post ? BLOCK.FENCE_POST
                        : (alongZ ? BLOCK.FENCE_OLD_Z : BLOCK.FENCE_OLD_X));
          break;
        case 2:   // leaning
          this._farmSet(chunk, wx, h, wz, post ? BLOCK.POST_BROKEN
                        : (alongZ ? BLOCK.FENCE_LEAN_Z : BLOCK.FENCE_LEAN_X));
          break;
        case 3:   // collapsed — rails on the ground, the odd post still standing
          if (post) this._farmSet(chunk, wx, h, wz, BLOCK.POST_BROKEN);
          else if (this._farmHash(wx, wz, 159) < 0.7) {
            this._farmSet(chunk, wx, h, wz, alongZ ? BLOCK.FENCE_BROKEN_Z : BLOCK.FENCE_BROKEN_X);
          }
          break;
        case 4:   // missing section — nothing but the line it used to follow
          if (post && this._farmHash(wx, wz, 161) < 0.30) {
            this._farmSet(chunk, wx, h, wz, BLOCK.POST_BROKEN);
          }
          break;
        default: { // mismatched repair: new rails spliced into old
          const patched = this._farmHash(Math.floor(t / 3), alongZ ? bx : bz, 163) < 0.45;
          this._farmSet(chunk, wx, h, wz, post ? BLOCK.FENCE_POST
                        : patched ? (alongZ ? BLOCK.FARM_FENCE_Z : BLOCK.FARM_FENCE_X)
                                  : (alongZ ? BLOCK.FENCE_OLD_Z : BLOCK.FENCE_OLD_X));
          break;
        }
      }
      /* Weeds take a neglected fence line back. Only on the worse conditions, and only
         about one cell in six, so it reads as encroachment and not as a hedge. */
      if (cond >= 2 && this._farmHash(wx, wz, 167) < 0.16) {
        this._farmSet(chunk, wx, h + (cond === 2 ? 1 : 0), wz, BLOCK.WEED_CLUMP);
      }
      return;
    }
    this._farmSet(chunk, wx, h, wz, BLOCK.HEDGEROW);
    if (this._farmHash(wx, wz, 71) < 0.35) this._farmSet(chunk, wx, h + 1, wz, BLOCK.HEDGEROW);
  }

  /* THE FIELD INTERIOR. Rows are the whole point: a crop field is written on a fixed
     pitch along the parcel's work axis so it reads as planted rather than scattered,
     and the pitch is per-parcel so adjacent fields do not line up. */
  _farmStampField(chunk, wx, h, wz, depth) {
    /* PHASE 19 — REQUIREMENT 34, AND IT IS AN ABSOLUTE.

       "Crops must NEVER generate underwater." The surface pass already returns early on
       a submerged column, so this is the second of two independent guards, and it is
       here rather than only there because this function is the ONLY thing in the engine
       that writes a crop: anything that ever calls it — today's caller, a future one, a
       dev command — inherits the protection. The audit asserts the invariant directly
       over a full census rather than trusting either guard. */
    if (depth > 0) return;

    const bx = Math.floor(wx / FARM_P), bz = Math.floor(wz / FARM_P);
    const p = this._farmParcel(bx, bz);
    const row = p.alongX ? wz : wx;
    const onRow = ((row % p.spacing) + p.spacing) % p.spacing === 0;
    const r = this._farmHash(wx, wz, 73);
    const st = this._farmFieldState(bx, bz);

    /* PATCHY FAILURE, on a four-block lattice. A field that died evenly did not die of
       anything a farmer would recognise; real failure comes in blotches — a wet corner,
       a thin ridge, a strip the drill missed. `patch` is that blotch field, and states
       3 and 5 lean on it hardest. */
    const patch = this._farmHash(wx >> 2, wz >> 2, 151);
    /* BROKEN ROWS. Whole rows missing, keyed on the row index alone so the gap runs the
       length of the field the way an abandoned drill row actually does. */
    const rowGone = this._farmHash(row, p.alongX ? bx : bz, 153) < (st === 4 ? 0.38 : 0.10);

    switch (p.kind) {
      case FARM_FIELD.CROP: {
        /* The eight field states, expressed as what survives and in what form. Density
           and BLOCK both move: a dried field is standing withered stalk, a flattened one
           is laid over, an overgrown one is more weed than crop, a reclaimed one is
           barely distinguishable from fallow. */
        if (rowGone && st >= 3) { if (r > 0.985) this._farmSet(chunk, wx, h, wz, BLOCK.STUBBLE); break; }
        const dens = [0.86, 0.80, 0.74, 0.62, 0.58, 0.34, 0.52, 0.20][st];
        const failed = (st === 3 || st === 5) && patch < 0.42;
        if (onRow && !failed && r < dens) {
          let id;
          if (st === 0) id = r < 0.55 ? BLOCK.CROP_TALL : BLOCK.WITHERED_CROP;
          else if (st === 1) id = r < 0.22 ? BLOCK.CROP_TALL : BLOCK.WITHERED_CROP;
          else if (st === 2) id = r < 0.68 ? BLOCK.CROP_FLAT : BLOCK.WITHERED_CROP;
          else if (st === 6) id = r < 0.40 ? BLOCK.WEED_CLUMP : BLOCK.WITHERED_CROP;
          else if (st === 7) id = r < 0.55 ? BLOCK.WEED_CLUMP : BLOCK.STUBBLE;
          else id = r < 0.30 ? BLOCK.CROP_TALL : (r < 0.80 ? BLOCK.WITHERED_CROP : BLOCK.CROP_FLAT);
          this._farmSet(chunk, wx, h, wz, id);
        } else if (failed && r > 0.90) {
          this._farmSet(chunk, wx, h, wz, r > 0.97 ? BLOCK.CROP_FLAT : BLOCK.STUBBLE);
        } else if (r > 0.975) {
          this._farmSet(chunk, wx, h, wz, st >= 6 ? BLOCK.WEED_CLUMP : BLOCK.STUBBLE);
        }
        break;
      }
      case FARM_FIELD.FLOODED:
        /* A waterlogged field. The water itself is in the furrows a block down (see the
           local table in _farmCache); this is what stands out of it on the dry ridges,
           which is why the guard at the top of the function does not suppress it — those
           columns genuinely are dry. */
        if (onRow) this._farmSet(chunk, wx, h, wz, r < 0.55 ? BLOCK.REEDS : BLOCK.WITHERED_CROP);
        else if (r > 0.94) this._farmSet(chunk, wx, h, wz, BLOCK.WEED_CLUMP);
        break;
      case FARM_FIELD.STUBBLE:
        if (rowGone) { if (r > 0.99) this._farmSet(chunk, wx, h, wz, BLOCK.WEED_CLUMP); break; }
        if (onRow && r < (st >= 5 ? 0.42 : 0.70)) this._farmSet(chunk, wx, h, wz, BLOCK.STUBBLE);
        else if (r > 0.9985) this._farmSet(chunk, wx, h, wz, BLOCK.HAY_BALE);
        else if (st >= 6 && r > 0.97) this._farmSet(chunk, wx, h, wz, BLOCK.WEED_CLUMP);
        break;
      case FARM_FIELD.DEAD:
        /* Ordering matters and was wrong once: with the stubble test written first as
           r > 0.94, the sapling test at r > 0.9975 was strictly subsumed by it and could
           never fire — the wide census reported exactly zero saplings in 614,656
           columns, which is what caught it. The rarer test goes first.

           PHASE 19 — the reclaimed end of the state range puts weed into a dead field,
           which is what "severely reclaimed" looks like at ground level. */
        if (r > 0.9975) this._farmSet(chunk, wx, h, wz, BLOCK.DEAD_SAPLING);
        else if (st >= 6 && patch > 0.55 && r > 0.86) this._farmSet(chunk, wx, h, wz, BLOCK.WEED_CLUMP);
        else if (r > 0.94) this._farmSet(chunk, wx, h, wz, BLOCK.STUBBLE);
        break;
      case FARM_FIELD.PASTURE:
        if (r < 0.30) this._farmSet(chunk, wx, h, wz, BLOCK.DRY_TUSSOCK);
        else if (r > 0.9990) this._farmSet(chunk, wx, h, wz, BLOCK.TROUGH);
        break;
      case FARM_FIELD.ORCHARD:
        if (r < 0.10) this._farmSet(chunk, wx, h, wz, BLOCK.DRY_TUSSOCK);
        break;
      default:
        if (r < 0.12) this._farmSet(chunk, wx, h, wz, BLOCK.DRY_TUSSOCK);
        break;
    }

    /* THE SCARECROW. One per crop parcel at most, on a hashed cell well inside the
       field. Rare on purpose: it is a landmark, and a landmark that appears every fifty
       blocks is scenery. */
    if (p.kind === FARM_FIELD.CROP) {
      const u = wx - bx * FARM_P, v = wz - bz * FARM_P;
      const su = 16 + Math.floor(this._farmHash(bx, bz, 79) * 32);
      const sv = 16 + Math.floor(this._farmHash(bx, bz, 83) * 32);
      if (u === su && v === sv) this._farmSet(chunk, wx, h, wz, BLOCK.SCARECROW);
    }
  }

  /* ===================================================================================
     TREES — the Ashen Forest, scattered copses inside the Rotting Fields, and orchards.

     Scans a margin because a canopy reaches two cells out and a trunk six up, and every
     chunk the canopy touches must stamp an identical portion of it. The tree SHAPE is
     the historical one, unchanged: an ASH_WOOD trunk four to six tall carrying a
     BLACK_CANOPY diamond of radius two. Continuity with the pocket matters more here
     than novelty — the Ashen Forest is a named, established place.
     =================================================================================== */
  _farmStampTrees(chunk, C) {
    const W = C.W, H = C.H, S = C.S, B = C.B, WA = C.WA;
    const x0 = chunk.cx * CHUNK_SX - FARM_M, z0 = chunk.cz * CHUNK_SZ - FARM_M;

    for (let i = 0; i < W; i++) {
      for (let j = 0; j < W; j++) {
        const k = i * W + j;
        const wx = x0 + i, wz = z0 + j;
        const surf = S[k];
        // Nothing grows on a track, a verge, a ditch or a pad — a lane the trees have
        // closed over is not a lane.
        if (surf !== FARM_SURF.FIELD) continue;
        if (this._farmInPad(wx, wz)) continue;
        const h = H[k];
        if (WA[k] > h) continue;                    // no trees standing in water
        /* PHASE 20 REVISION — NOTHING ELSE GROWS IN THE DEAD LAND, and that is what
           gives the great tree its scale. The keep-out already stops buildings; this
           stops the Ashen Forest and the orchards, so the only thing standing anywhere
           inside a two-hundred-block circle is the tree itself. The outer half of the
           ramp thins the canopy rather than clearing it, so the woodland retreats from
           the tree instead of stopping at a rim. */
        const deadT = C.DL[k];
        if (deadT > 0) {
          /* THE ODDS ARE THE RAMP, SCALED. Measured against the same seeds with no dead
             land at all, a 2.4 multiplier left the ring between sixty and ninety blocks
             carrying two thirds of its ordinary canopy — the woodland stopped at the rot
             radius instead of retreating from the tree, and from the north-east the crown
             had a tree line at its own eye level to be ranked against. At 3.2 the inner
             ring is bare, the middle is a scatter, and the edge is untouched. */
          if (this._farmHash(wx, wz, 991) < deadT * 3.2) {
            // A burnt snag survives here and there, which is what a dying wood looks like.
            if (deadT > 0.2 && deadT < 0.8 && this._farmHash(wx, wz, 993) < 0.004) {
              this._farmSet(chunk, wx, h, wz, BLOCK.BURNT_STUMP);
            }
            continue;
          }
        }

        const b = B[k];
        const bx = Math.floor(wx / FARM_P), bz = Math.floor(wz / FARM_P);

        /* ORCHARDS are planted, so they are a lattice rather than a scatter: a tree on a
           fixed pitch with a hashed jitter of one cell, which is exactly how a real
           orchard reads from inside — rows that line up along one axis and not the
           other.

           PHASE 19 — AN ORCHARD IS NOW A RUIN OF AN ORCHARD. The lattice survives, which
           is the whole point (requirement 9 asks that it still read as former
           agriculture), but the positions on it do not all still carry a tree: some are
           empty, some carry a dead snag with no canopy, some carry a trunk lying where
           it fell. What the player sees is a grid with holes in it, which is far more
           legible as an abandoned orchard than a full grid ever was — a complete lattice
           reads as maintained. */
        if (b <= FARM_BIOME_T) {
          const p = this._farmParcel(bx, bz);
          if (p.kind === FARM_FIELD.ORCHARD) {
            if (this._farmStructPadAt(wx, wz) >= 0) continue;
            const u = wx - bx * FARM_P, v = wz - bz * FARM_P;
            const st = this._farmFieldState(bx, bz);
            if (u % 6 === 2 && v % 6 === 2 && u >= FARM_MARGIN && v >= FARM_MARGIN) {
              const r = this._farmHash(wx, wz, 173);
              const gone = 0.06 + st * 0.045;          // missing positions grow with decay
              if (r < gone) {
                // An empty position: the stump is usually all that is left of it.
                if (r < gone * 0.45) this._farmSet(chunk, wx, h, wz, BLOCK.BURNT_STUMP);
              } else if (r < gone + 0.14) {
                // A dead standing tree — trunk and a bare branch, no canopy at all.
                const th = 3 + Math.floor(this._farmHash(wx, wz, 89) * 2);
                for (let ty = 0; ty < th; ty++) this._farmSet(chunk, wx, h + ty, wz, BLOCK.ASH_WOOD);
                this._farmSet(chunk, wx, h + th, wz, BLOCK.CHARRED_BRANCH);
              } else if (r < gone + 0.20) {
                // A fallen tree, lying along the row it was planted in.
                this._farmSet(chunk, wx, h, wz, BLOCK.BURNT_STUMP);
                const ax = this._farmHash(wx, wz, 179) < 0.5;
                for (let i = 1; i <= 2; i++) {
                  this._farmSet(chunk, wx + (ax ? i : 0), h, wz + (ax ? 0 : i),
                                ax ? BLOCK.DEADWOOD_X : BLOCK.DEADWOOD_Z);
                }
              } else {
                this._farmTree(chunk, wx, h, wz, 3 + Math.floor(this._farmHash(wx, wz, 89) * 2),
                               1, BLOCK.ORCHARD_CANOPY);
              }
            } else if ((u % 6 === 5 || v % 6 === 5) && st >= 4 &&
                       this._farmHash(wx, wz, 181) < 0.10) {
              /* Encroachment BETWEEN the rows, never on them: the mown lane down the
                 middle of an orchard is the last thing to go, so keeping u%6===2 clear
                 of weed is what preserves the row logic the brief asks for. */
              this._farmSet(chunk, wx, h, wz, BLOCK.WEED_CLUMP);
            }
            continue;
          }
        }

        /* DENSITY RAMPS ACROSS THE BIOME BOUNDARY rather than snapping. Deep Ashen
           Forest is dense; the edge thins into scattered stands; the Rotting Fields keep
           a low background rate that produces the scattered copses the brief asks for,
           concentrated by the same noise so they clump instead of speckling. */
        let density;
        if (b > FARM_BIOME_T + FARM_BIOME_EDGE) density = 0.055;
        else if (b > FARM_BIOME_T) density = 0.055 * ((b - FARM_BIOME_T) / FARM_BIOME_EDGE) + 0.004;
        else if (b > FARM_BIOME_T - FARM_BIOME_EDGE) density = 0.012;
        else density = 0.0025;

        /* PHASE 19 — CLEARINGS AND STRANGE SPACING (requirement 14).

           A forest at one uniform density is a texture. Two sixteen-block lattices break
           it: one opens CLEARINGS where density collapses to almost nothing, the other
           THICKENS stands where it nearly doubles. Because both are lattices rather than
           smooth noise their edges are abrupt, and that is deliberate — the brief asks
           for irregular, faintly wrong spacing rather than a natural-looking forest, and
           a stand that stops dead at a line is exactly that. */
        const ashen = b > FARM_BIOME_T;
        if (ashen) {
          const cell = this._farmHash(wx >> 4, wz >> 4, 191);
          if (cell < 0.16) density *= 0.10;            // a clearing
          else if (cell > 0.86) density *= 1.85;       // a thicket
        }

        /* PHASE 19 — NO TREES ON A LEVELLED PLOT. Phase 16 excluded the arrival and
           home pads but not the structure pads Phase 17 introduced, so copses grew
           straight through farmyards: an aerial survey of one stead found its barn,
           house and silo under continuous canopy, which destroys both the farmyard's
           working space (requirement 8) and the barn silhouette a player navigates by
           (requirements 21 and 22). The test is made only where a tree is actually
           about to be planted, and the four probes at +/-3 keep a radius-2 canopy from
           overhanging the yard from just outside it. */
        if (this._farmHash(wx, wz, 97) >= density) {
          /* THE ASHEN FLOOR. Everything that is not a tree: stumps, deadfall, broken
             branches and drifted ash. This is what makes the forest read as damaged
             rather than merely dark, and it is gated on the biome value rather than on
             the threshold so a little of it leaks out past the edge with the ash. */
          if (b > FARM_BIOME_T - FARM_BIOME_EDGE * 0.5 && WA[k] <= h) {
            const g = this._farmHash(wx, wz, 193);
            const near = ashen ? 1 : 0.35;
            if (g < 0.012 * near) this._farmSet(chunk, wx, h, wz, BLOCK.BURNT_STUMP);
            else if (g < 0.024 * near) {
              const ax = this._farmHash(wx, wz, 197) < 0.5;
              this._farmSet(chunk, wx, h, wz, ax ? BLOCK.DEADWOOD_X : BLOCK.DEADWOOD_Z);
              if (this._farmHash(wx, wz, 199) < 0.55) {
                this._farmSet(chunk, wx + (ax ? 1 : 0), h, wz + (ax ? 0 : 1),
                              ax ? BLOCK.DEADWOOD_X : BLOCK.DEADWOOD_Z);
              }
            } else if (g < 0.050 * near) this._farmSet(chunk, wx, h, wz, BLOCK.CHARRED_BRANCH);
            else if (g < 0.11 * near) this._farmSet(chunk, wx, h, wz, BLOCK.ASH_DRIFT);
            else if (ashen && g < 0.135) this._farmSet(chunk, wx, h, wz, BLOCK.DRY_TUSSOCK);
          }
          continue;
        }
        if (this._farmStructPadAt(wx, wz) >= 0 ||
            this._farmStructPadAt(wx + 3, wz) >= 0 || this._farmStructPadAt(wx - 3, wz) >= 0 ||
            this._farmStructPadAt(wx, wz + 3) >= 0 || this._farmStructPadAt(wx, wz - 3) >= 0) continue;
        const th = 4 + Math.floor(this._farmHash(wx, wz, 101) * 3);
        /* SPARSE CANOPY. About one ashen tree in five is a bare snag and one in six
           carries only a minimal crown, so the canopy overhead breaks up and light
           reaches the floor in patches — which is what a burnt woodland looks like and
           what makes the surviving full canopies read as survivors. */
        const form = this._farmHash(wx, wz, 201);
        if (ashen && form < 0.19) {
          for (let ty = 0; ty < th; ty++) this._farmSet(chunk, wx, h + ty, wz, BLOCK.ASH_WOOD);
          this._farmSet(chunk, wx, h + th, wz, BLOCK.CHARRED_BRANCH);
        } else {
          this._farmTree(chunk, wx, h, wz, th, (ashen && form < 0.35) ? 1 : 2, BLOCK.BLACK_CANOPY);
        }
      }
    }
  }

  /* ===================================================================================
     PHASE 19 — THE FOREGROUND LAYER

     THIS IS THE PASS MOST LIKELY TO RUIN THE DIMENSION, and it is written defensively
     because of it. Requirement 1 asks for local texture; requirement 20 asks for
     emptiness; requirement 44 asks that every prop answer "why is this here". Those
     three together rule out the obvious implementation — a hash per column against a
     density — because that produces confetti: evenly distributed, reasonless, and
     everywhere.

     So nothing here is placed on its own probability. Every piece needs an ANCHOR: a
     boundary to drift against, a track to be kicked to the side of, water to be muddy
     beside, a canopy to fall from, a dead field to be the wreck of. The anchors are read
     out of the column cache the passes above already filled, so the whole layer costs
     four array lookups and a hash per column and allocates nothing.

     And a third of parcels are QUIET (see _farmQuiet) — they take none of it. That is
     what keeps the horizons the brief asks for.
     =================================================================================== */
  _farmStampDetail(chunk, C) {
    const W = C.W, H = C.H, S = C.S, B = C.B, WA = C.WA, D = C.D, L = C.L;
    const x0 = chunk.cx * CHUNK_SX, z0 = chunk.cz * CHUNK_SZ;

    for (let z = 0; z < CHUNK_SZ; z++) {
      for (let x = 0; x < CHUNK_SX; x++) {
        const k = (x + FARM_M) * W + (z + FARM_M);
        const wx = x0 + x, wz = z0 + z;
        if (this._farmInPad(wx, wz)) continue;
        const h = H[k], surf = S[k], depth = D[k];
        if (h < 1 || h >= CHUNK_SY - 2) continue;

        // Neighbour reads. The margin is FARM_M cells wide, so +/-2 is always in range.
        const kN = k - W, kS = k + W, kE = k + 1, kWs = k - 1;
        const nWater = D[kN] || D[kS] || D[kE] || D[kWs];
        const nBound = S[kN] === FARM_SURF.BOUNDARY || S[kS] === FARM_SURF.BOUNDARY ||
                       S[kE] === FARM_SURF.BOUNDARY || S[kWs] === FARM_SURF.BOUNDARY;
        const nTrack = S[kN] === FARM_SURF.TRACK || S[kS] === FARM_SURF.TRACK ||
                       S[kE] === FARM_SURF.TRACK || S[kWs] === FARM_SURF.TRACK ||
                       S[kN] === FARM_SURF.RUT || S[kS] === FARM_SURF.RUT ||
                       S[kE] === FARM_SURF.RUT || S[kWs] === FARM_SURF.RUT;

        /* --- WET GROUND AROUND WATER. The dry side of a shoreline is damp, then muddy
           at the very edge, which is the outer half of the grass -> dirt -> mud -> water
           gradient requirement 31 asks for (the inner half is in _farmTopBlock). It is
           written as a ground swap rather than as decor so it costs nothing and cannot
           be walked through. */
        if (!depth && nWater) {
          const q = this._farmHash(wx, wz, 211);
          if (q < 0.55 && surf !== FARM_SURF.TRACK && surf !== FARM_SURF.RUT) {
            this._farmSet(chunk, wx, h - 1, wz, q < 0.30 ? BLOCK.FARM_MUD : BLOCK.SOIL_WET);
          }
          if (this._farmGet(chunk, wx, h, wz) === BLOCK.AIR && q > 0.72 && q < 0.86) {
            this._farmSet(chunk, wx, h, wz, BLOCK.REEDS);
          }
        }

        /* --- THE ROAD CORRIDOR: wheel lines, poles, culverts, markers. Only the ~10% of
           columns that are actually road corridor pay for the lane lookup. */
        if (surf === FARM_SURF.TRACK || surf === FARM_SURF.RUT || surf === FARM_SURF.VERGE) {
          const li = this._farmLaneInfo(wx, wz);
          if (li) {
            const ad = Math.abs(li.d), rd = Math.round(ad);
            /* PAIRED WHEEL LINES. Two darker ruts either side of the crown, which is
               what a cart track worn by vehicles actually looks like from above and the
               cheapest possible way to say "things drove here" (requirement 12). It is a
               ground tile swap: no geometry, no decor, no collision. */
            if (surf === FARM_SURF.TRACK && rd === 1) {
              this._farmSet(chunk, wx, h - 1, wz, BLOCK.TIRE_TRACK);
            }
            /* UTILITY POLES, one side of the lane only, on a fixed fifteen-block pitch.
               The regularity is the point: a line of poles marching away IS the implied
               wire run, and it gives a dead-flat dimension a vertical rhythm to steer
               by (requirements 17 and 22). */
            if (surf === FARM_SURF.VERGE && li.d < 0 && rd === FARM_MARGIN - 2 &&
                ((li.t % 15) + 15) % 15 === 0 && depth === 0) {
              this._farmSet(chunk, wx, h, wz, BLOCK.UTILITY_POLE);
              this._farmSet(chunk, wx, h + 1, wz, BLOCK.UTILITY_POLE);
              this._farmSet(chunk, wx, h + 2, wz, BLOCK.POLE_ARM);
            }
            /* CULVERT MOUTHS, and this is the piece that ties the road system to the
               water system. L[k] is non-zero only where the carriageway had to be
               raised out of the water table — i.e. exactly where a real road would need
               a pipe under it — so the culvert can never appear anywhere it would be
               meaningless. */
            else if (L[k] > 0 && surf === FARM_SURF.VERGE && rd === FARM_LANE_HALF + 1 &&
                     depth === 0 && this._farmGet(chunk, wx, h, wz) === BLOCK.AIR) {
              this._farmSet(chunk, wx, h, wz, li.axis === 0 ? BLOCK.CULVERT_X : BLOCK.CULVERT_Z);
            }
            /* A BOUNDARY STONE beside the lane — rare, fixed, and the kind of thing a
               player remembers a place by. Sited on a 37-block pitch along the run (a
               prime, so it never falls into step with the 15-block pole pitch and the
               two never stack into a rhythm) and then thinned by a hash, so most
               candidate positions carry nothing at all. */
            else if (surf === FARM_SURF.VERGE && rd >= 2 && rd <= FARM_MARGIN - 2 &&
                     ((li.t % 37) + 37) % 37 === 0 && depth === 0 &&
                     this._farmHash(li.line, Math.floor(li.t / 37), 223) < 0.30 &&
                     this._farmGet(chunk, wx, h, wz) === BLOCK.AIR) {
              this._farmSet(chunk, wx, h, wz, BLOCK.MARKER_STONE);
            }
          }
          // Stones kicked to the edge of a track. Restrained, and only on the verge.
          if (surf === FARM_SURF.VERGE && this._farmGet(chunk, wx, h, wz) === BLOCK.AIR &&
              this._farmHash(wx, wz, 227) < 0.06) {
            this._farmSet(chunk, wx, h, wz, BLOCK.SMALL_STONES);
          }
          continue;
        }

        if (surf !== FARM_SURF.FIELD || depth > 0) continue;
        const bx = Math.floor(wx / FARM_P), bz = Math.floor(wz / FARM_P);
        if (this._farmQuiet(bx, bz)) continue;              // a deliberately empty field
        if (this._farmGet(chunk, wx, h, wz) !== BLOCK.AIR) continue;   // never overwrite

        const r = this._farmHash(wx, wz, 229);
        const ashen = B[k] > FARM_BIOME_T;
        let placed = false;

        /* PHASE 20 REVISION — LIVING GROUND COVER DOES NOT GROW IN THE DEAD LAND. The
           soil, the crops and the woodland all retreat from the great tree; the Phase 19
           foreground layer did not, so a census of the ring forty blocks out found dry
           tussock grass and weed clumps standing on rotten ground. `deadCover` swaps a
           living piece of cover for a dead one at odds that follow the ramp, so the
           substitution fades in with everything else instead of switching at a radius. */
        const rotHere = C.DL[k];
        const deadCover = (live) => {
          if (rotHere <= 0) return live;
          if (live !== BLOCK.WEED_CLUMP && live !== BLOCK.DRY_TUSSOCK) return live;
          if (this._farmHash(wx, wz, 1009) >= rotHere) return live;
          return rotHere > 0.6 ? BLOCK.ROTTEN_STUBBLE : BLOCK.STICKS;
        };

        /* --- ACCUMULATION. Each branch below is an anchor plus a low rate, and the
           anchors are ordered by how strong a reason they are. Debris against a fence is
           the strongest — that is where wind actually puts it — so it goes first and
           takes the highest rate; open field is last and takes almost nothing. */
        if (nBound && r < 0.20) {
          this._farmSet(chunk, wx, h, wz, deadCover(r < 0.07 ? BLOCK.WEED_CLUMP
                        : r < 0.13 ? BLOCK.LEAF_LITTER : BLOCK.STICKS));
          placed = true;
        } else if (nTrack && r < 0.10) {
          this._farmSet(chunk, wx, h, wz, deadCover(r < 0.05 ? BLOCK.SMALL_STONES : BLOCK.DRY_TUSSOCK));
          placed = true;
        } else if (this._farmGet(chunk, wx, h + 2, wz) !== BLOCK.AIR && r < 0.26) {
          // Under a canopy: leaf drift and fallen twigs, which is where they come from.
          this._farmSet(chunk, wx, h, wz, r < 0.14 ? BLOCK.LEAF_LITTER
                        : (ashen ? BLOCK.CHARRED_BRANCH : BLOCK.STICKS));
          placed = true;
        } else if (r < 0.014) {
          /* Open field. One cell in seventy, and biased by what the field IS: a wrecked
             arable field sheds broken crop and the odd board, a pasture sheds nothing
             much at all. */
          const p = this._farmParcel(bx, bz);
          const st = this._farmFieldState(bx, bz);
          if (p.kind === FARM_FIELD.DEAD || p.kind === FARM_FIELD.CROP) {
            this._farmSet(chunk, wx, h, wz, deadCover(st >= 5 ? BLOCK.WEED_CLUMP
                          : (r < 0.006 ? BLOCK.BROKEN_WOOD : BLOCK.CROP_FLAT)));
            placed = true;
          } else if (r < 0.005) {
            this._farmSet(chunk, wx, h, wz, BLOCK.SMALL_STONES);
            placed = true;
          }
        }

        /* --- PUDDLES. A puddle is not decor and is not random: it is a column that is a
           genuine local minimum with a wet neighbourhood, which is the same rule the
           water table uses one scale up. That is why they appear in the hollows of a
           rutted yard and the low corner of a field and nowhere else. */
        if (depth === 0 && !nWater && !placed &&
            h <= H[kN] && h <= H[kS] && h <= H[kE] && h <= H[kWs] &&
            (h < H[kN] || h < H[kS] || h < H[kE] || h < H[kWs]) &&
            this._farmHash(wx, wz, 233) < 0.22) {
          this._farmSet(chunk, wx, h - 1, wz, BLOCK.FARM_MUD);
          this._farmSet(chunk, wx, h, wz, BLOCK.WATER_SHALLOW);
        }
      }
    }
  }

  _farmStampYards(chunk, C) {
    const x0 = chunk.cx * CHUNK_SX, z0 = chunk.cz * CHUNK_SZ;
    const b0 = Math.floor((x0 - FARM_STEAD_W) / FARM_P), b1 = Math.floor((x0 + CHUNK_SX) / FARM_P);
    const c0 = Math.floor((z0 - FARM_STEAD_D) / FARM_P), c1 = Math.floor((z0 + CHUNK_SZ) / FARM_P);

    for (let bx = b0; bx <= b1; bx++) {
      for (let bz = c0; bz <= c1; bz++) {
        const st = this._farmSteadAt(bx, bz);
        if (!st) continue;
        const ax = Math.max(x0, st.ox), bxx = Math.min(x0 + CHUNK_SX - 1, st.x1 - 1);
        const az = Math.max(z0, st.oz), bzz = Math.min(z0 + CHUNK_SZ - 1, st.z1 - 1);
        if (ax > bxx || az > bzz) continue;
        const cx = (st.ox + st.x1) * 0.5, cz = (st.oz + st.z1) * 0.5;
        const rx = (st.x1 - st.ox) * 0.5, rz = (st.z1 - st.oz) * 0.5;
        /* DECAY DRIVES THE WHOLE YARD. A working farm's yard is beaten bare; a derelict
           one has weed coming up through it. Same three-state ground, different radii —
           which is requirement 19's "not every farm is equally destroyed" expressed in
           the one channel a player reads first, the floor. */
        const bare = 0.42 + (3 - st.decay) * 0.09;
        const trod = bare + 0.30;

        for (let wx = ax; wx <= bxx; wx++) {
          for (let wz = az; wz <= bzz; wz++) {
            const h = this._farmStructPadAt(wx, wz);
            if (h < 0) continue;                       // outside the levelled plot
            const nx = (wx + 0.5 - cx) / rx, nz = (wz + 0.5 - cz) / rz;
            const d = Math.sqrt(nx * nx + nz * nz);
            if (d > 1.02) continue;
            /* OPEN GROUND ONLY. A building floor, a footing, a doorstep or a stamped
               driveway is not yard, and repainting one would put mud through a barn. */
            if (!FARM_YARD_GROUND.has(this._farmGet(chunk, wx, h - 1, wz))) continue;
            const q = this._farmHash(wx, wz, 263);

            // --- Ground. Compacted centre, trodden mud band, weedy perimeter.
            let ground;
            if (d < bare) ground = q < 0.18 ? BLOCK.FARM_MUD : BLOCK.SOIL_TRAMPLED;
            else if (d < trod) ground = q < 0.34 ? BLOCK.SOIL_TRAMPLED
                              : (q < 0.48 ? BLOCK.FARM_MUD : BLOCK.SOIL_DRY);
            else ground = q < 0.40 ? BLOCK.SOIL_OVERGROWN : BLOCK.SOIL_DRY;
            this._farmSet(chunk, wx, h - 1, wz, ground);

            if (this._farmGet(chunk, wx, h, wz) !== BLOCK.AIR) continue;

            /* --- TYRE TRACKS. A single pair of ruts running the depth of the yard on
               the face the buildings look out of, which is the line every vehicle that
               ever used this place drove along. Two cells wide, gapped, so it reads as
               wheels rather than as a road. */
            /* The wheel line runs down ONE SIDE of the yard rather than through the
               middle of it. Through the middle is where the buildings are, so a central
               track was simply stamped over and vanished — measured, zero tyre cells
               survived in a yard. Offset to 55% of the yard's half-width it runs across
               the open working ground, which is also where a real vehicle would go. */
            const alongX = (st.face & 1) === 0;
            const trackU = alongX ? wx : wz;
            const trackV = alongX ? wz : wx;
            const side = this._farmHash(bx, bz, 281) < 0.5 ? -1 : 1;
            const spine = (alongX ? cz : cx) + side * (alongX ? rz : rx) * 0.55;
            const off = Math.abs(trackV - spine);
            if (st.decay < 3 && (off > 0.8 && off < 2.2) && ((trackU & 3) !== 3) &&
                this._farmGet(chunk, wx, h, wz) === BLOCK.AIR) {
              this._farmSet(chunk, wx, h - 1, wz, BLOCK.TIRE_TRACK);
              continue;
            }

            /* --- WORKING CLUTTER, on the PERIMETER only. Nothing is placed in the open
               middle of a yard: that space is the yard, and filling it is exactly the
               clutter requirement 8 warns against. */
            if (d > bare && d < 1.0 && q > 0.955 && !this._farmWallAdjacent(chunk, wx, h, wz)) {
              const pick = this._farmHash(wx, wz, 267);
              const id = pick < 0.20 ? BLOCK.BARREL
                       : pick < 0.36 ? BLOCK.CRATE
                       : pick < 0.52 ? BLOCK.BROKEN_WOOD
                       : pick < 0.64 ? BLOCK.SACK_PILE
                       : pick < 0.74 ? BLOCK.HAND_TOOLS
                       : pick < 0.86 ? BLOCK.WEED_CLUMP
                       : BLOCK.SMALL_STONES;
              this._farmSet(chunk, wx, h, wz, id);
            } else if (d > trod && q > 0.86 && q < 0.94) {
              this._farmSet(chunk, wx, h, wz, st.decay >= 2 ? BLOCK.WEED_CLUMP : BLOCK.DRY_TUSSOCK);
            }
          }
        }

        /* --- WATER INFRASTRUCTURE. One pump and one trough per yard, on fixed hashed
           cells inside the perimeter band: a yard needs water, so a yard has water, and
           the pair reads immediately as a stock-watering point (requirements 17 and 42).
           Both are clipped like everything else, so a yard straddling four chunks stamps
           the same pump in the same cell from any of them. */
        /* Sited on the PERIMETER of the yard ellipse, not somewhere inside the
           rectangle: anywhere inside is where a building may land, and a pump stamped
           under a barn is a pump that does not exist. At 0.86 of the radius it is
           reliably in open ground on every plot the archetype library can produce. */
        /* SIX CANDIDATE ANGLES, FIRST ONE THAT FITS. A single fixed angle put the pump
           inside a barn or under a driveway on roughly every plot tested — the yard
           ellipse and the archetype's building layout are independent, so one sample is
           not enough. Walking a fixed sequence of angles keeps it a pure function of the
           parcel (every chunk that overlaps the yard picks the same cell) while making
           the placement robust to whatever the archetype library put there. */
        const pbase = this._farmHash(bx, bz, 271) * Math.PI * 2;
        for (let a = 0; a < 6; a++) {
          const pang = pbase + a * (Math.PI / 3);
          const pu = Math.round(cx + Math.cos(pang) * rx * 0.84);
          const pv = Math.round(cz + Math.sin(pang) * rz * 0.84);
          const ph = this._farmStructPadAt(pu, pv);
          if (ph < 0 || this._farmGet(chunk, pu, ph, pv) !== BLOCK.AIR) continue;
          if (!FARM_YARD_GROUND.has(this._farmGet(chunk, pu, ph - 1, pv))) continue;
          if (this._farmWallAdjacent(chunk, pu, ph, pv)) continue;
          this._farmSet(chunk, pu, ph - 1, pv, BLOCK.FARM_MUD);
          this._farmSet(chunk, pu, ph, pv, BLOCK.WATER_PUMP);
          const tu = pu + (Math.cos(pang) < 0 ? -1 : 1);
          if (this._farmStructPadAt(tu, pv) >= 0 &&
              this._farmGet(chunk, tu, ph, pv) === BLOCK.AIR &&
              FARM_YARD_GROUND.has(this._farmGet(chunk, tu, ph - 1, pv))) {
            this._farmSet(chunk, tu, ph, pv, BLOCK.TROUGH);
            this._farmSet(chunk, tu, ph - 1, pv, BLOCK.FARM_MUD);
          }
          break;
        }
      }
    }
  }

  /* ===================================================================================
     PHASE 19 — RELICS: ABANDONED MACHINERY AND FARM DETRITUS

     Requirement 7 wants machinery that is sparse, deterministic and geographically
     logical, and requirement 44 wants every prop to have a reason. So relics live on
     the MINOR STRUCTURE GRID (32 blocks) but only in cells that grid did NOT put a
     building in, and only where the land gives them a reason to be: at the edge of a
     dead or harvested field, beside a lane, in an orchard. A plough in the middle of a
     living pasture is exactly the reasonless prop the brief says to delete, so that
     case is simply not generated.

     EVERY PIECE IS PHASE 17 VOCABULARY. Tractors, wheels, wagons, ploughs, barrels,
     crates, sacks, tools, troughs and bales all already exist and already look right;
     this pass is placement, not modelling, which is why it costs no block ids at all.
     =================================================================================== */
  _farmStampRelics(chunk, C) {
    const P = FARM_MINOR_P;
    const x0 = chunk.cx * CHUNK_SX, z0 = chunk.cz * CHUNK_SZ;
    const m0 = Math.floor((x0 - 4) / P), m1 = Math.floor((x0 + CHUNK_SX + 3) / P);
    const n0 = Math.floor((z0 - 4) / P), n1 = Math.floor((z0 + CHUNK_SZ + 3) / P);

    for (let mx = m0; mx <= m1; mx++) {
      for (let mz = n0; mz <= n1; mz++) {
        if (this._farmHash(mx, mz, 241) > 0.17) continue;        // sparse by construction
        if (this._farmMinorAt(mx, mz)) continue;                 // the cell is built on
        const ox = mx * P + 4 + Math.floor(this._farmHash(mx, mz, 243) * (P - 9));
        const oz = mz * P + 4 + Math.floor(this._farmHash(mx, mz, 245) * (P - 9));
        if (!isFarmlandsWorldPos(ox, oz) || this._farmInPad(ox, oz)) continue;
        if (farmlandsBiomeValue(ox, oz) > FARM_BIOME_T) continue;   // not in the forest
        if (this._farmStructPadAt(ox, oz) >= 0) continue;           // never inside a plot

        const surf = this._farmSurfaceAt(ox, oz);
        if (surf !== FARM_SURF.FIELD && surf !== FARM_SURF.VERGE) continue;
        const h = this._farmHeightAt(ox, oz);
        if (h < FARM_WATER_Y + 1) continue;                         // never in the water

        /* THE REASON TEST. A relic needs one of three: the field it sits in is done
           with (dead, harvested, orchard), or there is a lane within a few blocks for
           it to have been left beside, or it is on the verge itself. Otherwise the cell
           yields nothing — which is most cells, and deliberately so. */
        const bx = Math.floor(ox / FARM_P), bz = Math.floor(oz / FARM_P);
        const p = this._farmParcel(bx, bz);
        const spent = p.kind === FARM_FIELD.DEAD || p.kind === FARM_FIELD.STUBBLE ||
                      p.kind === FARM_FIELD.ORCHARD || p.kind === FARM_FIELD.FLOODED;
        const roadside = surf === FARM_SURF.VERGE ||
                         this._farmSurfaceAt(ox + 3, oz) <= FARM_SURF.RUT && this._farmSurfaceAt(ox + 3, oz) > 0 ||
                         this._farmSurfaceAt(ox - 3, oz) <= FARM_SURF.RUT && this._farmSurfaceAt(ox - 3, oz) > 0;
        if (!spent && !roadside) continue;

        /* PHASE 19 — REQUIREMENT 42. Water is part of the land's history, so a relic
           that happens to sit near water is CHOSEN for that: a stock trough or a dead
           tractor beside a stagnant pond says something about the place, where a random
           crate says nothing. Four cheap height probes decide it. */
        const nearWater = this._farmHeightAt(ox + 4, oz) < FARM_WATER_Y ||
                          this._farmHeightAt(ox - 4, oz) < FARM_WATER_Y ||
                          this._farmHeightAt(ox, oz + 4) < FARM_WATER_Y ||
                          this._farmHeightAt(ox, oz - 4) < FARM_WATER_Y;
        let kind = Math.floor(this._farmHash(mx, mz, 247) * 7);
        if (nearWater) kind = this._farmHash(mx, mz, 259) < 0.55 ? 4 : 3;
        const worn = this._farmHash(mx, mz, 249) < 0.55;   // deeply weathered, or merely left
        const S = (dx, dy, dz, id) => this._farmSet(chunk, ox + dx, h + dy, oz + dz, id);
        switch (kind) {
          case 0:   // a plough, dropped at the end of the last furrow it cut
            S(0, 0, 0, BLOCK.PLOUGH);
            if (worn) S(1, 0, 0, BLOCK.WEED_CLUMP);
            break;
          case 1: {  // a trailer: bed, two wheels, and whatever fell off it
            const ax = this._farmHash(mx, mz, 251) < 0.5;
            S(0, 0, 0, BLOCK.WAGON_BED);
            S(ax ? 1 : 0, 0, ax ? 0 : 1, BLOCK.WAGON_BED);
            S(ax ? 0 : 1, 0, ax ? 1 : 0, BLOCK.WHEEL_SPOKE);
            if (worn) S(ax ? 1 : -1, 0, ax ? -1 : 1, BLOCK.BROKEN_WOOD);
            break;
          }
          case 2:   // barrels and a crate, stacked where they were unloaded
            S(0, 0, 0, BLOCK.BARREL);
            if (this._farmHash(mx, mz, 253) < 0.6) S(1, 0, 0, BLOCK.BARREL);
            if (this._farmHash(mx, mz, 257) < 0.4) S(0, 0, 1, BLOCK.CRATE);
            S(-1, 0, 0, BLOCK.WEED_CLUMP);
            break;
          case 3: {  // a tractor, or what is left of one
            S(0, 0, 0, BLOCK.TRACTOR_BODY);
            S(1, 0, 0, worn ? BLOCK.WHEEL_SPOKE : BLOCK.TRACTOR_WHEEL);
            S(-1, 0, 0, worn ? BLOCK.BROKEN_WOOD : BLOCK.TRACTOR_WHEEL);
            if (worn) { S(0, 0, 1, BLOCK.WEED_CLUMP); S(1, 0, 1, BLOCK.SMALL_STONES); }
            break;
          }
          case 4:   // a stock trough, long dry, at the edge of a field
            S(0, 0, 0, BLOCK.TROUGH);
            S(0, 0, 1, BLOCK.DRY_TUSSOCK);
            if (worn) S(1, 0, 0, BLOCK.WEED_CLUMP);
            break;
          case 5:   // a woodpile and a sack of something, going back to the weather
            S(0, 0, 0, BLOCK.BROKEN_WOOD);
            S(1, 0, 0, BLOCK.SACK_PILE);
            S(0, 0, 1, BLOCK.STICKS);
            break;
          default:  // tools left beside a bale, as if someone is coming back for them
            S(0, 0, 0, BLOCK.HAY_BALE);
            S(1, 0, 0, BLOCK.HAND_TOOLS);
            if (worn) S(0, 0, 1, BLOCK.LEAF_LITTER);
            break;
        }
      }
    }
  }

  /* One tree, written through the clipped setter so it may straddle any number of chunk
     borders and come out identical in each. */
  _farmTree(chunk, wx, h, wz, trunkH, rad, canopyId) {
    for (let ty = 0; ty < trunkH; ty++) this._farmSet(chunk, wx, h + ty, wz, BLOCK.ASH_WOOD);
    const topY = h + trunkH - 1;
    for (let lx = -rad; lx <= rad; lx++) {
      for (let lz = -rad; lz <= rad; lz++) {
        for (let ly = -1; ly <= rad; ly++) {
          if (Math.abs(lx) + Math.abs(lz) + Math.abs(ly) > rad + 1) continue;
          if (lx === 0 && lz === 0 && ly <= 0) continue;
          const bx = wx + lx, by = topY + ly, bz = wz + lz;
          if (by < 0 || by >= CHUNK_SY) continue;
          if (this._farmGet(chunk, bx, by, bz) === BLOCK.AIR) this._farmSet(chunk, bx, by, bz, canopyId);
        }
      }
    }
  }

  /* One building, complete: shell, roof, openings, interior floor treatment, then decay.
     Everything routes through _subSet, so a building may straddle any number of chunk
     borders and each stamps its own portion identically. */
  _farmStampBuilding(chunk, b, hsh) {
    const A = FARM_ARCH[b.arch];
    const baseY = b.baseY;
    const masses = this._farmBuildingMasses(b, baseY);
    if (!this._subHits(chunk, b.x - 2, b.z - 2, b.x + b.w + 2, b.z + b.d + 2)) return;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);

    // --- Fieldstone footing, one course proud, so nothing sits flush on the mud.
    for (const m of masses) {
      for (let dx = -1; dx <= m.w; dx++)
        for (let dz = -1; dz <= m.d; dz++)
          S(m.x + dx, baseY - 1, m.z + dz, BLOCK.FIELDSTONE);
    }
    for (const m of masses) this._subStampShell(chunk, m, b.side, baseY);
    /* OPEN VOLUME. _subStampShell inserts a mid-floor whenever a mass is 8 or more tall,
       which is right for a two-storey house and wrong for a barn: the whole character of
       a barn interior is that you can see the underside of the roof from the threshold.
       The deck is removed and replaced by the archetype's own half-depth hay loft, so
       the volume stays open and the loft still gives it verticality. */
    if (A.loft || A.floor === 'hay') {
      const m0 = masses[0];
      for (let dx = 1; dx < m0.w - 1; dx++)
        for (let dz = 1; dz < m0.d - 1; dz++)
          this._subSet(chunk, m0.x + dx, m0.floorY + 3, m0.z + dz, BLOCK.AIR);
    }
    for (const m of masses) this._subStampRoof(chunk, m, masses, b.roofMat, baseY, b.side, false);

    // --- Exposed frame. Corner posts and a plate beam around the top of the wall: the
    // single cheapest thing that stops a rural building reading as extruded siding.
    if (A.frame) {
      const m = masses[0], py = m.plateY - 1;
      S(m.x, baseY, m.z, BLOCK.POST_TIMBER); S(m.x + m.w - 1, baseY, m.z, BLOCK.POST_TIMBER);
      S(m.x, baseY, m.z + m.d - 1, BLOCK.POST_TIMBER);
      S(m.x + m.w - 1, baseY, m.z + m.d - 1, BLOCK.POST_TIMBER);
      for (let dx = 1; dx < m.w - 1; dx++) {
        S(m.x + dx, py, m.z, BLOCK.BEAM_X); S(m.x + dx, py, m.z + m.d - 1, BLOCK.BEAM_X);
      }
      for (let dz = 1; dz < m.d - 1; dz++) {
        S(m.x, py, m.z + dz, BLOCK.BEAM_Z); S(m.x + m.w - 1, py, m.z + dz, BLOCK.BEAM_Z);
      }
    }

    this._farmOpenings(chunk, b, masses, hsh);
    this._farmBuildingInterior(chunk, b, masses, hsh);
    if (b.decay > 0) this._farmDecayBuilding(chunk, b, masses, hsh);
  }

  /* OPENINGS. A door the player can walk through, and windows arranged by wall rather
     than sprayed — a barn gets one enormous sliding door on its gable end and a row of
     small lights high up; a farmhouse gets domestic windows at sill height. */
  _farmOpenings(chunk, b, masses, hsh) {
    const A = FARM_ARCH[b.arch];
    const m = masses[0], baseY = b.baseY;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    if (!A.door) return;

    // The doorway goes in the wall that faces the approach.
    const cx = m.x + (m.w >> 1), cz = m.z + (m.d >> 1);
    const onZ = (b.face === 0 || b.face === 2);
    const dwx = onZ ? cx : (b.face === 1 ? m.x : m.x + m.w - 1);
    const dwz = onZ ? (b.face === 2 ? m.z : m.z + m.d - 1) : cz;

    if (A.door === 'barn') {
      // A sliding door two cells wide and four tall — big enough for the machinery that
      // is no longer inside, which is the point.
      for (let k = -1; k <= 0; k++) {
        for (let dy = 0; dy < 4; dy++) {
          const wx = onZ ? dwx + k : dwx, wz = onZ ? dwz : dwz + k;
          S(wx, baseY + dy, wz, BLOCK.AIR);
        }
      }
      // Leave one leaf hung and slid aside; the opening stays passable.
      const lx = onZ ? dwx + 1 : dwx, lz = onZ ? dwz : dwz + 1;
      if (b.decay < 3) for (let dy = 0; dy < 4; dy++) S(lx, baseY + dy, lz, onZ ? BLOCK.BARN_DOOR_X : BLOCK.BARN_DOOR_Z);
    } else {
      /* THE DOORWAY IS ALWAYS OPEN, and that is a decision, not a shortcut.

         It was originally a closed door leaf two thirds of the time, which sealed five
         of twenty-four buildings in a walkability census — a farmhouse you cannot enter
         is a decorative shell, and the brief explicitly forbids those for structures
         meant to be enterable. It also happens to be the wrong image: "open doors" and
         "a shed whose door is slightly open" are named in the brief as environmental
         storytelling, because an open door is the difference between a building and a
         departure. So the opening always passes, and the leaf tells the story beside it
         — hung back against the wall, or down in the mud once the place has gone. */
      for (let dy = 0; dy < 2; dy++) S(dwx, baseY + dy, dwz, BLOCK.AIR);
      const dset = onZ ? SUB_DOORS_X : SUB_DOORS_Z;
      const leaf = dset[Math.floor(hsh(13) * dset.length) % dset.length];
      const swing = hsh(11);
      if (b.decay >= 2 && swing < 0.55) {
        // Off its hinges, lying flat just outside the threshold.
        const [ofx, ofz] = _propFace(b.face);
        S(dwx + ofx, baseY - 1, dwz + ofz, BLOCK.ROT_PLANK);
      } else if (swing < 0.60) {
        // Standing open, folded back against the inside of the wall.
        const ix = onZ ? dwx + 1 : dwx, iz = onZ ? dwz : dwz + 1;
        if (this._subGet(chunk, ix, baseY, iz) === BLOCK.AIR) {
          S(ix, baseY, iz, leaf); S(ix, baseY + 1, iz, BLOCK.AIR);
        }
      }
      if (hsh(17) < 0.45) S(dwx, baseY - 1, dwz, BLOCK.DOORMAT);
    }

    // --- Windows. Sill height 1 for domestic, 3 for agricultural.
    const sill = A.door === 'barn' ? 3 : 1;
    const H = m.plateY - m.floorY;
    for (const [ax, az, len, fx, fz] of [
      [m.x + 1, m.z, m.w - 2, 1, 0], [m.x + 1, m.z + m.d - 1, m.w - 2, 1, 0],
      [m.x, m.z + 1, m.d - 2, 0, 1], [m.x + m.w - 1, m.z + 1, m.d - 2, 0, 1],
    ]) {
      for (let k = 1; k < len; k += A.winPitch) {
        const wx = ax + fx * k, wz = az + fz * k;
        if (wx === dwx && wz === dwz) continue;
        if (sill + 1 > H) continue;
        const r = this._farmHash(wx, wz, 193);
        /* WHAT STATE THE GLASS IS IN IS THE BUILDING'S BIOGRAPHY. Boarded means someone
           closed the place up on purpose. Broken means nobody came back to. Intact means
           they simply walked out. All three appear on the same farmstead. */
        /* PHASE 20 DEFECT FIX. This read BLOCK.WINDOW, and there is no such id — the
           vocabulary has WIN_X and WIN_Z, one per wall orientation. `undefined` written
           into a Uint16Array is 0, so every INTACT window in every Farmlands building
           since Phase 17 has been a square hole in the wall instead of a pane. It was
           invisible in a census (a hole and a window are both "not siding") and only
           showed up standing in front of a decay-0 farmhouse, which is exactly the class
           of defect the visual-investigation rule exists for. The glazed id is now
           picked from the wall's own run axis, which the loop already knows. */
        const glazed = fx ? BLOCK.WIN_X : BLOCK.WIN_Z;
        let id;
        if (b.decay === 0) id = r < 0.12 ? BLOCK.WIN_BOARDED : glazed;
        else if (b.decay === 1) id = r < 0.42 ? BLOCK.WIN_BOARDED : (r < 0.60 ? BLOCK.WIN_BROKEN : glazed);
        else id = r < 0.30 ? BLOCK.WIN_BOARDED : (r < 0.85 ? BLOCK.WIN_BROKEN : BLOCK.AIR);
        S(wx, m.floorY + sill, wz, id);
        if (A.tallWin && sill + 1 < H - 1) S(wx, m.floorY + sill + 1, wz, id);
      }
    }
  }

  /* INTERIOR — only what the structure itself implies, per the brief. No furniture
     engine: a floor, a loft where the archetype has one, the ladder to reach it, and the
     handful of objects that say the building was in use when it stopped being used. */
  _farmBuildingInterior(chunk, b, masses, hsh) {
    const A = FARM_ARCH[b.arch];
    const m = masses[0], baseY = b.baseY;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const floor = A.floor === 'hay' ? BLOCK.LOFT_HAY : (b.decay >= 2 ? BLOCK.ROT_PLANK : BLOCK.WOOD_FLOOR);
    for (let dx = 1; dx < m.w - 1; dx++)
      for (let dz = 1; dz < m.d - 1; dz++) S(m.x + dx, baseY - 1, m.z + dz, floor);

    /* THE HAY LOFT. Half the depth of the barn at plate height minus two, reached by a
       ladder on the end wall — a real, enterable second level that costs one strip of
       floor and four ladder cells, and gives the barn the interior verticality the brief
       asks for without an interior engine. */
    if (A.loft && m.plateY - baseY >= 6) {
      const ly = m.plateY - 3;
      const half = Math.max(2, Math.floor(m.d / 2));
      for (let dx = 1; dx < m.w - 1; dx++)
        for (let dz = 1; dz <= half; dz++) S(m.x + dx, ly, m.z + dz, BLOCK.LOFT_HAY);
      for (let dx = 1; dx < m.w - 1; dx += 3) S(m.x + dx, m.plateY - 1, m.z + 1, BLOCK.RAFTER_Z);
      for (let dy = 0; dy < ly - baseY; dy++) S(m.x + 1, baseY + dy, m.z + half + 1, BLOCK.LADDER_N);
      // Bales stacked where they were left.
      for (let k = 0; k < 3; k++) {
        const bxp = m.x + 2 + Math.floor(hsh(300 + k) * (m.w - 4));
        const bzp = m.z + 1 + Math.floor(hsh(310 + k) * half);
        S(bxp, ly + 1, bzp, BLOCK.HAY_BALE);
      }
    }

    /* THINGS LEFT BEHIND. Deliberately sparse and deliberately mundane. The brief's
       instruction is that the player should be able to construct their own explanation,
       which means the environment must offer evidence and refuse to offer conclusions —
       so this places crates, barrels, sacks and tools, and nothing that means anything. */
    const props = A.props || [];
    if (props.length) {
      const n = 1 + Math.floor(hsh(21) * Math.min(4, Math.max(1, (m.w * m.d) / 24)));
      for (let k = 0; k < n; k++) {
        const px = m.x + 1 + Math.floor(hsh(30 + k * 3) * (m.w - 2));
        const pz = m.z + 1 + Math.floor(hsh(31 + k * 3) * (m.d - 2));
        const id = props[Math.floor(hsh(32 + k * 3) * props.length) % props.length];
        if (this._subGet(chunk, px, baseY, pz) === BLOCK.AIR) S(px, baseY, pz, id);
      }
    }
  }

  /* DETERIORATION. Applied last, as subtraction. Level 1 loses a few roof cells and
     nothing structural; level 2 opens the walls and drops debris on the floor; level 3
     takes a whole corner and most of the roof. The hash is keyed on world position, so
     the SAME cells are removed no matter which chunk performs the removal. */
  _farmDecayBuilding(chunk, b, masses, hsh) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    /* TUNED DOWN after rendering. The first pass used 0.42 wall / 0.62 roof at level 3
       plus an 0.80 corner, which did not read as "partially collapsed" — it read as
       rubble, and it took the building's silhouette with it. A collapsed barn must still
       be recognisably a barn from across a field or the landmark is wasted. */
    const wallP = [0, 0, 0.10, 0.24][b.decay];
    const roofP = [0, 0.08, 0.24, 0.46][b.decay];
    for (const m of masses) {
      const top = m.plateY + Math.ceil((Math.max(m.w, m.d) / 2 + SUB_EAVE) * SUB_ROOF_PITCH) + 2;
      /* Level 3 loses a CORNER rather than a scatter of cells. A building eaten evenly
         by random holes reads as damage; a building missing one corner reads as
         collapse, and collapse is what actually happens to a barn whose sill rots. */
      let cx0 = 0, cz0 = 0, cx1 = -1, cz1 = -1;
      if (b.decay === 3) {
        const q = Math.floor(hsh(41) * 4);
        const cw = Math.max(2, m.w >> 1), cd = Math.max(2, m.d >> 1);
        cx0 = (q & 1) ? m.x + m.w - cw : m.x; cx1 = cx0 + cw - 1;
        cz0 = (q & 2) ? m.z + m.d - cd : m.z; cz1 = cz0 + cd - 1;
      }
      for (let wx = m.x - SUB_EAVE; wx <= m.x + m.w + SUB_EAVE; wx++) {
        for (let wz = m.z - SUB_EAVE; wz <= m.z + m.d + SUB_EAVE; wz++) {
          const inCorner = wx >= cx0 && wx <= cx1 && wz >= cz0 && wz <= cz1;
          for (let wy = m.floorY; wy <= top; wy++) {
            const cur = this._subGet(chunk, wx, wy, wz);
            if (cur === BLOCK.AIR || cur === -1) continue;
            const isRoof = wy >= m.plateY;
            const r = this._farmHash(wx * 3 + wy, wz * 5 + wy, 197);
            let gone = isRoof ? r < roofP : r < wallP;
            if (inCorner && wy > m.floorY) gone = gone || r < 0.62;
            if (!gone) continue;
            S(wx, wy, wz, BLOCK.AIR);
            // What came down is now on the floor. Debris only, never a full blockage.
            if (this._farmHash(wx, wz, 199) < 0.22 &&
                this._subGet(chunk, wx, m.floorY - 1, wz) !== -1) {
              S(wx, m.floorY - 1, wz, BLOCK.ROT_PLANK);
            }
          }
        }
      }
    }
  }

  _farmStampStead(chunk, st) {
    // PHASE 18 — the influence rectangle, not the yard rectangle. The driveway, the
    // turnaround and the gate sign all reach back to the lane, and a chunk that covers
    // only the approach still has to draw its share of it.
    if (!this._subHits(chunk, st.sx0, st.sz0, st.sx1, st.sz1)) return;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const baseY = st.padY;
    const H = (n) => this._farmHash(st.bx, st.bz, n);
    const hsh = (n) => this._farmHash(st.bx * 7 + n, st.bz * 11 + n, 211);

    // --- THE YARD. Bare packed earth inside the fence: the ground people and animals
    // wore down, which is why a farmyard is never crops right up to the door.
    for (let wx = st.ox; wx < st.x1; wx++)
      for (let wz = st.oz; wz < st.z1; wz++) {
        const edge = wx === st.ox || wx === st.x1 - 1 || wz === st.oz || wz === st.z1 - 1;
        S(wx, baseY - 1, wz, edge ? BLOCK.DEAD_EARTH : BLOCK.FARM_TRACK);
        for (let dy = 0; dy < 3; dy++) S(wx, baseY + dy, wz, BLOCK.AIR);
      }

    /* --- THE DRIVEWAY runs from the lane to the front of the house. It is what turns a
       cluster of buildings into a PLACE SOMEONE DROVE TO, and it is the cue that lets a
       player following a track know a farmstead is coming before they can see it. */
    /* =================================================================================
       PHASE 18.1 — THE DRIVEWAY, AS ONE OF FOUR AUTHORED ARCHETYPES.

       Phase 18's drive ran from the parcel edge to the yard in a dead straight line at a
       fixed offset, which was wrong twice over. It assumed the lane sat on the grid line —
       no longer true, so it would now start in the middle of a field and never reach the
       road at all — and a perfectly straight Cartesian connector is precisely what the
       brief calls out as reading like scaffolding rather than like a farm entrance.

       So the drive is now a parametric route from the ROAD'S ACTUAL CENTRELINE to the yard
       gate, shaped by one of four archetypes chosen deterministically per farmstead:

         STRAIGHT  a short direct approach. Some farms really do have one, and keeping it
                   in the set is what stops the curved ones reading as a mannerism.
         BOW       a single gentle arc out and back — the commonest real farm drive.
         SIDE      swings across and enters the yard from one side rather than head-on.
         FORK      a bow that splits near the yard, one branch to the house and one to the
                   barn, which is how a working farm with two buildings actually reads.

       Four archetypes, not noise. The brief is explicit that driveways should not be made
       individually unique by randomness; a small set of coherent shapes with seeded
       parameters gives variety that still looks authored.
       ================================================================================= */
    const driveArch = Math.floor(H(661) * 4);
    const driveBow = (H(663) * 2 - 1) * (5 + H(665) * 5);
    {
      // Primary axis: the drive runs perpendicular to the lane it leaves.
      const alongX = st.laneW;
      // Where the yard gate is, and where the road actually is at that point.
      const gateA = alongX ? st.ox + 4 : st.oz + 4;                 // along-axis end, at the yard
      const lateral0 = alongX ? st.oz + 8 : st.ox + 8;              // where it meets the yard
      const roadA = alongX
        ? Math.round(st.bx * FARM_P + this._farmRouteX(st.bx, lateral0))
        : Math.round(st.bz * FARM_P + this._farmRouteZ(st.bz, lateral0));
      const from = Math.min(roadA - 2, gateA), to = Math.max(roadA + 2, gateA);
      const span = Math.max(1, to - from);

      /* The lateral offset of the drive at parameter t (0 at the road, 1 at the yard).
         Every archetype is zero at t=1 so the drive always arrives at the gate, and the
         bow is largest in the middle where nothing has to line up. */
      const lat = (t) => {
        if (driveArch === 0) return 0;                                   // STRAIGHT
        if (driveArch === 2) return driveBow * (1 - t) * (1 - t);        // SIDE: offset at the road
        return driveBow * Math.sin(Math.PI * t) * 0.85;                  // BOW / FORK
      };

      for (let i = 0; i <= span; i++) {
        const a = to - i;                       // walk from the yard back to the road
        const t = span ? (to - a) / span : 0;
        const tt = 1 - t;                       // 0 at the road end
        const lateral = Math.round(lateral0 + lat(tt));
        /* THE MOUTH FLARES. Everything that ever turned in off the road had to swing wide,
           so the drive is three cells across where it meets the lane and tapers to one
           over the first eight blocks. This is also what makes an entrance legible from a
           distance as an entrance rather than as a gap in a hedge. */
        const near = Math.abs(a - roadA);
        const wRad = 1 + (near < 8 ? Math.round((8 - near) / 4) : 0);
        for (let k = -wRad; k <= wRad; k++) {
          const wx = alongX ? a : lateral + k, wz = alongX ? lateral + k : a;
          S(wx, baseY - 1, wz, BLOCK.FARM_RUT);
          for (let dy = 0; dy < 3; dy++) S(wx, baseY + dy, wz, BLOCK.AIR);
        }
      }

      /* THE FORK. A second branch peeling off toward the far side of the yard, which is
         where the barn sits in every archetype the stead planner produces. */
      if (driveArch === 3) {
        const forkAt = Math.round(gateA + (roadA - gateA) * 0.35);
        const forkEnd = lateral0 + (H(667) < 0.5 ? -10 : 10);
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          const a = Math.round(forkAt + (gateA - forkAt) * t);
          const lateral = Math.round(lateral0 + (forkEnd - lateral0) * (t * t));
          const wx = alongX ? a : lateral, wz = alongX ? lateral : a;
          S(wx, baseY - 1, wz, BLOCK.FARM_RUT);
          for (let dy = 0; dy < 3; dy++) S(wx, baseY + dy, wz, BLOCK.AIR);
        }
      }

      // THE TURNAROUND: a worn apron inside the gate, because a vehicle that drove in had
      // to get out again. The cheapest single thing that makes a farmyard read as used.
      const tA = alongX ? st.ox : st.oz;
      for (let d1 = 1; d1 <= 6; d1++)
        for (let d2 = -4; d2 <= 4; d2++) {
          const wx = alongX ? tA + d1 : lateral0 + d2, wz = alongX ? lateral0 + d2 : tA + d1;
          S(wx, baseY - 1, wz, BLOCK.FARM_TRACK);
        }
    }


    // --- The buildings themselves. Each gets its own footprint cleared first, since a
    // building may extend a cell or two past the yard rectangle.
    const plan = this._farmSteadPlan(st);
    for (const b of plan) this._farmClearPlot(chunk, b.x - 1, b.z - 1, b.x + b.w + 1, b.z + b.d + 1, baseY, 0);
    for (let i = 0; i < plan.length; i++) {
      const b = plan[i];
      this._farmStampBuilding(chunk, b, (n) => this._farmHash(b.x * 5 + n, b.z * 3 + n, 269));
    }

    /* --- THE SILO. Attached to the barn, because that is where grain goes, and tall
       enough to be the farmstead's landmark from several fields away — the silhouette
       cue the brief asks for so a player can spot a settlement and choose to walk to it. */
    if (H(271) < 0.55) {
      const barn = plan.find(p => p.role === 'barn');
      if (barn) {
        const sx = barn.x - 4, sz = barn.z + 1, r = 1;
        const hgt = 9 + Math.floor(H(277) * 5);
        for (let dx = -r; dx <= r; dx++)
          for (let dz = -r; dz <= r; dz++) {
            if (Math.abs(dx) === r && Math.abs(dz) === r) continue;   // clip the corners
            for (let dy = 0; dy < hgt; dy++) S(sx + dx, baseY + dy, sz + dz, BLOCK.SILO_TILE);
            S(sx + dx, baseY + hgt, sz + dz, BLOCK.SILO_CONE);
            S(sx + dx, baseY - 1, sz + dz, BLOCK.FIELDSTONE);
          }
        for (let dy = 1; dy < hgt; dy++) S(sx, baseY + dy, sz - r, BLOCK.LADDER_S);
      }
    }

    // --- THE WELL, near the house because that is where water was carried to.
    if (H(281) < 0.62) {
      const wx = st.ox + 14, wz = st.oz + 5;
      S(wx, baseY, wz, BLOCK.WELL_RIM);
      S(wx, baseY - 1, wz, BLOCK.AIR);          // the shaft: open, and dark
      for (let dy = 2; dy <= 6; dy++) S(wx, baseY - dy, wz, BLOCK.AIR);
      S(wx - 1, baseY, wz, BLOCK.WELL_POST); S(wx + 1, baseY, wz, BLOCK.WELL_POST);
      S(wx, baseY + 1, wz, BLOCK.WELL_WINCH);
      S(wx - 1, baseY + 1, wz, BLOCK.WELL_POST); S(wx + 1, baseY + 1, wz, BLOCK.WELL_POST);
    }

    /* --- ABANDONED EQUIPMENT, in the yard where it was parked. Restraint is explicit in
       the brief and enforced here by count, not by probability: at most four pieces on a
       whole farmstead, so the yard reads as left rather than dumped in. */
    const eq = [BLOCK.TRACTOR_BODY, BLOCK.WAGON_BED, BLOCK.PLOUGH, BLOCK.BARREL,
                BLOCK.CRATE, BLOCK.SACK_PILE, BLOCK.WHEEL_SPOKE, BLOCK.HAND_TOOLS];
    const nEq = 2 + Math.floor(H(283) * 3);
    for (let k = 0; k < nEq; k++) {
      const px = st.ox + 4 + Math.floor(hsh(80 + k) * (FARM_STEAD_W - 8));
      const pz = st.oz + 4 + Math.floor(hsh(81 + k) * (FARM_STEAD_D - 8));
      if (this._subGet(chunk, px, baseY, pz) !== BLOCK.AIR) continue;
      const id = eq[Math.floor(hsh(82 + k) * eq.length) % eq.length];
      S(px, baseY, pz, id);
      // A tractor is a body and a wheelset — one cell would read as a crate.
      if (id === BLOCK.TRACTOR_BODY) S(px, baseY, pz + 1, BLOCK.TRACTOR_WHEEL);
      if (id === BLOCK.WAGON_BED) { S(px + 1, baseY, pz, BLOCK.WHEEL_SPOKE); S(px - 1, baseY, pz, BLOCK.WHEEL_SPOKE); }
    }

    // --- An empty animal pen against the barn: posts, rails, and nothing inside.
    if (H(293) < 0.5) {
      const px = st.ox + FARM_STEAD_W - 16, pz = st.oz + 6;
      for (let k = 0; k < 9; k++) {
        S(px + k, baseY, pz, (k & 3) === 0 ? BLOCK.FENCE_POST : BLOCK.FARM_FENCE_X);
        S(px + k, baseY, pz + 7, (k & 3) === 0 ? BLOCK.FENCE_POST : BLOCK.FARM_FENCE_X);
      }
      for (let k = 1; k < 7; k++) S(px, baseY, pz + k, BLOCK.FARM_FENCE_Z);
      S(px + 4, baseY, pz + 3, BLOCK.TROUGH);
    }

    /* --- PHASE 18: THE GATE. A mailbox on about half of all farmsteads and a name board
       on about a third, both standing on the verge beside the drive mouth where a real
       one would be. This is where ROTH FARM is written into the world, and it is written
       by exactly the same three lines that write every other property name.

       The board runs PERPENDICULAR to the lane so it faces oncoming traffic, which is
       also why it can never be read edge-on by someone following the road. */
    const gateY = baseY;
    if (st.laneN) {
      const gx = st.ox + 8 + 4, gz = st.oz - 2;
      if (st.hasSign) this._farmStampNameBoard(chunk, gx, gz, 'x', st.nameIdx, gateY);
      if (H(647) < 0.5) S(st.ox + 8 - 4, gateY, st.oz - 2, BLOCK.MAILBOX);
    } else {
      const gx = st.ox - 2, gz = st.oz + 8 + 4;
      if (st.hasSign) this._farmStampNameBoard(chunk, gx, gz, 'z', st.nameIdx, gateY);
      if (H(647) < 0.5) S(st.ox - 2, gateY, st.oz + 8 - 4, BLOCK.MAILBOX);
    }
  }

  /* A free-standing two-cell name board on two posts. Shared by the farm gate and by
     anything else that wants to label a place; the sign SYSTEM (which junction, which
     name, which arrow) lives in _farmSignAt, and this is only the carpentry. */
  _farmStampNameBoard(chunk, x0, z0, run, nameIdx, groundY) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const ax = run === 'x' ? 1 : 0, az = run === 'z' ? 1 : 0;
    const x1 = x0 + ax, z1 = z0 + az;
    const h0 = this._farmHeightAt(x0, z0), h1 = this._farmHeightAt(x1, z1);
    if (Math.abs(h0 - h1) > 1) return;
    const baseY = Math.max(groundY, Math.max(h0, h1));
    for (let dy = 0; dy < 4; dy++) { S(x0, baseY + dy, z0, BLOCK.AIR); S(x1, baseY + dy, z1, BLOCK.AIR); }
    S(x0, baseY, z0, BLOCK.SIGN_POST); S(x0, baseY + 1, z0, BLOCK.SIGN_POST);
    S(x1, baseY, z1, BLOCK.SIGN_POST); S(x1, baseY + 1, z1, BLOCK.SIGN_POST);
    const b = BLOCK.SIGN_TEXT_BASE + nameIdx * 4 + (run === 'x' ? 0 : 2);
    S(x0, baseY + 2, z0, b + 0);
    S(x1, baseY + 2, z1, b + 1);
  }

  /* ===================================================================================
     PHASE 18 — DESTINATION SPURS

     A landmark reached by walking across a ploughed field is a prop. A landmark reached
     by a worn track leaving a lane is a PLACE, and the difference costs about thirty
     voxels. The spur runs from the plot edge back to the lane that justified the
     landmark's placement in the first place, following the ground rather than levelling
     it — a farm track over a rise is exactly right, and levelling would fight the
     heightfield the plot pad has already set.

     Spurs are also where the brief's forks, branches and short dead ends come from: a
     spur IS a fork off a lane, and one that ends at a water tower or a stock shelter is
     a dead end that goes somewhere, which is the only kind worth walking. */
  _farmStampSpur(chunk, fromX, fromZ, toX, toZ, halfWidth) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const dx = toX - fromX, dz = toZ - fromZ;
    const steps = Math.max(Math.abs(dx), Math.abs(dz));
    if (steps <= 0 || steps > 96) return;
    const alongX = Math.abs(dx) >= Math.abs(dz);
    /* PHASE 18.1 — A SPUR BOWS. A dead-straight connector between a lane and a barn is
       the single most obvious piece of Cartesian scaffolding left in the dimension, and a
       track worn by people and vehicles never takes the exact shortest line. The bow is a
       half-sine of a seeded amplitude — zero at both ends so the spur still meets the
       lane and the building exactly where it must, and largest in the middle where there
       is nothing to line up with. */
    const bow = (this._farmHash(fromX, fromZ, 659) * 2 - 1) * Math.min(7, steps * 0.22);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const b = bow * Math.sin(Math.PI * t);
      const wx = Math.round(fromX + dx * t + (alongX ? 0 : b));
      const wz = Math.round(fromZ + dz * t + (alongX ? b : 0));
      for (let k = -halfWidth; k <= halfWidth; k++) {
        const cx = alongX ? wx : wx + k, cz = alongX ? wz + k : wz;
        const h = this._farmHeightAt(cx, cz);
        S(cx, h - 1, cz, (k === 0) ? BLOCK.FARM_RUT : BLOCK.FARM_TRACK);
        // Clear whatever was growing: a track nobody walks is not a track.
        for (let dy = 0; dy < 3; dy++) S(cx, h + dy, cz, BLOCK.AIR);
      }
    }
  }

  /* ===================================================================================
     HORROR LANDMARKS

     Five kinds, all rare, none of which spawns anything or triggers anything. The brief
     is unambiguous and it is the right call: these structures must create questions and
     then let the player leave. Every one of them is built to be READ and not resolved —
     there is no reward inside, no note, no encounter, and nothing that explains itself.

     They are also, deliberately, all things that plausibly exist in a farming region. A
     cemetery, a chapel, a big old barn, a well and a memorial are ordinary rural
     furniture. What makes them land is condition, silence and one detail that is wrong.
     =================================================================================== */
  /* CLEAR THE PLOT FIRST. Fields and trees stamp before settlements, so a landmark that
     does not clear its ground gets crops growing through its floor and canopy through
     its roof — which is exactly what an inspection render of the chapel showed. The
     graveyard, the well and the memorial already cleared; the chapel and the great barn
     did not, and a building with a tree inside it does not read as abandoned, it reads
     as broken. */
  _farmClearPlot(chunk, x0, z0, x1, z1, baseY, groundId) {
    for (let wx = x0; wx < x1; wx++)
      for (let wz = z0; wz < z1; wz++) {
        if (groundId) this._subSet(chunk, wx, baseY - 1, wz, groundId);
        for (let dy = 0; dy < 10; dy++) this._subSet(chunk, wx, baseY + dy, wz, BLOCK.AIR);
      }
  }

  /* THE GRAVEYARD. A real rural cemetery first, per the brief, and the anomalies are
     kept to at most two per site and are all things a confused caretaker could have
     done. No gore, no glow, no particles.

     The ROWS are what make it read: real graveyards are laid out on a grid because they
     were surveyed, and it is precisely that regularity which makes one stone out of
     alignment legible as wrong. A random scatter of headstones has no alignment to
     break, so it can carry no anomaly at all — it just looks untidy. */
  _farmStampGraveyard(chunk, lm, hsh) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const baseY = lm.padY, N = lm.size;

    // Ground: overgrown, thinning to bare earth along the path.
    for (let dx = 0; dx < N; dx++)
      for (let dz = 0; dz < N; dz++) {
        const wx = lm.ox + dx, wz = lm.oz + dz;
        S(wx, baseY - 1, wz, BLOCK.ROTTED_SOIL);
        for (let dy = 0; dy < 3; dy++) S(wx, baseY + dy, wz, BLOCK.AIR);
        if (this._farmHash(wx, wz, 311) < 0.28) S(wx, baseY, wz, BLOCK.DRY_TUSSOCK);
      }

    // The path: worn, straight in from the gate, stopping at the far wall.
    const pathX = lm.ox + (N >> 1);
    for (let dz = 0; dz < N - 2; dz++) {
      for (let k = -1; k <= 1; k++) S(pathX + k, baseY - 1, lm.oz + dz, BLOCK.FARM_TRACK);
      S(pathX, baseY, lm.oz + dz, BLOCK.AIR);
    }

    // Low boundary wall, broken in places, with a gap where the gate hung.
    for (let dx = 0; dx < N; dx++) {
      for (const wz of [lm.oz, lm.oz + N - 1]) {
        if (Math.abs(lm.ox + dx - pathX) <= 1 && wz === lm.oz) continue;
        if (this._farmHash(lm.ox + dx, wz, 313) < 0.22) continue;
        S(lm.ox + dx, baseY, wz, BLOCK.FARM_STONE_X);
      }
    }
    for (let dz = 1; dz < N - 1; dz++) {
      for (const wx of [lm.ox, lm.ox + N - 1]) {
        if (this._farmHash(wx, lm.oz + dz, 317) < 0.22) continue;
        S(wx, baseY, lm.oz + dz, BLOCK.FARM_STONE_Z);
      }
    }

    /* THE ROWS. Surveyed grid, mixed stone and wood, uneven by design. */
    const stones = [BLOCK.HEADSTONE_ROUND, BLOCK.HEADSTONE_SLAB, BLOCK.HEADSTONE_CROSS];
    const anomA = Math.floor(hsh(1) * 3);          // which anomaly this site gets
    const anomRow = 2 + Math.floor(hsh(2) * Math.max(1, ((N - 6) / 3) | 0));
    const anomCol = 2 + Math.floor(hsh(3) * Math.max(1, ((N - 6) / 2) | 0));
    let row = 0;
    for (let dz = 3; dz < N - 3; dz += 3, row++) {
      let col = 0;
      for (let dx = 2; dx < N - 2; dx += 2, col++) {
        const wx = lm.ox + dx, wz = lm.oz + dz;
        if (Math.abs(wx - pathX) <= 1) continue;                 // keep the path clear
        if (this._farmHash(wx, wz, 331) < 0.18) continue;        // gaps: unmarked graves
        const r = this._farmHash(wx, wz, 337);
        let id = r < 0.22 ? BLOCK.GRAVE_MARKER : stones[Math.floor(r * stones.length) % stones.length];

        /* THE ANOMALIES. One site gets one. Each is a small, quiet incorrectness that a
           player may well walk past — which is the intent. Nothing here is announced,
           nothing is lit, and nothing follows from noticing it. */
        const atAnom = (row === anomRow && col === anomCol);
        if (atAnom && anomA === 0) {
          // A grave that is newer than everything around it: turned earth, no grass, and
          // a marker that has not weathered.
          for (let ax = -1; ax <= 1; ax++)
            for (let az = -1; az <= 0; az++) S(wx + ax, baseY - 1, wz + az, BLOCK.GRAVE_SOIL);
          id = BLOCK.HEADSTONE_SLAB;
        } else if (atAnom && anomA === 1) {
          // One open, empty burial space. Not a hole to fall in — a shallow cut, edged,
          // with the marker already standing at its head.
          for (let ax = -1; ax <= 1; ax++)
            for (let az = -1; az <= 0; az++) {
              S(wx + ax, baseY - 1, wz + az, BLOCK.AIR);
              S(wx + ax, baseY - 2, wz + az, BLOCK.GRAVE_SOIL);
            }
        } else if (atAnom && anomA === 2) {
          /* A short run of identical stones, all the same cut, all facing the wrong way
             relative to every other row. Reads as a mistake before it reads as anything
             else, which is exactly the register this phase wants. */
          for (let k = 0; k < 4 && dx + k * 2 < N - 2; k++) {
            S(lm.ox + dx + k * 2, baseY, wz, BLOCK.HEADSTONE_CROSS);
          }
          continue;
        }
        S(wx, baseY, wz, id);
      }
    }

    // Sparse tree cover, at the corners where a cemetery's yews would be.
    for (const [tx, tz] of [[lm.ox + 1, lm.oz + 1], [lm.ox + N - 2, lm.oz + N - 2]]) {
      if (this._farmHash(tx, tz, 347) < 0.55) {
        for (let dy = 0; dy < 5; dy++) S(tx, baseY + dy, tz, BLOCK.ASH_WOOD);
        for (let ax = -2; ax <= 2; ax++)
          for (let az = -2; az <= 2; az++)
            for (let ay = 3; ay <= 5; ay++)
              if (Math.abs(ax) + Math.abs(az) + Math.abs(ay - 4) <= 3 &&
                  this._subGet(chunk, tx + ax, baseY + ay, tz + az) === BLOCK.AIR)
                S(tx + ax, baseY + ay, tz + az, BLOCK.BLACK_CANOPY);
      }
    }
  }

  // THE CHAPEL. Small, stone, one room, a bell frame and no roof left over the nave.
  _farmStampChapel(chunk, lm, hsh) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const baseY = lm.padY;
    const w = 8, d = 12, x = lm.ox + ((lm.size - w) >> 1), z = lm.oz + ((lm.size - d) >> 1);
    // The churchyard: bare, overgrown at the edges, and clear of crops and trees.
    this._farmClearPlot(chunk, lm.ox, lm.oz, lm.x1, lm.z1, baseY, BLOCK.ROTTED_SOIL);
    for (let wx = lm.ox; wx < lm.x1; wx++)
      for (let wz = lm.oz; wz < lm.z1; wz++)
        if (this._farmHash(wx, wz, 353) < 0.24) this._subSet(chunk, wx, baseY, wz, BLOCK.DRY_TUSSOCK);
    const m = { x, z, w, d, floorY: baseY, plateY: baseY + 6, roof: 'gable', ridge: 'x', main: true };
    for (let dx = -1; dx <= w; dx++)
      for (let dz = -1; dz <= d; dz++) S(x + dx, baseY - 1, z + dz, BLOCK.FIELDSTONE);
    this._subStampShell(chunk, m, BLOCK.CHAPEL_STONE, baseY);
    this._subStampRoof(chunk, m, [m], BLOCK.ROOF_A, baseY, BLOCK.CHAPEL_STONE, false);
    // Tall lancet windows, all of them broken.
    for (let dz = 2; dz < d - 1; dz += 3)
      for (const wx of [x, x + w - 1])
        for (let dy = 2; dy <= 3; dy++) S(wx, baseY + dy, z + dz, BLOCK.WIN_BROKEN);
    // Doorway at the gable end, standing open.
    for (let dy = 0; dy < 3; dy++) S(x + (w >> 1), baseY + dy, z, BLOCK.AIR);
    // Pews, in two ranks with an aisle, several knocked out of line.
    for (let dz = 3; dz < d - 2; dz += 2)
      for (const dx of [2, w - 3]) {
        if (hsh(dz * 3 + dx) < 0.2) continue;
        S(x + dx, baseY, z + dz, BLOCK.CHAPEL_PEW);
      }
    // The bell, still hung in its frame above the entrance.
    S(x + (w >> 1), baseY + 7, z + 1, BLOCK.CHAPEL_BELL);
    for (const dx of [(w >> 1) - 1, (w >> 1) + 1])
      for (let dy = 6; dy <= 8; dy++) S(x + dx, baseY + dy, z + 1, BLOCK.POST_TIMBER);
    /* Decay 2, not 3. At 3 the chapel lost its roof and half its walls and stopped
       being recognisable as a church from outside — and a landmark the player cannot
       identify at distance cannot draw them to it. Damaged, not demolished. */
    this._farmDecayBuilding(chunk, { x, z, w, d, baseY, decay: 2 }, [m], hsh);
  }

  /* THE GREAT BARN. Much larger than any working barn, half fallen, and — the one
     genuinely wrong thing about it — laid out on proportions that do not match its own
     frame. The interior is deliberately unlit and deliberately deeper than the outside
     suggests, achieved honestly: the footprint really is that big and there really are
     no windows, so the darkness is a consequence of the building rather than an effect. */
  _farmStampGreatBarn(chunk, lm, hsh) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const baseY = lm.padY;
    const w = 20, d = 28, x = lm.ox + ((lm.size - w) >> 1), z = lm.oz + ((lm.size - d) >> 1);
    // Bare, beaten ground all round it — nothing has been sown here in a long time.
    this._farmClearPlot(chunk, lm.ox, lm.oz, lm.x1, lm.z1, baseY, BLOCK.DEAD_EARTH);
    const m = { x, z, w, d, floorY: baseY, plateY: baseY + 10, roof: 'gable', ridge: 'x', main: true };
    for (let dx = -1; dx <= w; dx++)
      for (let dz = -1; dz <= d; dz++) S(x + dx, baseY - 1, z + dz, BLOCK.FIELDSTONE);
    this._subStampShell(chunk, m, BLOCK.BARN_RED, baseY);
    this._subStampRoof(chunk, m, [m], BLOCK.ROOF_TIN, baseY, BLOCK.BARN_RED, false);
    // Frame: full bays of posts and beams down the length.
    for (let dz = 2; dz < d - 1; dz += 4) {
      for (const dx of [2, w - 3]) {
        for (let dy = 0; dy < 8; dy++) S(x + dx, baseY + dy, z + dz, BLOCK.POST_TIMBER);
        S(x + dx, baseY + 8, z + dz, BLOCK.BEAM_Z);
      }
      for (let dx = 3; dx < w - 3; dx++) S(x + dx, baseY + 8, z + dz, BLOCK.BEAM_X);
    }
    // The great sliding door, one leaf off its track and lying flat.
    for (let dx = (w >> 1) - 2; dx <= (w >> 1) + 1; dx++)
      for (let dy = 0; dy < 6; dy++) S(x + dx, baseY + dy, z, BLOCK.AIR);
    for (let dx = (w >> 1) - 2; dx <= (w >> 1) - 1; dx++)
      S(x + dx, baseY, z - 2, BLOCK.ROT_PLANK);
    /* DISTURBED FLOORING. A rectangle of the boards lifted and stacked to one side, and
       bare earth beneath. No hole, no stair, nothing under it. */
    const fx = x + 4 + Math.floor(hsh(5) * (w - 12)), fz = z + 8 + Math.floor(hsh(6) * (d - 18));
    for (let dx = 0; dx < 5; dx++)
      for (let dz = 0; dz < 4; dz++) S(fx + dx, baseY - 1, fz + dz, BLOCK.GRAVE_SOIL);
    for (let k = 0; k < 4; k++) S(fx - 1, baseY, fz + k, BLOCK.ROT_PLANK);
    /* Decay 2. The great barn must stay enormous and recognisable — its whole effect is
       being far too big for the region, seen from a distance, and still standing. */
    this._farmDecayBuilding(chunk, { x, z, w, d, baseY, decay: 2 }, [m], hsh);
  }

  /* THE DEEP WELL. Standing alone with no farm around it, which is the whole unease:
     someone dug it, so something was here. The shaft is genuinely deep and genuinely
     unlit — no bottom is visible from the rim. */
  _farmStampDeepWell(chunk, lm, hsh) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const baseY = lm.padY;
    const cx = lm.ox + (lm.size >> 1), cz = lm.oz + (lm.size >> 1);
    for (let dx = -4; dx <= 4; dx++)
      for (let dz = -4; dz <= 4; dz++) {
        S(cx + dx, baseY - 1, cz + dz, Math.abs(dx) + Math.abs(dz) <= 3 ? BLOCK.FARM_TRACK : BLOCK.DEAD_EARTH);
        for (let dy = 0; dy < 3; dy++) S(cx + dx, baseY + dy, cz + dz, BLOCK.AIR);
      }
    // A ring of fieldstone kerb, part collapsed inward.
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        if (this._farmHash(cx + dx, cz + dz, 349) < 0.2) continue;
        S(cx + dx, baseY, cz + dz, BLOCK.WELL_RIM);
      }
    for (let dy = 1; dy <= FARM_DEEPWELL_DEPTH; dy++) S(cx, baseY - dy, cz, BLOCK.AIR);
    for (let dy = 1; dy <= FARM_DEEPWELL_DEPTH; dy++)
      for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        S(cx + ax, baseY - dy, cz + az, BLOCK.FIELDSTONE);
    // The winch frame is still up; the rope is not.
    S(cx - 1, baseY + 1, cz, BLOCK.WELL_POST); S(cx + 1, baseY + 1, cz, BLOCK.WELL_POST);
    S(cx, baseY + 1, cz, BLOCK.WELL_WINCH);
    // A cover, pushed aside rather than removed.
    for (let k = 0; k < 3; k++) S(cx + 2, baseY, cz - 1 + k, BLOCK.ROT_PLANK);
  }

  /* THE MEMORIAL. A stone, a low kerb, and space around it that has been kept clear far
     longer than anything else here. Restrained on purpose: the brief forbids a lore dump
     and it is right to — the reason a rural memorial is affecting is that it names an
     event you were not there for and does not describe it. */
  _farmStampMemorial(chunk, lm, hsh) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const baseY = lm.padY;
    const cx = lm.ox + (lm.size >> 1), cz = lm.oz + (lm.size >> 1);
    for (let dx = -4; dx <= 4; dx++)
      for (let dz = -4; dz <= 4; dz++) {
        const d = Math.max(Math.abs(dx), Math.abs(dz));
        S(cx + dx, baseY - 1, cz + dz, d <= 2 ? BLOCK.FARM_TRACK : BLOCK.DEAD_EARTH);
        for (let dy = 0; dy < 3; dy++) S(cx + dx, baseY + dy, cz + dz, BLOCK.AIR);
        if (d === 3 && (dx + dz) % 2 === 0) S(cx + dx, baseY, cz + dz, BLOCK.FARM_STONE_X);
      }
    S(cx, baseY, cz, BLOCK.MEMORIAL);
    // A handful of small markers set into the kerb, unevenly, as if added over time.
    for (let k = 0; k < 5; k++) {
      const a = hsh(70 + k) * Math.PI * 2, r = 2;
      const mx = cx + Math.round(Math.cos(a) * r), mz = cz + Math.round(Math.sin(a) * r);
      if (mx === cx && mz === cz) continue;
      if (this._subGet(chunk, mx, baseY, mz) === BLOCK.AIR) S(mx, baseY, mz, BLOCK.HEADSTONE_SLAB);
    }
  }

  /* Stamp one minor structure. The three building kinds reuse the archetype pipeline
     exactly as farmsteads do, so a solitary field shed is built from the same shell,
     roof, opening and deterioration code as a shed in a yard — there is no second
     building system. The four prop kinds are direct placements. */
  _farmStampMinor(chunk, mn) {
    if (!this._subHits(chunk, mn.ox - 2, mn.oz - 2, mn.x1 + 2, mn.z1 + 2)) return;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const hsh = (n) => this._farmHash(mn.mx * 19 + n, mn.mz * 23 + n, 439);
    const baseY = mn.padY;

    switch (mn.kind) {
      case FARM_MINOR.SHED:
      case FARM_MINOR.RUIN:
      case FARM_MINOR.SHELTER: {
        const arch = mn.kind === FARM_MINOR.SHED
          ? (hsh(1) < 0.5 ? 'shed' : 'utility')
          : (mn.kind === FARM_MINOR.SHELTER ? 'animalShelter' : 'shed');
        const A = FARM_ARCH[arch];
        // Ruins are always heavily gone; solitary sheds keep the full decay spread.
        const decay = mn.kind === FARM_MINOR.RUIN ? 3 : mn.decay;
        const b = {
          arch, x: mn.ox, z: mn.oz, w: A.w, d: A.d, ridge: A.ridge, baseY,
          side: hsh(2) < 0.45 ? BLOCK.FARM_CLAPBOARD : (hsh(3) < 0.5 ? BLOCK.BARN_RED : BLOCK.BARN_WHITE),
          roofMat: hsh(4) < 0.55 ? BLOCK.ROOF_TIN : SUB_ROOF_SETS[Math.floor(hsh(5) * SUB_ROOF_SETS.length) % SUB_ROOF_SETS.length],
          face: Math.floor(hsh(6) * 4), decay, role: 'minor',
        };
        this._farmClearPlot(chunk, b.x - 1, b.z - 1, b.x + b.w + 1, b.z + b.d + 1, baseY, 0);
        this._farmStampBuilding(chunk, b, (n) => this._farmHash(b.x * 5 + n, b.z * 3 + n, 443));
        // A little evidence outside: something was kept here.
        if (hsh(7) < 0.5) S(b.x - 1, baseY, b.z + (A.d >> 1), hsh(8) < 0.5 ? BLOCK.BARREL : BLOCK.CRATE);
        break;
      }
      case FARM_MINOR.WELL: {
        const wx = mn.ox + 1, wz = mn.oz + 1;
        for (let dx = -1; dx <= 2; dx++)
          for (let dz = -1; dz <= 2; dz++) {
            S(wx + dx, baseY - 1, wz + dz, BLOCK.FARM_TRACK);
            for (let dy = 0; dy < 4; dy++) S(wx + dx, baseY + dy, wz + dz, BLOCK.AIR);
          }
        S(wx, baseY, wz, BLOCK.WELL_RIM);
        for (let dy = 1; dy <= 7; dy++) S(wx, baseY - dy, wz, BLOCK.AIR);
        S(wx - 1, baseY, wz, BLOCK.WELL_POST); S(wx + 1, baseY, wz, BLOCK.WELL_POST);
        S(wx - 1, baseY + 1, wz, BLOCK.WELL_POST); S(wx + 1, baseY + 1, wz, BLOCK.WELL_POST);
        S(wx, baseY + 1, wz, BLOCK.WELL_WINCH);
        if (hsh(9) < 0.5) S(wx + 2, baseY, wz, BLOCK.TROUGH);
        break;
      }
      case FARM_MINOR.HAYSTACK: {
        // Bales left out over a winter that never ended.
        const n = 3 + Math.floor(hsh(10) * 4);
        for (let k = 0; k < n; k++) {
          const px = mn.ox + Math.floor(hsh(20 + k) * mn.size);
          const pz = mn.oz + Math.floor(hsh(30 + k) * mn.size);
          const h = this._farmHeightAt(px, pz);
          S(px, h, pz, BLOCK.HAY_BALE);
          if (hsh(40 + k) < 0.35) S(px, h + 1, pz, BLOCK.HAY_BALE);
        }
        break;
      }
      case FARM_MINOR.MACHINERY: {
        // Stopped at the headland and never moved again.
        const px = mn.ox + 1, pz = mn.oz + 1, h = this._farmHeightAt(px, pz);
        const pick = hsh(11);
        if (pick < 0.4) { S(px, h, pz, BLOCK.TRACTOR_BODY); S(px, h, pz + 1, BLOCK.TRACTOR_WHEEL); }
        else if (pick < 0.7) {
          S(px, h, pz, BLOCK.WAGON_BED);
          S(px + 1, h, pz, BLOCK.WHEEL_SPOKE); S(px - 1, h, pz, BLOCK.WHEEL_SPOKE);
        } else { S(px, h, pz, BLOCK.PLOUGH); if (hsh(12) < 0.5) S(px + 1, h, pz, BLOCK.WHEEL_SPOKE); }
        if (hsh(13) < 0.4) S(px + 2, h, pz + 1, BLOCK.BARREL);
        break;
      }
      case FARM_MINOR.GATE: {
        /* A gate and a short run of fence where a track meets a field — the smallest
           possible piece of built evidence, and the one that most often tells a player
           at distance that the land here was worked and divided. */
        const alongX = hsh(14) < 0.5;
        for (let k = 0; k < mn.size; k++) {
          const px = alongX ? mn.ox + k : mn.ox, pz = alongX ? mn.oz : mn.oz + k;
          const h = this._farmHeightAt(px, pz);
          if (k === (mn.size >> 1)) { S(px, h, pz, alongX ? BLOCK.FIELD_GATE_X : BLOCK.FIELD_GATE_Z); continue; }
          if (this._farmHash(px, pz, 449) < 0.18) continue;   // fallen sections
          S(px, h, pz, (k & 3) === 0 ? BLOCK.FENCE_POST
                                     : (alongX ? BLOCK.FARM_FENCE_X : BLOCK.FARM_FENCE_Z));
        }
        break;
      }
      case FARM_MINOR.WATERTOWER: {
        /* PHASE 18 — A WATER TOWER, assembled entirely from Phase 16/17 pieces: four
           timber legs, a corrugated tank, a silo cap and a ladder up one leg. It exists
           for two reasons and both are structural rather than decorative — it is the
           second tall silhouette in a dimension that is otherwise entirely horizontal,
           and it is the physical referent that lets a WATER TOWER sign be honest.

           No new block ids, no new shapes, no new material. */
        const cx2 = mn.ox + 3, cz2 = mn.oz + 3;
        const legH = 6 + Math.floor(hsh(20) * 4);
        this._farmClearPlot(chunk, mn.ox, mn.oz, mn.x1, mn.z1, baseY, 0);
        for (const [lx, lz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
          for (let dy = 0; dy < legH; dy++) S(cx2 + lx, baseY + dy, cz2 + lz, BLOCK.POST_TIMBER);
          S(cx2 + lx, baseY - 1, cz2 + lz, BLOCK.FIELDSTONE);
        }
        // Cross-bracing: without it the legs read as four unrelated posts.
        for (let k = -1; k <= 1; k++) {
          S(cx2 + k, baseY + (legH >> 1), cz2 - 2, BLOCK.BEAM_X);
          S(cx2 + k, baseY + (legH >> 1), cz2 + 2, BLOCK.BEAM_X);
          S(cx2 - 2, baseY + (legH >> 1), cz2 + k, BLOCK.BEAM_Z);
          S(cx2 + 2, baseY + (legH >> 1), cz2 + k, BLOCK.BEAM_Z);
        }
        for (let dx = -2; dx <= 2; dx++)
          for (let dz = -2; dz <= 2; dz++) {
            if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;   // clip the corners
            S(cx2 + dx, baseY + legH, cz2 + dz, BLOCK.CORRUGATED);
            for (let dy = 1; dy <= 2; dy++) S(cx2 + dx, baseY + legH + dy, cz2 + dz, BLOCK.CORRUGATED);
            S(cx2 + dx, baseY + legH + 3, cz2 + dz, BLOCK.SILO_CONE);
          }
        for (let dy = 1; dy < legH; dy++) S(cx2 - 2, baseY + dy, cz2 - 3, BLOCK.LADDER_S);
        // A worn track out to whichever lane justified putting it here.
        this._farmSpurToLane(chunk, cx2, cz2, 1);
        break;
      }
    }

    /* PHASE 18 — a stock shelter is somewhere animals were driven TO, so about half of
       them get a worn side path back to the road. This is the brief's "worn side paths"
       and its "short dead ends" in one: the path goes somewhere, and then it stops. */
    if (mn.kind === FARM_MINOR.SHELTER && hsh(21) < 0.5) {
      this._farmSpurToLane(chunk, mn.ox + (mn.size >> 1), mn.oz + (mn.size >> 1), 0);
    }
  }

  /* Writes one sign: two posts, a two-cell board and, for a fingerpost, a pointed arrow
     panel on the side the destination lies. Everything routes through the clipped setter
     so a sign that straddles a chunk border comes out identical from either side.

     THE GROUND IS CHECKED, NOT ASSUMED. A post standing in a ditch or hanging over a
     stream would be worse than no sign at all, so the base is taken from the actual
     column and the whole assembly is skipped if the two post columns disagree by more
     than a block. Being able to decline is what lets placement stay a pure lookup. */
  _farmStampSign(chunk, sg) {
    if (!this._subHits(chunk, sg.rx0, sg.rz0, sg.rx1, sg.rz1)) return;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const ax = sg.run === 'x' ? 1 : 0, az = sg.run === 'z' ? 1 : 0;
    const x0 = sg.x, z0 = sg.z, x1 = sg.x + ax, z1 = sg.z + az;
    const h0 = this._farmHeightAt(x0, z0), h1 = this._farmHeightAt(x1, z1);
    if (Math.abs(h0 - h1) > 1) return;
    const baseY = Math.max(h0, h1);

    // Clear the column so a crop or a tussock cannot grow through the post.
    for (let dy = 0; dy < 4; dy++) { S(x0, baseY + dy, z0, BLOCK.AIR); S(x1, baseY + dy, z1, BLOCK.AIR); }
    S(x0, baseY, z0, BLOCK.SIGN_POST); S(x0, baseY + 1, z0, BLOCK.SIGN_POST);
    S(x1, baseY, z1, BLOCK.SIGN_POST); S(x1, baseY + 1, z1, BLOCK.SIGN_POST);

    const boardY = baseY + 2;
    if (sg.mode === 'blank' || sg.nameIdx < 0) {
      const id = sg.run === 'x' ? BLOCK.SIGN_BLANK_X : BLOCK.SIGN_BLANK_Z;
      S(x0, boardY, z0, id); S(x1, boardY, z1, id);
    } else {
      /* The four-id slot convention, written out where it is used: the lower cell of the
         run takes slot +0 (X) or +2 (Z), the upper cell +1 or +3. Getting these the wrong
         way round is the one failure mode that produces a sign reading backwards, which
         is why signread.js reconstructs the pipeline rather than trusting this. */
      const b = BLOCK.SIGN_TEXT_BASE + sg.nameIdx * 4 + (sg.run === 'x' ? 0 : 2);
      S(x0, boardY, z0, b + 0);
      S(x1, boardY, z1, b + 1);
    }

    // The fingerpost's point, on the side the destination actually lies.
    if (sg.mode === 'dest' && sg.arrow !== 0) {
      const axPos = sg.arrow > 0;
      const arrowId = sg.run === 'x'
        ? (axPos ? BLOCK.SIGN_ARROW_XP : BLOCK.SIGN_ARROW_XN)
        : (axPos ? BLOCK.SIGN_ARROW_ZP : BLOCK.SIGN_ARROW_ZN);
      const px = sg.run === 'x' ? (axPos ? x1 + 1 : x0 - 1) : x0;
      const pz = sg.run === 'z' ? (axPos ? z1 + 1 : z0 - 1) : z0;
      if (this._farmGet(chunk, px, boardY, pz) !== -1) {
        S(px, boardY, pz, BLOCK.AIR);
        S(px, boardY, pz, arrowId);
      }
    }
  }

  /* ===================================================================================
     PHASE 20 — THE MASSIVE WATER TOWER

     THIRTY-SEVEN BLOCKS, AND THE NUMBER IS THE DESIGN. The tallest thing Phase 17 builds
     is an eight-block barn; the Phase 18 water tower reached about twelve. In a dimension
     whose entire relief is ten blocks, a structure nearly four times the height of
     anything else does not merely stand out — it becomes the only vertical reference the
     player has, which is exactly what the brief asks for when it says the route should
     appear to lead there without a marker.

     IT IS ORDINARY RURAL INFRASTRUCTURE AND IT IS BUILT LIKE ONE. Four stanchions on
     fieldstone footings, three courses of cross-bracing, a riveted drum with two rib
     hoops, a domed crown, a service ladder up one leg, a catwalk gallery under the tank,
     a riser and a water main running out to a pump house, a stop valve, a wire fence with
     a field gate, and a worn service track back to the lane. Nothing about it is
     supernatural and nothing about it should be. The wrongness is one small red lamp at
     the top of the mast and it is not in the voxel data at all — see updateFarmTowerLight.

     THE FACILITY IS NOT A DUNGEON. There is no interior to clear, no loot, no encounter
     and no objective; the pump house is four blocks square and the tank is sealed. The
     player walks up to it, stands under it, notices something they cannot quite confirm,
     and walks on. That restraint is the whole point of requirement 20.
     =================================================================================== */
  _farmStampTower(chunk) {
    const T = this.farmTower;
    if (!T) return;
    if (!this._subHits(chunk, T.ox - 3, T.oz - 3, T.x1 + 3, T.z1 + 3)) return;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const G = (wx, wy, wz) => this._subGet(chunk, wx, wy, wz);
    const hsh = (n) => this._farmHash(T.cx * 13 + n, T.cz * 17 + n, 913);
    const b = T.padY, cx = T.cx, cz = T.cz;

    /* --- THE PLATFORM. Graded, trampled, and drained. A facility yard is not a field:
       it is compacted ground with nothing growing on it and standing water in the ruts,
       and getting that right is most of why the tower reads as a working site rather
       than as a model dropped in a meadow. */
    for (let wx = T.ox; wx < T.x1; wx++) {
      for (let wz = T.oz; wz < T.z1; wz++) {
        const ex = Math.min(wx - T.ox, T.x1 - 1 - wx), ez = Math.min(wz - T.oz, T.z1 - 1 - wz);
        const edge = Math.min(ex, ez);
        for (let dy = 0; dy < 12; dy++) S(wx, b + dy, wz, BLOCK.AIR);
        const r = this._farmHash(wx, wz, 917);
        let ground;
        if (edge === 0) ground = BLOCK.SOIL_OVERGROWN;              // the fence line, gone to weed
        else if (r < 0.16) ground = BLOCK.FARM_MUD;
        else if (r < 0.34) ground = BLOCK.SOIL_DRY;
        else ground = BLOCK.SOIL_TRAMPLED;
        S(wx, b - 1, wz, ground);
        /* THE RETAINING COURSE. Where the platform was cut or filled against the natural
           field, a course of fieldstone holds it — without it a capped pad reads as a
           one-block cliff of soil, which is the single most common tell that a plot was
           levelled by a generator rather than by people. */
        if (edge <= 1) {
          // The lookup is twenty simplex evaluations; only the rim ever needs it.
          const nat = this._farmBaseHeightAt(wx, wz);
          if (nat < b) for (let y = nat - 1; y < b; y++) S(wx, y, wz, BLOCK.FIELDSTONE);
        }
        if (edge >= 2 && r > 0.985) S(wx, b, wz, BLOCK.WEED_CLUMP);
        else if (edge >= 2 && r > 0.972) S(wx, b, wz, BLOCK.SMALL_STONES);
      }
    }

    // --- FOOTINGS AND STANCHIONS -----------------------------------------------------
    const LEG = 5;                       // half the leg spacing: a 10-block base square
    const legs = [[-LEG, -LEG], [LEG, -LEG], [-LEG, LEG], [LEG, LEG]];
    for (const [lx, lz] of legs) {
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          S(cx + lx + dx, b - 1, cz + lz + dz, BLOCK.FIELDSTONE);
          S(cx + lx + dx, b - 2, cz + lz + dz, BLOCK.FIELDSTONE);
        }
      for (let dy = 0; dy < FARM_TOWER_LEG_H; dy++) S(cx + lx, b + dy, cz + lz, BLOCK.TOWER_LEG);
    }

    /* --- CROSS-BRACING, on three courses. Without it the four legs read as four
       unrelated posts and the tank appears to float; with it the whole understructure
       reads as one truss, which is what carries the silhouette at distance. */
    for (const ty of [6, 12, 18]) {
      const y = b + ty;
      for (let k = -LEG + 1; k <= LEG - 1; k++) {
        S(cx + k, y, cz - LEG, BLOCK.TOWER_BRACE_X);
        S(cx + k, y, cz + LEG, BLOCK.TOWER_BRACE_X);
        S(cx - LEG, y, cz + k, BLOCK.TOWER_BRACE_Z);
        S(cx + LEG, y, cz + k, BLOCK.TOWER_BRACE_Z);
      }
    }

    /* --- THE SERVICE LADDER, up the outside of the south-west leg and on to the
       catwalk. Ladders are noclip and the existing step-up handles the climb, so the
       gallery is somewhere a player can genuinely stand — the tower is not a backdrop. */
    for (let dy = 1; dy <= FARM_TOWER_LEG_H; dy++) {
      S(cx - LEG, b + dy, cz - LEG - 1, BLOCK.LADDER_S);
    }

    /* --- THE CATWALK, a gallery ring one course under the tank. Run-tiled on its axis,
       so the whole ring is a handful of quads. */
    const cwY = b + FARM_TOWER_LEG_H - 1;
    const CW = FARM_TOWER_R + 1;
    for (let k = -CW; k <= CW; k++) {
      if (Math.abs(k) > CW - 1) continue;
      S(cx + k, cwY, cz - CW, BLOCK.CATWALK_X);
      S(cx + k, cwY, cz + CW, BLOCK.CATWALK_X);
      S(cx - CW, cwY, cz + k, BLOCK.CATWALK_Z);
      S(cx + CW, cwY, cz + k, BLOCK.CATWALK_Z);
    }

    /* --- THE TANK. A thirteen-block drum, approximated as an octagon: |dx| and |dz| both
       inside the radius AND their sum inside radius+2, which cuts the four corners at
       forty-five degrees. At the distances this thing is meant to be read from, an
       octagon and a circle are the same silhouette, and it costs no curved geometry.

       THE RIB HOOPS are on the second and second-to-last courses. Two horizontal bands
       are what turn a box of plate into a cylinder for the eye — more than any amount of
       corner-cutting does. */
    const R = FARM_TOWER_R;
    const inDrum = (dx, dz, rad) => Math.abs(dx) <= rad && Math.abs(dz) <= rad &&
                                    Math.abs(dx) + Math.abs(dz) <= rad + 2;
    for (let ty = 0; ty < FARM_TOWER_TANK_H; ty++) {
      const y = b + FARM_TOWER_LEG_H + ty;
      const rib = (ty === 1 || ty === FARM_TOWER_TANK_H - 2);
      for (let dx = -R; dx <= R; dx++)
        for (let dz = -R; dz <= R; dz++) {
          if (!inDrum(dx, dz, R)) continue;
          S(cx + dx, y, cz + dz, rib ? BLOCK.TOWER_TANK_RIB : BLOCK.TOWER_TANK);
        }
    }

    // --- THE DOME AND THE MAST -------------------------------------------------------
    const domeY = b + FARM_TOWER_LEG_H + FARM_TOWER_TANK_H;
    for (let ring = 0; ring < 3; ring++) {
      const rad = R - 1 - ring * 2;
      for (let dx = -rad; dx <= rad; dx++)
        for (let dz = -rad; dz <= rad; dz++) {
          if (!inDrum(dx, dz, rad)) continue;
          S(cx + dx, domeY + ring, cz + dz, BLOCK.TOWER_DOME);
        }
    }
    S(cx, domeY + 3, cz, BLOCK.TOWER_MAST);
    S(cx, domeY + 4, cz, BLOCK.TOWER_MAST);
    // The lamp housing. Always here, always dark in the voxel pass.
    S(cx, T.lampY, cz, BLOCK.TOWER_LAMP);

    /* --- THE RISER AND THE MAIN. A water tower with no pipe leaving it is a sculpture.
       The riser climbs the north-east leg to the tank and the main leaves the base and
       runs west to the pump house, with the stop valve where a hand could reach it. */
    for (let dy = 0; dy <= FARM_TOWER_LEG_H; dy++) S(cx + LEG + 1, b + dy, cz, BLOCK.RISER_PIPE);
    const pumpX = T.ox + 3, pumpZ = T.oz + 3;
    for (let wx = pumpX + 4; wx <= cx + LEG + 1; wx++) S(wx, b, cz, BLOCK.PIPE_X);
    for (let wz = pumpZ + 2; wz < cz; wz++) S(pumpX + 4, b, wz, BLOCK.PIPE_Z);
    S(pumpX + 4, b + 1, cz - 3, BLOCK.VALVE_WHEEL);
    S(cx + LEG + 3, b, cz, BLOCK.WATER_PUMP);

    /* --- THE PUMP HOUSE. Four blocks square, built through the ordinary archetype
       pipeline exactly as every other Farmlands building is — there is no second
       building system in this phase either. */
    const pump = {
      arch: 'utility', x: pumpX, z: pumpZ, w: FARM_ARCH.utility.w, d: FARM_ARCH.utility.d,
      ridge: FARM_ARCH.utility.ridge, baseY: b,
      side: BLOCK.BARN_WHITE, roofMat: BLOCK.ROOF_TIN,
      face: 3, decay: hsh(3) < 0.55 ? 1 : 2, role: 'tower',
    };
    this._farmStampBuilding(chunk, pump, (n) => this._farmHash(pumpX * 5 + n, pumpZ * 3 + n, 919));
    if (hsh(4) < 0.7) S(pumpX - 1, b, pumpZ + 2, BLOCK.BARREL);
    if (hsh(5) < 0.6) S(pumpX + 5, b, pumpZ + 1, BLOCK.CRATE);

    /* --- DRAINAGE. The facility sheds water and it has to go somewhere: a shallow ditch
       along the low edge with a culvert under the gate, and a stagnant puddle in the
       ruts under the tank. This is Phase 19 vocabulary and it is here because a graded
       yard with no drainage is the sort of detail whose absence nobody names and
       everybody feels. */
    for (let wz = T.oz + 4; wz < T.z1 - 4; wz++) {
      S(T.ox + 1, b - 1, wz, BLOCK.DITCH_MUD);
      if (this._farmHash(T.ox + 1, wz, 921) < 0.5) S(T.ox + 1, b, wz, BLOCK.REEDS);
    }
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > 3) continue;
        if (this._farmHash(cx + dx, cz + dz, 923) < 0.55) {
          S(cx + dx, b - 1, cz + dz, BLOCK.SOIL_WET);
          S(cx + dx, b, cz + dz, BLOCK.WATER_SHALLOW);
        }
      }

    /* --- THE FENCE AND THE GATE. Wire on posts around the compound, the gate on the side
       the service track arrives from, and one section already down. */
    /* PHASE 20 REVISION — THE GATE FACES THE ROAD, and until now it did not. The journey
       axis is east-west, so the lane runs along the facility's north or south edge
       depending on which parcel row the site resolved into; the gateway was being cut in
       an east edge with open field behind it, and the service track then had to leave the
       compound sideways to find the road. Derived from the site descriptor, it is correct
       for either row. */
    const gateZ = T.south ? T.oz : T.z1 - 1;
    for (let wz = T.oz; wz < T.z1; wz++) {
      for (const wx of [T.ox, T.x1 - 1]) {
        if (this._farmHash(wx, wz, 929) < 0.12) continue;                     // fallen sections
        S(wx, b, wz, ((wz & 3) === 0) ? BLOCK.FENCE_POST : BLOCK.FARM_FENCE_Z);
      }
    }
    for (let wx = T.ox; wx < T.x1; wx++) {
      for (const wz of [T.oz, T.z1 - 1]) {
        if (wz === gateZ && Math.abs(wx - cx) <= 1) continue;                 // the gateway
        if (this._farmHash(wx, wz, 931) < 0.12) continue;
        S(wx, b, wz, ((wx & 3) === 0) ? BLOCK.FENCE_POST : BLOCK.FARM_FENCE_X);
      }
    }
    S(cx, b, gateZ, BLOCK.FIELD_GATE_X);
    S(cx - 1, b - 1, gateZ, BLOCK.CULVERT_X);

    /* --- THE SERVICE TRACK back to the lane. The road does not merely pass the tower:
       something drove in here, regularly, for years, and the track it wore is what makes
       the facility part of the road network rather than an object beside it. */
    this._farmSpurToLane(chunk, cx, gateZ + (T.south ? -1 : 1), 1);
    for (let k = 1; k <= 4; k++) {
      const wz = gateZ + (T.south ? -k : k);
      S(cx - 1, b - 1, wz, BLOCK.TIRE_TRACK);
      S(cx + 1, b - 1, wz, BLOCK.TIRE_TRACK);
    }
  }

  /* ===================================================================================
     PHASE 20 REVISION — THE GIANT FALLEN WATER TOWER

     THE FIRST LANDMARK OF THE JOURNEY, AND IT IS THE SAME OBJECT AS THE LAST ONE THE
     PLAYER WILL MEET. That is the entire idea. Six parcels out of the arrival crossroads
     a water tower is lying on its side across two fields — legs sheared off their
     footings, the drum split along a seam, thirty-seven blocks of it end to end — and it
     is unmistakably a water tower, so when a second one is standing intact on the horizon
     an hour later the player already knows exactly how big that is. It teaches the scale
     of the landmark chain without one word of UI.

     IT IS NOT A HORROR EVENT AND NOTHING ABOUT IT IS SUPERNATURAL. A structure fell down.
     It has been lying here long enough for weeds to grow through it and for the main to
     have been leaking into the same puddle for years. The wrongness in this dimension is
     rationed, and none of it is spent here.

     THE GEOMETRY IS THE STANDING TOWER, ROTATED. Truss, drum, dome, mast and lamp housing
     in the same order along the ground that they occupy in the air, which is what makes
     the two read as the same object rather than as a wreck and a tower.
     =================================================================================== */
  _farmStampFallenTower(chunk) {
    const F = this.farmFallen;
    if (!F) return;
    if (!this._subHits(chunk, F.ox - 3, F.oz - 3, F.x1 + 3, F.z1 + 3)) return;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const b = F.padY, cx = F.cx;
    const hsh = (n) => this._farmHash(F.cx * 13 + n, F.cz * 17 + n, 955);
    /* THE WRECK IS LAID OUT ROAD-RELATIVE, exactly as the barn's yard is, so it presents
       its length broadside whichever parcel row the site resolved into. `t` counts blocks
       inward from the plot edge the journey lane runs along: footings at 5, twenty-two
       blocks of frame from 7, the drum from 30, the dome, the mast, and the lamp housing
       at 44 — one block inside a forty-six-block plot. */
    const laneEdge = F.south ? F.oz : F.z1 - 1;
    const inward = F.south ? 1 : -1;
    const fz = (t) => laneEdge + inward * t;

    /* --- THE GROUND. Not a facility yard: this stopped being one decades ago. Beaten
       ground survives immediately under the wreck, where nothing could ever regrow, and
       everything around it has gone back to weed — which is the single strongest signal
       that the fall was long ago rather than last week. */
    for (let wx = F.ox; wx < F.x1; wx++) {
      for (let wz = F.oz; wz < F.z1; wz++) {
        const r = this._farmHash(wx, wz, 957);
        const underWreck = Math.abs(wx - cx) <= 7;
        for (let dy = 0; dy < 14; dy++) S(wx, b + dy, wz, BLOCK.AIR);
        let ground;
        if (underWreck) ground = r < 0.30 ? BLOCK.FARM_MUD : (r < 0.62 ? BLOCK.SOIL_TRAMPLED : BLOCK.DEAD_EARTH);
        else ground = r < 0.42 ? BLOCK.SOIL_OVERGROWN : (r < 0.72 ? BLOCK.ROTTED_SOIL : BLOCK.SOIL_DRY);
        S(wx, b - 1, wz, ground);
        /* THE HEIGHTFIELD LOOKUP IS INSIDE THE EDGE TEST, and that is a measured
           difference rather than tidiness. _farmBaseHeightAt is twenty simplex
           evaluations; called for all 1,196 columns of the plot instead of the 140 on
           its rim it doubled this landmark's generation cost for a retaining course
           that only ever exists at the edge. */
        const edge = Math.min(wx - F.ox, F.x1 - 1 - wx, wz - F.oz, F.z1 - 1 - wz);
        if (edge <= 1) {
          const nat = this._farmBaseHeightAt(wx, wz);
          if (nat < b) for (let y = nat - 1; y < b; y++) S(wx, y, wz, BLOCK.FIELDSTONE);
        }
        if (!underWreck && r > 0.955) S(wx, b, wz, BLOCK.WEED_CLUMP);
        else if (!underWreck && r > 0.90) S(wx, b, wz, BLOCK.DRY_TUSSOCK);
      }
    }

    /* --- THE FOOTINGS IT LEFT BEHIND. Four fieldstone pads and four sheared stubs of
       leg still bolted to them. Without these the wreck is a pipe lying in a field; with
       them the player can see where it stood and which way it went over. */
    const footZ = fz(5), LEG = 5;
    for (const [lx, lz] of [[-LEG, -LEG], [LEG, -LEG], [-LEG, LEG], [LEG, LEG]]) {
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          S(cx + lx + dx, b - 1, footZ + lz + dz, BLOCK.FIELDSTONE);
          S(cx + lx + dx, b - 2, footZ + lz + dz, BLOCK.FIELDSTONE);
        }
      const stub = 1 + Math.floor(hsh(lx + lz * 3 + 7) * 3);       // sheared at knee height
      for (let dy = 0; dy < stub; dy++) S(cx + lx, b + dy, footZ + lz, BLOCK.TOWER_LEG);
    }

    /* --- THE TRUSS, LYING ON ITS SIDE. The ten-block leg square is now ten wide and ten
       tall, so the four legs are four rails: two on the ground and two overhead, with the
       bracing courses standing as vertical ladders between them. The player can walk in
       under it, which is most of why the thing reads as enormous. */
    const t0 = 7;                                    // where the frame begins
    const yLo = b, yHi = b + 10;
    for (let k = 0; k <= FARM_TOWER_LEG_H; k++) {
      const wz = fz(t0 + k);
      // A collapsed frame is not straight: the far end settled lower than the near end.
      const sag = k > 14 ? 1 : 0;
      for (const wx of [cx - LEG, cx + LEG]) {
        S(wx, yLo, wz, BLOCK.TOWER_LEG);
        S(wx, yHi - sag, wz, BLOCK.TOWER_LEG);
        S(wx, yLo + 5, wz, BLOCK.TOWER_BRACE_Z);      // the mid rail, along the length
      }
      /* THE BRACING IS ON A THREE-BLOCK PITCH, not six, and that was a render decision:
         four rails and an upright every six blocks read at forty metres as a wire fence
         rather than as a steel truss, which cost the wreck most of its mass. Three
         courses of rail and an upright every third block is sixty more voxels and reads
         as what it is. */
      if (k % 3 === 1) {                              // the bracing courses, now uprights
        for (let y = yLo + 1; y < yHi - sag; y++) {
          S(cx - LEG, y, wz, BLOCK.TOWER_BRACE_X);
          S(cx + LEG, y, wz, BLOCK.TOWER_BRACE_X);
        }
        for (let dx = -LEG + 1; dx <= LEG - 1; dx++) S(cx + dx, yLo, wz, BLOCK.TOWER_BRACE_Z);
      }
    }
    // The catwalk ring, crushed under the drum end and still recognisable.
    for (let dx = -FARM_TOWER_R; dx <= FARM_TOWER_R; dx++) {
      if (this._farmHash(dx, 0, 959) < 0.3) continue;
      S(cx + dx, b, fz(t0 + FARM_TOWER_LEG_H), BLOCK.CATWALK_Z);
    }

    /* --- THE DRUM. The same octagon the standing tower uses, turned a quarter turn so it
       is cut in the X-Y plane instead of the X-Z one. It rests on its side, so its axis
       is FARM_TOWER_R above the ground.

       AND IT IS SPLIT. A seam has opened along the upper flank — TANK_TORN plate on the
       lip and open air behind it — which is the one detail that stops the drum reading as
       a clean cylinder somebody laid down carefully. */
    const t1 = t0 + FARM_TOWER_LEG_H + 1;
    const axisY = b + FARM_TOWER_R;
    const inDrum = (dx, dy, rad) => Math.abs(dx) <= rad && Math.abs(dy) <= rad &&
                                    Math.abs(dx) + Math.abs(dy) <= rad + 2;
    for (let t = 0; t < FARM_TOWER_TANK_H; t++) {
      const wz = fz(t1 + t);
      const rib = (t === 1 || t === FARM_TOWER_TANK_H - 2);
      for (let dx = -FARM_TOWER_R; dx <= FARM_TOWER_R; dx++)
        for (let dy = -FARM_TOWER_R; dy <= FARM_TOWER_R; dy++) {
          if (!inDrum(dx, dy, FARM_TOWER_R)) continue;
          const shell = !inDrum(dx, dy, FARM_TOWER_R - 1);
          const y = axisY + dy;
          if (y < b) continue;                       // the underside is buried in the scar
          if (!shell) { S(cx + dx, y, wz, BLOCK.AIR); continue; }
          // The split: an opening along the top flank, three plates wide.
          const torn = dy >= 1 && dx <= -1 && t >= 1 && t <= FARM_TOWER_TANK_H - 2;
          if (torn && this._farmHash(wz, dx * 7 + dy, 961) < 0.62) {
            S(cx + dx, y, wz, BLOCK.AIR);
            continue;
          }
          S(cx + dx, y, wz, torn ? BLOCK.TANK_TORN : (rib ? BLOCK.TOWER_TANK_RIB : BLOCK.TOWER_TANK));
        }
    }

    // --- THE DOME AND THE MAST, still bolted on, buried nose-first in the field.
    const t2 = t1 + FARM_TOWER_TANK_H;
    for (let ring = 0; ring < 3; ring++) {
      const rad = FARM_TOWER_R - 1 - ring * 2;
      for (let dx = -rad; dx <= rad; dx++)
        for (let dy = -rad; dy <= rad; dy++) {
          if (!inDrum(dx, dy, rad)) continue;
          const y = axisY + dy;
          if (y < b) continue;
          S(cx + dx, y, fz(t2 + ring), BLOCK.TOWER_DOME);
        }
    }
    S(cx, axisY, fz(t2 + 3), BLOCK.TOWER_MAST);
    S(cx, axisY, fz(t2 + 4), BLOCK.TOWER_MAST);
    /* THE LAMP HOUSING, lying in the dirt at the end of the mast where a player can walk
       up and stand over it. It is dark and it stays dark. Nothing in the anomaly code
       knows this block exists — see updateFarmTowerLight, which drives exactly one lamp
       and it is the one on the tower that is still standing. */
    S(cx, axisY, fz(t2 + 5), BLOCK.TOWER_LAMP);

    /* --- THE SCAR. Something thirty-seven blocks long hit this field, and the ground
       still shows it: a churned trench under the drum where the weight landed, and a
       spray of thrown earth beyond the nose. */
    for (let t = t1 - 2; t <= t2 + 6; t++) {
      const wz = fz(t);
      if (wz < F.oz || wz >= F.z1) continue;
      for (let dx = -8; dx <= 8; dx++) {
        const r = this._farmHash(cx + dx, wz, 963);
        if (r > 0.55 - Math.abs(dx) * 0.05) continue;
        S(cx + dx, b - 1, wz, r < 0.18 ? BLOCK.GRAVE_SOIL : BLOCK.FARM_MUD);
      }
    }

    /* --- THE MAIN THAT NEVER GOT CAPPED. The riser snapped off at the base and the
       buried main is still fed from somewhere, so there has been a puddle at the old
       footings for as long as anyone can remember. Reeds have grown in it. This is the
       piece of environmental storytelling that makes the wreck a PLACE. */
    for (let wx = F.ox + 1; wx < cx - LEG; wx++) S(wx, b, footZ, BLOCK.PIPE_X);
    S(cx - LEG - 1, b, footZ, BLOCK.WATER_PUMP);
    for (let dx = -3; dx <= 3; dx++)
      for (let dz = -3; dz <= 3; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > 4) continue;
        if (this._farmHash(cx + dx, footZ + dz, 965) > 0.6) continue;
        S(cx + dx, b - 1, footZ + dz, BLOCK.SOIL_WET);
        S(cx + dx, b, footZ + dz, BLOCK.WATER_SHALLOW);
        if (this._farmHash(cx + dx, footZ + dz, 969) < 0.3) S(cx + dx, b + 1, footZ + dz, BLOCK.REEDS);
      }

    /* --- WRECKAGE, AND NOT MUCH OF IT. Four or five pieces along the length, because a
       field strewn with debris reads as a set dressing exercise and a field with one
       sheared brace lying twenty blocks from the frame reads as physics. */
    for (let n = 0; n < 6; n++) {
      const pz = F.oz + 4 + Math.floor(hsh(n * 3 + 11) * (F.d - 8));
      const px = F.ox + 2 + Math.floor(hsh(n * 3 + 12) * (F.w - 4));
      if (Math.abs(px - cx) <= 6) continue;                 // not under the wreck itself
      const pick = hsh(n * 3 + 13);
      S(px, b, pz, pick < 0.4 ? BLOCK.TOWER_BRACE_Z
                 : (pick < 0.7 ? BLOCK.BROKEN_WOOD : BLOCK.SMALL_STONES));
    }

    // --- The compound fence, long since down in most places.
    for (let wz = F.oz; wz < F.z1; wz++)
      for (const wx of [F.ox, F.x1 - 1]) {
        if (this._farmHash(wx, wz, 973) < 0.55) continue;
        S(wx, b, wz, ((wz & 3) === 0) ? BLOCK.POST_BROKEN : BLOCK.FENCE_BROKEN_Z);
      }
    for (let wx = F.ox; wx < F.x1; wx++)
      for (const wz of [F.oz, F.z1 - 1]) {
        if (this._farmHash(wx, wz, 975) < 0.55) continue;
        S(wx, b, wz, ((wx & 3) === 0) ? BLOCK.POST_BROKEN : BLOCK.FENCE_BROKEN_X);
      }
  }

  /* ===================================================================================
     PHASE 20 REVISION — THE GIANT BARN

     THE THIRD LANDMARK, AND THE ONLY ORDINARY ONE. After a wreck and a tower with a light
     that will not behave, the player walks up to a building that is simply very large and
     completely normal: a hay barn with a stone plinth, a full timber frame, two silos, a
     yard, a water trough and a lean-to. Nothing here is wrong. Requirement 6 of the
     project brief is that normality is part of the horror, and this is where the journey
     spends it — one long beat of believable agriculture between the tower's anomaly and
     the dead ground around the tree.

     IT IS BIG BECAUSE THE HIERARCHY NEEDS IT TO BE. Twenty-one blocks to the ridge and
     thirty-four across, against eight for the barns of Phase 17: from a distance it is
     obviously a barn and obviously far too big to be one of theirs, which is what keeps
     the player walking towards it. It is still shorter than the tower and far smaller
     than what comes after, so the ranking never breaks.
     =================================================================================== */
  _farmStampJourneyBarn(chunk) {
    const B = this.farmBarn;
    if (!B) return;
    if (!this._subHits(chunk, B.ox - 3, B.oz - 3, B.x1 + 3, B.z1 + 3)) return;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const b = B.padY;
    const hsh = (n) => this._farmHash(B.cx * 13 + n, B.cz * 17 + n, 981);

    // --- THE YARD. Compacted, drained, worked-in ground; no crop has been sown here.
    for (let wx = B.ox; wx < B.x1; wx++) {
      for (let wz = B.oz; wz < B.z1; wz++) {
        for (let dy = 0; dy < 26; dy++) S(wx, b + dy, wz, BLOCK.AIR);
        const r = this._farmHash(wx, wz, 985);
        S(wx, b - 1, wz, r < 0.20 ? BLOCK.FARM_MUD
                       : (r < 0.46 ? BLOCK.SOIL_TRAMPLED
                       : (r < 0.74 ? BLOCK.SOIL_DRY : BLOCK.DEAD_EARTH)));
        const edge = Math.min(wx - B.ox, B.x1 - 1 - wx, wz - B.oz, B.z1 - 1 - wz);
        if (edge <= 1) {                                  // see the fallen tower's yard
          const nat = this._farmBaseHeightAt(wx, wz);
          if (nat < b) for (let y = nat - 1; y < b; y++) S(wx, y, wz, BLOCK.FIELDSTONE);
        }
        if (edge >= 2 && r > 0.985) S(wx, b, wz, BLOCK.DRY_TUSSOCK);
      }
    }

    /* --- THE LAYOUT, AND IT IS MIRRORED ONTO WHICHEVER SIDE THE ROAD IS.

       The journey lane runs east-west along one edge of this plot — the north edge if
       the site resolved into the southern parcel row and the south edge if it did not —
       and a farmyard faces the road. So everything below is placed in FRONT-RELATIVE
       terms and mirrored, which also keeps the whole complex inside the levelled pad:
       the first pass hung the silos and the lean-to off the plot's east and west edges,
       where the pad has already begun banking back to the natural field, so their
       footings would have stood in mid-air on one side and been buried on the other. */
    const w = B.bw, d = B.bd, x = B.bx, z = B.bz;
    const laneEdge = B.laneEdge, inward = B.inward;
    const yz = (fz) => laneEdge + inward * fz;          // a yard row, fz blocks in
    const m = { x, z, w, d, floorY: b, plateY: b + FARM_BARN_H, roof: 'gable', ridge: 'x', main: true };
    for (let dx = -1; dx <= w; dx++)
      for (let dz = -1; dz <= d; dz++) S(x + dx, b - 1, z + dz, BLOCK.FIELDSTONE);
    this._subStampShell(chunk, m, BLOCK.BARN_RED, b);
    this._subStampRoof(chunk, m, [m], BLOCK.ROOF_TIN, b, BLOCK.BARN_RED, false);

    /* --- THE FRAME. A building this wide cannot be a box of siding: the eye needs to see
       what is holding the roof up, and a run of full bays down thirty-four blocks of
       interior is the single thing that makes the inside feel like a structure rather
       than a room. Posts, tie beams, and a longitudinal ridge beam over them. */
    for (let dx = 4; dx < w - 3; dx += 5) {
      for (const dz of [3, d - 4]) {
        for (let dy = 0; dy < FARM_BARN_H - 2; dy++) S(x + dx, b + dy, z + dz, BLOCK.POST_TIMBER);
      }
      for (let dz = 3; dz <= d - 4; dz++) S(x + dx, b + FARM_BARN_H - 2, z + dz, BLOCK.BEAM_Z);
    }
    for (let dx = 3; dx < w - 2; dx++) S(x + dx, b + FARM_BARN_H - 1, z + (d >> 1), BLOCK.BEAM_X);

    /* --- THE HAY LOFT. Half the length of the barn, boarded, reached by a ladder. There
       is nothing on it and nothing hidden in it; it exists because a barn this size that
       is one empty volume from floor to ridge reads as a shed. */
    const loftX0 = x + 3, loftX1 = x + 3 + 13, loftY = b + 8;
    for (let dx = loftX0; dx < loftX1; dx++)
      for (let dz = z + 3; dz <= z + d - 4; dz++) {
        S(dx, loftY, dz, BLOCK.WOOD_FLOOR);
        if (this._farmHash(dx, dz, 987) < 0.28) S(dx, loftY + 1, dz, BLOCK.LOFT_HAY);
      }
    for (let dy = 1; dy <= 8; dy++) S(loftX1, b + dy, z + 4, BLOCK.LADDER_S);
    /* THE GATE ROW is the plot edge the road is on, and everything in the yard has been
       placed relative to it, so the complex reads the same whichever row the site fell
       into and every part of it stands on the levelled pad. */

    /* --- THE DOORS. Two great sliding leaves on the yard side, one standing open. This
       is the only way in and it is genuinely open: the barn is walkable, unlit, and about
       as dark inside as a windowless building thirty-four blocks deep actually is. */
    const doorX = x + (w >> 1) - 3;
    const frontZ = B.south ? z : z + d - 1;             // the wall facing the yard
    const backZ = B.south ? z + d - 1 : z;
    for (let dx = 0; dx < 7; dx++)
      for (let dy = 0; dy < 9; dy++) S(doorX + dx, b + dy, frontZ, BLOCK.AIR);
    for (let dy = 0; dy < 9; dy++) {
      S(doorX - 1, b + dy, frontZ, BLOCK.BARN_DOOR_X);
      S(doorX + 7, b + dy, frontZ, BLOCK.BARN_DOOR_X);
    }
    // A smaller door at the far end, so nothing about the building is a dead end.
    for (let dx = 0; dx < 3; dx++)
      for (let dy = 0; dy < 5; dy++) S(x + (w >> 1) - 1 + dx, b + dy, backZ, BLOCK.AIR);

    /* --- THE SILOS. Two of them off the east gable, twenty-two blocks to the eaves of
       their cone caps. They add mass to the silhouette at distance without adding another
       tall thing to rank against the tower, and they are the reason the complex reads as
       a working farm from a kilometre away rather than as one big shed. */
    for (let n = 0; n < 2; n++) {
      const sx = x + w + 4 + n * 8, sz = z + 8 + n * 3;
      const hgt = FARM_SILO_H - n * 3;
      for (let dx = -FARM_SILO_R; dx <= FARM_SILO_R; dx++)
        for (let dz = -FARM_SILO_R; dz <= FARM_SILO_R; dz++) {
          const inside = dx * dx + dz * dz <= FARM_SILO_R * FARM_SILO_R;
          if (!inside) continue;
          const shell = dx * dx + dz * dz > (FARM_SILO_R - 1) * (FARM_SILO_R - 1);
          S(sx + dx, b - 1, sz + dz, BLOCK.FIELDSTONE);
          for (let dy = 0; dy < hgt; dy++) S(sx + dx, b + dy, sz + dz, shell ? BLOCK.SILO_TILE : BLOCK.AIR);
          S(sx + dx, b + hgt, sz + dz, BLOCK.SILO_CONE);
        }
      for (let dy = 1; dy < hgt; dy++) S(sx - FARM_SILO_R, b + dy, sz - FARM_SILO_R + 1, BLOCK.LADDER_W);
      // A short auger run from the silo back to the barn wall: the reason it is here.
      for (let wx2 = x + w; wx2 < sx - FARM_SILO_R; wx2++) S(wx2, b + 1, sz, BLOCK.PIPE_X);
    }

    /* --- THE LEAN-TO, THE TROUGH AND THE YARD KIT. Small, specific, agricultural, and
       every one of them is here because somebody would have needed it: a machinery bay
       open on one side, a water trough on the fence line where stock could reach it, a
       plough left where it was unhitched, and a stack of bales under cover. */
    const lx = x + 1, lz0 = Math.min(yz(2), yz(10)), lz1 = Math.max(yz(2), yz(10));
    for (let dx = 0; dx < 6; dx++)
      for (let wz = lz0; wz <= lz1; wz++) {
        S(lx + dx, b - 1, wz, BLOCK.FIELDSTONE);
        // Open on the yard side; walled on the other three.
        if (dx === 5 || wz === lz0 || wz === lz1) {
          for (let dy = 0; dy < 5; dy++) S(lx + dx, b + dy, wz, BLOCK.CORRUGATED);
        }
        S(lx + dx, b + 5, wz, BLOCK.CORRUGATED);
      }
    if (hsh(3) < 0.75) {
      S(lx + 2, b, yz(4), BLOCK.TRACTOR_BODY);
      S(lx + 2, b, yz(5), BLOCK.TRACTOR_WHEEL);
    }
    S(lx + 1, b, yz(8), BLOCK.PLOUGH);
    for (let k = 0; k < 4; k++) S(lx + 3, b + (k >> 1), yz(6 + (k & 1)), BLOCK.HAY_BALE);
    // The stock trough, out in the yard where an animal could reach it.
    S(x + 16, b, yz(3), BLOCK.WATER_PUMP);
    for (let k = 0; k < 4; k++) S(x + 17 + k, b, yz(3), BLOCK.WELL_RIM);

    /* --- THE STOCK FENCE, AND THE GATE FACES THE ROAD. Which edge that is follows from
       which side of the lane the site resolved onto: the journey lane runs east-west, so
       a plot south of it is gated on its north edge and a plot north of it on its south.
       Getting this from the site descriptor rather than from a constant is what lets the
       plot move between the two rows without the gateway ending up in a field. */
    const gateZ = laneEdge;
    for (let wz = B.oz; wz < B.z1; wz++)
      for (const wx of [B.ox, B.x1 - 1]) {
        if (this._farmHash(wx, wz, 989) < 0.14) continue;
        S(wx, b, wz, ((wz & 3) === 0) ? BLOCK.FENCE_POST : BLOCK.FARM_FENCE_Z);
      }
    for (let wx = B.ox; wx < B.x1; wx++)
      for (const wz of [B.oz, B.z1 - 1]) {
        if (wz === gateZ && Math.abs(wx - B.cx) <= 1) continue;              // the gateway
        if (this._farmHash(wx, wz, 995) < 0.14) continue;
        S(wx, b, wz, ((wx & 3) === 0) ? BLOCK.FENCE_POST : BLOCK.FARM_FENCE_X);
      }
    S(B.cx, b, gateZ, BLOCK.FIELD_GATE_X);

    // --- The track in. Something drove here every day for fifty years.
    this._farmSpurToLane(chunk, B.cx, gateZ + (B.south ? -1 : 1), 1);
    for (let k = 1; k <= 5; k++) {
      const wz = gateZ + (B.south ? -k : k);
      S(B.cx - 1, b - 1, wz, BLOCK.TIRE_TRACK);
      S(B.cx + 1, b - 1, wz, BLOCK.TIRE_TRACK);
    }
  }

  /* ===================================================================================
     PHASE 20 REVISION — THE GREAT TREE

     THE CLIMAX OF THE LANDMARK CHAIN, AND THE ONLY ONE THAT IS ALIVE.

     WHY IT IS THE BIGGEST THING IN THE DIMENSION. The brief's requirement is a scale
     hierarchy the eye can rank with no UI, ending in something that dwarfs everything
     before it. Height alone could not deliver that: chunk data stops at y=63 and the
     heightfield reaches 29, so nothing in the Farmlands can stand much more than thirty
     blocks above high ground and the standing tower has already spent that budget. So the
     tree wins on WIDTH — a crown fifty-two blocks across, wider than the tower is tall,
     with no ceiling to run into. From a distance it does not read as a tall thing; it
     reads as a MASS, which is exactly the impression a tree of this size should give.

     IT IS LUSH, AND EVERYTHING AROUND IT IS DEAD. That contradiction is the horror and it
     is stated entirely through the environment: see _farmDeadLand, which thins the crops,
     retreats the woodland and rots the soil across a two-hundred-block circle centred on
     this trunk. There is no note, no prompt, no objective and no explanation. A player
     walks a long way through fields that get worse and worse and arrives at the healthiest
     living thing they have seen since the Overworld.

     THE CANOPY IS A SHELL, NOT A SOLID. A filled crown of this size is roughly forty
     thousand voxels; the shell is under ten, it is opaque from every angle a player can
     reach, and the difference is the whole of why this landmark is affordable. Leaf gaps
     are hashed in on top of it, which a real canopy has anyway.
     =================================================================================== */
  _farmStampGreatTree(chunk) {
    const R = this.farmTree;
    if (!R) return;
    const CR = FARM_TREE_CANOPY_R;
    if (!this._subHits(chunk, R.cx - CR - 2, R.cz - CR - 2, R.cx + CR + 2, R.cz + CR + 2)) return;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const b = R.padY, cx = R.cx, cz = R.cz;
    const hsh = (n) => this._farmHash(cx * 13 + n, cz * 17 + n, 997);

    /* --- THE GROUND AT THE FOOT. Bare, root-broken earth — the one place in the dead
       land that is dark and damp rather than dry, because something here is still
       drinking. Nothing is spelled out; the soil simply changes character. */
    for (let wx = R.ox; wx < R.x1; wx++)
      for (let wz = R.oz; wz < R.z1; wz++) {
        const r = this._farmHash(wx, wz, 999);
        S(wx, b - 1, wz, r < 0.34 ? BLOCK.SOIL_FERTILE : (r < 0.68 ? BLOCK.SOIL_WET : BLOCK.ROTTED_SOIL));
        for (let dy = 0; dy < 6; dy++) S(wx, b + dy, wz, BLOCK.AIR);
        const edge = Math.min(wx - R.ox, R.x1 - 1 - wx, wz - R.oz, R.z1 - 1 - wz);
        if (edge <= 1) {                                  // see the fallen tower's yard
          const nat = this._farmBaseHeightAt(wx, wz);
          if (nat < b) for (let y = nat - 1; y < b; y++) S(wx, y, wz, BLOCK.ROTTED_SOIL);
        }
      }

    /* --- THE BUTTRESS ROOTS. Eight of them, tapering out to ten blocks and standing two
       or three above the ground where they leave the bole. They are the reason the trunk
       reads as GROWN rather than as a cylinder somebody stood in a field, and they give
       the player something at their own scale to compare the bole against. */
    const TR = FARM_TREE_TRUNK_R;
    for (let a = 0; a < 8; a++) {
      const ang = a * Math.PI / 4 + hsh(a) * 0.28;
      const ux = Math.cos(ang), uz = Math.sin(ang);
      const alongX = Math.abs(ux) >= Math.abs(uz);
      const reach = 8 + Math.floor(hsh(a + 8) * 4);
      for (let t = 0; t <= reach; t++) {
        const wx = cx + Math.round(ux * (TR - 1 + t)), wz = cz + Math.round(uz * (TR - 1 + t));
        const hgt = Math.max(0, 3 - Math.floor(t / 3));       // tapers into the ground
        const wide = t < reach * 0.4 ? 1 : 0;
        for (let s = -wide; s <= wide; s++) {
          const px = alongX ? wx : wx + s, pz = alongX ? wz + s : wz;
          for (let dy = 0; dy <= hgt; dy++) {
            S(px, b + dy, pz, alongX ? BLOCK.GREAT_ROOT_X : BLOCK.GREAT_ROOT_Z);
          }
          S(px, b - 1, pz, BLOCK.GREAT_BARK);
        }
      }
    }

    /* --- THE BOLE. Nine blocks across at the base and seven above the buttresses, run up
       clear for twenty-six blocks before the first limb. The clear bole is the detail
       that sells the age: a tree that branches at head height is a tree, and a tree whose
       first limb is higher than a house is something else. */
    for (let dy = 0; dy < FARM_TREE_TRUNK_H; dy++) {
      const rad = dy < 6 ? TR : TR - 1;
      for (let dx = -rad; dx <= rad; dx++)
        for (let dz = -rad; dz <= rad; dz++) {
          if (dx * dx + dz * dz > rad * rad + rad) continue;
          S(cx + dx, b + dy, cz + dz, BLOCK.GREAT_BARK);
        }
    }

    /* --- THE LIMBS. Seven, radiating from the top of the bole and rising as they go out,
       each one a run of the axis-tiled limb blocks so a whole branch is a handful of
       quads. They are what connects the trunk to the crown; without them the canopy is a
       cloud hanging over a post. */
    const limbs = [];
    for (let a = 0; a < 7; a++) {
      const ang = a * (Math.PI * 2 / 7) + hsh(a + 20) * 0.5;
      const ux = Math.cos(ang), uz = Math.sin(ang);
      const alongX = Math.abs(ux) >= Math.abs(uz);
      const reach = 13 + Math.floor(hsh(a + 30) * 7);
      const y0 = b + FARM_TREE_TRUNK_H - 3 - Math.floor(hsh(a + 40) * 4);
      let lx = cx, lz = cz, ly = y0;
      /* THEY START AT THE BOLE'S SURFACE, NOT AT ITS AXIS. Run from t=1 a limb whose
         direction is mostly north-south writes its first cells straight down the trunk's
         own centre column, which replaces bark with limb geometry inside the bole — a
         seam the player sees as a stripe up the trunk from twenty blocks away. */
      for (let t = TR; t <= reach; t++) {
        lx = cx + Math.round(ux * t); lz = cz + Math.round(uz * t);
        ly = y0 + Math.round(t * 0.55);
        S(lx, ly, lz, alongX ? BLOCK.GREAT_LIMB_X : BLOCK.GREAT_LIMB_Z);
        if (t % 4 === 0) S(lx, ly + 1, lz, BLOCK.GREAT_LIMB_Y);      // a rising fork
      }
      limbs.push({ x: lx, y: ly, z: lz });
    }

    /* --- THE CROWN. A union of eight lobes — one over the trunk and one at the end of
       each limb — resolved per column so the shell can be found without ever building the
       solid volume. For a column the code needs two things: how far inside the union's
       FOOTPRINT it is, and the union's vertical span at that point. Near the rim it fills
       the span; inside it fills only the top and bottom crust. That is the whole
       algorithm, and it is what keeps a fifty-two-block crown under ten thousand voxels.

       THE LOOP IS CLIPPED TO THE CHUNK, not to the crown. A landmark this wide covers
       sixteen chunks, and iterating the full footprint in each of them would do sixteen
       times the necessary work for no visible benefit. */
    const lobes = [{ x: cx, y: b + FARM_TREE_TRUNK_H + 6, z: cz, r: 14 }];
    for (let i = 0; i < limbs.length; i++) {
      const L = limbs[i];
      lobes.push({ x: L.x, y: L.y + 4 + Math.floor(hsh(i + 50) * 3), z: L.z,
                   r: 10 + Math.floor(hsh(i + 60) * 4) });
    }
    const topCap = Math.min(CHUNK_SY - 2, R.topY);
    const cx0 = chunk ? chunk.cx * CHUNK_SX : R.cx - CR;
    const cz0 = chunk ? chunk.cz * CHUNK_SZ : R.cz - CR;
    const lx0 = chunk ? Math.max(cx - CR, cx0) : cx - CR;
    const lx1 = chunk ? Math.min(cx + CR, cx0 + CHUNK_SX - 1) : cx + CR;
    const lz0 = chunk ? Math.max(cz - CR, cz0) : cz - CR;
    const lz1 = chunk ? Math.min(cz + CR, cz0 + CHUNK_SZ - 1) : cz + CR;
    for (let wx = lx0; wx <= lx1; wx++) {
      for (let wz = lz0; wz <= lz1; wz++) {
        let inset = -1e9, yLo = 1e9, yHi = -1e9;
        for (const L of lobes) {
          const dx = wx - L.x, dz = wz - L.z;
          const h2 = dx * dx + dz * dz;
          if (h2 > L.r * L.r) continue;
          const half = Math.sqrt(L.r * L.r - h2);
          // Crowns are wider than they are deep: the vertical half-axis is 0.62 of it.
          const vh = half * 0.62;
          const ins = L.r - Math.sqrt(h2);
          if (ins > inset) inset = ins;
          if (L.y - vh < yLo) yLo = L.y - vh;
          if (L.y + vh > yHi) yHi = L.y + vh;
        }
        if (inset < 0) continue;
        const y0 = Math.max(b + 8, Math.ceil(yLo)), y1 = Math.min(topCap, Math.floor(yHi));
        if (y1 < y0) continue;
        const rim = inset <= 2.5;
        /* THE BOLE IS NOT PART OF THE CROWN. The main lobe's underside dips below the top
           of the trunk, so without this the shell writes leaf cells INSIDE the bark — a
           green block twenty-four courses up a solid trunk, which an inspection of the
           trunk column caught immediately and which would read in game as a hole in the
           tree. Everything below the first limb inside the trunk radius belongs to the
           bole and nothing else may write there. */
        const tdx = wx - cx, tdz = wz - cz;
        const inBole = tdx * tdx + tdz * tdz <= (TR + 1) * (TR + 1);
        for (let y = y0; y <= y1; y++) {
          if (inBole && y < b + FARM_TREE_TRUNK_H) continue;
          if (!rim && y > y0 + 1 && y < y1 - 1) continue;        // hollow: crust only
          if (this._farmHash(wx * 3 + y, wz * 5 - y, 1003) < 0.11) continue;   // leaf gaps
          S(wx, y, wz, BLOCK.GREAT_LEAF);
        }
      }
    }

    /* --- WHAT HAS FALLEN OUT OF IT. Leaf litter and windfall limbs on the ground under
       the crown — the only living litter anywhere in the dead land, and the detail that
       tells the player the tree is not merely alive but actively growing. */
    for (let wx = lx0; wx <= lx1; wx++)
      for (let wz = lz0; wz <= lz1; wz++) {
        const dx = wx - cx, dz = wz - cz;
        if (dx * dx + dz * dz > CR * CR) continue;
        if (Math.abs(dx) <= TR + 1 && Math.abs(dz) <= TR + 1) continue;
        const r = this._farmHash(wx, wz, 1007);
        if (r > 0.22) continue;
        const h = this._farmHeightAt(wx, wz);
        if (r < 0.02) S(wx, h, wz, (wx & 1) ? BLOCK.GREAT_LIMB_X : BLOCK.GREAT_LIMB_Z);
        else S(wx, h, wz, BLOCK.LEAF_LITTER);
      }
  }

  /* ===================================================================================
     PHASE 20 — GEOGRAPHIC WRONGNESS AND CROSS-DIMENSIONAL ECHOES

     SIX OBJECTS ACROSS FOUR HUNDRED BLOCKS. That is the entire budget of this section and
     it is deliberately tiny, because the effect the brief asks for depends completely on
     rarity: "if everything repeats, nothing feels special". Between them they do three
     jobs and no more.

       REPETITION. One arrangement — a burnt stump, a fallen gate and three posts, in the
       same relative positions, at the same distance from the road — appears three times,
       at rows 8, 10 and 11. It is never mirrored and never varied, because a variation is
       a different object and the whole point is that it is the SAME object. A player who
       is paying attention gets to the third one and stops walking.

       A NAME IN THE WRONG PLACE. The ROTH FARM board — the board at the first farmstead
       the player ever reached, eleven parcels and seven hundred blocks back — is standing
       at a gate in an empty field with no farm behind it. Phase 18 built the sign system
       around the promise that a destination sign never names something that is not there.
       This is the first time that promise is broken, and it is broken exactly once.

       CROSS-DIMENSIONAL. Two objects that belong to Static Suburbia: a mailbox on a
       fragment of concrete sidewalk with two lengths of picket fence and a patch of
       mown lawn, and, further on, an armchair on a rug, alone in a dead field, facing
       the road. Neither is explained and neither ever will be here.

     NOTHING HERE IS SUPERNATURAL AND NOTHING MOVES. The horror is entirely that these
     things are where they are.
     =================================================================================== */
  _farmStampJourneyMarks(chunk) {
    const cx0 = chunk.cx * CHUNK_SX, cx1 = cx0 + CHUNK_SX;
    // Cheap rejection: the marks live in four parcel columns out of an infinite lattice.
    const jx0 = (FARM_J_B0 + FARM_J_ECHO0) * FARM_P, jx1 = (FARM_J_B0 + FARM_J_HOME) * FARM_P;
    if (cx1 < jx0 || cx0 >= jx1) return;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);

    /* THE REPEATED ARRANGEMENT. Authored once, as offsets, and stamped verbatim at every
       site — which is what makes it literally the same object rather than three things
       that resemble each other. */
    const motif = (ax, az) => {
      if (!this._subHits(chunk, ax - 4, az - 4, ax + 6, az + 6)) return;
      const put = (dx, dz, id, clear) => {
        const wx = ax + dx, wz = az + dz;
        if (!isFarmlandsWorldPos(wx, wz)) return;
        const h = this._farmHeightAt(wx, wz);
        if (clear) for (let dy = 0; dy < 4; dy++) S(wx, h + dy, wz, BLOCK.AIR);
        S(wx, h, wz, id);
      };
      put(0, 0, BLOCK.BURNT_STUMP, true);
      put(1, 0, BLOCK.DEADWOOD_X, true);
      put(2, 0, BLOCK.CHARRED_BRANCH, false);
      put(0, 3, BLOCK.FENCE_POST, true);
      put(0, 4, BLOCK.FIELD_GATE_Z, true);
      put(0, 5, BLOCK.FENCE_POST, true);
      put(1, 5, BLOCK.FENCE_BROKEN_X, false);
      put(3, 2, BLOCK.SMALL_STONES, false);
      put(-1, 4, BLOCK.WEED_CLUMP, false);
    };

    for (const j of [FARM_J_ECHO0, FARM_J_ECHO0 + 2, FARM_J_ECHO0 + 3]) {
      const ax = (FARM_J_B0 + j) * FARM_P + 26;
      const az = Math.round(this._farmJourneyLaneZ(ax)) + 19;   // always the same side,
      motif(ax, az);                                            // always the same distance
    }

    /* THE SUBURBAN FRAGMENT. Six cells of another dimension, sitting in a Farmlands
       field. The sidewalk slab is what sells it: turf and a mailbox could be rural, a
       poured concrete walk with a kerb going nowhere could not. */
    {
      const ax = (FARM_J_B0 + FARM_J_ECHO0 + 1) * FARM_P + 40;
      const az = Math.round(this._farmJourneyLaneZ(ax)) - 17;
      if (this._subHits(chunk, ax - 3, az - 3, ax + 5, az + 5)) {
        for (let dx = 0; dx <= 3; dx++)
          for (let dz = 0; dz <= 2; dz++) {
            const wx = ax + dx, wz = az + dz;
            if (!isFarmlandsWorldPos(wx, wz)) continue;
            const h = this._farmHeightAt(wx, wz);
            for (let dy = 0; dy < 3; dy++) S(wx, h + dy, wz, BLOCK.AIR);
            S(wx, h - 1, wz, dz === 2 ? BLOCK.LAWN : BLOCK.SIDEWALK);
          }
        const hh = this._farmHeightAt(ax + 1, az);
        S(ax, hh, az, BLOCK.CURB);
        S(ax + 1, hh, az + 2, BLOCK.MAILBOX_Z);
        S(ax + 3, hh, az + 2, BLOCK.PICKET_X);
        S(ax + 4, hh, az + 2, BLOCK.PICKET_POST);
      }
    }

    /* THE CHAIR. One piece of somebody's living room, in the middle of a dead field,
       turned to face the road. It uses the Phase 14 furniture compiler, so it is the
       same armchair that stands in a Suburbia lounge — not a rural approximation of one,
       which is precisely what makes it wrong. */
    {
      const ax = (FARM_J_B0 + FARM_J_ECHO0 + 3) * FARM_P + 47;
      const az = Math.round(this._farmJourneyLaneZ(ax)) - 23;
      if (this._subHits(chunk, ax - 3, az - 3, ax + 4, az + 4)) {
        const h = this._farmHeightAt(ax, az);
        for (let dx = -1; dx <= 1; dx++)
          for (let dz = -1; dz <= 1; dz++) {
            if (!isFarmlandsWorldPos(ax + dx, az + dz)) continue;
            for (let dy = 0; dy < 3; dy++) S(ax + dx, h + dy, az + dz, BLOCK.AIR);
            S(ax + dx, h - 1, az + dz, BLOCK.SOIL_EXHAUSTED);
          }
        furnStamp(S, 'rugSmall', ax - 1, h, az - 1, 0);
        furnStamp(S, 'armchairOat', ax, h, az, 0);   // facing +z, toward the lane
      }
    }

    /* THE SIGN THAT LIES. Phase 18's board vocabulary, its post pair, its lettering, and
       its four-id run convention — reused exactly, so this is physically the same kind of
       object as every honest fingerpost in the region. Only what it says is wrong. */
    {
      const ax = (FARM_J_B0 + FARM_J_ECHO0 + 2) * FARM_P + 12;
      const az = Math.round(this._farmJourneyLaneZ(ax)) + 9;
      if (this._subHits(chunk, ax - 2, az - 2, ax + 3, az + 4)) {
        const h0 = this._farmHeightAt(ax, az), h1 = this._farmHeightAt(ax, az + 1);
        if (Math.abs(h0 - h1) <= 1) {
          const base = Math.max(h0, h1);
          for (let dy = 0; dy < 4; dy++) {
            S(ax, base + dy, az, BLOCK.AIR); S(ax, base + dy, az + 1, BLOCK.AIR);
          }
          S(ax, base, az, BLOCK.SIGN_POST); S(ax, base + 1, az, BLOCK.SIGN_POST);
          S(ax, base, az + 1, BLOCK.SIGN_POST); S(ax, base + 1, az + 1, BLOCK.SIGN_POST);
          const idx = FARM_SIGN_IDX_OF.ROTH;
          const bId = BLOCK.SIGN_TEXT_BASE + idx * 4 + 2;   // run along Z
          S(ax, base + 2, az, bId + 0);
          S(ax, base + 2, az + 1, bId + 1);
          // A gate, and behind it nothing at all.
          S(ax + 2, base, az, BLOCK.FENCE_POST);
          S(ax + 2, base, az + 1, BLOCK.FIELD_GATE_Z);
          S(ax + 2, base, az + 2, BLOCK.FENCE_POST);
        }
      }
    }
  }

  /* ===================================================================================
     PHASE 20 — EVIDENCE OF A FARM THAT SHOULD BE HERE

     THE PLAYER MUST REACH THE CONCLUSION, NOT BE TOLD IT. Everything in this pass is a
     piece of ordinary rural infrastructure that only exists because a property exists,
     and every one of them is placed so that the property it implies cannot be reached
     from the road:

       a mailbox standing on the verge with nothing behind it;
       tyre ruts that leave the lane, run twelve blocks into the field, and stop;
       a gateway — two posts and a fallen gate — opening onto no track at all;
       a fence line that starts at the road and ends eleven blocks short of the yard
         fence it should meet;
       drill rows that terminate in the middle of a field instead of at a headland;
       a stock well out in the open where no farmhouse could ever have been built
         around it.

     Then the farmhouse is visible across the last field, and the ground between the two
     does not connect. Nothing here is labelled, glowing, or pointed at.
     =================================================================================== */
  _farmStampApproach(chunk) {
    const A = this.farmApproach, H = this.farmHome;
    if (!A || !H) return;
    if (!this._subHits(chunk, A.x0 - 2, A.z0 - 2, A.x1 + 2, A.z1 + 2)) return;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const put = (wx, wz, id, clear) => {
      if (!isFarmlandsWorldPos(wx, wz) || this._farmInHomePad(wx, wz)) return;
      const h = this._farmHeightAt(wx, wz);
      if (clear) for (let dy = 0; dy < 4; dy++) S(wx, h + dy, wz, BLOCK.AIR);
      S(wx, h, wz, id);
    };
    const ground = (wx, wz, id) => {
      if (!isFarmlandsWorldPos(wx, wz) || this._farmInHomePad(wx, wz)) return;
      const h = this._farmHeightAt(wx, wz);
      S(wx, h - 1, wz, id);
      for (let dy = 0; dy < 3; dy++) S(wx, h + dy, wz, BLOCK.AIR);
    };
    /* `into` is the direction from the lane toward the property — +1 when the property
       lies south of the road, -1 when north. Every piece below is written in terms of it,
       so the whole pass works whichever side the clear window put the plot on. */
    const into = A.south ? 1 : -1;
    const laneZ = A.laneZ;

    /* --- DRILL ROWS THAT STOP. A worked field's rows run to a headland; these run to the
       middle of the field and end, which is a thing that cannot happen to a field that
       was actually ploughed.

       THEY GO FIRST, because `ground` clears the three cells above whatever it repaints
       and the mailbox stands in one of them. Written last, the rows silently deleted the
       mailbox — the single most important piece of evidence in the approach — and left a
       bare verge that read as nothing having been placed at all. */
    for (let wx = A.x0 + 4; wx < A.x0 + 22; wx += 2) {
      const end = 8 + Math.floor(this._farmHash(wx, 0, 947) * 7);
      for (let k = FARM_MARGIN; k < end + FARM_MARGIN; k++) ground(wx, laneZ + into * k, BLOCK.TILLED_Z);
    }

    // --- THE MAILBOX ON THE VERGE, and the post it stands on. Nothing behind it.
    const mx = H.cx - 12;
    const mz = laneZ + into * (FARM_VERGE_U + 1);
    put(mx, mz, BLOCK.MAILBOX, true);
    put(mx + 1, mz, BLOCK.FENCE_POST, true);

    /* --- THE TYRE RUTS. They leave the lane where a driveway would, run into the field
       on the line the driveway would have taken, thin out, and stop. Twelve blocks is
       chosen so they die well short of the property: near enough to be obviously heading
       for it, far enough that the gap cannot be read as erosion. */
    const rx = H.cx - 6;
    for (let k = 0; k < 12; k++) {
      const fade = k / 12;
      const wz = laneZ + into * (FARM_VERGE_U + k);
      if (this._farmHash(rx, wz, 941) < fade * 0.8) continue;
      ground(rx - 1, wz, BLOCK.TIRE_TRACK);
      ground(rx + 1, wz, BLOCK.TIRE_TRACK);
      if (fade < 0.5) ground(rx, wz, BLOCK.SOIL_TRAMPLED);
    }

    // --- THE GATEWAY THAT OPENS ONTO NOTHING.
    const gx = H.cx + 6;
    const gz = laneZ + into * (FARM_VERGE_U + 2);
    put(gx - 1, gz, BLOCK.FENCE_POST, true);
    put(gx, gz, BLOCK.FIELD_GATE_X, true);
    put(gx + 1, gz, BLOCK.FENCE_POST, true);
    put(gx + 2, gz + into, BLOCK.BROKEN_WOOD, false);

    /* --- THE FENCE THAT ALMOST ARRIVES. It runs from the gateway toward the property and
       stops eleven blocks short of the yard fence, which is close enough that a player
       following it looks up expecting to see it continue. */
    const stopZ = (A.south ? H.oz - 11 : H.z1 + 11);
    for (let wz = gz + into; into > 0 ? wz < stopZ : wz > stopZ; wz += into) {
      const r = this._farmHash(gx, wz, 943);
      if (r < 0.14) continue;                                   // sections already down
      const id = r < 0.34 ? BLOCK.FENCE_BROKEN_Z
               : (r < 0.58 ? BLOCK.FENCE_LEAN_Z : BLOCK.FENCE_OLD_Z);
      put(gx, wz, ((wz & 3) === 0) ? BLOCK.POST_BROKEN : id, true);
    }

    // --- THE WELL, out in the open, where no yard was ever built around it.
    const wx0 = H.cx + 16, wz0 = laneZ + into * (FARM_VERGE_U + 9);
    if (isFarmlandsWorldPos(wx0, wz0) && !this._farmInHomePad(wx0, wz0)) {
      const h = this._farmHeightAt(wx0, wz0);
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) ground(wx0 + dx, wz0 + dz, BLOCK.SOIL_TRAMPLED);
      S(wx0, h, wz0, BLOCK.WELL_RIM);
      for (let dy = 1; dy <= 7; dy++) S(wx0, h - dy, wz0, BLOCK.AIR);
      S(wx0 - 1, h, wz0, BLOCK.WELL_POST); S(wx0 + 1, h, wz0, BLOCK.WELL_POST);
      S(wx0 - 1, h + 1, wz0, BLOCK.WELL_POST); S(wx0 + 1, h + 1, wz0, BLOCK.WELL_POST);
      S(wx0, h + 1, wz0, BLOCK.WELL_WINCH);
      S(wx0 + 2, h, wz0 + 1, BLOCK.TROUGH);
    }
  }

  /* --- THE PROPERTY. Ground, boundary, outbuilding, well, and the yard a family used.
     Every one of these is also a piece of the evidence the approach pass started laying
     down: the fence that does not reach the road, the gate with no track behind it, the
     mailbox on the wrong side of the property. */
  _farmHomeYard(chunk, H) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const b = H.padY;
    const x0 = Math.max(H.ox, chunk.cx * CHUNK_SX), x1 = Math.min(H.x1, chunk.cx * CHUNK_SX + CHUNK_SX);
    const z0 = Math.max(H.oz, chunk.cz * CHUNK_SZ), z1 = Math.min(H.z1, chunk.cz * CHUNK_SZ + CHUNK_SZ);
    for (let wx = x0; wx < x1; wx++) {
      for (let wz = z0; wz < z1; wz++) {
        for (let dy = 0; dy < 14; dy++) S(wx, b + dy, wz, BLOCK.AIR);
        const r = this._farmHash(wx, wz, 953);
        /* GROUND STATE COMES OFF THE PHASE 19 PATCH LATTICE, NOT OFF A PER-COLUMN ROLL.

           Written as a per-column hash the yard came out as a chequerboard — which is
           precisely the defect Phase 19 identified, named and solved for the whole
           dimension with _farmSoilPatch's sheared eight-block lattice, and which a
           first-person render of the porch showed straight back. A patch is a corner of
           a yard that wore differently; a speckle is noise. The BANDS are still keyed on
           distance from the house, because that part is real: the ground by the door is
           worn, the far corners have gone back to weed. */
        const patch = this._farmSoilPatch(wx, wz, 953);
        const dHouse = Math.max(Math.abs(wx - (H.hx + 6)), Math.abs(wz - (H.hz + 5)));
        let g;
        if (dHouse <= 8) g = patch < 0.22 ? BLOCK.SOIL_DRY : BLOCK.SOIL_TRAMPLED;
        else if (dHouse <= 13) g = patch < 0.5 ? BLOCK.SOIL_OVERGROWN : BLOCK.SOIL_DRY;
        else g = patch < 0.7 ? BLOCK.SOIL_OVERGROWN : BLOCK.DEAD_EARTH;
        S(wx, b - 1, wz, g);
        if (dHouse > 6 && r > 0.90) S(wx, b, wz, r > 0.965 ? BLOCK.WEED_CLUMP : BLOCK.DRY_TUSSOCK);
        else if (dHouse > 10 && r > 0.86) S(wx, b, wz, BLOCK.STUBBLE);
      }
    }

    /* THE BOUNDARY. Deliberately incomplete: a whole run of the west fence — the side
       facing the road — is simply not there, and the gate that should serve the missing
       driveway stands open onto grass. */
    const fence = (wx, wz, alongX) => {
      if (wx < x0 || wx >= x1 || wz < z0 || wz >= z1) return;
      const r = this._farmHash(wx, wz, 959);
      if (r < 0.15) return;
      const id = r < 0.36 ? (alongX ? BLOCK.FENCE_BROKEN_X : BLOCK.FENCE_BROKEN_Z)
               : (r < 0.62 ? (alongX ? BLOCK.FENCE_LEAN_X : BLOCK.FENCE_LEAN_Z)
                           : (alongX ? BLOCK.FENCE_OLD_X : BLOCK.FENCE_OLD_Z));
      S(wx, b, wz, (((alongX ? wx : wz) & 3) === 0) ? BLOCK.POST_BROKEN : id);
    };
    /* THE ROAD SIDE OF THE BOUNDARY is the one with the hole in it: two-thirds of the
       run facing the lane simply never happened, which is the first thing a player sees
       of this property and the first thing that is wrong with it. */
    const roadZ = H.south ? H.oz + 1 : H.z1 - 2;
    const farZ = H.south ? H.z1 - 2 : H.oz + 1;
    for (let wx = H.ox + 1; wx < H.x1 - 1; wx++) {
      if (wx > H.ox + 8 && wx < H.x1 - 12) continue;
      fence(wx, roadZ, true);
    }
    for (let wx = H.ox + 1; wx < H.x1 - 1; wx++) fence(wx, farZ, true);
    for (let wz = H.oz + 1; wz < H.z1 - 1; wz++) { fence(H.ox + 1, wz, false); fence(H.x1 - 2, wz, false); }

    /* THE GATE, on the side facing the road — and the farmhouse's own front door faces
       WEST, across open field, at right angles to it. A property whose entrance and whose
       front are on different sides is not impossible, exactly; it is the sort of thing
       that is true of a house nobody planned, which is precisely what this one is. */
    const gx = H.cx + 1;
    S(gx - 1, b, roadZ, BLOCK.FENCE_POST);
    S(gx, b, roadZ, BLOCK.FIELD_GATE_X);
    S(gx + 1, b, roadZ, BLOCK.FENCE_POST);
    S(gx + 3, b, roadZ, BLOCK.MAILBOX);
    // Ruts inside the yard that begin at the gate and go nowhere in particular.
    for (let k = 2; k <= 8; k++) {
      const wz = H.south ? roadZ + k : roadZ - k;
      if (this._farmHash(gx, wz, 961) < 0.25) continue;
      S(gx - 1, b - 1, wz, BLOCK.TIRE_TRACK);
      S(gx + 1, b - 1, wz, BLOCK.TIRE_TRACK);
    }

    /* THE SHED. A real outbuilding through the ordinary archetype pipeline, standing in
       the relationship a real one stands in: off the yard, square to the house, its door
       facing the working ground between them. */
    const shed = {
      arch: 'shed', x: H.ox + 22, z: H.oz + 5, w: FARM_ARCH.shed.w, d: FARM_ARCH.shed.d,
      ridge: FARM_ARCH.shed.ridge, baseY: b, side: BLOCK.FARM_CLAPBOARD,
      roofMat: BLOCK.ROOF_TIN, face: 1, decay: 2, role: 'home',
    };
    this._farmStampBuilding(chunk, shed, (n) => this._farmHash(H.ox * 5 + n, H.oz * 3 + n, 967));

    // The yard well, its trough, and the mud around both.
    const wx0 = H.ox + 5, wz0 = H.oz + 26;
    for (let dx = -1; dx <= 2; dx++)
      for (let dz = -1; dz <= 2; dz++) S(wx0 + dx, b - 1, wz0 + dz, BLOCK.FARM_MUD);
    S(wx0, b, wz0, BLOCK.WELL_RIM);
    for (let dy = 1; dy <= 8; dy++) S(wx0, b - dy, wz0, BLOCK.AIR);
    S(wx0 - 1, b, wz0, BLOCK.WELL_POST); S(wx0 + 1, b, wz0, BLOCK.WELL_POST);
    S(wx0 - 1, b + 1, wz0, BLOCK.WELL_POST); S(wx0 + 1, b + 1, wz0, BLOCK.WELL_POST);
    S(wx0, b + 1, wz0, BLOCK.WELL_WINCH);
    S(wx0 + 2, b, wz0, BLOCK.TROUGH);

    // What a working yard leaves lying about. Sparse, and every piece has a reason.
    S(H.ox + 20, b, H.oz + 12, BLOCK.HAY_BALE);
    S(H.ox + 21, b, H.oz + 12, BLOCK.HAY_BALE);
    S(H.ox + 20, b + 1, H.oz + 12, BLOCK.HAY_BALE);
    S(H.ox + 24, b, H.oz + 14, BLOCK.PLOUGH);
    S(H.ox + 25, b, H.oz + 14, BLOCK.WHEEL_SPOKE);
    S(H.ox + 8, b, H.oz + 30, BLOCK.BARREL);
    S(H.ox + 9, b, H.oz + 31, BLOCK.CRATE);
    S(H.ox + 26, b, H.oz + 22, BLOCK.SACK_PILE);
    // A dead tree in the corner of the yard, and the stump of the one before it.
    this._farmTree(chunk, H.ox + 25, b, H.oz + 30, 5, 2, BLOCK.BLACK_CANOPY);
    S(H.ox + 22, b, H.oz + 29, BLOCK.BURNT_STUMP);
  }

  /* --- THE HOUSE ITSELF, from outside. Two masses through the suburb's shell and roof
     pipeline — the same one every barn and farmhouse in the region already uses — plus
     the pieces a farmhouse has that a tract house does not: a fieldstone plinth, a
     covered porch the full width of the road side, a brick chimney carrying the living
     room hearth, and a kitchen ell dropped a storey off the back. */
  _farmHomeExterior(chunk, H) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const b = H.padY;
    const side = BLOCK.FARM_CLAPBOARD;
    const main = {
      x: H.hx, z: H.hz, w: H.hw, d: H.hd,
      floorY: b, plateY: b + 8, roof: 'gable', ridge: 'x', main: true,
    };
    const ell = {
      x: H.hx + 5, z: H.hz + H.hd - 1, w: 6, d: 6,
      floorY: b, plateY: b + 4, roof: 'gable', ridge: 'z', wing: true,
    };
    const masses = [main, ell];

    // Fieldstone plinth, one course proud, under both masses.
    for (const m of masses)
      for (let dx = -1; dx <= m.w; dx++)
        for (let dz = -1; dz <= m.d; dz++) S(m.x + dx, b - 1, m.z + dz, BLOCK.FIELDSTONE);

    for (const m of masses) this._subStampShell(chunk, m, side, b);
    for (const m of masses) this._subStampRoof(chunk, m, masses, BLOCK.ROOF_B, b, side, false);

    /* THE CHIMNEY. Brick, on the north gable, carrying the living-room hearth up past
       the ridge with a cap on top. It is also the first thing that will contradict
       itself: the same hearth exists again, sixty blocks east and eleven blocks down,
       with no chimney at all. */
    const chx = H.hx + 3, chz = H.hz - 1;
    for (let y = b - 1; y <= b + 13; y++) S(chx, y, chz, BLOCK.BRICK);
    S(chx, b + 14, chz, BLOCK.CHIMNEY_CAP);

    /* --- THE PORCH, the full depth of the road side. Deck, posts, rail, a plank ceiling
       and two steps down to the yard. It is the single strongest cue that this is a
       dwelling and not a shed, and it is what the player sees first from across the
       field. */
    const py0 = H.hz + 1, py1 = H.hz + H.hd - 2;
    for (let wz = py0; wz <= py1; wz++) {
      for (let dx = 1; dx <= 2; dx++) {
        S(H.hx - dx, b - 1, wz, BLOCK.DECK);
        for (let dy = 0; dy < 4; dy++) S(H.hx - dx, b + dy, wz, BLOCK.AIR);
        S(H.hx - dx, b + 3, wz, BLOCK.SLAB_TRIM);          // porch ceiling
      }
      S(H.hx - 3, b + 3, wz, BLOCK.FASCIA_W);
    }
    for (const wz of [py0, Math.floor((py0 + py1) / 2), py1]) {
      for (let dy = 0; dy < 3; dy++) S(H.hx - 2, b + dy, wz, BLOCK.POST);
    }
    for (let wz = py0; wz <= py1; wz++) {
      if (wz >= H.hz + 5 && wz <= H.hz + 6) continue;        // the gap the steps come up
      if (this._subGet(chunk, H.hx - 2, b, wz) === BLOCK.AIR) S(H.hx - 2, b, wz, BLOCK.RAIL_Z);
    }
    S(H.hx - 3, b - 1, H.hz + 5, BLOCK.STEP_W);
    S(H.hx - 3, b - 1, H.hz + 6, BLOCK.STEP_W);
    S(H.hx - 2, b - 1, H.hz + 5, BLOCK.DECK);
    S(H.hx - 2, b - 1, H.hz + 6, BLOCK.DECK);
    S(H.hx - 1, b - 1, H.hz + 5, BLOCK.DOORMAT);
    // Boots by the door, and the chair somebody sat in.
    S(H.hx - 1, b, H.hz + 2, BLOCK.CRATE);
    furnStamp(S, 'chairOak', H.hx - 2, b, H.hz + 7, 3);

    /* --- OPENINGS. The front door stands open, folded back into the hall — the same
       decision Phase 17 made for every rural building and for the same reason: a house
       the player cannot walk into is a decorative shell. */
    /* THE THRESHOLD IS ON THE HALL, and getting that wrong is a walkability bug rather
       than a cosmetic one: the interior grid puts the hall at hz+5 and a partition at
       hz+4, so a doorway cut at hz+4 opened onto the end of an internal wall. A
       traversal from the field could reach the doorway and go no further, which is
       exactly the class of defect a census cannot see and a walk can.

       THE LEAF STANDS OPEN ON THE PORCH, not in the cell behind the threshold. Phase 17
       folds a rural door back into the room it opens onto, which is fine for a barn with
       a four-block opening and is not fine here: a door slab in the one-cell threshold of
       a one-cell hall leaves the player edging past it. Hung back against the outside
       wall, the way it always was on a working farm, the doorway is completely clear. */
    const dz = H.hz + 5;
    S(H.hx, b, dz, BLOCK.AIR);
    S(H.hx, b + 1, dz, BLOCK.AIR);
    S(H.hx - 1, b, dz - 1, BLOCK.DOOR_B_Z);
    // The back door, out of the kitchen ell into the yard — in line with the inner door
    // and the back passage, so the kitchen has a straight run through it.
    const bx = H.hx + 6, bz = ell.z + ell.d - 1;
    S(bx, b, bz, BLOCK.AIR); S(bx, b + 1, bz, BLOCK.AIR);
    S(bx, b - 1, bz + 1, BLOCK.STEP_S);

    /* WINDOWS. Domestic sill height, two courses tall, and their condition is the
       building's biography: boarded on the road side where somebody closed the place up,
       broken at the back where nobody came back to. */
    const win = (wx, wy, wz, wallAlongX, brokenBias) => {
      const r = this._farmHash(wx, wz, 971);
      const glazed = wallAlongX ? BLOCK.WIN_X : BLOCK.WIN_Z;
      const id = r < brokenBias ? BLOCK.WIN_BROKEN : (r < brokenBias + 0.22 ? BLOCK.WIN_BOARDED : glazed);
      S(wx, wy, wz, id); S(wx, wy + 1, wz, id);
    };
    for (const wz of [H.hz + 2, H.hz + 7]) { win(H.hx, b + 1, wz, false, 0.18); win(H.hx, b + 5, wz, false, 0.18); }
    for (const wz of [H.hz + 2, H.hz + 6]) { win(H.hx + H.hw - 1, b + 1, wz, false, 0.38); win(H.hx + H.hw - 1, b + 5, wz, false, 0.38); }
    for (const wx of [H.hx + 1, H.hx + 8]) win(wx, b + 1, H.hz, true, 0.30);
    win(H.hx + 1, b + 5, H.hz, true, 0.30);
    win(H.hx + 2, b + 1, H.hz + H.hd - 1, true, 0.42);
    win(H.hx + 6, b + 1, ell.z + ell.d - 1, true, 0.42);
    win(ell.x, b + 1, ell.z + 2, false, 0.42);
    win(ell.x + ell.w - 1, b + 1, ell.z + 3, false, 0.42);

    /* A NOTE ON A BEAT THAT WAS CUT. The box room was going to carry a window backed
       with obsidian — a pane on an exterior wall showing nothing at midday. It cannot be
       built honestly: a one-block wall has no cavity to hide the backing in, so the
       obsidian has to go either into the room (a black slab floating at head height) or
       into the yard (visible from outside, which destroys the believable exterior the
       whole first half of this structure exists to establish). Both are worse than not
       having the beat, and the box room already carries the stronger one — see the door
       that opens onto plaster in _farmHomeInterior. Left recorded rather than left as a
       comment-free absence, because the next person to notice the box room has one
       anomaly instead of two should not have to re-derive why. */

    // Planting: what a garden becomes when nobody cuts it.
    for (const [gx, gz] of [[-4, 1], [-4, 3], [-4, 8], [-5, 6], [H.hw + 1, 2], [H.hw + 2, 7]]) {
      const wx = H.hx + gx, wz = H.hz + gz;
      if (this._farmHash(wx, wz, 977) < 0.3) continue;
      S(wx, b, wz, this._farmHash(wx, wz, 979) < 0.5 ? BLOCK.SHRUB : BLOCK.HEDGE_LOW);
    }
  }

  /* --- INSIDE THE HOUSE.

     THE PLAN IS AUTHORED, NOT SEARCHED. Suburbia's floor planner exists to make eight
     archetypes produce a thousand different houses; this is one house, it is the
     culmination of the dimension, and the brief asks for specific rooms in specific
     relationships. So the walls are placed by hand, and every piece of furniture is put
     where a person would have put it rather than where an occupancy grid allowed it.

     WHAT THE FURNITURE IS FOR. Requirement 39 asks that the player believe people lived
     here, and the way to lose that is to furnish a house like a showroom. So the table is
     still laid, there are work clothes over a chair, the calendar is on the kitchen wall,
     there are boots at the door and a child's bed in the small room, and the pantry has
     more sacks in it than a family would have got through. Nothing is a note and nothing
     is a collectible. */
  _farmHomeInterior(chunk, H) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const b = H.padY, up = H.upY;
    const A = H.hx + 1, B = H.hz + 1;              // interior origin
    const X = (i) => A + i, Z = (i) => B + i;      // room-grid helpers, 10 x 8
    const RH = 3;

    // ---- GROUND FLOOR --------------------------------------------------------------
    // Partitions: two east-west walls with the hall between them, and two cross walls.
    this._homeWall(S, X(0), Z(3), X(9), Z(3), b, RH, PART_WALL[3]);
    this._homeWall(S, X(0), Z(5), X(9), Z(5), b, RH, PART_WALL[3]);
    this._homeWall(S, X(6), Z(0), X(6), Z(2), b, RH, PART_WALL[12]);
    this._homeWall(S, X(4), Z(6), X(4), Z(7), b, RH, PART_WALL[12]);
    // Doorways off the hall: living room, dining room, utility, pantry.
    this._homeDoorway(S, X(2), Z(3), b, true);
    this._homeDoorway(S, X(8), Z(3), b, true);
    this._homeDoor(S, X(1), Z(5), b, true, 1);
    this._homeDoorway(S, X(7), Z(5), b, true);
    this._homeDoorway(S, X(4), Z(6), b, false);

    /* THE HEARTH. Firebrick back, a stone surround, a mantel shelf, and a cold grate with
       last winter's ash still in it. This exact arrangement is reproduced underground, at
       a different size, in a room with no chimney above it. */
    const hx0 = H.hx + 2;
    for (let dx = 0; dx <= 2; dx++) {
      S(hx0 + dx, b, H.hz, BLOCK.BRICK);
      S(hx0 + dx, b + 1, H.hz, BLOCK.BRICK);
      S(hx0 + dx, b + 2, H.hz, BLOCK.STONE_VENEER);
    }
    S(hx0 + 1, b, Z(0), BLOCK.ASH_DRIFT);
    S(hx0, b, Z(0), BLOCK.STICKS);
    S(hx0 + 2, b, Z(0), BLOCK.BROKEN_WOOD);
    furnStamp(S, 'artLandscape', hx0 + 1, b + 2, Z(0), 0);

    // LIVING ROOM — the room the family actually used, and the one that comes back.
    furnStamp(S, 'rugRed', X(1), b, Z(1), 0);
    furnStamp(S, 'couchOlive', X(1), b, Z(2), 2);
    furnStamp(S, 'armchairOat', X(4), b, Z(1), 3);
    furnStamp(S, 'sideTable', X(0), b, Z(2), 0);
    furnStamp(S, 'lampBase', X(0), b, Z(1), 0);
    furnStamp(S, 'bookshelf', X(5), b, Z(0), 0);
    // DINING — the table is still laid.
    furnStamp(S, 'diningTable', X(7), b, Z(1), 0);
    furnStamp(S, 'chairWalnut', X(7), b, Z(0), 0);
    furnStamp(S, 'chairWalnut', X(9), b, Z(2), 2);
    furnStamp(S, 'artFamily', X(9), b + 2, Z(0), 0);
    // HALL — a runner, a mirror, and the coat hooks somebody emptied.
    furnStamp(S, 'rugSmall', X(3), b, Z(4), 0);
    furnStamp(S, 'mirrorHall', X(0), b + 1, Z(4), 3);
    /* UTILITY / BATHROOM — and the Z(6) row through it is the back passage, so nothing
       stands on it either. This room is not a dead end: it is the ONLY way from the hall
       to the pantry, the cellar stair and the kitchen, because the staircase occupies the
       east end of the hall. A shelf on X(3) blocked the last half-step into the cross
       doorway and cut the whole back of the house off; the traversal found it, a block
       census could not have. */
    furnStamp(S, 'washer', X(0), b, Z(6), 0);
    furnStamp(S, 'toilet', X(0), b, Z(7), 0);
    furnStamp(S, 'vanity', X(1), b, Z(7), 0);
    furnStamp(S, 'bathMat', X(2), b, Z(7), 0);
    furnStamp(S, 'utilityShelf', X(3), b, Z(7), 0);
    /* PANTRY / BACK PASSAGE — more stores than a family would ever have got through,
       and every one of them east of the walking lane.

       THE LANE IS NOT DECORATION-DRIVEN, IT IS THE ONLY ROUTE TO LEVEL 2 PROGRESSION.
       X(5)..X(6) on both rows is the corridor from the cross doorway to the head of the
       cellar stair and on into the kitchen ell, and the first version of this put a
       barrel in the middle of it. A traversal proved the entire back half of the house
       — and therefore the Rift Core Disk — unreachable; the census saw a barrel in a
       pantry and had nothing to say about it. Nothing may stand on X(5) or X(6). */
    furnStamp(S, 'boxes', X(9), b, Z(6), 0);
    S(X(7), b, Z(6), BLOCK.SACK_PILE);
    S(X(8), b, Z(6), BLOCK.SACK_PILE);
    S(X(9), b + 1, Z(6), BLOCK.HAND_TOOLS);

    /* THE STAIRCASE. Four treads east along the hall, arriving on the deck. The deck is
       opened above the first three exactly as the suburb's stair stamper does — the top
       tread IS the deck course, and the bottom one keeps its soffit. */
    const stairId = FURN['stair'].rot[furnRotIndex('stair', 3)].cells[0][3];
    for (let p = 0; p < 4; p++) {
      S(X(5 + p), b + p, Z(4), stairId);
      if (p < 3) S(X(5 + p), b + 3, Z(4), BLOCK.AIR);
    }
    furnStamp(S, 'newel', X(4), b, Z(4), 3);

    // ---- THE KITCHEN ELL -----------------------------------------------------------
    /* The ell shares the main mass's south wall, so the way through is cut after both
       shells are up: two clear courses and a lintel, in the wall the pantry backs onto. */
    /* The way through is on X(5), in line with the back passage, so pantry, cellar stair
       and kitchen are all served by one corridor — which is how a farmhouse back of house
       actually works, and is also what keeps the route to the Core Disk a straight line
       nothing can be dropped into. */
    S(H.hx + 6, b, H.hz + H.hd - 1, BLOCK.AIR);
    S(H.hx + 6, b + 1, H.hz + H.hd - 1, BLOCK.AIR);
    const kx = H.hx + 6, kz = H.hz + H.hd;         // interior origin of the ell (4 x 4)
    // The run goes down the far wall, leaving the whole of the near column walkable from
    // the inner door to the back door.
    furnStamp(S, 'counterSink', kx + 3, b, kz, 0);
    furnStamp(S, 'counter', kx + 3, b, kz + 1, 0);
    furnStamp(S, 'stove', kx + 3, b, kz + 2, 0);
    furnStamp(S, 'fridge', kx + 3, b, kz + 3, 0);
    furnStamp(S, 'wallCabinet', kx + 3, b + 1, kz, 0);
    furnStamp(S, 'wallCabinet', kx + 3, b + 1, kz + 1, 0);
    furnStamp(S, 'diningTable', kx + 1, b, kz + 2, 0);
    furnStamp(S, 'chairOak', kx + 1, b, kz + 1, 0);
    furnStamp(S, 'chairOak', kx + 1, b, kz + 3, 2);
    // The calendar nobody turned over, and the crate of stores by the door.
    furnStamp(S, 'artPortrait', kx + 1, b + 2, kz, 0);
    S(kx + 2, b, kz, BLOCK.CRATE);

    // ---- UPPER FLOOR ---------------------------------------------------------------
    /* THE UPPER PLAN DELIBERATELY DOES NOT MATCH THE LOWER ONE. Its corridor runs one
       cell further north than the hall below it, which is completely ordinary in a real
       farmhouse and is also the first quiet note that this building does not stack the
       way the player assumes. */
    this._homeWall(S, X(0), Z(2), X(9), Z(2), up, RH, PART_WALL[3]);
    this._homeWall(S, X(0), Z(5), X(9), Z(5), up, RH, PART_WALL[3]);
    this._homeWall(S, X(6), Z(0), X(6), Z(1), up, RH, PART_WALL[12]);
    this._homeWall(S, X(6), Z(6), X(6), Z(7), up, RH, PART_WALL[12]);
    this._homeDoorway(S, X(2), Z(2), up, true);
    this._homeDoorway(S, X(8), Z(2), up, true);
    this._homeDoor(S, X(2), Z(5), up, true, -1);
    this._homeDoorway(S, X(8), Z(5), up, true);
    // The stairwell guard, along the north lip of the opening.
    for (let i = 5; i <= 7; i++) furnStamp(S, 'banister', X(i), up, Z(3), 2);
    furnStamp(S, 'newel', X(8), up, Z(3), 2);
    // Ceiling: the attic starts here.
    for (let i = 0; i <= 9; i++)
      for (let k = 0; k <= 7; k++) S(X(i), up + 3, Z(k), CEIL_PANEL);

    // MAIN BEDROOM.
    furnStamp(S, 'bedDoubleWarm', X(1), up, Z(0), 0);
    furnStamp(S, 'nightstand', X(0), up, Z(1), 0);
    furnStamp(S, 'dresserOak', X(4), up, Z(0), 0);
    furnStamp(S, 'artPortrait', X(2), up + 2, Z(0), 0);
    furnStamp(S, 'lampBase', X(0), up + 1, Z(0), 0);
    // Work clothes over the chair, which is the detail that says these were farmers.
    furnStamp(S, 'chairOak', X(5), up, Z(1), 2);
    // SECOND BEDROOM — a child's.
    furnStamp(S, 'bedSingle', X(1), up, Z(6), 0);
    furnStamp(S, 'nightstand', X(0), up, Z(6), 0);
    furnStamp(S, 'rugSmallBlue', X(3), up, Z(7), 0);
    furnStamp(S, 'binSmall', X(4), up, Z(6), 0);
    // LINEN STORE.
    furnStamp(S, 'dresser', X(8), up, Z(6), 0);
    furnStamp(S, 'boxes', X(9), up, Z(7), 0);

    /* THE BOX ROOM, and THE FIRST THING THAT IS ACTUALLY WRONG.

       Its window looks out over open farmland at midday and shows nothing at all — the
       pane is backed with obsidian one block behind the glass, which is a thing that can
       only be true if the wall has no outside. And in its east wall there is a door, in a
       proper stub of partition with a proper architrave, and a block behind the leaf is
       the exterior wall of the house. It opens onto plaster.

       Both are quiet. Neither is announced. A player can miss both, and the ones who do
       not will spend the rest of the house checking. */
    furnStamp(S, 'boxes', X(7), up, Z(0), 0);
    furnStamp(S, 'desk', X(8), up, Z(1), 0);
    this._homeWall(S, X(9), Z(0), X(9), Z(0), up, RH, PART_WALL[12]);
    this._homeDoorShut(S, X(9), Z(1), up, false, 1);

    /* THE HATCH IN THE PANTRY FLOOR. There is no cellar door on the outside of this
       house, there is no bulkhead in the yard, and the plinth is unbroken all the way
       round — a player who walked the exterior first has already been told, without
       being told, that what they are about to walk down into cannot be here. */
    S(X(6), b - 1, Z(7), BLOCK.AIR);
  }

  /* ===================================================================================
     WHAT IS UNDER THE HOUSE

     THE CONTRADICTION IS MEASURED IN PACES, NOT IN EFFECTS. A player who goes down the
     pantry stair walks east along a corridor for thirty-four blocks and arrives in a room
     sixteen wide. The farmhouse above them is twelve wide and thirty-four blocks is
     longer than the whole property. Nothing tells them that. They simply notice that the
     wallpaper is the wallpaper from the hall upstairs, and that it has been going on for
     a very long time.

     WHY IT IS PAPERED. A cellar would prove nothing: cellars are long, cellars are dark,
     cellars are ordinary. What is down here is not a cellar, it is a HOUSE INTERIOR —
     plaster walls, a plank floor, a plaster ceiling, a runner rug, framed pictures, wall
     lamps, and doors on both sides. Whatever built it had the pieces of a farmhouse and
     no idea how many of each a farmhouse has.

     BOUNDS. Roughly seventy by twenty-four by five cells of authored volume, cut into
     stone at least two blocks below the lowest ground the heightfield can produce, so it
     is invisible from outside at every point and can never be exposed by the terrain. It
     is stamped clipped-per-chunk exactly like a farmstead, it holds five torches and one
     point light, and it allocates nothing.
     =================================================================================== */
  _farmHomeBelow(chunk, H) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const b = H.padY, d = H.deepY;
    const hallZ = H.hallZ;

    /* --- THE FLIGHT DOWN. One tread per block, running east out of the pantry and under
       the yard. The number of treads is padY - deepY, which varies with the terrain the
       property sits on, so the stair is built from the drop rather than from a constant —
       the one thing that must never happen here is a flight that stops a block short of
       its own floor. */
    const stairDown = FURN['stair'].rot[furnRotIndex('stair', 1)].cells[0][3];
    const steps = b - d;
    for (let k = 0; k < steps; k++) {
      const wx = H.stairX0 + k, wy = b - 1 - k;
      /* THE SHAFT WALLS ONLY EXIST UNDERGROUND, and the guard is load-bearing. Written
         without it they ran up to head height either side of the flight for its whole
         length — including the four treads that are still inside the house — and filled
         the pantry, the back passage and the ell's shared wall with fieldstone. A
         traversal proved the entire south half of the ground floor unreachable; nothing
         in the block census showed it, because fieldstone in a farmhouse is not on its
         face wrong. Below the floor course they are what stops the flight reading as a
         gap in the earth; at or above it the house's own construction is already there. */
      for (const dz of [-1, 1]) {
        for (let dy = 0; dy <= 3; dy++) {
          const y = wy + dy;
          if (y >= b - 1) continue;
          S(wx, y, hallZ + dz, BLOCK.FIELDSTONE);
        }
      }
      S(wx, wy, hallZ, stairDown);
      for (let dy = 1; dy <= 3; dy++) S(wx, wy + dy, hallZ, BLOCK.AIR);
    }
    // The head of the flight keeps a lintel so the pantry floor still reads as a floor.
    S(H.stairX0 - 1, b, hallZ, BLOCK.AIR);

    /* --- THE LONG HALL. Three cells wide, three high, thirty-four long, and finished
       exactly like the hallway on the ground floor of the house above. */
    const cx0 = Math.max(H.deepX0, chunk.cx * CHUNK_SX - 1);
    const cx1 = Math.min(H.deepX1, chunk.cx * CHUNK_SX + CHUNK_SX);
    for (let wx = cx0; wx <= cx1; wx++) {
      const inHall = wx >= H.hallX0 && wx <= H.hallX1 + 1;
      if (!inHall) continue;
      for (let dz = -2; dz <= 2; dz++) {
        const wz = hallZ + dz;
        if (Math.abs(dz) === 2) {
          this._homeWall(S, wx, wz, wx, wz, d - 1, 5, BLOCK.DRYWALL);
          continue;
        }
        S(wx, d - 1, wz, BLOCK.WOOD_FLOOR);
        for (let dy = 0; dy < 3; dy++) S(wx, d + dy, wz, BLOCK.AIR);
        S(wx, d + 3, wz, CEIL_PANEL);
      }
      /* THE RUNNER IS FLOORING, NOT AN OBJECT. Written as a block standing ON the floor
         every third cell it came out — a render of the corridor showed it plainly — as a
         row of waist-high red boxes down the middle of the hall. RUG is a full cube; it
         belongs in the floor course, where it reads as a carpet runner laid the length of
         a hallway, which is the image this corridor is entirely built around. */
      S(wx, d - 1, hallZ, BLOCK.RUG);
      if (((wx - H.hallX0) % 9) === 4) furnStamp(S, 'artLandscape', wx, d + 1, hallZ - 1, 0);
      if (((wx - H.hallX0) % 9) === 7) furnStamp(S, 'artPortrait', wx, d + 1, hallZ + 1, 2);
      // Wall lamps at the same pitch a hall would have them. Most of them are out.
      if (((wx - H.hallX0) % 11) === 5) S(wx, d + 2, hallZ - 1, BLOCK.TORCH);
    }
    /* THE ARRIVAL CELL BELONGS TO THE FLIGHT, NOT TO THE HALL, and this is the single
       fiddliest block in the phase.

       The flight is stairSteps treads long and its LAST tread sits exactly on the cell
       where the corridor begins — that is what puts the player down at the corridor's own
       floor level instead of a block above it. Written the obvious way, with the hall
       laid over that cell and a doorway cut through the end wall, three things went
       wrong at once: the tread was overwritten with air, the player arrived a block high
       standing on the SECOND-to-last tread, and the gap between that tread's surface and
       the corridor ceiling came to 1.7 blocks against a body 1.8 tall. The corridor, its
       four rooms and the Rift Core Disk were all unreachable, and every one of those
       cells looked completely ordinary in a block census.

       So the hall stops one cell short, this cell keeps its tread, and only the two
       sides and the ceiling are built around it. */
    /* ...and its ceiling is one course HIGHER than the corridor's, because the tread
       above it hangs into the corridor's own headroom. At the corridor height the gap
       between the second-to-last tread and the ceiling measured 1.7 blocks against a
       1.8-block body — a full stop, one cell short of the corridor, in a corner nothing
       looks wrong in. */
    for (const dz of [-1, 1]) {
      for (let y = d - 1; y <= d + 4; y++) S(H.hallX0 - 1, y, hallZ + dz, BLOCK.DRYWALL);
    }
    S(H.hallX0 - 1, d + 4, hallZ, CEIL_PANEL);

    /* --- THE ROOMS OFF IT. Four, and each one is a different way of being wrong. */
    // 1. THE BEDROOM THAT IS ALREADY UPSTAIRS. Same bed, same nightstand, same dresser,
    //    same lamp, same relative positions. Not similar: identical.
    this._homeRoomBelow(chunk, H, H.hallX0 + 4, hallZ - 9, 8, 7, -1, H.hallX0 + 7);
    {
      const rx = H.hallX0 + 5, rz = hallZ - 8;
      furnStamp(S, 'bedDoubleWarm', rx, d, rz, 0);
      furnStamp(S, 'nightstand', rx - 1, d, rz + 1, 0);
      furnStamp(S, 'dresserOak', rx + 3, d, rz, 0);
      furnStamp(S, 'lampBase', rx - 1, d + 1, rz, 0);
      furnStamp(S, 'chairOak', rx + 4, d, rz + 1, 2);
    }

    /* 2. THE DOORWAY WITH GROUND BEHIND IT. A proper architrave, a proper leaf standing
       open, and one block later the stone the corridor was cut out of. It is the plainest
       statement in the building: this door was built by something that knew houses have
       doors and did not know what they are for. */
    {
      const dx = H.hallX0 + 16;
      S(dx, d, hallZ - 2, BLOCK.AIR);
      this._homeDoor(S, dx, hallZ - 2, d, true, -1);
      S(dx, d, hallZ - 3, BLOCK.STONE);
      S(dx, d + 1, hallZ - 3, BLOCK.STONE);
      S(dx, d + 2, hallZ - 3, BLOCK.STONE);
    }

    /* 3. THE INVERTED ROOM. The floor is ceiling panel, the ceiling is floorboards, and
       the table, the chairs and the rug are hung from it. This is a direct quotation of
       the Level 1 and Level 3 Disconnected Homes — the same inversion, in the same role,
       three dimensions apart — and it is the memory link requirement 44 asks for. */
    {
      const rx = H.hallX0 + 19, rz = hallZ - 9, rw = 8, rd = 7;
      this._homeRoomBelow(chunk, H, rx, rz, rw, rd, -1, rx + 3);
      for (let wx = rx + 1; wx < rx + rw - 1; wx++)
        for (let wz = rz + 1; wz < rz + rd - 1; wz++) {
          S(wx, d - 1, wz, CEIL_PANEL);          // the floor is a ceiling
          S(wx, d + 3, wz, BLOCK.WOOD_FLOOR);    // the ceiling is a floor
        }
      // ...and the room stands on it, upside down. The furnisher does not care which
      // way up a cell is, so the same models simply hang.
      const ix = rx + 2, iz = rz + 2;
      furnStamp(S, 'rugRed', ix, d + 2, iz, 0);
      furnStamp(S, 'diningTable', ix + 1, d + 1, iz + 1, 0);
      furnStamp(S, 'chairWalnut', ix, d + 1, iz + 2, 0);
      furnStamp(S, 'chairWalnut', ix + 3, d + 1, iz + 1, 2);
      furnStamp(S, 'ceilingLight', ix + 2, d, iz + 2, 0);   // standing up out of the floor
    }

    /* 4. THE WINDOW. Six cells of Static Suburbia in a sealed box behind a pane, at the
       bottom of a farmhouse eight hundred blocks and a dimension away from it: mown turf,
       a poured sidewalk, a picket fence, a suburban mailbox, and a strip of flat sky.
       There is no way to reach it and no explanation of it anywhere in the game. */
    {
      const rx = H.hallX0 + 10, rz = hallZ + 3, rw = 7, rd = 6;
      this._homeRoomBelow(chunk, H, rx, rz, rw, rd, 1, rx + 3);
      const wz = rz + rd - 1;                       // the far wall of the room
      for (let k = 2; k <= 4; k++) {
        S(rx + k, d + 1, wz, BLOCK.WIN_CLEAR_X);
        S(rx + k, d + 2, wz, BLOCK.WIN_CLEAR_X);
      }
      for (let k = 1; k <= 5; k++)
        for (let j = 1; j <= 3; j++) {
          const bx = rx + k, bz = wz + j;
          for (let dy = 0; dy <= 3; dy++) S(bx, d + dy, bz, BLOCK.AIR);
          S(bx, d, bz, j === 1 ? BLOCK.SIDEWALK : BLOCK.LAWN);
          S(bx, d + 4, bz, BLOCK.GLASS_DARK);       // a flat lid of "sky"
        }
      S(rx + 2, d + 1, wz + 2, BLOCK.PICKET_X);
      S(rx + 3, d + 1, wz + 2, BLOCK.PICKET_POST);
      /* AND IT HAS TO BE LIT, or the whole beat is a black rectangle. The diorama is
         sealed a dozen blocks underground, so its baked skylight is zero and a render of
         the room showed exactly that: a well-made window with nothing behind it. Two
         torches in the box's top corners, tucked under the lid and mostly out of the
         sightline, give it the daylight it is pretending to have. They are ordinary
         generated torches, so they are picked up by the existing chunk light scan and
         taken down again with the chunk; the whole buried volume holds seven. */
      S(rx + 1, d + 3, wz + 3, BLOCK.TORCH);
      S(rx + 5, d + 3, wz + 3, BLOCK.TORCH);
      // The mailbox. It is here now. See updateFarmHomeAnomaly.
      S(rx + 4, d + 1, wz + 2, BLOCK.MAILBOX_Z);
      this.farmHomeMailbox = { x: rx + 4, y: d + 1, z: wz + 2, rx, rz, rw, rd };
    }

    /* --- THE ROOM AT THE END. Sixteen by twelve: wider and deeper than the farmhouse
       standing over it, and furnished as its living room. Same hearth, same rug, same
       couch, same chair, same picture over the mantel — reproduced by something working
       from one fragment twice and getting the size wrong the second time.

       The Ancient Chest sits on the hearth. */
    const bx0 = H.bigX0, bz0 = H.bigZ0, bw = 16, bd = 12;
    const qx0 = Math.max(bx0 - 1, chunk.cx * CHUNK_SX - 1);
    const qx1 = Math.min(bx0 + bw, chunk.cx * CHUNK_SX + CHUNK_SX);
    for (let wx = qx0; wx <= qx1; wx++) {
      for (let wz = bz0 - 1; wz <= bz0 + bd; wz++) {
        const edge = wx === bx0 - 1 || wx === bx0 + bw || wz === bz0 - 1 || wz === bz0 + bd;
        if (edge) { this._homeWall(S, wx, wz, wx, wz, d - 1, 5, BLOCK.DRYWALL); continue; }
        S(wx, d - 1, wz, BLOCK.WOOD_FLOOR);
        for (let dy = 0; dy < 3; dy++) S(wx, d + dy, wz, BLOCK.AIR);
        S(wx, d + 3, wz, CEIL_PANEL);
      }
    }
    // The way in, from the hall.
    S(bx0 - 1, d, hallZ, BLOCK.AIR);
    S(bx0 - 1, d + 1, hallZ, BLOCK.AIR);
    S(bx0 - 1, d + 2, hallZ, HEADER_Z);

    // THE HEARTH, AGAIN. No chimney above it, and nothing behind it but stone.
    const fx = bx0 + 7;
    for (let k = 0; k <= 2; k++) {
      S(fx + k, d, bz0, BLOCK.BRICK);
      S(fx + k, d + 1, bz0, BLOCK.BRICK);
      S(fx + k, d + 2, bz0, BLOCK.STONE_VENEER);
    }
    S(fx + 1, d, bz0 + 1, BLOCK.ASH_DRIFT);
    S(fx, d, bz0 + 1, BLOCK.STICKS);
    furnStamp(S, 'artLandscape', fx + 1, d + 2, bz0 + 1, 0);
    furnStamp(S, 'rugRed', bx0 + 6, d, bz0 + 3, 0);
    furnStamp(S, 'couchOlive', bx0 + 6, d, bz0 + 4, 2);
    furnStamp(S, 'armchairOat', bx0 + 9, d, bz0 + 3, 3);
    furnStamp(S, 'sideTable', bx0 + 5, d, bz0 + 4, 0);
    furnStamp(S, 'bookshelf', bx0 + 11, d, bz0 + 2, 0);
    furnStamp(S, 'artFamily', bx0 + 2, d + 2, bz0 + 1, 0);
    furnStamp(S, 'lampBase', bx0 + 5, d + 1, bz0 + 3, 0);
    // The two torches that make the room findable from the far end of the hall.
    S(bx0 + 1, d + 2, bz0 + 1, BLOCK.TORCH);
    S(bx0 + bw - 2, d + 2, bz0 + 1, BLOCK.TORCH);

    /* THE LEVEL 2 RIFT CORE DISK. On the hearth, dead centre, exactly where
       _farmResolveJourney said it would be before a single voxel of this existed. */
    S(H.chest.x, H.chest.y, H.chest.z, BLOCK.TREASURE_CHEST);
  }

  /* One room off the long hall: walls, floor, ceiling and a doorway back into the
     corridor. `side` is -1 for the north wall of the hall and +1 for the south. */
  _homeRoomBelow(chunk, H, rx, rz, rw, rd, side, doorX) {
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    if (!this._subHits(chunk, rx - 1, rz - 1, rx + rw, rz + rd)) return;
    const d = H.deepY, hallZ = H.hallZ;
    for (let wx = rx; wx < rx + rw; wx++)
      for (let wz = rz; wz < rz + rd; wz++) {
        const edge = wx === rx || wx === rx + rw - 1 || wz === rz || wz === rz + rd - 1;
        if (edge) { this._homeWall(S, wx, wz, wx, wz, d - 1, 5, BLOCK.DRYWALL); continue; }
        S(wx, d - 1, wz, BLOCK.WOOD_FLOOR);
        for (let dy = 0; dy < 3; dy++) S(wx, d + dy, wz, BLOCK.AIR);
        S(wx, d + 3, wz, CEIL_PANEL);
      }
    // Through the hall's own wall and into the room.
    const dz = hallZ + 2 * side;
    S(doorX, d, dz, BLOCK.AIR);
    this._homeDoor(S, doorX, dz, d, true, side);
    for (let wz = Math.min(dz, rz + (side < 0 ? rd - 1 : 0)); wz <= Math.max(dz, rz + (side < 0 ? rd - 1 : 0)); wz++) {
      for (let dy = 0; dy < 3; dy++) if (wz !== dz) S(doorX, d + dy, wz, BLOCK.AIR);
      if (wz !== dz) S(doorX, d - 1, wz, BLOCK.WOOD_FLOOR);
    }
  }

  /* ===================================================================================
     PHASE 20 — THE ONE STRONGER HORROR EVENT

     Requirement 46 allows the Home a single stronger beat and warns against making it a
     jumpscare maze. This is that beat, and it is deliberately the quietest thing in the
     phase: the suburban mailbox behind the impossible window is there when the player
     looks at it, and once they have walked away and are not looking, it is not.

     ONE VOXEL. It fires at most once per session, it is gated on the player having
     actually stood in that room, it never fires while the room is in view, and it never
     touches anything the player can reach. There is no sound, no flash and no message —
     the entire effect is the possibility that they misremembered.

     It is also the title of the game, stated once, in a basement.
     =================================================================================== */
  updateFarmHomeAnomaly(dt, playerPos, camera, inFarmlands) {
    const m = this.farmHomeMailbox;
    if (!m || !inFarmlands || this._farmMailboxGone) return;
    const dx = playerPos.x - (m.x + 0.5), dz = playerPos.z - (m.z + 0.5);
    const dy = playerPos.y - m.y;
    const d2 = dx * dx + dz * dz;
    if (!this._farmMailboxSeen) {
      // "Seen" means standing in the room it looks out of, not merely nearby.
      if (Math.abs(dy) < 4 && playerPos.x >= m.rx && playerPos.x <= m.rx + m.rw &&
          playerPos.z >= m.rz && playerPos.z <= m.rz + m.rd) {
        this._farmMailboxSeen = true;
      }
      return;
    }
    if (d2 < 100 || Math.abs(dy) > 6) return;         // still close enough to check
    if (camera) {
      _farmTowerFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const inv = 1 / Math.sqrt(d2);
      if ((-dx * inv) * _farmTowerFwd.x + (-dz * inv) * _farmTowerFwd.z > 0.35) return;
    }
    this._writeBlockRaw(m.x, m.y, m.z, BLOCK.AIR);
    this._farmMailboxGone = true;
  }
  _wSet(wx, wy, wz, level) {
    const id = level === 2 ? BLOCK.WATER : (level === 1 ? BLOCK.WATER_SHALLOW : BLOCK.AIR);
    this._wWriting = true;
    this.setBlockWorld(wx, wy, wz, id);
    this._wWriting = false;
  }

  _farmTopBlock(wx, wz, surf, ashen, depth, bval, rotIn) {
    /* --- WATER BEDS FIRST. Anything under water is silt or mud, whatever it was going
       to be otherwise. This is also the shoreline's inner ring: mud under the shallows,
       darker silt in the deep, so the transition grass -> dirt -> mud -> water reads
       even where the shore is a single block wide. */
    if (depth > 0) return depth === 1 ? BLOCK.FARM_MUD : BLOCK.DITCH_MUD;

    switch (surf) {
      case FARM_SURF.TRACK: return BLOCK.FARM_TRACK;
      case FARM_SURF.RUT: return BLOCK.FARM_RUT;
      case FARM_SURF.VERGE: {
        // A verge is dry, trodden ground that goes to dust beside the wheel line.
        const q = this._farmSoilPatch(wx, wz, 191);
        return q < 0.34 ? BLOCK.SOIL_DRY : (q < 0.52 ? BLOCK.SOIL_TRAMPLED : BLOCK.DEAD_EARTH);
      }
      case FARM_SURF.DITCH: return BLOCK.DITCH_MUD;
      case FARM_SURF.DITCH_LIP: return BLOCK.SOIL_WET;
      case FARM_SURF.BOUNDARY:
        return this._farmSoilPatch(wx, wz, 193) < 0.4 ? BLOCK.SOIL_DRY : BLOCK.DEAD_EARTH;
    }

    /* --- THE DEAD LAND, AND IT OUTRANKS THE BIOME.

       It is tested BEFORE the Ashen floor, and that ordering was a measured fix rather
       than a preference: the great tree's plot resolved at a biome value of 0.09, inside
       the forest's contamination edge, so with the rot applied further down the function
       every column around the trunk returned ash and the tree stood in grey woodland
       floor instead of in rotten farmland. Whatever the biome field thinks, inside this
       circle the tree is what decides what the ground is — which is the whole point of it.

       IT OVERRIDES THE PARCEL PROGRAMME RATHER THAN TINTING IT, for the same reason: a
       crop field that is still visibly a ploughed crop field with grey soil reads as a
       texture bug. Near the tree the ground is rotten outright; further out it is only
       spent and dry, and the patch noise interleaves the two across the middle of the
       ramp instead of meeting them at a line. */
    const rot = rotIn === undefined ? this._farmDeadLand(wx, wz) : rotIn;
    if (rot > 0) {
      const q0 = this._farmSoilPatch(wx, wz, 977);
      if (q0 < rot) {
        if (rot > 0.72) return q0 < rot * 0.55 ? BLOCK.ROTTEN_GROUND : BLOCK.ROTTED_SOIL;
        if (rot > 0.40) return q0 < rot * 0.5 ? BLOCK.DEAD_EARTH : BLOCK.SOIL_EXHAUSTED;
        return BLOCK.SOIL_DRY;
      }
      /* AND ABOVE HALF THE RAMP THERE IS NO FALLING THROUGH. The patch noise spares a
         fraction of columns so the rot interleaves with the ground it is eating rather
         than replacing it in one step — but sixty blocks from the trunk a census found a
         fifth of those spared columns coming back as ASH_GROUND, because the tree's plot
         sits inside the Ashen Forest's contamination edge and the ash test is further
         down. Inside the inner half of the ring the spared columns are spent ground
         instead: still lighter than the rotten cells beside them, still not ash, and
         still not a working field. */
      if (rot > 0.5) return q0 < 0.75 ? BLOCK.SOIL_EXHAUSTED : BLOCK.DEAD_EARTH;
    }

    /* --- THE ASHEN FLOOR, and the contamination ramp out of it. The forest is ash over
       bare exhausted ground, and the ash does not stop at the biome threshold: from one
       edge-width BELOW the threshold the odds of an ashen column climb, so the player
       walks out of fields into progressively greyer ground before a single burnt trunk
       is in view. Requirement 14's "ash patches extending slightly beyond the forest
       edge" and requirement 15's transition are the same mechanism seen from two sides. */
    if (ashen) {
      const q = this._farmSoilPatch(wx, wz, 197);
      if (q < 0.62) return BLOCK.ASH_GROUND;
      if (q < 0.80) return BLOCK.SOIL_EXHAUSTED;
      return BLOCK.ROTTED_SOIL;
    }
    if (this._farmInPad(wx, wz)) return BLOCK.ROTTED_SOIL;
    if (bval !== undefined && bval > FARM_BIOME_T - FARM_BIOME_EDGE) {
      const ramp = (bval - (FARM_BIOME_T - FARM_BIOME_EDGE)) / FARM_BIOME_EDGE;  // 0..1
      if (this._farmSoilPatch(wx, wz, 199) < ramp * 0.55) return BLOCK.ASH_GROUND;
    }

    const bx = Math.floor(wx / FARM_P), bz = Math.floor(wz / FARM_P);
    const p = this._farmParcel(bx, bz);
    const st = this._farmFieldState(bx, bz);
    const q = this._farmSoilPatch(wx, wz, 211);
    switch (p.kind) {
      case FARM_FIELD.CROP:
      case FARM_FIELD.FLOODED:
        /* A worked field is ploughed, but not uniformly: the parts that were still
           being fed are dark, the parts that were not are pale and spent. Which of the
           two dominates is the FIELD STATE, so a recently-dead field still reads as
           mostly fertile and a reclaimed one as mostly exhausted. */
        if (q < (st <= 1 ? 0.30 : 0.12)) return BLOCK.SOIL_FERTILE;
        if (q > (st >= 4 ? 0.62 : 0.86)) return BLOCK.SOIL_EXHAUSTED;
        return p.alongX ? BLOCK.TILLED_X : BLOCK.TILLED_Z;
      case FARM_FIELD.STUBBLE:
        if (q > 0.78) return BLOCK.SOIL_DRY;
        return p.alongX ? BLOCK.TILLED_X : BLOCK.TILLED_Z;
      case FARM_FIELD.DEAD:
        if (q < 0.26) return BLOCK.SOIL_EXHAUSTED;
        if (q > 0.84) return BLOCK.SOIL_DRY;
        return BLOCK.DEAD_EARTH;
      /* Grazed ground, not fallow ground. Pasture keeps the dimension's dark Rotted Soil
         so pale tussocks read against it — without this, dead fields and pastures share
         one surface and roughly half the Rotting Fields becomes a single flat colour. */
      case FARM_FIELD.PASTURE:
        return q < 0.22 ? BLOCK.SOIL_TRAMPLED : (q > 0.86 ? BLOCK.SOIL_OVERGROWN : BLOCK.ROTTED_SOIL);
      case FARM_FIELD.ORCHARD:
        return q > 0.70 ? BLOCK.SOIL_OVERGROWN : BLOCK.ROTTED_SOIL;
      default:
        // The copse programme: neglected ground going back to weed.
        return q < 0.42 ? BLOCK.SOIL_OVERGROWN : BLOCK.ROTTED_SOIL;
    }
  }

  /* ===================================================================================
     THE FARMSTEAD — COMPOSITION, NOT SCATTERING

     The brief's rule is that structures must stand in believable relationships, and the
     plan below is the relationship written down: the house addresses the lane, a
     driveway connects them, the yard sits behind the house, the barn closes the far side
     of the yard facing it, and the outbuildings line the yard edge. Fields start where
     the yard fence ends. Nothing is placed by rolling a position.

     Everything derives from the plot descriptor, so the plan is identical from every
     chunk that computes it and is never stored.
     =================================================================================== */
  _farmSteadPlan(st) {
    const H = (n) => this._farmHash(st.bx, st.bz, n);
    const hsh = (n) => this._farmHash(st.bx * 7 + n, st.bz * 11 + n, 211);
    const baseY = st.padY;
    const side = FARM_SIDINGS[Math.floor(H(221) * FARM_SIDINGS.length) % FARM_SIDINGS.length];
    const roofMat = SUB_ROOF_SETS[Math.floor(H(223) * SUB_ROOF_SETS.length) % SUB_ROOF_SETS.length];
    const out = [];

    // --- THE FARMHOUSE addresses the lane, set back behind a short drive.
    const hArch = FARM_HOUSE_SET[Math.floor(H(227) * FARM_HOUSE_SET.length) % FARM_HOUSE_SET.length];
    const HA = FARM_ARCH[hArch];
    const hx = st.ox + 3, hz = st.oz + 3;
    out.push({
      arch: hArch, x: hx, z: hz, w: HA.w, d: HA.d, ridge: HA.ridge,
      baseY, side, roofMat, face: st.face, decay: st.decay, role: 'house',
    });

    /* --- THE BARN sits across the yard FACING the house. That single decision does more
       for legibility than any amount of detail: two buildings facing each other with
       open ground between them is instantly a farmyard, whereas the same two buildings
       side by side is a street. */
    const bArch = FARM_BARN_SET[Math.floor(H(229) * FARM_BARN_SET.length) % FARM_BARN_SET.length];
    const BA = FARM_ARCH[bArch];
    const bx = st.ox + FARM_STEAD_W - BA.w - 3;
    const bz = st.oz + FARM_STEAD_D - BA.d - 3;
    out.push({
      arch: bArch, x: bx, z: bz, w: BA.w, d: BA.d, ridge: BA.ridge,
      baseY, side: H(233) < 0.62 ? BLOCK.BARN_RED : BLOCK.BARN_WHITE,
      roofMat: BLOCK.ROOF_TIN, face: (st.face + 2) % 4,
      decay: this._farmDecayLevel(st.bx, st.bz, 239), role: 'barn',
    });

    // --- OUTBUILDINGS line the yard's remaining edge. One to three, never more.
    const nOut = 1 + Math.floor(H(241) * 3);
    for (let k = 0; k < nOut; k++) {
      const oArch = FARM_OUT_SET[Math.floor(hsh(50 + k) * FARM_OUT_SET.length) % FARM_OUT_SET.length];
      const OA = FARM_ARCH[oArch];
      const ox = st.ox + 3 + k * 11;
      const oz = st.oz + FARM_STEAD_D - OA.d - 4;
      if (ox + OA.w > bx - 2) continue;          // never overlap the barn
      out.push({
        arch: oArch, x: ox, z: oz, w: OA.w, d: OA.d, ridge: OA.ridge,
        baseY, side: hsh(60 + k) < 0.5 ? BLOCK.FARM_CLAPBOARD : side,
        roofMat: hsh(61 + k) < 0.4 ? BLOCK.ROOF_TIN : roofMat,
        face: st.face, decay: this._farmDecayLevel(st.bx * 3 + k, st.bz, 251), role: 'out',
      });
    }
    return out;
  }

  /* ===================================================================================
     PHASE 20 — THE DISCONNECTED HOME 2.0

     WHAT WAS THERE BEFORE. A seven-by-seven obsidian box with a hole in one wall, a
     chequerboard floor, an oak-log ceiling and a chest hanging from it. It was written in
     Phase 5A as a placeholder for a pocket dimension that no longer exists, and by
     Phase 19 it was the only structure in the Farmlands that a player could mistake for
     unfinished work. Requirement 33 is right to call it unacceptable.

     THE ORDER OF OPERATIONS IS THE DESIGN. The house is built to be BELIEVED first:
     fieldstone footings, clapboard over a timber frame, a gable roof with eaves and a
     brick chimney, a covered porch on the road side with steps and a rail, a kitchen ell
     off the back, a shed, a well, a fence, a gate, a mailbox. Inside, a hall, a living
     room with a hearth, a dining room, a kitchen, a utility room, a pantry, a staircase,
     two bedrooms and a box room, furnished out of the Phase 14 catalogue with the
     domestic objects of people who farmed: a table laid and never cleared, work clothes
     over a chair, a calendar, photographs, boots by the door.

     ONLY THEN DOES IT STOP MAKING SENSE. And when it does, it does not do it with
     effects — it does it with geometry, because the thing the story needs communicated is
     that something rebuilt a farmhouse out of an idea of one and did not understand the
     rules a building obeys:

       a door on the upper landing that opens onto plaster;
       a window in the box room with nothing behind the glass at midday;
       a stair down from the pantry that goes eleven blocks — further than the house is
         tall — into A CORRIDOR PAPERED LIKE THE HOUSE'S OWN HALLWAY and thirty-four
         blocks long, which is longer than the entire property;
       a bedroom off that corridor furnished identically to the one upstairs;
       a doorway with solid ground a block behind it;
       a room in which the floor is a ceiling and the furniture hangs from above — the
         same inversion the Level 1 and Level 3 Disconnected Homes use, which is the
         memory link and is the reason it is quoted rather than invented;
       a room with a window looking out on six cells of Static Suburbia;
       and at the end, sixteen by twelve — larger than the whole farmhouse footprint —
         THE LIVING ROOM AGAIN. Same hearth, same rug, same chair, same picture. Built
         a second time, bigger, underground, by something working from the same fragment
         twice.

     The Rift Core chest sits on that second hearth.

     ALL OF IT IS BURIED. The corridor and its rooms are cut into stone a dozen blocks
     down and are invisible from every angle outside, which is what lets the exterior stay
     completely honest — and it is why the contradiction lands when the player paces the
     corridor and realises they walked out from under the house a long time ago.
     =================================================================================== */
  _farmStampHome(chunk) {
    const H = this.farmHome;
    if (!H) return;
    const hitProperty = this._subHits(chunk, H.ox - 2, H.oz - 2, H.x1 + 2, H.z1 + 2);
    const hitDeep = this._subHits(chunk, H.deepX0 - 2, H.deepZ0 - 2, H.deepX1 + 2, H.deepZ1 + 2);
    if (!hitProperty && !hitDeep) return;
    if (hitProperty) {
      this._farmHomeYard(chunk, H);
      this._farmHomeExterior(chunk, H);
      this._farmHomeInterior(chunk, H);
    }
    if (hitProperty || hitDeep) this._farmHomeBelow(chunk, H);
  }

  /* --- SMALL INTERIOR PRIMITIVES, shared by the house and by what is under it. They are
     methods rather than closures because the buried volume is stamped by a different
     pass and has to build the SAME hallway out of the SAME pieces — that identity is the
     entire point of the corridor down there. */
  _homeWall(S, x0, z0, x1, z1, y0, h, id) {
    for (let wx = x0; wx <= x1; wx++)
      for (let wz = z0; wz <= z1; wz++)
        for (let dy = 0; dy < h; dy++) S(wx, y0 + dy, wz, id);
  }
  // A cased opening with no leaf: two cells of clear height under a lintel.
  _homeDoorway(S, wx, wz, y0, alongX) {
    S(wx, y0, wz, alongX ? CASE_X : CASE_Z);
    S(wx, y0 + 1, wz, alongX ? CASE_X : CASE_Z);
    S(wx, y0 + 2, wz, alongX ? HEADER_X : HEADER_Z);
  }
  // ...and one with a leaf standing open in it. `swing` picks the side it folds to.
  _homeDoor(S, wx, wz, y0, alongX, swing) {
    const rec = INT_DOOR[(alongX ? 0 : 1) + ':' + (swing > 0 ? 1 : -1)];
    S(wx, y0, wz, rec ? rec.openId : (alongX ? CASE_X : CASE_Z));
    S(wx, y0 + 1, wz, alongX ? CASE_X : CASE_Z);
    S(wx, y0 + 2, wz, alongX ? HEADER_X : HEADER_Z);
  }
  // A closed leaf. Used exactly once above ground: the door that opens onto plaster.
  _homeDoorShut(S, wx, wz, y0, alongX, swing) {
    const rec = INT_DOOR[(alongX ? 0 : 1) + ':' + (swing > 0 ? 1 : -1)];
    S(wx, y0, wz, rec ? rec.closedId : (alongX ? CASE_X : CASE_Z));
    S(wx, y0 + 1, wz, alongX ? CASE_X : CASE_Z);
    S(wx, y0 + 2, wz, alongX ? HEADER_X : HEADER_Z);
  }
  _wLevel(wx, wy, wz) {
    if (wy < 0 || wy >= CHUNK_SY) return -1;
    const cx = Math.floor(wx / CHUNK_SX), cz = Math.floor(wz / CHUNK_SZ);
    const chunk = this.getChunk(cx, cz);
    // An unloaded chunk is NOT empty space. Treating it as air would let water pour
    // into the void at the streaming edge and vanish, which is both a visual tear and
    // a silent loss of volume that never comes back when the chunk returns.
    if (!chunk) return -1;
    const lx = ((wx % CHUNK_SX) + CHUNK_SX) % CHUNK_SX;
    const lz = ((wz % CHUNK_SZ) + CHUNK_SZ) % CHUNK_SZ;
    const id = chunk.data[chunk.idx(lx, wy, lz)];
    if (id === BLOCK.WATER) return 2;
    if (id === BLOCK.WATER_SHALLOW) return 1;
    if (id === BLOCK.AIR) return 0;
    // Decorative pieces (crops, grass, litter) are open to water; anything the player
    // collides with is not. SHAPE_AABB is empty exactly for the noclip pieces.
    const aabb = SHAPE_AABB[id];
    if (aabb && aabb.length === 0) return 0;
    return -1;
  }
  /* One cell. Returns true if anything moved (so the caller can wake the neighbours). */
  _wStepCell(wx, wy, wz, hops) {
    const lv = this._wLevel(wx, wy, wz);
    if (lv <= 0) return false;

    // --- 1. FALL.
    const bl = this._wLevel(wx, wy - 1, wz);
    if (bl >= 0 && bl < 2) {
      const move = Math.min(lv, 2 - bl);
      this._wSet(wx, wy - 1, wz, bl + move);
      this._wSet(wx, wy, wz, lv - move);
      this._wWake(wx, wy, wz, hops);
      this._wWake(wx, wy - 1, wz, hops);
      return true;
    }

    /* --- 2/3. LATERAL. The four directions are visited in a fixed order offset by the
       cell's own coordinates, so a cell does not always spill north first — without
       that a dam break produces a visibly rectangular tongue of water. It stays fully
       deterministic because the offset is a pure function of position. */
    const DX = [1, 0, -1, 0], DZ = [0, 1, 0, -1];
    const start = (((wx + wz) % 4) + 4) % 4;
    for (let i = 0; i < 4; i++) {
      const d = (start + i) & 3;
      const nx = wx + DX[d], nz = wz + DZ[d];
      const nl = this._wLevel(nx, wy, nz);
      if (nl !== 0) continue;
      if (lv === 2) {
        // A full cell splits one unit sideways.
        this._wSet(nx, wy, nz, 1);
        this._wSet(wx, wy, wz, 1);
        this._wWake(nx, wy, nz, hops);
        this._wWake(wx, wy, wz, hops);
        return true;
      }
      // A shallow cell only moves where it would immediately keep falling.
      const under = this._wLevel(nx, wy - 1, nz);
      if (under >= 0 && under < 2) {
        this._wSet(nx, wy, nz, 1);
        this._wSet(wx, wy, wz, 0);
        this._wWake(nx, wy, nz, hops);
        return true;
      }
    }
    return false;   // settled
  }
});
