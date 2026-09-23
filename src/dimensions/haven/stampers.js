"use strict";
/* =====================================================================================
   THE HAVEN — WHAT THE CABIN IS MADE OF
   ERA 1.5.3 — MOVED VERBATIM OUT OF VoxelWorld.

   The pocket's ground and cabin, its interior dressing, the corruption pass and the
   clear-down for the finale. The four methods that write the Haven's voxels.

   `_resetHavenPocket` undoing everything `generateFakeHaven` did is a rule, not an
   accident — CLAUDE.md section 58. Anything a future phase adds to one goes in the other.

   Every method below is byte-identical to the text that was in game.html, comments and
   all. It is attached to VoxelWorld's prototype by registerWorldContent, which copies
   property descriptors so a moved method is indistinguishable from a declared one.
   See src/world/world-content.js and ARCHITECTURE.md.
   ===================================================================================== */

registerWorldContent('haven', 'stampers', class {

  /* ---------------------------------------------------------------------------------
     LEVEL 4 — THE FAKE HAVEN (PHASE 5A PART 3).
     A completely self-contained 48x48 pocket built lazily, only when the illusion
     sequence fires. Unlike every other region generator this one is NOT called at
     world construction: the Haven must not exist until the player is taken to it.

     Contents: a bright grass clearing under an open blue sky, one 12x12 oak-log
     cabin with polished oak floorboards, glass windows, a lit stone fireplace, a
     bed and a storage chest — and, ringing the whole clearing, an invisible
     HAVEN_BARRIER wall dressed in warm fog sprites, so walking toward the edge just
     softly stops you in glowing haze with no visible wall to break the spell.
     --------------------------------------------------------------------------------- */
  generateFakeHaven() {
    if (this.fakeHavenBuilt) return this.fakeHavenSpawn;
    this.fakeHavenBuilt = true;
    this.fakeHavenActive = true;

    const chunks = [];
    for (let dcx = 0; dcx < FAKE_HAVEN_CHUNKS_SPAN; dcx++) {
      for (let dcz = 0; dcz < FAKE_HAVEN_CHUNKS_SPAN; dcz++) {
        const cx = FAKE_HAVEN_CHUNK_OFFSET + dcx, cz = FAKE_HAVEN_CHUNK_OFFSET + dcz;
        const chunk = new Chunk(cx, cz, this);
        this.chunks.set(this.key(cx, cz), chunk);
        this.pinnedChunkKeys.add(this.key(cx, cz));
        chunks.push(chunk);
      }
    }

    const minX = FAKE_HAVEN_CHUNK_OFFSET * CHUNK_SX, minZ = FAKE_HAVEN_CHUNK_OFFSET * CHUNK_SZ;
    const span = FAKE_HAVEN_CHUNKS_SPAN * CHUNK_SX;
    const baseY = FAKE_HAVEN_BASE_Y;
    const cX = minX + Math.floor(span / 2), cZ = minZ + Math.floor(span / 2);

    // 1. GROUND — a flat, sunlit lawn. Dirt body, grass cap, nothing above it.
    for (const chunk of chunks) {
      for (let x = 0; x < CHUNK_SX; x++) {
        for (let z = 0; z < CHUNK_SZ; z++) {
          for (let y = 0; y < CHUNK_SY; y++) {
            let id = BLOCK.AIR;
            if (y < baseY - 1) id = BLOCK.DIRT;
            else if (y === baseY - 1) id = BLOCK.GRASS;
            chunk.data[chunk.idx(x, y, z)] = id;
          }
        }
      }
    }

    // 2. THE FOG WALL — a square ring of HAVEN_BARRIER. The blocks are solid to
    //    collision but have no render pass at all, so the boundary is felt and never
    //    seen; the warm fog sprites added at the end are the only thing there to look
    //    at. Tall enough (20) that there's no jumping or building over it.
    const R = FAKE_HAVEN_FOG_RADIUS;
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== R) continue;
        for (let dy = 0; dy < 20; dy++) this._writeBlockRaw(cX + dx, baseY + dy, cZ + dz, BLOCK.HAVEN_BARRIER);
      }
    }

    // 3. THE CABIN — 12x12 oak-log shell, 6 tall, flat log roof.
    const S = FAKE_HAVEN_CABIN_SIZE, H = 6;
    const half = Math.floor(S / 2);
    const x0 = cX - half, z0 = cZ - half, x1 = x0 + S - 1, z1 = z0 + S - 1;
    for (let wx = x0; wx <= x1; wx++) {
      for (let wz = z0; wz <= z1; wz++) {
        const onEdge = wx === x0 || wx === x1 || wz === z0 || wz === z1;
        if (onEdge) {
          for (let dy = 0; dy < H; dy++) this._writeBlockRaw(wx, baseY + dy, wz, BLOCK.OAK_LOG);
        } else {
          // POLISHED OAK FLOORBOARDS: the walkable surface itself, replacing the
          // lawn's grass cap inside the footprint.
          this._writeBlockRaw(wx, baseY - 1, wz, BLOCK.POLISHED_OAK);
          for (let dy = 0; dy < H - 1; dy++) this._writeBlockRaw(wx, baseY + dy, wz, BLOCK.AIR);
        }
        this._writeBlockRaw(wx, baseY + H - 1, wz, BLOCK.OAK_LOG); // roof
      }
    }

    // 4. DOOR — a 2-tall opening centered on the south wall, with a small polished
    //    oak porch step so the threshold reads as intentional.
    this._writeBlockRaw(cX, baseY, z1, BLOCK.AIR);
    this._writeBlockRaw(cX, baseY + 1, z1, BLOCK.AIR);
    this._writeBlockRaw(cX, baseY - 1, z1 + 1, BLOCK.POLISHED_OAK);

    // 5. GLASS WINDOWS — two rows of panes on each of the four walls (skipping the
    //    doorway column and the fireplace stack), letting the bright blue outdoor
    //    light pour in. See _buildGlassMesh for the transparent render pass.
    const winRows = [baseY + 2, baseY + 3];
    for (const wy of winRows) {
      for (const off of [-4, -2, 2, 4]) {
        // north (-z) and south (+z) walls
        if (!(off === 0)) {
          this._writeBlockRaw(cX + off, wy, z1, BLOCK.HAVEN_GLASS);
          this._writeBlockRaw(cX + off, wy, z0, BLOCK.HAVEN_GLASS);
        }
        // west (-x) and east (+x) walls
        this._writeBlockRaw(x0, wy, cZ + off, BLOCK.HAVEN_GLASS);
        this._writeBlockRaw(x1, wy, cZ + off, BLOCK.HAVEN_GLASS);
      }
    }

    // 6. FIREPLACE — a stone hearth built into the north wall: a 3-wide stone
    //    surround with a hollow firebox, a chimney stack punched up through the roof,
    //    and a warm point light. The flames themselves are the particle system built
    //    in _buildHavenFireParticles below.
    const fz = z0 + 1;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = 0; dy < 4; dy++) this._writeBlockRaw(cX + dx, baseY + dy, fz, BLOCK.STONE);
    }
    // Hollow out the firebox itself (the opening the fire sits in).
    this._writeBlockRaw(cX, baseY, fz, BLOCK.AIR);
    this._writeBlockRaw(cX, baseY + 1, fz, BLOCK.AIR);
    // Chimney: stone column continuing up through and above the roof cap.
    for (let dy = H - 1; dy < H + 3; dy++) this._writeBlockRaw(cX, baseY + dy, fz, BLOCK.STONE);
    this._writeBlockRaw(cX, baseY + 2, fz, BLOCK.AIR); // flue
    this._writeBlockRaw(cX, baseY + 3, fz, BLOCK.AIR);

    this.havenFirePos = new THREE.Vector3(cX + 0.5, baseY + 0.35, fz + 0.5);
    const fireLight = new THREE.PointLight(0xffa447, legacyLinear(2.2), 16, legacyLightDecay(2));
    fireLight.position.set(cX + 0.5, baseY + 1.0, fz + 1.1);
    this.scene.add(fireLight);
    this.havenFireLight = fireLight;
    this._buildHavenFireParticles();

    // 7. FURNITURE — the bed and the storage chest are prop meshes rather than
    //    voxels, so they can have real shape instead of being cubes. Both are
    //    interacted with by raycasting straight at the mesh (see
    //    PlayerController._placeBlockOrInteract), which is why each is kept on its
    //    own group handle here.
    if (!this.decorGroup) { this.decorGroup = new THREE.Group(); this.scene.add(this.decorGroup); }

    this.havenBedGroup = buildHavenBedProp();
    this.havenBedGroup.position.set(x0 + 2.5, baseY, z0 + 3.0);
    this.scene.add(this.havenBedGroup);

    this.havenChestGroup = buildHavenStorageChestProp();
    this.havenChestGroup.position.set(x1 - 1.6, baseY, z1 - 1.8);
    this.havenChestGroup.rotation.y = -0.4;
    this.scene.add(this.havenChestGroup);

    // A soft warm interior fill light so the cabin never reads as a dark box even
    // with the horror lighting model fully switched off.
    const cozyLight = new THREE.PointLight(0xffe6bf, legacyLinear(1.1), 22, legacyLightDecay(2));
    cozyLight.position.set(cX + 0.5, baseY + 3.2, cZ + 0.5);
    this.scene.add(cozyLight);
    this.havenCozyLight = cozyLight;

    /* PHASE 10 — DRESS THE ROOM. Everything below is written as VOXELS inside the
       cabin footprint, which is what makes it collapse-safe for free: corruptHaven()
       already sweeps every non-air block in x0-2..x1+2 / baseY-1..baseY+9 and rots it,
       so a rug, a bookshelf and a hearth decay exactly like the walls do without
       corruptHaven() needing to know they exist. The only non-voxel additions are the
       warm lights, and those go through _havenAddLight() so the collapse can drop them
       generically instead of by name. */
    this._dressHavenInterior(cX, cZ, baseY, x0, z0, x1, z1, H, fz);

    // 8. WARM FOG WALL DRESSING — a ring of soft, warm-tinted billboard puffs
    //    standing just inside the invisible barrier. The scene fog itself is bright
    //    sky blue with high visibility (see EnvironmentSystem's Haven override), so
    //    this ring is what supplies the "warm fog wall" read without dimming the
    //    clearing or tinting the sky.
    this._buildHavenFogWall(cX, cZ, baseY, R);

    this.fakeHavenSpawn = new THREE.Vector3(cX + 0.5, baseY, cZ + 2.5);

    for (const chunk of chunks) { chunk.dirty = true; this.generateChunkMesh(chunk); }
    return this.fakeHavenSpawn;
  }

  /* The lived-in interior. Composition follows the reference: a heavy brick hearth
     centred on the far wall, seating turned in toward it, a rug tying the two
     together, and the incidental clutter of somewhere actually lived in. Deliberately
     built from a handful of tiny repeated shapes rather than dozens of unique props. */
  _dressHavenInterior(cX, cZ, baseY, x0, z0, x1, z1, H, fz) {
    const W = (wx, wy, wz, id) => this._writeBlockRaw(wx, wy, wz, id);

    // --- WOOD VARIATION -------------------------------------------------------------
    // Break up the flat oak-log shell: a polished-oak wainscot band at knee height and
    // polished corner posts, so the walls read as built rather than extruded.
    for (let wx = x0; wx <= x1; wx++) {
      W(wx, baseY, z0, BLOCK.POLISHED_OAK);
      W(wx, baseY, z1, BLOCK.POLISHED_OAK);
    }
    for (let wz = z0; wz <= z1; wz++) {
      W(x0, baseY, wz, BLOCK.POLISHED_OAK);
      W(x1, baseY, wz, BLOCK.POLISHED_OAK);
    }
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]])
      for (let dy = 0; dy < H - 1; dy++) W(px, baseY + dy, pz, BLOCK.POLISHED_OAK);
    // Exposed ceiling beams running the short way, one every three blocks.
    for (let wx = x0 + 2; wx <= x1 - 2; wx += 3)
      for (let wz = z0 + 1; wz <= z1 - 1; wz++) W(wx, baseY + H - 2, wz, BLOCK.OAK_LOG);
    // Re-open the doorway in case the wainscot band closed it.
    W(cX, baseY, z1, BLOCK.AIR);
    W(cX, baseY + 1, z1, BLOCK.AIR);

    // --- FIREPLACE ------------------------------------------------------------------
    // Widened to a five-block brick chimney breast with a stone hearthstone, so it
    // dominates the far wall the way the reference's does.
    /* Vertical layout is pinned to the room, not to arbitrary numbers: the walls
       occupy baseY..baseY+H-2 and baseY+H-1 IS the ceiling, so the mantel has to sit
       at baseY+3 with its clutter at baseY+4. Putting the shelf any higher buries it
       in the roof, and the chimney then has to start ABOVE the ceiling or it
       overwrites the shelf's centre block on its way up. */
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = 0; dy < H - 1; dy++) W(cX + dx, baseY + dy, fz, BLOCK.BRICK);
      W(cX + dx, baseY - 1, fz + 1, BLOCK.BRICK);          // hearthstone apron
    }
    // Firebox: 3 wide, 2 tall, with a stone lintel capping it.
    for (let dx = -1; dx <= 1; dx++) {
      W(cX + dx, baseY, fz, BLOCK.AIR);
      W(cX + dx, baseY + 1, fz, BLOCK.AIR);
      W(cX + dx, baseY + 2, fz, BLOCK.STONE);              // lintel
    }
    // Projecting mantel shelf, one course above the lintel.
    for (let dx = -2; dx <= 2; dx++) W(cX + dx, baseY + 3, fz, BLOCK.STONE);
    // Chimney: starts at the ceiling and continues out through the roof.
    for (let dy = H - 1; dy < H + 3; dy++) W(cX, baseY + dy, fz, BLOCK.BRICK);
    // Mantel clutter: a couple of small objects, off-centre so it looks unarranged.
    W(cX - 1, baseY + 4, fz, BLOCK.SIDE_MINT);
    W(cX + 2, baseY + 4, fz, BLOCK.SIDE_BUTTER);
    // Firewood stacked beside the hearth.
    for (let dy = 0; dy < 2; dy++) W(x0 + 1, baseY + dy, fz, BLOCK.OAK_LOG);
    W(x0 + 1, baseY, fz + 1, BLOCK.OAK_LOG);

    // --- RUG --------------------------------------------------------------------------
    // Laid in front of the hearth, notched at the corners so it reads as a woven mat
    // rather than a painted rectangle.
    for (let dx = -3; dx <= 3; dx++)
      for (let dz = 2; dz <= 6; dz++) {
        if (Math.abs(dx) === 3 && (dz === 2 || dz === 6)) continue;
        W(cX + dx, baseY - 1, fz + dz, BLOCK.RUG);
      }

    // --- SEATING ----------------------------------------------------------------------
    // Two benches flanking the rug, turned in toward the fire: polished seat, log back.
    for (const side of [-1, 1]) {
      const sx = cX + side * 4;
      for (let dz = 3; dz <= 6; dz++) {
        W(sx, baseY, fz + dz, BLOCK.POLISHED_OAK);           // seat
        W(sx + side, baseY, fz + dz, BLOCK.OAK_LOG);         // back rail
        W(sx + side, baseY + 1, fz + dz, BLOCK.OAK_LOG);
      }
      W(sx, baseY + 1, fz + 3, BLOCK.POLISHED_OAK);          // armrests
      W(sx, baseY + 1, fz + 6, BLOCK.POLISHED_OAK);
    }

    // --- LOW TABLE --------------------------------------------------------------------
    // Centred on the rug, one block clear of it so there is still a path to the fire.
    for (let dx = -1; dx <= 1; dx++) W(cX + dx, baseY, fz + 5, BLOCK.POLISHED_OAK);
    W(cX, baseY + 1, fz + 5, BLOCK.SIDE_CREAM);              // a mug left out

    // --- SHELVES + CLUTTER -------------------------------------------------------------
    // Wall shelves sit at baseY+1, deliberately BELOW the window rows at baseY+2/+3 so
    // nothing ever paints over the glass.
    const books = [BLOCK.SIDE_PINK, BLOCK.SIDE_MINT, BLOCK.SIDE_BUTTER, BLOCK.SIDE_SKY, BLOCK.SIDE_PEACH];
    let bi = 0;
    for (const [sx, sz0, sz1] of [[x0 + 1, cZ + 1, cZ + 4], [x1 - 1, cZ - 4, cZ - 1]]) {
      for (let wz = sz0; wz <= sz1; wz++) {
        W(sx, baseY + 1, wz, BLOCK.POLISHED_OAK);
        if ((wz + sx) % 3 !== 0) W(sx, baseY + 2, wz, books[(bi++) % books.length]);
      }
    }
    // A small stack of crates by the door — the "just moved in" read.
    W(x1 - 1, baseY, z1 - 4, BLOCK.POLISHED_OAK);
    W(x1 - 1, baseY + 1, z1 - 4, BLOCK.POLISHED_OAK);
    W(x1 - 2, baseY, z1 - 4, BLOCK.POLISHED_OAK);

    // --- FRAMED DECORATION ---------------------------------------------------------------
    // Small pictures hung on the free wall columns between the windows (offsets +-1
    // and +-3 are the columns the window pass at +-2/+-4 leaves alone).
    W(cX - 3, baseY + 2, z0, BLOCK.SIDE_PEACH);
    W(cX - 3, baseY + 3, z0, BLOCK.SIDE_PEACH);
    W(cX + 3, baseY + 2, z0, BLOCK.SIDE_SKY);
    W(cX + 3, baseY + 3, z0, BLOCK.SIDE_SKY);
    W(x0, baseY + 2, cZ + 3, BLOCK.SIDE_BUTTER);
    W(x0, baseY + 3, cZ + 3, BLOCK.SIDE_BUTTER);

    // --- COSY LIGHTING ---------------------------------------------------------------
    // Wall sconces as torch voxels (which the collapse rots like everything else) with
    // matching registered point lights for the actual warm glow.
    for (const [tx, tz] of [[x0 + 1, cZ - 3], [x1 - 1, cZ + 3]]) {
      W(tx, baseY + 3, tz, BLOCK.TORCH);
      this._havenAddLight(0xffcf8a, 0.9, 12, tx + 0.5, baseY + 3.4, tz + 0.5);
    }
    // A lamp on the low table and a soft bounce over the rug.
    this._havenAddLight(0xffdca8, 0.8, 10, cX + 0.5, baseY + 1.6, fz + 5.5);
    this._havenAddLight(0xffb877, 0.7, 14, cX + 0.5, baseY + 1.2, fz + 4.0);

    /* PHASE 31 — THE CHAIR FROM THE FIELD.

       The same furniture model that stands alone on a rug in a dead Farmlands field,
       here, turned toward the fire, in the one room in the game where an armchair is
       completely unremarkable. It appears only if the player actually stood in front of
       the one in the field — a callback to something nobody looked at is a prop.

       Nothing marks it and the Haven does not acknowledge it. STORY.md section 18
       forbids putting a warning in the cabin and this is emphatically not one: it is a
       comfortable chair by a fire, and the only thing wrong with it is where else it is. */
    if (this.envStory && this.envStory.eligibleById('haven_chair')) {
      const at = ENV_SITES.havenChair();
      if (at) furnStamp(W, 'armchairOat', at.x, baseY, at.z, 2);
    }
  }

  updateHavenAnomalies(dt, player, camera) {
    if (!this.havenAnomalyArmed || !player || !player.inFakeHaven) return false;
    if (this.havenCorrupted || !camera) return false;
    this._havenAnomalyTick = (this._havenAnomalyTick || 0) + dt;
    if (this._havenAnomalyTick < 0.5) return false;   // 2Hz, like every other notice sweep
    this._havenAnomalyTick = 0;

    const id = this.havenAnomalyArmed;
    if (id !== 'haven_second_mug') return false;
    const site = ENV_SITES.havenMantel ? ENV_SITES.havenMantel(this) : null;
    if (!site) return false;

    /* The gate. Distance first because it is the cheaper test, then facing — and the
       facing test is only meaningful while the shelf is close enough to be resolved at
       all, which inside a 12x12 cabin it always is. */
    const camPos = camera.position;
    const dx = (site.x + 0.5) - camPos.x, dz = (site.z + 0.5) - camPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < HAVEN_ANOMALY_MIN_DISTANCE) return false;
    const forward = _havenForward;
    camera.getWorldDirection(forward);
    const dot = (dx / dist) * forward.x + (dz / dist) * forward.z;
    if (dot > HAVEN_ANOMALY_MAX_DOT) return false;    // the hearth is still in shot

    /* REFUSE UNLESS THE SLOT IS WHAT WE EXPECT IT TO BE.

       The mantel is the chimney breast's brick face, and the two objects _dressHavenInterior
       already puts on it are set INTO that face rather than resting on air — so an empty
       slot on this shelf reads as BRICK, not as AIR. Requiring exactly that is what makes
       this safe: if a future change moves the mantel, re-dresses the room, or puts
       something else here, the block under the site stops being brick and the anomaly
       quietly does not happen. Better a piece of storytelling that fails to appear than
       one that punches a hole through the fireplace. */
    if (this.getBlockWorld(site.x, site.y, site.z) !== BLOCK.BRICK) {
      this.havenAnomalyArmed = null;
      return false;
    }

    this._writeBlockRaw(site.x, site.y, site.z, BLOCK.SIDE_CREAM);
    const chunk = this.chunks.get(this.key(site.x >> 4, site.z >> 4));
    if (chunk) { chunk.dirty = true; this.generateChunkMesh(chunk); }

    this.havenAnomalyArmed = null;
    if (!this.havenAnomalyDone) this.havenAnomalyDone = new Set();
    this.havenAnomalyDone.add(id);
    return true;
  }

  /* ---------------------------------------------------------------------------------
     PHASE 5B — THE HAVEN SHIFT (illusion collapse).
     Decays the cozy cabin into glitched void voxels in place. Rather than swapping
     block-for-block uniformly (which just reads as a recolor), each cell is rolled:
     most become corrupted/obsidian/mimic voxels, a minority are punched out to AIR
     entirely, so the structure visibly rots and breaks open rather than repainting.
     The deterministic hash means the decay pattern is stable if the chunk remeshes.

     Also strips every warm artifact of the illusion: the hearth fire and its light,
     the bed and storage props (removing them matters mechanically as well as
     thematically — leaving the bed would let its raycast interaction re-fire the
     shift), and it recolors the fog wall from sunlit cream to blood red.
     --------------------------------------------------------------------------------- */
  corruptHaven() {
    if (this.havenCorrupted || !this.fakeHavenBuilt) return;
    this.havenCorrupted = true;
    // PHASE 32 — disarm the anomaly. There is no mantel to put a mug on any more, and a
    // pending change surviving the collapse would be a write into decayed geometry.
    this.havenAnomalyArmed = null;

    const minX = FAKE_HAVEN_CHUNK_OFFSET * CHUNK_SX, minZ = FAKE_HAVEN_CHUNK_OFFSET * CHUNK_SZ;
    const span = FAKE_HAVEN_CHUNKS_SPAN * CHUNK_SX;
    const baseY = FAKE_HAVEN_BASE_Y;
    const cX = minX + Math.floor(span / 2), cZ = minZ + Math.floor(span / 2);
    const S = FAKE_HAVEN_CABIN_SIZE, half = Math.floor(S / 2);
    const x0 = cX - half, z0 = cZ - half, x1 = x0 + S - 1, z1 = z0 + S - 1;

    // Deterministic per-cell hash so a remesh can't reshuffle the decay.
    const roll = (a, b, c) => {
      let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
      h = (h ^ (h >>> 13)) >>> 0;
      return (h % 1000) / 1000;
    };

    const VOID_IDS = [BLOCK.CORRUPTED_STONE, BLOCK.OBSIDIAN, BLOCK.MIMIC_BLOCK];
    // Sweep a margin past the cabin so the lawn immediately around it rots too.
    for (let wx = x0 - 2; wx <= x1 + 2; wx++) {
      for (let wz = z0 - 2; wz <= z1 + 2; wz++) {
        // PHASE 10 — raised from baseY+9 to baseY+11 so the taller brick chimney
        // breast and the mantel clutter above it decay with everything else instead
        // of being left standing over the ruins.
        for (let wy = baseY - 1; wy <= baseY + 11; wy++) {
          const id = this.getBlockWorld(wx, wy, wz);
          if (id === BLOCK.AIR || id === BLOCK.HAVEN_BARRIER) continue;
          const r = roll(wx, wy, wz);
          if (r < 0.18) {
            // Punched out — the structure breaks open as it decays.
            this._writeBlockRaw(wx, wy, wz, BLOCK.AIR);
          } else {
            this._writeBlockRaw(wx, wy, wz, VOID_IDS[Math.floor(r * 1000) % VOID_IDS.length]);
          }
        }
      }
    }

    // Kill the hearth fire outright.
    if (this.havenFire) {
      this.scene.remove(this.havenFire.points);
      this.havenFire.geo.dispose();
      this.havenFire.points.material.dispose();
      this.havenFire = null;
    }
    if (this.havenFireLight) { this.scene.remove(this.havenFireLight); this.havenFireLight = null; }
    if (this.havenCozyLight) { this.scene.remove(this.havenCozyLight); this.havenCozyLight = null; }
    /* PHASE 10 — extinguish every warm light the interior registered. Generic by
       design: sconces, the table lamp and the hearth bounce all go out together, and
       any lamp added later is covered without touching this path. */
    if (this.havenWarmLights) {
      for (const l of this.havenWarmLights) this.scene.remove(l);
      this.havenWarmLights.length = 0;
    }

    // Remove the furniture props. Dropping the bed here is what prevents its
    // interaction raycast from re-triggering the shift after it has already fired.
    for (const key of ['havenBedGroup', 'havenChestGroup']) {
      const g = this[key];
      if (!g) continue;
      this.scene.remove(g);
      g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      this[key] = null;
    }

    // Repaint the fog wall blood red and thicken it so the world closes in.
    if (this.havenFogWall) {
      for (const sprite of this.havenFogWall.children) {
        sprite.material.color.setHex(0x6a0d0d);
        sprite.material.opacity = 0.72;
      }
    }

    // Remesh every Haven chunk so the decayed voxels actually appear.
    for (const chunk of this.chunks.values()) { chunk.dirty = true; this.generateChunkMesh(chunk); }
  }
});
