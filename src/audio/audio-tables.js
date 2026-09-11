"use strict";
/* =====================================================================================
   THE AUDIO TABLES — WHAT SOUNDS EXIST, AND WHERE THEY BELONG
   ERA 1.5.2 — EXTRACTED VERBATIM FROM game.html.

   Pure data, every row of it: the asset manifest, the voice limits, the surface groups,
   the ten step surfaces, the fourteen scenes, the nine sparse event tables, the preload
   list and the cue vocabulary.

   ADDING A SOUND MEANS ADDING A ROW, NOT A PLAYBACK CALL. That was Phase 34's design and
   it is why these tables can be lifted out whole while SoundEngine, AudioLibrary and
   AudioDirector stay exactly where they are. Nothing in this file plays anything, reads
   game state, or touches an AudioNode.

   AUDIO_ASSETS IS GENERATED. Regenerate it with tests/tools/build_runtime.py; never
   hand-edit it. A filename's Freesound id is the join key to AUDIO_CREDITS and
   AUDIO_INDEX.md, so renaming a file is a licence break, not untidiness.

   AUDIO_SURFACE_GROUPS is the one table here that knows a block id exists, which is why
   block-catalog.js loads before this file. Phase 34 already flagged it and
   AudioDirector.surfaceAt() as the two things Era 2 replaces.

   The three source ranges were not adjacent — the library and the director sat between
   them — so this file is three verbatim pieces in their original order.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md and src/audio/LAYER.md.
   ===================================================================================== */

/* =====================================================================================
   PHASE 34 — THE SAMPLE LIBRARY.

   WHAT THIS IS AND WHAT IT IS NOT. Everything above this line is SYNTHESIS: the night
   bed, the chiptune, the CRT static, the whispers, the proximity pulse. None of it is
   replaced and none of it is deleted. This is a second source of sound — recorded
   material — sitting on the same buses, answering the same sliders, torn down by the
   same calls. SoundEngine stays the mixer and the synthesiser; AudioLibrary is the
   sampler; AudioDirector is the only thing that decides WHAT should be sounding.

   THE THREE-LAYER SPLIT IS THE WHOLE DESIGN, and it is the answer to the brief's
   "implement a proper centralized audio system rather than scattering audio playback
   calls throughout the game":

     SoundEngine    owns the AudioContext, the buses and the synthesised voices.
                    It is the only thing that talks to the hardware.
     AudioLibrary   owns files: fetching, decoding, caching, voice limits, panning,
                    distance, looping beds, fades, and failing safely. It knows nothing
                    about dimensions, blocks, time of day or the player.
     AudioDirector  owns policy: which bed belongs to which place, which surface a
                    footstep is on, how rarely a distant sound may happen. It reads game
                    state and calls the library. It never touches an AudioNode.

   That split is why Era 2 can throw away the voxel Overworld without touching a line of
   the library, and why a new dimension is a row in AUDIO_SCENES rather than a new rig.

   THE MANIFEST IS THE INDEX. Every id below has a row in assets/audio/AUDIO_INDEX.md and
   an attribution line in assets/audio/AUDIO_CREDITS, joined by the Freesound id that is
   the first field of every filename — which is why filenames are never rewritten and why
   the manifest points at a numeric name rather than a descriptive one.

   FILES ARE RUNTIME COPIES, NOT SOURCES. assets/audio/runtime/ is built from the
   originals by tests/tools/build_runtime.py and is entirely disposable; the originals in
   assets/audio/ are never read by the game and never written to by anything. Three
   encodes, and each one is a decision:

     steps/<id>_NN.wav   the footstep recordings are five-to-ten-step SEQUENCES, useless
                         as a one-shot. Sliced on onset into single footfalls, peak
                         aligned to within 14ms, normalised, fade-tailed.
     <id>.wav            cues under 8 seconds. WAV because every MP3 decoder prepends its
                         own silence and a cue that answers a key press cannot start late.
     <id>.mp3            beds and long cues. MP3 rather than Ogg because Safari could not
                         decode Vorbis until 17.4. Beds are cut to 30 seconds AS A MEMORY
                         DECISION — decodeAudioData expands to 32-bit float at the context
                         rate, so the 208-second drone would have been 73MB decoded — and
                         the seam that cut leaves is removed by _loopify below, not hidden.
   ===================================================================================== */
const AUDIO_ROOT = 'assets/audio/runtime/';

/* =====================================================================================
   PHASE 34.3 — THE TRANSPORT, AND THE FAILURE THREE PHASES COULD NOT SEE.

   The library has exactly one way to get bytes: fetch() into decodeAudioData. That works
   over http:// and https:// and it CANNOT WORK AT ALL from a file:// page. Chrome refuses
   fetch and XMLHttpRequest for a local file ("URL scheme file is not supported"), and the
   one route that does load — an <audio> element — is cross-origin-tainted the moment it
   reaches createMediaElementSource, so it plays into Web Audio as digital silence. There
   is no fourth option. A player who opens game.html by double-clicking it gets every one
   of the 274 runtime files failing, permanently.

   WHY THAT WAS INVISIBLE. Failure is a NORMAL OUTCOME in this class by design: a bad key
   returns false, latches, and never asks again. That is right for one asset and wrong for
   all of them at once — losing the entire library is not a missing sound, it is a missing
   subsystem, and nothing aggregated the per-key failures into that statement. Every suite
   this project has ever run serves game.html over HTTP, so no test could see it either.

   WHAT THE PLAYER HEARD, AND WHY IT LOOKED LIKE A MIX PROBLEM. Every sound that survived
   has a SYNTHESISED twin that runs when the recording does not: the footstep, the menu
   click, the Stalker's proximity pulse. Every sound that vanished is recording-only, and
   ambience is all of it. Three consecutive playtests reported exactly the procedural
   voices and never once a recording — which is why normalising every file (34.1) and
   rewriting the distance curve (34.2) changed nothing a human could hear.

   Detected up front rather than discovered 274 failures later: the origin is knowable
   before an AudioContext exists, and short-circuiting keeps a blocked run from flooding
   the console with one CORS error per asset. */
const AUDIO_TRANSPORT_BLOCKED = (() => {
  try {
    return (typeof location !== 'undefined' && location && location.protocol === 'file:');
  } catch (e) { return false; }         // an exotic embedding with no location at all
})();

/* One entry per sound the game can ask for. `k` is the encode class, `d` the runtime
   duration in seconds, `f` the file; a `step` entry carries its slices in `v` instead.
   GENERATED — regenerate with tests/tools/build_runtime.py, do not hand-edit. */
