"use strict";
/* =====================================================================================
   VoxelWorld — THE WORLD ENGINE

   HOW A VOXEL WORLD WORKS. Not what any particular place is.

   ERA 1.5.3 SPLIT THIS CLASS. It was 13,404 lines, of which 9,900 described PLACES —
   farmsteads, suburban interiors, the Haven cabin, cave mouths. Those now live under
   src/dimensions/ and attach to this prototype through registerWorldContent. What is
   left is the engine: chunk storage and lifecycle, the one write path, meshing, light
   sources, doors, and the generation ORCHESTRATION that asks a dimension what goes in a
   chunk without knowing the answer.

   WHAT THIS CLASS OWNS
     chunk map and lifecycle          updateChunks, _generateChunk, disposeChunk, wipe*
     the single write path            setBlockWorld -> _writeBlockRaw
     generic stamping primitives      _subSet, _subGet, _subHits   (see the note below)
     block and terrain queries        getBlockWorld, isSolid, collidesAABB, findSpawnHeight
     meshing                          _buildChunkGeometry, generateChunkMesh, water, glass
     light sources                    torches, lanterns, portals, soul-anchor zones
     doors                            state, swings, sound

   WHAT IT DOES NOT OWN
     any farmstead, house, cabin, cave or site; any block pattern; any dimension's rules.
     It knows dimensions exist — eleven call edges, in three methods — and nothing more.

   ─────────────────────────────────────────────────────────────────────────────────────
   ONE NAMING WART, LEFT DELIBERATELY

   `_subSet`, `_subGet` and `_subHits` are the engine's generic stamping primitives —
   chunk-relative write, chunk-relative read, and does-this-box-touch-this-chunk. They
   carry a `_sub` prefix for exactly one historical reason: Static Suburbia was the first
   dimension that needed them. Between them they are called 66 times, from every
   dimension, and nothing in their ten lines mentions a suburb.

   THEY WERE NOT RENAMED HERE. Renaming would have edited 66 call sites in the same
   commit that relocated 9,900 lines, which is precisely how a relocation stops being
   provably a relocation. It is a mechanical follow-up; see the 1.5.4 handoff.
   ===================================================================================== */

class VoxelWorld {
  constructor(scene, atlasInfo, itemManager) {
    this.scene = scene;
    this.chunks = new Map();
    this.noise = new SimplexNoise(4242);
    this.caveNoise = new SimplexNoise(99110);
    this.coalNoise = new SimplexNoise(55221);
    this.ironNoise = new SimplexNoise(73311);
    this.obsidianNoise = new SimplexNoise(19844);
    this.andesiteNoise = new SimplexNoise(41207);
    this.graniteNoise = new SimplexNoise(83552);
    this.farmlandsNoise = new SimplexNoise(70241);
    /* PHASE 16 — the Farmlands hydrology field. Separate from farmlandsNoise so the
       watercourses are not correlated with the relief they cut through; a stream that
       only ever runs along the bottom of a valley it shares a noise field with reads
       as a texture, not as drainage. */
    this.farmWaterNoise = new SimplexNoise(31771);
    /* PHASE 19 — the basin field. Separate again, and for the same reason the water
       noise is separate from the relief noise: a hollow that only ever appears where
       the ground was already low is not a basin, it is a restatement of the heightfield.
       Uncorrelated, they interact — a basin cut into a rise makes a hilltop pond, a
       basin on a stream makes a widening. */
    this.farmBasinNoise = new SimplexNoise(52237);
    this.atlas = atlasInfo;
    this.itemManager = itemManager;
    this.material = new THREE.MeshLambertMaterial({ map: atlasInfo.texture, vertexColors: true });
    /* PHASE 21 — A MONOTONIC COUNTER OF VOXEL EDITS. Dropped items use it to skip a
       support probe they already know the answer to: nothing but a block write can take
       the ground out from under a resting item, so if this has not moved since the last
       check, neither has its support. Bumped by setBlockWorld and _writeBlockRaw, which
       between them are every path that mutates chunk data after generation. */
    this.worldEdits = 0;
    this.torchLights = new Map();
    this.torchProps = new Map();
    // PHASE 4B — Lantern light sources live in their own map, deliberately separate
    // from torchLights: the Hollowed Behemoth's Darkness Aura ability only ever
    // iterates torchLights, so keeping Lanterns out of that map is what makes them
    // immune to boss darkness events (steady 20-unit #FFCC66 glow, never snuffed).
    this.lanternLights = new Map();
    this.lanternProps = new Map();
    // PHASE 4B — Soul Anchors: placed props that open a 15-unit glowing zone which
    // halts Sanity decay (read by SanitySystem.update via isInsideSoulAnchorZone).
    this.soulAnchors = new Map();
    this.soulAnchorProps = new Map();
    // TORCH DECAY tracking, keyed the same way as torchLights/torchProps ("wx,wy,wz").
    // Lives at the VoxelWorld level (not per-chunk) so a burn-down timer keeps
    // counting even if the chunk holding that torch streams out and back in.
    this.torchDecay = new Map();
    this.anchorManager = null;
    this.mimicCandidates = new Set();
    this.openedChests = new Set();
    // LEVEL 3 — Static Suburbia window world-positions, populated by
    // _genStaticSuburbiaRegion, read by SoundEngine for the CRT static spatialization.
    this.suburbiaWindows = [];
    // LEVEL 3 — PHASE 5A PART 2: per-lot descriptors ({hx,hz,size,baseY,doorSide,
    // windowIndex}) for every stamped Suburbia house, read by
    // updateSuburbiaRearrangement so a house's door/window layout can be silently
    // rotated onto a different wall while it's out of the player's sightline.
    this.suburbiaLots = [];
    /* PHASE 9 — persistent door-side overrides for rearranged houses, keyed by lot.
       Bounded by how many lots the player has actually stood still near, not by how
       far they have explored. */
    this.suburbiaDoorOverrides = new Map();
    this._suburbiaRearrangeTimer = 0;
    /* PHASE 14 — which doors the player has left open. Bounded at DOOR_STATE_CAP with
       oldest-first eviction, because an infinite suburb must never accumulate a
       permanent entry for every door ever touched. An evicted door streams back closed. */
    this.suburbiaDoorState = new Map();
    this._doorStateOrder = [];

    /* =================================================================================
       PHASE 15 — THE RECOGNITION LEDGER

       Two bounded maps and a handful of scalars. That is the entire persistent cost of
       the phase, and both maps evict oldest-first exactly as the Phase 14 door registry
       does, because an infinite suburb must never accumulate one permanent entry per
       house ever entered. An evicted house streams back in its original state, which is
       both correct and, given how far the player would have to have walked for it to
       happen, entirely unnoticeable.

         suburbiaVisits   lot key -> how many times the player has been inside
         suburbiaStage    lot key -> how many revisions that house has accumulated

       Only the stage map is read by generation. The visit map exists purely to decide
       WHICH houses are eligible to be revised, and never touches a voxel. */
    this.suburbiaVisits = new Map();
    this._subVisitOrder = [];
    this.suburbiaStage = new Map();
    this._subStageOrder = [];
    // Houses the player has left, waiting for a moment when they are far away and not
    // looking. Hard-capped: this is a queue, not a registry.
    this._subPending = new Map();
    this._subInsideLot = null;
    this._subInsideKey = null;
    this._subRecogTick = 0;
    this._subRecogCooldown = 0;
    this._subRecogCommits = 0;   // session counter, for the audit only

    // LEVEL 4 — THE FAKE HAVEN (PHASE 5A PART 3). Deliberately NOT generated here:
    // fakeHavenBuilt stays false until generateFakeHaven() is called by the illusion
    // sequence, and fakeHavenActive is the flag updateChunks() reads to shut radial
    // streaming off so no Overworld terrain can appear behind the fog wall.
    this.fakeHavenBuilt = false;
    this.fakeHavenActive = false;
    this.fakeHavenSpawn = null;
    this.havenBedGroup = null;
    this.havenChestGroup = null;
    this.havenFire = null;
    this.havenFireLight = null;
    this.havenFogWall = null;
    // PHASE 5B — illusion-collapse state.
    this.havenCorrupted = false;
    /* PHASE 32 — the Haven's one committed change. `armed` is the event id the stage
       machine has permitted; `done` is what has already happened this visit, so nothing
       can fire twice. Both are transient by construction: the Haven is never saved and
       these are re-created with the world. See updateHavenAnomalies. */
    this.havenAnomalyArmed = null;
    this.havenAnomalyDone = new Set();
    this._havenAnomalyTick = 0;
    this._havenLightLevel = 1;        // PHASE 32 — see setHavenLightLevel
    this.finale = null;        // PHASE 33 — the final sequence's scene, or null
    // Persistent 27-slot container backing the cabin's storage chest.
    this.havenStorage = Array(27).fill(null).map(() => ({ item: ITEM.NONE, count: 0 }));

    // RADIAL CHUNK STREAMING state.
    this._genQueue = [];            // [{cx, cz}, ...] pending async batched generation
    this._queuedKeys = new Set();   // keys already sitting in _genQueue (avoid dupes)
    this.pinnedChunkKeys = new Set(); // chunk keys that streaming must never dispose (the Farmlands pocket)
    /* PHASE 35 — the one pin in that set that belongs to a player-placed Anchor
       Monument, so leaving the dimension can put it down again. Null when no Anchor
       stands, or when the monument's chunk was already pinned for its own reason. */
    this._anchorPinKey = null;
    this.editedChunks = new Map();  // key -> Map(localIdx -> blockId), player edits that survive unload/reload

    this._genFarmlandsRegion();
    // LEVEL 3 — generated eagerly here too (same pattern as the Farmlands), so
    // Static Suburbia is already sitting fully built and pinned by the time
    // _transitionToLevel3() teleports the player into it — no mid-transition
    // generation stall.
    this._genStaticSuburbiaRegion();
    // THE DISCONNECTED HOME (LEVEL 3) — CRITICAL BUG FIX (PHASE 5A PART 3): the
    // eager, ungated `this._genDisconnectedHomeL3()` call that used to sit here is
    // GONE. Calling it at world-construction time is exactly what let it force-
    // generate and pin ordinary Overworld chunks around (0, 500) and stamp a Level 3
    // structure into the Overworld grid. It is now invoked only from inside
    // _genStaticSuburbiaRegion() above, and only with DIMENSION.SUBURBIA — so it is
    // structurally impossible for it to touch the Overworld again.
    // Eagerly (synchronously, ignoring the per-frame budget) generate + mesh the
    // chunks around the fixed overworld spawn point so the player never spawns into
    // an empty void waiting on the first streamed batch; everything beyond this
    // ring streams in on demand via updateChunks() as the player moves.
    this._eagerLoadAround(WORLD_CHUNKS_X * CHUNK_SX / 2, WORLD_CHUNKS_Z * CHUNK_SZ / 2, 3);
  }

  setAnchorManager(mgr) {
    this.anchorManager = mgr;
  }

  key(cx, cz) { return cx + ',' + cz; }

