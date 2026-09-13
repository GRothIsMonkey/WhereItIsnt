"use strict";
/* =====================================================================================
   GENERIC BUILDING STAMPERS — SHARED BY MORE THAN ONE PLACE
   ERA 1.5.3 — MOVED VERBATIM OUT OF VoxelWorld.

   A building shell, a roof, and the environmental-story stamp. Shared because both the
   suburb and the Farmlands have buildings — five Farmlands stampers and the suburban
   house all call the first two — and NOT because two functions happened to look alike.

   If a future dimension needs a shell that is genuinely different, it writes its own.
   Merging two things that merely resemble each other is how a shared layer becomes a
   place where nothing can be changed safely.

   IT LIVES UNDER dimensions/, NOT world/, AND THE REASON MATTERS. A shell and a roof are
   CONTENT — a decision about what a building looks like — not world machinery, and Era 2
   replaces them along with everything else that knows a block id. src/world/ is the
   engine and nothing else.

   THE ONE CROSS-DIMENSION DEPENDENCY IN THE BUILD IS HERE, and it is named rather than
   hidden: `_subStampRoof` asks Suburbia's `_subHash` for its deterministic variation,
   because these two stampers began life as Suburbia's house builder and the Farmlands
   reused them. `_subHash` is seeded from SUB_SEED, so it cannot simply be relabelled
   generic, and giving the roof its own hash would change every roof in the game. Era
   1.5.3 moved it; it did not redesign it. tests/architecture.js asserts this is the only
   such edge, so a second one is a failure rather than a precedent.

   Every method below is byte-identical to the text that was in game.html, comments and
   all. It is attached to VoxelWorld's prototype by registerWorldContent, which copies
   property descriptors so a moved method is indistinguishable from a declared one.
   See src/world/world-content.js and ARCHITECTURE.md.
   ===================================================================================== */

