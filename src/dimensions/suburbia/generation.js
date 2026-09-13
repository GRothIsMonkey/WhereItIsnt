"use strict";
/* =====================================================================================
   STATIC SUBURBIA — WHAT IS THERE, AND WHERE
   ERA 1.5.3 — MOVED VERBATIM OUT OF VoxelWorld.

   Lot layout, floor plans, furniture PLANNING, motifs, the revision/recognition passes
   and the rearrangement bookkeeping.

   NOTE WHAT IS AND IS NOT HERE. `_subFurnish` is 540 lines and writes no voxel at all: it
   builds an occupancy plan and hands it back. Deciding what goes where is generation;
   putting blocks down is stampers.js. That distinction is the file boundary.

   Every method below is byte-identical to the text that was in game.html, comments and
   all. It is attached to VoxelWorld's prototype by registerWorldContent, which copies
   property descriptors so a moved method is indistinguishable from a declared one.
   See src/world/world-content.js and ARCHITECTURE.md.
   ===================================================================================== */

registerWorldContent('suburbia', 'generation', class {

  // Slow pulse for the Disconnected Home (Level 3)'s glowing chest light. Call
  // once per frame alongside updateTorchFlicker/updateSoulAnchorPulse.
  updateDisconnectedHomeGlow(t) {
    if (!this.disconnectedHomeL3Glow) return;
    this.disconnectedHomeL3Glow.intensity = 1.6 * (0.9 + Math.sin(t * 1.3) * 0.35);
  }

  /* ===================================================================================
     PHASE 9 — STATIC SUBURBIA: INFINITE STREAMING SUBURB

     ARCHITECTURE. Suburbia is no longer a pre-built, pinned, wall-enclosed 8x8 pocket.
     It is now a TERRAIN GENERATOR VARIANT selected by world position, dispatched from
     _generateChunk exactly like ordinary overworld terrain. That single change lets it
     reuse the entire existing radial streamer unchanged: chunk load, chunk unload,
     dirty remeshing, editedChunks persistence and disposal all work with no new engine.

     EVERYTHING IS VOXELS. Houses, interior walls, doors, and furniture are all written
     into chunk.data during generation — there are no per-house meshes, materials,
     lights or prop objects anywhere. That is the whole answer to interior streaming
     and interior memory: an interior is meshed when its chunk is meshed and freed when
     its chunk is disposed, through code that already existed and is already correct.
     A house cannot leak because there is nothing house-shaped to leak.

     SEAMS. A house straddles chunk borders, so each chunk resolves every lot in the
     superblocks it overlaps and stamps only the voxels inside itself. Lot contents
     derive purely from world coordinates and the seed, so every chunk overlapping a
     house stamps an identical portion of it in any load order.
     =================================================================================== */

  // Deterministic 0..1 hash from integer lot/world coordinates.
  _subHash(a, b, c) {
    let s = ((a | 0) * 374761393 + (b | 0) * 668265263 + (c | 0) * 1274126177 + SUB_SEED) >>> 0;
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return (s % 100000) / 100000;
  }

  /* Is this grid line a collector (a through road) or a quiet residential street? Every
     third line in each axis is a collector. Pure function of the line index, so both
     sides of every chunk seam agree without any shared state. */
  _subCollector(line) { return (((line % 3) + 3) % 3) === 0; }

  /* CUL-DE-SAC. A stub road pushed into the middle of a superblock, ending in a bulb —
     additive only, so it can never disconnect the street network or strand the player.
     Deterministic per superblock and resolved by pure arithmetic, which is what lets the
     surface function answer for any column without knowing anything about lots. */
  _subCulDeSac(bx, bz) {
    if (this._subHash(bx, bz, 401) >= SUB_CULDESAC_CHANCE) return null;
    /* PROGRESSION GUARD. A cul-de-sac paves over the middle column of its superblock,
       and the Disconnected Home is placed on a hashed row/column that can land there —
       which would delete the Level 3 Core Disk chest from the world entirely, about one
       seed in six. The target superblock therefore never gets one. It also reads better:
       the one house on the street that is catastrophically wrong lands hardest on an
       ordinary through street, not at the end of an already-unusual dead end. */
    const t = this._subDisconnectedTarget();
    if (t && bx === t.bx && bz === t.bz) return null;
    return { u: 32, v: 38, r: 9, halfW: 4 };
  }

  /* THE GROUND PLANE. Returns a SURF code for one world column: which of yard, verge,
     sidewalk, kerb, gutter, carriageway or centre line this cell is. Roads run on both
     axes so intersections form naturally, and the whole thing stays a handful of integer
     comparisons because the hierarchy is expressed as bands of the superblock period. */
  _subSurfaceAt(wx, wz) {
    const bx = Math.floor(wx / SUB_P), bz = Math.floor(wz / SUB_P);
    const u = wx - bx * SUB_P, v = wz - bz * SUB_P;

    // --- Cul-de-sac stub and bulb, tested first: it overrides the lot interior.
    const cds = this._subCulDeSac(bx, bz);
    if (cds) {
      const du = u - cds.u, dv = v - cds.v;
      const d = Math.sqrt(du * du + dv * dv);
      if (d < cds.r) return SURF.ROAD;
      if (d < cds.r + 1) return SURF.CURB;
      if (d < cds.r + 2) return SURF.VERGE;
      if (Math.abs(du) < cds.halfW && v >= SUB_ROAD_W && v <= cds.v) {
        return (Math.abs(du) === cds.halfW - 1) ? SURF.GUTTER : SURF.ROAD;
      }
      if (Math.abs(du) === cds.halfW && v >= SUB_ROAD_W && v <= cds.v) return SURF.CURB;
      if (Math.abs(du) === cds.halfW + 1 && v >= SUB_ROAD_W && v <= cds.v) return SURF.VERGE;
    }

    // --- The orthogonal street grid.
    const onU = u < SUB_ROAD_W, onV = v < SUB_ROAD_W;
    if (onU || onV) {
      // Gutter pans hug the kerb on both edges of each carriageway.
      const uEdge = onU && (u === 0 || u === SUB_ROAD_W - 1);
      const vEdge = onV && (v === 0 || v === SUB_ROAD_W - 1);
      if (onU && onV) return SURF.ROAD;                       // the intersection box
      if (uEdge && !onV) return SURF.GUTTER;
      if (vEdge && !onU) return SURF.GUTTER;
      // Centre lines, on collectors only, and never through an intersection or a
      // pedestrian crossing.
      if (onU && !onV && (u === 3 || u === 4) && this._subCollector(bx)) {
        if (!(v >= SUB_WALK_U && v < SUB_WALK_U + SUB_WALK_W)) return SURF.LINE;
      }
      if (onV && !onU && (v === 3 || v === 4) && this._subCollector(bz)) {
        if (!(u >= SUB_WALK_U && u < SUB_WALK_U + SUB_WALK_W)) return SURF.LINE;
      }
      // A patched repair strip, sparsely, so the asphalt is not one dead flat colour.
      if (this._subHash(wx >> 2, wz >> 3, 55) < 0.05) return SURF.SEAM;
      return SURF.ROAD;
    }
    if (u === SUB_CURB_U || v === SUB_CURB_U || u === SUB_P - 1 || v === SUB_P - 1) return SURF.CURB;
    const uWalk = (u >= SUB_WALK_U && u < SUB_WALK_U + SUB_WALK_W) ||
                  (u >= SUB_P - 4 && u < SUB_P - 2);
    const vWalk = (v >= SUB_WALK_U && v < SUB_WALK_U + SUB_WALK_W) ||
                  (v >= SUB_P - 4 && v < SUB_P - 2);
    if (uWalk || vWalk) return SURF.WALK;
    if (u === SUB_VERGE_U || v === SUB_VERGE_U || u === SUB_P - 2 || v === SUB_P - 2) return SURF.VERGE;
    return SURF.LAWN;
  }

  /* ONE LOT. Three lots per row, two rows per superblock, both rows facing the street
     they front onto with their back yards meeting in the middle — the arrangement in
     the reference photography. The archetype is resolved HERE rather than by the caller
     so the house origin can be centred in its lot, which is what stops a street reading
     as a row of identically-aligned boxes. */
  _subLot(bx, bz, row, col) {
    /* PHASE 15 — a lot's SIGNATURE is what decides what house stands on it; its own grid
       position decides only where. For all but a few lots those are the same thing, and
       for a twin the signature is another lot's (see _subTwinSig). Resolved once, here,
       and carried on the lot so nothing downstream can accidentally use the wrong one. */
    const sig = this._subTwinSig(bx, bz, row, col);
    const arch = this._subArchetype(sig);
    const ox = bx * SUB_P + SUB_LOT_LO + col * SUB_LOT_W;
    // Small deterministic jog within the lot, so facades are not perfectly aligned.
    const jog = Math.floor(this._subHash(bx * 7 + col, bz * 13 + row, 77) * 3) - 1;
    const hx = ox + Math.floor((SUB_LOT_W - arch.w) / 2) + jog;
    const cds = this._subCulDeSac(bx, bz);
    let hz, facing;
    if (cds && row === 1 && col === 1) {
      // The house at the head of the cul-de-sac, turned to face the bulb.
      hz = bz * SUB_P + cds.v + cds.r + 2;
      facing = 2;
    } else if (row === 0) {
      hz = bz * SUB_P + SUB_ROW0_V;
      facing = 2;                                   // door on the -z wall
    } else {
      hz = bz * SUB_P + SUB_ROW1_V - arch.d;
      facing = 0;                                   // door on the +z wall
    }
    return { hx, hz, ox, bx, bz, row, col, arch, facing, cds: !!cds, sig };
  }

  /* =====================================================================================
     PHASE 15 — THE SIGNATURE, AND TWIN HOUSES

     Every visual decision about a house — archetype, siding, roof, door colour, anomaly
     tier, floor plan, chimney, shutters, motif — already derives from one pair of grid
     coordinates. Routing all of them through a single resolved SIGNATURE therefore costs
     nothing and buys the strongest recognition beat in the phase for free: point two
     different lots at the same signature and they become the same house.

     Not a similar house. The same one: same plan, same rooms, same furniture, same
     photograph on the same wall — standing somewhere else on the same street, usually on
     the opposite side of it, facing the other way. There is no copying step and no extra
     state; the second house simply resolves to the first one's signature.

     GUARDS. Never inside a cul-de-sac superblock (the bulb-head house has geometry of its
     own), and never involving the Disconnected Home's lot, which must stay unique because
     progression hangs off it.
     ===================================================================================== */
  _subTwinSig(bx, bz, row, col) {
    const self = { bx, bz, row, col, resolved: true, twin: false };
    if (this._subCulDeSac(bx, bz)) return self;
    if (this._subHash(bx, bz, 931) >= SUB_TWIN_CHANCE) return self;
    const ai = Math.floor(this._subHash(bx, bz, 932) * 6) % 6;
    let bi = Math.floor(this._subHash(bx, bz, 933) * 6) % 6;
    if (bi === ai) bi = (bi + 3) % 6;
    if (row * SUB_LOTS_PER_ROW + col !== bi) return self;    // this lot is not the copy
    const t = this._subDisconnectedTarget();
    if (t && t.bx === bx && t.bz === bz) {
      const ti = t.row * SUB_LOTS_PER_ROW + t.col;
      if (ti === ai || ti === bi) return self;
    }
    return { bx, bz, row: (ai / SUB_LOTS_PER_ROW) | 0, col: ai % SUB_LOTS_PER_ROW,
             resolved: true, twin: true };
  }

  // The signature of a lot descriptor, whether or not it was built by _subLot.
  _subSig(lot) {
    return lot.sig || this._subTwinSig(lot.bx, lot.bz, lot.row, lot.col);
  }

  /* The per-house hash. Every generator that dresses a house reads through this rather
     than hashing raw lot coordinates, which is precisely what makes a twin identical. */
  _subSigHash(lot) {
    const s = this._subSig(lot);
    const a = s.bx * 91 + s.col, b = s.bz * 47 + s.row;
    return (n) => this._subHash(a, b, n);
  }

  /* Does this house have a chimney? Asked in two places that MUST agree — the floor plan
     (which reserves the breast as a solid cell) and the roof (which stands the brick on
     it) — so it lives in one function rather than as two copies of the same literal. */
  _subChimney(lot) { return this._subSigHash(lot)(305) < 0.34; }

  /* =====================================================================================
     PHASE 15 — MOTIFS

     One object, in one named room, in the same relative place, in every house that
     carries it. Purely generative: no state, no ledger, identical on every re-stream, and
     free to compute. The placement is resolved from the PLAN alone (before a single piece
     of furniture is placed) so its cells can be reserved in the furnisher's occupancy
     grid — a motif can therefore never end up inside a sofa, and the furnisher can never
     end up standing a wardrobe where the photograph hangs.
     ===================================================================================== */
  _subMotifIndex(lot) {
    const r = this._subSigHash(lot)(921);
    if (r < SUB_MOTIF_NONE) return -1;
    let t = (r - SUB_MOTIF_NONE) / (1 - SUB_MOTIF_NONE), acc = 0;
    for (let i = 0; i < SUB_MOTIFS.length; i++) {
      acc += SUB_MOTIFS[i].w;
      if (t < acc) return i;
    }
    return SUB_MOTIFS.length - 1;
  }

  /* Resolves a motif to { model, face, dx, dz, y, cells } in plan-local coordinates, or
     null if this house carries none or has nowhere sensible to put it. */
  _subMotifPlan(plan, lot, arch, doorSide) {
    const idx = this._subMotifIndex(lot);
    if (idx < 0) return null;
    const M = SUB_MOTIFS[idx];
    const rooms = plan.rooms.filter(r => !r.lane);
    if (!rooms.length) return null;

    let room = null;
    if (M.where === 'entry') room = plan.rooms[plan.entryRoomId];
    else {
      const pool = rooms.filter(r => r.type === M.where);
      room = pool.length ? pool[pool.length - 1] : null;
    }
    if (!room) room = rooms.find(r => r.type === 'living') || plan.rooms[plan.entryRoomId] || rooms[0];
    if (!room || room.lane) return null;

    // Cells in front of a window are off limits: a motif must never brick one up, and
    // wall dressing hung across glass reads as a bug rather than as an oddity.
    const winFront = new Set();
    for (const win of plan.windows) {
      const f = _propFace(win.face);
      winFront.add((win.dx - f[0]) + ':' + (win.dz - f[1]));
    }
    const roomCell = (dx, dz) =>
      dx >= room.x0 && dx <= room.x1 && dz >= room.z0 && dz <= room.z1 &&
      plan.inRoom[plan.at(dx, dz)] === room.id && !winFront.has(dx + ':' + dz);

    let dx, dz, face;
    if (M.layer === 1) {
      /* WALL DRESSING — always on the wall you face as you come through the front door,
         at the same height, in every house that carries it. That consistency is the whole
         mechanic: the object is unremarkable, its position is not. */
      const side = (doorSide + 2) % 4;
      const runLen = (side % 2 === 0) ? room.w : room.d;
      const off = Math.floor((runLen - 1) / 2);
      for (let k = 0; k <= runLen; k++) {
        for (const o of (k === 0 ? [off] : [off - k, off + k])) {
          if (o < 0 || o >= runLen) continue;
          const cx = (side === 3) ? room.x1 : (side === 1) ? room.x0 : room.x0 + o;
          const cz = (side === 0) ? room.z1 : (side === 2) ? room.z0 : room.z0 + o;
          if (roomCell(cx, cz)) { dx = cx; dz = cz; break; }
        }
        if (dx !== undefined) break;
      }
      if (dx === undefined) return null;
      face = (side + 2) % 4;
    } else {
      /* FLOOR OBJECTS — the same corner of the same room, and turned to face the wall it
         stands in, which is what stops it reading as ordinary furniture. Circulation
         cells are excluded outright, so a motif can never narrow a route. */
      const corners = [[room.x0, room.z0, 2], [room.x1, room.z0, 2],
                       [room.x0, room.z1, 0], [room.x1, room.z1, 0]];
      for (const [cx, cz, f] of corners) {
        if (!roomCell(cx, cz)) continue;
        if (plan.reserved[plan.at(cx, cz)]) continue;
        dx = cx; dz = cz; face = f; break;
      }
      if (dx === undefined) return null;
    }

    const cells = [];
    for (const c of furnCells(M.model, face)) cells.push([dx + c[0], M.layer + c[1], dz + c[2]]);
    return { model: M.model, face, dx, dz, y: M.layer, cells, idx };
  }

  /* Archetype, siding, roof colour and anomaly tier for a lot. Everything is derived
     from the lot's grid coordinates, so a house is identical every time its chunks
     stream back in — which is what makes an infinite suburb possible at all. */
  _subArchetype(lotIn) {
    /* PHASE 15 — resolve the signature FIRST. Every caller now gets the house that
       belongs to the lot's signature rather than to its raw coordinates, which is the
       single change that makes a twin a twin. Callers that already hold a resolved
       signature (i.e. _subLot) pass it straight through at no cost. */
    const lot = lotIn.sig || (lotIn.resolved ? lotIn : this._subTwinSig(lotIn.bx, lotIn.bz, lotIn.row, lotIn.col));
    const r = this._subHash(lot.bx * 31 + lot.col, lot.bz * 17 + lot.row, 3);
    const a = SUB_ARCHETYPES[Math.floor(r * SUB_ARCHETYPES.length) % SUB_ARCHETYPES.length];
    const c = this._subHash(lot.bx, lot.bz * 7 + lot.row * 3 + lot.col, 9);
    const siding = SUB_SIDINGS[Math.floor(c * SUB_SIDINGS.length) % SUB_SIDINGS.length];
    const rf = this._subHash(lot.bx + 13, lot.bz * 5 + lot.row + lot.col, 41);
    const roofMat = SUB_ROOF_SETS[Math.floor(rf * SUB_ROOF_SETS.length) % SUB_ROOF_SETS.length];
    const dr = this._subHash(lot.bx - 9, lot.bz + lot.row * 2 + lot.col, 63);
    const doorIdx = Math.floor(dr * SUB_DOORS_X.length) % SUB_DOORS_X.length;
    /* ANOMALY TIER — unchanged. Roughly 75% of homes are completely ordinary, 20%
       subtly wrong, 5% genuinely impossible. */
    const t = this._subHash(lot.bx + 101, lot.bz - 57 + lot.row * 11 + lot.col * 3, 21);
    const tier = t < SUB_TIER_NORMAL ? 0 : (t < SUB_TIER_SUBTLE ? 1 : 2);
    return { ...a, siding, roofMat, doorIdx, tier, anomSeed: t };
  }

  // Every lot whose house, driveway, roof overhang or yard detail can touch this chunk.
  // The margin covers the full lot column from the kerb to the back fence, because a
  // driveway crosses several chunks between the garage and the road.
  _subLotsNear(chunk) {
    const x0 = chunk.cx * CHUNK_SX, z0 = chunk.cz * CHUNK_SZ;
    const b0x = Math.floor((x0 - SUB_P) / SUB_P), b1x = Math.floor((x0 + CHUNK_SX) / SUB_P);
    const b0z = Math.floor((z0 - SUB_P) / SUB_P), b1z = Math.floor((z0 + CHUNK_SZ) / SUB_P);
    const out = [];
    for (let bx = b0x; bx <= b1x; bx++)
      for (let bz = b0z; bz <= b1z; bz++)
        for (let row = 0; row < 2; row++)
          for (let col = 0; col < SUB_LOTS_PER_ROW; col++) {
            const lot = this._subLot(bx, bz, row, col);
            if (this._subLotBlocked(lot)) continue;
            const r = this._subLotRect(lot);
            if (r.x1 < x0 - 2 || r.x0 > x0 + CHUNK_SX + 2) continue;
            if (r.z1 < z0 - 2 || r.z0 > z0 + CHUNK_SZ + 2) continue;
            out.push(lot);
          }
    return out;
  }

  // The full area a lot can write into: house plus eaves, porch, driveway to the kerb
  // and back-yard planting.
  _subLotRect(lot) {
    const a = lot.arch;
    const x0 = lot.hx - 3, x1 = lot.hx + a.w + 3;
    const roadZ = lot.bz * SUB_P + (lot.facing === 2 ? SUB_ROAD_W - 1 : SUB_P - SUB_ROAD_W + 1);
    const backZ = lot.facing === 2 ? lot.hz + a.d + 8 : lot.hz - 8;
    return { x0, x1, z0: Math.min(roadZ, backZ) - 2, z1: Math.max(roadZ, backZ) + 2 };
  }

  // A lot the cul-de-sac paved over. Tested before anything is stamped, so a house can
  // never be left half-buried in a road.
  _subLotBlocked(lot) {
    if (this._subIsDisconnectedLot(lot)) return false;   // the progression lot is never suppressed
    const cds = this._subCulDeSac(lot.bx, lot.bz);
    if (!cds) return false;
    if (lot.row === 1 && lot.col === 1) return false;   // the bulb-head house survives
    const a = lot.arch;
    const cu = lot.bx * SUB_P + cds.u, cv = lot.bz * SUB_P + cds.v;
    const nx = Math.max(lot.hx - 2, Math.min(cu, lot.hx + a.w + 2));
    const nz = Math.max(lot.hz - 2, Math.min(cv, lot.hz + a.d + 2));
    if (Math.hypot(cu - nx, cv - nz) < cds.r + 3) return true;
    // The stub itself.
    const su0 = lot.bx * SUB_P + cds.u - cds.halfW - 2, su1 = su0 + cds.halfW * 2 + 4;
    const sv0 = lot.bz * SUB_P + SUB_ROAD_W, sv1 = cv;
    return !(lot.hx + a.w + 2 < su0 || lot.hx - 2 > su1 || lot.hz + a.d + 2 < sv0 || lot.hz - 2 > sv1);
  }

  /* =====================================================================================
     PHASE 15 — WHAT IS ALREADY STANDING ON THE VERGE

     A PRE-EXISTING BUG, FOUND WHILE VALIDATING THE MAILBOX REVISION. A lot writes its
     mailbox during house stamping; street furniture is written afterwards, in the same
     chunk pass, and simply overwrites whatever is in its column. In the secured Phase 14
     build that silently costs 24 lots in every 281 their mailbox — a hydrant, a lamp mast,
     a utility pole or a street tree standing exactly where the mailbox went.

     It was invisible until now because a missing mailbox on one house in twelve reads as
     ordinary variation. It stops being invisible the moment a revision is supposed to MOVE
     that mailbox, because moving something that is not there is a revision the player
     cannot possibly notice — precisely the failure mode this phase is built to avoid.

     The fix is this predicate: a pure function of world coordinates that answers whether
     _subStreetDetails is going to put something in this verge column at ground level, so
     the mailbox can choose a column that survives. It MUST agree with _subStreetDetails,
     and the Phase 15 suite pins that agreement by scanning a whole superblock and diffing
     this answer against what the generator actually wrote.
     ===================================================================================== */
  _subVergeOccupied(wx, wz) {
    const bx = Math.floor(wx / SUB_P), bz = Math.floor(wz / SUB_P);
    const u = wx - bx * SUB_P, v = wz - bz * SUB_P;
    const hv = this._subHash(wx, wz, 71);
    if (v === SUB_VERGE_U) {
      if (u % 28 === 6 && u >= SUB_LOT_LO) return true;                        // lamp mast
      if (u % 28 === 20 && u >= SUB_LOT_LO) return true;                       // utility pole
      if (u === SUB_LOT_LO + 9) return true;                                   // fire hydrant
      if (!this._subCollector(bz) && u >= SUB_LOT_LO && u % 9 === 4 && hv < 0.72) return true;
    }
    if (u === SUB_VERGE_U) {
      if (v % 28 === 20 && v >= SUB_LOT_LO) return true;                       // lamp mast
      if (!this._subCollector(bx) && v >= SUB_LOT_LO && v % 9 === 7 && hv < 0.72) return true;
    }
    if (u === SUB_VERGE_U && v === SUB_VERGE_U && this._subCollector(bx)) return true;  // stop sign
    return false;
  }

  /* WHERE THIS LOT'S MAILBOX CAN STAND — at most two columns, in a fixed order, both of
     them on the verge and neither of them a column street furniture is going to claim.
     Shared by _subYard (which writes it), by revision 4 (which takes the second one), and
     by the audit and the test suite (which check there is exactly one). Having a single
     answer to the question is the point: a revision that moves an object has to know
     where the object legitimately goes, and duplicating that reasoning would let the two
     copies drift apart. */
  _subMailboxSpots(lot, arch, doorSide, masses) {
    const m = (masses || this._subMasses(lot, arch, doorSide))[0];
    const [fx, fz] = _propFace(doorSide);
    const alongX = (doorSide % 2 === 0);
    const mid = this._subDoorOffset(lot, arch, doorSide, m.w, m.d);
    const [ddx, ddz] = this._subFaceCell(doorSide, mid, m.w, m.d);
    const dx0 = lot.hx + ddx, dz0 = lot.hz + ddz;
    const out = [];
    /* The scan starts at t=1. On an ordinary lot the first cells out of the door are lawn
       or porch deck and are skipped anyway; at the head of a cul-de-sac the verge is
       literally one cell from the threshold, and the old t=3 start stepped over it. */
    for (let t = 1; t < 16; t++) {
      const px = dx0 + fx * t, pz = dz0 + fz * t;
      if (this._subSurfaceAt(px, pz) !== SURF.VERGE) continue;
      /* Candidates as [along, back]: `along` is cells to either side of the path, `back`
         is cells returned toward the house. On a straight street the first two entries
         always win and this is exactly the old +/-2 behaviour. The tail exists for the
         cul-de-sac bulb, whose verge is a single curved cell wide — there, everything two
         or more along the street has already left the ring, and the ring is instead found
         one row back. +/-1 comes last because the kerbside bin lives at -1. */
      const CAND = [[2, 0], [-2, 0], [3, 0], [-3, 0], [4, 0], [-4, 0],
                    [2, 1], [-2, 1], [3, 1], [-3, 1], [1, 0], [-1, 0], [1, 1], [-1, 1]];
      for (const [a, b] of CAND) {
        const mx = px + (alongX ? a : 0) - fx * b;
        const mz = pz + (alongX ? 0 : a) - fz * b;
        if (this._subSurfaceAt(mx, mz) !== SURF.VERGE) continue;
        if (this._subVergeOccupied(mx, mz)) continue;
        out.push([mx, mz]);
        if (out.length >= 2) break;
      }
      break;
    }
    return out;
  }

  /* MASSING. Returns the volumes this house is built from, main mass first. Everything
     downstream — shells, roofs, eaves, openings — walks this list, so adding a new
     archetype is a matter of describing its masses and nothing else. */
  _subMasses(lot, arch, doorSide) {
    const baseY = SUBURBIA_BASE_Y;
    const wallH = arch.storeys === 2 ? 8 : 4;
    const out = [{
      x: lot.hx, z: lot.hz, w: arch.w, d: arch.d,
      floorY: baseY, plateY: baseY + wallH,
      roof: arch.roof, ridge: arch.ridge, main: true,
    }];
    // Which way the house faces, as a unit step out of the front wall.
    const [fx, fz] = _propFace(doorSide);

    /* A PROJECTING GARAGE WING sits entirely in FRONT of the main facade and shares
       exactly one wall plane with it. That constraint matters: the wing is stamped
       before the main mass, so the shared column ends up as house siding rather than a
       hole opening the living room into the garage, and the garage stays a room you can
       only enter through its own door. `garageOut: 0` means a flush garage instead —
       no wing at all, just a bay carved into the main wall (see _subDriveway). */
    if (arch.garage === 'front' && (arch.garageOut || 0) > 0) {
      const gW = arch.garageW, gD = arch.garageD;
      const alongX = (doorSide % 2 === 0);
      let gx, gz, gw, gd;
      if (alongX) {
        gw = gW; gd = gD;
        gx = lot.hx + (doorSide === 2 ? 0 : arch.w - gW);
        gz = doorSide === 2 ? lot.hz - gD + 1 : lot.hz + arch.d - 1;
      } else {
        gw = gD; gd = gW;
        gx = doorSide === 1 ? lot.hx - gD + 1 : lot.hx + arch.w - 1;
        gz = lot.hz + (doorSide === 1 ? 0 : arch.d - gW);
      }
      out.push({
        x: gx, z: gz, w: gw, d: gd,
        floorY: baseY, plateY: baseY + 3,
        roof: 'gable', ridge: alongX ? 'z' : 'x', garage: true, out: doorSide,
      });
    } else if (arch.garage === 'side') {
      // Corner lots turn the garage to the side street, which is exactly what a real
      // corner lot does with its driveway — and it is what makes the corner archetype
      // read differently from the mid-block houses either side of it.
      const gW = arch.garageW, gD = arch.garageD;
      out.push({
        x: lot.hx + arch.w - 1, z: lot.hz + arch.d - gD,
        w: gW, d: gD, floorY: baseY, plateY: baseY + 3,
        roof: 'gable', ridge: 'z', garage: true, sideGarage: true, out: 3,
      });
    }

    if (arch.split) {
      /* SPLIT-LEVEL. The front half of the main mass drops two blocks and gets its own
         ridge, so the house steps down toward the street — the defining silhouette of
         the type, and impossible to read without two roof planes at different heights. */
      const m = out[0];
      const cut = Math.floor(m.d / 2);
      m.plateY = baseY + 6;
      out.push({
        x: m.x, z: fz < 0 ? m.z : m.z + m.d - cut,
        w: m.w, d: cut, floorY: baseY, plateY: baseY + 4,
        roof: 'gable', ridge: 'x', wing: true,
      });
    }
    return out;
  }

  /* Where the front door goes on its facade. Centre unless a wing is in the way. */
  _subDoorOffset(lot, arch, doorSide, W, D) {
    const alongX = (doorSide % 2 === 0);
    const along = alongX ? W : D;
    const mid = Math.floor(along / 2);
    let masses = null;
    try { masses = this._subMasses(lot, arch, doorSide); } catch (e) { return mid; }
    const wings = masses.filter(m => !m.main);
    if (!wings.length) return mid;
    const f = _propFace(doorSide);
    const blocked = (off) => {
      const c = this._subFaceCell(doorSide, off, W, D);
      for (let t = 1; t <= 2; t++) {
        const wx = lot.hx + c[0] + f[0] * t, wz = lot.hz + c[1] + f[1] * t;
        for (const m of wings) {
          if (wx >= m.x && wx < m.x + m.w && wz >= m.z && wz < m.z + m.d) return true;
        }
      }
      return false;
    };
    if (!blocked(mid)) return mid;
    for (let k = 1; k < along; k++) {
      for (const off of [mid - k, mid + k]) {
        if (off >= 2 && off <= along - 3 && !blocked(off)) return off;
      }
    }
    return mid;
  }

  // Local (dx,dz) on a wall face: 0=+z(south) 1=-x(west) 2=-z(north) 3=+x(east).
  _subFaceCell(face, offset, W, D) {
    switch (((face % 4) + 4) % 4) {
      case 0: return [offset, D - 1];
      case 1: return [0, offset];
      case 2: return [offset, 0];
      default: return [W - 1, offset];
    }
  }

  /* ---------------------------------------------------------------------------------
     INTERIORS. Partitioned from a small set of reusable room layouts and furnished from
     the shared Phase 12 SUB_PROP vocabulary — UNCHANGED in structure, so enterable
     houses, interior streaming and the anomaly tiers all behave exactly as they did.
     Only the surfaces moved: partitions are drywall rather than concrete, floors are
     boards, carpet and tile rather than one polished oak everywhere.
     --------------------------------------------------------------------------------- */
  /* =====================================================================================
     PHASE 14 — THE ROOM SYSTEM

     A house is no longer "a box with a cross wall in it". Every mass is planned the way a
     small house actually is:

       1. BINARY SUBDIVISION of the interior rectangle, splitting the longer side, never
          leaving a room narrower than two cells, and stopping when a room is small enough
          to be a room rather than a hall.
       2. ROOM TYPING from the plan's own topology — which room holds the front door, which
          rooms touch an outside wall, which is smallest. A kitchen needs an exterior wall
          for its window and its sink; a bathroom is the smallest room; bedrooms are the
          rooms furthest from the entry. Nothing is assigned by index or by luck.
       3. PARTITIONS assembled from the sixteen-piece junction set, so runs, corners, tees
          and crosses all come out right with no special cases, and every partition meets
          the exterior wall cleanly.
       4. DOORWAYS placed on a SPANNING TREE of the room adjacency graph rooted at the
          entry, plus a few extra openings between public rooms. That is what guarantees
          every room in every house is reachable — it is a property of the algorithm, not
          something we hope holds.
       5. A CIRCULATION RESERVATION: the shortest paths from the entry to every room, and
          the cell on each side of every doorway and every door swing, are reserved before
          a single piece of furniture is placed. Furniture physically cannot be put there,
          so a house cannot be furnished into a dead end.

     Heights: rooms are three cells tall with a real drywall ceiling above them, which is
     the first time Suburbia interiors have had a ceiling at all rather than opening
     straight onto the underside of the roof.
     ===================================================================================== */

  // Interior cell layers, measured from the floor of a mass.
  // 0,1,2 = the room; 3 = the ceiling course.
  _subRoomH() { return 3; }

  /* Local (dx,dz) of every window cell on a mass, and of the interior cell each one
     looks out of. Recomputed from the same rules _subOpenings uses rather than read back
     from the chunk, because a house is stamped with clipping and the cell in question is
     very often in a chunk that is not the one being generated. */
  _subWindowLocals(lot, arch, doorSide, W, D, storey) {
    const out = [];
    const shut = 0;
    for (let f = 0; f < 4; f++) {
      if (f === doorSide) continue;
      const len = (f % 2 === 0) ? W : D;
      for (const off of [2, len - 3]) {
        if (off < 1 || off >= len - 1) continue;
        const c = this._subFaceCell(f, off, W, D);
        out.push({ dx: c[0], dz: c[1], face: f });
      }
    }
    if (storey === 0) {
      const alongX = (doorSide % 2 === 0);
      const along = alongX ? W : D;
      const mid = this._subDoorOffset(lot, arch, doorSide, W, D);
      const wideStart = mid + 2;
      if (wideStart + 2 < along - 1) {
        for (let i = 0; i < 3; i++) {
          const c = this._subFaceCell(doorSide, wideStart + i, W, D);
          out.push({ dx: c[0], dz: c[1], face: doorSide });
        }
      }
    }
    return out;
  }

  /* --------------------------------------------------------------------------------------
     THE FLOOR PLAN. Pure and deterministic: same lot, same storey, same plan, every time
     any of the up-to-six chunks the house touches asks for it. Nothing here reads or
     writes the world.
     -------------------------------------------------------------------------------------- */
  _subFloorPlan(lot, arch, doorSide, W, D, storey) {
    /* PHASE 15 — the plan is a property of the house's SIGNATURE, not of the ground it
       stands on. Keying the cache the same way means a twin does not merely get an
       identical plan, it shares the one already computed. */
    const sg = this._subSig(lot);
    const key = sg.bx + ':' + sg.bz + ':' + sg.row + ':' + sg.col + '|' + doorSide + '|' + storey;
    if (!this._subPlanCache) { this._subPlanCache = new Map(); this._subPlanOrder = []; }
    const hit = this._subPlanCache.get(key);
    if (hit) return hit;

    const h = (n) => this._subHash(sg.bx * 91 + sg.col + storey * 7, sg.bz * 47 + sg.row, 400 + n);
    const x0 = 1, z0 = 1, x1 = W - 2, z1 = D - 2;
    const rooms = [];
    let hn = 0;

    /* --- 0. Where a partition MUST NOT go.
       A wall that runs into the back of a window bisects it — half a window in one room
       and half in the next — which is one of the most obviously wrong things an interior
       can do, and it is invisible from the plan alone. The same is true of a partition
       standing directly inside the front door. Both are collected here as forbidden split
       positions before a single cut is made, which is far cheaper and far more reliable
       than trying to repair the plan afterwards. */
    const solidCells = new Set();
    if (this._subChimney(lot)) solidCells.add((1) + ':' + (D - 2));
    // The rectangle the subdivision actually works in — shrunk by the stair lane below.
    let bx0 = x0, bz0 = z0, bx1 = x1, bz1 = z1;

    /* THE STAIR LANE — reserved before anything is cut. See above. */
    let lane = null;
    if (arch.storeys === 2) {
      const iw = x1 - x0 + 1, id = z1 - z0 + 1;
      const aX = (doorSide % 2 === 0);
      const dcL = this._subFaceCell(doorSide, this._subDoorOffset(lot, arch, doorSide, W, D), W, D);
      const dfL = _propFace(doorSide);
      const entryX = Math.max(x0, Math.min(x1, dcL[0] - dfL[0]));
      const entryZ = Math.max(z0, Math.min(z1, dcL[1] - dfL[1]));
      const opts = [];
      if (id >= 6 && iw >= 3) { opts.push({ axis: 1, at: x1 }); opts.push({ axis: 1, at: x0 }); }
      if (iw >= 6 && id >= 3) { opts.push({ axis: 0, at: z1 }); opts.push({ axis: 0, at: z0 }); }
      for (const o of opts) {
        // A lane may not swallow the chimney breast or the cell inside the front door.
        const bad = o.axis === 1
          ? (solidCells.has(o.at + ':' + (D - 2)) || entryX === o.at)
          : (solidCells.has('1:' + o.at) || entryZ === o.at);
        if (bad) continue;
        lane = o; break;
      }
      if (lane) {
        if (lane.axis === 1) { if (lane.at === x0) bx0 = x0 + 1; else bx1 = x1 - 1; }
        else { if (lane.at === z0) bz0 = z0 + 1; else bz1 = z1 - 1; }
      }
    }

    const avoidX = new Set(), avoidZ = new Set();
    for (const win of this._subWindowLocals(lot, arch, doorSide, W, D, storey)) {
      const wf = _propFace(win.face);
      const ix = win.dx - wf[0], iz = win.dz - wf[1];
      if (win.face % 2 === 0) avoidX.add(ix); else avoidZ.add(iz);
    }
    {
      const aX = (doorSide % 2 === 0);
      const dc0 = this._subFaceCell(doorSide, this._subDoorOffset(lot, arch, doorSide, W, D), W, D);
      const df = _propFace(doorSide);
      if (aX) avoidX.add(dc0[0] - df[0]); else avoidZ.add(dc0[1] - df[1]);
    }
    // Pick a split position, preferring one that offends neither a window nor the door.
    const choose = (lo, hi, avoid, a, b) => {
      const all = [], wideAny = [], clean = [], wideClean = [];
      for (let p = lo; p <= hi; p++) {
        all.push(p);
        const wide = (p - a >= 3) && (b - p >= 3);
        const ok = !avoid.has(p);
        if (wide) wideAny.push(p);
        if (ok) clean.push(p);
        if (wide && ok) wideClean.push(p);
      }
      const pool = wideClean.length ? wideClean
        : (clean.length ? clean : (wideAny.length ? wideAny : all));
      return pool[Math.floor(h(hn++) * pool.length) % pool.length];
    };

    // --- 1. Binary subdivision -------------------------------------------------------
    const MINSIDE = 2;
    const split = (r, depth) => {
      const w = r.x1 - r.x0 + 1, d = r.z1 - r.z0 + 1;
      const canX = w >= MINSIDE * 2 + 2, canZ = d >= MINSIDE * 2 + 2;
      if (depth >= 3 || (w * d) <= 14 || (!canX && !canZ)) { rooms.push(r); return; }
      let axis = (canX && canZ) ? (w >= d ? 0 : 1) : (canX ? 0 : 1);
      if (canX && canZ && Math.abs(w - d) <= 1 && h(hn++) < 0.4) axis = 1 - axis;
      if (axis === 0) {
        const p = choose(r.x0 + MINSIDE, r.x1 - MINSIDE, avoidX, r.x0, r.x1);
        split({ x0: r.x0, z0: r.z0, x1: p - 1, z1: r.z1 }, depth + 1);
        split({ x0: p + 1, z0: r.z0, x1: r.x1, z1: r.z1 }, depth + 1);
      } else {
        const p = choose(r.z0 + MINSIDE, r.z1 - MINSIDE, avoidZ, r.z0, r.z1);
        split({ x0: r.x0, z0: r.z0, x1: r.x1, z1: p - 1 }, depth + 1);
        split({ x0: r.x0, z0: p + 1, x1: r.x1, z1: r.z1 }, depth + 1);
      }
    };
    split({ x0: bx0, z0: bz0, x1: bx1, z1: bz1 }, 0);
    if (lane) {
      const r = lane.axis === 1
        ? { x0: lane.at, z0, x1: lane.at, z1 }
        : { x0, z0: lane.at, x1, z1: lane.at };
      r.lane = true;
      rooms.push(r);
    }
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      r.id = i;
      r.w = r.x1 - r.x0 + 1; r.d = r.z1 - r.z0 + 1; r.area = r.w * r.d;
      r.type = r.lane ? 'hall' : null;
      // Does this room touch the outside? A kitchen or a bedroom without a window is a
      // cupboard, so this is what the typing pass keys off.
      r.outer = (r.x0 === x0) || (r.x1 === x1) || (r.z0 === z0) || (r.z1 === z1);
    }

    // --- 2. Wall cells ---------------------------------------------------------------
    const inRoom = new Int16Array(W * D).fill(-1);
    const at = (dx, dz) => dx * D + dz;
    for (const r of rooms)
      for (let dx = r.x0; dx <= r.x1; dx++)
        for (let dz = r.z0; dz <= r.z1; dz++) inRoom[at(dx, dz)] = r.id;
    const isWall = (dx, dz) =>
      dx >= x0 && dx <= x1 && dz >= z0 && dz <= z1 && inRoom[at(dx, dz)] < 0;
    const wallCells = [];
    for (let dx = x0; dx <= x1; dx++)
      for (let dz = z0; dz <= z1; dz++) {
        if (!isWall(dx, dz)) continue;
        let mask = 0;
        // A stub runs toward a neighbour that is another partition cell OR the shell.
        if (isWall(dx - 1, dz) || dx - 1 < x0) mask |= 1;
        if (isWall(dx + 1, dz) || dx + 1 > x1) mask |= 2;
        if (isWall(dx, dz - 1) || dz - 1 < z0) mask |= 4;
        if (isWall(dx, dz + 1) || dz + 1 > z1) mask |= 8;
        if (!mask) mask = 15;
        wallCells.push({ dx, dz, mask });
      }
    const wallAt = new Map();
    for (const w of wallCells) wallAt.set(at(w.dx, w.dz), w);

    // --- 3. Entry ---------------------------------------------------------------------
    const alongX = (doorSide % 2 === 0);
    const along = alongX ? W : D;
    const dcell = this._subFaceCell(doorSide, this._subDoorOffset(lot, arch, doorSide, W, D), W, D);
    const fdir = _propFace(doorSide);
    // The interior cell just inside the front door.
    let entry = { dx: dcell[0] - fdir[0], dz: dcell[1] - fdir[1] };
    entry.dx = Math.max(x0, Math.min(x1, entry.dx));
    entry.dz = Math.max(z0, Math.min(z1, entry.dz));
    // A front door must never open straight into a partition. If it does, shove the
    // partition run one cell over rather than leaving an unenterable house.
    if (isWall(entry.dx, entry.dz)) {
      const alt = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [ax, az] of alt) {
        const nx = entry.dx + ax, nz = entry.dz + az;
        if (nx >= x0 && nx <= x1 && nz >= z0 && nz <= z1 && !isWall(nx, nz)) { entry = { dx: nx, dz: nz }; break; }
      }
    }
    const entryRoomId = inRoom[at(entry.dx, entry.dz)];

    // --- 4. Room adjacency, through partition cells only -------------------------------
    const adj = new Map();   // "a:b" -> [ {dx,dz,axis} ... ] candidate doorway cells
    const addAdj = (a, b, cell) => {
      if (a < 0 || b < 0 || a === b) return;
      const k = Math.min(a, b) + ':' + Math.max(a, b);
      if (!adj.has(k)) adj.set(k, []);
      adj.get(k).push(cell);
    };
    for (const w of wallCells) {
      const west = w.dx - 1 >= x0 ? inRoom[at(w.dx - 1, w.dz)] : -1;
      const east = w.dx + 1 <= x1 ? inRoom[at(w.dx + 1, w.dz)] : -1;
      const north = w.dz - 1 >= z0 ? inRoom[at(w.dx, w.dz - 1)] : -1;
      const south = w.dz + 1 <= z1 ? inRoom[at(w.dx, w.dz + 1)] : -1;
      // axis 1 = the wall runs along Z, so you walk through it in x.
      if (west >= 0 && east >= 0) addAdj(west, east, { dx: w.dx, dz: w.dz, axis: 1, a: west, b: east });
      if (north >= 0 && south >= 0) addAdj(north, south, { dx: w.dx, dz: w.dz, axis: 0, a: north, b: south });
    }

    /* Rooms that simply touch, with no partition between them, are already connected —
       which is how the stair lane joins the rest of the house. The doorway graph is
       seeded with these so it neither reports them unreachable nor cuts a doorway through
       a wall that is not there. */
    const openPairs = new Set();
    for (let dx = x0; dx <= x1; dx++)
      for (let dz = z0; dz <= z1; dz++) {
        const a = inRoom[at(dx, dz)];
        if (a < 0) continue;
        for (const [nx, nz] of [[dx + 1, dz], [dx, dz + 1]]) {
          if (nx > x1 || nz > z1) continue;
          const b = inRoom[at(nx, nz)];
          if (b < 0 || b === a) continue;
          openPairs.add(Math.min(a, b) + ':' + Math.max(a, b));
        }
      }

    // --- 5. Typing ---------------------------------------------------------------------
    const byArea = rooms.slice().sort((a, b) => b.area - a.area);
    const neighbours = (id) => {
      const out = [];
      for (const k of adj.keys()) {
        const [a, b] = k.split(':').map(Number);
        if (a === id) out.push(b); else if (b === id) out.push(a);
      }
      return out;
    };
    const take = (pred) => { for (const r of byArea) if (!r.type && pred(r)) return r; return null; };
    const roomy = (r) => Math.min(r.w, r.d) >= 3;

    const entryRoom = rooms[entryRoomId] || byArea[0];
    if (rooms.length > 2 && (entryRoom.area <= 9 || !roomy(entryRoom))) {
      entryRoom.type = 'hall';
      const nb = neighbours(entryRoom.id).map(i => rooms[i]).sort((a, b) => b.area - a.area);
      const liv = nb.find(r => !r.type && roomy(r)) || take(roomy) || nb.find(r => !r.type) || take(() => true);
      if (liv) liv.type = 'living';
    } else {
      entryRoom.type = 'living';
    }
    // Kitchen: the largest untyped room with an outside wall and room for a worktop run.
    const kit = take(r => r.outer && roomy(r)) || take(roomy) || take(r => r.outer) || take(() => true);
    if (kit) kit.type = 'kitchen';
    // Bathroom: the SMALLEST untyped room. Every house gets exactly one.
    let bath = null;
    for (let i = byArea.length - 1; i >= 0; i--) if (!byArea[i].type) { bath = byArea[i]; break; }
    if (bath) bath.type = 'bathroom';
    // Utility, if a genuinely small room is still going spare.
    if (storey === 0) {
      for (let i = byArea.length - 1; i >= 0; i--) {
        if (!byArea[i].type && byArea[i].area <= 9) { byArea[i].type = 'laundry'; break; }
      }
    }
    // Dining, next to the kitchen, on the ground floor only.
    if (storey === 0 && kit) {
      const nb = neighbours(kit.id).map(i => rooms[i]).filter(r => !r.type && roomy(r)).sort((a, b) => b.area - a.area);
      if (nb.length && nb[0].area >= 9) nb[0].type = 'dining';
    }
    for (const r of rooms) if (!r.type) r.type = 'bedroom';
    // Every ground floor of a single-storey house needs somewhere to sleep.
    if (storey === 0 && arch.storeys === 1 && !rooms.some(r => r.type === 'bedroom')) {
      const cand = rooms.filter(r => r.type === 'dining' || r.type === 'laundry')
        .sort((a, b) => b.area - a.area)[0];
      if (cand) cand.type = 'bedroom';
    }
    if (storey === 1) {
      // Upstairs is bedrooms and a bathroom; a kitchen or dining room up here would be
      // the sort of wrongness this dimension saves for the 5%.
      for (const r of rooms) if (r.type !== 'bathroom' && r.type !== 'hall') r.type = 'bedroom';
    }

    // --- 6. Doorways: spanning tree, then a few extra public openings -------------------
    const doorways = [];
    const used = new Set();
    const usableCells = (list) => list.filter(c => !solidCells.has(c.dx + ':' + c.dz));
    const pickCell = (listIn) => {
      const list = usableCells(listIn).length ? usableCells(listIn) : listIn;
      // Prefer a cell away from the ends of the run — a doorway hard against a corner
      // reads wrong and leaves no room for the casing.
      if (list.length >= 3) return list[Math.floor(list.length / 2)];
      return list[Math.floor(h(hn++) * list.length) % list.length];
    };
    const seen = new Set([entryRoom.id]);
    const queue = [entryRoom.id];
    while (queue.length) {
      const cur = queue.shift();
      // Rooms that already open onto each other need no doorway cutting.
      for (const k of openPairs) {
        const [a, b] = k.split(':').map(Number);
        if (a !== cur && b !== cur) continue;
        const other = a === cur ? b : a;
        if (seen.has(other)) continue;
        seen.add(other); queue.push(other);
      }
      for (const k of adj.keys()) {
        const [a, b] = k.split(':').map(Number);
        if (a !== cur && b !== cur) continue;
        const other = a === cur ? b : a;
        if (seen.has(other)) continue;
        seen.add(other); queue.push(other);
        const cell = pickCell(adj.get(k));
        used.add(k);
        doorways.push({ ...cell, pair: k });
      }
    }
    // Extra openings so the public half of the house flows rather than funnelling.
    const publicSet = new Set(['living', 'hall', 'kitchen', 'dining']);
    for (const k of adj.keys()) {
      if (used.has(k)) continue;
      const [a, b] = k.split(':').map(Number);
      if (!publicSet.has(rooms[a].type) || !publicSet.has(rooms[b].type)) continue;
      used.add(k);
      doorways.push({ ...pickCell(adj.get(k)), pair: k });
    }
    // Any room the tree somehow failed to reach (it cannot, but a plan that silently
    // seals a room is the worst possible failure, so this is belt and braces).
    for (const r of rooms) {
      if (seen.has(r.id)) continue;
      for (const k of adj.keys()) {
        const [a, b] = k.split(':').map(Number);
        if (a !== r.id && b !== r.id) continue;
        doorways.push({ ...pickCell(adj.get(k)), pair: k });
        seen.add(r.id); break;
      }
    }

    /* Leaf or no leaf. Public openings are cased and open — that is what a real hall,
       living room and kitchen actually have — and private rooms get a real hung door
       that swings into the room it serves. */
    for (const dw of doorways) {
      if (dw.forced) continue;
      const ra = rooms[dw.a], rb = rooms[dw.b];
      const privateA = !publicSet.has(ra.type), privateB = !publicSet.has(rb.type);
      dw.leaf = (privateA || privateB) ? 'door' : 'none';
      // Swing into the private room; if both are private, into the larger one.
      let into = privateA && privateB ? (ra.area >= rb.area ? ra : rb) : (privateA ? ra : rb);
      if (dw.leaf === 'none') into = rb;
      if (dw.axis === 1) dw.swing = (into === rooms[dw.b] ? 1 : -1);   // b is east
      else dw.swing = (into === rooms[dw.b] ? 1 : -1);                 // b is south
      dw.intoRoom = into.id;
      dw.startClosed = dw.leaf === 'door' && h(hn++) < 0.45;
    }
    /* Belt and braces. The chooser avoids the door's column, but a plan is assembled from
       several cuts and only the whole of it can be checked. If the cell you step into is
       still a partition, it becomes a cased opening — you can always get into the house. */
    {
      const ix = dcell[0] - fdir[0], iz = dcell[1] - fdir[1];
      if (ix >= x0 && ix <= x1 && iz >= z0 && iz <= z1 && isWall(ix, iz) &&
          !doorways.some(d => d.dx === ix && d.dz === iz)) {
        const wc = wallAt.get(at(ix, iz));
        const axis = (wc && (wc.mask & 3)) ? 0 : 1;
        const a = axis === 1 ? inRoom[at(ix - 1, iz)] : inRoom[at(ix, iz - 1)];
        const b = axis === 1 ? inRoom[at(ix + 1, iz)] : inRoom[at(ix, iz + 1)];
        doorways.push({ dx: ix, dz: iz, axis, a, b, leaf: 'none', swing: 1,
                        intoRoom: b >= 0 ? b : a, startClosed: false, forced: true });
      }
    }

    const doorAt = new Map();
    for (const dw of doorways) doorAt.set(at(dw.dx, dw.dz), dw);

    /* --- 7. Circulation reservation ------------------------------------------------------
       Breadth-first from the entry across the walkable graph, then walk the parent chain
       back from each room's centre. Those cells, plus one cell either side of every
       doorway and the quadrant every door leaf swings through, are off limits to
       furniture. This is the guarantee that no house can be furnished shut. */
    const N = W * D;
    const prev = new Int32Array(N).fill(-2);
    const passable = (dx, dz) => {
      if (dx < x0 || dx > x1 || dz < z0 || dz > z1) return false;
      if (solidCells.has(dx + ':' + dz)) return false;
      if (!isWall(dx, dz)) return true;
      return doorAt.has(at(dx, dz));
    };
    const q = [at(entry.dx, entry.dz)];
    prev[q[0]] = -1;
    for (let qi = 0; qi < q.length; qi++) {
      const cur = q[qi], cdx = (cur / D) | 0, cdz = cur % D;
      for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cdx + ax, nz = cdz + az;
        if (!passable(nx, nz)) continue;
        const ni = at(nx, nz);
        if (prev[ni] !== -2) continue;
        prev[ni] = cur; q.push(ni);
      }
    }
    const reserved = new Uint8Array(N);
    const reserve = (dx, dz) => {
      if (dx >= 0 && dx < W && dz >= 0 && dz < D) reserved[at(dx, dz)] = 1;
    };
    for (const r of rooms) {
      const cx = (r.x0 + r.x1) >> 1, cz = (r.z0 + r.z1) >> 1;
      let cur = at(cx, cz);
      if (prev[cur] === -2) {
        // Unreachable centre: reserve nothing, but flag the room so the audit can see it.
        r.unreached = true;
        continue;
      }
      let guard = 0;
      while (cur >= 0 && guard++ < 256) { reserved[cur] = 1; cur = prev[cur]; }
    }
    for (const dw of doorways) {
      reserve(dw.dx, dw.dz);
      if (dw.axis === 1) { reserve(dw.dx - 1, dw.dz); reserve(dw.dx + 1, dw.dz); }
      else { reserve(dw.dx, dw.dz - 1); reserve(dw.dx, dw.dz + 1); }
      if (dw.leaf === 'door') {
        // The quarter the leaf sweeps through, so a door can never open into furniture.
        if (dw.axis === 1) reserve(dw.dx + dw.swing, dw.dz);
        else reserve(dw.dx, dw.dz + dw.swing);
      }
    }
    // The threshold and the swing of the front door itself.
    reserve(entry.dx, entry.dz);
    reserve(entry.dx - fdir[0], entry.dz - fdir[1]);
    if (alongX) { reserve(entry.dx - 1, entry.dz); reserve(entry.dx + 1, entry.dz); }
    else { reserve(entry.dx, entry.dz - 1); reserve(entry.dx, entry.dz + 1); }

    const plan = {
      x0, z0, x1, z1, W, D, rooms, wallCells, wallAt, doorways, doorAt,
      entry, entryRoomId: entryRoom.id, reserved, inRoom, at, storey, solidCells, lane,
      windows: this._subWindowLocals(lot, arch, doorSide, W, D, storey),
    };
    // A tiny bounded cache: a house is planned once and then read by each of the chunks
    // it touches. It is NOT a growing registry — the oldest entries are evicted.
    this._subPlanCache.set(key, plan);
    this._subPlanOrder.push(key);
    if (this._subPlanOrder.length > 96) {
      this._subPlanCache.delete(this._subPlanOrder.shift());
    }
    return plan;
  }

  /* THE GARAGE. Dressed as what it is: a bay with a car in it, a bench along the back, a
     rack of shelving and the boiler. The bay itself is left completely clear, because a
     garage you cannot walk into is worse than an empty one. */
  _subGarageInterior(S, m, baseY, h) {
    const x0 = m.x + 1, z0 = m.z + 1, x1 = m.x + m.w - 2, z1 = m.z + m.d - 2;
    if (x1 < x0 || z1 < z0) return;
    const iw = x1 - x0 + 1, id = z1 - z0 + 1;
    const taken = new Set();
    const mark = (name, face, px, pz) => {
      for (const c of furnCells(name, face)) taken.add((px + c[0]) + ':' + (pz + c[2]) + ':' + c[1]);
    };
    const free = (name, face, px, pz) => {
      for (const c of furnCells(name, face)) {
        const dx = px + c[0], dz = pz + c[2];
        if (dx < x0 || dx > x1 || dz < z0 || dz > z1 || c[1] > 2) return false;
        if (taken.has(dx + ':' + dz + ':' + c[1])) return false;
      }
      return true;
    };
    const put = (name, face, px, pz) => {
      if (!free(name, face, px, pz)) return false;
      mark(name, face, px, pz);
      furnStamp(S, name, px, baseY, pz, face);
      return true;
    };
    // Wall finish: unlined, so the garage does not read as a room.
    if (h(610) < 0.55 && iw >= 2 && id >= 4) put('carSedan', 0, x0, z0);
    else if (h(611) < 0.5 && id >= 2 && iw >= 4) put('carSedan', 3, x0, z0);
    put('workbench', 0, x0, z1);
    put('utilityShelf', 2, x1 - 1, z0);
    put('waterHeater', 0, x1, z1);
    if (h(612) < 0.6) put('boxes', 0, x1, z0);
    if (h(613) < 0.5) put('boxes', 2, x0, z1 - 1);
  }

  /* =====================================================================================
     PHASE 15 — REVISION ON REVISIT

     THE STAGE COUNTER IS THE WHOLE MECHANISM. A house the player has walked into and
     walked out of may, once, quietly gain a revision — and what is recorded is not the
     voxels that changed but a single integer: how many times this lot has been revised.
     Everything else is derived. That is what makes the mechanic survive streaming: a
     chunk that unloads and reloads re-derives the same revisions in the same order and
     writes the same blocks, because _subStageEffect is a pure function of the lot and the
     revision number.

     SIX EFFECTS, ONE PER REVISION, AT MOST THREE REVISIONS PER HOUSE:

       0  A CHAIR                 standing in a room that had none, facing the wall
       1  A DOORWAY MOVED         one cell along its own wall, between the same two rooms
       2  ANOTHER PICTURE         the house's own motif, hung in one more room
       3  SHUTTERS                closed where they were open, or open where they were shut
       4  THE MAILBOX             on the other side of the front path
       5  A WINDOW                now blank siding, inside and out
       6  THE PHOTOGRAPH          the same frame on the same wall, one figure short

     0, 1, 2 and 6 are applied here. 3, 4 and 5 belong to the shell and the yard and are
     applied where those are written — see _subOpenings and _subYard — because a revision
     has to be part of GENERATION, not a patch applied over it, or it would not survive a
     reload.

     SAFETY. Nothing here may narrow a route, seal a room, or bisect a piece of furniture.
     Every placement is tested against the furnisher's own occupancy grid, which knows
     exactly which cells hold something and which are reserved circulation; the doorway
     move additionally refuses to run unless the destination's two flanking cells are both
     reserved circulation, which is precisely the guarantee that nothing solid stands
     there. When an effect cannot be applied safely it is skipped, silently — a house that
     quietly declines to change is invisible, and a house that changes badly is a bug the
     player will read as one.
     ===================================================================================== */

  // How many revisions this lot has accumulated. Zero for every house never entered.
  _subStageOf(lot) {
    if (!this.suburbiaStage) return 0;
    return this.suburbiaStage.get(this._subLotKey(lot)) || 0;
  }

  /* Which effect revision `k` of this lot is. Keyed on the PHYSICAL lot, not on its
     signature: twins are the same house, but they are not the same address, and the
     player visits them separately. */
  _subStageEffect(lot, k) {
    const r = this._subHash(lot.bx * 37 + lot.col * 11 + k * 313,
                            lot.bz * 53 + lot.row * 7 + k * 977, 940);
    let e = Math.floor(r * SUB_STAGE_EFFECTS) % SUB_STAGE_EFFECTS;
    /* THE EXTERIOR EFFECTS ARE SWITCHES, NOT ADDITIONS. Closing shutters that are already
       closed, or moving a mailbox that has already moved, is a revision the player cannot
       possibly notice — so an exterior effect already spent on this house is stepped past.
       The interior three are additive (a second chair, a second photograph) and repeat
       quite happily. Still a pure function of the lot and the revision number: the earlier
       draws it consults are themselves pure, and the recursion is bounded by
       SUB_REVISIT_MAX_STAGE. */
    const isExterior = (v) => v >= SUB_STAGE_EXTERIOR_LO && v <= SUB_STAGE_EXTERIOR_HI;
    if (isExterior(e)) {
      const used = new Set();
      for (let j = 1; j < k; j++) {
        const p = this._subStageEffect(lot, j);
        if (isExterior(p)) used.add(p);
      }
      for (let guard = 0; used.has(e) && guard < SUB_STAGE_EFFECTS; guard++) {
        e = (e + 1) % SUB_STAGE_EFFECTS;
      }
    }
    return e;
  }

  // Has this lot been revised with effect `e` at any point? Used by the shell and the
  // yard, which are written long before the interior pass runs.
  _subStageHas(lot, e) {
    const n = this._subStageOf(lot);
    for (let k = 1; k <= n; k++) if (this._subStageEffect(lot, k) === e) return true;
    return false;
  }

  /* ---------------------------------------------------------------------------------
     THE DISCONNECTED HOME — an ordinary suburban house standing on its roof.

     Distant readability is the entire design goal: from half a street away the
     roofline is at ground level, the walls flare outward as they rise, and the front
     door is a rectangle of darkness in the sky. No glow, no marker, no particles —
     the player simply sees that one house on the street is catastrophically wrong.
     --------------------------------------------------------------------------------- */
  _subLotKey(lot) { return lot.bx + ':' + lot.bz + ':' + lot.row + ':' + lot.col; }

  /* Window positions feed the CRT-static spatialization. They are recorded per chunk
     rather than in one growing global array, so disposeChunk drops them automatically
     and an infinitely streaming suburb can never accumulate window entries forever. */
  _subRegisterWindows(chunk, wins) {
    if (!chunk || !wins || !wins.length) return;
    if (!chunk.subWindows) chunk.subWindows = [];
    for (const w of wins) chunk.subWindows.push(w);
  }

  // Nearest window to a point, scanned across loaded chunks only.
  nearestSuburbiaWindow(pos) {
    let best = null, bestD = Infinity;
    for (const chunk of this.chunks.values()) {
      if (!chunk.subWindows) continue;
      for (const w of chunk.subWindows) {
        const d = w.distanceToSquared(pos);
        if (d < bestD) { bestD = d; best = w; }
      }
    }
    return best;
  }

  _subIsDisconnectedLot(lot) {
    const t = this._subDisconnectedTarget();
    return lot.bx === t.bx && lot.bz === t.bz && lot.row === t.row && lot.col === t.col;
  }

  /* Deterministic placement on a ring of superblocks around the arrival point. The
     ring radius is the discoverability control: near enough that ordinary street
     exploration reaches it in a few minutes, far enough that the player walks several
     blocks of believable suburb first and is never handed it on arrival. */
  _subDisconnectedTarget() {
    if (this._subDiscTarget) return this._subDiscTarget;
    const sb = SUBURBIA_SPAWN_BLOCK;
    const r = this._subHash(sb, 7, 1);
    const ring = SUB_DISC_RING_MIN + Math.floor(r * (SUB_DISC_RING_MAX - SUB_DISC_RING_MIN + 1));
    const ang = this._subHash(sb, 13, 2) * Math.PI * 2;
    const bx = sb + Math.round(Math.cos(ang) * ring);
    const bz = sb + Math.round(Math.sin(ang) * ring);
    const row = this._subHash(bx, bz, 5) < 0.5 ? 0 : 1;
    const col = Math.floor(this._subHash(bx, bz, 6) * SUB_LOTS_PER_ROW) % SUB_LOTS_PER_ROW;
    this._subDiscTarget = { bx, bz, row, col };
    return this._subDiscTarget;
  }

  // DYNAMIC REARRANGEMENT (PHASE 5A PART 2) — re-skins one already-stamped lot
  // onto a new (different) door/window wall in place. Called only on lots
  // updateSuburbiaRearrangement has confirmed are outside the player's current
  // sightline. Updates this.suburbiaWindows' two entries for this lot directly
  // (by their stored windowIndex) so the CRT static spatialization picks up the
  // moved windows on the very next frame, without disturbing any other lot.
  /* PHASE 9 — re-skins a streamed lot onto a different door wall. The house is voxel
     data spread across up to four chunks, so the re-stamp goes through _subSet(null,
     ...) which writes to whichever chunk owns each voxel and marks it dirty. Recording
     the override means the change PERSISTS: if the player walks away and the chunk
     unloads, the house streams back in with its door still moved. */
  _rearrangeSuburbiaLot(lot) {
    const key = this._subLotKey(lot);
    const arch = this._subArchetype(lot);
    const cur = this.suburbiaDoorOverrides.has(key) ? this.suburbiaDoorOverrides.get(key) : lot.facing;
    let next = cur;
    while (next === cur) next = Math.floor(Math.random() * 4);
    this.suburbiaDoorOverrides.set(key, next);
    /* PHASE 14 — the front door is about to move to a different wall, so every door state
       remembered anywhere on this lot is dropped first. Without this, an opened door
       would leave a stale entry behind and re-appear as a hole in a blank wall the next
       time these chunks streamed in. */
    const rr = this._subLotRect(lot);
    this._clearDoorStatesIn(rr.x0 - 2, rr.z0 - 2, rr.x1 + 2, rr.z1 + 2);
    // Re-stamping writes the full solid wall before carving the new openings, so the
    // wall that previously held the door is refilled and no stale opening survives.
    this._stampSuburbHouse(null, lot, arch, next);
    // Refresh the window registry for every chunk this house touches.
    for (const c of this._chunksOverlappingLot(lot)) {
      if (c.subWindows) c.subWindows.length = 0;
    }
    for (const c of this._chunksOverlappingLot(lot)) {
      this._subRegisterWindows(c, this._subOpenings(c, lot, arch, next, SUBURBIA_BASE_Y, arch.w, arch.d, 0));
    }
  }

  /* PHASE 13 — the reach widened with the houses: a lot now writes a driveway all the
     way out to the kerb and a fence line behind the back yard, so the chunk set a
     re-stamp has to touch is the lot's full influence rect rather than the old
     house-plus-eight-blocks box. */
  _chunksOverlappingLot(lot) {
    const out = [];
    const r = this._subLotRect(lot);
    const c0x = Math.floor(r.x0 / CHUNK_SX), c1x = Math.floor(r.x1 / CHUNK_SX);
    const c0z = Math.floor(r.z0 / CHUNK_SZ), c1z = Math.floor(r.z1 / CHUNK_SZ);
    for (let cx = c0x; cx <= c1x; cx++)
      for (let cz = c0z; cz <= c1z; cz++) {
        const c = this.getChunk(cx, cz);
        if (c) out.push(c);
      }
    return out;
  }

  /* Candidate lots near the player, derived from the grid rather than from a global
     array — an infinite suburb has no finite lot list to iterate. */
  _suburbiaLotsAround(pos, radiusBlocks) {
    const b0x = Math.floor((pos.x - radiusBlocks) / SUB_P), b1x = Math.floor((pos.x + radiusBlocks) / SUB_P);
    const b0z = Math.floor((pos.z - radiusBlocks) / SUB_P), b1z = Math.floor((pos.z + radiusBlocks) / SUB_P);
    const out = [];
    for (let bx = b0x; bx <= b1x; bx++)
      for (let bz = b0z; bz <= b1z; bz++)
        for (let row = 0; row < 2; row++)
          for (let col = 0; col < SUB_LOTS_PER_ROW; col++) {
            const lot = this._subLot(bx, bz, row, col);
            if (this._subIsDisconnectedLot(lot)) continue;  // never rotate the progression structure
            if (this._subLotBlocked(lot)) continue;         // paved over by a cul-de-sac
            const cxp = lot.hx + lot.arch.w / 2, czp = lot.hz + lot.arch.d / 2;
            if (Math.hypot(cxp - pos.x, czp - pos.z) > radiusBlocks) continue;
            out.push(lot);
          }
    return out;
  }

  updateSuburbiaRearrangement(dt, player, camera) {
    if (!player.inSuburbia) return;
    // UNCHANGED MECHANIC: still gated on the same >3s stationary threshold the sanity
    // system uses. Phase 9 only gives it an unbounded world to operate in.
    if (!(player.stationaryTimer > 3)) {
      this._suburbiaRearrangeTimer = 0;
      return;
    }
    this._suburbiaRearrangeTimer += dt;
    if (this._suburbiaRearrangeTimer < 2.5) return;
    this._suburbiaRearrangeTimer = 0;

    const camPos = camera.position;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const behind = forward.clone().negate();

    const candidates = this._suburbiaLotsAround(camPos, 44);
    if (!candidates.length) return;

    const meshes = [];
    for (const chunk of this.chunks.values()) if (chunk.mesh) meshes.push(chunk.mesh);
    if (!meshes.length) return;

    const raycaster = new THREE.Raycaster();
    raycaster.far = 40;
    const hitLots = new Set();
    for (let i = 0; i < 7; i++) {
      const dir = behind.clone();
      dir.x += (Math.random() - 0.5) * 1.6;
      dir.z += (Math.random() - 0.5) * 1.6;
      dir.normalize();
      raycaster.set(camPos, dir);
      const hits = raycaster.intersectObjects(meshes, false);
      if (!hits.length) continue;
      const p = hits[0].point;
      for (const lot of candidates) {
        const lcx = lot.hx + SUB_HOUSE_W / 2, lcz = lot.hz + SUB_HOUSE_D / 2;
        if (Math.abs(p.x - lcx) < SUB_LOT_W && Math.abs(p.z - lcz) < SUB_LOT_W) hitLots.add(lot);
      }
    }
    if (!hitLots.size) return;

    // Confirmed genuinely-behind check: the vector from the camera to the lot
    // must point opposite the camera's forward vector, not just have been near
    // where a ray happened to land.
    const eligible = [];
    for (const lot of hitLots) {
      const toLot = new THREE.Vector3(lot.hx + SUB_HOUSE_W / 2 - camPos.x, 0, lot.hz + SUB_HOUSE_D / 2 - camPos.z).normalize();
      if (toLot.dot(forward) < -0.15) eligible.push(lot);
    }
    if (!eligible.length) return;
    this._rearrangeSuburbiaLot(eligible[Math.floor(Math.random() * eligible.length)]);
  }

  /* =====================================================================================
     PHASE 15 — THE RECOGNITION DRIVER

     Everything the phase does at runtime happens here, twice a second, in a few hundred
     integer operations. It answers one question — which house is the player standing
     inside? — and does three things with the answer:

       ENTERING     record the visit. Nothing changes. Nothing is ever revised while the
                    player is in the building, which is the difference between this and a
                    haunted house.
       LEAVING      if this house is one of the deterministic minority that is allowed to
                    change, and has not already changed three times, queue it.
       AWAY         once the player is more than SUB_RECOG_DISTANCE from a queued house
                    AND it is behind them, commit one revision and re-stamp. Then say
                    nothing about it for SUB_RECOG_COOLDOWN seconds.

     THE COOLDOWN IS THE RESTRAINT. At most one house in the entire suburb revises itself
     every twenty-six seconds, and only houses the player has actually been inside are
     candidates at all. A player who walks a street without going indoors will never see
     this mechanic fire once, which is correct: it is a mechanic about memory, and there
     is nothing to misremember until you have been in the room.

     NO SANITY, NO SOUND, NO PROMPT. The Sanity curve is untouched by this entire phase.
     ===================================================================================== */
  updateSuburbiaRecognition(dt, player, camera) {
    if (!player || !player.inSuburbia) {
      // Leaving the dimension drops the queue; the ledgers themselves persist.
      if (this._subInsideKey) { this._subInsideKey = null; this._subInsideLot = null; }
      return;
    }
    this._subRecogCooldown = Math.max(0, this._subRecogCooldown - dt);
    this._subRecogTick += dt;
    if (this._subRecogTick < 0.5) return;
    this._subRecogTick = 0;

    const inside = this._subHouseAt(player.position);
    const key = inside ? this._subLotKey(inside) : null;
    if (key !== this._subInsideKey) {
      if (this._subInsideLot) this._subQueueRevision(this._subInsideLot);
      if (inside) this._subNoteVisit(inside);
      this._subInsideKey = key;
      this._subInsideLot = inside;
    }
    if (this._subPending.size) this._subCommitRevision(camera);
  }

  /* Which house, if any, is the player standing INSIDE? Derived from the lot grid rather
     than from a registry, and tested against the interior rectangle of the main mass
     only — a porch, a driveway or a garage bay is not being inside the house. */
  _subHouseAt(pos) {
    const baseY = SUBURBIA_BASE_Y;
    if (pos.y < baseY - 2 || pos.y > baseY + 12) return null;
    if (!isStaticSuburbiaWorldPos(Math.floor(pos.x), Math.floor(pos.z))) return null;
    const b0x = Math.floor((pos.x - 16) / SUB_P), b1x = Math.floor((pos.x + 16) / SUB_P);
    const b0z = Math.floor((pos.z - 16) / SUB_P), b1z = Math.floor((pos.z + 16) / SUB_P);
    for (let bx = b0x; bx <= b1x; bx++)
      for (let bz = b0z; bz <= b1z; bz++)
        for (let row = 0; row < 2; row++)
          for (let col = 0; col < SUB_LOTS_PER_ROW; col++) {
            const lot = this._subLot(bx, bz, row, col);
            if (this._subIsDisconnectedLot(lot)) continue;   // never part of this mechanic
            if (this._subLotBlocked(lot)) continue;
            const a = lot.arch;
            if (pos.x >= lot.hx + 1 && pos.x <= lot.hx + a.w - 1 &&
                pos.z >= lot.hz + 1 && pos.z <= lot.hz + a.d - 1) return lot;
          }
    return null;
  }

  _subNoteVisit(lot) {
    const key = this._subLotKey(lot);
    if (!this.suburbiaVisits.has(key)) {
      this._subVisitOrder.push(key);
      while (this._subVisitOrder.length > SUB_VISIT_CAP) {
        this.suburbiaVisits.delete(this._subVisitOrder.shift());
      }
    }
    this.suburbiaVisits.set(key, (this.suburbiaVisits.get(key) || 0) + 1);
  }

  /* Is this house allowed to change at all? A pure function of the lot, so the answer is
     the same for the whole session and for every reload — the player is not being tracked
     by a system that decides on the fly, they are walking around a suburb in which some
     houses are unstable and most are not. */
  _subRevisable(lot) {
    if (this._subIsDisconnectedLot(lot)) return false;
    if (this._subStageOf(lot) >= SUB_REVISIT_MAX_STAGE) return false;
    return this._subHash(lot.bx * 7 + lot.col, lot.bz * 5 + lot.row, 950) < SUB_REVISIT_ELIGIBLE;
  }

  _subQueueRevision(lot) {
    if (!lot) return;
    const key = this._subLotKey(lot);
    if (!this.suburbiaVisits.has(key)) return;
    if (!this._subRevisable(lot)) return;
    this._subPending.set(key, lot);
    // A queue, not a registry: the oldest waiting house is dropped rather than kept.
    while (this._subPending.size > 8) {
      this._subPending.delete(this._subPending.keys().next().value);
    }
  }

  _subCommitRevision(camera) {
    if (this._subRecogCooldown > 0) return;
    const camPos = camera.position;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    for (const [key, lot] of this._subPending) {
      const cx = lot.hx + lot.arch.w / 2, cz = lot.hz + lot.arch.d / 2;
      const dx = cx - camPos.x, dz = cz - camPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < SUB_RECOG_DISTANCE) continue;
      /* Within sight of the street it is on, the house additionally has to be behind the
         player. Far enough away that it cannot be resolved at all, the facing test is
         dropped — otherwise a house four blocks back would never get its turn. */
      if (dist < 64) {
        const dot = (dx / dist) * forward.x + (dz / dist) * forward.z;
        if (dot > -0.1) continue;
      }
      this._subPending.delete(key);
      this._subBumpStage(lot);
      this._subRecogCooldown = SUB_RECOG_COOLDOWN;
      return;
    }
  }

  _subBumpStage(lot) {
    const key = this._subLotKey(lot);
    if (!this.suburbiaStage.has(key)) {
      this._subStageOrder.push(key);
      while (this._subStageOrder.length > SUB_STAGE_CAP) {
        this.suburbiaStage.delete(this._subStageOrder.shift());
      }
    }
    this.suburbiaStage.set(key, Math.min(SUB_REVISIT_MAX_STAGE, this._subStageOf(lot) + 1));
    this._subRecogCommits++;
    this._restampSuburbiaLot(lot);
  }

  /* Re-writes a lot in place at its current revision, WITHOUT moving its front door — the
     one difference from _rearrangeSuburbiaLot, whose machinery this otherwise reuses
     wholesale. Chunks of the house that are not resident are simply not written; they
     will generate at the current stage when they stream in, which is the same guarantee
     the door-override mechanic has always relied on. */
  _restampSuburbiaLot(lot) {
    const arch = this._subArchetype(lot);
    const key = this._subLotKey(lot);
    const side = this.suburbiaDoorOverrides.has(key)
      ? this.suburbiaDoorOverrides.get(key) : lot.facing;
    // A revision may move an interior doorway, so no remembered door state on this lot
    // can be trusted to still describe a door.
    const rr = this._subLotRect(lot);
    this._clearDoorStatesIn(rr.x0 - 2, rr.z0 - 2, rr.x1 + 2, rr.z1 + 2);
    this._stampSuburbHouse(null, lot, arch, side);
    // A vanished window has to leave the CRT-static registry with it.
    for (const c of this._chunksOverlappingLot(lot)) {
      if (c.subWindows) c.subWindows.length = 0;
    }
    for (const c of this._chunksOverlappingLot(lot)) {
      this._subRegisterWindows(c, this._subOpenings(c, lot, arch, side, SUBURBIA_BASE_Y,
                                                    arch.w, arch.d, 0));
    }
  }
});
