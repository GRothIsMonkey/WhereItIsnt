"use strict";
/* =====================================================================================
   DEVELOPER CONSOLE — DIMENSION TELEPORTS AND AUDIO DIAGNOSTICS
   ERA 1.5.4 — EXTRACTED VERBATIM FROM game.html.

   Developer-only and self-contained. Nothing here runs unless a command is typed into
   the console. Its own header calls it removable: it now removes by deleting one file
   and one <script> tag, which is easier than it was inside the monolith.

   This is a CLASSIC script, not an ES module. It shares one global lexical scope with
   every other file in src/ and with game.html's inline <script>, which is why the move
   needed no code change. Load order is declared in game.html and mirrored by
   tests/harness/load.js; see ARCHITECTURE.md.
   ===================================================================================== */

/* =====================================================================================
   DEV TOOLS — DIMENSION TELEPORTS (TEMPORARY, REMOVABLE)

   Everything in this section is developer-only and self-contained: deleting the whole
   block removes the feature with no other edit required. Nothing here runs unless a
   command is typed into the console — no hooks are installed into the frame loop, no
   production behaviour changes, and no state is touched at load time.

   DESIGN RULE: reuse, don't reimplement. Each teleport drives the SAME region
   generators, entity teardown, environment overrides and audio switches the real
   transitions use. Where the real transition is a cinematic (the Fake Haven's
   fade-to-white and its one-shot progression latch), the dev tool performs the same
   world/player work without the cinematic, and records anything it had to latch so a
   later teleport can put it back.
   ===================================================================================== */