registerWorldContent('shared', 'stampers', class {

  /* =====================================================================================
     PHASE 31 — THE ONE PLACE ENVIRONMENTAL STORYTELLING TOUCHES THE WORLD.

     Called once from each of the three chunk generators, after everything that phase
     builds, so a story object always wins over ordinary cover and never over progression
     (the Farmlands call sits before _farmStampHome for exactly that reason).

     IT WORKS WITHOUT A RUNTIME. VoxelWorld's own constructor eagerly loads chunks around
     spawn, which happens before Game has finished constructing and therefore before
     `envStory` exists. That is not an edge case to guard against, it is the normal first
     few chunks of a new game — so with no runtime the ungated events stamp and every
     gated one is skipped, which is exactly the state a new game should be in.
     ===================================================================================== */
  _envStoryStamp(chunk, dimension) {
    const runtime = this.envStory || null;
    const table = runtime ? runtime.events : ENVIRONMENT_STORY_EVENTS;
    /* The Haven's one event is stamped by _dressHavenInterior, not by a chunk generator,
       so the whole pass is skipped there for the cost of one string comparison. */
    if (dimension === 'haven') return;
    for (let i = 0; i < table.length; i++) {
      const evt = table[i];
      if (evt.dimension !== dimension) continue;
      const stamp = ENV_STAMPERS[evt.id];
      if (!stamp) continue;                       // an event another system already builds
      if (runtime) { if (!runtime.eligible(evt)) continue; }
      else if (evt.after || (evt.requires && evt.requires.length)) continue;
      const site = evt.site ? ENV_SITES[evt.site] : null;
      const at = site ? site(this) : null;
      if (evt.site && !at) continue;              // a place this build does not have
      stamp(this, chunk, at);
    }
  }

  /* SHELL — walls, floor, ceiling, and the visible foundation course the house sits on.
     Interiors are hollow from the start: this IS the enterable volume, not a decorative
     skin, exactly as Phase 9 established. */
  _subStampShell(chunk, m, side, baseY) {
    if (!this._subHits(chunk, m.x, m.z, m.x + m.w - 1, m.z + m.d - 1)) return;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const H = m.plateY - m.floorY;
    for (let dx = 0; dx < m.w; dx++) {
      for (let dz = 0; dz < m.d; dz++) {
        const edge = dx === 0 || dx === m.w - 1 || dz === 0 || dz === m.d - 1;
        const wx = m.x + dx, wz = m.z + dz;
        S(wx, m.floorY - 1, wz, edge ? BLOCK.BELT_COURSE : BLOCK.WOOD_FLOOR);
        if (edge) {
          /* PHASE 14 — line the inward faces. A cell only gets a skin on a face that has
             actual interior behind it, so a one-cell-thick wing or a corner post is left
             as plain siding exactly as before. */
          let mask = 0;
          if (m.w > 2 && m.d > 2) {
            if (dx === m.w - 1 && dz > 0 && dz < m.d - 1) mask |= 1;
            if (dx === 0 && dz > 0 && dz < m.d - 1) mask |= 2;
            if (dz === m.d - 1 && dx > 0 && dx < m.w - 1) mask |= 4;
            if (dz === 0 && dx > 0 && dx < m.w - 1) mask |= 8;
            if (dx === 0 && dz === 0) mask = 2 | 8;
            else if (dx === 0 && dz === m.d - 1) mask = 2 | 4;
            else if (dx === m.w - 1 && dz === 0) mask = 1 | 8;
            else if (dx === m.w - 1 && dz === m.d - 1) mask = 1 | 4;
          }
          const lined = mask ? SIDE_LINED.get(side + ':' + mask) : 0;
          const wallId = lined || side;
          for (let dy = 0; dy < H; dy++) S(wx, m.floorY + dy, wz, wallId);
        } else {
          for (let dy = 0; dy < H; dy++) S(wx, m.floorY + dy, wz, BLOCK.AIR);
        }
      }
    }
    // Mid-floor for two-storey masses.
    if (H >= 8) {
      for (let dx = 1; dx < m.w - 1; dx++)
        for (let dz = 1; dz < m.d - 1; dz++)
          S(m.x + dx, m.floorY + 3, m.z + dz, BLOCK.WOOD_FLOOR);
    }
  }

  /* THE ROOF. One height field, one code path, every style.

       h(x,z) = PITCH * (distance to the nearest roof edge)

     For a GABLE only the across-ridge distance counts, so the two long edges rise to a
     ridge and the ends stay vertical gable walls. For a HIP all four count, so the
     surface falls away on every side and the diagonals where two slopes meet come out
     as hip corners for free. subRoofPiece() turns the four corner heights of each cell
     into the piece that draws it — a slope half, a hip-corner half or nothing.

     Footprints are even and the eave is one block, so every span is even and both ridge
     kinds land exactly on a cell boundary: no stepping, no ridge special case, and no
     seam where two chunks stamp the same roof from different sides.

     After the surface, the gable walls are filled up to the underside of the roof, then
     the eave is dressed: soffit under the overhang, fascia on every edge, gutters along
     the low edges only (which is where a real gutter goes) and one downspout. */
  _subStampRoof(chunk, m, masses, roofMat, baseY, side, chimney) {
    if (!this._subHits(chunk, m.x - SUB_EAVE, m.z - SUB_EAVE,
                       m.x + m.w + SUB_EAVE, m.z + m.d + SUB_EAVE)) return;
    const S = (wx, wy, wz, id) => this._subSet(chunk, wx, wy, wz, id);
    const O = SUB_EAVE;
    const X0 = m.x - O, X1 = m.x + m.w + O, Z0 = m.z - O, Z1 = m.z + m.d + O;
    const hip = m.roof === 'hip';
    const acrossZ = m.ridge === 'x';
    const hAt = (x, z) => {
      const dx = Math.min(x - X0, X1 - x), dz = Math.min(z - Z0, Z1 - z);
      if (hip) return SUB_ROOF_PITCH * Math.min(dx, dz);
      return SUB_ROOF_PITCH * (acrossZ ? dz : dx);
    };
    // Would a taller mass already own this column? If so the roof stops short of it,
    // which is what makes a wing butt into a wall instead of growing through it.
    const blockedBy = (wx, wz) => {
      for (const o of masses) {
        if (o === m) continue;
        if (o.plateY <= m.plateY) continue;
        if (wx >= o.x - 1 && wx < o.x + o.w + 1 && wz >= o.z - 1 && wz < o.z + o.d + 1) return true;
      }
      return false;
    };

    const roofCellY = [];   // cellY per column, for the gable-wall fill and the eave pass
    for (let wx = X0; wx < X1; wx++) {
      for (let wz = Z0; wz < Z1; wz++) {
        if (blockedBy(wx, wz)) continue;
        const p = subRoofPiece(roofMat, hAt(wx, wz), hAt(wx + 1, wz), hAt(wx, wz + 1), hAt(wx + 1, wz + 1));
        if (p.id < 0) continue;
        const y = m.plateY + p.y;
        S(wx, y, wz, p.id);
        roofCellY.push([wx, wz, y]);
      }
    }

    /* GABLE WALL FILL. Under a gable, the end walls rise into a triangle. Filling each
       perimeter column up to the underside of its roof cell closes that triangle with no
       gaps and no stepping, and does the right thing for a hip too (where there is
       nothing to fill). The top course gets a louvred gable vent, which is the detail
       that stops a gable end reading as a solid painted panel. */
    for (const [wx, wz, ry] of roofCellY) {
      if (wx < m.x || wx >= m.x + m.w || wz < m.z || wz >= m.z + m.d) continue;
      const onEdge = wx === m.x || wx === m.x + m.w - 1 || wz === m.z || wz === m.z + m.d - 1;
      if (!onEdge) continue;
      // Gable ends often get a shingle or shake accent above the plate on a real house,
      // which is also what keeps a big blank triangle from reading as one flat painted panel.
      const gableMat = m.garage ? BLOCK.SHAKE
        : (this._subHash(m.x, m.z, 211) < 0.35 ? BLOCK.SHAKE : side);
      for (let y = m.plateY; y < ry; y++) S(wx, y, wz, gableMat);
      if (ry - m.plateY >= 2) {
        const midX = wx === m.x + Math.floor(m.w / 2), midZ = wz === m.z + Math.floor(m.d / 2);
        if (acrossZ ? midZ : midX) {
          S(wx, ry - 1, wz, acrossZ ? BLOCK.GABLE_VENT_Z : BLOCK.GABLE_VENT_X);
        }
      }
    }

    /* THE EAVE. Soffit under the overhang, fascia on every roof edge, gutters on the low
       edges only. All of it is non-colliding and light-passing, so it dresses the roof
       without catching the player or dropping a shadow stripe on the lawn. */
    for (let wx = X0; wx < X1; wx++) {
      for (let wz = Z0; wz < Z1; wz++) {
        const inWall = wx >= m.x && wx < m.x + m.w && wz >= m.z && wz < m.z + m.d;
        if (inWall) continue;
        if (blockedBy(wx, wz)) continue;
        const p = subRoofPiece(roofMat, hAt(wx, wz), hAt(wx + 1, wz), hAt(wx, wz + 1), hAt(wx + 1, wz + 1));
        if (p.id < 0) continue;
        const y = m.plateY + p.y;
        // Which outer edge is this? Low edges get a gutter, the sloping rake gets a board.
        const gutterEdge = acrossZ || hip
          ? (wz === Z0 ? BLOCK.GUTTER_N : wz === Z1 - 1 ? BLOCK.GUTTER_S : null)
          : (wx === X0 ? BLOCK.GUTTER_W : wx === X1 - 1 ? BLOCK.GUTTER_E : null);
        const rakeEdge = acrossZ || hip
          ? (wx === X0 ? BLOCK.FASCIA_W : wx === X1 - 1 ? BLOCK.FASCIA_E : null)
          : (wz === Z0 ? BLOCK.FASCIA_N : wz === Z1 - 1 ? BLOCK.FASCIA_S : null);
        /* Where a gutter run meets a rake board the real detail is a boxed eave return,
           which is what the soffit panel draws here. Everywhere else the edge gets
           whichever board belongs on it. */
        const piece = (gutterEdge && rakeEdge) ? BLOCK.SOFFIT_PANEL
                    : (gutterEdge || rakeEdge || BLOCK.SOFFIT_PANEL);
        if (this._subGet(chunk, wx, y - 1, wz) === BLOCK.SOFFIT_PANEL ||
            this._subGet(chunk, wx, y - 1, wz) === BLOCK.AIR) S(wx, y - 1, wz, piece);
      }
    }
    // One downspout, at the corner nearest the street.
    const dsX = X0, dsZ = Z0;
    for (let y = baseY; y < m.plateY; y++) {
      if (this._subGet(chunk, dsX, y, dsZ) === BLOCK.AIR) S(dsX, y, dsZ, BLOCK.DOWNSPOUT);
    }
    // A chimney on about a third of houses, and a vent on the back slope of the rest.
    if (m.main) {
      const cx = m.x + 1, cz = m.z + m.d - 2;
      /* PHASE 15 — was hashed from the mass's world position, which meant a twin could
         grow a chimney its double did not have AND could disagree with the floor plan's
         reserved breast. Both now read the one signature-keyed answer. */
      if (chimney) {
        for (let y = baseY; y < m.plateY + 3; y++) S(cx, y, cz, BLOCK.BRICK);
        S(cx, m.plateY + 3, cz, BLOCK.CHIMNEY_CAP);
      }
    }
  }
});
