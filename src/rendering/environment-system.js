"use strict";
/* =====================================================================================
   THE SKY, THE SUN AND THE DAY
   ERA 1.5.6 — MOVED VERBATIM OUT OF game.html.

   The largest single presentation system in the build: sky colour, sun and moon, fog,
   ambient and directional light, the cloud field, and the 720-second day whose phase
   every other system reads. It owns the LOOK of time passing.

   IT DECIDES NO GAMEPLAY. The clock it advances is read by mobs, audio and objectives;
   it reads none of them back, and it names no block, chunk or dimension generator.

   ERA 2 REWRITES THIS FILE and keeps its shape: whatever replaces the voxel world still
   needs a sky, a sun and a day. Its per-dimension overrides (the Farmlands' haze, the
   Haven's blue, the finale's collapse) are the list of skies the game has to have.
   Every line below is byte-identical to the text that was in game.html, comments and all.
   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md section 4.8 and src/rendering/LAYER.md.
   ===================================================================================== */

class EnvironmentSystem {
  constructor(scene, renderer) {
    this.scene = scene;
    // PHASE 5A HARD FIX — 720s (12-minute) continuous cycle: a clean 420s
    // (7min) Daylight block followed by a 300s (5min) Night block. The old
    // fuzzy 90s fast-cycle legacy timing is gone; isDay/isNight below are a
    // hard boolean split on the clock (see daySeconds), while nightAmount
    // still gives a short smoothed ramp purely for the sky/light color lerp
    // so the transition doesn't hard-pop.
    this.cycleLength = 720;
    this.daySeconds = 420;
    this.nightSeconds = 300;
    this.t = 60;
    this.sun = new THREE.DirectionalLight(0xffffff, 1.0);
    this.sun.castShadow = true;
    // PHASE 3 — SHADOW READABILITY. 2048 over a tighter ±52 frustum roughly doubles
    // texel density versus the old 1024/±60, which is what turns the mushy blobs into
    // readable block-edge shadows. The bias pair kills the acne that the tighter,
    // sharper map would otherwise expose on flat-lit voxel faces.
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -52; this.sun.shadow.camera.right = 52;
    this.sun.shadow.camera.top = 52; this.sun.shadow.camera.bottom = -52;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 340;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.camera.updateProjectionMatrix();
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(this.ambient);
    // PHASE 3 — a dim sky/ground hemisphere under the ambient term. This is what
    // stops undersides and north faces from crushing to a single flat grey: they now
    // pick up a little bounce colour from the ground and a little blue from the sky.
    this.hemi = new THREE.HemisphereLight(0xA9D9F5, 0x5A4A32, 0.35);
    scene.add(this.hemi);
    this.fog = new THREE.FogExp2(0xbfe3ff, 0.008);
    scene.fog = this.fog;

    // PHASE 3 — gradient sky dome (horizon -> zenith). Explicitly hidden by every
    // dimension override below so the Farmlands / Suburbia / Haven / Nightmare skies
    // can never inherit an overworld gradient.
    this.skyDome = _makeSkyDome();
    scene.add(this.skyDome);
    this.horizonColor = new THREE.Color(0xA9D9F5);
    this.zenithColor = new THREE.Color(0x4784CB);

    // Retained for compatibility; the sky is now driven by SKY_KEYS above.
    this.dawnColor = new THREE.Color(0xff9a52);
    this.dayColor = new THREE.Color(0x7EC0EE);
    this.duskColor = new THREE.Color(0xB22222);
    this.nightColor = new THREE.Color(0x030308);

    // Visible sun & moon billboards that orbit overhead
    this.sunSprite = _makeGlowSprite('rgba(255,250,220,1)', 'rgba(255,190,90,0.9)', 26);
    this.moonSprite = _makeGlowSprite('rgba(230,240,255,1)', 'rgba(150,170,220,0.7)', 16);
    this.sunBaseScale = 26;
    this.moonBaseScale = 16;
    scene.add(this.sunSprite);
    scene.add(this.moonSprite);

    /* PHASE 3 — CLOUDS. Same billboard approach and roughly the same sprite count as
       before (cheap), but fixing the three things that made them read as wallpaper:
         - one shared silhouette  -> four variants, random mirroring, varied scale/tint
         - group pinned to player -> world-space positions wrapped modulo CLOUD_WRAP,
           so clouds genuinely pass overhead as you walk instead of riding along
         - hard wrap at the edge  -> opacity fades out across CLOUD_FADE_BAND, so a
           recycled cloud eases in rather than popping into existence. */
    this.cloudGroup = new THREE.Group();
    scene.add(this.cloudGroup);
    this.cloudTextures = [0, 1, 2, 3].map(v => _makeCloudVariantTexture(v));
    this.clouds = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const tex = this.cloudTextures[i % this.cloudTextures.length];
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      const scale = 22 + Math.random() * 30;
      // Random horizontal mirroring doubles the apparent silhouette count for free.
      sprite.scale.set(scale * (Math.random() < 0.5 ? -1 : 1), scale * (0.34 + Math.random() * 0.14), 1);
      sprite.userData.wx = (Math.random() - 0.5) * CLOUD_WRAP;
      sprite.userData.wz = (Math.random() - 0.5) * CLOUD_WRAP;
      sprite.userData.speed = CLOUD_SPEED * (0.65 + Math.random() * 0.8);
      sprite.userData.baseOpacity = 0.34 + Math.random() * 0.30;
      sprite.userData.y = 74 + Math.random() * 30;
      sprite.position.set(sprite.userData.wx, sprite.userData.y, sprite.userData.wz);
      this.cloudGroup.add(sprite);
      this.clouds.push(sprite);
    }
    this.cloudTint = new THREE.Color(0xffffff);
    this.cloudDrift = 0;
    this.followTarget = new THREE.Vector3();
    // LEVEL 2 — THE SHATTERED FARMLANDS. Set to 'rotting' | 'ashen' | null; overrides
    // the normal day/night sky+fog lerp with a fixed biome-tinted fog.
    this.farmlandsBiome = null;
    this.rottingFogColor = new THREE.Color(0x2D3328);
    this.ashenFogColor = new THREE.Color(0x171512);
    // LEVEL 3 — STATIC SUBURBIA: constant pastel-yellow liminal overcast (see
    // setSuburbiaOverride/update above).
    this.suburbiaActive = false;
    this.suburbiaColor = new THREE.Color(0xE8E5BA);
    // LEVEL 4 — THE FAKE HAVEN (PHASE 5A PART 3): bright sky blue (#7EC0EE) fog and
    // sky with deliberately HIGH visibility — the density below is a fraction of even
    // the overworld's clearest daytime value, so the clearing reads open and safe
    // rather than closed-in. Overrides the Suburbia and Farmlands paths entirely.
    this.fakeHavenActive = false;
    this.fakeHavenColor = new THREE.Color(FAKE_HAVEN_SKY_COLOR);
    /* PHASE 32 — how far the Haven has been removed, 0..1, written every frame by the
       stage machine from the pure havenDissolveAt(). Zero for the whole intact sequence.
       Two scratch colours so the ramp never allocates in the frame loop. */
    this.havenDissolve = 0;
    this.finaleFog = null;              // PHASE 33 — see setFinaleFog
    /* PHASE 33 — THE FINALE'S SKY, AND WHY IT IS NOT BLACK.

       It was 0x05060a, and the creature is 0x04050a. A silhouette is a CONTRAST, and
       those two are the same colour: the first render of the scale beat came back as an
       empty grey plain with a landmark ladder on it and no creature anywhere, because a
       near-black shape seen through near-black fog is not a shape.

       The reveal works the other way round. Everything in this scene is DARKER than the
       air it stands in, so heavy fog washes the distance out to sky colour and hides it,
       and thinning fog lets the dark shapes emerge. That only functions if the sky has
       somewhere to wash TO — hence a dim cold slate, bright enough to silhouette against
       at 320m and dark enough that the beat called `silence` still reads as almost
       nothing. */
    this._finaleColor = new THREE.Color(0x1b2029);
    this._havenFogColor = new THREE.Color(FAKE_HAVEN_SKY_COLOR);
    this._havenPale = new THREE.Color(0xBFC6C9);
    // PHASE 5B — THE HAVEN SHIFT: blood red (#4A0000) fog/sky, applied INSTANTLY (no
    // lerp) the moment the illusion collapses, and checked ahead of every other
    // override so nothing can repaint over it.
    this.nightmareActive = false;
    this.nightmareColor = new THREE.Color(NIGHTMARE_SKY_COLOR);