const AUDIO_ASSETS = Object.freeze({
  // --- Interior / home ambience ------------------------------------------
  'bed.interior.house': { k:'bed', d:30.0, f:'511688.mp3' },
  'bed.interior.quiet': { k:'bed', d:30.0, f:'751329.mp3' },
  'bed.interior.basement': { k:'bed', d:30.0, f:'714170.mp3' },
  'bed.interior.clock': { k:'bed', d:30.0, f:'416002.mp3' },
  'bed.haven.room': { k:'bed', d:18.0, f:'805394.mp3' },
  'bed.interior.tick': { k:'bed', d:16.4, f:'790019.mp3' },
  'sfx.clock.wrong': { k:'sfx', d:20.0, f:'328067.mp3' },
  'sfx.clock.pendulum': { k:'sfx', d:9.6, f:'342926.mp3' },
  // --- Haven -------------------------------------------------------------
  'bed.haven.hearth': { k:'bed', d:30.0, f:'387128.mp3' },
  'bed.haven.outside': { k:'bed', d:30.0, f:'259228.mp3' },
  'bed.air.still': { k:'bed', d:12.2, f:'829081.mp3' },
  // --- Footsteps ---------------------------------------------------------
  'step.soft': { k:'step', n:6, v:['813621_00.wav', '813621_01.wav', '813621_02.wav', '813621_03.wav', '813621_04.wav', '813621_05.wav'] },
  'step.grass': { k:'step', n:8, v:['807862_00.wav', '807862_01.wav', '807862_02.wav', '807862_03.wav', '807862_04.wav', '807862_05.wav', '807862_06.wav', '807862_07.wav'] },
  'step.gravel': { k:'step', n:8, v:['352870_00.wav', '352870_01.wav', '352870_02.wav', '352870_03.wav', '352870_04.wav', '352870_05.wav', '352870_06.wav', '352870_07.wav'] },
  'step.leaves': { k:'step', n:8, v:['530384_00.wav', '530384_01.wav', '530384_02.wav', '530384_03.wav', '530384_04.wav', '530384_05.wav', '530384_06.wav', '530384_07.wav'] },
  'step.mud': { k:'step', n:8, v:['548384_00.wav', '548384_01.wav', '548384_02.wav', '548384_03.wav', '548384_04.wav', '548384_05.wav', '548384_06.wav', '548384_07.wav'] },
  'step.stone': { k:'step', n:6, v:['813622_00.wav', '813622_01.wav', '813622_02.wav', '813622_03.wav', '813622_04.wav', '813622_05.wav'] },
  'step.pavement': { k:'step', n:8, v:['682773_00.wav', '682773_01.wav', '682773_02.wav', '682773_03.wav', '682773_04.wav', '682773_05.wav', '682773_06.wav', '682773_07.wav'] },
  'step.wood': { k:'step', n:5, v:['366111_00.wav', '366111_01.wav', '366111_02.wav', '366111_03.wav', '366111_04.wav'] },
  'step.hollow': { k:'step', n:8, v:['459970_00.wav', '459970_01.wav', '459970_02.wav', '459970_03.wav', '459970_04.wav', '459970_05.wav', '459970_06.wav', '459970_07.wav'] },
  'step.stairs': { k:'step', n:8, v:['830503_00.wav', '830503_01.wav', '830503_02.wav', '830503_03.wav', '830503_04.wav', '830503_05.wav', '830503_06.wav', '830503_07.wav'] },
  'step.plain': { k:'step', n:8, v:['19263_00.wav', '19263_01.wav', '19263_02.wav', '19263_03.wav', '19263_04.wav', '19263_05.wav', '19263_06.wav', '19263_07.wav'] },
  // --- Doors, furniture and objects --------------------------------------
  'sfx.door.open': { k:'sfx', d:1.7, f:'213406.wav' },
  'sfx.door.close': { k:'sfx', d:1.0, f:'213404.wav' },
  'sfx.door.open2': { k:'sfx', d:7.4, f:'432562.wav' },
  'sfx.door.close2': { k:'sfx', d:19.0, f:'340046.mp3' },
  'sfx.door.squeak': { k:'sfx', d:20.0, f:'858958.mp3' },
  'sfx.door.screen': { k:'sfx', d:11.9, f:'848616.mp3' },
  'sfx.creak.long': { k:'sfx', d:20.0, f:'583119.mp3' },
  'sfx.creak.door': { k:'sfx', d:8.5, f:'704612.mp3' },
  'sfx.door.handle': { k:'sfx', d:20.0, f:'534337.mp3' },
  'sfx.knock.near': { k:'sfx', d:0.7, f:'841281.wav' },
  'sfx.knock.seq': { k:'sfx', d:13.5, f:'728214.mp3' },
  'sfx.knock.distant': { k:'sfx', d:20.0, f:'186517.mp3' },
  'sfx.door.slam': { k:'sfx', d:20.0, f:'450791.mp3' },
  'sfx.doorbell': { k:'sfx', d:16.5, f:'440869.mp3' },
  'sfx.drawer': { k:'sfx', d:4.6, f:'364106.wav' },
  'sfx.cabinet': { k:'sfx', d:3.4, f:'421033.wav' },
  'sfx.cabinet2': { k:'sfx', d:5.5, f:'470619.wav' },
  'sfx.chair': { k:'sfx', d:1.4, f:'415939.wav' },
  'sfx.chair.drag': { k:'sfx', d:8.0, f:'654148.wav' },
  'sfx.couch': { k:'sfx', d:20.0, f:'766645.mp3' },
  'sfx.creak.quiet': { k:'sfx', d:3.0, f:'238288.wav' },
  'sfx.creak.a': { k:'sfx', d:1.0, f:'502505.wav' },
  'sfx.creak.b': { k:'sfx', d:1.2, f:'506665.wav' },
  'sfx.creak.c': { k:'sfx', d:14.1, f:'796507.mp3' },
  'sfx.floor.single': { k:'sfx', d:0.2, f:'261371.wav' },
  'sfx.floor.seq': { k:'sfx', d:20.0, f:'822745.mp3' },
  'sfx.floor.boards': { k:'sfx', d:20.0, f:'570864.mp3' },
  'sfx.metal.groan': { k:'sfx', d:20.0, f:'264014.mp3' },
  'sfx.metal.groan2': { k:'sfx', d:1.6, f:'481787.wav' },
  'sfx.metal.knock': { k:'sfx', d:11.7, f:'863059.mp3' },
  'sfx.switch': { k:'sfx', d:2.6, f:'617608.wav' },
  'sfx.switch2': { k:'sfx', d:4.1, f:'423512.wav' },
  // --- Forest ------------------------------------------------------------
  'bed.overworld.day': { k:'bed', d:30.0, f:'803224.mp3' },
  'bed.overworld.calm': { k:'bed', d:8.0, f:'496512.mp3' },
  'bed.overworld.night': { k:'bed', d:30.0, f:'62489.mp3' },
  'bed.overworld.night2': { k:'bed', d:8.3, f:'520959.mp3' },
  'bed.border': { k:'bed', d:30.0, f:'638404.mp3' },
  'sfx.leaves': { k:'sfx', d:9.9, f:'758395.mp3' },
  'sfx.bush': { k:'sfx', d:9.6, f:'765491.mp3' },
  'sfx.tree.creak': { k:'sfx', d:13.2, f:'95263.mp3' },
  'sfx.branch': { k:'sfx', d:2.2, f:'85433.wav' },
  'sfx.branch.crackle': { k:'sfx', d:11.7, f:'811529.mp3' },
  'sfx.grass': { k:'sfx', d:0.5, f:'396012.wav' },
  // --- Farmlands ---------------------------------------------------------
  'bed.farm.day': { k:'bed', d:30.0, f:'488067.mp3' },
  'bed.farm.day2': { k:'bed', d:28.6, f:'488066.mp3' },
  'bed.farm.night': { k:'bed', d:30.0, f:'584590.mp3' },
  'bed.farm.wind': { k:'bed', d:27.9, f:'523374.mp3' },
  'bed.farm.crop': { k:'bed', d:30.0, f:'454364.mp3' },
  'sfx.crop': { k:'sfx', d:20.0, f:'542254.mp3' },
  'sfx.crows': { k:'sfx', d:17.3, f:'403978.mp3' },
  'sfx.birds.road': { k:'sfx', d:17.3, f:'464764.mp3' },
  'sfx.crow': { k:'sfx', d:0.8, f:'813114.wav' },
  'sfx.tractor': { k:'sfx', d:20.0, f:'344984.mp3' },
  'sfx.tractor2': { k:'sfx', d:10.5, f:'570376.mp3' },
  'sfx.dogs': { k:'sfx', d:15.6, f:'820267.mp3' },
  'sfx.clang.far': { k:'sfx', d:15.4, f:'507465.mp3' },
  'sfx.clang.low': { k:'sfx', d:15.4, f:'507469.mp3' },
  'sfx.collapse.far': { k:'sfx', d:20.0, f:'333988.mp3' },
  'sfx.metal.fall': { k:'sfx', d:5.2, f:'80450.wav' },
  'sfx.rust.turn': { k:'sfx', d:14.7, f:'124122.mp3' },
  // --- Animals -----------------------------------------------------------
  'sfx.animal.cow': { k:'sfx', d:5.4, f:'867553.wav' },
  'sfx.animal.sheep': { k:'sfx', d:3.8, f:'692900.wav' },
  'sfx.animal.chicken': { k:'sfx', d:14.9, f:'456803.mp3' },
  'sfx.animal.horse': { k:'sfx', d:7.6, f:'418428.wav' },
  // --- Weather -----------------------------------------------------------
  'bed.rain.light': { k:'bed', d:30.0, f:'96729.mp3' },
  'bed.rain.heavy': { k:'bed', d:30.0, f:'640651.mp3' },
  'bed.rain.roof': { k:'bed', d:22.3, f:'823199.mp3' },
  'bed.storm.room': { k:'bed', d:30.0, f:'751720.mp3' },
  'sfx.thunder.sub': { k:'sfx', d:20.0, f:'238743.mp3' },
  'sfx.thunder.far': { k:'sfx', d:20.0, f:'398206.mp3' },
  'bed.wind.open': { k:'bed', d:30.0, f:'16950.mp3' },
  'sfx.gust': { k:'sfx', d:20.0, f:'361487.mp3' },
  // --- Water -------------------------------------------------------------
  'bed.water.stream': { k:'bed', d:30.0, f:'325324.mp3' },
  'bed.water.stream2': { k:'bed', d:27.6, f:'536124.mp3' },
  'sfx.drip.fast': { k:'sfx', d:20.0, f:'271336.mp3' },
  'sfx.drip.slow': { k:'sfx', d:20.0, f:'442480.mp3' },
  'sfx.steam': { k:'sfx', d:7.0, f:'666290.wav' },
  // --- Suburbia ----------------------------------------------------------
  'bed.sub.day': { k:'bed', d:30.0, f:'481964.mp3' },
  'bed.sub.day2': { k:'bed', d:30.0, f:'135074.mp3' },
  'bed.sub.night': { k:'bed', d:24.2, f:'535761.mp3' },
  'bed.sub.traffic': { k:'bed', d:30.0, f:'428844.mp3' },
  'sfx.car.pass': { k:'sfx', d:6.3, f:'669729.wav' },
  'sfx.voices.muffled': { k:'sfx', d:20.0, f:'614573.mp3' },
  // --- Electrical / hum --------------------------------------------------
  'bed.hum.buzz': { k:'bed', d:20.0, f:'553075.mp3' },
  'bed.hum.fridge': { k:'bed', d:11.8, f:'740110.mp3' },
  'bed.hum.low': { k:'bed', d:10.0, f:'72091.mp3' },
  'bed.hum.mech': { k:'bed', d:6.0, f:'865628.mp3' },
  'bed.hum.powerline': { k:'bed', d:30.0, f:'816619.mp3' },
  'sfx.electric': { k:'sfx', d:5.7, f:'407233.wav' },
  'bed.hum.crt': { k:'bed', d:10.2, f:'799662.mp3' },
  // --- Rift / reality distortion -----------------------------------------
  'bed.rift.static': { k:'bed', d:30.0, f:'745231.mp3' },
  'bed.rift.pulse': { k:'bed', d:30.0, f:'852315.mp3' },
  'bed.rift.drone': { k:'bed', d:30.0, f:'344612.mp3' },
  'bed.rift.space': { k:'bed', d:30.0, f:'211603.mp3' },
  'sfx.rift.transition': { k:'sfx', d:20.0, f:'826582.mp3' },
  'sfx.rift.distort': { k:'sfx', d:11.1, f:'562643.mp3' },
  'sfx.rift.scrape': { k:'sfx', d:8.4, f:'381223.mp3' },
  'sfx.rift.glitch': { k:'sfx', d:1.7, f:'90335.wav' },
  'sfx.rift.musicbox': { k:'sfx', d:8.0, f:'30611.wav' },
  'sfx.rift.knack': { k:'sfx', d:20.0, f:'61617.mp3' },
  // --- Stalker -----------------------------------------------------------
  'step.stalker': { k:'step', n:8, v:['383724_00.wav', '383724_01.wav', '383724_02.wav', '383724_03.wav', '383724_04.wav', '383724_05.wav', '383724_06.wav', '383724_07.wav'] },
  'step.stalker.near': { k:'step', n:8, v:['152004_00.wav', '152004_01.wav', '152004_02.wav', '152004_03.wav', '152004_04.wav', '152004_05.wav', '152004_06.wav', '152004_07.wav'] },
  'step.cloth': { k:'step', n:8, v:['788342_00.wav', '788342_01.wav', '788342_02.wav', '788342_03.wav', '788342_04.wav', '788342_05.wav', '788342_06.wav', '788342_07.wav'] },
  'sfx.stalker.breath': { k:'sfx', d:3.5, f:'195572.wav' },
  'sfx.stalker.breath2': { k:'sfx', d:20.0, f:'369294.mp3' },
  'sfx.stalker.breath3': { k:'sfx', d:10.5, f:'121584.mp3' },
  'sfx.stalker.creature': { k:'sfx', d:20.0, f:'528506.mp3' },
  // --- Horror tension ----------------------------------------------------
  'bed.tension.dark': { k:'bed', d:19.2, f:'826597.mp3' },
  'bed.tension.pulse': { k:'bed', d:26.5, f:'845551.mp3' },
  'bed.tension.long': { k:'bed', d:30.0, f:'744080.mp3' },
  'bed.tension.slow': { k:'bed', d:30.0, f:'628917.mp3' },
  'bed.tension.cello': { k:'bed', d:25.3, f:'81034.mp3' },
  'bed.tension.deep': { k:'bed', d:30.0, f:'355738.mp3' },
  'bed.tension.chime': { k:'bed', d:30.0, f:'867568.mp3' },
  'bed.tension.piano': { k:'bed', d:30.0, f:'548621.mp3' },
  'bed.tension.pulsedrum': { k:'bed', d:21.3, f:'529138.mp3' },
  'sfx.eerie': { k:'sfx', d:9.2, f:'540967.mp3' },
  'bed.tension.nc1': { k:'bed', d:30.0, f:'554110.mp3' },
  'bed.tension.nc2': { k:'bed', d:30.0, f:'555179.mp3' },
  'sfx.swell.odd': { k:'sfx', d:20.0, f:'567662.mp3' },
  'sfx.swell.long': { k:'sfx', d:20.0, f:'192574.mp3' },
  'sfx.swell.short': { k:'sfx', d:8.0, f:'218354.wav' },
  'sfx.swell.piano': { k:'sfx', d:12.0, f:'443968.mp3' },
  'bed.heartbeat': { k:'bed', d:30.0, f:'612641.mp3' },
  // --- Blood Night -------------------------------------------------------
  'bed.blood.rumble': { k:'bed', d:26.1, f:'473725.mp3' },
  'bed.blood.earth': { k:'bed', d:30.0, f:'16947.mp3' },
  'bed.blood.far': { k:'bed', d:30.0, f:'320788.mp3' },
  'sfx.blast.far': { k:'sfx', d:8.6, f:'324277.mp3' },
  'sfx.rumble.short': { k:'sfx', d:1.6, f:'529566.wav' },
  // --- Hollowed Behemoth -------------------------------------------------
  'sfx.behemoth.far': { k:'sfx', d:12.2, f:'456854.mp3' },
  'sfx.behemoth.roar': { k:'sfx', d:11.0, f:'837799.mp3' },
  'sfx.behemoth.roar2': { k:'sfx', d:7.2, f:'841961.wav' },
  'sfx.behemoth.dist': { k:'sfx', d:1.8, f:'261147.wav' },
  'sfx.behemoth.voice': { k:'sfx', d:3.8, f:'181374.wav' },
  // --- Haven disappearance -----------------------------------------------
  'bed.vanish.low': { k:'bed', d:12.7, f:'853575.mp3' },
  'sfx.vanish.air': { k:'sfx', d:5.0, f:'810737.wav' },
  'sfx.whoosh.soft': { k:'sfx', d:0.4, f:'73263.wav' },
  // --- Final creature / finale -------------------------------------------
  'bed.finale.deep': { k:'bed', d:30.0, f:'867251.mp3' },
  'bed.finale.rumble': { k:'bed', d:28.2, f:'321812.mp3' },
  'sfx.finale.bend': { k:'sfx', d:18.0, f:'529620.mp3' },
  'sfx.finale.collide': { k:'sfx', d:6.5, f:'653294.wav' },
  'bed.finale.air': { k:'bed', d:30.0, f:'845339.mp3' },
  'sfx.finale.drop': { k:'sfx', d:4.0, f:'856174.wav' },
  'sfx.finale.strike': { k:'sfx', d:7.9, f:'754422.wav' },
  'sfx.finale.strike2': { k:'sfx', d:6.8, f:'754424.wav' },
  // --- UI / interaction --------------------------------------------------
  'sfx.ui.click': { k:'sfx', d:0.9, f:'342898.wav' },
  'sfx.ui.click2': { k:'sfx', d:1.3, f:'687108.wav' },
  'sfx.ui.deny': { k:'sfx', d:1.0, f:'327738.wav' },
  'sfx.ui.pickup': { k:'sfx', d:0.0, f:'868506.wav' },
  'sfx.ui.pop': { k:'sfx', d:0.6, f:'761011.wav' },
  // --- Impacts and stings ------------------------------------------------
  'sfx.impact.boom': { k:'sfx', d:8.8, f:'162850.mp3' },
  'sfx.impact.drop': { k:'sfx', d:2.8, f:'475005.wav' },
  'sfx.impact.perc': { k:'sfx', d:5.0, f:'475040.wav' },
  'sfx.impact.soft': { k:'sfx', d:15.4, f:'388950.mp3' },
  'sfx.impact.kick': { k:'sfx', d:20.0, f:'825797.mp3' },
  'sfx.impact.drum': { k:'sfx', d:5.5, f:'177126.wav' },
  // --- Voices, whispers and breath ---------------------------------------
  'sfx.whisper.four': { k:'sfx', d:13.6, f:'193818.mp3' },
  'sfx.whisper.close': { k:'sfx', d:20.0, f:'730965.mp3' },
  'sfx.breath.player': { k:'sfx', d:20.0, f:'7998.mp3' },
  'sfx.breath.fast': { k:'sfx', d:16.2, f:'512741.mp3' },
  'sfx.breath.quiet': { k:'sfx', d:16.9, f:'554735.mp3' },
});