(function installDevTeleports(global) {
  const game = () => global.game || global.__game || null;

  /* Progression latches the Fake Haven transition is REQUIRED to set. They are
     snapshotted the first time a dev teleport changes them and restored the moment the
     player is teleported back out, so testing the Haven cannot silently burn the
     Behemoth night-spawn gate or the Haven one-shot for the rest of the session. */
  let savedProgression = null;

  function saveProgression(g) {
    if (savedProgression) return;
    savedProgression = {
      behemothSpawned: g.behemothSpawned,
      fakeHavenTriggered: g.fakeHavenTriggered,
    };
  }
  function restoreProgression(g) {
    if (!savedProgression) return;
    g.behemothSpawned = savedProgression.behemothSpawned;
    g.fakeHavenTriggered = savedProgression.fakeHavenTriggered;
    savedProgression = null;
  }

  /* Tears down every entity/effect system that could otherwise follow the player
     through a teleport.

     PHASE 35 — THIS IS NO LONGER A SECOND COPY. It used to be its own list, kept
     approximately in step with the real Level 4 transition by hand; the real RIFT
     transitions had no list at all. There is now one crossing teardown on the Game —
     Game._leaveDimension — and this delegates to it, so a dev teleport and a rift arrive
     in identical state and neither can drift from the other. */
  function clearEntities(g, { disableSpawning }) {
    g._leaveDimension({ disableSpawning: !!disableSpawning });
  }

  /* Unloads the Fake Haven pocket AND resets its build latch.

     This is the single most important safety step in the whole tool. generateFakeHaven()
     early-returns when fakeHavenBuilt is true, but wipeAllChunks() disposes the Haven's
     chunks WITHOUT clearing that flag — so calling it a second time would hand back a
     spawn point inside a pocket that no longer has any chunks, dropping the player into
     an empty void. Resetting the latch here is what makes the Haven re-enterable. */
  function unloadHaven(g) {
    const w = g.world;
    for (let dcx = 0; dcx < FAKE_HAVEN_CHUNKS_SPAN; dcx++) {
      for (let dcz = 0; dcz < FAKE_HAVEN_CHUNKS_SPAN; dcz++) {
        const cx = FAKE_HAVEN_CHUNK_OFFSET + dcx, cz = FAKE_HAVEN_CHUNK_OFFSET + dcz;
        const k = w.key(cx, cz);
        w.pinnedChunkKeys.delete(k);      // disposeChunk refuses to touch pinned chunks
        const c = w.getChunk(cx, cz);
        if (c) w.disposeChunk(c);
      }
    }
    w.fakeHavenBuilt = false;
    w.fakeHavenActive = false;
    w.havenCorrupted = false;
    g.havenTimer = 0;
    g.havenShiftTriggered = false;
    g.havenShiftElapsed = 0;
    g.climaxTriggered = false;
  }

  /* Ensures a pocket region exists. The Farmlands and Suburbia generators build their
     chunks with `new Chunk(...)` and overwrite the map entry, so calling them while
     their chunks are still resident would orphan the old meshes in the scene graph —
     a genuine leak. Both are therefore only re-run once their chunks are actually gone. */
  function ensureFarmlands(w) {
    /* PHASE 16: the Farmlands boot only establishes the arrival point, registers the
       Disconnected Home chest key and pins a 3x3 core; it routes through _generateChunk,
       which returns existing chunks, so it is safe to re-run. Everything else streams
       normally from there — the same contract ensureSuburbia has had since Phase 9. */
    if (!w.farmlandsSpawn || !w.getChunk(FARMLANDS_SPAWN_CHUNK, FARMLANDS_SPAWN_CHUNK)) {
      w._genFarmlandsRegion();
    }
  }
  function ensureSuburbia(w) {
    // PHASE 9: Suburbia's boot only establishes the arrival point and pins a 3x3 core;
    // it routes through _generateChunk, which returns existing chunks, so it is safe to
    // re-run. Everything else streams normally from there.
    if (!w.suburbiaSpawn || !w.getChunk(SUBURBIA_SPAWN_CHUNK, SUBURBIA_SPAWN_CHUNK)) {
      w._genStaticSuburbiaRegion();
    }
  }

  /* Applies the environment/audio/post-FX state for a destination immediately, rather
     than waiting a frame. The frame loop re-derives the environment and Suburbia audio
     from the player's dimension flags every tick, so those are self-correcting; the
     Haven's music mode and the horror post-FX switch are NOT, and must be set here. */
  function applyDimensionState(g, target) {
    const haven = target === 'haven';
    g.sound.setSuburbiaMode(g.player.inSuburbia);
    g.sound.setFakeHavenMode(haven);
    g.postfx.setHorrorEnabled(!haven);
    g.env.setFarmlandsOverride(g.player.inFarmlands
      ? farmlandsBiomeAt(g.player.position.x, g.player.position.z) : null);
    g.env.setSuburbiaOverride(g.player.inSuburbia);
    g.env.setFakeHavenOverride(g.player.inFakeHaven);
    g.env.setNightmareOverride(false);
    g.env.setFollowTarget(g.player.position);
    g.env.update(0);   // repaint sky/fog on this very frame
    // PHASE 20.2 — every dev teleport is a dimension crossing too, so the compass has to
    // survive one exactly as the real transitions make it survive theirs.
    if (g._syncProgressionHUD) g._syncProgressionHUD();
  }

  // Resets the body for testing: alive, full HP, no residual motion or lock.
  function resetPlayer(g, pos) {
    const p = g.player;
    p.dead = false;
    p.hp = p.maxHp;
    p.velocity.set(0, 0, 0);
    p.movementLocked = false;
    p.stationaryTimer = 0;
    p.mining = false;
    if (p.highlight) p.highlight.hide();
    if (g.ui.storageOpen) g.ui.closeStorage();
    p.position.copy(pos);
    g.sanity.value = 100;
    g.ui.setSanity(100);
    g.ui.updateVitals(p);
  }

  /* Drops the player onto real ground. groundHeightAt answers where a foot rests, so this
     can never leave the player embedded in terrain or hovering — and it rejects columns
     with a structure overhead (a roof would place them on the roof).
     ERA 2 E2.1 — takes a PhysicalWorld. The callers hand it g.physical. */
  function safeGround(physical, wx, wz, expectY) {
    const y = physical.groundHeightAt(Math.floor(wx), Math.floor(wz));
    if (expectY !== undefined && Math.abs(y - expectY) > 2) return null;
    return new THREE.Vector3(Math.floor(wx) + 0.5, y, Math.floor(wz) + 0.5);
  }

  function announce(name) { console.log('DEV TELEPORT: ' + name); }

  // ---------------------------------------------------------------------------------

  global.debugTeleportToOverworld = function () {
    const g = game(); if (!g) return console.warn('DEV: game not ready');
    const w = g.world;
    unloadHaven(g);
    restoreProgression(g);
    clearEntities(g, { disableSpawning: false });
    w.wipeOverworldChunks();
    ensureFarmlands(w); ensureSuburbia(w);

    const sx = WORLD_CHUNKS_X * CHUNK_SX / 2, sz = WORLD_CHUNKS_Z * CHUNK_SZ / 2;
    w._eagerLoadAround(sx, sz, 3);   // generated + meshed before the player is placed

    setPlayerDimension(g.player, DIMENSION.OVERWORLD);
    resetPlayer(g, safeGround(g.physical, sx, sz) || g.player.spawnPosition.clone());
    applyDimensionState(g, 'overworld');
    announce('Overworld');
  };

  global.debugTeleportToFarmlands = function () {
    const g = game(); if (!g) return console.warn('DEV: game not ready');
    const w = g.world;
    unloadHaven(g);
    restoreProgression(g);
    clearEntities(g, { disableSpawning: false });
    w.wipeOverworldChunks();
    ensureFarmlands(w); ensureSuburbia(w);

    /* PHASE 16: no fixed 8x8 pocket and no perimeter wall. The arrival point is
       whatever _genFarmlandsRegion established, and the surrounding fields are forced to
       generate here so the player never lands in an ungenerated chunk. */
    const fspawn = w.farmlandsSpawn.clone();
    w._eagerLoadAround(fspawn.x, fspawn.z, 3);

    setPlayerDimension(g.player, DIMENSION.FARMLANDS);
    resetPlayer(g, safeGround(g.physical, fspawn.x, fspawn.z) || fspawn);
    applyDimensionState(g, 'farmlands');
    announce('The Shattered Farmlands @ ' + Math.floor(fspawn.x) + ',' + Math.floor(fspawn.z) +
             ' — biome ' + farmlandsBiomeAt(fspawn.x, fspawn.z));
  };

  global.debugTeleportToSuburbia = function () {
    const g = game(); if (!g) return console.warn('DEV: game not ready');
    const w = g.world;
    unloadHaven(g);
    restoreProgression(g);
    clearEntities(g, { disableSpawning: false });
    w.wipeOverworldChunks();
    ensureFarmlands(w); ensureSuburbia(w);

    /* PHASE 9 ARCHITECTURE: no fixed 8x8 pocket, no perimeter wall, no pre-built house
       grid. The arrival point is whatever _genStaticSuburbiaRegion established, and the
       surrounding streets are forced to generate here so the player never lands in an
       ungenerated chunk — everything beyond this ring streams on demand as normal. */
    const spawn = w.suburbiaSpawn.clone();
    w._eagerLoadAround(spawn.x, spawn.z, 3);

    setPlayerDimension(g.player, DIMENSION.SUBURBIA);
    resetPlayer(g, spawn);
    applyDimensionState(g, 'suburbia');
    announce('Static Suburbia');
  };

  global.debugTeleportToFakeHaven = function () {
    const g = game(); if (!g) return console.warn('DEV: game not ready');
    const w = g.world;

    /* Mirrors _transitionToLevel4()'s world work without its cinematic. A full flush is
       required here (not wipeOverworldChunks) because the illusion depends on nothing
       from the horror world remaining resident behind the fog. */
    unloadHaven(g);           // clears the build latch so the pocket is rebuilt fresh
    if (g.farmAnimals) g.farmAnimals.destroyAll();   // PHASE 18 — full teardown, pool included
    w.wipeAllChunks();
    const spawn = w.generateFakeHaven();

    clearEntities(g, { disableSpawning: true });   // the Haven must contain no threat
    saveProgression(g);
    g.behemothSpawned = true;      // latched shut so the night gate cannot fire here
    g.fakeHavenTriggered = true;   // prevents the real illusion re-firing on arrival

    setPlayerDimension(g.player, DIMENSION.FAKE_HAVEN);
    g.player.havenBedUsed = false;  // the bed trigger for the collapse starts unarmed
    resetPlayer(g, spawn.clone());

    // Countdown starts clean; the collapse is NOT triggered by arriving.
    g.havenTimer = 0;
    g.havenShiftTriggered = false;
    g.havenShiftElapsed = 0;
    applyDimensionState(g, 'haven');
    announce('The Fake Haven (peaceful; shift countdown started)');
  };

  global.debugTeleportToDisconnectedHome = function () {
    const g = game(); if (!g) return console.warn('DEV: game not ready');
    const w = g.world;

    // Enter Suburbia properly first if we are not already there.
    if (!g.player.inSuburbia) global.debugTeleportToSuburbia();

    /* PHASE 9: ask the generator where the house actually is, via the same
       deterministic ring placement the chunk generator uses. The obsolete fixed
       world-coordinate pair from the old 8x8 pocket is not referenced here at all. */
    const t = w._subDisconnectedTarget();
    const lot = w._subLot(t.bx, t.bz, t.row, t.col);
    const baseY = SUBURBIA_BASE_Y;

    // Force the house and its surroundings to exist before placing the player.
    const cx = Math.floor((lot.hx + 5) / CHUNK_SX), cz = Math.floor((lot.hz + 4) / CHUNK_SZ);
    w._eagerLoadAround(cx * CHUNK_SX, cz * CHUNK_SZ, 3);

    /* Stand the player back from the front of the house so the whole inverted
       silhouette is visible at once — the point of this structure is that it reads as
       wrong from a distance. Candidates are tried outward and the first one on real,
       flat, unroofed ground wins, so the player can never land inside geometry. */
    let pos = null;
    const faceZ = lot.row === 0 ? -1 : 1;   // front row faces -z, back row +z
    for (const d of [14, 12, 16, 10, 18, 8]) {
      const px = lot.hx + 5, pz = lot.hz + (faceZ < 0 ? -d : SUB_HOUSE_D + d);
      const c = safeGround(g.physical, px, pz, baseY);
      if (c) { pos = c; break; }
    }
    if (!pos) pos = safeGround(g.physical, lot.hx + 5, lot.hz - 14) ||
                    new THREE.Vector3(lot.hx + 5.5, baseY + 1, lot.hz - 14.5);

    setPlayerDimension(g.player, DIMENSION.SUBURBIA);
    resetPlayer(g, pos);
    applyDimensionState(g, 'suburbia');

    const disk = w.level3HomeChestKey;
    announce('The Disconnected Home @ ' + lot.hx + ',' + lot.hz +
             ' (Core Disk chest ' + (disk ? 'registered @ ' + disk : 'NOT REGISTERED') + ')');
  };

  /* ===================================================================================
     PHASE 16 — LIVE FARMLANDS AUDIT

     The offline harness proves the generator is correct; this proves the RUNNING GAME is
     still within its bounds after however long the player has been walking. It reads only
     live state — no regeneration, no allocation of consequence, no writes of any kind —
     so it is safe to call mid-session and cannot affect gameplay. It reports exactly the
     quantities Phase 11 taught us to watch, plus the two Phase 16 specifically had to
     answer for: resident scene objects, and whether the crop conversion is holding.

       debugFarmlandsAudit()       one-shot report
       debugFarmlandsAudit(true)   also re-generates every resident Farmlands chunk into a
                                   scratch buffer and diffs it, proving determinism against
                                   what is actually on screen right now
     =================================================================================== */
  /* =================================================================================
     PHASE 18 — debugFarmlandsAnimals(radius)

     Censuses the world life, signage and road network around the player from the
     PLACEMENT FUNCTIONS rather than from the live manager, so it reports what the world
     contains rather than what happens to be spawned this instant. That distinction is
     the point: the live set is a 56-block window, and a claim about distribution made
     from 20-odd animals would be noise.
     ================================================================================= */
  /* =================================================================================
     PHASE 18.1 — debugFarmlandsRoutes(length)

     A TOP-DOWN ROUTE MAP, printed to the console. This exists because the Phase 18
     straightness failure was invisible to every test that phase ran: the metrics all
     reported that the offset function returned more than one value, which was true and
     told nobody anything about what the road looked like. A picture would have caught it
     in a second.

     Renders the SEMANTIC SURFACE — what _farmSurfaceAt actually answers, not the
     metadata — so the carriageway, verge and hedge are shown where they will really be
     built. It also reports the straight-run statistics for the lane the player is
     nearest, measured by chord deviation, which is the number the phase is judged on.

     Console only. Nothing is drawn in the world and nothing is left enabled in play.
     ================================================================================= */
  global.debugFarmlandsRoutes = function (length) {
    const g = global.__game;
    if (!g) { console.log('no game'); return; }
    if (!g.player.inFarmlands) { console.log('debugFarmlandsRoutes: not in the Farmlands.'); return; }
    const w = g.world, LEN = length || 1200;
    const px = Math.floor(g.player.position.x), pz = Math.floor(g.player.position.z);
    const bxp = Math.floor(px / FARM_P), bzp = Math.floor(pz / FARM_P);

    // Pick the nearest north-south lane to centre the map on.
    let line = null, best = 1e9;
    for (let d = -1; d <= 1; d++) {
      if (!w._farmLaneX(bxp + d)) continue;
      const c = (bxp + d) * FARM_P + w._farmRouteX(bxp + d, pz);
      if (Math.abs(c - px) < best) { best = Math.abs(c - px); line = bxp + d; }
    }
    const L = [];
    L.push('=== PHASE 18.1 — ROUTE MAP ===');
    if (line === null) { console.log('no north-south lane within one parcel of the player.'); return; }
    const centre = Math.round(line * FARM_P + w._farmRouteX(line, pz));
    L.push(`nearest N-S lane: grid line ${line}, centreline at x=${centre} (${Math.round(best)}b away)`);
    L.push('# carriageway   : verge   ~ ditch   H hedge   B farmstead   . field');
    L.push('one row = 16 blocks north-south, one column = 1 block east-west');

    const x0 = centre - 32;
    for (let z = pz - (LEN >> 1); z < pz + (LEN >> 1); z += 16) {
      let row = '';
      for (let x = x0; x < x0 + 64; x++) {
        const st = w._farmSteadAt(Math.floor(x / FARM_P), Math.floor(z / FARM_P));
        if (st && x >= st.ox && x < st.x1 && z >= st.oz && z < st.z1) { row += 'B'; continue; }
        row += ['.', '#', '#', ':', '~', '~', 'H'][w._farmSurfaceAt(x, z)];
      }
      L.push((z <= pz && z + 16 > pz ? '>' : ' ') + row);
    }

    /* Straight-run statistics by chord deviation: a stretch reads as straight while the
       route stays within 1.5 blocks of the line joining its ends. */
    const off = [];
    for (let t = pz - LEN; t < pz + LEN; t++) off.push(w._farmRouteX(line, t));
    const runs = [];
    let i = 0;
    while (i < off.length - 2) {
      let j = i + 2;
      while (j < off.length) {
        const a = off[i], b = off[j], sp = j - i;
        let worst = 0;
        for (let k = i + 1; k < j; k++) {
          const d = Math.abs(off[k] - (a + (b - a) * (k - i) / sp));
          if (d > worst) worst = d;
        }
        if (worst > 1.5) break;
        j++;
      }
      runs.push(j - i);
      i = j - 1;
    }
    runs.sort((a, b) => a - b);
    let lo = 1e9, hi = -1e9;
    for (const o of off) { if (o < lo) lo = o; if (o > hi) hi = o; }
    L.push('');
    L.push(`straight runs over ${LEN * 2}b: median ${runs[runs.length >> 1]}b, longest ${runs[runs.length - 1]}b`);
    L.push(`visible bends: ${runs.length - 1}  (one every ~${Math.round(LEN * 2 / Math.max(1, runs.length - 1))}b)`);
    L.push(`lateral sweep: ${(hi - lo).toFixed(1)} blocks`);
    console.log(L.join('\n'));
    return undefined;
  };

  global.debugFarmlandsAnimals = function (radius) {
    const g = global.__game;
    if (!g) { console.log('no game'); return; }
    const w = g.world, R = radius || 96;
    if (!g.player.inFarmlands) { console.log('debugFarmlandsAnimals: not in the Farmlands.'); return; }
    const px = Math.floor(g.player.position.x), pz = Math.floor(g.player.position.z);
    const L = [];
    L.push('=== PHASE 18 — WORLD LIFE, SIGNAGE AND ROADS ===');
    L.push(`centre ${px}, ${pz}   radius ${R} blocks`);

    // --- Animals, from the placement lookup.
    const a0 = Math.floor((px - R) / FARM_ANIM_P), a1 = Math.floor((px + R) / FARM_ANIM_P);
    const b0 = Math.floor((pz - R) / FARM_ANIM_P), b1 = Math.floor((pz + R) / FARM_ANIM_P);
    const sp = [0, 0, 0, 0], cond = [0, 0, 0, 0], beh = new Array(FARM_ANIM_BEH_W.length).fill(0);
    let groups = 0, animals = 0, cells = 0;
    for (let ax = a0; ax <= a1; ax++) for (let az = b0; az <= b1; az++) {
      cells++;
      const c = w._farmAnimalCell(ax, az);
      if (!c) continue;
      groups++;
      for (const an of c.animals) { animals++; sp[an.species]++; cond[an.cond]++; beh[an.beh]++; }
    }
    const CN = ['healthy', 'slightly rotten', 'moderately rotten', 'severely rotten'];
    L.push('');
    L.push(`animals in range       ${animals} in ${groups} groups over ${cells} cells ` +
           `(${(100 * groups / cells).toFixed(0)}% of cells populated)`);
    if (animals) {
      L.push(`  species              cow ${(100 * sp[0] / animals).toFixed(0)}%  sheep ${(100 * sp[1] / animals).toFixed(0)}%  ` +
             `chicken ${(100 * sp[2] / animals).toFixed(0)}%  horse ${(100 * sp[3] / animals).toFixed(0)}%`);
      L.push(`  condition            ` + cond.map((n, i) => `${CN[i]} ${n}`).join(', '));
      const odd = beh.slice(FARM_ANIM_BEH_ODD).reduce((x, y) => x + y, 0);
      L.push(`  behaviour            ${animals - odd} ordinary, ${odd} distorted (${(100 * odd / animals).toFixed(0)}%)`);
      L.push(`                       ` + beh.map((n, i) => n ? FARM_ANIM_BEH_NAMES[i] + ' ' + n : null).filter(Boolean).join('  '));
    }
    if (g.farmAnimals) {
      const st = g.farmAnimals.stats();
      L.push(`live right now         ${st.live}/${FARM_ANIM_MAX_LIVE} simulated, ${st.hidden} hidden, ` +
             `${st.pooled} rigs pooled`);
      L.push(`shared resources       ${st.geometries} geometries, ${st.materials} materials ` +
             `(no animal owns either)`);
    }

    // --- Signage and what it names.
    L.push('');
    const p0 = Math.floor((px - R * 2) / FARM_P), p1 = Math.floor((px + R * 2) / FARM_P);
    const q0 = Math.floor((pz - R * 2) / FARM_P), q1 = Math.floor((pz + R * 2) / FARM_P);
    const found = [];
    for (let bx = p0; bx <= p1; bx++) for (let bz = q0; bz <= q1; bz++) {
      const sg = w._farmSignAt(bx, bz);
      if (sg) found.push(sg);
    }
    L.push(`signs within ${R * 2} blocks   ${found.length}`);
    found.sort((s1, s2) => Math.hypot(s1.x - px, s1.z - pz) - Math.hypot(s2.x - px, s2.z - pz));
    for (const sg of found.slice(0, 6)) {
      const d = Math.round(Math.hypot(sg.x - px, sg.z - pz));
      const text = sg.nameIdx >= 0 ? FARM_SIGN_NAMES[sg.nameIdx].lines.filter(Boolean).join(' ') : '(paint gone)';
      L.push(`  ${String(d).padStart(4)}b  ${sg.x},${sg.z}  ${sg.run}-run  ${text}` +
             (sg.arrow ? `  arrow ${sg.arrow > 0 ? '+' : '-'}${sg.run}` : ''));
    }
    // --- Farmsteads and their names.
    L.push('');
    const steads = [];
    for (let bx = p0; bx <= p1; bx++) for (let bz = q0; bz <= q1; bz++) {
      const st = w._farmSteadAt(bx, bz);
      if (st) steads.push(st);
    }
    steads.sort((s1, s2) => Math.hypot(s1.ox - px, s1.oz - pz) - Math.hypot(s2.ox - px, s2.oz - pz));
    L.push(`farmsteads in range    ${steads.length}`);
    for (const st of steads.slice(0, 5)) {
      L.push(`  ${String(Math.round(Math.hypot(st.ox - px, st.oz - pz))).padStart(4)}b  ` +
             `${FARM_SIGN_NAMES[st.nameIdx].lines.filter(Boolean).join(' ')}` +
             `${st.hasSign ? ' (signed)' : ' (no board)'}  decay ${st.decay}` +
             `${st.isRoth ? '   <- the arrival farmstead' : ''}`);
    }
    // --- The lane the player is on or near, and how much it is bending.
    L.push('');
    const bxp = Math.floor(px / FARM_P), bzp = Math.floor(pz / FARM_P);
    const lx = w._farmLaneX(bxp), lz = w._farmLaneZ(bzp);
    L.push(`parcel ${bxp},${bzp}      lane along Z: ${lx ? 'yes, offset ' + w._farmMeanderX(bxp, pz) : 'no'}` +
           `   lane along X: ${lz ? 'yes, offset ' + w._farmMeanderZ(bzp, px) : 'no'}`);
    L.push(`surface underfoot      ${['field', 'track', 'rut', 'verge', 'ditch', 'ditch lip', 'boundary'][w._farmSurfaceAt(px, pz)]}`);
    console.log(L.join('\n'));
    return undefined;
  };

  global.debugFarmlandsAudit = function (deep) {
    const g = global.game;
    if (!g) { console.log('No game yet.'); return; }
    const w = g.world, L = [];

    // --- Resident chunks, split by dimension.
    let total = 0, farm = 0, pinned = 0, meshed = 0, farmPinned = 0;
    for (const c of w.chunks.values()) {
      total++;
      const isFarm = isFarmlandsChunk(c.cx, c.cz);
      if (isFarm) farm++;
      if (w.pinnedChunkKeys.has(w.key(c.cx, c.cz))) { pinned++; if (isFarm) farmPinned++; }
      if (c.mesh) meshed++;
    }
    L.push('WHERE IT ISN\u2019T — THE SHATTERED FARMLANDS AUDIT');
    L.push('');
    L.push(`region                 chunks ${FARMLANDS_CHUNK_OFFSET}..${FARMLANDS_CHUNK_MAX} ` +
           `(world ${FARMLANDS_CHUNK_OFFSET * CHUNK_SX}..${FARMLANDS_CHUNK_MAX * CHUNK_SX}), ` +
           `${FARMLANDS_SPAN_CHUNKS * CHUNK_SX} blocks square`);
    L.push(`resident chunks        ${total}  (${farm} Farmlands, ${pinned} pinned [${farmPinned} of them Farmlands], ${meshed} meshed)`);

    /* THE RESIDENT BOUND. Radial streaming holds the resident set at roughly the area of
       the unload disc regardless of how far the player has walked. Anything far above
       this means a chunk is being retained that should have been disposed. */
    const bound = Math.PI * CHUNK_UNLOAD_RADIUS * CHUNK_UNLOAD_RADIUS;
    L.push(`streaming bound        pi*r^2 = ${bound | 0} at CHUNK_UNLOAD_RADIUS=${CHUNK_UNLOAD_RADIUS}` +
           (total > bound * 1.6 + 40 ? '   *** RESIDENT SET ABOVE THE STREAMING BOUND ***' : '   (within bound)'));

    // --- Quads, counted from live geometry rather than re-meshed.
    let quads = 0, qmax = 0, qn = 0, fquads = 0, fqn = 0;
    for (const c of w.chunks.values()) {
      if (!c.mesh || !c.mesh.geometry || !c.mesh.geometry.attributes.position) continue;
      const q = c.mesh.geometry.attributes.position.count / 4;
      quads += q; qn++; if (q > qmax) qmax = q;
      if (isFarmlandsChunk(c.cx, c.cz)) { fquads += q; fqn++; }
    }
    L.push(`quads                  ${quads} total, ${qn ? (quads / qn) | 0 : 0} mean/chunk, ${qmax} max`);
    if (fqn) L.push(`  of which Farmlands   ${fquads} across ${fqn} chunks, ${(fquads / fqn) | 0} mean/chunk`);

    /* --- RESIDENT LIGHTS. The Phase 11 regression that caused multi-second freezes was
       unbounded THREE.PointLight instances. The Farmlands place no light-emitting block
       of their own, so anything here is a torch or lantern the PLAYER put down. */
    const lights = w.torchLights ? w.torchLights.size : 0;
    let sources = 0;
    for (const c of w.chunks.values()) if (c.lightSources) sources += c.lightSources.length;
    L.push(`resident point lights  ${lights} live THREE.PointLight, ${sources} cached light sources`);
    L.push(`                       ${total ? (lights / total).toFixed(2) : 0} per resident chunk` +
           (lights > 400 ? '   *** ABOVE THE PHASE 11 SAFE BOUND ***' : ''));

    /* --- THE CROP CONVERSION. This is the number Phase 16 exists to keep at zero. The
       pocket drew every withered stalk as a THREE.Group with its own geometry and its own
       material; crops are voxels now, so no Farmlands chunk may own a single decor mesh.
       A non-zero count here means the scene-object path has come back. */
    let decor = 0, decorFarm = 0;
    for (const c of w.chunks.values()) {
      if (!c.decorMeshes) continue;
      decor += c.decorMeshes.length;
      if (isFarmlandsChunk(c.cx, c.cz)) decorFarm += c.decorMeshes.length;
    }
    L.push(`decor scene objects    ${decor} total across all dimensions, ${decorFarm} in the Farmlands` +
           (decorFarm ? '   *** THE PER-STALK SCENE OBJECT PATH HAS RETURNED ***' : '   (crops are voxels — correct)'));

    // --- Progression.
    L.push('');
    const AH = w.farmHome, AT = w.farmTower;
    L.push(`Disconnected Home      plot ${AH ? AH.ox + ',' + AH.oz : 'UNRESOLVED'} ` +
           `${AH ? '(' + AH.w + 'x' + AH.d + ', pad y=' + AH.padY + ', biome ' +
                   farmlandsBiomeAt(AH.cx, AH.cz) + ')' : '*** PHASE 20 RESOLUTION FAILED ***'}`);
    if (AH) {
      L.push(`  house                ${AH.hx},${AH.hz} ${AH.hw}x${AH.hd}, two storeys, ` +
             `upper floor y=${AH.upY}`);
      L.push(`  buried volume        floor y=${AH.deepY}, ${AH.stairSteps}-tread descent, ` +
             `hall ${AH.hallX1 - AH.hallX0 + 1} blocks long, room ${AH.bigX0},${AH.bigZ0} 16x12`);
      L.push(`  journey ordinal      column ${farmJourneyOrd(AH.bx, AH.bz)} of the journey ` +
             `(${Math.abs(AH.cz - FARM_SPAWN_Z)} blocks from arrival)`);
    }
    L.push(`water tower            ${AT ? AT.cx + ',' + AT.cz + '  pad y=' + AT.padY +
                                          ', lamp y=' + AT.lampY + ' (' + FARM_TOWER_LAMP_DY +
                                          ' above the pad)' : 'UNRESOLVED'}`);
    if (AT) {
      const st = w.farmTowerLight;
      L.push(`  red lamp             ${st ? (st.on ? 'LIT' : 'dark') + ', flash #' + st.idx +
                                            ', gaze ' + st.gaze : 'not ticking'}`);
    }
    L.push(`Core Disk chest        ${w.homeChestKey || 'NOT REGISTERED'}` +
           (w.homeChestKey ? '' : '   *** LEVEL 2 PROGRESSION IS BROKEN ***'));
    const opened = w.openedChests && w.homeChestKey && w.openedChests.has(w.homeChestKey);
    L.push(`                       ${opened ? 'already opened this session' : 'unopened'}`);
    L.push(`rift landing pad       ${FARM_SPAWN_X},${FARM_SPAWN_Z}  ` +
           `(biome ${farmlandsBiomeAt(FARM_SPAWN_X, FARM_SPAWN_Z)})`);

    // --- Where the player is standing, in agricultural terms.
    const px = Math.floor(g.player.position.x), pz = Math.floor(g.player.position.z);
    if (isFarmlandsWorldPos(px, pz)) {
      const surfNames = ['field', 'cart track', 'wheel rut', 'verge', 'ditch floor', 'ditch bank', 'field boundary'];
      const kindNames = ['crop', 'dead/fallow', 'stubble', 'pasture', 'orchard', 'flooded', 'copse'];
      const bx = Math.floor(px / FARM_P), bz = Math.floor(pz / FARM_P);
      const p = w._farmParcel(bx, bz);
      const surf = w._farmSurfaceAt(px, pz);
      L.push('');
      L.push(`player at ${px},${pz} — standing on ${surfNames[surf]}, ground y=${w._farmHeightAt(px, pz)}`);
      L.push(`biome                  ${farmlandsBiomeAt(px, pz)} (field value ${farmlandsBiomeValue(px, pz).toFixed(3)}, threshold ${FARM_BIOME_T})`);
      L.push(`parcel ${bx},${bz}          ${kindNames[p.kind]}, worked along ${p.alongX ? 'X' : 'Z'}, ` +
             `row pitch ${p.spacing}, boundary ${p.wall ? 'drystone' : 'hedge/fence'}`);
      L.push(`lanes                  N-S edge ${w._farmLaneX(bx) ? 'track' : 'none'}` +
             `${w._farmLaneX(bx) && w._farmDitchX(bx) ? ' + ditch' : ''}, ` +
             `E-W edge ${w._farmLaneZ(bz) ? 'track' : 'none'}` +
             `${w._farmLaneZ(bz) && w._farmDitchZ(bz) ? ' + ditch' : ''}`);
      const dHome = AH ? Math.hypot(px - AH.cx, pz - AH.cz) : NaN;
      const dEdge = Math.min(px - FARMLANDS_CHUNK_OFFSET * CHUNK_SX, FARMLANDS_CHUNK_MAX * CHUNK_SX - px,
                             pz - FARMLANDS_CHUNK_OFFSET * CHUNK_SZ, FARMLANDS_CHUNK_MAX * CHUNK_SZ - pz);
      L.push(`distances              ${dHome.toFixed(0)} blocks to the Disconnected Home, ` +
             `${dEdge.toLocaleString()} to the nearest region edge`);

      /* SANITY INVARIANT, checked live. The Day Phase floor in SanitySystem.update is
         gated on py > 30; the Farmlands heightfield is clamped so it can never fire here,
         and every tuned sanity behaviour in this dimension depends on that staying true. */
      L.push(`sanity gate            player py=${Math.floor(g.player.position.y)}, ` +
             `heightfield clamp ${FARM_MIN_Y}..${FARM_MAX_Y}` +
             (Math.floor(g.player.position.y) > 30 ? '   *** ABOVE THE py>30 DAY-PHASE GATE ***' : '   (below the gate — correct)'));
    } else {
      L.push('');
      L.push(`player at ${px},${pz} — outside the Farmlands region`);
    }

    /* --- DETERMINISM, against what is on screen. Regenerates each resident Farmlands
       chunk from scratch and diffs it against the live data. Any difference would mean a
       chunk's contents depend on load order or on mutable state — the exact failure that
       makes an infinite streaming world fall apart. Player edits show up here as
       differences, which is correct and expected. The scratch chunk is discarded, so this
       allocates nothing that outlives the call. */
    if (deep) {
      let checked = 0, differing = 0, edited = 0;
      const t0 = performance.now();
      for (const c of w.chunks.values()) {
        if (!isFarmlandsChunk(c.cx, c.cz)) continue;
        const probe = new Chunk(c.cx, c.cz, w);
        w._genFarmlandsChunk(probe);
        checked++;
        if (w.editedChunks.has(w.key(c.cx, c.cz))) edited++;
        for (let i = 0; i < probe.data.length; i++) {
          if (probe.data[i] !== c.data[i]) { differing++; break; }
        }
      }
      L.push('');
      L.push(`determinism: regenerated ${checked} resident Farmlands chunks in ` +
             `${(performance.now() - t0).toFixed(0)}ms — ${differing} differ, ${edited} carry player edits` +
             (differing > edited ? '   *** MORE CHUNKS DIFFER THAN HAVE BEEN EDITED ***' : ''));
    } else {
      L.push('');
      L.push('call debugFarmlandsAudit(true) to also re-verify deterministic regeneration');
    }

    console.log(L.join('\n'));
    return undefined;
  };

  /* Stands the player in front of the Farmlands Disconnected Home, far enough back that
     the whole silhouette reads at once. Mirrors the Suburbia equivalent. */
  global.debugTeleportToFarmHome = function () {
    const g = game(); if (!g) return console.warn('DEV: game not ready');
    const w = g.world;
    if (!g.player.inFarmlands) global.debugTeleportToFarmlands();
    const H = w.farmHome;
    if (!H) return console.warn('DEV: the Farmlands journey has not been resolved');
    // Stand on the approach, west of the property, looking across the last field at it —
    // which is the composition the player is meant to arrive on.
    const ax = H.ox - 16, az = H.oz + 17;
    w._eagerLoadAround(ax, az, 3);
    let pos = null;
    for (const d of [0, 3, -3, 6, -6]) {
      const c = safeGround(g.physical, ax, az + d, H.padY);
      if (c) { pos = c; break; }
    }
    if (!pos) pos = new THREE.Vector3(ax + 0.5, H.padY + 1, az + 0.5);
    setPlayerDimension(g.player, DIMENSION.FARMLANDS);
    resetPlayer(g, pos);
    applyDimensionState(g, 'farmlands');
    announce('The Disconnected Home (Level 2) @ ' + H.ox + ',' + H.oz +
             ' (Core Disk chest ' + (w.homeChestKey ? 'registered @ ' + w.homeChestKey : 'NOT REGISTERED') + ')');
  };
  /* PHASE 20 — stands the player on the journey lane a chosen distance west of the water
     tower, facing it. The default is a hundred and forty blocks, which is where the
     silhouette reads most clearly against the fog and is the distance the phase's own
     visual check uses. */
  global.debugTeleportToWaterTower = function (dist) {
    const g = game(); if (!g) return console.warn('DEV: game not ready');
    const w = g.world, T = w.farmTower;
    if (!T) return console.warn('DEV: the Farmlands journey has not been resolved');
    if (!g.player.inFarmlands) global.debugTeleportToFarmlands();
    const d = dist === undefined ? 140 : Math.max(0, dist);
    const x = T.cx - d, z = Math.round(w._farmJourneyLaneZ(x));
    w._eagerLoadAround(x, z, 3);
    const pos = safeGround(g.physical, x, z, FARM_BASE_Y) ||
                new THREE.Vector3(x + 0.5, w._farmHeightAt(x, z) + 1, z + 0.5);
    setPlayerDimension(g.player, DIMENSION.FARMLANDS);
    resetPlayer(g, pos);
    // Face the tower.
    g.player.yaw = Math.atan2(-(T.cx - pos.x), -(T.cz - pos.z));
    g.player.pitch = 0.10;
    applyDimensionState(g, 'farmlands');
    announce('The water tower @ ' + T.cx + ',' + T.cz + ' — ' + d + ' blocks west of it, ' +
             (T.lampY - T.padY) + ' blocks of tower, lamp at y=' + T.lampY);
  };

  /* PHASE 20 — the whole journey printed as coordinates, so a session that has to check
     one beat does not have to walk to it. Reads only resolved state; writes nothing. */
  /* PHASE 20.2 — hand the player the compass without hunting a chest, and replay the
     opening instruction on demand. Both exist so the navigation experience can be
     playtested from any point in a session rather than only from a cold start. */
  global.debugGrantCompass = function () {
    const g = game(); if (!g) return console.warn('DEV: game not ready');
    const fresh = g.grantCompass();
    console.log('DEV: compass ' + (fresh ? 'granted' : 'was already earned') +
                ' — HUD ' + (g.ui.compassShown ? 'showing' : 'hidden') +
                '; bearing now ' + (compassBearingFromYaw(g.player.yaw) * 180 / Math.PI).toFixed(1) +
                ' deg (' + compassCardinal(compassBearingFromYaw(g.player.yaw)) + ')');
  };
  global.debugOpeningInstruction = function () {
    const g = game(); if (!g) return console.warn('DEV: game not ready');
    g.openingInstruction.recall();
    console.log('DEV: replaying — ' + OPENING_INSTRUCTION_LINES.join(' / '));
  };

  global.debugFarmJourney = function () {
    const g = game(); if (!g) return console.warn('DEV: game not ready');
    const w = g.world, H = w.farmHome, T = w.farmTower;
    if (!H || !T) return console.warn('DEV: the Farmlands journey has not been resolved');
    const L = [];
    const laneAt = (j) => {
      const x = (FARM_J_B0 + j * FARM_J_DIR) * FARM_P + 32;
      return [x, Math.round(w._farmJourneyLaneZ(x))];
    };
    L.push('=== PHASE 20 — THE FARMLAND JOURNEY ===');
    L.push(`lane            grid line ${FARM_J_LINE} (E-W), walked ${FARM_J_DIR > 0 ? 'east' : 'west'} from column ${FARM_J_B0}`);
    L.push(`arrival         ${w.farmlandsSpawn.x.toFixed(1)},${w.farmlandsSpawn.z.toFixed(1)}  ` +
           `surface ${w._farmSurfaceAt(Math.floor(w.farmlandsSpawn.x), Math.floor(w.farmlandsSpawn.z))} (1=track, 2=rut)`);
    const beats = [
      [FARM_J_WHEAT, 'wheat field'], [FARM_J_STOCK, 'pasture + farmstead'],
      [FARM_J_TOWER, 'the water tower'], [FARM_J_ISO0, 'isolation begins'],
      [FARM_J_ECHO0, 'repetition and echoes begin'], [FARM_J_HOME, 'the property'],
    ];
    for (const [j, name] of beats) {
      const [x, z] = laneAt(j);
      const d = Math.hypot(x - FARM_SPAWN_X, z - FARM_SPAWN_Z);
      L.push(`  column ${String(j).padStart(2)}  ${name.padEnd(28)} lane at ${x},${z}   ${d.toFixed(0)} blocks from arrival   ` +
             `biome ${farmlandsBiomeAt(x, z)}   density x${farmJourneyIsolation(FARM_J_B0 + j, FARM_J_LINE).toFixed(2)}`);
    }
    L.push(`water tower     ${T.cx},${T.cz}  pad y=${T.padY}, lamp y=${T.lampY} (${FARM_TOWER_LAMP_DY} above the pad)`);
    L.push(`  red lamp      ${w.farmTowerLight ? (w.farmTowerLight.on ? 'LIT' : 'dark') + ', gaze ' + w.farmTowerLight.gaze +
                              ', ' + w.farmTowerLight.flashes + ' flashes this session' : 'not ticking (never entered range)'}`);
    L.push(`the property    ${H.ox},${H.oz} .. ${H.x1},${H.z1}   pad y=${H.padY}`);
    L.push(`  farmhouse     ${H.hx},${H.hz}  ${H.hw}x${H.hd}, upper floor y=${H.upY}`);
    L.push(`  buried volume floor y=${H.deepY}, ${H.stairSteps}-tread descent from the pantry`);
    L.push(`  the long hall ${H.hallX0}..${H.hallX1} (${H.hallX1 - H.hallX0 + 1} blocks) on z=${H.hallZ}`);
    L.push(`  the last room ${H.bigX0},${H.bigZ0}  16x12 — larger than the farmhouse above it`);
    L.push(`  Core Disk     ${w.homeChestKey}` + (w.openedChests && w.openedChests.has(w.homeChestKey) ? '  (opened)' : '  (unopened)'));
    const gap = H.south ? H.oz - Math.round(w._farmJourneyLaneZ(H.cx)) : Math.round(w._farmJourneyLaneZ(H.cx)) - H.z1;
    L.push(`  road gap      ${gap} blocks of open field between the lane and the property, with nothing joining them`);
    console.log(L.join('\n'));
    return undefined;
  };

  /* ===================================================================================
     PHASE 13 — LIVE SUBURBIA AUDIT

     The offline harness proves the generator is correct; this proves the RUNNING GAME
     is still within its bounds after however long the player has been walking. It reads
     only live state — no regeneration, no allocation of consequence — so it is safe to
     call mid-session, and it reports exactly the quantities Phase 11 taught us to watch.

       debugSuburbiaAudit()        one-shot report
       debugSuburbiaAudit(true)    also re-generates every resident Suburbia chunk into
                                   a scratch buffer and diffs it, proving determinism
                                   against what is actually on screen right now
     =================================================================================== */
  global.debugSuburbiaAudit = function (deep) {
    const g = global.game;
    if (!g) { console.log('No game yet.'); return; }
    const w = g.world, L = [];
    const P = w.constructor;

    // --- Resident chunks, split by dimension.
    let total = 0, sub = 0, pinned = 0, meshed = 0;
    for (const c of w.chunks.values()) {
      total++;
      if (w.pinnedChunkKeys.has(w.key(c.cx, c.cz))) pinned++;
      if (c.mesh) meshed++;
      if (isStaticSuburbiaChunk(c.cx, c.cz)) sub++;
    }
    L.push('WHERE IT ISN\u2019T — STATIC SUBURBIA AUDIT');
    L.push('');
    L.push(`resident chunks        ${total}  (${sub} Suburbia, ${pinned} pinned, ${meshed} meshed)`);

    // --- Quads. Counted from the live geometry, not re-meshed.
    let quads = 0, qmax = 0, qn = 0;
    for (const c of w.chunks.values()) {
      if (!c.mesh || !c.mesh.geometry || !c.mesh.geometry.attributes.position) continue;
      const q = c.mesh.geometry.attributes.position.count / 4;
      quads += q; qn++; if (q > qmax) qmax = q;
    }
    L.push(`quads                  ${quads} total, ${qn ? (quads / qn) | 0 : 0} mean/chunk, ${qmax} max`);

    /* --- RESIDENT LIGHTS. The Phase 11 regression that caused multi-second freezes was
       unbounded THREE.PointLight instances, so this counts the real scene objects, not
       the blocks that imply them. */
    const lights = w.torchLights ? w.torchLights.size : 0;
    let sources = 0;
    for (const c of w.chunks.values()) if (c.lightSources) sources += c.lightSources.length;
    L.push(`resident point lights  ${lights} live THREE.PointLight, ${sources} cached light sources`);
    L.push(`                       ${total ? (lights / total).toFixed(2) : 0} per resident chunk` +
           (lights > 400 ? '   *** ABOVE THE PHASE 11 SAFE BOUND ***' : ''));

    // --- Streaming-side registries that must not grow without bound.
    let wins = 0;
    for (const c of w.chunks.values()) if (c.subWindows) wins += c.subWindows.length;
    L.push(`CRT window registry    ${wins} entries across resident chunks`);
    L.push(`door overrides         ${w.suburbiaDoorOverrides ? w.suburbiaDoorOverrides.size : 0} lots rearranged this session`);

    /* --- PHASE 15 — THE RECOGNITION LAYER. Both ledgers are hard-capped; anything at or
       near its cap here is working exactly as designed, and anything ABOVE it is a bug in
       the eviction path. */
    const visits = w.suburbiaVisits ? w.suburbiaVisits.size : 0;
    const stages = w.suburbiaStage ? w.suburbiaStage.size : 0;
    let revisions = 0;
    if (w.suburbiaStage) for (const v of w.suburbiaStage.values()) revisions += v;
    L.push(`visit ledger           ${visits}/${SUB_VISIT_CAP} houses entered` +
           (visits > SUB_VISIT_CAP ? '   *** ABOVE CAP ***' : ''));
    L.push(`revision ledger        ${stages}/${SUB_STAGE_CAP} houses revised, ` +
           `${revisions} revisions total, ${w._subRecogCommits || 0} committed this session` +
           (stages > SUB_STAGE_CAP ? '   *** ABOVE CAP ***' : ''));
    L.push(`revision queue         ${w._subPending ? w._subPending.size : 0}/8 waiting, ` +
           `cooldown ${(w._subRecogCooldown || 0).toFixed(1)}s`);

    /* --- PHASE 18 — WORLD LIFE. The three numbers that matter are the live count, the
       pool size and the shared-resource counts: the first two are what bound the cost,
       and the third is the one that would reveal a per-animal material leak. Anything
       above FARM_ANIM_MAX_LIVE live, or a material count that keeps climbing as the
       player walks, is a bug in the residency reconciler rather than a tuning problem. */
    if (g.farmAnimals) {
      const a = g.farmAnimals.stats();
      const CN = ['healthy', 'slight', 'moderate', 'severe'];
      L.push(`animals live           ${a.live}/${FARM_ANIM_MAX_LIVE}` +
             (a.hidden ? `, ${a.hidden} currently unobserved and hidden` : '') +
             (a.live > FARM_ANIM_MAX_LIVE ? '   *** ABOVE CAP ***' : ''));
      L.push(`animal rigs            ${a.pooled} pooled, ${a.rigsBuilt} built this session, ` +
             `${a.freeShells} free shells`);
      L.push(`animal resources       ${a.geometries} shared geometries, ${a.materials} shared materials ` +
             `(ceiling 48 = 4 species x 4 conditions x 3)` +
             (a.materials > 48 ? '   *** PER-ANIMAL MATERIAL LEAK ***' : ''));
      if (a.live) {
        L.push(`  species              cow ${a.sp[0]}  sheep ${a.sp[1]}  chicken ${a.sp[2]}  horse ${a.sp[3]}`);
        L.push(`  condition            ` + a.cond.map((n, i) => `${CN[i]} ${n}`).join('  '));
        const odd = a.beh.slice(FARM_ANIM_BEH_ODD).reduce((x, y) => x + y, 0);
        L.push(`  behaviour            ${a.live - odd} ordinary, ${odd} distorted ` +
               `(${a.beh.map((n, i) => n ? FARM_ANIM_BEH_NAMES[i] + ':' + n : null).filter(Boolean).join(' ')})`);
      }
    }

    // --- Where the player is standing, in street-hierarchy terms.
    const px = Math.floor(g.player.position.x), pz = Math.floor(g.player.position.z);
    if (isStaticSuburbiaWorldPos(px, pz)) {
      const code = w._subSurfaceAt(px, pz);
      const names = ['lawn', 'verge', 'sidewalk', 'kerb', 'road', 'centre line', 'gutter pan', 'road patch'];
      const bx = Math.floor(px / SUB_P), bz = Math.floor(pz / SUB_P);
      L.push('');
      L.push(`player at ${px},${pz} — standing on ${names[code]}`);
      L.push(`superblock ${bx},${bz}  (${w._subCollector(bx) ? 'collector' : 'residential'} N-S, ` +
             `${w._subCollector(bz) ? 'collector' : 'residential'} E-W` +
             `${w._subCulDeSac(bx, bz) ? ', has a cul-de-sac' : ''})`);
      const lots = w._suburbiaLotsAround(g.player.position, 64);
      L.push(`lots within 64 blocks: ${lots.length}  [` +
             lots.slice(0, 6).map(l => l.arch.name).join(', ') + (lots.length > 6 ? ', ...' : '') + ']');

      /* PHASE 15 — the recognition composition of the streets the player can actually
         see. These are the numbers that decide whether the dimension reads as a suburb
         with something wrong in it or as a funhouse. */
      let motifs = 0, twins = 0, revised = 0;
      const byMotif = new Array(SUB_MOTIFS.length).fill(0);
      for (const l of lots) {
        const mi = w._subMotifIndex(l);
        if (mi >= 0) { motifs++; byMotif[mi]++; }
        if (w._subSig(l).twin) twins++;
        if (w._subStageOf(l)) revised++;
      }
      L.push(`recognition            ${motifs}/${lots.length} carry a motif ` +
             `[${byMotif.join('/')}], ${twins} twinned, ${revised} revised`);
      const here = w._subHouseAt(g.player.position);
      if (here) {
        const mi = w._subMotifIndex(here);
        const st = w._subStageOf(here);
        const eff = [];
        for (let k = 1; k <= st; k++) eff.push(w._subStageEffect(here, k));
        L.push(`inside                 ${here.arch.name} @ ${here.hx},${here.hz} — ` +
               `motif ${mi < 0 ? 'none' : SUB_MOTIFS[mi].model}, ` +
               `${w._subSig(here).twin ? 'TWIN, ' : ''}` +
               `${w.suburbiaVisits.get(w._subLotKey(here)) || 0} visits, ` +
               `${st} revisions${eff.length ? ' [' + eff.join(',') + ']' : ''}`);
      }
    }

    /* --- DETERMINISM, against what is on screen. Regenerates each resident Suburbia
       chunk from scratch and diffs it against the live data. Any difference would mean
       a chunk's contents depend on load order or on mutable state — the exact failure
       that makes an infinite streaming world fall apart. Player edits show up here as
       differences, which is correct and expected. */
    if (deep) {
      let checked = 0, differing = 0;
      const t0 = performance.now();
      for (const c of w.chunks.values()) {
        if (!isStaticSuburbiaChunk(c.cx, c.cz)) continue;
        const probe = new Chunk(c.cx, c.cz, w);
        w._genSuburbiaChunk(probe);
        checked++;
        for (let i = 0; i < probe.data.length; i++) {
          if (probe.data[i] !== c.data[i]) { differing++; break; }
        }
      }
      L.push('');
      L.push(`determinism: regenerated ${checked} resident Suburbia chunks in ` +
             `${(performance.now() - t0).toFixed(0)}ms — ${differing} differ` +
             (differing ? ' (player edits count as differences)' : ''));
    } else {
      L.push('');
      L.push('call debugSuburbiaAudit(true) to also re-verify deterministic regeneration');
    }

    console.log(L.join('\n'));
    return undefined;
  };

  /* =====================================================================================
     PHASE 34.2 — THE AUDIO DEBUG OVERLAY.

     DEVELOPER ONLY, AND IT DOES NOT EXIST UNTIL IT IS ASKED FOR. No element is created,
     no listener is bound and no frame callback is scheduled at load time; a normal player
     cannot reach it because reaching it means typing into a console. `debugAudioOverlay()`
     toggles, `debugAudioOverlay(false)` forces it off, and turning it off removes the
     element and cancels the frame callback so nothing is left behind.

     WHY IT EXISTS. Phase 34 and 34.1 both shipped with green suites and a nearly silent
     game, and both times the gap was diagnosed by reading source and guessing. This
     answers the questions that actually matter — is the context running, is a bed really
     on a source or only claimed in the slot table, what gain did the last cue leave at,
     which surface is under the feet — from the live session, while it is being played.

     IT READS AND RENDERS. It calls nothing that makes a sound, changes no level, and
     holds no state of its own beyond the element and the frame handle. */
  let audioOverlay = null;
  global.debugAudioOverlay = function (on) {
    const g = game(); if (!g) return console.warn('DEV: game not ready');
    const want = (on === undefined) ? !audioOverlay : !!on;
    if (!want) {
      if (audioOverlay) {
        if (audioOverlay.raf) cancelAnimationFrame(audioOverlay.raf);
        if (audioOverlay.el && audioOverlay.el.parentNode) audioOverlay.el.parentNode.removeChild(audioOverlay.el);
        audioOverlay = null;
      }
      console.log('DEV: audio overlay off');
      return false;
    }
    if (audioOverlay) return true;
    const el = document.createElement('div');
    el.id = 'audioDebugOverlay';
    el.setAttribute('style', [
      'position:fixed', 'top:8px', 'right:8px', 'z-index:9999',
      'font:11px/1.45 ui-monospace,Menlo,Consolas,monospace',
      'color:#cfc7b4', 'background:rgba(10,10,12,0.82)', 'border:1px solid rgba(190,180,150,0.22)',
      'padding:8px 10px', 'white-space:pre', 'pointer-events:none',
      'max-height:92vh', 'overflow:hidden', 'text-shadow:0 1px 0 #000',
    ].join(';'));
    document.body.appendChild(el);
    audioOverlay = { el, raf: 0 };

    const dbfs = (v) => (!v || v <= 0) ? '  -inf' : (20 * Math.log10(v)).toFixed(1).padStart(6);
    const draw = () => {
      const s = g.sound, lib = s && s.library, d = s && s.director;
      const L = [];
      L.push('AUDIO  ' + (s && s.ctx ? s.ctx.state.toUpperCase() : 'NO CONTEXT') +
             (s && s.ctx ? '  ' + Math.round(s.ctx.sampleRate / 1000) + 'kHz' : ''));
      const dim = g.player.inFakeHaven ? 'haven' : g.player.inSuburbia ? 'suburbia'
                : g.player.inFarmlands ? 'farmlands' : 'overworld';
      L.push('dim    ' + dim + (g.env && g.env.isNight ? '  night' : '  day') +
             (g._audioIndoors ? '  indoors' : ''));
      L.push('scene  ' + (d ? (d.scene || '(none)') : '-'));
      if (s) {
        const bus = (n) => s[n] ? dbfs(s[n].gain.value) : '   n/a';
        L.push('bus    master' + bus('master') + '  user' + bus('userGain'));
        L.push('       music ' + bus('musicBus') + '  sfx ' + bus('sfxBus') +
               '/' + bus('sfxUnityBus') + '  amb' + bus('ambienceBus'));
      }
      if (lib) {
        /* THE DISTINCTION THIS OVERLAY EXISTS FOR. A slot can be CLAIMED without ever
           having started — setBed marks it before the decode lands and leaves it marked
           if the load fails — so a bed is only reported LIVE when it is on a real source
           at a real gain. Anything else says so. */
        L.push('beds   ' + lib.slots.size + ' slot(s), ' + lib.voices + ' voice(s), ' +
               lib.buffers.size + ' decoded');
        for (const [slot, e] of lib.slots) {
          const state = e.starting ? 'LOADING' : (e.src && e.gain ? 'LIVE   ' : 'DEAD   ');
          const lvl = e.gain ? dbfs(e.gain.gain.value) : '      ';
          L.push('  ' + state + ' ' + slot.padEnd(10) + e.key.padEnd(22) + lvl);
        }
        L.push('last   ' + (lib.last ? lib.last.key + '  g=' + lib.last.gain +
                            '  [' + lib.last.bus + ']' : '(nothing yet)'));
        const st = lib.stats;
        L.push('count  played ' + st.played + '  dropped ' + st.dropped +
               '  failed ' + st.failed + '  req ' + st.requested);
        if (lib.failed.size) {
          const f = Array.from(lib.failed);
          L.push('DEAD   ' + f.slice(0, 4).join(', ') + (f.length > 4 ? ' +' + (f.length - 4) : ''));
        }
      }
      if (d) {
        const surf = d.lastStepSurface();
        const fam = surf && AUDIO_STEP_SURFACES[surf] ? AUDIO_STEP_SURFACES[surf].key : '-';
        L.push('step   ' + (surf || '(none yet)') + '  ->  ' + fam);
        L.push('events ' + (d._evTable ? 'next in ' + Math.max(0, d._evTimer).toFixed(1) + 's' +
               '  gap ' + JSON.stringify(d._evTable.gap) : '(no table)') +
               '  fired ' + d.stats.events);
      }
      audioOverlay.el.textContent = L.join('\n');
      audioOverlay.raf = requestAnimationFrame(draw);
    };
    draw();
    console.log('DEV: audio overlay on — debugAudioOverlay(false) to remove it');
    return true;
  };

  /* =====================================================================================
     PHASE 34.3 — THE FORENSIC TRACE.

     `debugAudioOverlay()` answers "what does the system think it is doing". This answers
     the question that actually found the fault: "does any of it reach the listener", and
     it separates the four claims that Phase 34.2 established are different — REQUESTED,
     STARTED, CONNECTED and AUDIBLE.

     IT MEASURES RATHER THAN INFERS. An AnalyserNode is hung off each bus for the length
     of the call and removed again; an analyser whose output goes nowhere is a pure
     observer and cannot change the mix. That is the difference between reading a gain
     value — which was 0.85 and correct on every silent bed in every playtest — and
     reading the signal, which was zero.

     READ-ONLY AND SELF-CLEANING. It plays nothing, moves no level, and every node it
     builds is disconnected before it returns. */
  global.debugAudioTrace = function (seconds) {
    const g = game(); if (!g) return console.warn('DEV: game not ready');
    const s = g.sound, lib = s && s.library, d = s && s.director, c = s && s.ctx;
    if (!c) return console.warn('DEV: no AudioContext yet — click something first');
    const secs = Math.max(0.4, Math.min(8, seconds || 1.6));
    const names = ['master', 'userGain', 'musicBus', 'sfxBus', 'sfxUnityBus', 'ambienceBus'];
    const taps = {};
    for (const n of names) {
      if (!s[n]) continue;
      try {
        const an = c.createAnalyser(); an.fftSize = 2048;
        s[n].connect(an);
        taps[n] = { an, buf: new Float32Array(an.fftSize), rms: 0, peak: 0 };
      } catch (e) { /* a bus that refuses a tap is simply not reported */ }
    }
    const dbfs = (v) => (!v || v <= 0) ? '  -inf' : (20 * Math.log10(v)).toFixed(1).padStart(6);
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const tick = () => {
      for (const k in taps) {
        const t = taps[k];
        t.an.getFloatTimeDomainData(t.buf);
        let sum = 0, pk = 0;
        for (let i = 0; i < t.buf.length; i++) {
          const v = t.buf[i]; sum += v * v;
          if (Math.abs(v) > pk) pk = Math.abs(v);
        }
        const r = Math.sqrt(sum / t.buf.length);
        if (r > t.rms) t.rms = r;
        if (pk > t.peak) t.peak = pk;
      }
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (now - t0 < secs * 1000) { requestAnimationFrame(tick); return; }
      report();
    };
    const report = () => {
      const L = [];
      const busGain = (n) => (s[n] ? s[n].gain.value : 0);
      L.push('WHERE IT ISN\u2019T \u2014 AUDIO FORENSIC TRACE (' + secs.toFixed(1) + 's)');
      L.push('');
      L.push('CONTEXT   state ' + c.state + '   rate ' + c.sampleRate +
             '   time ' + c.currentTime.toFixed(1) + 's');
      L.push('ORIGIN    ' + (typeof location !== 'undefined' ? location.protocol : '?') +
             (AUDIO_TRANSPORT_BLOCKED ? '   TRANSPORT BLOCKED \u2014 no recording can load' : '   ok'));
      if (lib) {
        L.push('LIBRARY   requested ' + lib.stats.requested + '  loaded ' + lib.stats.loaded +
               '  failed ' + lib.stats.failed + '  decoded ' + lib.stats.decoded +
               '  played ' + lib.stats.played + '  dropped ' + lib.stats.dropped);
        L.push('          transportDead() = ' + lib.transportDead());
      }
      L.push('');
      L.push('BUS GAIN  master ' + dbfs(busGain('master')) + '   user ' + dbfs(busGain('userGain')));
      L.push('          music  ' + dbfs(busGain('musicBus')) + '   sfx  ' + dbfs(busGain('sfxBus')) +
             ' / ' + dbfs(busGain('sfxUnityBus')) + '   amb ' + dbfs(busGain('ambienceBus')));
      L.push('');
      L.push('MEASURED  (what actually flowed, not what was asked for)');
      for (const n of names) {
        if (!taps[n]) continue;
        L.push('  ' + n.padEnd(12) + 'rms ' + dbfs(taps[n].rms) + '   peak ' + dbfs(taps[n].peak) +
               (taps[n].rms > 0 ? '' : '   \u2190 SILENT'));
      }
      L.push('');
      L.push('SCENE     ' + (d ? (d.scene || '(none)') : '-') +
             '   dim ' + (g._audioDim || '?') + (g._audioIndoors ? '  indoors' : '  outdoors'));
      if (lib) {
        L.push('BEDS      ' + lib.slots.size + ' slot(s)');
        for (const [slot, e] of lib.slots) {
          const a = AUDIO_ASSETS[e.key];
          const state = e.starting ? 'REQUESTED  (never started)'
                      : (e.src && e.gain ? 'STARTED + CONNECTED' : 'CLAIMED, DEAD');
          L.push('  ' + slot.padEnd(10) + (e.key + '').padEnd(22) +
                 (a ? (a.f || 'steps') : '?').padEnd(14) + state);
          L.push('      level ' + (e.gain ? e.gain.gain.value.toFixed(3) : 'n/a') +
                 '   decoded ' + (lib.isLoaded(e.key) ? 'yes' : 'NO') +
                 '   spatialised NO (beds are non-positional by construction)');
        }
      }
      /* THE LAST ONE-SHOT, WITH THE WHOLE CHAIN SPELLED OUT. This is where a distance
         actually applies, and where the arithmetic is worth printing rather than
         trusting: authored gain, what the falloff left of it, and what the buses do. */
      if (lib && lib.last) {
        const l = lib.last;
        const bus = l.bus === 'music' ? 'musicBus' : l.bus === 'sfx' ? 'sfxUnityBus' : 'ambienceBus';
        const chain = l.gain * busGain(bus) * busGain('master') * busGain('userGain');
        L.push('');
        L.push('LAST CUE  ' + l.key + '   bus ' + l.bus + ' (' + bus + ')');
        L.push('          source gain ' + l.gain + '  \u00d7 bus ' + busGain(bus).toFixed(3) +
               '  \u00d7 master ' + busGain('master').toFixed(3) +
               '  \u00d7 user ' + busGain('userGain').toFixed(3));
        L.push('          estimated at the listener ' + dbfs(chain) + ' dBFS');
      }
      L.push('');
      L.push('LISTENER  the recorded path uses NO PannerNode and NO AudioListener.');
      L.push('          Beds are gain \u2192 bus. World one-shots are gain \u2192 lowpass \u2192');
      L.push('          stereo pan \u2192 bus, with distance applied as an explicit');
      L.push('          multiplier in playAt(). There is no listener position to be wrong.');
      for (const k in taps) { try { s[k].disconnect(taps[k].an); } catch (e) { /* gone */ } }
      console.log(L.join('\n'));
    };
    tick();
    return 'measuring for ' + secs.toFixed(1) + 's\u2026';
  };

  /* =====================================================================================
     PHASE 34.3 — THE A/B PROBE.

     Plays ONE named asset two ways so the two can be compared by ear and by meter:

       debugAudioProbe('bed.overworld.day')            flat   \u2014 no distance, no filter,
                                                              no pan, at a clearly audible
                                                              test gain
       debugAudioProbe('sfx.crow', 'spatial')          spatial \u2014 exactly what the game
                                                              does, at the game's own gain
                                                              and a representative distance

     DIAGNOSTIC ONLY. It calls the real library, changes no level, latches nothing, and
     leaves no state behind: the sound plays out and the voice releases itself like any
     other. Nothing about gameplay is altered by having used it. */
  global.debugAudioProbe = function (key, mode, distance) {
    const g = game(); if (!g) return console.warn('DEV: game not ready');
    const s = g.sound, lib = s && s.library;
    if (!lib) return console.warn('DEV: no audio library yet — click something first');
    if (!key || !AUDIO_ASSETS[key]) {
      console.log('DEV: usage debugAudioProbe(key[, "flat"|"spatial"][, metres])');
      console.log('DEV: beds: ' + Object.keys(AUDIO_ASSETS).filter((k) => AUDIO_ASSETS[k].k === 'bed').slice(0, 8).join(', ') + ' \u2026');
      return false;
    }
    const spatial = (mode === 'spatial');
    const d = Math.max(1, distance || 60);
    if (!lib.isLoaded(key)) {
      lib.load(key).then((b) => console.log('DEV: ' + key + (b ? ' decoded — call again to hear it'
                                                              : ' COULD NOT LOAD (transportDead=' + lib.transportDead() + ')')));
      return 'loading ' + key + '\u2026';
    }
    let ok;
    if (spatial) {
      const ang = Math.random() * Math.PI * 2;
      ok = lib.playAt(key, Math.sin(ang) * d, Math.cos(ang) * d, d,
                      { gain: 0.3, ref: 26, max: 200, floor: 0.7, bus: 'amb' });
      console.log('DEV: ' + key + ' SPATIAL at ' + d + 'm, the shipped curve, on ambienceBus');
    } else {
      ok = lib.play(key, { gain: 0.85, bus: 'amb' });
      console.log('DEV: ' + key + ' FLAT — no distance, no lowpass, no pan, gain 0.85, ambienceBus');
    }
    console.log('DEV: started = ' + ok + (ok ? '' : '  (not loaded, a ceiling, or the library is off)'));
    return ok;
  };

  global.debugTeleportHelp = function () {
    console.log([
      'WHERE IT ISN\u2019T — DEV TELEPORTS',
      '  debugTeleportToOverworld()          Normal Overworld, at the world spawn',
      '  debugTeleportToFarmlands()          Level 2 — The Shattered Farmlands (Phase 16 streaming)',
      '  debugTeleportToFarmHome()           Farmlands, on the approach, looking at the Disconnected Home',
      '  debugTeleportToWaterTower(dist)     Farmlands, on the journey lane `dist` blocks west of the tower',
      '  debugFarmJourney()                  The Phase 20 journey, beat by beat, as coordinates',
      '  debugGrantCompass()                 PHASE 20.2 — earn the compass now, and report the heading',
      '  debugOpeningInstruction()           PHASE 20.2 — replay "At the crossroads, go east."',
      '  debugTeleportToSuburbia()           Level 3 — Static Suburbia (Phase 9 streaming)',
      '  debugTeleportToFakeHaven()          Level 4 — The Fake Haven (peaceful, 30s countdown)',
      '  debugTeleportToDisconnectedHome()   Suburbia, standing in front of the upside-down house',
      '  debugTeleportHelp()                 This list',
      '',
      'WHERE IT ISN\u2019T — DIAGNOSTICS',
      '  debugSuburbiaAudit()                Resident chunks, quads, lights, registries',
      '  debugSuburbiaAudit(true)            ...and re-verify deterministic regeneration',
      '  debugFarmlandsRoutes()              PHASE 18.1 — top-down map of the nearest lane,',
      '                                      plus straight-run and bend statistics',
      '  debugFarmlandsRoutes(n)             ...over n blocks of road (default 1200)',
      '  debugFarmlandsAnimals()             PHASE 18 — census the animals, signs and roads',
      '                                      around the player: species, condition tiers,',
      '                                      behaviour classes, nearest signs and what they',
      '                                      name, and the live/pooled resource counts',
      '  debugFarmlandsAnimals(r)            ...over a radius of r blocks (default 96)',
      '  debugFarmlandsAudit()               Resident chunks, quads, lights, decor objects,',
      '                                      progression, and the parcel/lane/biome you are',
      '                                      standing in',
      '  debugFarmlandsAudit(true)           ...and re-verify deterministic regeneration',
      '  debugAudioOverlay()                 PHASE 34.2 — toggle the live audio readout:',
      '                                      context state, dimension, scene, bus levels,',
      '                                      every bed and whether it is LIVE or only',
      '                                      claimed, the last cue and its gain, the',
      '                                      footstep surface and family, the event',
      '                                      countdown, and any dead assets',
      '  debugAudioOverlay(false)            ...remove it',
      '  debugAudioTrace()                   PHASE 34.3 — MEASURE what reaches the ear:',
      '                                      taps every bus for a second and prints the',
      '                                      signal, not the gain values. Separates',
      '                                      requested / started / connected / audible,',
      '                                      and reports the origin and transport state',
      '  debugAudioTrace(secs)               ...over a longer window',
      '  debugAudioProbe(key)                PHASE 34.3 — play one asset FLAT: no',
      '                                      distance, no filter, no pan, clearly audible',
      '  debugAudioProbe(key, "spatial", m)  ...and the same asset through the shipped',
      '                                      distance curve, for comparison',
      '',
      'Both audits are READ-ONLY: they touch no voxel, spawn nothing, and allocate nothing',
      'that outlives the call, so they are safe to run mid-session without perturbing a',
      'playtest. The deep form additionally regenerates each resident chunk of that',
      'dimension into a scratch buffer and throws it away.',
      '',
      'Each teleport performs a full transition: entity teardown, chunk flush, region',
      'rebuild, eager chunk load, dimension flags, player reset, environment and audio.',
      'Progression is not modified except where the destination requires it (the Fake',
      'Haven latches behemothSpawned/fakeHavenTriggered), and those are restored',
      'automatically when you teleport back out. No Core Disks are granted.',
    ].join('\n'));
  };
})(typeof window !== 'undefined' ? window : globalThis);