    /* D1 PHASE 4 — THE SKY AS AN ENVIRONMENT FOR PBR MATERIALS. Driven from the same sky
       and ambient numbers the rest of this class computes, so it follows the day, every
       dimension's override and the night — at night the ambient budget falls and so does
       this. It is NOT attached to the voxel scene: that scene is Lambert, and r152+ would
       light Lambert with it. A scene with PBR content attaches it
       (`env.skyEnvironment.attach(scene)`); until one does, it builds nothing at all.
       See src/rendering/sky-environment.js. */
    this.skyEnvironment = new SkyEnvironment(renderer);
  }

  /* One call per frame, after the sky is decided. The sky's own colour where the hemisphere
     is off (every dimension override sets it to zero), the fog as the horizon, the
     hemisphere's ground colour below, and the scene's ambient budget as the brightness. */
  _driveSkyEnvironment(dt) {
    const bg = this.scene.background && typeof this.scene.background.r === 'number' ? this.scene.background : null;
    const zenith = this.hemi.intensity > 0 ? this.hemi.color : (bg || this.fog.color);
    this.skyEnvironment.request(zenith, this.fog.color, this.hemi.groundColor,
                                this.ambient.intensity + this.hemi.intensity);
    this.skyEnvironment.update(dt);
  }

  /* D1 PHASE 4 — THE SKY'S LIGHTS ARE AUTHORED IN ERA 1 UNITS AND TRANSFERRED ONCE A FRAME.

     Every intensity `_updateSky` writes was tuned against a renderer with no output encode;
     `legacyLinear` turns each into the linear level that looks the same on the corrected one
     (src/shared/color-transfer.js). Not every branch of `_updateSky` writes all three lights
     every frame, so the AUTHORED values are put back before it runs — otherwise a light a
     branch leaves alone would be transferred again every frame and compound to black. What
     the rest of the game reads afterwards is the linear value the renderer is using. */
  update(dt) {
    const a = this._authoredLight;
    if (a) { this.sun.intensity = a.sun; this.ambient.intensity = a.ambient; this.hemi.intensity = a.hemi; }
    this._updateSky(dt);
    this._authoredLight = { sun: this.sun.intensity, ambient: this.ambient.intensity, hemi: this.hemi.intensity };
    this.sun.intensity = legacyLinear(this.sun.intensity);
    this.ambient.intensity = legacyLinear(this.ambient.intensity);
    this.hemi.intensity = legacyLinear(this.hemi.intensity);
    this._driveSkyEnvironment(dt);
  }

  get dayFraction() { return (this.t % this.cycleLength) / this.cycleLength; }

  // Seconds elapsed within the current 720s cycle (0-720).
  get cycleSeconds() { return this.dayFraction * this.cycleLength; }

  // HARD BOOLEAN SPLIT — exactly 420s Daylight then exactly 300s Night, no
  // fuzzy overlap. Used for all gameplay gating (day counter, stalker/mob
  // spawn windows, sound day-track).
  get isDay() { return this.cycleSeconds < this.daySeconds; }
  get isNight() { return !this.isDay; }

  /* PHASE 3 — COSMETIC DARKNESS RAMP.

     AUDIT NOTE: nightAmount is documented as, and provably is, purely cosmetic — its
     only consumer outside this class is sound.setNightIntensity() (the ambient wind
     bed gain). Every gameplay gate (mob spawns, the Stalker window, the day counter,
     sanity, the day music track, the HUD phase label) reads isDay/isNight, which are
     an untouched hard split at exactly 420s. Reshaping this curve therefore cannot
     move a single gameplay beat.

     Old shape: a flat 20s ramp at 400-420 — day slammed into night in under half a
     minute. New shape spreads the DARKENING across 380-448 so the last light dies a
     little way past the boundary, which is what makes 420 land as a beat rather than
     a switch: mobs begin spawning while the sky is still visibly failing. */
  get nightAmount() {
    const s = this.cycleSeconds;
    if (s < DUSK_DARK_START) return 0;
    if (s < DUSK_DARK_END) {
      const p = (s - DUSK_DARK_START) / (DUSK_DARK_END - DUSK_DARK_START);
      return p * p * (3 - 2 * p); // smoothstep — no linear-ramp "corner" at each end
    }
    if (s < DAWN_START) return 1;
    if (s < this.cycleLength) {
      const p = (s - DAWN_START) / (this.cycleLength - DAWN_START);
      return 1 - p * p * (3 - 2 * p);
    }
    return 0;
  }

  /* Warmth of the light, independent of how dark it is. Runs AHEAD of nightAmount so
     the sequence reads normal daylight -> long warm golden hour -> dimming dusk ->
     night, instead of simply fading to black. */
  get duskAmount() {
    const s = this.cycleSeconds;
    if (s < DUSK_WARM_START) return 0;
    if (s < 414) {
      const p = (s - DUSK_WARM_START) / (414 - DUSK_WARM_START);
      return p * p * (3 - 2 * p);
    }
    if (s < DUSK_DARK_END) return 1 - (s - 414) / (DUSK_DARK_END - 414);
    return 0;
  }

  /* PHASE 3 — SUN / MOON ARC.

     AUDIT NOTE: the previous orbit was `angle = dayFraction * 2PI - PI/2` on a uniform
     720s rotation, while Day/Night is a 420/300 split. The two never agreed, so:
       - the sun was BELOW the horizon for the first ~158s of Day (38% of daytime),
       - the moon was up in a bright blue sky for that whole stretch,
       - and the sun was still high overhead ~140s INTO Night.
     Each body now traverses its own phase: the sun rises at s=0, peaks at s=210 and
     sets exactly at s=420 (the Day/Night boundary); the moon rises at 420, peaks at
     570 and sets at 720, handing straight back to sunrise. Cycle length, phase
     lengths and isDay/isNight are all untouched — only where the billboards are
     drawn, and therefore which way the shadows fall, has changed. */
  _bodyArc(theta, out) {
    const R = 150;
    out.set(
      Math.cos(theta) * R,
      Math.sin(theta) * R * 0.94,
      40 + Math.sin(theta) * R * 0.30 // tilt the arc south so noon isn't dead vertical
    );
    return out;
  }

  /* Both angles run continuously through the WHOLE cycle, 0 -> 2PI, but at different
     rates in each phase: the upper half (0..PI, above the horizon) is stretched across
     the body's own phase and the lower half (PI..2PI, below it) across the other. A
     body must keep travelling while it is down — parking it at PI would leave it
     sitting exactly on the horizon, still half-visible, for its entire off-phase. */
  get sunTheta() {
    const s = this.cycleSeconds;
    return s < this.daySeconds
      ? Math.PI * (s / this.daySeconds)                                 // up:   rise -> set
      : Math.PI * (1 + (s - this.daySeconds) / this.nightSeconds);      // down: under the world
  }

  get moonTheta() {
    const s = this.cycleSeconds;
    return s < this.daySeconds
      ? Math.PI * (1 + s / this.daySeconds)                             // down: under the world
      : Math.PI * ((s - this.daySeconds) / this.nightSeconds);          // up:   rise -> set
  }

  setFollowTarget(pos) { this.followTarget.copy(pos); }
  // 'rotting' | 'ashen' | null — see farmlandsBiomeAt().
  setFarmlandsOverride(biome) { this.farmlandsBiome = biome || null; }
  // Static Suburbia (Level 3) — fixed pastel-yellow overcast, no sun/moon/shadows.
  setSuburbiaOverride(active) { this.suburbiaActive = !!active; }
  // The Fake Haven (Level 4) — permanent bright blue midday sky, high visibility.
  setFakeHavenOverride(active) { this.fakeHavenActive = !!active; }
  /* PHASE 32 — THE HAVEN BEING REMOVED. One number, 0..1, and everything the sky does
     about it is derived from it below: the fog closes in, the colour drains toward a
     dead pale grey, the sun and the ambient go down, and the clouds stop.

     Note what this is NOT: it is not the nightmare override, which is an instant snap to
     blood red and belongs to the shift. This is the gentle one — the safe place going
     away rather than turning. Kept as a plain setter with no side effects so the frame
     loop can write it unconditionally. */
  setHavenDissolve(amount) {
    this.havenDissolve = Math.max(0, Math.min(1,
      (typeof amount === 'number' && isFinite(amount)) ? amount : 0));
  }

  /* PHASE 33 — THE FINALE'S AIR. A density in metres^-1, or null to hand the sky back.

     It is a full override rather than another dimension flag because the finale is not in
     a dimension: it is standing on ground the world does not otherwise contain, and every
     other branch of update() would repaint the sky underneath it. Checked FIRST in
     update() for exactly that reason. See FINALE_FOG for where the numbers come from. */
  setFinaleFog(density) {
    this.finaleFog = (typeof density === 'number' && isFinite(density) && density > 0)
      ? density : null;
  }
  // PHASE 5B — The Haven Shift: instant blood-red collapse of the sky and fog.
  setNightmareOverride(active) { this.nightmareActive = !!active; }

  /* Returns the HORIZON colour for this moment, and refreshes this.horizonColor /
     this.zenithColor as a side effect. The horizon colour is what fog and the scene
     background use, so distant terrain always dissolves into the sky it is standing
     against rather than into an unrelated flat tone. */
  _skyColorForFraction(f) {
    sampleSkyKeys(f * this.cycleLength, this.horizonColor, this.zenithColor);
    return this.horizonColor;
  }

  _updateSky(dt) {
    this.t += dt;
    const f = this.dayFraction;

    /* PHASE 33 — THE FINALE. Checked before every dimension override, because the final
       sequence is not standing in one: the ground under it is the finale's own, and any
       other branch would repaint the sky over the top of it. Near-black and almost
       lightless — the creature is a silhouette and a silhouette needs nothing behind it
       but air. */
    if (this.finaleFog !== null) {
      this.sun.visible = false;
      this.sun.castShadow = false;
      this.sunSprite.visible = false;
      this.moonSprite.visible = false;
      this.cloudGroup.visible = false;
      this.skyDome.visible = false;
      this.hemi.intensity = 0;
      this.scene.background = this._finaleColor;
      this.fog.color = this._finaleColor;
      this.fog.density = this.finaleFog;
      /* Just enough ambient that the ground plane is not a void, and not enough to give
         anything form. Requirement 14: the player never gets a lit model. */
      this.ambient.intensity = 0.16;
      this.ambient.color = this._finaleColor;
      return;
    }

    // PHASE 5B — THE HAVEN SHIFT. Checked before the Haven's own blue-sky override so
    // the collapse always wins. There is no transition here on purpose: the color
    // snaps from #7EC0EE to #4A0000 between one frame and the next, and the fog
    // density jumps an order of magnitude so the safe, open clearing becomes a
    // claustrophobic red box instantly. Sun and clouds are removed outright.
    if (this.nightmareActive) {
      this.sun.visible = false;
      this.sun.castShadow = false;
      this.sunSprite.visible = false;
      this.moonSprite.visible = false;
      this.cloudGroup.visible = false;
      // PHASE 3 — DIMENSION SAFETY. The gradient dome and the hemisphere bounce are
      // overworld-only; both are explicitly killed here so the Haven Shift can never
      // inherit a blue sky band or a sky-tinted fill above its blood red.
      this.skyDome.visible = false;
      this.hemi.intensity = 0;
      this.scene.background = this.nightmareColor;
      this.fog.color = this.nightmareColor;
      this.fog.density = 0.055;
      this.ambient.intensity = 0.42;
      this.ambient.color = new THREE.Color(0xff6a6a);
      return;
    }

    // THE FAKE HAVEN (Level 4) — a permanent, unchanging bright blue midday.
    // Checked FIRST so it wins over the Suburbia and Farmlands overrides no matter
    // what stale dimension flags are still set. Fog is #7EC0EE at a very low density
    // (0.006 vs the overworld's 0.015 clearest daytime value), which is what gives
    // the required high visibility: the fog wall ring is warm sprite haze, not the
    // scene fog, so the clearing itself stays crisp and open all the way to the edge.
    if (this.fakeHavenActive) {
      const sunPos = new THREE.Vector3(60, 140, 70).add(this.followTarget);
      this.sun.visible = true;
      this.sun.castShadow = true;
      this.sun.position.copy(sunPos);
      this.sun.target.position.copy(this.followTarget);
      this.sun.intensity = 1.55;
      this.sun.color = new THREE.Color(0xfff6e2);
      this.sunSprite.visible = true;
      this.sunSprite.position.copy(sunPos);
      this.sunSprite.material.opacity = 1.0;
      this.moonSprite.visible = false;
      // Reset any overworld dusk swell/tint still on the billboard — the Haven's sun
      // must always read as a fixed, innocent midday.
      this.sunSprite.scale.set(this.sunBaseScale, this.sunBaseScale, 1);
      this.sunSprite.material.color.setHex(0xffffff);
      // PHASE 3 — DIMENSION SAFETY. The Haven keeps its own flat, deliberately
      // unchanging #7EC0EE sky: the overworld gradient dome and hemisphere bounce stay
      // off so no time-of-day tint can bleed into the illusion.
      this.skyDome.visible = false;
      this.hemi.intensity = 0;
      this.cloudGroup.visible = true;
      // Drift the clouds gently so the sky is alive but never threatening. Uses the
      // same wrap+fade helper as the overworld so the Haven's clouds picked up the
      // no-popping fix too, but at a slower, calmer drift.
      /* PHASE 32 — THE DISSOLVE, and the ONE moving thing in this sky.

         The clouds are the only part of the Haven's sky that ever changes, which makes
         stopping them the cheapest and quietest "time is wrong" beat available: the
         `thinning` stage sets drift to 0 through the dissolve ramp and the sky becomes a
         painting. Nothing announces it. A player who never looks up never learns it. */
      const dis = this.havenDissolve;
      this._updateClouds(dt * (1 - dis), 0.7, 0.62, _havenCloudTint);
      /* The fog closes in and drains. Both are ramps off the same number, so the room
         cannot get dimmer than it gets distant or the other way round. The density
         target (0.075) is well past the nightmare's own 0.055 — by the end of the
         dissolve the far wall of a 48-block clearing is genuinely gone. */
      this._havenFogColor.copy(this.fakeHavenColor).lerp(this._havenPale, dis * 0.9);
      this.scene.background = this._havenFogColor;
      this.fog.color = this._havenFogColor;
      this.fog.density = 0.006 + dis * 0.069;
      // The light collapses with it: midday down to almost nothing, and the sun's own
      // billboard fades out rather than hanging in a grey sky.
      this.sun.intensity = 1.55 * (1 - dis * 0.85);
      this.sunSprite.material.opacity = 1.0 - dis;
      this.ambient.intensity = 0.95 * (1 - dis * 0.8);
      this.ambient.color = _havenAmbientColor.setHex(0xEAF4FF).lerp(this._havenPale, dis);
      return;
    }

    // STATIC SUBURBIA (Level 3) — constant pastel-yellow overcast with flat
    // fixed overhead illumination: no sun, no moon, no directional shadows,
    // and no day/night sky lerp at all. Short-circuits the rest of update()
    // entirely (clock keeps ticking via this.t above for gameplay gating,
    // but nothing about the sky/lighting reacts to it while here).
    if (this.suburbiaActive) {
      this.sun.visible = false;
      this.sun.castShadow = false;
      this.sunSprite.visible = false;
      this.moonSprite.visible = false;
      this.cloudGroup.visible = false;
      // PHASE 3 — DIMENSION SAFETY. Suburbia's whole point is flat, sourceless,
      // liminal overcast: a gradient dome or a directional hemisphere tint would
      // reintroduce exactly the sense of sky depth this dimension removes.
      this.skyDome.visible = false;
      this.hemi.intensity = 0;
      this.scene.background = this.suburbiaColor;
      this.fog.color = this.suburbiaColor;
      this.fog.density = 0.022;
      this.ambient.intensity = 1.05;
      this.ambient.color = this.suburbiaColor;
      return;
    }
    this.sun.visible = true;
    this.cloudGroup.visible = true;

    const night = this.nightAmount;
    const dusk = this.duskAmount;

    // --- SUN / MOON ARC ----------------------------------------------------------
    // See the audit note on sunTheta: each body now traverses its own phase, so the
    // sun sets exactly as Night begins and the moon sets exactly as Day begins.
    const sunPos = this._bodyArc(this.sunTheta, _envTmpSun).add(this.followTarget);
    const moonPos = this._bodyArc(this.moonTheta, _envTmpMoon).add(this.followTarget);
    this.sun.position.copy(sunPos);
    this.sun.target.position.copy(this.followTarget);
    this.sunSprite.position.copy(sunPos);
    this.moonSprite.position.copy(moonPos);

    // Elevation 0..1 above the follow point, used for horizon fades and sun swell.
    const sunElev = (sunPos.y - this.followTarget.y) / 150;
    const moonElev = (moonPos.y - this.followTarget.y) / 150;
    // Fade across the horizon instead of snapping visible/invisible — the old hard
    // toggle popped the billboard on and off mid-sky.
    const sunFade = THREE.MathUtils.clamp((sunElev + 0.06) / 0.16, 0, 1);
    const moonFade = THREE.MathUtils.clamp((moonElev + 0.06) / 0.16, 0, 1);
    this.sunSprite.visible = sunFade > 0.01;
    this.moonSprite.visible = moonFade > 0.01;
    this.sunSprite.material.opacity = sunFade;
    this.moonSprite.material.opacity = moonFade * THREE.MathUtils.lerp(0.35, 1.0, night);
    // The sun swells and reddens as it nears the horizon — the single strongest
    // "nostalgic sunset" cue available for the cost of a scale and a colour.
    const swell = 1 + (1 - THREE.MathUtils.clamp(sunElev, 0, 1)) * 0.85;
    const sunScale = this.sunBaseScale * swell;
    this.sunSprite.scale.set(sunScale, sunScale, 1);
    this.sunSprite.material.color.setHex(0xffffff).lerp(_sunSetTint, dusk * 0.85);
    this.moonSprite.scale.set(this.moonBaseScale, this.moonBaseScale, 1);

    // --- CLOUDS ------------------------------------------------------------------
    // Tint clouds toward the horizon colour so they belong to the sky they sit in:
    // white at midday, amber at dusk, near-black silhouettes at night.
    this._skyColorForFraction(f);
    this.cloudTint.setHex(0xffffff)
      .lerp(this.horizonColor, Math.max(dusk * 0.7, night * 0.85));
    this._updateClouds(dt, 1.0, THREE.MathUtils.lerp(0.62, 0.30, night), this.cloudTint);

    // --- SKY / FOG ---------------------------------------------------------------
    let skyColor;
    let useGradient = true;
    if (this.farmlandsBiome === 'rotting') {
      // Rotting Fields — dim, mossy, decayed green-grey fog, static (no day/night lerp).
      skyColor = this.rottingFogColor;
      useGradient = false;
    } else if (this.farmlandsBiome === 'ashen') {
      // Ashen Forest — a darker, cinder-tinted fog under the Black Canopy.
      skyColor = this.ashenFogColor;
      useGradient = false;
    } else {
      skyColor = this.horizonColor;
    }

    // PHASE 3 — DIMENSION SAFETY. The Farmlands biomes are a flat, oppressive,
    // time-independent fog by design, so the gradient dome is switched off for them
    // exactly as it is for Suburbia/Haven/Nightmare. Only the true overworld gets it.
    this.skyDome.visible = useGradient;
    if (useGradient) {
      this.skyDome.position.copy(this.followTarget);
      this.skyDome.material.uniforms.topColor.value.copy(this.zenithColor);
      this.skyDome.material.uniforms.bottomColor.value.copy(this.horizonColor);
    }
    this.scene.background = skyColor;
    this.fog.color = skyColor;
    // Fog density: 0.015 (Day) lerping to 0.045 (Night); the Farmlands pocket stays
    // thicker/closer than the overworld regardless of time of day. UNCHANGED.
    this.fog.density = this.farmlandsBiome ? 0.028 : (0.015 + night * 0.03);

    // --- LIGHTING ----------------------------------------------------------------
    // Shadows are dropped once the sun is effectively down: at that point the
    // directional light contributes almost nothing, so the shadow pass is pure cost
    // and can only produce implausible near-horizontal shadows.
    this.sun.castShadow = sunElev > 0.04 && night < 0.97;

    this.sun.intensity = THREE.MathUtils.lerp(1.8, 0.06, night);
    // Sun colour walks daylight -> warm gold -> deep dusk red -> cold night, so the
    // world itself warms through the golden hour before it darkens.
    _envTmpColor.copy(_sunDayColor).lerp(_sunDuskColor, dusk);
    this.sun.color.copy(_envTmpColor).lerp(_sunNightColor, Math.min(1, night * 1.25));

    // Ambient floor kept at the Phase-5A daylight value (0.85) so hillsides stay
    // bright and nostalgic rather than crushing to grey.
    this.ambient.intensity = THREE.MathUtils.lerp(0.85, 0.16, night);
    _envTmpColor.copy(_ambDayColor).lerp(_ambDuskColor, dusk);
    this.ambient.color.copy(_envTmpColor).lerp(_ambNightColor, night);

    // Hemisphere bounce: sky colour above, warm earth below, fading out with the sun.
    // PHASE 3 — DIMENSION SAFETY. This light is new in Phase 3, so it is switched off
    // entirely inside the Farmlands: those biomes share this code path for their
    // sun/ambient lerp, and letting a sky-tinted fill in would hand them a
    // time-of-day-varying light source they never had before.
    if (this.farmlandsBiome) {
      this.hemi.intensity = 0;
    } else {
      this.hemi.intensity = THREE.MathUtils.lerp(0.35, 0.05, night);
      this.hemi.color.copy(this.zenithColor);
      this.hemi.groundColor.copy(_hemiGround).lerp(_hemiGroundNight, night);
    }
  }

  /* Shared cloud stepper for the overworld and the Fake Haven.

     World-space wrapping (rather than the old "pin the group to the player and slide
     sprites along a local axis") is what buys the parallax: the clouds hold still in
     world space while you walk under them, and only wrap once they are a full
     CLOUD_WRAP away — where the edge fade hides the recycle entirely. */
  _updateClouds(dt, speedScale, targetOpacity, tint) {
    this.cloudDrift += dt;
    this.cloudGroup.position.set(this.followTarget.x, 0, this.followTarget.z);
    const half = CLOUD_WRAP * 0.5;
    for (const cloud of this.clouds) {
      const ud = cloud.userData;
      ud.wx += ud.speed * speedScale * dt;

      // Position relative to the player, wrapped into [-half, half).
      let rx = ud.wx - this.followTarget.x;
      let rz = ud.wz - this.followTarget.z;
      rx = ((rx + half) % CLOUD_WRAP + CLOUD_WRAP) % CLOUD_WRAP - half;
      rz = ((rz + half) % CLOUD_WRAP + CLOUD_WRAP) % CLOUD_WRAP - half;
      cloud.position.set(rx, ud.y, rz);

      // Fade toward the wrap boundary so nothing ever appears or vanishes on-screen.
      const edge = Math.min(half - Math.abs(rx), half - Math.abs(rz));
      const fade = THREE.MathUtils.clamp(edge / CLOUD_FADE_BAND, 0, 1);
      cloud.material.opacity = ud.baseOpacity * targetOpacity * fade * 1.6;
      if (tint) cloud.material.color.copy(tint);
    }
  }
}