/* The ceilings. Every one of them exists because of a specific way a browser game goes
   wrong, and none of them is tunable from anywhere else. */
const AUDIO_LIMITS = Object.freeze({
  voices:    20,    // total simultaneous SAMPLE voices. The synth voices are not counted
                    // here; they are individually short and already bounded.
  perKey:     3,    // simultaneous voices of ONE sound. This is the answer to "protection
                    // against stacking hundreds of identical sounds": a bug that fires a
                    // footstep every frame gets three of them, not sixty.
  minGap:  0.045,   // seconds between two starts of the same sound. Below this the ear
                    // hears flamming rather than repetition.
  loopFade:  1.2,   // seconds of the tail crossfaded back over the head of a bed loop.
  bedFade:   2.5,   // default seconds to swap one bed for another.
  maxLoad:    6,    // concurrent decodes. A dimension change asks for six beds at once and
                    // decodeAudioData is not free.
  deadAfter: 12,    // PHASE 34.3 — consecutive failures with NO success before the whole
                    // transport is declared dead. Above any one scene's bed count, so a
                    // slow or partial start cannot trip it; far below the library's size.
});

/* =====================================================================================
   THE SURFACE TABLE — which recording a footfall on a given block uses.

   Written as a list of (block ids -> surface) rather than a per-id table because the
   voxel palette is 2048 ids wide and roughly forty of them are walkable. Anything not
   listed falls through to 'soil', which is the right default for a game whose ground is
   mostly earth. The map is BUILT ONCE at load and is a plain object lookup thereafter.

   ERA 2 NOTE. This is the only part of the audio system that knows a block id exists.
   When the voxel Overworld is replaced, this table and AudioDirector.surfaceAt() are the
   two things that go; everything else takes a surface NAME and does not care where it
   came from. */
