"use strict";
/* =====================================================================================
   THE HAVEN — ITS LIFECYCLE IN THE WORLD
   ERA 1.5.3 — MOVED VERBATIM OUT OF VoxelWorld.

   Building the pocket, tearing it down, the fog wall, the fire particles, the light
   level and the one committed anomaly.

   NOTHING ABOUT THE HAVEN'S TIMING OR STORY IS HERE OR CHANGED. HAVEN_STAGES, the
   dissolve and the shift belong to the sequence in game.html; this is only the world
   side. CLAUDE.md section 58 still governs every rule about what the Haven may do.

   Every method below is byte-identical to the text that was in game.html, comments and
   all. It is attached to VoxelWorld's prototype by registerWorldContent, which copies
   property descriptors so a moved method is indistinguishable from a declared one.
   See src/world/world-content.js and ARCHITECTURE.md.
   ===================================================================================== */

registerWorldContent('haven', 'generation', class {

  /* =================================================================================
     PHASE 32 — PUT THE POCKET BACK.

     THE BUG THIS EXISTS TO FIX, because it is worth writing down. `generateFakeHaven()`
     is one-shot on `fakeHavenBuilt`, and nothing ever set that flag back. A New Game (or
     a Load) runs `wipeAllChunks()`, which disposes the Haven's nine chunks and clears the
     pin registry — but left the flag true and left every prop in the scene. So:

       - a player who visited the Haven, started a new run and reached it again arrived in
         an EMPTY pocket: no ground, no cabin, nothing, because generateFakeHaven() saw
         the flag and returned the stale spawn without building anything;
       - and until then, the bed, the storage chest, the hearth fire, six warm lights and
         the whole fog-wall ring were still sitting in the scene at x/z ~6168, in the
         middle of the new run's Overworld.

     The brief's replay-behaviour requirement is exactly this: the Haven must not retain
     stale transient state between unrelated new games. So this undoes everything
     generateFakeHaven() did — flags, props, lights, particles, the fog ring and the
     storage — and _teardownForRestore calls it, which is the ONE path both a New Game and
     a Load pass through.

     It does NOT dispose the chunks: wipeAllChunks() owns those and calling it from here
     would be two systems disposing the same objects. Safe to call when no Haven was ever
     built, which is the common case — it returns on the first line. */
  _resetHavenPocket() {
    if (!this.fakeHavenBuilt && !this.havenBedGroup && !this.havenFogWall) return false;

    if (this.havenFire) {
      this.scene.remove(this.havenFire.points);
      this.havenFire.geo.dispose();
      this.havenFire.points.material.dispose();
      this.havenFire = null;
    }
    this.havenFirePos = null;
    if (this.havenFireLight) { this.scene.remove(this.havenFireLight); this.havenFireLight = null; }
    if (this.havenCozyLight) { this.scene.remove(this.havenCozyLight); this.havenCozyLight = null; }
    if (this.havenWarmLights) {
      for (const l of this.havenWarmLights) this.scene.remove(l);
      this.havenWarmLights.length = 0;
    }
    for (const key of ['havenBedGroup', 'havenChestGroup']) {
      const g = this[key];
      if (!g) continue;
      this.scene.remove(g);
      g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      this[key] = null;
    }
    /* The fog ring is a group of sprites, each with its own material. corruptHaven only
       ever RECOLOURED them, because the Haven it was collapsing was about to be replaced
       by the credits; a reset has to actually take them down. */
    if (this.havenFogWall) {
      this.scene.remove(this.havenFogWall);
      for (const sprite of this.havenFogWall.children.slice()) {
        if (sprite.material) sprite.material.dispose();
      }
      this.havenFogWall = null;
    }

    this.fakeHavenBuilt = false;
    this.fakeHavenActive = false;
    this.fakeHavenSpawn = null;
    this.havenCorrupted = false;
    this.havenAnomalyArmed = null;
    if (this.havenAnomalyDone) this.havenAnomalyDone.clear();
    this._havenAnomalyTick = 0;
    this._havenLightLevel = 1;
    /* The cabin's storage chest is a real 27-slot container. It is not saved, so anything
       in it belongs to the run that put it there and must not be waiting in a new one. */
    this.havenStorage = Array(27).fill(null).map(() => ({ item: ITEM.NONE, count: 0 }));
    return true;
  }

  /* PHASE 10 — every warm light the Haven adds is registered here so corruptHaven()
     can extinguish the whole set generically. Adding another lamp later requires no
     change to the collapse path at all. */
  _havenAddLight(color, intensity, distance, x, y, z) {
    const l = new THREE.PointLight(color, legacyLinear(intensity), distance, legacyLightDecay(2));
    /* PHASE 32 — the light the dissolve ramps DOWN FROM. Kept on the light itself rather
       than in a parallel array, so a lamp added later is carried by setHavenLightLevel
       without touching it — the same reason the list exists at all. */
    l.userData.baseIntensity = legacyLinear(intensity);   // D1 Phase 4: the transferred level; the dissolve scales it linearly
    l.position.set(x, y, z);
    this.scene.add(l);
    if (!this.havenWarmLights) this.havenWarmLights = [];
    this.havenWarmLights.push(l);
    return l;
  }

  // Additive point-cloud flames for the cabin hearth. Each particle rises from the
  // firebox, drifts slightly, fades as it climbs, then respawns at the base — giving
  // a continuously burning fire for effectively free (one draw call, no per-particle
  // objects).
  /* PHASE 32 — THE LIGHT GOING OUT.

     `frac` is 1 for the whole intact Haven and ramps to 0 across the dissolution. It
     reaches every warm source in the cabin — the sconces, the table lamp, the rug bounce,
     the interior fill and the hearth — through the registry _havenAddLight already keeps,
     so the room dims as one thing rather than in pieces.

     WHY THIS AND NOT JUST THE SUN. The environment's dissolve already takes the sun and
     the ambient down, but a cabin at night is lit by its own lamps: without this the
     windows went grey while the inside stayed golden, which reads as weather rather than
     as the place being removed. And it pairs with the audio, deliberately and in this
     order: the hearth stops SOUNDING one stage before it stops GLOWING. The fire is still
     visibly burning in a room that has gone quiet, and only then does it start to go out.

     Idempotent and cheap: a handful of float writes, skipped entirely when nothing has
     been built. The fire's own flicker in updateFakeHaven multiplies against the level
     set here rather than fighting it — see the reference it takes. */
  setHavenLightLevel(frac) {
    const f = Math.max(0, Math.min(1, (typeof frac === 'number' && isFinite(frac)) ? frac : 1));
    if (this._havenLightLevel === f) return false;
    this._havenLightLevel = f;
    if (this.havenWarmLights) {
      for (const l of this.havenWarmLights) {
        const base = (l.userData && l.userData.baseIntensity) || 0;
        l.intensity = base * f;
      }
    }
    if (this.havenCozyLight) this.havenCozyLight.intensity = legacyLinear(1.1) * f;
    return true;
  }

  _buildHavenFireParticles() {
    const count = 90;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      seeds[i] = Math.random();
      pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = 0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffb347, size: 0.16, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this.havenFire = { points, geo, seeds, count, t: 0 };
  }

  // Called once per frame while the player is in the Haven: advances the flame
  // particles and gives the hearth light a gentle, non-threatening flicker (a slow
  // double-sine, deliberately unlike the erratic horror torch flicker).
  /* =================================================================================
     PHASE 32 — THE HAVEN'S ONE COMMITTED CHANGE.

     A second mug appears on the mantel: the same block id as the one already left out on
     the low table, in the one place a mug would obviously be put down.

     THE RULE THIS EXISTS TO OBEY. STORY.md section 16 rule 1 — nothing changes while it
     is being watched — is the load-bearing premise of the entire game, and the Haven is
     the last place it may be broken, because the Haven's whole pitch is that it is the
     one honest room in the world. So the commit is gated exactly the way Suburbia's
     revisions are: the hearth must be out of shot AND far enough away that the player
     could not resolve the shelf even peripherally. If they never turn their back on the
     fireplace during the noticing stage, the mug never appears, and that is a correct
     outcome rather than a missed one.

     It is armed by the stage machine (Game._updateHaven) and disarmed by the commit, so
     it can happen at most once per visit. There is no timer, no listener and no
     geometry: it writes one voxel and remeshes the chunk that holds it.

     `armed` is the event id rather than a boolean so that a second Haven anomaly, if a
     later phase ever earns one, needs no new plumbing here. */
  armHavenAnomaly(id) {
    if (!this.fakeHavenBuilt || this.havenCorrupted) return false;
    if (this.havenAnomalyDone && this.havenAnomalyDone.has(id)) return false;
    this.havenAnomalyArmed = id || null;
    return true;
  }

  updateFakeHaven(dt) {
    // PHASE 5B — once the illusion collapses the hearth is gone entirely; havenFire is
    // nulled by corruptHaven(), so this returns immediately from then on.
    if (!this.havenFire || !this.havenFirePos) return;
    const f = this.havenFire;
    f.t += dt;
    const arr = f.geo.attributes.position.array;
    const base = this.havenFirePos;
    for (let i = 0; i < f.count; i++) {
      // Each particle runs its own 0-1 lifetime phase, offset by its seed.
      const phase = (f.t * 0.85 + f.seeds[i]) % 1;
      const rise = phase * 1.5;
      const spread = (1 - phase) * 0.26;
      const ang = f.seeds[i] * Math.PI * 2 + f.t * 1.6;
      arr[i * 3] = base.x + Math.cos(ang) * spread;
      arr[i * 3 + 1] = base.y + rise;
      arr[i * 3 + 2] = base.z + Math.sin(ang) * spread * 0.6;
    }
    f.geo.attributes.position.needsUpdate = true;
    f.points.material.opacity = 0.75 + Math.sin(f.t * 3.1) * 0.12;

    if (this.havenFireLight) {
      /* PHASE 32 — the flicker is now a MULTIPLIER on the dissolve's level rather than an
         absolute value. Written absolutely it re-lit the hearth to full every single
         frame and the fire alone stayed golden while the whole room around it went out. */
      const level = (this._havenLightLevel === undefined) ? 1 : this._havenLightLevel;
      this.havenFireLight.intensity =
        legacyLinear(2.2 + Math.sin(f.t * 2.3) * 0.25 + Math.sin(f.t * 5.7) * 0.12) * level;
    }
  }

  /* =================================================================================
     PHASE 33 — TAKE THE HAVEN AWAY BEFORE THE FINALE STANDS UP.

     THE BUG THIS FIXES, AND HOW IT WAS FOUND. The first browser capture of the last beat
     came back as a wall of dark red voxels a metre from the camera. The player was still
     standing INSIDE the cabin: `corruptHaven()` decays the Haven in place rather than
     removing it, which was right for the old ending — that finale happened in the ruins,
     with an eight-metre object hanging over them. This one needs three hundred and twenty
     metres of clear sightline, and it was looking at the inside of a rotting wall.

     It is also, separately, what the story asks for. STORY.md section 18: the Haven RUNS
     OUT. A cabin that rots around the player is a cabin that turned on them; a cabin that
     is simply not there any more is the thing the whole of Phase 32 was building toward.

     WHY NOT `_resetHavenPocket()`. That is the New Game path and it clears
     `fakeHavenActive`, which would switch chunk streaming back on — and the finale stands
     at x/z ~6144, so the streamer would immediately begin generating Overworld terrain
     underneath it. This disposes the geometry and leaves the streaming lock alone.

     The player does not fall: `movementLocked` skips physics entirely, and the finale's
     ground plane is placed at their feet. */
  clearHavenForFinale() {
    if (!this.fakeHavenBuilt) return false;
    /* THE PINS COME OFF FIRST, and the order matters: `disposeChunk` returns early for a
       pinned chunk, and the Haven pocket's nine are all pinned — pinning is what stops
       the streamer unloading the cabin out from under the player. Disposing before
       unpinning silently did nothing, which is exactly the shape of bug the sightline
       assertion in tests/finale.js exists to catch. `wipeAllChunks` unpins first for the
       same reason. */
    this.pinnedChunkKeys.clear();
    for (const chunk of Array.from(this.chunks.values())) this.disposeChunk(chunk);
    this._genQueue.length = 0;
    this._queuedKeys.clear();
    /* The warm fog ring is the last of the illusion still in the scene — corruptHaven
       only recoloured it, because the old ending kept it as a red box around the ruins.
       Here it would be a wall of haze between the player and the thing they are meant to
       be looking at. */
    if (this.havenFogWall) {
      this.scene.remove(this.havenFogWall);
      for (const sprite of this.havenFogWall.children.slice()) {
        if (sprite.material) sprite.material.dispose();
      }
      this.havenFogWall = null;
    }
    if (this.havenFire) {
      this.scene.remove(this.havenFire.points);
      this.havenFire.geo.dispose();
      this.havenFire.points.material.dispose();
      this.havenFire = null;
    }
    for (const key of ['havenFireLight', 'havenCozyLight']) {
      if (this[key]) { this.scene.remove(this[key]); this[key] = null; }
    }
    if (this.havenWarmLights) {
      for (const l of this.havenWarmLights) this.scene.remove(l);
      this.havenWarmLights.length = 0;
    }
    /* THE SCONCES. The cabin's two wall torches are VOXELS, so each one registered a
       point light and a prop mesh in the world's own position-keyed registries — which
       are not per-chunk and which `disposeChunk` therefore does not reach. A probe of the
       live scene during the scale beat found both of them still burning at head height in
       the middle of an empty plain, three hundred metres from anything: two small orange
       lights in the one shot in the game that is meant to have no light in it at all.
       `wipeAllChunks` clears these two maps for exactly the same reason. */
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
    return true;
  }

  // Ring of warm billboard puffs hugging the inside face of the invisible barrier.
  _buildHavenFogWall(cX, cZ, baseY, R) {
    const tex = _makeCloudSprite();
    const group = new THREE.Group();
    const inset = R - 0.5;
    // Walk the perimeter, dropping overlapping puffs at two heights so the wall
    // reads as a solid bank of haze rather than a dotted line of clouds.
    for (let t = -inset; t <= inset; t += 2.2) {
      const edges = [
        [cX + t, cZ - inset], [cX + t, cZ + inset],
        [cX - inset, cZ + t], [cX + inset, cZ + t]
      ];
      for (const [px, pz] of edges) {
        for (const hy of [baseY + 1.5, baseY + 5.0, baseY + 8.5]) {
          const mat = new THREE.SpriteMaterial({
            map: tex, transparent: true, opacity: 0.5, depthWrite: false,
            color: 0xffe9c9 // warm, sunlit haze
          });
          const sprite = new THREE.Sprite(mat);
          const s = 9 + Math.random() * 6;
          sprite.scale.set(s, s * 0.8, 1);
          sprite.position.set(px + (Math.random() - 0.5) * 1.5, hy + (Math.random() - 0.5) * 1.5, pz + (Math.random() - 0.5) * 1.5);
          group.add(sprite);
        }
      }
    }
    this.scene.add(group);
    this.havenFogWall = group;
  }
});