  // Generates one chunk's voxel data (terrain -> trees -> decor -> treasure chests),
  // then reapplies any player edits recorded from a previous visit before this chunk
  // was disposed. Does not mesh — callers mesh via generateChunkMesh once the chunk
  // (and ideally its neighbors) exist, so seam faces read correctly.
  _generateChunk(cx, cz) {
    const k = this.key(cx, cz);
    let chunk = this.chunks.get(k);
    if (chunk) return chunk;
    chunk = new Chunk(cx, cz, this);
    this.chunks.set(k, chunk);
    /* GENERATOR DISPATCH. Static Suburbia and the Farmlands are terrain variants selected
       by world position, not separate world engines. Everything downstream of here —
       editedChunks replay, skylight bake, neighbour dirtying, meshing, unloading — is the
       same code path all three use, which is exactly why three dimensions stream
       infinitely without a second streamer existing.

       ERA 1.5.3 turned the branch that used to be here into a table. The engine no longer
       names a single dimension method: it asks which generator holds this chunk and hands
       it the chunk. The rows, their ORDER and the calls inside them are unchanged — see
       src/dimensions/dimension-generators.js, where the reasons for that order are
       written down. Adding a dimension is a row there, not an else-if here. */
    chunkGeneratorFor(cx, cz).generateChunk(this, chunk);
    const edits = this.editedChunks.get(k);
    if (edits) { for (const [idx, id] of edits) chunk.data[idx] = id; }
    this._bakeChunkSkylight(chunk);
    chunk.dirty = true;
    this._markNeighborsDirty(cx, cz);
    return chunk;
  }