const AUDIO_SURFACE_GROUPS = [
  /* GRASS is living cover, and it is deliberately NOT the same row as bare soil. The
     Farmlands' fertile and overgrown soils belong here rather than with the dry ones: a
     field with something growing in it does not sound like a ploughed one. */
  ['grass',    [BLOCK.GRASS, BLOCK.LAWN, BLOCK.FOLIAGE, BLOCK.HEDGE_MAT,
                BLOCK.SOIL_FERTILE, BLOCK.SOIL_OVERGROWN, BLOCK.WEED_CLUMP]],
  /* CROP is its own surface and not a variant of grass. Walking through standing dead
     wheat is the single most characteristic sound of the Farmland journey and it was
     previously classified as 'soil' along with everything else in the dimension. */
  ['crop',     [BLOCK.CROP_TALL, BLOCK.WITHERED_CROP, BLOCK.STUBBLE, BLOCK.DRY_TUSSOCK,
                BLOCK.REEDS, BLOCK.CROP_FLAT, BLOCK.LAWN_DRY]],
  /* SOIL is bare, dry, worked earth. */
  ['soil',     [BLOCK.DIRT, BLOCK.ROTTED_SOIL, BLOCK.SOIL_DRY, BLOCK.SOIL_EXHAUSTED,
                BLOCK.GRAVE_SOIL, BLOCK.MULCH, BLOCK.ASH_GROUND]],
  ['mud',      [BLOCK.SOIL_WET, BLOCK.FARM_MUD, BLOCK.WATER_SHALLOW]],
  /* GRAVEL now includes the trampled and tracked ground, which is most of a farmyard and
     every driveway. Before this it was three block ids and the player almost never hit it. */
  ['gravel',   [BLOCK.TIRE_TRACK, BLOCK.SMALL_STONES, BLOCK.DRIVEWAY, BLOCK.SLAB_DRIVEWAY,
                BLOCK.SOIL_TRAMPLED]],
  ['leaves',   [BLOCK.LEAVES, BLOCK.LEAF_LITTER, BLOCK.BLACK_CANOPY, BLOCK.STICKS,
                BLOCK.ASH_DRIFT, BLOCK.CHARRED_BRANCH]],
  ['stone',    [BLOCK.STONE, BLOCK.COBBLESTONE, BLOCK.ANDESITE, BLOCK.GRANITE,
                BLOCK.OBSIDIAN, BLOCK.CORRUPTED_STONE, BLOCK.FIELDSTONE, BLOCK.CHAPEL_STONE,
                BLOCK.STONE_VENEER, BLOCK.BRICK, BLOCK.BRICK_TAN, BLOCK.TILE_FLOOR,
                BLOCK.MARKER_STONE, BLOCK.CONCRETE]],
  ['pavement', [BLOCK.ASPHALT, BLOCK.ROAD, BLOCK.ROAD_LINE, BLOCK.ROAD_SEAM, BLOCK.SIDEWALK,
                BLOCK.CURB_MAT, BLOCK.SLAB_SIDEWALK, BLOCK.SLAB_ASPHALT, BLOCK.SLAB_CONC,
                BLOCK.SLAB_GUTTER]],
  ['wood',     [BLOCK.OAK_LOG, BLOCK.WOOD_FLOOR, BLOCK.POLISHED_OAK, BLOCK.DECK,
                BLOCK.ASH_WOOD, BLOCK.BARK, BLOCK.ROT_PLANK, BLOCK.BROKEN_WOOD,
                BLOCK.BURNT_STUMP, BLOCK.LOFT_HAY]],
  ['hollow',   [BLOCK.FARM_CLAPBOARD, BLOCK.BARN_RED, BLOCK.BARN_WHITE, BLOCK.CORRUGATED,
                BLOCK.SILO_TILE]],
  ['carpet',   [BLOCK.CARPET, BLOCK.RUG]],
];
const AUDIO_SURFACE_OF = (() => {
  const m = Object.create(null);
  for (const [name, ids] of AUDIO_SURFACE_GROUPS) {
    for (const id of ids) if (id !== undefined) m[id] = name;
  }
  return Object.freeze(m);
})();

