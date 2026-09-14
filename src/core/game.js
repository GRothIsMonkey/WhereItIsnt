"use strict";
/* =====================================================================================
   Game — THE APPLICATION ORCHESTRATOR
   ERA 1.5.4 — EXTRACTED VERBATIM FROM game.html.

   Composition root, lifecycle, save orchestration, dimension transitions, settings and
   audio policy, and the frame loop. It coordinates subsystems; it authors no content.

   This is a CLASSIC script, not an ES module. It shares one global lexical scope with
   every other file in src/ and with game.html's inline <script>, which is why the move
   needed no code change. Load order is declared in game.html and mirrored by
   tests/harness/load.js; see ARCHITECTURE.md.
   ===================================================================================== */

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    /* PHASE 22 — settings are constructed FIRST, before anything reads a quality knob, so
       the very first frame is already drawn at the player's chosen quality rather than at
       High and then corrected. Storage is passed in rather than reached for, so a browser
       that blocks site data degrades to defaults instead of throwing during boot. */
    this.settings = new GameSettings(safeLocalStorage());
    this.settings.onChange((key) => this._onSettingChanged(key));
    this.running = false;    // PHASE 22 — true once _beginPlay has entered the frame loop
    /* PHASE 23 — the save slot. Constructed beside the settings and given the same
       probed storage handle, so a browser that blocks site data loses saving exactly the
       way it loses settings: cleanly, with the game still playable. */
    this.saves = new SaveSystem(safeLocalStorage());

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 400);

    this.sound = new SoundEngine();

    this.itemManager = new ItemEntityManager(this.scene);

    const atlasInfo = buildBlockAtlas();
    this.world = new VoxelWorld(this.scene, atlasInfo, this.itemManager);
    // PHASE 14 — the door swing plays a latch click; this is the handle it uses.
    this.world.soundEngine = this.sound;
    // PHASE 1 — dropped items need the voxel world for gravity/collision. The manager is
    // constructed first (VoxelWorld takes it as a dependency), so it's back-linked here.
    this.itemManager.setWorld(this.world);
    this.anchorManager = new AnchorMonumentManager(this.scene, this.world, this.sound);
    this.world.setAnchorManager(this.anchorManager);

    this.ui = new UIManager();
    this.player = new PlayerController(this.camera, this.world, this.canvas, this.sound, this.ui);
    this.ui.bindPlayer(this.player);

    this._placeStarterTorch();

    this.env = new EnvironmentSystem(this.scene, this.renderer);
    this.ashParticles = new AshParticleSystem(this.scene); // Level 2 — Ashen Forest cinder flakes
    /* ERA 1.5.6 CUT B — Sanity is handed a five-query VIEW of the world, not the world,
       and not the HUD. See src/world/sanity-world-view.js. */
    this.sanityWorldView = new SanityWorldView(this.world);
    this.sanity = new SanitySystem(this.env, this.sanityWorldView);
    this.stalker = new StalkerAI(this.scene, this.world, this.sound, this.ui);
    this.phantoms = new PhantomHallucinator(this.scene, this.world, this.sound);
    this.mobs = new MobManager(this.scene, this.world, this.itemManager, this.sound);
    /* PHASE 18 — Farmlands world life. Constructed here beside MobManager but sharing
       nothing with it: animals are not mobs, never enter this.mobs, and are skipped
       entirely by every combat, aggro and spawn path in the game. */
    this.farmAnimals = new FarmAnimalManager(this.scene, this.world, this.sound);
    this.world.farmAnimals = this.farmAnimals;
    this.arrows = new ArrowManager(this.scene, this.world);
    this.postfx = new PostFX(this.renderer, this.scene, this.camera);

    /* PHASE 22 — everything the settings touch now exists, so apply them for real. The
       player, the UI panel and the fullscreen watcher are wired here too. */
    this.player.settings = this.settings;
    this.ui.attachSettings(this.settings, () => this._resumeFromSettings());
    this._applyGraphicsQuality();
    this._applyAudioSettings();
    this._watchFullscreen();
    /* PHASE 34.2 — one delegated click voice for the whole interface, and the one place
       a suspended AudioContext is brought back. Both bind listeners only. */
    this._bindInterfaceAudio();
    this._watchAudioContext();
    /* PHASE 34.3 — the origin case is knowable NOW, before an AudioContext exists and
       before the player has pressed anything, so the notice is on the start screen
       rather than arriving after they have already played a silent minute. The runtime
       case (a served build whose files are missing) is caught later, in the frame path. */
    this._reportAudioTransport();

    this.ui.updateVitals(this.player);

    this.clock = new THREE.Clock();
    this.stalkerDistance = Infinity;

    // Progression tracking: escalating "Stages" replace the old instant page-reload win.
    this.wasNight = false;
    this.memoryFragments = 0;
    this.stage = 1;
    this.dayCount = 1;
    this.nightsRequired = 2 + this.stage; // Stage 1 needs 3 survived nights, then it grows
    this.awaitingAdvance = false;
    this.behemothDefeated = false; // bonus-directive tracking (step 6)
    this.behemothSpawned = false; // Night 3 spawn-once gate for the Hollowed Behemoth
    /* PHASE 26 — THE DIRECT-PROGRESSION LATCH SET, and it is a Set of ids, not a number.
       Membership is the whole of it: an id is either in here or it is not, nothing counts
       up toward one, and there is no order in which they must be reached. It sits in this
       block beside compassAcquired and behemothDefeated because it is the same kind of
       thing they are — a record of something that happened, which the save carries. */
    this.milestones = new Set();
    /* PHASE 28 — WHICH ONBOARDING CUES HAVE BEEN ANSWERED, and it is the same kind of
       thing for the same reason: a Set of ids recording something that happened, sitting
       in the progression block so the save carries it. It gates nothing but whether three
       two-word lines are still owed above the hotbar; see ONBOARDING_CUES. A New Game
       clears it, which is why a new player gets the cues and a returning one does not. */
    this.onboarding = new Set();
    /* PHASE 20.2 — THE COMPASS, and it lives HERE on purpose.

       Requirement 10 asks that it go into the canonical progression rather than an
       isolated flag, so it sits in this block beside the other one-shot progression
       latches — the same object a future Phase 23 save file will serialise and restore.
       It is deliberately NOT an inventory item: an item can be dropped, burned in a
       chest, or lost on death, and a navigation aid the player can permanently lose is a
       trap rather than a tool. It is also not per-dimension state; once true it stays
       true, which is what "remains available permanently across dimensions" means. */
    this.compassAcquired = false;
    // LEVEL 2 — THE SHATTERED FARMLANDS: true while the win screen currently showing
    // is the Rift Core's dimension-transition prompt, so the shared button knows to
    // route to _transitionToLevel2() instead of the normal _advanceStage() flow.
    this.pendingLevel2Transition = false;
    // LEVEL 4 — THE FAKE HAVEN: one-shot latch so the illusion sequence can only ever
    // fire once, no matter how many frames the Disk sits in the inventory.
    this.fakeHavenTriggered = false;
    // --- Haven Shift / final sequence / climax state (PHASE 5B, 32, 33) ---
    this.havenTimer = 0;              // seconds spent in the Haven pre-shift
    this.havenStageId = null;         // PHASE 32 — last applied HAVEN_STAGES id
    this.havenBedEnding = false;      // PHASE 32 — the ending was chosen, not reached
    this.havenShiftTriggered = false; // latch: the illusion has collapsed
    this.havenShiftElapsed = 0;       // seconds since the collapse
    this.climaxTriggered = false;     // latch: hard cut to black has fired
    // Camera shake state (see shake() / _updateCameraShake()).
    this.shakeAmount = 0; this.shakeDuration = 0; this.shakeTime = 0;
    // End-credits stat tracking. Sets rather than counters so repeated pickups or
    // re-entries can never inflate the totals.
    this.riftDisksCollected = new Set();
    this.dimensionsBreached = new Set([DIMENSION.OVERWORLD]);
    // The bed's rest interaction needs to reset Sanity, so give the player a handle
    // on the SanitySystem (it's otherwise owned solely by the Game loop).
    this.player.sanitySystem = this.sanity;
    /* PHASE 20.2 — and a handle on the Game itself, for the same reason and by the same
       pattern: the chest-opening branch lives in PlayerController but the progression it
       advances is owned here. One explicit reference beats polling a flag every frame,
       and beats duplicating the latch on both objects. */
    this.player.progression = this;

    window.addEventListener('resize', () => this._onResize());
    /* PHASE 28 — BEGIN EXPEDITION IS NOW THE ONLY DOOR, and it opens onto the game.
       It used to open the tutorial, with a second "SKIP TUTORIAL & DROP IN NOW" link
       beside it going straight to _start(). Two buttons, one of which existed to undo
       the other. There is one now, and it is the one that was already correct. */
    document.getElementById('clickPlay').addEventListener('click', () => this._start());
    // PHASE 22 — settings are reachable before the game begins as well as during it.
    document.getElementById('startSettingsLink').addEventListener('click', () => this.ui.toggleSettings());
    /* PHASE 23 — CONTINUE. Hidden unless a save that actually validates exists, so the
       button can never offer to resume something the loader would then refuse. */
    const continueBtn = document.getElementById('continuePlay');
    if (continueBtn) continueBtn.addEventListener('click', () => this.continueFromSave());
    this.ui.attachSaveActions({
      save: () => this.saveGame('manual'),
      load: () => { const r = this.loadGame(); if (r.ok) this.ui.closeSettings(); return r; },
      newGame: () => { this.newGame(); this.ui.closeSettings(); if (!this.running) this._start(); },
      describe: () => { const st = this.saves.peek(); return st ? describeSaveState(st) : null; },
    });
    this._refreshContinueButton();
    document.getElementById('nextLevelBtn').addEventListener('click', () => {
      if (this.pendingLevel2Transition) this._transitionToLevel2();
      /* PHASE 36 — the Behemoth's screen and the stage screen are the same element and
         they are not the same event. See UIManager.triggerBossVictory. */
      else if (this.ui.winScreenMode === 'boss') this._dismissBossVictory();
      else this._advanceStage();
    });

    /* PHASE 25 — THE OBJECTIVE SYSTEM. Constructed after the UI and every system its
       snapshot reads, and given the UI so it can write the one line it owns. It holds no
       progression of its own beyond one integer per chain; everything else it derives. */
    this.objectives = new ObjectiveSystem(this.ui);
    this._objectiveSnapshotFn = () => this._objectiveSnapshot();

    // PHASE 20.2 — the closing beat of the (Phase 30) opening film, authored early
    // because the whole Farmland journey depends on the player having heard it.
    this.openingInstruction = new OpeningInstruction(this.sound);
    /* PHASE 30 — the opening film, which plays the instruction above as its closing beat
       rather than reimplementing it. Constructed once; begin() is called only from
       _start(), which is the New Game path and the only one. */
    /* PHASE 31 — ENVIRONMENTAL STORYTELLING. Constructed before anything asks it a
       question, and handed to the world, because chunk generation is the only caller
       that matters. It owns a latch set and nothing else: no geometry, no UI, no timer.
       The world's own constructor has already eagerly generated the chunks around spawn
       by this point, which is fine and documented — see VoxelWorld._envStoryStamp. */
    this.envStory = new EnvironmentStorySystem(this);
    this.world.envStory = this.envStory;

    this.film = new OpeningFilm(this);
    /* PHASE 33 — the final sequence. Constructed once, here, beside the other cinematic,
       because they are the same kind of object and share the same disciplines: a frozen
       beat table, one accumulating number, no timers, one teardown. begin() is called
       only from _triggerHavenShift, which is the Phase 32 boundary and the only caller. */
    this.finale = new FinalSequence(this);
    this.farmCrossroadsRecalled = false;   // one-shot latch for the Farmlands recall
    /* PHASE 29 — the menu, and the only one. A seed may be forced for testing so a run
       can be made to contain a walker; without one the schedule follows the wall clock
       and no two launches are the same. */
    this.menu = new MainMenu(this,
      (typeof window !== 'undefined' && window.WII_MENU_SEED !== undefined) ? window.WII_MENU_SEED : null);
    this.menu.show();

    this._animate = this._animate.bind(this);
  }


  /* ===================================================================================
     PHASE 23 — SAVE / LOAD ORCHESTRATION

     Four player-facing verbs — Save, Load, Continue, New Game — and exactly ONE path
     through the world underneath all of them: _applyRestoredState(). There is no second
     route that rebuilds the world, which is what makes "loading twice does not duplicate
     anything" a structural property rather than a thing to remember.
     =================================================================================== */

  /* The Fake Haven is the one place the game refuses to save. It is a terminal, scripted
     sequence — movement is taken away, the world behind the player has been flushed, and
     the whole thing ends in the credits under a minute later. There is no progression in
     it to preserve, and its cabin is built from scene props with no teardown path, so a
     "restore" would have to rebuild an illusion the game only ever builds once. Refusing
     honestly is better than restoring something broken. */
  saveBlockedReason() {
    if (this.player.inFakeHaven || this.fakeHavenTriggered || this.climaxTriggered) {
      return 'Not from here.';
    }
    if (this.player.movementLocked) return 'Not during this.';
    if (!this.running) return 'Nothing to save yet.';
    return null;
  }

  /* --- CAPTURE -------------------------------------------------------------------- */
  captureSaveState() {
    const p = this.player, w = this.world, a = this.anchorManager;
    const dimension = p.inFarmlands ? 'farmlands' : (p.inSuburbia ? 'suburbia' : 'overworld');

    const inventory = p.inventory.slots.map(s =>
      (s.item === ITEM.NONE || s.count <= 0) ? null : { item: s.item, count: s.count });

    let anchor = null;
    if (a.activeAnchor) {
      const ap = a.activeAnchor.pos;
      anchor = {
        x: Math.floor(ap.x), y: Math.floor(ap.y), z: Math.floor(ap.z),
        fuel: a.activeAnchor.fuel,
        riftActive: !!a.riftActive,
        riftTargetLevel: a.riftTargetLevel || null,
      };
    }

    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      dimension: dimension,
      player: {
        position: { x: p.position.x, y: p.position.y, z: p.position.z },
        yaw: p.yaw, pitch: p.pitch,
        hp: p.hp, maxHp: p.maxHp, dead: !!p.dead,
        /* PHASE 26 — what the removed XP system already bought. No counter and no level
           accompanies them; neither exists any more. */
        attackBonus: p.attackBonus, miningSpeedBonus: p.miningSpeedBonus,
        chestsOpened: p.chestsOpened || 0,
        selectedSlot: p.selectedSlot,
        inventory: inventory,
      },
      sanity: this.sanity.value,
      progression: {
        stage: this.stage,
        dayCount: this.dayCount,
        memoryFragments: this.memoryFragments,
        nightsRequired: this.nightsRequired,
        awaitingAdvance: !!this.awaitingAdvance,
        behemothDefeated: !!this.behemothDefeated,
        behemothSpawned: !!this.behemothSpawned,
        compassAcquired: !!this.compassAcquired,
        pendingLevel2Transition: !!this.pendingLevel2Transition,
        fakeHavenTriggered: !!this.fakeHavenTriggered,
        farmCrossroadsRecalled: !!this.farmCrossroadsRecalled,
        // PHASE 26 — the direct-progression latch set, in the table's own order.
        milestones: PROGRESSION_MILESTONE_IDS.filter(id => this.milestones.has(id)),
        // PHASE 28 — the onboarding cue latch set, in the table's own order.
        onboarding: ONBOARDING_CUE_IDS.filter(id => this.onboarding.has(id)),
        /* PHASE 31 — which pieces of environmental storytelling the player has stood in
           front of. Three ids at most, and they are saved for one reason: they decide
           whether a callback in a LATER dimension exists at all. Everything else this
           phase puts in the world is a pure function of the seed and is re-derived. */
        noticed: this.envStory.capture(),
        farmJourneyOrd: this.farmJourneyOrd || 0,
        farmHouseSeen: !!this.farmHouseSeen,
        killCount: this.mobs.killCount || 0,
        riftDisks: Array.from(this.riftDisksCollected),
        dimensionsBreached: Array.from(this.dimensionsBreached),
      },
      time: {
        cycleSeconds: this.env.cycleSeconds,
        wasNight: !!this.wasNight,
      },
      anchor: anchor,
      world: captureWorldState(w),
      /* PHASE 25 — one integer per objective chain, and nothing else. Everything the
         objective system shows is otherwise derived from state already in this file. */
      objectives: this.objectives.toJSON(),
      settings: this.settings.toJSON(),
    };
  }

  /* --- TEARDOWN -------------------------------------------------------------------
     Everything that could survive a load and become a duplicate is taken down here, and
     nothing is taken down anywhere else. Deliberately the same set the Level 4 flush
     clears, plus the world-level light registries that flush does not reach. */
  _teardownForRestore() {
    const w = this.world;

    this.mobs.clearAll(true);
    this.mobs.spawningDisabled = false;
    this.stalker.clearAll();
    this.phantoms.clearAll();
    this.arrows.clearAll();
    for (const e of this.itemManager.entities.slice()) e.destroy();
    this.itemManager.entities.length = 0;
    this.ashParticles.setActive(false);
    this.farmAnimals.destroyAll();
    this.stalkerDistance = Infinity;

    /* Lantern and Soul Anchor props are registered per world position rather than per
       chunk, so disposeChunk never takes them down. Left alone they would stack up one
       full set per load. */
    for (const k of Array.from(this.world.lanternLights.keys())) {
      const p = k.split(',');
      w._removeLanternLight(+p[0], +p[1], +p[2]);
    }
    for (const k of Array.from(this.world.soulAnchors.keys())) {
      const p = k.split(',');
      w._removeSoulAnchorZone(+p[0], +p[1], +p[2]);
    }

    /* wipeAllChunks clears the pin registry, disposes every chunk (pinned cores
       included) and tears down the standalone Suburbia/Home props, which is exactly what
       has to happen before the edit registry is replaced: a pinned chunk that survived
       would still be holding the PREVIOUS session's blocks. */
    w.wipeAllChunks();
    /* PHASE 32 — and the Haven pocket, which wipeAllChunks does not reach: it disposes the
       nine chunks but left `fakeHavenBuilt` true and every prop in the scene, so the next
       run reached an empty Haven and the current one kept a bed in its Overworld. See
       VoxelWorld._resetHavenPocket. Called AFTER wipeAllChunks because the chunks are
       that function's to dispose and this one's not to touch. */
    w._resetHavenPocket();
    w._genQueue.length = 0;
    w._queuedKeys.clear();
    w.mimicCandidates.clear();
    if (w._wQ) { w._wQ.length = 0; w._wPending.clear(); w._wAcc = 0; }
    w._subInsideLot = null;
    w._subInsideKey = null;
    w._subRecogTick = 0;
    w._subRecogCooldown = 0;
    if (w._subPending) w._subPending.clear();
    w._suburbiaRearrangeTimer = 0;
    /* PHASE 31 — the notice latch and the occupancy ledger. Cleared HERE, in the one
       teardown both a New Game and a Load pass through, so a callback earned in a
       previous world can never survive into a new one. _applySaveState restores the
       latch immediately afterwards for a Load; a New Game keeps the empty set. */
    this.envStory.reset();

    this.anchorManager.removeAnchor();

    // UI: nothing modal may survive a load.
    if (this.ui.storageOpen) this.ui.closeStorage();
    if (this.ui.craftingOpen) this.ui.toggleCrafting();
    if (this.ui.backpackOpen) this.ui.toggleBackpack();
    this.ui.hideWinScreen();
    /* PHASE 27 — and nothing PAINTED may survive one either. This clears the HUD's
       presentation cache and every transient element, so the restore that follows
       repaints from the state it just applied rather than skipping a write because the
       cache still holds the previous run's value. See UIManager.resetPresentation. */
    this.ui.resetPresentation();
    /* PHASE 34 — and nothing SOUNDING may survive one either. Every bed goes down, the
       Haven and finale sequences are released, and the scene is forgotten so the next
       frame rebuilds it from where the player has actually landed. Decoded buffers are
       deliberately kept: re-entering a dimension should not re-download it. */
    if (this.sound && this.sound.director) this.sound.director.reset();
    /* PHASE 34.1 — and the frame path's own memory of where the player was. Without this a
       New Game inherits the previous run's dimension (so the neighbouring beds are never
       warmed) and its indoor latch (so a player who saved inside a house starts the next
       run hearing a room). */
    this._audioDim = null;
    this._audioIndoors = false;
    this._audioIndoorRaw = undefined;
    this._audioIndoorHold = 0;

    // Player body: no residual motion, mining, lock or death.
    const p = this.player;
    if (p._respawnTimer) { clearTimeout(p._respawnTimer); p._respawnTimer = null; }
    p.velocity.set(0, 0, 0);
    p.dead = false;
    p.mining = false;
    p.movementLocked = false;
    p.breakProgress = 0;
    p.miningHitTimer = 0;
    p.swingTimer = 0;
    p.attackCooldown = 0;
    p.invulnTimer = 0;
    p.stationaryTimer = 0;
    p.walkDistance = 0;
    p.footstepTimer = 0;
    p.waterClimb = 0;
    p.inDeepWater = false;
    p.wading = false;
    p.havenBedUsed = false;
    p.keys = {};
    if (p.highlight) p.highlight.hide();
    this.ui.setMiningProgress(0);

    // Game-level cinematic latches that are not progression.
    if (this.objectives) { this.objectives.currentId = null; this.objectives.currentText = null; }
    this.havenTimer = 0;
    this.havenShiftTriggered = false;
    this.havenShiftElapsed = 0;
    /* PHASE 32 — the stage machine's whole memory: which stage was last applied, so the
       frame loop can tell a stage CHANGE from a stage continuing. Null means "none
       applied yet", which is what makes the first frame of a Haven apply its stage
       instead of skipping it as unchanged. */
    this.havenStageId = null;
    this.havenBedEnding = false;
    /* PHASE 33 — and the final sequence, which owns a scene, an audio rig, a fog override
       and a hidden HUD. reset() runs its one teardown if it is mid-flight and clears the
       done latch, so a New Game taken from the credits can reach the ending again. */
    if (this.finale) this.finale.reset();
    this.climaxTriggered = false;
    this.shakeAmount = 0; this.shakeDuration = 0; this.shakeTime = 0;
  }

  /* --- APPLY ----------------------------------------------------------------------
     The order is the contract: registries before generation, generation before
     placement, placement before the player, the player before the HUD. */
  _applyRestoredState(state) {
    const w = this.world, p = this.player;
    const notes = [];

    this._teardownForRestore();

    // 1. WORLD REGISTRIES — replaced wholesale, before a single chunk is rebuilt.
    restoreWorldState(w, state.world);

    // 2. DETERMINISTIC WORLD — the region cores are rebuilt from the same generators the
    //    boot uses, and now replay the restored edits as they build.
    w._genFarmlandsRegion();
    w._genStaticSuburbiaRegion();

    /* 3. DIMENSION. ERA 1.5.6 — one total assignment from the save's own saveName,
       instead of three independent predicates. A save naming a dimension this build does
       not have, or the Haven (which is never saved), lands in the Overworld exactly as
       the three predicates did. */
    const savedDim = dimensionBySaveName(state.dimension);
    setPlayerDimension(p, savedDim ? savedDim.stableId : DIMENSION.OVERWORLD);

    // 4. THE GROUND UNDER THE PLAYER, before the player is put on it.
    const want = state.player.positionValid
      ? state.player.position
      : saveFallbackSpawn(w, state.dimension);
    w._eagerLoadAround(want.x, want.z, 3);

    const landing = findSafeLanding(w, state.dimension, want.x, want.y, want.z,
                                    p.halfWidth, p.height);
    if (!state.player.positionValid) notes.push('placed at the arrival point');
    else if (landing.repaired) notes.push(landing.reason);

    // 5. THE PLAYER.
    p.position.set(landing.x, landing.y, landing.z);
    p.yaw = state.player.yaw;
    p.pitch = state.player.pitch;
    p.maxHp = state.player.maxHp;
    p.hp = Math.max(1, Math.min(state.player.maxHp, state.player.hp));
    p.attackBonus = state.player.attackBonus;
    p.miningSpeedBonus = state.player.miningSpeedBonus;
    p.chestsOpened = state.player.chestsOpened;
    p.selectedSlot = state.player.selectedSlot;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const s = state.player.inventory[i];
      p.inventory.slots[i].item = s ? s.item : ITEM.NONE;
      p.inventory.slots[i].count = s ? s.count : 0;
    }
    /* spawnPosition is deliberately NOT recomputed here. It is the Overworld respawn
       point, it was resolved at boot while those chunks were resident, and re-deriving it
       from a world whose loaded footprint is currently in the Farmlands would read an
       ungenerated column and move it. */

    // 6. ANCHOR. The block itself came back with the edits; this restores the monument
    //    the block stands for, and re-pins its chunk exactly as placing it does.
    if (state.anchor) {
      const a = state.anchor;
      this.anchorManager.placeAnchor(a.x, a.y, a.z);
      this.anchorManager.activeAnchor.fuel = a.fuel;
      /* PHASE 35 — recorded as the Anchor's pin exactly as placing one records it, so a
         later dimension crossing releases it rather than leaving a loaded chunk of the
         previous dimension behind. */
      const apk = w.key(Math.floor(a.x / CHUNK_SX), Math.floor(a.z / CHUNK_SZ));
      w._anchorPinKey = w.pinnedChunkKeys.has(apk) ? null : apk;
      w.pinnedChunkKeys.add(apk);
      if (a.riftActive && a.riftTargetLevel) this.anchorManager.powerRiftCore(a.riftTargetLevel);
    }

    /* 7. PLACED LIGHT SOURCES inside the loaded footprint. Torches and portals are
       re-lit by the mesher's own light scan; lanterns and Soul Anchors are not in that
       scan, so their restored blocks are re-registered here. Bounded to chunks that are
       actually resident, so this can never add scene objects for ground the player is
       nowhere near. */
    for (const chunk of w.chunks.values()) {
      const edits = w.editedChunks.get(w.key(chunk.cx, chunk.cz));
      if (!edits) continue;
      for (const [idx, id] of edits) {
        if (id !== BLOCK.LANTERN && id !== BLOCK.SOUL_ANCHOR) continue;
        const y = Math.floor(idx / (CHUNK_SX * CHUNK_SZ));
        const rem = idx - y * CHUNK_SX * CHUNK_SZ;
        const lz = Math.floor(rem / CHUNK_SX), lx = rem - lz * CHUNK_SX;
        const wx = chunk.cx * CHUNK_SX + lx, wz = chunk.cz * CHUNK_SZ + lz;
        if (id === BLOCK.LANTERN) w._addLanternLight(wx, y, wz);
        else w._addSoulAnchorZone(wx, y, wz);
      }
    }

    // 8. PROGRESSION.
    const g = state.progression;
    this.stage = g.stage;
    this.dayCount = g.dayCount;
    this.memoryFragments = g.memoryFragments;
    this.nightsRequired = g.nightsRequired;
    this.awaitingAdvance = g.awaitingAdvance;
    this.behemothDefeated = g.behemothDefeated;
    this.behemothSpawned = g.behemothSpawned;
    /* PHASE 26 — restored as REACHED, never as granted: the max health these milestones
       paid out is already in state.player.maxHp, which was applied above. Re-running the
       grants here would pay a returning player twice for the same night. */
    this.milestones = new Set(g.milestones);
    /* PHASE 28 — restored, not re-derived. A New Game arrives here with an empty list
       (defaultSaveState) and gets its cues; a Load arrives with whatever the player had
       already answered, and a pre-Phase-28 save arrives with all three (the 3 -> 4
       migration), so a returning player is never told how to hold a pickaxe again. */
    this.onboarding = new Set(g.onboarding);
    /* PHASE 31 — restored before the world streams anything, so a chunk generated after
       this point already knows whether its callback exists. A save written before this
       phase existed arrives with an empty list, which is exactly right: the objects it
       tracks are new, so nobody has stood in front of one. */
    this.envStory.restore(g.noticed);
    this.compassAcquired = g.compassAcquired;
    this.pendingLevel2Transition = g.pendingLevel2Transition;
    this.fakeHavenTriggered = g.fakeHavenTriggered;
    this.farmCrossroadsRecalled = g.farmCrossroadsRecalled;
    this.farmJourneyOrd = g.farmJourneyOrd;
    this.farmHouseSeen = g.farmHouseSeen;
    this.mobs.killCount = g.killCount;
    this.riftDisksCollected = new Set(g.riftDisks);
    this.dimensionsBreached = new Set(g.dimensionsBreached);
    // Difficulty is a pure function of the stage, exactly as _advanceStage computes it.
    this.mobs.difficultyMult = 1 + (this.stage - 1) * 0.4;
    this.mobs.maxMobs = Math.min(MOB_CAP_MAX, MOB_CAP_BASE + this.stage * MOB_CAP_PER_STAGE);

    /* 8.5. A RIFT CORE DISK THE PLAYER HELD, HAS NOT SPENT, AND IS NO LONGER CARRYING.

       PHASE 36 — THE ONE CLASS OF LOST PROGRESS A SAVE CANNOT OTHERWISE SURVIVE.

       A Disk exists in three places over its life: inside a container, on the ground as
       an ItemEntity, and in the pack. The middle one is not saved — no dropped item is —
       and neither is anything about it recoverable, because there are exactly three
       Cores in the game and no second source of any of them (STORY.md section 9). So a
       player who dropped a Disk (Q drops the held stack) and saved, or who saved in the
       moment between a container opening and the drop reaching their feet, loaded into a
       run that could not be finished and was told nothing.

       The rule is the one section 75 states: never silently destroy progress. So the
       three Disks are checked against the state the save already carries — no new field,
       no schema change — and a Disk that was HELD (riftDisks), is not in the pack, and
       has not been SPENT is put back, with the repair reported like every other repair.

       SPENT is a different question for each of them and all three answers are already
       in the file: the Level 1 Disk is spent once the Farmlands have been breached or an
       Anchor is standing with a rift toward them; the Level 2 Disk likewise for Suburbia;
       the Level 3 Disk the moment the Haven sequence has fired. Nothing here can mint a
       Disk the player never had, and nothing here can duplicate one, because the ground
       copy this is replacing did not survive into the loaded world. */
    for (const [disk, spent, name] of [
      [ITEM.CORE_DISK, this.dimensionsBreached.has(DIMENSION.FARMLANDS) ||
        !!(state.anchor && state.anchor.riftActive && state.anchor.riftTargetLevel === 2), 'Core Disk'],
      [ITEM.CORE_DISK_L2, this.dimensionsBreached.has(DIMENSION.SUBURBIA) ||
        !!(state.anchor && state.anchor.riftActive && state.anchor.riftTargetLevel === 3), 'Level 2 Rift Core Disk'],
      [ITEM.CORE_DISK_L3, this.fakeHavenTriggered, 'Level 3 Rift Core Disk'],
    ]) {
      if (!this.riftDisksCollected.has(disk) || spent) continue;
      if (p.inventory.hasItem(disk)) continue;
      /* A full pack refuses, and a repair note that is not true is worse than no note.
         Thirty-six slots against three Disks makes this unreachable in practice; it is
         written because "in practice" is how the rest of this section got here. */
      if (p.inventory.addItem(disk, 1)) {
        notes.push('returned the ' + name + ' — it was not in the pack and had not been spent');
      } else {
        notes.push('could not return the ' + name + ' — the pack is full');
      }
    }

    // 9. TEMPORAL. The night-survived edge is restored with the clock, so a load can
    //    never award a night the player already banked (nor swallow one they had not).
    this.env.t = state.time.cycleSeconds % this.env.cycleLength;
    this.wasNight = state.time.wasNight;

    // 10. SANITY — the value only. Thresholds are read from it every frame; nothing is
    //     re-fired, because nothing here calls a threshold handler.
    this.sanity.value = state.sanity;

    /* 11. OBJECTIVES. Restored, then immediately re-evaluated against the world that has
       just been rebuilt — so a mark that is behind the player's actual state catches up
       on the same frame, and a version 1 save that carries no marks at all is credited
       with everything the player had already done. */
    this.objectives.applyJSON(state.objectives);

    // 12. AUDIO / POST-FX / SKY, applied now rather than a frame later.
    this._applyRestoredPresentation(state);

    /* 13. The win screen is modal state, not progression: if the save was taken with it
       up, put it back up, or the stage the player had already cleared could never be
       advanced past. */
    /* PHASE 36 — and there is only one kind of screen it can be. `awaitingAdvance` now
       means a cleared stage and nothing else, so the discriminator that used to stand
       here — `behemothDefeated`, which is true for the whole rest of the run — is gone
       along with the ambiguity that made it necessary. */
    if (this.awaitingAdvance) this.ui.triggerWinScreen(this.stage);

    return notes;
  }

  /* Everything the frame loop does NOT re-derive on its own each tick. The environment
     overrides, Suburbia audio and the compass all follow the dimension flags every
     frame; the Haven music mode and the horror post-FX switch are latched, so they are
     set explicitly here. */
  _applyRestoredPresentation(state) {
    this.sound.setFakeHavenMode(false);
    this.sound.setSuburbiaMode(this.player.inSuburbia);
    this.postfx.setHorrorEnabled(true);
    /* PHASE 32 — and the dissolve, which is the one piece of Haven presentation that
       lives in the renderer rather than in a dimension flag. Cleared here for the same
       reason the nightmare override is: a load that landed on a half-faded screen would
       be indistinguishable from a broken one. */
    this.postfx.setHavenFade(0);
    this.env.setHavenDissolve(0);
    /* ...and the void glitch, which had the same gap. _triggerClimax clears it on the way
       to the credits, so the ordinary route out was covered; a New Game or a Load taken
       from anywhere else after the shift was not, and left the datamosh tearing running
       over a freshly restored Overworld. Everything the finale writes to the renderer is
       now cleared in the one place a restore repaints from. */
    this.postfx.setVoidGlitch(0);
    this.env.setNightmareOverride(false);
    this.env.setFakeHavenOverride(false);
    this.env.setSuburbiaOverride(this.player.inSuburbia);
    this.env.setFarmlandsOverride(this.player.inFarmlands
      ? farmlandsBiomeAt(this.player.position.x, this.player.position.z) : null);
    this.env.setFollowTarget(this.player.position);
    this.env.update(0);
    this.ashParticles.setActive(false);

    this._syncProgressionHUD();
    /* PHASE 25 — resolve the line against the world that now exists, not the one that
       did. This is also what re-derives a chain mark that a migrated Phase 23 save
       could not carry. */
    this._refreshObjective();
    this.ui.setSanity(this.sanity.value);
    this.ui.updateVitals(this.player);
    this.ui.updateHotbarSelection();
    this.ui.setDay(this.dayCount);
    this.ui.setPhase(this.env.isNight, this.env.dayFraction);
    if (this.compassAcquired) this.ui.updateCompass(this.player.yaw);

  }

  /* --- THE VERBS ------------------------------------------------------------------ */

  saveGame(reason) {
    const blocked = this.saveBlockedReason();
    if (blocked) return { ok: false, error: blocked };
    let state;
    try { state = this.captureSaveState(); }
    catch (e) { return { ok: false, error: 'The game state could not be captured.' }; }
    const res = this.saves.write(state);
    this._lastSaveResult = res;
    if (res.ok) {
      this._refreshContinueButton();
      this.ui.setSaveStatus('Saved. ' + describeSaveState(this.saves.peek()));
      if (reason !== 'auto') this.ui.showToast('Game saved.', 1600);
    } else {
      this.ui.setSaveStatus('Save failed: ' + res.error);
      this.ui.showToast('Save failed: ' + res.error, 2600);
    }
    return res;
  }

  /* A conservative, event-based autosave: the two dimension crossings, and nothing else.
     No timer, no per-frame write, no write on an ordinary block edit. */
  autosave() {
    if (this.saveBlockedReason()) return;
    this.saveGame('auto');
  }

  loadGame() {
    if (this.player.inFakeHaven || this.climaxTriggered) {
      this.ui.setSaveStatus('Not from here.');
      return { ok: false, error: 'Not from here.' };
    }
    const read = this.saves.read();
    if (!read.ok) {
      this.ui.setSaveStatus(read.error);
      this.ui.showToast(read.error, 2600);
      return { ok: false, error: read.error };
    }
    const notes = this._applyRestoredState(read.state);
    const extra = read.repairs.concat(notes);
    const recovered = read.source === 'backup' ? ' (recovered from the backup copy)' : '';
    this.ui.setSaveStatus('Loaded: ' + describeSaveState(read.state) + recovered +
                          (extra.length ? ' — repaired: ' + extra.join('; ') : ''));
    this.ui.showToast('Game loaded.' + (recovered ? ' Recovered from backup.' : ''), 2000);
    return { ok: true, state: read.state, repairs: extra };
  }

  /* A NEW GAME IS THE SAME PATH, applied to the documented initial state, so it cannot
     inherit anything a load cannot inherit. The stored save is deliberately NOT deleted:
     starting fresh is not a request to destroy the run the player already has, and the
     next explicit Save is what replaces it. */
  newGame() {
    this._applyRestoredState(defaultSaveState(this.settings));
    this._placeStarterTorch();
    this.ui.setSaveStatus('New game started.');
    return { ok: true };
  }

  /* Continue from the start screen: the world is restored first and the frame loop is
     entered afterwards, so nothing simulates against a half-built world. The opening
     instruction is not replayed — the player has already heard it, and it is the closing
     beat of the opening film rather than a loading screen. */
  continueFromSave() {
    const read = this.saves.read();
    if (!read.ok) return { ok: false, error: read.error };
    this.menu.hide();                     // PHASE 29
    this.sound.start();
    this._applyAudioSettings();
    /* A save carries a copy of the settings, but the browser-global settings written by
       Phase 22 remain the authority — the copy is only consulted when the browser has no
       settings of its own (cleared site data, a different profile), which makes the save
       a recovery path rather than a competing owner. */
    if (this.settings.storage) {
      let stored = null;
      try { stored = this.settings.storage.getItem(SETTINGS_STORAGE_KEY); } catch (e) { stored = null; }
      if (!stored) this.settings.applyJSON(read.state.settings);
    }
    const notes = this._applyRestoredState(read.state);
    /* PHASE 36 — CONTINUE reports its repairs too. It discarded them, which was harmless
       while a repair only ever moved the player off a block — and stopped being harmless
       when one of them can hand back a Rift Core Disk. Same line, same place, same words
       as LOAD: the settings panel's save status, never the HUD and never the world. */
    const repairs = read.repairs.concat(notes);
    this.ui.setSaveStatus('Continued: ' + describeSaveState(read.state) +
                          (repairs.length ? ' — repaired: ' + repairs.join('; ') : ''));
    this._beginPlay();
    return { ok: true, state: read.state, repairs: repairs };
  }

  hasSave() { return !!this.saves.peek(); }

  /* PHASE 29 — one owner. The button's presence and its label are the menu's business;
     this stays as the name the rest of the game already calls. */
  _refreshContinueButton() {
    if (this.menu) this.menu.refreshContinue();
  }

  /* The one torch the world starts with. Extracted so a New Game puts it back: it is a
     world EDIT, and a New Game clears the edit registry. */
  _placeStarterTorch() {
    const sx = Math.floor(this.player.position.x) + 2, sz = Math.floor(this.player.position.z) + 2;
    const sy = this.world.findSpawnHeight(sx, sz);
    this.world.setBlockWorld(sx, sy, sz, BLOCK.TORCH);
  }

  /* ===================================================================================
     PHASE 22 — APPLYING SETTINGS

     One dispatch point, and each applier is idempotent and cheap. `set()` only fires a
     change when the value genuinely moved, so dragging a slider across a hundred pixels
     re-applies audio a hundred times (three AudioParam ramps — trivial) and re-applies
     graphics zero times, because the quality string did not change.
     =================================================================================== */
  _onSettingChanged(key) {
    if (key === 'masterVolume' || key === 'musicVolume' || key === 'sfxVolume' ||
        key === 'ambienceVolume') this._applyAudioSettings();
    else if (key === 'graphicsQuality') this._applyGraphicsQuality();
    // mouseSensitivity is read live by the mousemove handler; nothing to push.
    // fullscreen is actioned from the click that set it — see UIManager._bindSettings.
  }

  /* PHASE 34 — a world point as the listener hears it: how far right of the camera it is,
     how far in front, and how far away. Four lines that were written out three times in
     this file before this phase (the CRT static, the animal calls, and now twice more),
     so they are written once here and the copies point at it. */
  _listenerRelative(p) {
    const o = this.player.position;
    const dx = p.x - o.x, dz = p.z - o.z;
    const yaw = this.player.yaw;
    const right = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
    const forward = -(dx * -Math.sin(yaw) + dz * -Math.cos(yaw));
    return { right, forward, dist: Math.sqrt(dx * dx + dz * dz) };
  }

  /* PHASE 34 — see the call site in update() for why this exists and what it may not do.
     Returns the scene id it settled on, which is what makes it testable. */
  _updateEnvironmentAudio(dt) {
    const d = this.sound && this.sound.director;
    if (!d) return null;
    const p = this.player;
    const pos = p.position;
    /* INDOORS IS "NOTHING OVERHEAD", read from the world's own sky test rather than from
       a new flag: a barn counts, a porch does not, and a cave counts as deep. This is the
       same predicate the day-phase sanity floor already uses. */
    let indoors = false, deep = false;
    if (this.world && this.world.hasSkyAbove) {
      const hx = Math.floor(pos.x), hy = Math.floor(pos.y + p.eyeHeight), hz = Math.floor(pos.z);
      /* AN UNGENERATED COLUMN IS NOT A ROOM. hasSkyAbove returns false when the chunk is
         not resident, which is indistinguishable from a ceiling — so on a fast traversal,
         or at the moment a dimension is entered, the player could be handed the interior
         room tone while standing in an open field. The chunk is checked first and a
         missing one is treated as outdoors, which is the safe answer: the outdoor bed in
         a barn is a smaller error than a room tone in a wheat field. */
      const chunkHere = this.world.getChunk
        ? this.world.getChunk(Math.floor(hx / CHUNK_SX), Math.floor(hz / CHUNK_SZ)) : null;
      const raw = !!chunkHere && !this.world.hasSkyAbove(hx, hy, hz);
      /* AND IT HAS TO STAY TRUE. A single frame's answer is not enough to swap every bed
         in the mix: a tree, a porch, a bridge, an overhang and a doorway all read as
         "indoors" for as long as it takes to cross them, and a crossfade in and straight
         back out is far more noticeable than either state would have been. The reading
         must hold for AUDIO_INDOOR_SETTLE seconds before the mix acts on it — short
         enough that walking into a barn is immediate, long enough that walking under one
         tree is not. The runtime audit caught this as a stray interior room tone in the
         middle of an open Overworld night. */
      if (raw === this._audioIndoorRaw) {
        this._audioIndoorHold = (this._audioIndoorHold || 0) + Math.max(0, Math.min(0.25, dt || 0));
      } else {
        this._audioIndoorRaw = raw;
        this._audioIndoorHold = 0;
      }
      if (this._audioIndoorHold >= AUDIO_INDOOR_SETTLE) this._audioIndoors = raw;
      indoors = !!this._audioIndoors;
      /* 'DEEP' MEANS UNDER THE GROUND, NOT MERELY LOW. The first version of this line
         read `pos.y < 26`, which is above SEA_LEVEL: the browser test caught it
         immediately by walking into an ordinary ground-floor room at y 24 and getting the
         basement room tone. Three blocks below sea level is unambiguously a cave or a
         cellar and cannot be a living room. */
      deep = indoors && pos.y < SEA_LEVEL - 3;
    }
    /* THE RIFT SCENE IS A PLACE, NOT AN EVENT. It comes up when the player walks toward
       a powered Anchor and goes again when they walk away, on the bed crossfade like
       every other scene — no trigger, no sting, and nothing that fires once and has to be
       latched. Twenty metres is roughly where the dome is first clearly visible, so the
       sound and the sight arrive together. */
    let rift = false;
    const am = this.anchorManager;
    if (am && am.riftActive && am.activeAnchor) {
      const a = am.activeAnchor.pos;
      const dx = a.x - pos.x, dz = a.z - pos.z;
      rift = (dx * dx + dz * dz) < 400;
    }
    const dim = EnvironmentStorySystem.dimensionOf(p);
    if (dim !== this._audioDim) {
      this._audioDim = dim;
      /* PHASE 34.2 — every route into a dimension passes through here: normal
         progression, a save load, a New Game, the Haven and the developer teleports all
         change this flag and nothing else is common to all of them. If the context was
         suspended while the player was elsewhere, this is the moment it must come back —
         arriving somewhere new to permanent silence is the exact failure being fixed. */
      this.sound.resumeContext();
      /* Fetch the beds of every scene THIS dimension can produce, so night falling or a
         door closing crossfades into something already decoded instead of into a gap. */
      const pre = { overworld: ['overworld.day', 'overworld.night', 'in.house'],
                    farmlands: ['farm.day', 'farm.night', 'in.house'],
                    suburbia:  ['sub.day', 'sub.night', 'in.sub', 'in.sub.night'] }[dim];
      if (pre) d.warm(pre);
    }
    /* One boolean test per frame once it has been reported, and one cheap counter
       comparison until then. The library cannot be asked before it exists, which is why
       this is here and not only at boot. */
    if (!this._audioReported) this._reportAudioTransport();
    return d.update(dt, {
      dimension: dim,
      night: !!this.env.isNight,
      blood: !!this.env.isNight && this.stage >= 2,
      indoors, deep, rift,
    });
  }

  /* Safe before the AudioContext exists, which is the normal case at boot: a browser
     will not hand one over until the player has interacted with the page, so start() has
     not run yet. applyVolumes reports that it did nothing and _start() calls this again
     once the engine is live. */
  _applyAudioSettings() {
    if (!this.sound) return;
    this.sound.applyVolumes(this.settings.get('masterVolume'),
                            this.settings.get('musicVolume'),
                            this.settings.get('sfxVolume'),
                            this.settings.get('ambienceVolume'));
  }

  /* =================================================================================
     PHASE 34.3 — THE ONE PLACE A DEAD AUDIO LIBRARY IS REPORTED.

     Silence is the only symptom a broken transport has, and silence is also what a
     player who has turned the volume down has. Nothing in the build distinguished them,
     so three playtests in a row read "the recorded library never loaded" as "the mix is
     wrong" and three phases of level work were spent on files nobody was receiving.

     IT SAYS THE CAUSE AND IT SAYS THE REMEDY. There is exactly one remedy — serve the
     folder over http:// instead of opening the file — and a message that describes a
     fault without naming its fix is only a better class of silence.

     WHERE IT IS ALLOWED TO APPEAR. The start screen and the settings panel, which are
     interface, and the console. NEVER the HUD and never the world: sections 53 and 57
     are explicit that the objective line belongs to the objective system and that the
     game does not address the player, and a technical notice is not an exception to
     that — it is a reason to put it somewhere else. Latched, so it is written once.

     IT IS ALSO NOT A GUESS. The origin case is known before an AudioContext exists; the
     deployment case is read from the library's own counters once it has tried and
     failed enough times to be certain. Both land here. */
  _reportAudioTransport() {
    if (this._audioReported) return false;
    const lib = this.sound && this.sound.library;
    const blocked = AUDIO_TRANSPORT_BLOCKED || (lib && lib.transportDead());
    if (!blocked) return false;
    this._audioReported = true;
    const why = AUDIO_TRANSPORT_BLOCKED
      ? 'THE PAGE WAS OPENED AS A FILE. BROWSERS BLOCK LOCAL AUDIO FILES.'
      : 'THE RECORDED AUDIO FILES COULD NOT BE LOADED.';
    const fix = 'RUN A SERVER IN THIS FOLDER AND OPEN IT OVER HTTP.';
    const how = 'FOR EXAMPLE: python3 -m http.server 8000';
    if (this.ui) this.ui.showAudioNotice(why, fix, how);
    try {
      console.warn('WHERE IT ISN\u2019T \u2014 ' + why + ' ' + fix + ' ' + how +
                   '  Synthesised audio still plays; every recording is unavailable.');
    } catch (e) { /* a console that refuses is not a reason to fail */ }
    return true;
  }

  /* THE THREE KNOBS, and nothing else. No effect is disabled, no geometry is dropped and
     no generation parameter moves — see GRAPHICS_PRESETS for why these three are the ones
     that matter. Applied only when the preset actually changes. */
  _applyGraphicsQuality() {
    const p = this.settings.graphicsPreset;
    if (this._appliedPreset === this.settings.get('graphicsQuality')) return;
    this._appliedPreset = this.settings.get('graphicsQuality');
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    this.renderer.setPixelRatio(Math.min(dpr, p.pixelRatio));
    /* The scene is drawn into the PostFX target, so THAT is what render scale means.
       Never smaller than 1px, and rounded, because a fractional or zero-sized render
       target is an immediate WebGL error. */
    if (this.postfx) {
      this.postfx.resize(Math.max(1, Math.round(window.innerWidth * p.renderScale)),
                         Math.max(1, Math.round(window.innerHeight * p.renderScale)));
    }
    /* Resizing a shadow map needs the old one disposed and nulled, or three.js keeps
       rendering into the map at its original size. */
    const sun = this.env && this.env.sun;
    if (sun && sun.shadow) {
      if (sun.shadow.mapSize.width !== p.shadowMap) {
        sun.shadow.mapSize.set(p.shadowMap, p.shadowMap);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      }
    }
  }

  /* Fullscreen can be changed by F11 or Escape without this menu ever being opened, so
     the document is the source of truth and the stored value is corrected from it. */
  _watchFullscreen() {
    const sync = () => {
      const real = isDocumentFullscreen();
      if (this.settings.get('fullscreen') !== real) this.settings.set('fullscreen', real);
      this.ui.syncSettingsUI();
    };
    for (const ev of ['fullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange']) {
      document.addEventListener(ev, sync);
    }
  }

  /* =================================================================================
     PHASE 34.2 — INTERFACE AUDIO, AND WHY IT IS ONE LISTENER RATHER THAN FIFTEEN.

     The requirement is a click on every menu button, exactly one per click, never
     doubled. There are fifteen or so clickable controls across the start screen, the
     settings panel and the win screen, and each already owns a handler that does its real
     work. Adding a play call to each of those is fifteen chances to add it twice, to miss
     one, or to have a future button ship silent.

     So the sound is bound ONCE, here, by delegation. A physical click dispatches exactly
     one `click` event, this sees it exactly once on the way down, and the count cannot
     drift no matter what the individual handlers do — including the ones that tear their
     own element out of the DOM, which is why this listens in the CAPTURE phase.

     THE SELECTOR IS A LIST OF INTERFACE CONTROLS, NOT "EVERY BUTTON". The hotbar slots,
     the inventory grid and the crafting rows are gameplay and already have their own
     voices (pickup, chest, deny); giving them a menu click as well would be two sounds
     for one action. `closest()` is used so a click landing on a <span> inside a button —
     CONTINUE's save note does exactly that — still counts as its button. */
  _bindInterfaceAudio() {
    const SEL = '.menu-btn, .settings-toggle, .settings-close, .link-btn, ' +
                '.settings-seg button, .action-btn';
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || typeof t.closest !== 'function') return;
      const btn = t.closest(SEL);
      if (!btn) return;
      /* A disabled control refuses the action, so it gets the refusal sound instead. */
      const off = btn.disabled || btn.getAttribute('aria-disabled') === 'true';
      try { this.sound.playUiClick(off ? 'deny' : 'click'); } catch (err) { /* optional */ }
    }, true);
  }

  /* =================================================================================
     PHASE 34.2 — KEEPING THE CONTEXT ALIVE.

     An AudioContext is not guaranteed to stay running. Chrome suspends one belonging to a
     tab that has been hidden long enough, Safari suspends on focus loss, and a strict
     autoplay policy can hand one over suspended from the start. The build had no
     `resume()` call anywhere, so any of those was a permanently silent session with a
     completely healthy audio graph behind it — the hardest kind of audio bug to see,
     because every diagnostic reports success.

     Two triggers, both cheap and both idempotent: the page becoming visible again, and
     the next gesture of any kind. The gesture listeners are passive and never removed —
     they cost one state comparison each and they are the only thing that recovers a
     context suspended while the window was in the background. */
  _watchAudioContext() {
    const wake = () => { try { this.sound.resumeContext(); } catch (e) { /* optional */ } };
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    }
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('focus', wake);
      for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
        window.addEventListener(ev, wake, { passive: true });
      }
    }
  }

  /* Closing the panel hands control back. Pointer lock is only re-taken if the player was
     actually in gameplay — re-locking from the start screen would trap the cursor before
     the game has begun. */
  _resumeFromSettings() {
    if (this.running && !this.player.dead) this.canvas.requestPointerLock();
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // PHASE 22 — the render target follows the quality preset's scale, not the window.
    const rs = this.settings ? this.settings.graphicsPreset.renderScale : 1;
    this.postfx.resize(Math.max(1, Math.round(window.innerWidth * rs)),
                       Math.max(1, Math.round(window.innerHeight * rs)));
  }

  /* PHASE 30 — THE NEW GAME PATH, AND THE WHOLE OF IT.

       menu.hide()  ->  film.begin()  ->  openingInstruction.play()  ->  _beginPlay()

     Three things in a row, each handing to the next, and each of them already the single
     owner of what it does. The film is the world with gameplay suppressed; the instruction
     is Phase 20.2's two lines, unchanged and not reimplemented; _beginPlay is where the
     game actually starts and always was.

     THE FILM NEEDS FRAMES BEFORE THE GAME NEEDS THEM. It is watched in the real scene, so
     something has to be rendering it — hence _enterFrameLoop() here rather than only in
     _beginPlay(). `running` stays FALSE throughout, which is what keeps every gameplay
     key inert (Phase 29's `_playing()` gate) while the film is on screen.

     CONTINUE DOES NOT COME THROUGH HERE and never did — continueFromSave() goes straight
     to _beginPlay(). That is why this phase adds no save field: "has the film played" is
     answerable from which function was called. */
  _start() {
    // PHASE 29 — one call takes the whole menu down: scene, ambience and screen.
    this.menu.hide();
    this.sound.start();
    // PHASE 22 — the AudioContext exists only now, so this is where the stored volumes
    // first reach real gain nodes. Before this the call is a no-op by design.
    this._applyAudioSettings();
    this.clock.start();
    this._enterFrameLoop();
    this.film.begin(() => this.openingInstruction.play(() => this._beginPlay()));
  }

  /* PHASE 30 — ONE FRAME LOOP, HOWEVER MANY TIMES THIS IS CALLED.

     Both _start() (for the film) and _beginPlay() (for gameplay) need the loop running,
     and on the New Game path both run. Without this latch the second call would start a
     second requestAnimationFrame chain and the world would simulate at double speed for
     the rest of the session — a bug that would have been almost impossible to attribute
     later. */
  _enterFrameLoop() {
    if (this._loopRunning) return false;
    this._loopRunning = true;
    requestAnimationFrame(this._animate);
    return true;
  }

  _beginPlay() {
    this.running = true;                 // PHASE 22 — settings only re-lock during play
    /* PHASE 25 — resolve the first objective BEFORE the first frame rather than up to a
       tick into it. On a fast machine the difference is a quarter of a second; on a slow
       one it is however long the first frames take, and an empty objective line is
       exactly the wrong first impression for a system whose job is to say what to do. */
    this._refreshObjective();
    this.canvas.requestPointerLock();
    this.clock.start();
    this._enterFrameLoop();              // PHASE 30 — a no-op if the film already did
  }

  /* PHASE 36 — DISMISSING THE BEHEMOTH'S SCREEN, AND NOTHING ELSE.

     WHAT USED TO HAPPEN HERE. There was no separate path: the Behemoth's victory screen
     shared the stage screen's button, `pendingLevel2Transition` is only ever true on the
     frame a player walks into a rift, so the click always landed in `_advanceStage()`.
     That raised the stage, raised the difficulty multiplier and the mob cap, put the
     nights required from three to four, reset the fragment count — and TELEPORTED THE
     PLAYER TO THE WORLD SPAWN, away from the Anchor they had just raised and the rift
     they were one right-click from opening. The screen covers the viewport, releases
     pointer lock and has no other exit, so this was not something a player could decline.

     The Behemoth falling is not a stage change. It is one line of punctuation in the
     middle of the third night, and the only correct thing for it to do is get out of the
     way and give the night back. The objective line resolves to "Raise an Anchor." or
     "Bring it to the Anchor." on the next tick, which is the real next step and always
     was. */
  _dismissBossVictory() {
    this.ui.hideWinScreen();
    this.ui.updateVitals(this.player);
    this._refreshObjective();
    this.canvas.requestPointerLock();
  }

  // Called from the win screen button. Escalates difficulty and sends the player
  // back out rather than reloading the page — gear, inventory and every progression
  // latch (milestones included) persist across the stage change.
  _advanceStage() {
    this.stage++;
    this.memoryFragments = 0;
    this.wasNight = false;
    this.awaitingAdvance = false;
    this.nightsRequired = 2 + this.stage;

    this.mobs.difficultyMult = 1 + (this.stage - 1) * 0.4;
    // PHASE 4 — same per-stage growth rate, lower floor and ceiling (was 10 + stage*2,
    // capped at 22). The stage difficultyMult above is deliberately UNCHANGED.
    this.mobs.maxMobs = Math.min(MOB_CAP_MAX, MOB_CAP_BASE + this.stage * MOB_CAP_PER_STAGE);

    this.player.hp = this.player.maxHp;
    this.player.dead = false;
    this.player.position.copy(this.player.spawnPosition);
    this.player._snapToGround();
    this.player.velocity.set(0, 0, 0);
    this.sanity.value = 100;

    this.ui.hideWinScreen();
    this.ui.updateVitals(this.player);
    this.canvas.requestPointerLock();
  }

  // LEVEL TRANSITION — fired by the win-screen button once pendingLevel2Transition
  // is set (see the in-loop Rift Core trigger-radius check in _animate). Dissolves
  // the overworld away (wipeOverworldChunks leaves the pinned Farmlands pocket
  // untouched), drops the player at the Farmlands' pre-cleared landing pad, and
  // flips the dimension flag the rest of the loop (fog, mobs, HUD banner) reads.
  /* ===================================================================================
     PHASE 20.2 — EARNING THE COMPASS

     WHY THE FIRST ANCIENT CHEST. Requirement 3 asks for an existing, natural, early
     acquisition point rather than a new quest, and the game already has one: "Crack an
     Ancient Chest for rare supplies" is mission directive [4], it is authored Overworld
     progression, chests are scattered across the surface from the first day, and a
     brass instrument in a buried chest needs no explanation at all. Nothing new is
     generated, no structure moves, and no directive changes — the chest the player was
     already going to open simply has one more thing in it, once, forever.

     IT IS GRANTED BEFORE THE LOOT ROLL AND OUTSIDE IT, so it can never displace a roll,
     never be duplicated by a second chest, and never depend on a random pool. The
     Overworld gate matters: the Farmlands and Suburbia Disconnected Homes both contain
     chests, and a player who somehow reached one first should not be handed the
     compass there — it belongs to the first dimension.

     There is no fanfare. One quiet toast in the game's own voice, and the tape appears. */
  grantCompass() {
    if (this.compassAcquired) return false;
    this.compassAcquired = true;
    this.ui.setCompassVisible(true);
    this.ui.showToast('A brass compass, still true. North holds.', 3200);
    return true;
  }

  /* Re-applies progression state to the HUD. Called on every dimension transition so the
     compass survives the crossing, and the single place a future save-load should call
     after restoring this object. */
  _syncProgressionHUD() {
    this.ui.setCompassVisible(this.compassAcquired);
  }

  /* ===================================================================================
     PHASE 35 — ONE TEARDOWN FOR EVERY DIMENSION CROSSING.

     WHAT WAS WRONG. There were four ways out of a dimension — the two rift transitions,
     the Haven entry and the developer teleports — and each one put down a different
     amount of the dimension it was leaving. The Haven's was thorough. The dev teleports'
     was nearly as thorough and was written separately. The two RIFT transitions, which
     are the ones a player actually uses, put down almost nothing: they wiped the chunks
     and flipped a boolean.

     The worst of what they left behind was the ANCHOR. See AnchorMonumentManager.
     removeAnchor for the full account; the short version is that a live `riftActive`
     from the Level 1->2 crossing made the Level 2->3 rift impossible to open, pinned the
     objective to "Enter the Rift." for the whole of the Farmlands, and held the Rift
     audio scene against a monument in a dimension that was no longer loaded.

     Everything else it left behind was smaller but the same kind of thing: a zombie
     mid-lunge, an arrow in flight, the Stalker's distance, dropped items ticking at
     coordinates thirty thousand blocks away, the ash particle field, the animal rigs,
     the mining state and the block highlight.

     THE RULE THIS ESTABLISHES: A CROSSING PUTS DOWN THE DIMENSION IT IS LEAVING BEFORE
     IT PICKS UP THE NEXT ONE, AND IT DOES IT HERE. There is one of these. The dev
     teleports call it instead of keeping their own copy, which is why a teleport and a
     rift now arrive in identical state — and why "no transition may require a debug
     command" is a structural property rather than something to re-check.

     It deliberately does NOT touch: the inventory (what the player carries is theirs and
     crosses with them), the compass and the milestones (progression, not dimension
     state), the environmental-story latch (a callback needs the memory of its original,
     which is the entire point of that system), the save, or the objective — the caller
     re-resolves that once it has flipped the dimension flags, because an objective
     resolved here would be resolved against the dimension being left.
     =================================================================================== */
  _leaveDimension(opts) {
    const disableSpawning = !!(opts && opts.disableSpawning);
    const p = this.player;

    /* THE ANCHOR IS A BLOCK, AND THE BLOCK STAYS WHERE IT IS. */
    this.anchorManager.removeAnchor();

    /* NOTHING HOSTILE, NOTHING IN FLIGHT, NOTHING ON THE GROUND FOLLOWS. */
    this.mobs.clearAll(disableSpawning);
    if (!disableSpawning) this.mobs.spawningDisabled = false;
    this.stalker.clearAll();
    this.phantoms.clearAll();
    this.arrows.clearAll();
    for (const e of this.itemManager.entities.slice()) e.destroy();
    this.itemManager.entities.length = 0;
    this.ashParticles.setActive(false);
    if (this.farmAnimals) this.farmAnimals.clearAll();
    this.stalkerDistance = Infinity;

    /* THE BODY'S TRANSIENT STATE. stationaryTimer is the one that matters: Static
       Suburbia's Sanity drain reads it, so a player who stood still in the Farmlands for
       a minute used to arrive in Suburbia already being drained for it. */
    p.velocity.set(0, 0, 0);
    p.stationaryTimer = 0;
    if (p._cancelMining) p._cancelMining();
    if (this.ui.storageOpen) this.ui.closeStorage();
    if (this.ui.craftingOpen) { this.ui.craftingOpen = false; this.ui.craftingOverlay.classList.remove('active'); }
    if (this.ui.backpackOpen) { this.ui.backpackOpen = false; this.ui.backpackOverlay.classList.remove('active'); }
  }

  _transitionToLevel2() {
    this.pendingLevel2Transition = false;
    this.awaitingAdvance = false;
    this.ui.hideWinScreen();

    /* PHASE 35 — put the Overworld down before picking the Farmlands up. This is what
       clears the powered Anchor whose survival used to make the NEXT rift impossible to
       open; see _leaveDimension. */
    this._leaveDimension();

    this.world.wipeOverworldChunks();

    /* PHASE 16 — ARRIVAL INTO A STREAMED DIMENSION. The pocket was fully pre-built, so
       the rift could drop the player anywhere in it. The infinite Farmlands are not:
       only the 3x3 pinned core exists at boot, and collision reads chunk.data directly,
       so arriving at the edge of that core with the surrounding ring still queued would
       read as falling through the world. The arrival ring is therefore generated AND
       meshed synchronously here, outside the per-frame budget, exactly as the Suburbia
       dev teleport already does. Everything past it streams normally. */
    this.world._eagerLoadAround(this.world.farmlandsSpawn.x, this.world.farmlandsSpawn.z, 3);

    setPlayerDimension(this.player, DIMENSION.FARMLANDS);
    this.player.dead = false;
    this.player.hp = this.player.maxHp;
    this.player.velocity.set(0, 0, 0);
    this.player.position.copy(this.world.farmlandsSpawn);
    if (this.world.farmlandsSpawnYaw !== undefined) {
      this.player.yaw = this.world.farmlandsSpawnYaw;
      this.player.pitch = 0;
    }
    this.sanity.value = 100;
    // PHASE 20 — the journey line starts from nothing on every arrival.
    this.farmJourneyOrd = 0;
    this.farmHouseSeen = false;

    this.ui.showToast('The Rift tears open \u2014 The Shattered Farmlands await.', 3000);
    // PHASE 20.2 — progression HUD survives the crossing; the compass does not reset.
    this._syncProgressionHUD();
    /* THE MEMORY SURFACES, ONCE. The player is standing on the arrival crossroads with
       four roads in front of them, which is the single moment the opening instruction
       becomes actionable — and, on a full playthrough, a long way from when they heard
       it. It waits for the rift toast to clear so the two never fight over the screen,
       and the latch means it can never become a recurring prompt. */
    if (!this.farmCrossroadsRecalled) {
      this.farmCrossroadsRecalled = true;
      setTimeout(() => {
        if (this.player.inFarmlands && !this.climaxTriggered) this.openingInstruction.recall();
      }, 3400);
    }
    this.ui.updateVitals(this.player);
    this.canvas.requestPointerLock();
    this._refreshObjective();   // PHASE 25 — never show the previous dimension's line
    /* PHASE 23 — AUTOSAVE, and only here. A dimension crossing is the one event in the
       game that is both irreversible and expensive to redo, so it is the one event worth
       a write. There is no timer, no per-frame write and no write on an ordinary edit. */
    this.autosave();
  }

  // LEVEL TRANSITION — fired directly from the Rift Core trigger-radius check in
  // _animate() the instant the player steps into a Level 2->3 rift while standing
  // in the Farmlands (riftTargetLevel === 3, armed by feeding the Level 2 Rift
  // Core Disk recovered from The Disconnected Home to a Farmlands Anchor — see
  // the CORE_DISK_L2 branch of the item-use handler). Unlike _transitionToLevel2()
  // this fires immediately with no win-screen detour, since there's no "survive N
  // nights" milestone to celebrate first. Dissolves the Farmlands away
  // (wipeOverworldChunks leaves the 3x3 core _genStaticSuburbiaRegion pinned; PHASE 35
  // generates the ring around it here, and the Anchor's own pin is released by the
  // shared teardown), drops the player at Suburbia's pre-cleared landing pad, and flips
  // the dimension flags the rest of the loop (HUD banner, mob/stalker/sanity gating)
  // reads.
  _transitionToLevel3() {
    /* PHASE 35 — the same teardown the Level 1->2 crossing runs, which includes the
       animal rigs this method used to release by hand (PHASE 18: nothing may be left
       holding a position in a world that no longer exists). */
    this._leaveDimension();

    this.world.wipeOverworldChunks();

    /* PHASE 35 — ARRIVAL INTO A STREAMED DIMENSION, and this was missing.

       The comment that used to stand here said Suburbia was "already fully generated up
       front in _genStaticSuburbiaRegion". That has not been true since Phase 9 made the
       suburb a streaming terrain variant: the region boot pins a 3x3 core and everything
       else arrives through the ordinary radial streamer. Collision reads chunk.data
       directly, so a player who walks off the pinned core before the ring around it has
       been generated reads air and falls. The Level 1->2 crossing has generated its
       arrival ring synchronously since Phase 16 and the Suburbia dev teleport has done
       the same since Phase 9; only the real Level 2->3 rift did not. */
    this.world._eagerLoadAround(this.world.suburbiaSpawn.x, this.world.suburbiaSpawn.z, 3);

    setPlayerDimension(this.player, DIMENSION.SUBURBIA);
    this.player.dead = false;
    this.player.hp = this.player.maxHp;
    this.player.velocity.set(0, 0, 0);
    this.player.position.copy(this.world.suburbiaSpawn);
    this.player.pitch = 0;
    this.sanity.value = 100;

    this.ui.showToast('The Rift tears open \u2014 Static Suburbia awaits.', 3000);
    this._syncProgressionHUD();
    this.ui.updateVitals(this.player);
    this.canvas.requestPointerLock();
    this._refreshObjective();   // PHASE 25 — never show the previous dimension's line
    this.autosave();   // PHASE 23 — see _transitionToLevel2
  }

  /* ---------------------------------------------------------------------------------
     LEVEL 4 — THE FAKE HAVEN ILLUSION SEQUENCE (PHASE 5A PART 3).

     Fires the instant the player picks up the Level 3 Rift Core Disk from the chest
     inside The Disconnected Home. Unlike every previous level transition there is no
     rift to walk into and no button to press — the shift is taken out of the player's
     hands entirely, which is the point: something else decides where they go next.

     Beat 1 (here):  movement locks immediately, the screen washes to white.
     Beat 2 (_transitionToLevel4, ~1.5s later, at peak white): the entire world is
                     flushed and rebuilt as the Haven while nothing is visible.
     Beat 3:         the white blooms slowly away to reveal the cabin, and control
                     returns.
     --------------------------------------------------------------------------------- */
  _beginFakeHavenSequence() {
    if (this.fakeHavenTriggered) return;
    this.fakeHavenTriggered = true;

    // Lock the body before anything else so the player cannot walk out of the room
    // (or fall) during the wash.
    this.player.movementLocked = true;
    this.player.velocity.set(0, 0, 0);
    if (this.ui.storageOpen) this.ui.closeStorage();

    /* PHASE 32 — THE ENTRY SAYS NOTHING.

       It used to say "The room goes bright — and keeps going." and then, on the far side,
       "Somewhere safe. Somewhere warm." Both are gone, and their absence is the point.
       The second one was the worse of the two: it TOLD the player the room was safe,
       which is precisely the conclusion the room has to earn on its own over the next two
       minutes. A player who is told they are safe is being asked to take the game's word
       for it; a player who works it out has invested something they can then lose.

       The white wash carries the whole transition, and the cabin makes its own case. */
    this.ui.fadeToWhite(1400);
    setTimeout(() => this._transitionToLevel4(), 1500);
  }

  _transitionToLevel4() {
    /* PHASE 36 — AND ONLY IF THE SEQUENCE THAT SCHEDULED THIS IS STILL THE ONE RUNNING.

       This is the far side of a 1.5-second timer started by _beginFakeHavenSequence, and
       O opens the settings panel during those 1.5 seconds (O and Escape are deliberately
       never gated — see PlayerController._playing). A New Game taken inside that window
       cleared the latch, rebuilt the Overworld, and was then flushed into the Haven by a
       timer belonging to a run that no longer existed. One comparison closes it; the
       latch is set before the timer is armed and cleared by the one teardown path. */
    if (!this.fakeHavenTriggered) return;

    /* PHASE 35 — the shared crossing teardown, with mob spawning latched off: the Haven
       is meant to contain no threat. It clears the Anchor and its rift too, which the
       Haven's own teardown never did — a powered Anchor surviving into the Haven would
       have put "Enter the Rift." on screen over the one dimension whose objective is a
       single word. */
    this._leaveDimension({ disableSpawning: true });

    // --- WORLD: flush everything, then build the Haven in its place -----------------
    // wipeAllChunks (unlike wipeOverworldChunks) also clears the pin registry, so the
    // Farmlands and Suburbia pockets are genuinely unloaded rather than left resident.
    this.world.wipeAllChunks();
    const spawn = this.world.generateFakeHaven();

    /* PHASE 18 — the Haven flushes the WORLD, not just its entities, so world life gets
       the full teardown here rather than the cheap release the shared path does: the
       pooled rigs leave the scene graph too. The geometry and material caches are
       module-level and survive, which is correct — they are shared, and rebuilding them
       would be the leak. */
    this.farmAnimals.destroyAll();
    // The Behemoth night-spawn gate is latched shut so it can never fire in the Haven.
    this.behemothSpawned = true;

    // --- PLAYER: dimension flags + placement ---------------------------------------
    // PHASE 20.2 — the compass crosses into the Haven with everything else. It is not
    // dimension state; once earned it is simply part of what the player has.
    this._syncProgressionHUD();
    setPlayerDimension(this.player, DIMENSION.FAKE_HAVEN);
    this.player.dead = false;
    this.player.hp = this.player.maxHp;
    this.player.velocity.set(0, 0, 0);
    this.player.position.copy(spawn);
    this.player.stationaryTimer = 0;
    this.sanity.value = 100;
    this.ui.setSanity(100);

    // --- AUDIO RESET: hard-stop every horror loop, start the chiptune ---------------
    this.sound.setSuburbiaMode(false);   // stop the CRT static track before gating
    this.sound.setFakeHavenMode(true);

    // --- SHADER / FOG RESET ---------------------------------------------------------
    // uHorror=0 kills vignetting, chromatic aberration, grain, scanlines, the mirage
    // warp and the jumpscare wash in one switch; the environment override repaints the
    // fog and sky bright #7EC0EE at high visibility.
    this.postfx.setHorrorEnabled(false);
    this.env.setFarmlandsOverride(null);
    this.env.setSuburbiaOverride(false);
    this.env.setFakeHavenOverride(true);
    this.env.update(0); // apply the new sky/fog on this very frame, before the reveal

    this.ui.updateVitals(this.player);

    // --- Beat 3: bloom back in and hand control over ---------------------------------
    setTimeout(() => {
      this.ui.fadeFromWhite(1800);
      this.player.movementLocked = false;
      this.canvas.requestPointerLock();
      this._refreshObjective();   // PHASE 25 — the Haven asks for one word, and only one
    }, 400);
  }

  /* =================================================================================
     PHASE 5B — THE HAVEN SHIFT, THE VOID SOVEREIGN, AND THE CLIMAX.

     Timeline once the player is standing in the Fake Haven:
       t+0s    ... the Haven timer starts running.
       t+30s   ... OR the instant the bed is used — whichever lands first — the
                   illusion collapses (_triggerHavenShift).
       shift+0 ... music warps and tears into harsh static, sky snaps blood red, the
                   cabin decays into glitched void voxels, and the renderer is handed
                   back clean for the finale (PHASE 33 — no red snap, no roar, no shake).
       shift+0 ... FinalSequence.begin(): thirty-two seconds of FINALE_BEATS, ending in
                   the hard cut to black (_triggerClimax) and the end credits.
     ================================================================================= */

  /* =================================================================================
     PHASE 32 — THE HAVEN STAGE MACHINE.

     Runs every frame while the player is in the Haven and the shift has not fired. It
     does four things and owns nothing:

       1. advances `havenTimer`, which is the ONLY state the sequence has;
       2. resolves the stage from it (havenStageAt — pure) and, on a CHANGE only, hands
          the stage's targets to the audio and arms whatever anomaly it permits;
       3. writes the dissolve (havenDissolveAt — pure) to the fog and the renderer every
          frame, because it is a ramp rather than a step;
       4. lets VoxelWorld decide whether it may commit the armed anomaly yet.

     WHY THE STAGE IS DERIVED AND NOT STORED. It means a test can drive the whole
     progression by assigning `havenTimer` and calling this once, that the settings pause
     stops the Haven simply by not calling it, and that nothing is scheduled that could
     fire after the dimension is gone. It is the same discipline FILM_BEATS is under and
     for the same reasons.

     THE TWO EXITS ARE BOTH CANON. STORY.md section 18: the Haven ends "by lying down, or
     by simply being there long enough". The bed is not a skip — it is the player choosing
     the ending, which is why it is available from the first frame and why resting really
     does restore them first. */
  _updateHaven(dt) {
    if (this.havenShiftTriggered) return;

    /* EXIT A — THE BED, WHICH IS AN ENDING AND NOT A SKIP.

       PlayerController._restInHavenBed sets this flag; reading it here rather than
       calling back into the Game keeps the player free of a Game reference.

       WHAT IT DOES NOW, AND WHY THAT IS THE WHOLE POINT. It used to fire the shift on the
       very next frame: the player lay down, was told they felt better, and the world
       detonated in their face before the sentence had finished. That is a punishment for
       accepting the one kindness the game offers, and it makes a liar of STORY.md section
       18 — "Why is the player allowed to rest? Because nothing here is trying to do
       anything to them. Resting works. The bed genuinely restores. That is what makes it
       cruel."

       So the rest lands in full — the health and the sanity are already restored by the
       time this runs — and lying down moves the clock to the START of the final stage
       rather than past it. The player then gets the entire dissolution: they close their
       eyes in a warm room and it goes quiet and pale and distant around them over
       twenty-six seconds. Nothing turns on them. It ends.

       Guarded so that lying down again later can never rewind the clock. */
    if (this.player.havenBedUsed) {
      this.player.havenBedUsed = false;
      if (this.havenTimer < HAVEN_ENDING_FROM) this.havenTimer = HAVEN_ENDING_FROM;
      this.havenBedEnding = true;
    }

    this.havenTimer += dt;

    const stage = havenStageAt(this.havenTimer);
    if (stage.id !== this.havenStageId) {
      this.havenStageId = stage.id;
      /* THE STAGE'S TARGETS. Applied on the transition only — the audio ramps toward
         them with a 4.5s time constant and re-writing an unchanged target every frame
         would be pure waste. */
      this.sound.setHavenAmbienceLevels(stage.room, stage.outside, stage.hearth);
      this.sound.setHavenMusicState(stage.music);
      /* THE STAGE'S ANOMALY, if it has one. Arming is permission, not a trigger: the
         world commits it only once the player is not looking (updateHavenAnomalies), and
         will simply never commit it if they never look away. */
      if (stage.anomaly) this.world.armHavenAnomaly(stage.anomaly);
      /* The objective line is otherwise resolved on a 0.25s accumulator. Refreshing on
         the stage change costs one extra resolution per stage — six for the whole
         sequence — and means "Rest." is gone on the first frame of the dissolution
         rather than up to a quarter of a second into it. */
      this._refreshObjective();
    }

    /* THE DISSOLVE. Zero for the whole intact sequence, so this is two assignments of 0
       per frame for all but the last stage. Written every frame because it is a
       continuous ramp: the fog closing in and the image draining are the Haven being
       REMOVED, and a stepped removal would read as a glitch rather than as a loss. */
    const fade = havenDissolveAt(this.havenTimer);
    this.env.setHavenDissolve(fade);
    this.postfx.setHavenFade(fade);
    /* ...and the cabin's own lamps, off the same number, so the sky and the room can
       never disagree about how far gone the place is. */
    this.world.setHavenLightLevel(1 - fade);

    // The one committed change, if one is armed and the player has looked away.
    this.world.updateHavenAnomalies(dt, this.player, this.camera);

    /* EXIT B — the record runs out. Both exits arrive here: the bed reaches it by moving
       the clock, so there is exactly ONE line in the build that ends the Haven. */
    if (this.havenTimer >= HAVEN_SHIFT_SECONDS) {
      this._triggerHavenShift(this.havenBedEnding ? 'bed' : 'time');
    }
  }

  /* =================================================================================
     THE HANDOFF POINT. PHASE 32 ENDS HERE AND PHASE 33 BEGINS.

     Everything above this line is the Haven: three minutes of a room, and then the room
     being removed. Everything below it — the collapse, the entity, the climax, the
     credits — is the finale, and Phase 33 owns all of it.

     WHAT PHASE 32 CHANGED ABOUT THIS FUNCTION, AND WHAT IT DELIBERATELY DID NOT.

     It did not rebuild the collapse. The audio warp, the blood-red snap, the cabin decay
     and the entity were all built and working, and CLAUDE.md section 18 is clear that a
     working system is not rewritten because a new phase has arrived at it. What changed
     is WHEN this is reached and WHAT STATE it is reached in: the player now arrives here
     through twenty-six seconds of the Haven visibly running out, rather than from a
     bright, intact, perfectly safe cabin with no warning at all. The old sequence was
     "surprise, monster", which the brief forbids in as many words and which STORY.md
     section 18 forbids by a different route ("the transition is not a betrayal").

     THE ENTITY IS NOT FORESHADOWED AND CANNOT APPEAR EARLY. It is spawned on this line
     and nowhere else, this line is reachable only once havenShiftTriggered goes true, and
     `tests/haven.js` drives the entire intact sequence frame by frame asserting that
     nothing has spawned at any point in it. A silhouette in the window during the calm
     would spend Phase 33's only card in the one place the game has promised there is
     nothing to be afraid of.

     Called from exactly two places, both in _updateHaven: the bed, and the record running
     out. There is no third. */
  _triggerHavenShift(cause) {
    if (this.havenShiftTriggered) return;
    this.havenShiftTriggered = true;
    this.havenShiftElapsed = 0;

    /* PHASE 32 — HAND THE RENDERER BACK FIRST. The dissolve is the Haven's own effect and
       the collapse below is the finale's; leaving the fade up would blur and desaturate
       the void glitch, and leaving the env dissolve up would fight the nightmare fog.
       Both are dropped here so the two sequences never overlap by one frame. */
    this.postfx.setHavenFade(0);
    this.env.setHavenDissolve(0);

    /* --- AUDIO ---------------------------------------------------------------------
       The chiptune is warped and torn into static exactly as Phase 5B built it, because
       that IS the Haven ending and it is good. What does NOT happen any more is the roar:
       see SoundEngine's note where playVoidSovereignRoar used to be. The finale's own
       sound starts a moment later, from silence, in FinalSequence.begin(). */
    this.sound.warpHavenMusicToStatic();

    // --- WORLD: the cabin decays. -----------------------------------------------------
    this.world.corruptHaven();

    /* --- PHASE 33: HAND OVER --------------------------------------------------------

       WHAT USED TO HAPPEN HERE. The sky snapped blood red, an eight-metre entity appeared
       above the ruins, the horror grading came back on, the void glitch went to full, the
       camera shook for two and a half seconds, and the screen cut to black. Everything in
       that list is gone.

       WHY. The brief's beat one is SILENCE — "the player is left in near silence, no
       immediate creature, no soundtrack explosion; let the absence breathe". A red sky, a
       roar, full-screen datamosh and a violent shake are the opposite of an absence, and
       they also destroy the one thing the next thirty seconds need, which is a legible
       image: the player cannot judge the size of something they are looking at through a
       shaking, tearing, red-crushed frame.

       So the renderer is handed back CLEAN. The horror grading stays off (it was already
       off for the Haven), the glitch stays at zero, there is no shake, and the sky becomes
       the finale's own near-black — which FinalSequence.begin() establishes through
       env.setFinaleFog, checked ahead of every other override precisely so this works. */
    this.postfx.setVoidGlitch(0);
    this.postfx.setHorrorEnabled(false);
    this.shakeTime = 0;
    this.camera.rotation.z = 0;
    this.env.setNightmareOverride(false);
    this.env.setFakeHavenOverride(false);

    this.finale.begin();
    this.env.update(0);   // paint the finale's air on this frame, not the next

    /* PHASE 32 — AND THE SHIFT SAYS NOTHING EITHER.

       It used to say "The warmth was never yours." That line is a betrayal, and STORY.md
       section 18 is explicit that this is not one: "Nothing turns on the player. The
       Haven RUNS OUT, and what is underneath it was always underneath it." A sentence
       that reframes the last three minutes as a trick also throws away the only thing
       the sequence was built to produce, which is loss. Nothing is said. */
    this._refreshObjective();
  }

  /* Camera shake. Amplitude decays linearly over the duration; applied after
     player.update() has positioned the camera, so it is a pure per-frame offset that
     never corrupts the player's actual position. */
  shake(amount, duration) {
    this.shakeAmount = amount;
    this.shakeDuration = duration;
    this.shakeTime = duration;
  }

  _updateCameraShake(dt) {
    if (this.shakeTime <= 0) return;
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    const falloff = this.shakeDuration > 0 ? this.shakeTime / this.shakeDuration : 0;
    const amt = this.shakeAmount * falloff;
    this.camera.position.x += (Math.random() - 0.5) * amt;
    this.camera.position.y += (Math.random() - 0.5) * amt;
    this.camera.position.z += (Math.random() - 0.5) * amt;
    this.camera.rotation.z = (Math.random() - 0.5) * amt * 0.09;
  }

  /* PHASE 33 — `_updateHavenShift` is gone. It counted 2.5 seconds of camera shake and
     escalating glitch and then cut to black; FinalSequence.tick is what runs after the
     shift now, and it is called from the frame loop directly. */

  _triggerClimax() {
    if (this.climaxTriggered) return;
    this.climaxTriggered = true;
    this._refreshObjective();   // PHASE 25 — the ending is not a checklist; the line clears

    // Freeze the player and cut everything, instantly.
    this.player.movementLocked = true;
    this.player.velocity.set(0, 0, 0);
    // PHASE 2 — player.update() stops running here, so the selection box would freeze
    // in place mid-scene. Hide it explicitly.
    if (this.player.highlight) this.player.highlight.hide();
    this.shakeTime = 0;
    this.camera.rotation.z = 0;
    this.postfx.setVoidGlitch(0);
    this.sound.silenceAll();
    this.ui.hardCutToBlack();

    // A brief beat of pure black before the credits punch in.
    setTimeout(() => {
      this.ui.showCredits(this._collectStats(), () => this._reenterOverworld());
    }, 900);
  }

  /* ===================================================================================
     PHASE 26 — REACHING A MILESTONE.

     The single place in the game where a capability is granted, and it is reachable only
     from three named events. Idempotent by construction: the id goes into the Set before
     anything is granted, so a caller that fires twice (and two of the three callers are
     re-checked every frame) grants once and returns false forever after.

     Note what is NOT here: no accumulation, no threshold, no comparison against a total,
     nothing that reads a counter. The argument is the name of a thing that happened.
     =================================================================================== */
  _reachMilestone(id) {
    if (this.milestones.has(id)) return false;
    const m = PROGRESSION_MILESTONES.find(x => x.id === id);
    if (!m) return false;
    this.milestones.add(id);
    const p = this.player;
    if (m.maxHp) {
      p.maxHp += m.maxHp;
      /* The health granted is health the player HAS, not just a bigger empty bar —
         reaching one of these in the middle of a fight should feel like relief. */
      p.hp = Math.min(p.maxHp, p.hp + m.maxHp);
    }
    if (this.ui) { this.ui.showToast(m.toast); this.ui.updateVitals(p); }
    return true;
  }

  /* PHASE 28 — ANSWERING A CUE.

     The only writer of the onboarding set outside a restore, and it is deliberately as
     dull as it looks: no capability is granted, no toast is raised, nothing is unlocked.
     A cue being answered means one line stops being drawn. Idempotent, and the id is
     checked against the authored table so a caller cannot invent one. */
  learnOnboarding(id) {
    if (!this.onboarding || this.onboarding.has(id)) return false;
    if (ONBOARDING_CUE_IDS.indexOf(id) < 0) return false;
    this.onboarding.add(id);
    return true;
  }

  /* Assembles the end-credits stats summary. Counters are read defensively (|| 0)
     because several of them are only created lazily the first time the relevant event
     happens — a player who never opened a chest has no chestsOpened field at all. */
  _collectStats() {
    return {
      kills: this.mobs.killCount || 0,
      days: this.dayCount || 1,
      disks: this.riftDisksCollected ? this.riftDisksCollected.size : 0,
      dimensions: this.dimensionsBreached ? this.dimensionsBreached.size : 1,
      chests: this.player.chestsOpened || 0,
    };
  }

  /* PHASE 5B — "RE-ENTER OVERWORLD".
     A genuine full reset. Rebuilding in place would mean unwinding the chunk store and
     its pin registry, the WebAudio graph, every post-processing uniform, the dimension
     flags, and the ~10 cross-references other systems hold to VoxelWorld — a reload
     resets all of it atomically with no chance of a stale handle surviving into the
     new run. */
  _reenterOverworld() {
    window.location.reload();
  }

  /* PHASE 36 — is a Level 1 Core Disk lying on the ground, unclaimed? Asked by the
     Behemoth gate, which must not send a second one after a Behemoth that has already
     died and dropped its Disk two paces from the player's feet. A linear scan of a list
     that holds a handful of entities, once per frame, behind three cheaper tests. */
  _coreDiskAwaitingPickup() {
    const es = this.itemManager.entities;
    for (let i = 0; i < es.length; i++) if (es[i].itemType === ITEM.CORE_DISK) return true;
    return false;
  }

  /* ===================================================================================
     PHASE 25 — THE OBJECTIVE SNAPSHOT

     Everything the objective table is allowed to look at, gathered once per evaluation
     into one small plain object. Nothing here reaches into geometry, chunks, meshes or
     coordinates: it is all semantic state the game already keeps, which is what lets the
     objective definitions stay readable and lets Era 2 replace the renderer underneath
     them without touching a line of this phase.

     Built four times a second, not sixty. See ObjectiveSystem.update.
     =================================================================================== */
  _objectiveSnapshot() {
    const p = this.player, inv = p.inventory, w = this.world, a = this.anchorManager;
    const farmlands = !!p.inFarmlands, suburbia = !!p.inSuburbia, haven = !!p.inFakeHaven;
    const chain = haven ? 'haven' : (farmlands ? 'farmlands' : (suburbia ? 'suburbia' : 'overworld'));

    /* "Has ever been able to make something of it" rather than "is holding a log": planks
       and sticks are wood the player already processed, and a tool is proof of all three. */
    const hasTool = inv.hasItem(ITEM.WOODEN_PICKAXE) || inv.hasItem(ITEM.STONE_PICKAXE) ||
                    inv.hasItem(ITEM.IRON_PICKAXE) || inv.hasItem(ITEM.WOODEN_AXE) ||
                    inv.hasItem(ITEM.STONE_AXE) || inv.hasItem(ITEM.IRON_AXE);

    return {
      chain: chain,
      overworld: chain === 'overworld', farmlands: farmlands,
      suburbia: suburbia, haven: haven,

      // --- survival -------------------------------------------------------------------
      hasWood: inv.hasItem(ITEM.OAK_LOG) || inv.hasItem(ITEM.ASH_LOG) ||
               inv.hasItem(ITEM.WOOD_PLANK) || inv.hasItem(ITEM.STICK),
      hasTool: hasTool,
      hasCoal: inv.hasItem(ITEM.COAL),
      hasTorch: inv.hasItem(ITEM.TORCH),
      hasAnchor: !!a.activeAnchor,
      inAnchorZone: !!a.activeAnchor && a.isInsideSafeZone(p.position),
      night: !!this.env.isNight,

      // --- progression ----------------------------------------------------------------
      hasDisk: inv.hasItem(ITEM.CORE_DISK) || inv.hasItem(ITEM.CORE_DISK_L2) ||
               inv.hasItem(ITEM.CORE_DISK_L3),
      riftActive: !!a.riftActive && !!a.activeAnchor,

      // --- the Farmland journey, which already keeps its own monotonic ordinal ---------
      farmOrd: this.farmJourneyOrd || 0,
      farmHouseSeen: !!this.farmHouseSeen,
      farmTower: !!w.farmTower,
      farmCoreTaken: !!(w.openedChests && w.homeChestKey && w.openedChests.has(w.homeChestKey)),

      // --- Suburbia. A COUNT and a CHEST KEY, never a room or a coordinate: the suburb
      //     rearranges itself when nobody is looking, so anything positional would be a
      //     bug waiting for a player to stand still. ---------------------------------
      subVisits: w.suburbiaVisits ? w.suburbiaVisits.size : 0,
      subCoreTaken: !!(w.openedChests && w.level3HomeChestKey &&
                       w.openedChests.has(w.level3HomeChestKey)),

      // --- the end ---------------------------------------------------------------------
      havenShifted: !!this.havenShiftTriggered,
      /* PHASE 32 — the Haven's final stage, during which the place is visibly being
         removed. Asking a player to "Rest." while the room fades out around them would
         be the objective system talking over the one moment the phase exists for. */
      havenEnding: !!this.player.inFakeHaven && !this.havenShiftTriggered &&
                   this.havenTimer >= HAVEN_ENDING_FROM,
      climax: !!this.climaxTriggered,
    };
  }

  /* Re-resolve the line NOW rather than up to a quarter-second from now. Called from the
     three moments where a stale objective would be visible and wrong: a dimension
     crossing, a load, and a New Game. */
  _refreshObjective() {
    if (!this.objectives) return;
    this.objectives.evaluate(this._objectiveSnapshot());
  }

  /* PHASE 20 — THE FARMLAND JOURNEY ORDINAL.

     PHASE 25 NOTE: this function used to choose the Farmland objective text as well as
     advance the ordinal. The text moved into OBJECTIVE_CHAINS.farmlands — unchanged,
     line for line — so that one table holds every objective in the game. What is left
     here is the state it was always really about: how far along the journey the player
     has been, and whether they have been close enough to the property to call it a house.
     Both are monotonic, both are saved, and both are read by the objective snapshot. */
  _updateFarmJourneyObjective() {
    if (!this.player.inFarmlands) return;
    const w = this.world;
    const H = w.farmHome;
    if (!H) return;

    const px = this.player.position.x, pz = this.player.position.z;
    const ord = farmJourneyOrd(Math.floor(px / FARM_P), Math.floor(pz / FARM_P));
    if (this.farmJourneyOrd === undefined) this.farmJourneyOrd = 0;
    /* Only advance while the player is somewhere the journey actually is. Sixteen parcels
       of lateral tolerance is generous on purpose — a player who cut across three fields
       is still on the journey; a player who walked a thousand blocks east is not. */
    if (Math.abs(Math.floor(pz / FARM_P) - FARM_J_LINE) <= 16 && ord > this.farmJourneyOrd) {
      this.farmJourneyOrd = ord;
    }
    // Has the player got close enough to the house for it to be named?
    const dHouse = Math.hypot(px - (H.hx + 6), pz - (H.hz + 5));
    if (dHouse < 26) this.farmHouseSeen = true;
  }

  _animate() {
    requestAnimationFrame(this._animate);
    /* PHASE 30 — TWO DELTAS, AND THE FILM NEEDS THE OTHER ONE.

       `dt` is clamped to 0.06 because the simulation must never receive a frame big
       enough to tunnel the player through a wall — that clamp is physics safety and it
       stays. But it makes elapsed time a function of FRAME RATE rather than of the clock:
       at 10fps the world advances 0.6 seconds per real second, which is invisible in
       gameplay (everything slows together) and completely wrong for a cinematic. Under
       SwiftShader the first draft of this film took over three minutes to reach a beat
       fifteen seconds in, and a player on a weak machine would have had the same
       experience.

       So the film is given the REAL delta, clamped only against a pathological stall — a
       tab that was backgrounded for a minute should resume the film, not skip four beats.
       It is the only consumer of `rawDt`; nothing in the simulation sees it.

       WHY THE STALL CLAMP IS A WHOLE SECOND AND NOT A QUARTER. It was 0.25 first, and on
       the software renderer in the development container — which draws this scene at
       about one frame per second — EVERY frame hit that clamp, so the film advanced a
       quarter-second per second and a sixty-eight second sequence would have taken four
       and a half minutes. A clamp low enough to be hit by an ordinary slow frame is not a
       stall clamp, it is a frame-rate dependency wearing one. At 1.0 a machine drawing
       one frame a second still tracks real time, and a backgrounded tab still cannot
       resume by skipping a beat. */
    const rawDt = this.clock.getDelta();
    const filmDt = Math.min(rawDt, 1.0);
    let dt = Math.min(rawDt, 0.06);

    // PHASE 5B — once the hard cut has fired the world stops simulating entirely.
    // Nothing behind the black screen should keep ticking while the credits roll.
    if (this.climaxTriggered) {
      this.postfx.render(dt, 1.0);
      return;
    }

    /* PHASE 22 — SETTINGS GENUINELY PAUSE THE WORLD, they do not merely mute input.

       The existing overlays (crafting, inventory) only gate input, which is right for
       them: they are part of play and the world carrying on is the tension. Settings is
       not part of play. Adjusting a volume slider while a Stalker closes on you is not a
       design decision anybody made, so the simulation stops here — the same shape the
       climax freeze above already uses.

       The frame is still RENDERED, so the panel sits over the world rather than over
       black, and getDelta() is still consumed every frame, so resuming cannot deliver one
       enormous dt that teleports the player or advances the clock in a jump. */
    /* PHASE 36 — AND SO DOES THE WIN SCREEN, FOR THE SAME REASON AND WITH MORE AT STAKE.

       #winScreen covers the whole viewport at 95% opacity, releases pointer lock and has
       exactly one way out. The world carried on underneath it. That is survivable for the
       stage screen, which arrives at dawn — and it was not for the Behemoth's, which
       arrives in the middle of the third night with whatever else that night has spawned
       still walking around. The player was being asked to read a modal while being
       attacked behind it, unable to see or aim.

       Same shape as the settings pause above and for the same stated reason: a
       full-screen panel with a button is not part of play. The frame is still rendered
       and getDelta() is still consumed, so nothing jumps when it closes. */
    if (this.ui.winScreenMode) {
      this.postfx.render(dt, this.sanity ? this.sanity.fraction : 1.0);
      return;
    }

    if (this.ui.settingsOpen) {
      this.postfx.render(dt, this.sanity ? this.sanity.fraction : 1.0);
      return;
    }

    /* PHASE 30 — THE OPENING FILM, WHICH IS RENDERED AND NOT SIMULATED.

       The same shape as the settings pause directly above, and for a related reason: the
       film is watched in the real world, so the frame has to be drawn, but nothing in the
       world may happen while it is. No clock, no mobs, no objective tick, no sanity, no
       chunk streaming, no anchor burn.

       player.update() IS called, and only that. With movementLocked set (see
       OpeningFilm.begin) it syncs the camera from yaw and pitch and returns before any
       physics — which is exactly the "the player may look and do nothing else" state the
       brief asks for, using the gate that already existed rather than a new one.

       The `sanityFraction` handed to the renderer is the film's, not the player's: the
       'unresolved' beat drops it for three seconds so the existing horror shader takes
       the colour and the detail out of the world and gives them back. That is the whole
       effect — no new pass, no new shader, nothing added to the pipeline. */
    if (this.film && this.film.active) {
      this.player.update(dt);
      this.film.update(filmDt);        // wall-clock, not frame-count — see above
      this.postfx.render(dt, this.film.beat === 'unresolved' ? 0.14 : 1.0);
      return;
    }

    this.player.update(dt);
    this.itemManager.update(dt, this.player.position, this.player);
    this.arrows.update(dt, this.player);

    this.env.setFollowTarget(this.player.position);
    // LEVEL 2 — THE SHATTERED FARMLANDS: fixed biome-tinted fog/sky override and
    // drifting ash particles while standing in the Ashen Forest half of the pocket;
    // both fall back to their normal/inactive state everywhere else.
    const farmlandsBiome = this.player.inFarmlands
      ? farmlandsBiomeAt(this.player.position.x, this.player.position.z)
      : null;
    this.env.setFarmlandsOverride(farmlandsBiome);
    this.env.setSuburbiaOverride(this.player.inSuburbia);
    this.env.setFakeHavenOverride(this.player.inFakeHaven);
    this.env.setNightmareOverride(this.havenShiftTriggered);
    this.ashParticles.setActive(farmlandsBiome === 'ashen');
    this.ashParticles.update(dt, this.player.position);
    this.env.update(dt);
    this.anchorManager.update(dt);
    this.world.updateTorchFlicker(this.env.t);
    this.world.updateSoulAnchorPulse(this.env.t);
    this.world.updateTorchDecay(dt);
    this.world.updateDisconnectedHomeGlow(this.env.t);
    /* PHASE 20 — the water tower's distant silhouette and its red lamp. Both are pure
       scene state driven by the camera: no voxel is written, nothing is remeshed, and the
       whole thing costs one distance, one dot product and two opacity assignments per
       frame. Outside the Farmlands it hides everything and returns immediately. */
    this.world.updateFarmTowerLight(dt, this.camera, this.player.inFarmlands,
                                    this.env.fog ? this.env.fog.color : null);
    /* PHASE 20 REVISION — and the rest of the landmark chain's silhouettes, on the same
       fog colour and in the same pass, so the four of them always agree about the air
       they are standing in. */
    this.world.updateFarmLandmarkProxies(this.camera, this.player.inFarmlands,
                                         this.env.fog ? this.env.fog.color : null);
    // ...and the Disconnected Home's single stronger beat, which fires at most once.
    this.world.updateFarmHomeAnomaly(dt, this.player.position, this.camera,
                                     this.player.inFarmlands);
    // PHASE 14 — advance any door leaf currently swinging. Costs nothing when none is.
    this.world.updateDoorSwings(dt);
    // LEVEL 4 — hearth flames + warm fireplace light flicker.
    if (this.player.inFakeHaven) {
      this.world.updateFakeHaven(dt);
      // PHASE 5B — either count down to the illusion collapse, or, once it has
      // happened, run the final sequence (PHASE 33) toward the credits.
      if (!this.havenShiftTriggered) this._updateHaven(dt);
      else this.finale.tick(dt);   // PHASE 33 — the final sequence owns everything after
    }
    // LEVEL 3 — STATIC SUBURBIA (PHASE 5A PART 2): while stationary >3s, silently
    // rotate an out-of-sightline house's door/window wall (see the SanitySystem
    // branch below for the matching accelerated-decay half of this beat).
    if (this.player.inSuburbia) {
      this.world.updateSuburbiaRearrangement(dt, this.player, this.camera);
      /* PHASE 15 — THE RECOGNITION LAYER. Runs at 2Hz, records which house the player is
         standing in, and — at most one house every twenty-six seconds, and only ever
         behind their back and out of range — commits one deterministic revision to a
         house they have already been inside. It adds no Sanity drain, no audio, no
         entity and no HUD state; see VoxelWorld.updateSuburbiaRecognition. */
      this.world.updateSuburbiaRecognition(dt, this.player, this.camera);
    }
    /* PHASE 31 — the notice sweep. Runs in every dimension because two of the three
       tracked events are in the Farmlands, costs one distance and one dot product per
       tracked event at 2Hz, and cannot show the player anything. */
    this.envStory.update(dt, this.player, this.camera, this.world);
    /* PHASE 19 — bounded local water flow. Costs one comparison per frame unless the
       player has actually disturbed some water, and runs BEFORE updateChunks so that
       any cell it moves is remeshed by the dirty sweep in the very same frame — which
       is requirement 40's "show the player the result immediately" without a reload,
       a regeneration or a second meshing path. */
    this.world.updateFarmWater(dt);
    this.world.updateWaterSurface(this.env ? this.env.t : 0);

    // RADIAL CHUNK STREAMING: load/mesh newly-entered chunks, remesh dirty ones,
    // and dispose whatever fell outside the unload radius — every frame.
    this.world.updateChunks(this.player.position);

    // RIFT CORE TRIGGER — once the Rift Core is powered (Core Disk fed to the
    // Anchor), stepping inside its trigger radius fires the dimension transition
    // immediately and seamlessly — no win-screen detour for either leg anymore.
    // PHASE 5A ENGINE FIX: Level 1->2 used to only *arm* pendingLevel2Transition
    // here and wait for a manual "Continue" click on the win screen, which meant
    // walking into an already-powered rift did nothing until that screen showed
    // up for an unrelated reason. Now the check below covers BOTH conditions the
    // task calls for — pendingLevel2Transition already true, OR the anchor is
    // actively holding a powered Level 1 disk (riftTargetLevel === 2) — and
    // calls _transitionToLevel2() the instant the player's bounding box touches
    // the rift radius (riftTriggerRadius padded by the player's own halfWidth so
    // it's a true touch test, not just a center-point crossing). Level 2->3 still
    // calls _transitionToLevel3() directly, same as before.
    if (this.anchorManager.riftReady()) {
      const distToRift = this.player.position.distanceTo(this.anchorManager.activeAnchor.pos);
      const touchRadius = this.anchorManager.riftTriggerRadius + (this.player.halfWidth || 0);
      if (distToRift <= touchRadius) {
        const hasLevel1Disk = this.anchorManager.riftTargetLevel === 2;
        if (!this.player.inFarmlands && !this.player.inSuburbia &&
            (this.pendingLevel2Transition || hasLevel1Disk)) {
          this.pendingLevel2Transition = true;
          this._transitionToLevel2();
        } else if (this.player.inFarmlands && this.anchorManager.riftTargetLevel === 3) {
          this._transitionToLevel3();
        }
      }
    }

    // The stalker/sanity horror mechanic stays confined to the overworld's Blood
    // Nights and pauses entirely once the player has crossed into the Farmlands
    // or Static Suburbia.
    if (!this.player.inFarmlands && !this.player.inSuburbia && !this.player.inFakeHaven) {
      this.stalker.trySpawn(this.player.position, this.camera, this.env.isNight);
      this.stalkerDistance = this.stalker.update(dt, this.player.position, this.camera, this.player.activeLightSource, this.sanity);
      this.sanity.update(dt, this.player._eyePosition(), this.stalkerDistance, this.env.isDay);
      if (this.sanity.value < 30) {
        this.world.applyMimicHallucination(this.player.position, this.camera);
      }
      this.phantoms.update(dt, this.player.position, this.camera, this.sanity.fraction);
    } else {
      this.stalkerDistance = Infinity;
      // LEVEL 3 — STATIC SUBURBIA SANITY DRAIN (PHASE 5A PART 2): no torches,
      // light-level, or Stalker to read here — decay answers to stationaryTimer
      // instead (see SanitySystem.updateSuburbia).
      if (this.player.inSuburbia) {
        this.sanity.updateSuburbia(dt, this.player.stationaryTimer);
      } else if (this.player.inFakeHaven && !this.havenShiftTriggered) {
        // LEVEL 4 — nothing in the *intact* Haven drains Sanity. It is pinned full
        // every frame so no leftover decay from a previous dimension can bleed
        // through. PHASE 5B: once the illusion collapses this pin is released, so the
        // shift's Sanity crash to 0 sticks.
        this.sanity.value = 100;
        this.ui.setSanity(100);
      }
    }

    this.mobs.update(dt, this.player, this.env.isNight);
    /* PHASE 18 — world life. Self-gating: the first thing update() does outside the
       Farmlands is release every rig, so this costs one boolean test in the other three
       dimensions and nothing can follow the player out of this one. */
    this.farmAnimals.update(dt, this.player, this.camera);

    /* =================================================================================
       PHASE 34 — THE ONE PLACE THE ENVIRONMENT'S RECORDED SOUND IS DECIDED.

       Everything the director needs is a flat description of WHERE THE PLAYER IS, built
       here and nowhere else, so the whole of the game's environmental audio policy is one
       call and one small object rather than a set of playback calls scattered through the
       dimensions. The director does the rest: chooses a scene, crossfades the beds it
       needs, releases the ones it does not, and counts down to the next sparse event.

       IT IS CHEAP AND IT IS SELF-GATING. Two block reads and an object literal per frame;
       the scene id is compared against the one already playing and an unchanged scene
       does nothing at all. Inside the Haven and through the finale the director returns
       null from sceneFor() and stands down completely — those two sequences own their own
       beds and nothing here competes with them.

       `blood` DOES NOT COME FROM A BLOOD NIGHT FLAG, because the build does not have one:
       Blood Nights are a STORY.md idea that the code expresses as the stage escalation.
       Stage 2 onwards at night is the closest honest signal there is, and it is written
       here rather than invented as a new piece of state. */
    this._updateEnvironmentAudio(dt);

    this.sound.updateDayTrack(dt, !this.env.isNight);
    this.sound.setNightIntensity(this.env.nightAmount, this.env.t);
    this.sound.updateWhispers(dt, this.sanity.fraction);
    this.sound.setSanityFraction(this.sanity.fraction);
    this.sound.updateDarknessWhispers(dt, this.sanity.lightLevel);
    this.sound.updateStalkerProximityPulse(dt, this.stalkerDistance);
    /* PHASE 34 — the recorded Stalker needs a BEARING, which the pulse never did. It is
       computed with the same three lines the CRT static and the animal calls already use,
       and only when there is something to compute it for. */
    if (this.stalker && isFinite(this.stalkerDistance) && this.stalkerDistance < 34) {
      const b = this._listenerRelative(this.stalker.position);
      this.sound.updateStalkerPresence(dt, this.stalkerDistance, b.right, b.forward);
    } else {
      this.sound.updateStalkerPresence(dt, Infinity, 0, 0);
    }
    // LEVEL 4 — drives the infinite warm 8-bit chiptune loop (no-ops unless the
    // Haven's audio mode is active).
    this.sound.updateHavenMusic(dt);

    // LEVEL 3 — STATIC SUBURBIA: ambient nature bed off, spatialized CRT static
    // hum on, tracking whichever house window is currently closest.
    this.sound.setSuburbiaMode(this.player.inSuburbia);
    if (this.player.inSuburbia && this.world.nearestSuburbiaWindow) {
      const ppos = this.player.position;
      // PHASE 9 — windows now live on their own chunks and are scanned across loaded
      // chunks only, so the search set is bounded by the streaming radius rather than
      // by how far the player has explored.
      const nearest = this.world.nearestSuburbiaWindow(ppos);
      if (nearest) {
        const dx = nearest.x - ppos.x, dz = nearest.z - ppos.z;
        const yaw = this.player.yaw;
        const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
        const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
        const relRight = dx * rightX + dz * rightZ;
        const relForward = -(dx * fwdX + dz * fwdZ);
        this.sound.updateCrtStaticPosition(relRight, relForward);
      }
    }

    // Track Night survival -> Grant Memory Fragment, advance the day counter.
    // LEVEL 4 — suspended entirely inside the Haven: there is no night there (the
    // sky override holds a permanent bright midday), so counting "survived nights"
    // off the still-ticking clock would pop a horror win screen over a cozy cabin.
    if (this.player.inFakeHaven) {
      this.wasNight = false;
    } else if (this.env.isNight) {
      this.wasNight = true;
    } else if (this.wasNight) {
      this.wasNight = false;
      this.dayCount++;
      this.memoryFragments++;
      /* PHASE 26 — the night the player lived through IS the progression. Fired from the
         dawn branch, which runs once per night survived, so this needs no guard of its
         own beyond the latch inside _reachMilestone. */
      this._reachMilestone('firstNight');
      if (this.memoryFragments >= this.nightsRequired && !this.awaitingAdvance) {
        this.awaitingAdvance = true;
        this.ui.triggerWinScreen(this.stage);
      }
    }

    /* THE HOLLOWED BEHEMOTH. It arrives on the third night, near the Anchor Monument or
       near the player if none has been raised, and it carries the only Level 1 Core Disk
       in the game. Guarded against the Farmlands, Suburbia and the Haven, none of which
       has overworld spawning wired up.

       PHASE 36 — THIS GATE WAS A ONE-SHOT BOOLEAN AND IT COULD END A RUN IN SILENCE.

       `behemothSpawned` is written into the save. The Behemoth is not, because no mob
       is. So a player who saved on the third night and loaded — or simply refreshed the
       page and pressed CONTINUE — came back to a world in which the gate had already
       fired and the thing it fired was gone. There is no other source of the Disk, so
       the Farmlands, Static Suburbia, the Fake Haven and the finale were unreachable for
       the rest of that save, with nothing on screen to say why.

       The second route to the same dead end needed no save at all. The Behemoth stops
       chasing past AGGRO_RANGE and is slower than the player; walk far enough and its
       chunk is disposed, at which point it falls out of the world (see MOB_VOID_Y).

       THE GATE IS LIVE STATE NOW, NOT A LATCH. It asks the four things that are actually
       true at the moment a player has no way forward: the third night has come, the Disk
       has never been collected, no Disk is lying on the ground waiting to be, and no
       Behemoth is standing anywhere. `dayCount >= 3` rather than `=== 3` because a run
       that lost its Behemoth on night three must be able to recover on night four.

       `behemothSpawned` is still set and still saved — the debug report reads it and an
       older save carries it — it simply no longer decides anything. */
    if (!this.player.inFarmlands && !this.player.inSuburbia && !this.player.inFakeHaven &&
        this.env.isNight && this.dayCount >= 3 && !this.behemothDefeated &&
        !this.mobs.hasBehemoth() && !this._coreDiskAwaitingPickup()) {
      this.behemothSpawned = true;
      const spawnPos = this.anchorManager.activeAnchor ? this.anchorManager.activeAnchor.pos.clone() : this.player.position.clone();
      this.mobs.spawnBehemoth(spawnPos);
      /* PHASE 34 — ONE call, from where it actually arrived. Not a stinger and not a
         cue to go and look: it is placed at the real spawn bearing and the real spawn
         distance, so if the Behemoth appeared behind the player they hear it behind
         them, and if it appeared close they hear how close. */
      if (this.sound.director) {
        const b = this._listenerRelative(spawnPos);
        this.sound.director.behemothArrives(b.right, b.forward, b.dist);
      }
    }
    /* LEVEL 4 — FAKE HAVEN ILLUSION TRIGGER (PHASE 5A PART 3).
       The moment the Level 3 Rift Core Disk actually lands in the inventory — i.e.
       the player opened the chest inside The Disconnected Home and walked into the
       drop — the shift fires automatically. Checked here in the loop rather than in
       openChest() specifically so it keys off the PICKUP, not the container opening:
       the Disk spawns as a world item entity, so opening the chest and collecting the
       Disk are two distinct moments and the sequence must wait for the second. */
    if (!this.fakeHavenTriggered && this.player.inventory.hasItem(ITEM.CORE_DISK_L3)) {
      this._beginFakeHavenSequence();
    }

    // PHASE 5B — end-credits stat tracking. Sets, so a disk that is picked up, stored
    // in the cabin chest and taken out again still only ever counts once.
    for (const disk of [ITEM.CORE_DISK, ITEM.CORE_DISK_L2, ITEM.CORE_DISK_L3]) {
      if (this.player.inventory.hasItem(disk)) this.riftDisksCollected.add(disk);
    }
    if (this.player.inFarmlands) this.dimensionsBreached.add(DIMENSION.FARMLANDS);
    if (this.player.inSuburbia) this.dimensionsBreached.add(DIMENSION.SUBURBIA);
    if (this.player.inFakeHaven) this.dimensionsBreached.add(DIMENSION.FAKE_HAVEN);

    /* Core Disk pickup marks the boss defeated & Level 2 unlocked (bonus directive step 6).

       PHASE 36 — AND IT NO LONGER SETS `awaitingAdvance`. That flag means one thing: a
       STAGE has been cleared and the player has not yet chosen to descend into the next
       one. It is saved, and on load it is what puts the screen back so the stage can
       still be advanced past. The Behemoth's screen borrowed it, which made the two
       indistinguishable in a save file — and, because `behemothDefeated` is true forever
       afterwards, every stage screen taken later in the run came back from a reload
       wearing the Behemoth's title. Nothing is pending here: the screen is punctuation,
       it is dismissed by its own button, and there is nothing to restore if it is not. */
    if (!this.behemothDefeated && this.player.inventory.hasItem(ITEM.CORE_DISK)) {
      this.behemothDefeated = true;
      // PHASE 26 — the defeat itself advances progression. No XP bridges it any more.
      this._reachMilestone('behemoth');
      if (!this.awaitingAdvance) this.ui.triggerBossVictory();
    }

    /* PHASE 26 — MILESTONE: the player has somewhere to come back to. The Anchor is
       placed deep inside VoxelWorld.setBlock, which has no Game reference, so the latch
       is read here instead — beside the line that already reads activeAnchor for the HUD,
       and behind a three-element Set.has that costs nothing. */
    if (!this.milestones.has('shelter') && this.anchorManager.activeAnchor) {
      this._reachMilestone('shelter');
    }

    // HUD Directives Update
    const fuel = this.anchorManager.activeAnchor ? this.anchorManager.activeAnchor.fuel : 0;
    this.ui.updateObjectiveHUD(!!this.anchorManager.activeAnchor, fuel,
                               this.memoryFragments, this.stage, this.nightsRequired, this.dayCount);
    /* PHASE 25 — the journey ordinal advances every frame (it is two floors and a
       comparison); the OBJECTIVE re-resolves four times a second.

       PHASE 36 — FOUR TIMES A SECOND OF REAL TIME, NOT OF SIMULATED TIME. `dt` is
       clamped to 0.06 so the simulation can never be handed a frame big enough to tunnel
       the player through a wall, which makes elapsed time a function of frame rate: on a
       machine drawing ten frames a second the accumulator only reaches a quarter-second
       after five real ones, and the line telling the player what to do next lagged the
       thing it was describing by that much. The objective is a HUD element, not physics,
       so it takes the same real-time delta the opening film takes and for the same
       reason (see the note at the top of this method). Evaluating it is idempotent and
       allocation-free on the ticks that do not change the text. */
    this._updateFarmJourneyObjective();
    this.objectives.update(filmDt, this._objectiveSnapshotFn);

    this.ui.updateHotbarSelection();
    this.ui.updateVitals(this.player);
    /* ERA 1.5.6 CUT C — sanity is painted here, with the other mirrored values, instead of
       being pushed from inside SanitySystem. The HUD's `view` cache makes a per-frame set
       free when the number has not moved (CLAUDE.md §53), which is what that cache is for. */
    this.ui.setSanity(this.sanity.value);
    this.ui.setPhase(this.env.isNight, this.env.dayFraction);
    /* PHASE 20.2 — the compass. One float and an early return when the heading has not
       moved; see UIManager.updateCompass for why this is as cheap as it looks. */
    if (this.compassAcquired) this.ui.updateCompass(this.player.yaw);
    this.ui.setDay(this.dayCount);

    // PHASE 5B — applied last, after every system has finished positioning the
    // camera, so the shake is a pure render-time offset.
    this._updateCameraShake(dt);

    this.postfx.render(dt, this.sanity.fraction);
  }
}