  // A freshly-generated chunk's neighbors were meshed against "nothing there yet"
  // (an ungenerated chunk reads as BLOCK.AIR at its border), so once this chunk
  // exists those neighbor meshes have stale/missing seam faces — flag them for the
  // next dirty-remesh sweep.
  _markNeighborsDirty(cx, cz) {
    const offs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx, dz] of offs) {
      const n = this.chunks.get(this.key(cx + dx, cz + dz));
      if (n) n.dirty = true;
    }
  }

  _eagerLoadAround(wx, wz, radiusChunks) {
    const pcx = Math.floor(wx / CHUNK_SX), pcz = Math.floor(wz / CHUNK_SZ);
    for (let dx = -radiusChunks; dx <= radiusChunks; dx++) {
      for (let dz = -radiusChunks; dz <= radiusChunks; dz++) {
        this._generateChunk(pcx + dx, pcz + dz);
      }
    }
    for (const chunk of this.chunks.values()) this.generateChunkMesh(chunk);
  }

  /* ---------------------------------------------------------------------------------
     RADIAL CHUNK STREAMING ENGINE — called every frame with the player/camera
     position. Queues any not-yet-loaded chunk within CHUNK_LOAD_RADIUS, drains that
     queue through a per-frame time budget (async batched task loop, so entering a
     new area never stalls a single frame generating a whole ring of chunks at once),
     remeshes anything an edit or a newly-generated neighbor marked dirty, and
     instantly disposes GPU geometry/materials/collision data for chunks that fell
     beyond CHUNK_UNLOAD_RADIUS.
     --------------------------------------------------------------------------------- */
  updateChunks(playerPos) {
    // LEVEL 4 — FAKE HAVEN STREAMING LOCK (PHASE 5A PART 3). The Haven is a closed,
    // fully pre-generated 3x3 pocket. If the normal radial streamer were left running
    // here it would immediately queue the ~200 chunk ring around the pocket and run
    // ORDINARY OVERWORLD TERRAIN GENERATION inside Level 4 — hills, trees and caves
    // would materialize on the far side of the fog wall and destroy the illusion (and
    // silently re-populate a world the transition just finished flushing). So while
    // the Haven is active, streaming is switched off entirely: no queueing, no
    // generation, no unloading. Dirty chunks are still remeshed so edits inside the
    // cabin (and the initial build) still show up.
    if (this.fakeHavenActive) {
      for (const chunk of this.chunks.values()) {
        if (chunk.dirty) this.generateChunkMesh(chunk);
      }
      return;
    }

    const pcx = Math.floor(playerPos.x / CHUNK_SX), pcz = Math.floor(playerPos.z / CHUNK_SZ);
    const loadR2 = CHUNK_LOAD_RADIUS * CHUNK_LOAD_RADIUS;

    /* PHASE 11 — MOVEMENT DIRECTION. Derived here rather than plumbed in, so nothing
       upstream has to change. It biases the queue toward chunks the player is walking
       INTO, which is where a missing chunk is actually noticeable. */
    if (this._lastStreamPos) {
      const mvx = playerPos.x - this._lastStreamPos.x, mvz = playerPos.z - this._lastStreamPos.z;
      const m = Math.hypot(mvx, mvz);
      if (m > 0.02) { this._moveDirX = mvx / m; this._moveDirZ = mvz / m; }
    } else { this._lastStreamPos = { x: playerPos.x, z: playerPos.z }; }
    this._lastStreamPos.x = playerPos.x; this._lastStreamPos.z = playerPos.z;
    const mdx = this._moveDirX || 0, mdz = this._moveDirZ || 0;

    /* The 289-cell load-ring scan only needs to run when the player's chunk changes;
       standing still cannot bring a new chunk into radius. */
    let enqueued = false;
    if (this._lastRingCx !== pcx || this._lastRingCz !== pcz) {
      this._lastRingCx = pcx; this._lastRingCz = pcz;
      this._ringDirty = true;
    }
    if (this._ringDirty) {
      this._ringDirty = false;
    for (let dx = -CHUNK_LOAD_RADIUS; dx <= CHUNK_LOAD_RADIUS; dx++) {
      for (let dz = -CHUNK_LOAD_RADIUS; dz <= CHUNK_LOAD_RADIUS; dz++) {
        if (dx * dx + dz * dz > loadR2) continue; // circular footprint, not square
        const cx = pcx + dx, cz = pcz + dz;
        const k = this.key(cx, cz);
        if (this.chunks.has(k) || this._queuedKeys.has(k)) continue;
        this._genQueue.push({ cx, cz });
        this._queuedKeys.add(k);
        enqueued = true;
      }
    }
    }

    /* PRIORITY. The old queue was filled in raw dx/dz scan order, which starts at a
       CORNER of the bounding square — so the furthest chunks were generated before the
       ones under the player's feet. Sorting by distance, with a bonus for lying along
       the direction of travel, means the budget is always spent where it shows. */
    if (enqueued && this._genQueue.length > 1) {
      this._genQueue.sort((a, b) => this._streamScore(a, pcx, pcz, mdx, mdz) - this._streamScore(b, pcx, pcz, mdx, mdz));
    }

    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const deadline = now() + CHUNK_GEN_FRAME_BUDGET_MS;

    /* COLLISION GUARANTEE. The chunk the player occupies and its immediate ring are
       generated synchronously, outside the budget. Budgeting them could let the player
       walk into a chunk whose voxel data does not exist yet — collision reads
       chunk.data directly, so that would read as falling through the world. This is a
       handful of chunks and only ever fires on arrival or a teleport. */
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cx = pcx + dx, cz = pcz + dz, k = this.key(cx, cz);
        if (this.chunks.has(k)) continue;
        this._queuedKeys.delete(k);
        this.generateChunkMesh(this._generateChunk(cx, cz));
      }
    }

    while (this._genQueue.length && now() < deadline) {
      const { cx, cz } = this._genQueue.shift();
      const k = this.key(cx, cz);
      this._queuedKeys.delete(k);
      if (this.chunks.has(k)) continue;   // already built by the collision guarantee above
      const chunk = this._generateChunk(cx, cz);
      this.generateChunkMesh(chunk);
    }

    /* DIRTY SWEEP — NOW BUDGETED, AND SHARING THE SAME DEADLINE.
       This was the amplifier. Each generated chunk marks up to four neighbours dirty
       for a seam rebuild, and this sweep then remeshed every one of them with NO time
       limit in the same frame — so the real per-frame mesh work was the 4ms budget
       plus an unbounded multiple of it. Seam remeshes are now drained under the same
       deadline as generation, and any left over simply roll to the next frame: they
       are a cosmetic seam fix, never a correctness or collision issue. */
    /* Iterated straight off the Map rather than through Array.from(): that snapshot
       allocated a ~230-element array EVERY frame purely to look at a boolean, which is
       exactly the kind of steady garbage that turns into a collection pause mid-walk.
       The cursor rotates the starting point so no chunk can be starved by the budget
       running out at the same place each frame. */
    if (this._dirtyCursor === undefined) this._dirtyCursor = 0;
    const total = this.chunks.size;
    if (total > 0) {
      const start = this._dirtyCursor % total;
      let i = 0, scanned = 0;
      for (const chunk of this.chunks.values()) {
        if (i++ < start) continue;
        scanned++;
        if (chunk.dirty) {
          this.generateChunkMesh(chunk);
          if (now() >= deadline) break;
        }
      }
      this._dirtyCursor = start + scanned;
    }

    /* MEMORY CLEANUP: dispose chunks that fell outside the unload radius.
       Gated on the player having actually crossed into a different chunk. Nothing can
       fall out of the unload radius while they stand still inside one, so running this
       every frame only paid for an Array.from() snapshot of the whole resident set —
       another per-frame allocation for no result. */
    if (this._lastUnloadCx !== pcx || this._lastUnloadCz !== pcz) {
      this._lastUnloadCx = pcx; this._lastUnloadCz = pcz;
      const unloadR2 = CHUNK_UNLOAD_RADIUS * CHUNK_UNLOAD_RADIUS;
      for (const chunk of Array.from(this.chunks.values())) {
        const k = this.key(chunk.cx, chunk.cz);
        if (this.pinnedChunkKeys.has(k)) continue;
        const ddx = chunk.cx - pcx, ddz = chunk.cz - pcz;
        if (ddx * ddx + ddz * ddz > unloadR2) this.disposeChunk(chunk);
      }
    }
  }

  /* Lower is generated sooner. Distance dominates; the forward-travel bonus is a
     subtraction large enough to reorder chunks at similar range but never large
     enough to jump ahead of something genuinely closer. */
  _streamScore(entry, pcx, pcz, mdx, mdz) {
    const dx = entry.cx - pcx, dz = entry.cz - pcz;
    const d2 = dx * dx + dz * dz;
    if (!mdx && !mdz) return d2;
    const d = Math.sqrt(d2) || 1;
    const forward = (dx / d) * mdx + (dz / d) * mdz;   // -1 behind .. +1 ahead
    return d2 - forward * CHUNK_STREAM_FORWARD_BIAS;
  }

  // Instantly frees a chunk's GPU geometry, its material reference, and the voxel
  // data that backs both meshing and collision queries (isSolid/getBlockWorld read
  // chunk.data directly, so there's no separate "collision array" to clean up —
  // deleting the chunk from the map is what frees it for GC). Any player edits made
  // to this chunk stay recorded in editedChunks and get reapplied if it streams back
  // in later, so mining/building survives an unload/reload cycle.
  disposeChunk(chunk) {
    const k = this.key(chunk.cx, chunk.cz);
    if (this.pinnedChunkKeys.has(k)) return; // the Farmlands pocket / Anchor Monument are never unloaded
    if (chunk.mesh) { this.scene.remove(chunk.mesh); chunk.mesh.geometry.dispose(); chunk.mesh = null; }
    if (chunk.waterMesh) { this.scene.remove(chunk.waterMesh); chunk.waterMesh.geometry.dispose(); chunk.waterMesh = null; }
    if (chunk.glassMesh) { this.scene.remove(chunk.glassMesh); chunk.glassMesh.geometry.dispose(); chunk.glassMesh = null; }
    // this.material / this.waterMaterial / this.glassMaterial are shared across every
    // chunk and are intentionally NOT disposed here — only the per-chunk geometry is unique.

    // MEMORY LEAK FIX: this chunk's decor crosses (flowers/tall grass) each own a
    // unique geometry + material (see _buildCrossMesh) and were previously left
    // parented under the permanent decorGroup with no back-reference, so they were
    // never removed or disposed on unload — an unbounded leak that grew with every
    // chunk the player ever visited. Remove + dispose them here, alongside the
    // chunk's own geometry.
    /* PHASE 11 — THE ACTUAL HITCH. Every TORCH block a chunk contains creates a
       THREE.PointLight, and nothing ever took them down again: disposeChunk() freed
       meshes and decor but left the lights and their prop meshes in the scene forever.
       Static Suburbia puts a street lamp on the sidewalk every 20 blocks, so exploring
       accumulated point lights without limit. Three.js recompiles every material's
       shader program whenever the light count changes, against a uniform array that
       keeps growing — which is precisely the multi-second freeze, and precisely why it
       got worse the further you walked.
       The decay fuel timer is deliberately NOT cleared here: it lives at world level
       and must survive an unload/reload cycle, so this uses the unload path rather
       than _removeTorchLight (which is for a torch actually being destroyed). */
    if (chunk.lightSources) {
      for (const [wx, wy, wz] of chunk.lightSources) this._unloadLightSource(wx, wy, wz);
      chunk.lightSources = null;
    }

    if (chunk.decorMeshes) {
      for (const mesh of chunk.decorMeshes) {
        this.decorGroup.remove(mesh);
        for (const child of mesh.children) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
      }
      chunk.decorMeshes = null;
    }

    chunk.skylight = null;
    this.chunks.delete(k);
  }

  // LEVEL TRANSITION — "world-chunk wipe": disposes every currently-loaded chunk
  // that isn't pinned (the Shattered Farmlands pocket, and
  // any chunk holding a placed Anchor Monument all stay put — disposeChunk already
  // refuses to touch pinned chunks). Player edits already made to disposed chunks
  // survive in editedChunks and are silently reapplied if that ground ever streams
  // back in, so nothing is actually lost — it just reads as the old world
  // dissolving away the instant the Rift Core fires.
  wipeOverworldChunks() {
    for (const chunk of Array.from(this.chunks.values())) this.disposeChunk(chunk);
  }

  /* PHASE 35 — releases the pin an Anchor Monument placement added, and only that one.
     `_anchorPinKey` is null when the monument stood in a chunk that was already pinned
     for its own reason (a region core), so this can never unpin something that was not
     the Anchor's to pin. Safe to call when no Anchor was ever placed. */
  releaseAnchorPin() {
    if (!this._anchorPinKey) return false;
    this.pinnedChunkKeys.delete(this._anchorPinKey);
    this._anchorPinKey = null;
    return true;
  }

  /* LEVEL 4 — TOTAL WORLD FLUSH (PHASE 5A PART 3).
     wipeOverworldChunks() above deliberately spares pinned chunks (the Farmlands and
     Suburbia pockets), because Levels 2 and 3 are meant to stay resident. The Fake
     Haven is different: the illusion requires that NOTHING of the horror world is
     still loaded behind the fog. This clears the pin registry first so disposeChunk
     stops refusing, drops every chunk, and tears down the standalone scene objects
     that live outside the chunk system (the Disconnected Home's floating furniture
     and its pulsing chest light) — otherwise those would linger in the scene graph
     forever with no chunk left to own them. */
  wipeAllChunks() {
    this.pinnedChunkKeys.clear();
    this._anchorPinKey = null;   // PHASE 35 — the registry it referred to is gone
    for (const chunk of Array.from(this.chunks.values())) this.disposeChunk(chunk);
    this._genQueue.length = 0;
    this._queuedKeys.clear();

    if (this.disconnectedHomeL3Props) {
      for (const prop of this.disconnectedHomeL3Props) {
        if (this.decorGroup) this.decorGroup.remove(prop);
        this.scene.remove(prop);
        prop.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      }
      this.disconnectedHomeL3Props = null;
    }
    if (this.disconnectedHomeL3Glow) {
      this.scene.remove(this.disconnectedHomeL3Glow);
      this.disconnectedHomeL3Glow = null;
    }
    // Torch/portal point lights belong to chunks that no longer exist.
    if (this.torchLights) {
      for (const light of this.torchLights.values()) this.scene.remove(light);
      this.torchLights.clear();
    }
    if (this.torchProps) {
      for (const prop of this.torchProps.values()) {
        this.scene.remove(prop);
        prop.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      }
      this.torchProps.clear();
    }
    this.suburbiaWindows = [];
    this.suburbiaLots = [];
  }

  /* Clipped voxel write — the only way any Suburbia structure touches the world, so a
     structure can never write outside the chunk currently being generated. */
  _subSet(chunk, wx, wy, wz, id) {
    // chunk === null means "write through to whichever loaded chunk owns this voxel".
    // The rearrangement system uses this to re-stamp a house that straddles chunk
    // borders, and _writeBlockRaw marks each touched chunk dirty for remeshing.
    if (chunk === null) { this._writeBlockRaw(wx, wy, wz, id); return; }
    const x = wx - chunk.cx * CHUNK_SX, z = wz - chunk.cz * CHUNK_SZ;
    if (x < 0 || x >= CHUNK_SX || z < 0 || z >= CHUNK_SZ) return;
    if (wy < 0 || wy >= CHUNK_SY) return;
    chunk.data[chunk.idx(x, wy, z)] = id;
  }

  /* Does this rectangle touch the chunk currently being generated? Structures are
     clipped write-by-write, which is what makes cross-chunk buildings deterministic,
     but clipping is not free — so each pass of the house stamper asks this once and
     skips wholesale when it has nothing to contribute. chunk === null means the
     rearrangement system is writing through to the live world, where nothing is
     skippable. */
  _subHits(chunk, x0, z0, x1, z1) {
    if (chunk === null) return true;
    const cx0 = chunk.cx * CHUNK_SX, cz0 = chunk.cz * CHUNK_SZ;
    return !(x1 < cx0 || x0 >= cx0 + CHUNK_SX || z1 < cz0 || z0 >= cz0 + CHUNK_SZ);
  }

  // Read back what a structure has already written, so later passes (roofs over wings,
  // eaves against walls) can avoid overwriting something taller.
  _subGet(chunk, wx, wy, wz) {
    if (chunk === null) return this.getBlockWorld(wx, wy, wz);
    const x = wx - chunk.cx * CHUNK_SX, z = wz - chunk.cz * CHUNK_SZ;
    if (x < 0 || x >= CHUNK_SX || z < 0 || z >= CHUNK_SZ) return -1;   // outside: unknown
    if (wy < 0 || wy >= CHUNK_SY) return -1;
    return chunk.data[chunk.idx(x, wy, z)];
  }

  /* =====================================================================================
     PHASE 14 — THE FUNCTIONAL DOOR SYSTEM

     A door is two block ids and a swing animation. Nothing else. There is no door entity,
     no per-door scene object, no registry that grows with exploration and no new
     interaction path — the player right-clicks a door exactly the way they already
     right-click an Anchor or a chest, and _placeBlockOrInteract checks DOOR_LOOKUP before
     anything else it does.

     STATE AND PERSISTENCE. A door's state is which block id sits in its two cells, so it
     survives meshing, saving and reading for free. What it cannot survive on its own is a
     chunk unload: the chunk regenerates from the seed and the door comes back closed. So
     the state — and ONLY the state, one bit per door the player has actually touched — is
     recorded in `suburbiaDoorState`, which _subOpenings consults when it stamps the door
     back in. That map is explicitly BOUNDED (see DOOR_STATE_CAP): an infinite suburb
     cannot be allowed to accumulate an entry for every door ever opened, so the oldest
     entries are evicted, and an evicted door simply streams back in closed — which is
     what a door you left behind half a mile ago should do anyway.

     REARRANGEMENT. When the rearrangement mechanic moves a house's front door to another
     wall, _rearrangeSuburbiaLot clears every door state inside that lot's rectangle before
     re-stamping. The new door is therefore correct, and the old one cannot leave a ghost
     entry behind pointing at a wall that no longer has a door in it.

     THE ANIMATION is the only scene object in the whole system, and it is a POOL of four
     meshes shared by every door in the world. A swing borrows one, plays for 0.34s and
     gives it back. Nothing accumulates.
     ===================================================================================== */

  _doorKey(wx, wy, wz) { return wx + ',' + wy + ',' + wz; }

  /* Remembers that the player has left this door open. Closed is the default, so only
     open doors are recorded and the map stays as small as it can be. */
  _setDoorState(wx, wy, wz, open) {
    const k = this._doorKey(wx, wy, wz);
    if (!open) { this.suburbiaDoorState.delete(k); return; }
    if (!this.suburbiaDoorState.has(k)) {
      this._doorStateOrder.push(k);
      while (this._doorStateOrder.length > DOOR_STATE_CAP) {
        this.suburbiaDoorState.delete(this._doorStateOrder.shift());
      }
    }
    this.suburbiaDoorState.set(k, 1);
  }
  _getDoorState(wx, wy, wz) { return this.suburbiaDoorState.has(this._doorKey(wx, wy, wz)); }

  // Drops every remembered door inside a rectangle. Called when a lot is rearranged.
  _clearDoorStatesIn(x0, z0, x1, z1) {
    if (!this.suburbiaDoorState.size) return;
    for (const k of Array.from(this.suburbiaDoorState.keys())) {
      const p = k.split(',');
      const wx = +p[0], wz = +p[2];
      if (wx >= x0 && wx <= x1 && wz >= z0 && wz <= z1) {
        this.suburbiaDoorState.delete(k);
      }
    }
    this._doorStateOrder = this._doorStateOrder.filter(k => this.suburbiaDoorState.has(k));
  }

  /* Given any cell of any door, returns everything needed to operate it: the base cell,
     the two block ids for each state, the facing, and the geometry of the swing so the
     animation can be played and the player can be checked out of the way. */
  _doorAt(wx, wy, wz) {
    const id = this.getBlockWorld(wx, wy, wz);
    const info = DOOR_LOOKUP.get(id);
    if (!info) return null;
    let by = wy - (info.part || 0);
    if (info.sameId) {
      // Interior doors use one id for both cells; walk down to the lower one.
      if (this.getBlockWorld(wx, wy - 1, wz) === id) by = wy - 1;
    }
    return { info, id, bx: wx, by, bz: wz };
  }

  /* THE TOGGLE. Returns a short status string for the HUD, or null if this was not a door.
     Refuses exactly one thing — closing a door onto the player — because that is the only
     way this system could ever trap anybody. */
  toggleDoor(wx, wy, wz, playerAABB) {
    const d = this._doorAt(wx, wy, wz);
    if (!d) return null;
    const info = d.info;
    const opening = info.state === 'closed';

    if (!opening && playerAABB) {
      // Closing: the player must not be standing in the leaf's path.
      const bx = d.bx, bz = d.bz;
      if (playerAABB.maxX > bx - 0.15 && playerAABB.minX < bx + 1.15 &&
          playerAABB.maxZ > bz - 0.15 && playerAABB.minZ < bz + 1.15 &&
          playerAABB.maxY > d.by && playerAABB.minY < d.by + 2) {
        return 'blocked';
      }
    }

    const target = opening ? 'open' : 'closed';
    if (info.kind === 'interior') {
      const rec = INT_DOOR[info.axis + ':' + (info.swing > 0 ? 1 : -1)];
      const nid = opening ? rec.openId : rec.closedId;
      this.setBlockWorld(d.bx, d.by, d.bz, nid);
      this.setBlockWorld(d.bx, d.by + 1, d.bz, nid);
    } else {
      const set = info.kind === 'front' ? FRONT_DOOR[info.colour] : GARAGE_DOOR;
      const name = target === 'open' ? set.open : set.closed;
      const cells = furnCells(name, info.face);
      // Both cells of the door are rewritten together, so a door can never be caught
      // half-open across a chunk edit.
      for (const c of cells) this.setBlockWorld(d.bx + c[0], d.by + c[1], d.bz + c[2], c[3]);
    }

    this._setDoorState(d.bx, d.by, d.bz, opening);
    this._spawnDoorSwing(d, info, opening);
    return opening ? 'opened' : 'closed';
  }

  /* --------------------------------------------------------------------------------------
     THE SWING. A single flat leaf borrowed from a fixed pool of four, rotated about the
     hinge over 0.34s. The voxel door has ALREADY changed state by the time this plays, so
     the animation is purely visual and can never be the thing the player is standing in.

     The pool is created lazily on the first door the player ever opens, is capped at four,
     and is never added to — which is the whole of this phase's scene-object footprint.
     -------------------------------------------------------------------------------------- */
  _spawnDoorSwing(d, info, opening) {
    if (!this.scene || typeof THREE === 'undefined') return;
    if (info.kind === 'garage') { this._playDoorSound(opening, true); return; }
    if (!this._doorSwingPool) {
      this._doorSwingPool = [];
      this._doorSwingActive = [];
      this._doorSwingMat = new THREE.MeshLambertMaterial({ color: 0x8a6f5c });
      this._doorSwingGeo = new THREE.BoxGeometry(0.82, 1.85, 0.09);
      // The geometry is shifted so the box's local origin sits on the hinge edge, which
      // is what lets a plain rotation.y read as a door swinging.
      this._doorSwingGeo.translate(0.41, 0.95, 0);
    }
    let node = this._doorSwingPool.pop();
    if (!node && this._doorSwingActive.length < DOOR_SWING_POOL) {
      node = new THREE.Mesh(this._doorSwingGeo, this._doorSwingMat.clone());
      node.matrixAutoUpdate = true;
    }
    if (!node) return;   // pool exhausted: the door still works, it just does not animate

    const colours = [0x7E3B34, 0x3B4A5E, 0xC9C4B6, 0xDCD6C6];
    node.material.color.setHex(colours[info.kind === 'front' ? info.colour : 3]);

    /* Where the hinge is, in world space, and which way the leaf points when closed. The
       door model is authored facing +z with the hinge at low x, so the facing tells us
       both. Interior doors hinge on the low end of the wall's run axis. */
    const yaw = [0, Math.PI / 2, Math.PI, -Math.PI / 2];   // face 0,1,2,3 -> rotation
    let hingeX, hingeZ, baseRot, sweep;
    if (info.kind === 'front') {
      const f = info.face;
      // Hinge corner of the cell, rotated with the door.
      const corners = [[0.09, 0.5], [0.5, 0.91], [0.91, 0.5], [0.5, 0.09]];
      hingeX = d.bx + corners[f][0]; hingeZ = d.bz + corners[f][1];
      baseRot = [0, Math.PI / 2, Math.PI, -Math.PI / 2][f];
      sweep = -Math.PI / 2;
    } else {
      if (info.axis === 0) { hingeX = d.bx + 0.12; hingeZ = d.bz + 0.5; baseRot = 0; }
      else { hingeX = d.bx + 0.5; hingeZ = d.bz + 0.12; baseRot = Math.PI / 2; }
      sweep = (info.swing > 0 ? -1 : 1) * Math.PI / 2;
    }
    node.position.set(hingeX, d.by, hingeZ);
    node.userData.baseRot = baseRot;
    node.userData.sweep = sweep;
    node.userData.t = 0;
    node.userData.opening = opening;
    node.rotation.y = baseRot + (opening ? 0 : sweep);
    this.scene.add(node);
    this._doorSwingActive.push(node);
    this._playDoorSound(opening, false);
  }

  _playDoorSound(opening, heavy) {
    const s = this.soundEngine || (this.game && this.game.sound) || null;
    if (!s) return;
    // Reuses the existing block SFX rather than adding an audio path: a latch click on
    // open, a duller thud on close.
    if (opening) { if (s.playBlockPlace) s.playBlockPlace(); }
    else if (s.playBlockBreak) s.playBlockBreak(heavy ? BLOCK.CONCRETE : BLOCK.OAK_LOG);
  }

  /* Advances every swing in flight. Called once a frame from the main loop; costs nothing
     at all when no door is moving, because the active list is empty. */
  updateDoorSwings(dt) {
    const act = this._doorSwingActive;
    if (!act || !act.length) return;
    for (let i = act.length - 1; i >= 0; i--) {
      const n = act[i];
      n.userData.t += dt / DOOR_SWING_TIME;
      let k = Math.min(1, n.userData.t);
      // Ease out, so the leaf settles rather than stopping dead.
      const e = 1 - (1 - k) * (1 - k);
      const from = n.userData.opening ? 0 : n.userData.sweep;
      const to = n.userData.opening ? n.userData.sweep : 0;
      n.rotation.y = n.userData.baseRot + from + (to - from) * e;
      if (k >= 1) {
        this.scene.remove(n);
        act.splice(i, 1);
        this._doorSwingPool.push(n);
      }
    }
  }

  /* PHASE 16 — _generateFarmlandsDecor IS GONE.

     It scattered crops as THREE.Group scene objects (one unique PlaneGeometry AND one
     unique MeshLambertMaterial per stalk, at 22% of every column), tracked them per
     chunk in chunk.decorMeshes, and relied on disposeChunk to take them back down. That
     is survivable in a 64-chunk pocket and structurally impossible in an infinite world:
     a resident set of ~230 streamed chunks would carry roughly 13,000 live meshes and
     13,000 live materials, none of which batch and all of which are rebuilt from scratch
     every time a chunk streams back in.

     Crops are now shaped VOXELS written by _farmStampField (see the Phase 16 shaped
     vocabulary). They cost zero scene objects, zero materials and zero disposal code,
     they mesh into the chunk's existing single geometry, and they persist through
     editedChunks like every other block. The chunk.decorMeshes machinery in
     disposeChunk is deliberately left intact — the Overworld's flowers and tall grass
     still use it, and the Farmlands simply no longer put anything in it. */

  // Low-level write that touches chunk data only (no lighting/mesh side effects).
  // Used during world generation before the first mesh pass.
  _writeBlockRaw(wx, wy, wz, id) {
    if (wy < 0 || wy >= CHUNK_SY) return;
    const cx = Math.floor(wx / CHUNK_SX), cz = Math.floor(wz / CHUNK_SZ);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    const lx = ((wx % CHUNK_SX) + CHUNK_SX) % CHUNK_SX;
    const lz = ((wz % CHUNK_SZ) + CHUNK_SZ) % CHUNK_SZ;
    chunk.data[chunk.idx(lx, wy, lz)] = id;
    chunk.dirty = true;
    this.worldEdits++;      // PHASE 21 — see ItemEntity._stillSupported
    // PHASE 11 — this chunk's own blocks changed, so its cached light scan and its
    // baked skylight are both stale. Neighbour-seam remeshes set neither.
    chunk.lightScanDirty = true;
    chunk.skylightDirty = true;
  }

  getChunk(cx, cz) { return this.chunks.get(this.key(cx, cz)); }

  getBlockWorld(wx, wy, wz) {
    if (wy < 0 || wy >= CHUNK_SY) return BLOCK.AIR;
    const cx = Math.floor(wx / CHUNK_SX), cz = Math.floor(wz / CHUNK_SZ);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BLOCK.AIR;
    const lx = ((wx % CHUNK_SX) + CHUNK_SX) % CHUNK_SX;
    const lz = ((wz % CHUNK_SZ) + CHUNK_SZ) % CHUNK_SZ;
    return chunk.data[chunk.idx(lx, wy, lz)];
  }

  setBlockWorld(wx, wy, wz, id) {
    if (wy < 0 || wy >= CHUNK_SY) return;
    const cx = Math.floor(wx / CHUNK_SX), cz = Math.floor(wz / CHUNK_SZ);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    const lx = ((wx % CHUNK_SX) + CHUNK_SX) % CHUNK_SX;
    const lz = ((wz % CHUNK_SZ) + CHUNK_SZ) % CHUNK_SZ;
    chunk.set(lx, wy, lz, id);
    chunk.dirty = true;
    this.worldEdits++;      // PHASE 21 — see ItemEntity._stillSupported
    // PHASE 11 — this chunk's own blocks changed, so its cached light scan and baked
    // skylight are stale. A neighbour-seam remesh sets neither, which is the whole
    // point: seam remeshes then cost only the geometry rebuild.
    chunk.lightScanDirty = true;
    chunk.skylightDirty = true;

    // Record the edit so it survives this chunk being disposed and later re-streamed
    // back in (radial streaming regenerates terrain procedurally from the noise seed,
    // which on its own would silently undo any mining/building the player did here).
    const k = this.key(cx, cz);
    let edits = this.editedChunks.get(k);
    if (!edits) { edits = new Map(); this.editedChunks.set(k, edits); }
    edits.set(chunk.idx(lx, wy, lz), id);

    if (lx === 0) { const c = this.getChunk(cx - 1, cz); if (c) c.dirty = true; }
    if (lx === CHUNK_SX - 1) { const c = this.getChunk(cx + 1, cz); if (c) c.dirty = true; }
    if (lz === 0) { const c = this.getChunk(cx, cz - 1); if (c) c.dirty = true; }
    if (lz === CHUNK_SZ - 1) { const c = this.getChunk(cx, cz + 1); if (c) c.dirty = true; }

    // PHASE 4B — Lantern (steady #FFCC66 light, tracked apart from torchLights so
    // it's immune to the boss Darkness Aura) and Soul Anchor (glowing Sanity-decay
    // safe zone) each get their own add/remove lifecycle, mirroring the Torch one.
    // Placing any one of the three always clears the other two off this exact cell
    // first, so a block swap here never leaves a stale light/zone behind.
    if (id === BLOCK.TORCH) {
      this._addTorchLight(wx, wy, wz);
      this._removeLanternLight(wx, wy, wz);
      this._removeSoulAnchorZone(wx, wy, wz);
    } else if (id === BLOCK.LANTERN) {
      this._addLanternLight(wx, wy, wz);
      this._removeTorchLight(wx, wy, wz);
      this._removeSoulAnchorZone(wx, wy, wz);
    } else if (id === BLOCK.SOUL_ANCHOR) {
      this._addSoulAnchorZone(wx, wy, wz);
      this._removeTorchLight(wx, wy, wz);
      this._removeLanternLight(wx, wy, wz);
    } else if (id !== BLOCK.NETHER_PORTAL) {
      this._removeTorchLight(wx, wy, wz);
      this._removeLanternLight(wx, wy, wz);
      this._removeSoulAnchorZone(wx, wy, wz);
    }

    // PHASE 19 — every player edit inside the Farmlands wakes the local water. Placed
    // here rather than in destroyBlock so that PLACING a block dams water as readily as
    // breaking one releases it, and so nothing that edits the world can forget to.
    this._farmWaterNotify(wx, wy, wz);

    if (id === BLOCK.SAFEHOUSE_ANCHOR && this.anchorManager) {
      this.anchorManager.placeAnchor(wx, wy, wz);
      // STRUCTURE PINNING: the Anchor Monument chunk (like the Farmlands pocket) must
      // never be disposed by radial streaming — once placed it stays permanently
      // loaded so the safe-zone dome and its geometry are always there when the
      // player returns, however far they've roamed since.
      /* PHASE 35 — and it is remembered as OURS only if we are the ones who added it.
         A region core chunk is already pinned for its own reason; releasing that pin
         when the Anchor goes would let the streamer dispose a chunk another system is
         relying on. See releaseAnchorPin. */
      this._anchorPinKey = this.pinnedChunkKeys.has(k) ? null : k;
      this.pinnedChunkKeys.add(k);
    }
    if (id === BLOCK.NETHER_PORTAL) this._addPortalLight(wx, wy, wz);

    // A single edit only needs to relight/remesh the chunk(s) it touched (this one,
    // plus any neighbor whose border it landed on) — updateChunks()'s dirty sweep
    // picks these up on the very next frame. No whole-world relight pass anymore.
  }

  /* ---------------------------------------------------------------------------------
     VOXEL LIGHT PROPAGATION (per-chunk, streaming-friendly) — a global whole-world
     flood-fill grid doesn't work once the world streams radially around the player
     (the loaded footprint grows/shrinks and isn't bounded like the old fixed 5x5
     world was). Instead each chunk bakes its own local skylight column scan — full
     (15) straight down until the first opaque block, attenuating 1/block below it —
     recomputed only when that chunk is (re)generated or edited. This trades sideways
     light bleed (e.g. light creeping in from an open cave mouth to the side) for an
     O(chunk volume) bake with no whole-world array, which is what makes disposing
     far chunks and streaming new ones in actually cheap.
     --------------------------------------------------------------------------------- */
  _bakeChunkSkylight(chunk) {
    // PHASE 11 — skylight is a per-COLUMN property of this chunk alone, so a neighbour
    // streaming in cannot change it. Re-baking on every seam remesh was 16,384 wasted
    // iterations; the bake is now gated on the chunk's own blocks having changed.
    chunk.skylightDirty = false;
    /* PHASE 13 — LIGHT_PASSABLE generalises the old air/leaves/special test. Every
       legacy block resolves to exactly the same answer; it only adds the thin
       Suburbia props (rails, pickets, cables, gutters, mailboxes, planting) which
       would otherwise each drop a black column onto the lawn behind them. */
    const passable = (id) => LIGHT_PASSABLE[id] === 1;
    if (!chunk.skylight) chunk.skylight = new Uint8Array(CHUNK_SX * CHUNK_SY * CHUNK_SZ);
    const grid = chunk.skylight;
    for (let x = 0; x < CHUNK_SX; x++) {
      for (let z = 0; z < CHUNK_SZ; z++) {
        // BUGFIX: this used to decrement `light` by 1 on every single column step,
        // including open-sky air cells far above the terrain, so by the time the
        // scan reached the actual ground it had already fallen to 0 even under a
        // completely open sky — reading as "dark" outdoors in broad daylight and
        // driving the Sanity system's "-4/sec below light level 4" drain during the
        // day. Skylight must stay full (15) the whole way down until it actually
        // hits the first opaque block, and only attenuate 1/block *below* that.
        let light = 15;
        let underCover = false;
        for (let y = CHUNK_SY - 1; y >= 0; y--) {
          const id = chunk.data[chunk.idx(x, y, z)];
          if (underCover && light > 0) light -= 1;
          grid[chunk.idx(x, y, z)] = light;
          if (!passable(id)) underCover = true;
        }
      }
    }
  }

  // Samples the baked voxel light grid (0-15). Cells outside the tracked overworld
  // bounds default to full brightness, since those areas are lit by their own
  // ambient/point-light setup instead.
  getLightWorld(wx, wy, wz) {
    if (wy < 0 || wy >= CHUNK_SY) return 15;
    const chunk = this.getChunk(Math.floor(wx / CHUNK_SX), Math.floor(wz / CHUNK_SZ));
    if (!chunk || !chunk.skylight) return 15;
    const lx = ((wx % CHUNK_SX) + CHUNK_SX) % CHUNK_SX;
    const lz = ((wz % CHUNK_SZ) + CHUNK_SZ) % CHUNK_SZ;
    return chunk.skylight[chunk.idx(lx, wy, lz)];
  }

  // Straight line-of-sight check used by the Sanity system's Day Phase floor: true
  // only when every block above (wx, wy, wz) up to the build ceiling is open sky
  // (air, leaves, or a non-opaque special-render block like a torch/water surface).
  hasSkyAbove(wx, wy, wz) {
    const chunk = this.getChunk(Math.floor(wx / CHUNK_SX), Math.floor(wz / CHUNK_SZ));
    if (!chunk) return false;
    for (let y = Math.floor(wy) + 1; y < CHUNK_SY; y++) {
      if (LIGHT_PASSABLE[this.getBlockWorld(wx, y, wz)] !== 1) return false;
    }
    return true;
  }

  // TORCH DECAY ZONE — true wherever a planted torch should start burning down
  // instead of lasting forever: the Rotting Fields biome outright (its curse eats
  // the flame regardless of open sky), and anywhere else without open sky above
  // (caves, building interiors, and — since Black Canopy is deliberately NOT
  // sky-passable — the shaded floor of the Ashen Forest).
  isTorchDecayZone(wx, wy, wz) {
    if (farmlandsBiomeAt(wx, wz) === 'rotting') return true;
    return !this.hasSkyAbove(wx, wy, wz);
  }

  _addTorchLight(wx, wy, wz) {
    const k = wx + ',' + wy + ',' + wz;
    if (this.torchLights.has(k)) return;
    const light = new THREE.PointLight(0xffaa44, legacyLinear(2.0), 12, legacyLightDecay(2));
    light.position.set(wx + 0.5, wy + 0.72, wz + 0.5);
    this.scene.add(light);
    this.torchLights.set(k, light);

    const prop = buildTorchProp();
    prop.position.set(wx + 0.5, wy, wz + 0.5);
    this.scene.add(prop);
    this.torchProps.set(k, prop);

    // TORCH DECAY: start a burn-down timer for torches planted in a decay zone.
    // Guarded on "not already tracked" so a chunk unload/reload resync (which calls
    // this again for a torch that's still physically standing) never restarts an
    // in-progress burn — the fuel timer lives at the VoxelWorld level and survives
    // the chunk's own load/unload cycle.
    if (!this.torchDecay.has(k) && this.isTorchDecayZone(wx, wy, wz)) {
      this.torchDecay.set(k, { wx, wy, wz, fuel: TORCH_DECAY_SECONDS });
    }
  }
  /* Takes a light back down because its CHUNK unloaded, not because the block was
     destroyed. Identical to _removeTorchLight except the burn-down fuel is preserved,
     so a torch that streams back in resumes its timer instead of restarting it. */
  _unloadLightSource(wx, wy, wz) {
    const k = wx + ',' + wy + ',' + wz;
    const l = this.torchLights.get(k);
    if (l) { this.scene.remove(l); this.torchLights.delete(k); }
    const pk = 'p' + wx + ',' + wy + ',' + wz;
    const pl = this.torchLights.get(pk);
    if (pl) { this.scene.remove(pl); this.torchLights.delete(pk); }
    const p = this.torchProps.get(k);
    if (p) {
      this.scene.remove(p);
      p.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      this.torchProps.delete(k);
    }
  }

  _removeTorchLight(wx, wy, wz) {
    const k = wx + ',' + wy + ',' + wz;
    const l = this.torchLights.get(k);
    if (l) { this.scene.remove(l); this.torchLights.delete(k); }
    const p = this.torchProps.get(k);
    if (p) {
      this.scene.remove(p);
      p.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      this.torchProps.delete(k);
    }
    this.torchDecay.delete(k);
  }

  // PHASE 4B — LANTERN: steady 20-unit #FFCC66 light (intensity 3.0), no flicker
  // and no decay timer. Tracked in this.lanternLights rather than torchLights,
  // which is precisely what keeps it out of reach of the Hollowed Behemoth's
  // Darkness Aura (_darknessAura only ever iterates torchLights) — the block is
  // immune to boss darkness events by construction, not by a special-case check.
  _addLanternLight(wx, wy, wz) {
    const k = wx + ',' + wy + ',' + wz;
    if (this.lanternLights.has(k)) return;
    const light = new THREE.PointLight(0xFFCC66, legacyLinear(3.0), 20, legacyLightDecay(2));
    light.position.set(wx + 0.5, wy + 0.7, wz + 0.5);
    this.scene.add(light);
    this.lanternLights.set(k, light);

    const prop = buildLanternProp();
    prop.position.set(wx + 0.5, wy, wz + 0.5);
    this.scene.add(prop);
    this.lanternProps.set(k, prop);
  }
  _removeLanternLight(wx, wy, wz) {
    const k = wx + ',' + wy + ',' + wz;
    const l = this.lanternLights.get(k);
    if (l) { this.scene.remove(l); this.lanternLights.delete(k); }
    const p = this.lanternProps.get(k);
    if (p) {
      this.scene.remove(p);
      p.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      this.lanternProps.delete(k);
    }
  }

  // PHASE 4B — SOUL ANCHOR: opens a glowing 15-unit zone (from the block's exact
  // world-center) that halts Sanity decay — see SanitySystem.update's soulZone
  // check, which reads isInsideSoulAnchorZone below.
  _addSoulAnchorZone(wx, wy, wz) {
    const k = wx + ',' + wy + ',' + wz;
    if (this.soulAnchors.has(k)) return;
    const pos = new THREE.Vector3(wx + 0.5, wy + 0.5, wz + 0.5);
    const light = new THREE.PointLight(0x5be0c8, legacyLinear(1.4), 15, legacyLightDecay(1.5));
    light.position.copy(pos);
    this.scene.add(light);
    this.soulAnchors.set(k, { pos, light });

    const prop = buildSoulAnchorProp();
    prop.position.set(wx + 0.5, wy, wz + 0.5);
    this.scene.add(prop);
    this.soulAnchorProps.set(k, prop);
  }
  _removeSoulAnchorZone(wx, wy, wz) {
    const k = wx + ',' + wy + ',' + wz;
    const rec = this.soulAnchors.get(k);
    if (rec) { this.scene.remove(rec.light); this.soulAnchors.delete(k); }
    const p = this.soulAnchorProps.get(k);
    if (p) {
      this.scene.remove(p);
      p.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      this.soulAnchorProps.delete(k);
    }
  }
  isInsideSoulAnchorZone(pos) {
    for (const rec of this.soulAnchors.values()) {
      if (rec.pos.distanceTo(pos) <= 15) return true;
    }
    return false;
  }

  // PHASE 4B — Soul Anchor core pulse + Lantern stays perfectly steady (no call
  // needed for the Lantern here — its whole point is a light that does NOT flicker
  // or animate). Call once per frame alongside updateTorchFlicker.
  updateSoulAnchorPulse(t) {
    for (const rec of this.soulAnchors.values()) {
      const pulse = 0.9 + Math.sin(t * 1.6 + rec.pos.x) * 0.25;
      rec.light.intensity = legacyLinear(1.4 * pulse);   // D1 Phase 4: authored level
    }
    for (const prop of this.soulAnchorProps.values()) {
      const core = prop.userData.core;
      if (!core) continue;
      const n = Math.sin(t * 1.6 + prop.position.x) * 0.5 + 0.5;
      core.material.opacity = 0.6 + n * 0.35;
      core.rotation.y += 0.01;
    }
  }

  updateTorchFlicker(t) {
    for (const light of this.torchLights.values()) {
      const n = Math.sin(t * 9 + light.position.x) * 0.18 + Math.sin(t * 23 + light.position.z) * 0.1 + Math.sin(t * 31 + light.position.y) * 0.06;
      light.intensity = legacyLinear(1.85 + n * 1.4); // ~ +-15% noisy flicker on a punchier base (D1 Phase 4: authored level)
    }
    for (const prop of this.torchProps.values()) {
      const flame = prop.userData.flame;
      if (!flame) continue;
      const n = Math.sin(t * 14 + prop.position.x * 3) * 0.5 + Math.sin(t * 27 + prop.position.z * 3) * 0.5;
      const s = 1 + n * 0.12;
      flame.scale.set(s, 1 + n * 0.22, s);
      flame.material.opacity = 0.85 + n * 0.15;
    }
  }

  // TORCH DECAY — ticks every tracked torch's burn-down timer. Call AFTER
  // updateTorchFlicker each frame: in a torch's final TORCH_DECAY_DIM_SECONDS its
  // flame and point light are pulled from warm orange toward a dim blue ember here,
  // overriding whatever the flicker pass just wrote, before it gutters out entirely
  // (block reverts to Air) once fuel runs out.
  updateTorchDecay(dt) {
    if (this.torchDecay.size === 0) return;
    const DIM_COLOR = new THREE.Color(0x2f5fdc);
    const WARM_COLOR = new THREE.Color(0xffaa44);
    for (const rec of Array.from(this.torchDecay.values())) {
      rec.fuel -= dt;
      const k = rec.wx + ',' + rec.wy + ',' + rec.wz;
      if (rec.fuel <= 0) {
        // Best-effort block clear: only writes chunk data if that chunk is
        // currently loaded. Either way the light/prop are force-removed below so a
        // decayed torch never lingers lit.
        this.setBlockWorld(rec.wx, rec.wy, rec.wz, BLOCK.AIR);
        this._removeTorchLight(rec.wx, rec.wy, rec.wz);
        continue;
      }
      if (rec.fuel <= TORCH_DECAY_DIM_SECONDS) {
        const frac = rec.fuel / TORCH_DECAY_DIM_SECONDS; // 1 = dim phase just started, 0 = about to die
        const light = this.torchLights.get(k);
        if (light) {
          light.color.copy(DIM_COLOR).lerp(WARM_COLOR, frac * 0.4);
          light.intensity *= 0.3 + 0.4 * frac;
        }
        const prop = this.torchProps.get(k);
        if (prop) {
          if (prop.userData.flame) prop.userData.flame.material.color.copy(DIM_COLOR).lerp(new THREE.Color(0xffcf6b), frac);
          if (prop.userData.flameInner) prop.userData.flameInner.material.color.copy(new THREE.Color(0x6f8fff)).lerp(new THREE.Color(0xfff2c2), frac);
        }
      }
    }
  }

  // GEOMETRY MERGING & PERFORMANCE: every visible block face in the chunk is packed
  // directly into one shared positions/normals/uvs/colors buffer set (rather than
  // building N tiny per-face geometries and merging them with
  // BufferGeometryUtils.mergeGeometries), then submitted as a single indexed
  // THREE.BufferGeometry. That single geometry is what gives one draw call per
  // chunk — packing straight into one buffer is strictly cheaper than allocating a
  // geometry per face and merging afterward, so it reaches the same "one draw call
  // per chunk" goal without the extra allocation/merge pass.
  _buildChunkGeometry(chunk) {
    const positions = [], normals = [], uvs = [], colors = [];
    const tileW = 1 / this.atlas.tileCount;
    const nb = this._nbScratch || (this._nbScratch = new Int32Array(6));
    // Per-cell light cache, one slot per face. -1 = not yet sampled.
    const lcache = this._lightScratch || (this._lightScratch = new Int32Array(6));
    /* D1 PHASE 4 — the legacy transfer is a power law, so it distributes over the product a
       shade is built from: (face * light * boost)^2.2 = face^2.2 * light^2.2 * boost^2.2.
       The light factor has sixteen values and a cube face three, so both are tabulated once
       and no Math.pow runs per cube face. Identical to transferring the product, to rounding. */
    const shadeLin = this._legacyShadeLin || (this._legacyShadeLin = {
      light: Float64Array.from({ length: 16 }, (_, l) => legacyLinear(0.22 + 0.78 * (l / 15))),
      top: legacyLinear(1.0), bottom: legacyLinear(0.55), side: legacyLinear(0.78),
    });
    const lightLin = shadeLin.light;
    for (let x = 0; x < CHUNK_SX; x++) {
      for (let y = 0; y < CHUNK_SY; y++) {
        for (let z = 0; z < CHUNK_SZ; z++) {
          const id = chunk.data[chunk.idx(x, y, z)];
          if (id === BLOCK.AIR || SPECIAL_RENDER_BLOCKS.has(id)) continue;

          /* PHASE 13 — SHAPED BLOCK PASS. Everything the piece draws was flattened into
             a quad list at load, so this is a straight copy of pre-computed floats into
             the same shared buffer the cube path writes to. The chunk still resolves to
             ONE geometry and ONE draw call: shaped blocks add no material, no mesh and
             no second pass. */
          const boost = BLOCK_SHADE_BOOST[id];
          const boostLin = boost === 1 ? 1 : legacyLinear(boost);
          const shape = SHAPE_QUADS[id];
          if (shape !== null) {
            const wx = chunk.cx * CHUNK_SX + x, wz = chunk.cz * CHUNK_SZ + z;
            for (let f = 0; f < 6; f++) {
              const fn = FACES[f].n;
              nb[f] = chunk.get(x + fn[0], y + fn[1], z + fn[2]);
              lcache[f] = -1;
            }
            for (let qi = 0; qi < shape.length; qi++) {
              const q = shape[qi];
              if (q.cull >= 0 && shapeQuadHidden(id, q.cull, q.mask, nb[q.cull])) continue;
              /* Light is sampled from the cell the quad faces, using the dominant axis
                 of its normal — so a roof plane reads the open sky above it and an
                 interior partition reads the room it faces, exactly as a cube face does. */
              const n = q.n;
              const ax = n[0] < 0 ? -n[0] : n[0], ay = n[1] < 0 ? -n[1] : n[1], az = n[2] < 0 ? -n[2] : n[2];
              let lf;
              if (ay >= ax && ay >= az) lf = n[1] > 0 ? 2 : 3;
              else if (ax >= az) lf = n[0] > 0 ? 0 : 1;
              else lf = n[2] > 0 ? 4 : 5;
              let lightLevel = lcache[lf];
              if (lightLevel < 0) {
                const lfn = FACES[lf].n;
                lightLevel = Math.max(this.getLightWorld(wx + lfn[0], y + lfn[1], wz + lfn[2]), 8);
                lcache[lf] = lightLevel;
              }
              /* PHASE 14 — interior trim. BLOCK_SHADE_BOOST is 1 for every block outside
                 a Suburbia house, so this multiply changes nothing anywhere else. */
              /* D1 PHASE 4 — an Era 1 display-space shade, transferred to the linear level
                 that looks the same on the corrected renderer (src/shared/color-transfer.js). */
              const shade = legacyLinear(q.shade) * lightLin[lightLevel] * boostLin;
              const u0 = q.tile * tileW;
              const p = q.p, uv = q.uv;
              for (let c = 0; c < 4; c++) {
                positions.push(wx + p[c * 3], y + p[c * 3 + 1], wz + p[c * 3 + 2]);
                normals.push(n[0], n[1], n[2]);
                colors.push(shade, shade, shade);
                uvs.push(u0 + uv[c * 2] * tileW, uv[c * 2 + 1]);
              }
            }
            continue;
          }

          for (let fi = 0; fi < 6; fi++) {
            const face = FACES[fi];
            const nx = x + face.n[0], ny = y + face.n[1], nz = z + face.n[2];
            const neighbor = chunk.get(nx, ny, nz);
            /* PHASE 13 — generalised occlusion test. FACE_COVER is 0xFFFF for every
               ordinary opaque cube and 0 for air/glass/torch, so this is EXACTLY the
               old "neighbour is solid" rule for every legacy block — it only differs
               where a shaped neighbour covers part of a face, which is precisely the
               case the old rule got wrong. A flat typed-array index also costs less
               than the Set lookup it replaces. */
            if (FACE_COVER[neighbor * 6 + SHAPE_FACE_OPPOSITE[fi]] === 0xFFFF) continue;
            const wx = chunk.cx * CHUNK_SX + x, wz = chunk.cz * CHUNK_SZ + z;
            let shade = 1.0;
            if (face.top) shade = shadeLin.top; else if (face.bottom) shade = shadeLin.bottom; else shade = shadeLin.side;
            // Voxel light propagation: sample the baked skylight grid at the exposed
            // (neighbor) cell just outside this face and darken shaded/enclosed
            // pockets (caves, interiors) independently of the day/night sun.
            const rawLightLevel = this.getLightWorld(wx + face.n[0], y + face.n[1], wz + face.n[2]);
            // Hard minimum light floor (8/15) so shadowed pockets under tree canopies
            // and other partially-occluded outdoor surfaces never crush to pitch black
            // during Day Phase; deep caves/interiors still read as dim, not blind.
            const lightLevel = Math.max(rawLightLevel, 8);
            // D1 PHASE 4 — authored in display space as face * light * boost; each factor is
            // already transferred (see the table above), so their product is the linear shade.
            shade *= lightLin[lightLevel] * boostLin;
            for (const c of face.corners) {
              positions.push(wx + c[0], y + c[1], wz + c[2]);
              normals.push(face.n[0], face.n[1], face.n[2]);
              colors.push(shade, shade, shade);
            }
            let tileId = BLOCK_TILE[id];
            if (id === BLOCK.GRASS) {
              if (face.top) tileId = 0; // vibrant green grass top
              else if (face.bottom) tileId = BLOCK.DIRT - 1; // plain dirt underside
              else tileId = GRASS_SIDE_TILE; // dirt body with green trim
            }
            const u0 = tileId * tileW, u1 = u0 + tileW;
            uvs.push(u0, 0, u0, 1, u1, 1, u1, 0);
          }
        }
      }
    }
    const indices = [];
    const quadCount = positions.length / 3 / 4;
    for (let q = 0; q < quadCount; q++) {
      const a = q * 4;
      indices.push(a, a + 1, a + 2, a, a + 2, a + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    return geo;
  }

  /* PHASE 19 — TWO DEPTHS, ONE MESH, ONE MATERIAL.

     Shallow water renders at a third of a block and deep water at 0.88, so a pond
     visibly shelves: the rim sits low over its muddy bed and the middle sits high, which
     is the "visual surface level" requirement 29 asks depth to influence and the thing
     that tells a player at a glance where they can wade.

     THE COLOUR IS IN THE VERTICES, NOT IN A SECOND MATERIAL. Requirement 41 forbids
     per-cell objects and materials; a colour attribute costs three floats a vertex on
     geometry that already exists and keeps the whole dimension's water on ONE draw call
     per chunk with ONE shared material. Deep water is a near-black olive, shallow is
     silty brown — dirty drainage water and stagnant pond water, which is what
     requirement 36 asks for and about as far from Minecraft blue as the palette goes. */
  _buildWaterMesh(chunk) {
    const positions = [], normals = [], colors = [];
    /* D1 PHASE 4 — display colours, decoded to linear like every other colour input. */
    const DEEP = [0.115, 0.135, 0.105].map(srgbToLinear), SHAL = [0.215, 0.205, 0.145].map(srgbToLinear);
    for (let x = 0; x < CHUNK_SX; x++) {
      for (let y = 0; y < CHUNK_SY; y++) {
        for (let z = 0; z < CHUNK_SZ; z++) {
          const id = chunk.data[chunk.idx(x, y, z)];
          if (!isWaterId(id)) continue;
          const shallow = id === BLOCK.WATER_SHALLOW;
          for (const face of FACES) {
            const nx = x + face.n[0], ny = y + face.n[1], nz = z + face.n[2];
            const neighbor = chunk.get(nx, ny, nz);
            /* Only IDENTICAL water culls. Where shallow meets deep the deep cell must
               still draw its side face, or the 0.53-block difference in surface height
               shows as a hole straight through the water when seen from the bank. */
            if (neighbor === id) continue;
            if (neighbor !== BLOCK.AIR && !SPECIAL_RENDER_BLOCKS.has(neighbor)) continue;
            const wx = chunk.cx * CHUNK_SX + x, wz = chunk.cz * CHUNK_SZ + z;
            const surf = shallow ? 0.35 : 0.88;
            const yOff = face.top ? surf : 1.0;
            const col = shallow ? SHAL : DEEP;
            for (const c of face.corners) {
              // Side faces of a shallow cell must stop at its own surface too.
              const cy = face.top ? c[1] * yOff : Math.min(c[1], surf);
              positions.push(wx + c[0], y + cy, wz + c[2]);
              normals.push(face.n[0], face.n[1], face.n[2]);
              colors.push(col[0], col[1], col[2]);
            }
          }
        }
      }
    }
    if (positions.length === 0) return null;
    const indices = [];
    const quadCount = positions.length / 3 / 4;
    for (let q = 0; q < quadCount; q++) {
      const a = q * 4;
      indices.push(a, a + 1, a + 2, a, a + 2, a + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    return geo;
  }

  /* LEVEL 4 — HAVEN GLASS PASS (PHASE 5A PART 3).
     HAVEN_GLASS sits in SPECIAL_RENDER_BLOCKS, so _buildChunkGeometry skips it
     entirely AND treats it as see-through when deciding whether a neighboring solid
     face is visible — which is exactly the behavior a window needs, but it also
     means glass would render as literally nothing without a dedicated pass. This is
     that pass: same single-merged-buffer approach as the water mesh, emitted into
     its own transparent material so the bright blue outdoor light reads through the
     cabin walls.

     Glass-to-glass neighbor faces are skipped (like water-to-water) so a multi-block
     window is one clean pane rather than a stack of internal double surfaces, and
     HAVEN_BARRIER neighbors are skipped too — the barrier is invisible, so a glass
     face butted against it would otherwise show a floating pane edge in mid-air and
     give the fog wall away. */
  _buildGlassMesh(chunk) {
    const positions = [], normals = [];
    for (let x = 0; x < CHUNK_SX; x++) {
      for (let y = 0; y < CHUNK_SY; y++) {
        for (let z = 0; z < CHUNK_SZ; z++) {
          const id = chunk.data[chunk.idx(x, y, z)];
          /* PHASE 13 — shaped pieces may carry glass sub-boxes, which belong in this
             transparent pass rather than the opaque one. Nothing in the suburb uses it
             yet (its windows are dark reflective panes in the opaque pass, which is how
             a real house reads from outside under overcast), but the routing exists so
             a later phase can add a genuinely transparent pane without touching the
             mesher again. */
          const gshape = SHAPE_GLASS_QUADS[id];
          if (gshape !== null) {
            const gwx = chunk.cx * CHUNK_SX + x, gwz = chunk.cz * CHUNK_SZ + z;
            for (let qi = 0; qi < gshape.length; qi++) {
              const q = gshape[qi];
              if (q.cull >= 0) {
                const fn = FACES[q.cull].n;
                const nId = chunk.get(x + fn[0], y + fn[1], z + fn[2]);
                if (nId === id || nId === BLOCK.HAVEN_BARRIER) continue;
                if (FACE_COVER[nId * 6 + SHAPE_FACE_OPPOSITE[q.cull]] === 0xFFFF) continue;
              }
              const p = q.p, n = q.n;
              for (let c = 0; c < 4; c++) {
                positions.push(gwx + p[c * 3], y + p[c * 3 + 1], gwz + p[c * 3 + 2]);
                normals.push(n[0], n[1], n[2]);
              }
            }
            continue;
          }
          if (id !== BLOCK.HAVEN_GLASS) continue;
          for (const face of FACES) {
            const nx = x + face.n[0], ny = y + face.n[1], nz = z + face.n[2];
            const neighbor = chunk.get(nx, ny, nz);
            if (neighbor === BLOCK.HAVEN_GLASS || neighbor === BLOCK.HAVEN_BARRIER) continue;
            if (neighbor !== BLOCK.AIR && !SPECIAL_RENDER_BLOCKS.has(neighbor)) continue;
            const wx = chunk.cx * CHUNK_SX + x, wz = chunk.cz * CHUNK_SZ + z;
            for (const c of face.corners) {
              positions.push(wx + c[0], y + c[1], wz + c[2]);
              normals.push(face.n[0], face.n[1], face.n[2]);
            }
          }
        }
      }
    }
    if (positions.length === 0) return null;
    const indices = [];
    const quadCount = positions.length / 3 / 4;
    for (let q = 0; q < quadCount; q++) {
      const a = q * 4;
      indices.push(a, a + 1, a + 2, a, a + 2, a + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    return geo;
  }

  // Rebuilds (or first-builds) one chunk's render mesh: re-bakes its local skylight,
  // rebuilds the merged block geometry (_buildChunkGeometry — one draw call) and the
  // separate transparent water geometry, swaps them into the scene, and re-syncs any
  // torch/portal point lights the chunk contains. Called by updateChunks() both for
  // newly-streamed-in chunks and for chunks an edit (or a neighbor streaming in)
  // marked dirty — never for the whole loaded set at once.
  generateChunkMesh(chunk) {
    if (!this.waterMaterial) {
      /* PHASE 19 — the water material. White base with the real colour carried per
         vertex (see _buildWaterMesh), higher opacity than the old bright blue because
         stagnant farm water is not something you see the bottom of, and emissive left
         at zero so water is never a light source in a dimension whose whole horror
         economy is built on darkness. */
      this.waterMaterial = new THREE.MeshLambertMaterial({
        color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.82,
        side: THREE.DoubleSide, depthWrite: false
      });
    }
    // LEVEL 4 — shared Haven Glass material: a pale, highly transmissive pane with a
    // faint blue cast. depthWrite is off (like the water material) so whatever sits
    // behind the window still composites correctly through it.
    if (!this.glassMaterial) {
      this.glassMaterial = new THREE.MeshLambertMaterial({
        color: 0xdff0ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide,
        depthWrite: false, emissive: 0x9fd4ff, emissiveIntensity: 0.35
      });
    }
    if (chunk.skylightDirty !== false || !chunk.skylight) this._bakeChunkSkylight(chunk);
    if (chunk.mesh) { this.scene.remove(chunk.mesh); chunk.mesh.geometry.dispose(); }
    if (chunk.waterMesh) { this.scene.remove(chunk.waterMesh); chunk.waterMesh.geometry.dispose(); chunk.waterMesh = null; }
    if (chunk.glassMesh) { this.scene.remove(chunk.glassMesh); chunk.glassMesh.geometry.dispose(); chunk.glassMesh = null; }

    const geo = this._buildChunkGeometry(chunk);
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);
    chunk.mesh = mesh;

    const waterGeo = this._buildWaterMesh(chunk);
    if (waterGeo) {
      const waterMesh = new THREE.Mesh(waterGeo, this.waterMaterial);
      this.scene.add(waterMesh);
      chunk.waterMesh = waterMesh;
    }

    const glassGeo = this._buildGlassMesh(chunk);
    if (glassGeo) {
      const glassMesh = new THREE.Mesh(glassGeo, this.glassMaterial);
      this.scene.add(glassMesh);
      chunk.glassMesh = glassMesh;
    }

    chunk.dirty = false;

    /* PHASE 11 — LIGHT-SOURCE SCAN, CACHED.
       This used to be an unconditional 16x64x16 = 16,384-iteration triple loop run on
       EVERY remesh, including the seam remeshes a neighbour streaming in triggers. The
       set of light-emitting blocks in a chunk only changes when the chunk's blocks
       change, so it is now scanned once and cached; a neighbour-seam remesh reuses the
       cached list and pays nothing. The positions are also retained so disposeChunk()
       can take these lights back down again (see below). */
    if (!chunk.lightSources || chunk.lightScanDirty) {
      const found = [];
      for (let x = 0; x < CHUNK_SX; x++) for (let y = 0; y < CHUNK_SY; y++) for (let z = 0; z < CHUNK_SZ; z++) {
        const bid = chunk.data[chunk.idx(x, y, z)];
        if (bid === BLOCK.TORCH || bid === BLOCK.NETHER_PORTAL) {
          found.push([chunk.cx * CHUNK_SX + x, y, chunk.cz * CHUNK_SZ + z, bid]);
        }
      }
      chunk.lightSources = found;
      chunk.lightScanDirty = false;
    }
    for (const [wx, wy, wz, bid] of chunk.lightSources) {
      if (bid === BLOCK.TORCH) this._addTorchLight(wx, wy, wz);
      else this._addPortalLight(wx, wy, wz);
    }
  }

  _addPortalLight(wx, wy, wz) {
    const k = 'p' + wx + ',' + wy + ',' + wz;
    if (this.torchLights.has(k)) return;
    const light = new THREE.PointLight(0x9a3dff, legacyLinear(1.6), 12, legacyLightDecay(2));
    light.position.set(wx + 0.5, wy + 0.5, wz + 0.5);
    this.scene.add(light);
    this.torchLights.set(k, light);
  }

  destroyBlock(wx, wy, wz, soundEngine, willDrop) {
    const id = this.getBlockWorld(wx, wy, wz);
    if (id === BLOCK.AIR) return null;
    this.setBlockWorld(wx, wy, wz, BLOCK.AIR);
    if (soundEngine) soundEngine.playBlockBreak(id);

    // Blocks that require a Pickaxe drop nothing at all if broken without one.
    if (willDrop === false) return id;

    const centerPos = new THREE.Vector3(wx + 0.5, wy + 0.5, wz + 0.5);

    if (id === BLOCK.SAFEHOUSE_ANCHOR && this.anchorManager) {
      /* PHASE 36 — A POWERED ANCHOR HANDS ITS DISK BACK.

         Feeding a Rift Core Disk to the monument consumes it. The monument is a block
         with three seconds of hardness and no tool requirement, and the whole run has
         taught the player that the left button is how you find out what a block is. One
         click on the thing that has just lit up therefore destroyed the rift AND the only
         key that could ever open it, in one gesture, with nothing said and nothing to
         undo. There are exactly three Cores in the game (STORY.md section 9) and no
         second source of any of them: that click ended the run.

         REFUSING THE BREAK WOULD HAVE BEEN AN INVISIBLE WALL, which section 65 rules out.
         Giving the Disk back is the honest answer and needs no rule explained: it is
         inside the monument, so taking the monument apart returns it, and the player can
         raise the Anchor again anywhere and feed it again. Nothing else about the
         interaction changes, and an unpowered Anchor is untouched by this. */
      const spent = this.anchorManager.riftActive
        ? (this.anchorManager.riftTargetLevel === 3 ? ITEM.CORE_DISK_L2 : ITEM.CORE_DISK)
        : null;
      if (spent !== null) this.itemManager.spawnDrop(spent, 1, centerPos);
      this.anchorManager.removeAnchor();
    }
    if (id === BLOCK.OAK_LOG) {
      this.itemManager.spawnDrop(ITEM.OAK_LOG, 1, centerPos);
    } else if (id === BLOCK.ASH_WOOD) {
      // PHASE 35 — see ITEM_DATA[ITEM.ASH_LOG]. This line is the whole fix for it.
      this.itemManager.spawnDrop(ITEM.ASH_LOG, 1, centerPos);
    } else if (id === BLOCK.LEAVES) {
      this.itemManager.spawnDrop(Math.random() < 0.5 ? ITEM.SAPLING : ITEM.STICK, 1, centerPos);
    } else if (id === BLOCK.GRASS) {
      this.itemManager.spawnDrop(ITEM.SEED, 1, centerPos);
    } else if (id === BLOCK.STONE || id === BLOCK.ANDESITE || id === BLOCK.GRANITE) {
      this.itemManager.spawnDrop(ITEM.COBBLESTONE, 1, centerPos);
    } else if (id === BLOCK.COAL_ORE) {
      this.itemManager.spawnDrop(ITEM.COAL, 1, centerPos);
    } else if (id === BLOCK.TORCH) {
      this.itemManager.spawnDrop(ITEM.TORCH, 1, centerPos);
    } else if (id === BLOCK.DIRT) {
      this.itemManager.spawnDrop(ITEM.DIRT, 1, centerPos);
    } else if (id === BLOCK.SAFEHOUSE_ANCHOR) {
      this.itemManager.spawnDrop(ITEM.SAFEHOUSE_ANCHOR, 1, centerPos);
    } else if (id === BLOCK.IRON_ORE) {
      this.itemManager.spawnDrop(ITEM.IRON_ORE, 1, centerPos);
    } else if (id === BLOCK.OBSIDIAN) {
      this.itemManager.spawnDrop(ITEM.OBSIDIAN, 1, centerPos);
    } else if (id === BLOCK.CORRUPTED_STONE) {
      this.itemManager.spawnDrop(ITEM.CORRUPTED_STONE_ITEM, 1, centerPos);
    } else if (id === BLOCK.LANTERN) {
      this.itemManager.spawnDrop(ITEM.LANTERN, 1, centerPos);
    } else if (id === BLOCK.SOUL_ANCHOR) {
      this.itemManager.spawnDrop(ITEM.SOUL_ANCHOR, 1, centerPos);
    } else if (id === BLOCK.NETHER_ORE) {
      this.itemManager.spawnDrop(ITEM.NETHER_ORE, 1, centerPos);
    } else if (id === BLOCK.NETHER_PORTAL) {
      this.itemManager.spawnDrop(ITEM.DIMENSIONAL_PORTAL, 1, centerPos);
      this._removeTorchLight(wx, wy, wz);
      const k = 'p' + wx + ',' + wy + ',' + wz;
      const l = this.torchLights.get(k);
      if (l) { this.scene.remove(l); this.torchLights.delete(k); }
    } else if (id === BLOCK.NETHERRACK || id === BLOCK.BLOODSTONE) {
      this.itemManager.spawnDrop(ITEM.COBBLESTONE, 1, centerPos);
    }
    return id;
  }

  // Cracks an Ancient Chest open for a one-time loot haul. Returns the list of
  // { item, count } drops granted, or null if this chest was already looted / invalid.
  openChest(wx, wy, wz, soundEngine) {
    const key = wx + ',' + wy + ',' + wz;
    if (this.openedChests.has(key)) return null;
    if (this.getBlockWorld(wx, wy, wz) !== BLOCK.TREASURE_CHEST) return null;
    this.openedChests.add(key);
    this.setBlockWorld(wx, wy, wz, BLOCK.AIR);
    if (soundEngine) soundEngine.playChestOpen();

    const centerPos = new THREE.Vector3(wx + 0.5, wy + 0.7, wz + 0.5);

    // THE DISCONNECTED HOME — this specific chest always grants the Level 2 Rift
    // Core Disk (guaranteed, not rolled from the random pool): the key that powers
    // an Anchor Monument's Level 3 rift once fed to it while inside the Farmlands.
    if (this.homeChestKey && key === this.homeChestKey) {
      this.itemManager.spawnDrop(ITEM.CORE_DISK_L2, 1, centerPos);
      return [{ item: ITEM.CORE_DISK_L2, count: 1 }];
    }

    // THE DISCONNECTED HOME (LEVEL 3) — PHASE 5A PART 2: this specific chest
    // always grants the guaranteed Level 3 Rift Core Disk instead of rolling the
    // normal random loot table.
    if (this.level3HomeChestKey && key === this.level3HomeChestKey) {
      this.itemManager.spawnDrop(ITEM.CORE_DISK_L3, 1, centerPos);
      return [{ item: ITEM.CORE_DISK_L3, count: 1 }];
    }

    const pool = CHEST_LOOT_OVERWORLD;
    const rolls = 3 + Math.floor(Math.random() * 3); // 3-5 loot rolls per chest
    const granted = [];
    for (let i = 0; i < rolls; i++) {
      const entry = rollChestLoot(pool);
      const count = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
      this.itemManager.spawnDrop(entry.item, count, centerPos);
      granted.push({ item: entry.item, count });
    }
    return granted;
  }

  placeBlock(wx, wy, wz, blockId, playerAabb, soundEngine) {
    const target = { minX: wx, maxX: wx + 1, minY: wy, maxY: wy + 1, minZ: wz, maxZ: wz + 1 };
    if (aabbIntersect(target, playerAabb)) return false;
    if (this.getBlockWorld(wx, wy, wz) !== BLOCK.AIR) return false;

    // LEVEL 3 — STATIC SUBURBIA TORCH DECAY (PHASE 5A PART 2): standard Torches
    // cannot hold a flame anywhere inside the Suburbia pocket — placing one
    // disintegrates it immediately (setBlockWorld is never called, so the block
    // never actually appears and _addTorchLight never fires — guaranteeing zero
    // light output) with a harsh static-noise cue instead of the normal placement
    // clack, rather than the slow multi-minute burn-down every other decay zone uses.
    if (blockId === BLOCK.TORCH && isStaticSuburbiaWorldPos(wx, wz)) {
      if (soundEngine) soundEngine.playTorchFizzle();
      return true; // item is still consumed — it crumbled to static in the player's hand
    }

    this.setBlockWorld(wx, wy, wz, blockId);
    if (soundEngine) soundEngine.playBlockPlace();
    return true;
  }

  isSolid(wx, wy, wz) {
    const id = this.getBlockWorld(wx, wy, wz);
    // PHASE 19 — shallow water is water. Every one of these tests was a place a
    // one-block puddle would otherwise have behaved like a block of stone.
    return id !== BLOCK.AIR && id !== BLOCK.TORCH && !isWaterId(id) && id !== BLOCK.NETHER_PORTAL;
  }

  /* PHASE 13 — PRECISE BODY COLLISION. isSolid() above is unchanged and still answers
     "is there a block here" for mining, targeting, mob steering and light. This is the
     separate question a moving body actually asks: "does the geometry in this cell
     overlap my box". For every full cube the two are identical, so nothing outside
     Suburbia changes by a single unit; inside it, a kerb becomes a step you walk up,
     a railing stops you at the waist, and a gutter is something you walk through. */
  collidesAABB(aabb) {
    const minX = Math.floor(aabb.minX), maxX = Math.floor(aabb.maxX - 1e-6);
    const minY = Math.floor(aabb.minY), maxY = Math.floor(aabb.maxY - 1e-6);
    const minZ = Math.floor(aabb.minZ), maxZ = Math.floor(aabb.maxZ - 1e-6);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const id = this.getBlockWorld(x, y, z);
          if (id === BLOCK.AIR || id === BLOCK.TORCH || isWaterId(id) || id === BLOCK.NETHER_PORTAL) continue;
          if (cellBlocksAABB(id, x, y, z, aabb.minX, aabb.minY, aabb.minZ, aabb.maxX, aabb.maxY, aabb.maxZ)) return true;
        }
      }
    }
    return false;
  }

  isWater(wx, wy, wz) {
    return isWaterId(this.getBlockWorld(wx, wy, wz));
  }
  // PHASE 19 — 0 dry, 1 wadeable, 2 swimmable. The player controller reads this rather
  // than comparing block ids, so depth behaviour lives in one place.
  waterLevelAt(wx, wy, wz) {
    const id = this.getBlockWorld(wx, wy, wz);
    return id === BLOCK.WATER ? 2 : (id === BLOCK.WATER_SHALLOW ? 1 : 0);
  }
  // Surface motion: ONE opacity nudge on ONE shared material per frame. Water in this
  // dimension should look like it is barely moving, because it is barely moving.
  updateWaterSurface(t) {
    if (!this.waterMaterial) return;
    this.waterMaterial.opacity = 0.82 + Math.sin(t * 0.6) * 0.05;
  }

  findSpawnHeight(wx, wz) {
    for (let y = CHUNK_SY - 1; y > 0; y--) {
      if (this.isSolid(wx, y, wz)) return y + 1;
    }
    return 40;
  }
}