/* =====================================================================================
   HOW EACH SURFACE IS VOICED, AND WHY THIS TABLE HAS FIVE COLUMNS INSTEAD OF TWO.

   A human playtest of the first Phase 34 build reported that footsteps "sound effectively
   the same across different surfaces". Measuring the slices showed the recordings were
   fine — their spectral centroids span 361Hz to 4168Hz, an eleven-fold range — so the
   fault was entirely in how they were played:

     * every slice had been PEAK-normalised to the same ceiling, which throws away the
       loudness difference between stone and mud, and loudness is most of what tells a
       player the ground changed. The build now normalises footfalls by RMS instead.
     * this table gave every surface the same gain (0.40-0.55) and the same playback rate
       (0.92-1.00), so nothing here reinforced the difference either.
     * and the entire Farmlands classified as one surface, so a walk across a farm never
       actually changed row.

   The columns now are:
     g   gain. Hard surfaces are genuinely louder than soft ones.
     r   playback rate. Also changes the body of the sound, not just its pitch.
     lp  low-pass in Hz, or 0 for none. Soft, absorbent ground has no top end; a board or
         a slab does. This is the cheapest honest way to widen a difference the
         recordings already have.
     v   how much the per-step random gain varies. Loose ground varies more than a slab.
     ov  an optional MOVEMENT overlay: the sound of the player's legs passing through
         cover, layered under the footfall at a fraction of its level. Only surfaces that
         have something to push through get one, and it is the brief's "grass movement"
         rather than a second footstep.
   ===================================================================================== */
const AUDIO_STEP_SURFACES = Object.freeze({
  grass:    { key: 'step.grass',    g: 0.46, r: 1.00, lp: 6500,  v: 0.22, ov: 'leaves' },
  crop:     { key: 'step.grass',    g: 0.40, r: 0.90, lp: 5000,  v: 0.26, ov: 'crop' },
  soil:     { key: 'step.soft',     g: 0.44, r: 1.00, lp: 5500,  v: 0.20, ov: null },
  mud:      { key: 'step.mud',      g: 0.50, r: 0.94, lp: 4000,  v: 0.24, ov: null },
  gravel:   { key: 'step.gravel',   g: 0.56, r: 1.02, lp: 0,     v: 0.26, ov: null },
  leaves:   { key: 'step.leaves',   g: 0.48, r: 1.00, lp: 0,     v: 0.28, ov: 'leaves' },
  stone:    { key: 'step.stone',    g: 0.62, r: 1.00, lp: 0,     v: 0.14, ov: null },
  pavement: { key: 'step.pavement', g: 0.60, r: 1.04, lp: 0,     v: 0.12, ov: null },
  wood:     { key: 'step.wood',     g: 0.58, r: 1.00, lp: 0,     v: 0.16, ov: null },
  hollow:   { key: 'step.hollow',   g: 0.62, r: 0.95, lp: 0,     v: 0.18, ov: null },
  /* Carpet is the one surface with no recording of its own: it is the indoor board take,
     dulled and dropped, which is physically what a rug over floorboards does. */
  carpet:   { key: 'step.wood',     g: 0.26, r: 0.90, lp: 2200,  v: 0.14, ov: null },
});

const AUDIO_SCENES = Object.freeze({
  'overworld.day':    { air: ['bed.overworld.day',   0.85], layer: ['bed.air.still',     0.34], ev: 'out.day'   },
  'overworld.night':  { air: ['bed.overworld.night', 0.80], layer: ['bed.wind.open',     0.26], ev: 'out.night' },
  'overworld.blood':  { air: ['bed.overworld.night', 0.50], layer: ['bed.blood.rumble',  0.44],
                        tension: ['bed.blood.earth', 0.26], ev: 'out.blood' },
  /* PHASE 34.2 — THE DAYTIME FARMLANDS GAINS ITS WIND. The playtest listed "no wind
     ambience" and "no grass/environmental ambience" separately from "no farm ambience",
     and it was right to: the day scene had a field recording and a crop layer and nothing
     moving over them, while only the NIGHT scene carried `bed.farm.wind`. An open
     agricultural region with wide horizons (CLAUDE.md section 31) is the windiest place
     in the game and was the only outdoor scene with no air moving in it. */
  'farm.day':         { air: ['bed.farm.day',        0.85], layer: ['bed.farm.crop',     0.42],
                        tone: ['bed.farm.wind',      0.26], ev: 'farm.day'  },
  'farm.night':       { air: ['bed.farm.night',      0.80], layer: ['bed.farm.wind',     0.28], ev: 'farm.night'},
  'farm.blood':       { air: ['bed.farm.night',      0.48], layer: ['bed.blood.rumble',  0.42],
                        tension: ['bed.blood.far',   0.20], ev: 'farm.night' },
  /* =================================================================================
     SUBURBIA'S ELECTRICAL LAYER — REMOVED IN 34.1, RESTORED IN 34.2, AND THE REASONING
     THAT REMOVED IT WAS THE MISTAKE.

     Phase 34.1 deleted `bed.hum.crt` from all three Suburbia scenes on the grounds that
     it "doubled the Phase 5A procedural CRT static", leaving `sub.day` and `sub.blood`
     with no tone slot at all. The human playtest that followed reported the exact
     consequence: "there was not even the AC/electrical ambience that was audible before".

     TWO THINGS WERE WRONG WITH THE ARGUMENT. The procedural CRT static is not a
     neighbourhood hum — it is one television, SPATIALISED to the nearest window through
     a panner with refDistance 3 and maxDistance 45, which measures at roughly -45 dBFS
     and is only present within about ten metres of a house. It was never carrying the
     dimension. And it was audible before 34.1 only because every recorded bed around it
     was inaudible; once the beds were correctly normalised it was simply masked.

     So the layers are separated by WHAT THEY ARE rather than deduplicated by category.
     A television in a window is a positioned object and stays positioned. The hum of a
     street full of air-conditioning plant is a bed, it is everywhere, and it is the
     sound the playtester actually missed. `bed.hum.mech` is a seamless CC0 mechanical
     drone and is deliberately NOT the powerline recording, which is NonCommercial and is
     already carrying the night layer — see the licence quarantine in AUDIO_INDEX.md. */
  'sub.day':          { air: ['bed.sub.day',         0.85], layer: ['bed.sub.traffic',   0.34],
                        tone: ['bed.hum.mech',       0.30], ev: 'sub.day'   },
  'sub.night':        { air: ['bed.sub.night',       0.80], layer: ['bed.hum.powerline', 0.30],
                        tone: ['bed.hum.buzz',       0.24], ev: 'sub.night' },
  'sub.blood':        { air: ['bed.sub.night',       0.46], layer: ['bed.blood.rumble',  0.40],
                        tone: ['bed.hum.low',        0.22], ev: 'sub.night' },
  /* INDOORS. The outside does not vanish, it is muffled — but "muffled" is a level
     BELOW the outdoor bed, not a level near silence, which is what the first version's
     0.34 against an unnormalised -67 dBFS recording actually produced. */
  'in.house':         { air: ['bed.interior.house',  0.75], tone: ['bed.hum.buzz',       0.14], ev: 'in.house'  },
  'in.sub':           { air: ['bed.interior.quiet',  0.70], tone: ['bed.hum.fridge',     0.20], ev: 'in.sub'    },
  'in.sub.night':     { air: ['bed.interior.clock',  0.66], tone: ['bed.hum.fridge',     0.20], ev: 'in.sub'    },
  'in.deep':          { air: ['bed.interior.basement', 0.70], ev: 'in.house' },
  'rift':             { air: ['bed.rift.pulse',      0.58], layer: ['bed.rift.static',   0.26],
                        tension: ['bed.rift.drone',  0.24], ev: 'rift' },
});

/* =====================================================================================
   AUDIO_EVENTS — THE SPARSE ONE-SHOTS.

   `gap` is [min, max] SECONDS between two events. These numbers moved after a human
   playtest: the first version's outdoor tables were 42-150s, which on paper is "sparse"
   and in practice meant a player could cross a whole region and hear nothing but their
   own feet. The world is supposed to sound alive without sounding busy, and one distant
   thing every half-minute or so is where that line actually sits — the events are quiet,
   they are placed at real distance, and most of them are behind the player.

   `d` is the distance range the sound is placed at, which is what makes it read as
   somewhere else rather than as a cue. Nothing is placed closer than 12 metres.

   NOTHING HERE IS A STINGER, and nothing here is triggered by anything. No entry responds
   to the player's position, the Stalker, sanity, or being looked at. They are weather, in
   the sense that they happen whether or not anyone is there. */
const AUDIO_EVENTS = Object.freeze({
  'out.day':   { gap: [22, 52], picks: [
                   ['sfx.crow',        0.55, [30, 90]],
                   ['sfx.birds.road',  0.34, [45, 110]],
                   ['sfx.branch',      0.40, [18, 45]],
                   ['sfx.tree.creak',  0.32, [16, 40]],
                   ['sfx.leaves',      0.30, [12, 30]],
                   ['sfx.grass',       0.26, [12, 26]] ] },
  'out.night': { gap: [30, 70], picks: [
                   ['sfx.branch',      0.32, [22, 60]],
                   ['sfx.tree.creak',  0.28, [18, 46]],
                   ['sfx.dogs',        0.30, [70, 130]],
                   ['sfx.thunder.far', 0.24, [90, 140]],
                   ['sfx.leaves',      0.22, [14, 34]] ] },
  'out.blood': { gap: [34, 78], picks: [
                   ['sfx.blast.far',   0.26, [90, 140]],
                   ['sfx.rumble.short',0.28, [70, 130]],
                   ['sfx.collapse.far',0.22, [80, 135]] ] },
  'farm.day':  { gap: [24, 55], picks: [
                   ['sfx.crows',       0.36, [55, 120]],
                   ['sfx.crow',        0.46, [35, 95]],
                   ['sfx.tractor',     0.24, [95, 140]],
                   ['sfx.tractor2',    0.22, [95, 140]],
                   ['sfx.clang.far',   0.28, [50, 110]],
                   ['sfx.rust.turn',   0.24, [30, 70]],
                   ['sfx.crop',        0.28, [14, 34]],
                   ['sfx.birds.road',  0.28, [50, 110]] ] },
  'farm.night':{ gap: [34, 80], picks: [
                   ['sfx.dogs',        0.28, [80, 135]],
                   ['sfx.clang.low',   0.26, [60, 125]],
                   ['sfx.metal.fall',  0.22, [55, 115]],
                   ['sfx.crop',        0.22, [14, 34]],
                   ['sfx.thunder.far', 0.22, [95, 140]],
                   ['sfx.rust.turn',   0.20, [30, 70]] ] },
  'sub.day':   { gap: [22, 50], picks: [
                   ['sfx.car.pass',    0.28, [60, 130]],
                   ['sfx.dogs',        0.26, [55, 120]],
                   ['sfx.birds.road',  0.28, [40, 100]],
                   ['sfx.voices.muffled', 0.16, [26, 55]] ] },
  'sub.night': { gap: [30, 68], picks: [
                   ['sfx.car.pass',    0.20, [85, 140]],
                   ['sfx.dogs',        0.22, [80, 135]],
                   ['sfx.doorbell',    0.16, [55, 120]],
                   ['sfx.door.slam',   0.20, [50, 115]],
                   ['sfx.thunder.sub', 0.22, [95, 140]],
                   ['sfx.electric',    0.16, [30, 70]] ] },
  /* INDOORS IS STILL THE SPARSEST TABLE IN THE GAME and every entry in it is the
     building, not a person. A house that answers once a minute is a house; one that
     answers every twenty seconds is a haunted house, and CLAUDE.md section 25 is explicit
     that not every structure is haunted. */
  'in.house':  { gap: [42, 105], picks: [
                   ['sfx.creak.quiet', 0.34, [3, 9]],
                   ['sfx.creak.a',     0.30, [3, 10]],
                   ['sfx.creak.b',     0.30, [3, 10]],
                   ['sfx.floor.single',0.24, [4, 11]],
                   ['sfx.creak.long',  0.20, [5, 12]] ] },
  'in.sub':    { gap: [46, 115], picks: [
                   ['sfx.creak.quiet', 0.30, [3, 9]],
                   ['sfx.creak.c',     0.26, [3, 10]],
                   ['sfx.switch',      0.16, [6, 14]],
                   ['sfx.voices.muffled', 0.14, [8, 18]] ] },
  /* THE RIFT is the one place a table is allowed to be busy, and it is still fifteen
     seconds between events. Layers and fades carry this scene — the bed does the work —
     and these are punctuation on top of it, never the substance. */
  'rift':      { gap: [15, 38], picks: [
                   ['sfx.rift.glitch',  0.26, [2, 9]],
                   ['sfx.rift.distort', 0.24, [4, 14]],
                   ['sfx.rift.scrape',  0.22, [4, 14]],
                   ['sfx.rift.musicbox',0.18, [6, 18]] ] },
});

/* How long "there is something over my head" must hold before the mix believes it. */
const AUDIO_INDOOR_SETTLE = 0.9;

/* PHASE 34.3 — THE LEVEL THE SYNTHESISED BED HOLDS WHEN NO RECORDING IS SOUNDING.

   This is a FLOOR ON AN EXISTING VOICE, not a new sound: the brown-noise wind bed built
   in _buildNightBed has been in this engine since Phase 1 and 34.1 already made it stand
   down for a recording. All this number does is stop it standing down for a recording
   that is never going to arrive.

   Chosen against the thing it replaces, not against silence: the recorded air bed sits at
   0.85 through `ambienceBus` at unity, this is a bandpassed noise sweep on `musicBus` at
   0.82, and it is deliberately well under the recording — a fallback that announced
   itself would be worse than the fault. It is also under a footstep at 0.46, which keeps
   the section 61 rule that nothing ambient exceeds the player's own feet. */
const AUDIO_FALLBACK_BED = 0.26;

/* AND HOW LONG NO RECORDING MUST BE SOUNDING BEFORE THE FALLBACK BELIEVES IT.

   The same lesson as AUDIO_INDOOR_SETTLE, in a different place: a single frame's answer
   is not enough to change the mix. `_recordedBedLive()` is false for a moment during
   every ordinary scene change, because setBed claims each slot before its buffer lands —
   so without a hold, a healthy build would swell a synthesised wind up and back down
   every time night fell or the player walked through a door. Longer than the 2.5s bed
   crossfade it has to sit through, short enough that a genuinely dead library is covered
   before the player has walked anywhere. */
const AUDIO_FALLBACK_SETTLE = 3.2;

const AUDIO_PRELOAD = Object.freeze([
  /* EVERY PLAYER SURFACE, not a sample of them. The first build preloaded four sets and
     lazily loaded the rest, so the first few steps onto gravel, pavement, mud or a barn
     floor fell back to the synthesised burst — which is precisely the moment the change
     of ground is supposed to be audible. Eleven sets is about 3MB and it is fetched once. */
  'step.soft', 'step.grass', 'step.stone', 'step.wood', 'step.gravel', 'step.pavement',
  'step.mud', 'step.leaves', 'step.hollow',
  'sfx.door.open', 'sfx.door.close', 'sfx.ui.pickup', 'sfx.ui.click', 'sfx.ui.pop',
  /* The movement overlay is played on the same frame as a footstep; loading it lazily
     means the first field the player walks through is the one that has no rustle in it. */
  'sfx.crop', 'sfx.leaves', 'sfx.grass', 'sfx.bush',
]);

/* The cue vocabulary. A name on the left, one or more recordings on the right; the game
   asks for 'door.open' and never for a Freesound id. Adding a sound to an interaction
   means adding a row here, not a call to the library. */
const AUDIO_CUES = Object.freeze({
  'door.open':    { k: ['sfx.door.open', 'sfx.door.open2'],            g: 0.50 },
  'door.close':   { k: ['sfx.door.close', 'sfx.door.close2'],          g: 0.46 },
  'door.creak':   { k: ['sfx.creak.door', 'sfx.door.squeak'],          g: 0.34 },
  'door.screen':  { k: ['sfx.door.screen'],                            g: 0.42 },
  'door.knock':   { k: ['sfx.knock.near', 'sfx.knock.seq'],            g: 0.40 },
  'gate':         { k: ['sfx.metal.groan', 'sfx.metal.groan2'],        g: 0.34 },
  'drawer':       { k: ['sfx.drawer', 'sfx.cabinet', 'sfx.cabinet2'],  g: 0.36 },
  'chest.open':   { k: ['sfx.ui.pop'],                                 g: 0.55 },
  'furniture':    { k: ['sfx.chair', 'sfx.chair.drag', 'sfx.couch'],   g: 0.30 },
  'creak':        { k: ['sfx.creak.a', 'sfx.creak.b', 'sfx.creak.c',
                        'sfx.creak.quiet'],                            g: 0.30 },
  'floor.single': { k: ['sfx.floor.single'],                           g: 0.30 },
  'switch':       { k: ['sfx.switch', 'sfx.switch2'],                  g: 0.30 },
  'pickup':       { k: ['sfx.ui.pickup'],                              g: 0.45 },
  'ui.click':     { k: ['sfx.ui.click', 'sfx.ui.click2'],              g: 0.30 },
  'ui.deny':      { k: ['sfx.ui.deny'],                                g: 0.26 },
  'metal.knock':  { k: ['sfx.metal.knock'],                            g: 0.34 },
  'branch':       { k: ['sfx.branch', 'sfx.branch.crackle'],           g: 0.34 },
  'leaves':       { k: ['sfx.leaves', 'sfx.bush', 'sfx.grass'],        g: 0.28 },
  'crop':         { k: ['sfx.crop'],                                   g: 0.26 },
  'water.drip':   { k: ['sfx.drip.fast', 'sfx.drip.slow'],             g: 0.24 },
  /* PHASE 34.2 — RAISED, because these are a signature Farmland sound and the previous
     numbers never reached the player. Behind the old inverse-square a cow lowing twenty
     metres away arrived at gain 0.07 and one across a field at 0.02; the human playtest
     reported no animal calls at all, and that is the arithmetic reason why. They are
     still restrained — a cow at twenty metres now lands at 0.22, under a footstep at
     0.46 — and the rate they arrive at is unchanged and still starved by FarmAnimalManager. */
  'animal.cow':     { k: ['sfx.animal.cow'],                           g: 0.42 },
  'animal.sheep':   { k: ['sfx.animal.sheep'],                         g: 0.40 },
  'animal.chicken': { k: ['sfx.animal.chicken'],                       g: 0.34 },
  'animal.horse':   { k: ['sfx.animal.horse'],                         g: 0.42 },
  /* THE STALKER. Four recordings, all of them quiet, none of them a scream. Section 5 of
     the brief asks for "extremely restrained creature audio" and the loudest thing here
     is a footfall at 0.34 — a third of the player's own step at the same distance. */
  'stalker.step':   { k: ['step.stalker'],                             g: 0.34 },
  'stalker.near':   { k: ['step.stalker.near'],                        g: 0.30 },
  'stalker.cloth':  { k: ['step.cloth'],                               g: 0.22 },
  'stalker.breath': { k: ['sfx.stalker.breath', 'sfx.stalker.breath2',
                          'sfx.stalker.breath3'],                      g: 0.20 },
  /* THE RIFT. Layers and fades, never spam — the brief's words. Each of these is a
     one-shot the Rift sequence places, not a loop and not a scheduler. */
  'rift.glitch':    { k: ['sfx.rift.glitch'],                          g: 0.24, b: 'amb' },
  'rift.distort':   { k: ['sfx.rift.distort', 'sfx.rift.scrape'],      g: 0.22, b: 'amb' },
  'rift.transition':{ k: ['sfx.rift.transition'],                      g: 0.28, b: 'amb' },
  'rift.memory':    { k: ['sfx.rift.musicbox'],                        g: 0.20, b: 'amb' },
  /* THE BEHEMOTH. Distant by default: every one of these is placed with playAt at real
     distance, and the roar is deliberately the quietest thing in the group. */
  'behemoth.far':   { k: ['sfx.behemoth.far', 'sfx.behemoth.dist'],    g: 0.30 },
  'behemoth.roar':  { k: ['sfx.behemoth.roar', 'sfx.behemoth.roar2'],  g: 0.26 },
  'whisper':        { k: ['sfx.whisper.four', 'sfx.whisper.close'],     g: 0.18, b: 'amb' },
});
