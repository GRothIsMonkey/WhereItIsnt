# WHERE IT ISN'T — AUDIO INDEX

Phase 34. One row per collected asset, grouped by what the sound is FOR.

Attribution and licence text live in `AUDIO_CREDITS` and are NOT repeated here — this
file records where each sound came to rest in the game, not who made it. The Freesound
id is the join key between the two, and it is the first field of every filename, which
is why filenames are never rewritten.

## How to read a row

```
| id | file | dur | manifest key | use |
```

`manifest key` is the logical name the game asks for — `AUDIO_ASSETS` in `game.html`
maps it to a runtime file. A row with `—` is catalogued and NOT wired to anything; see
section "Catalogued, not wired" for why each one is held back.

A `⚠` after the id means the asset is **NonCommercial or Sampling+**. It is legal in
this build and illegal in a commercial release. The full list is in the LICENCE
QUARANTINE section at the bottom — read that before shipping anything for money.

## The runtime copies

`assets/audio/runtime/` holds browser-ready copies built from the originals by
`tests/tools/build_runtime.py`. **Nothing in it is a source asset and nothing in it is
irreplaceable** — delete the directory and re-run the script. The originals are never
written to.

Three encodes, and the reason for each:

- **footfalls** — `runtime/steps/<id>_NN.wav`. The footstep recordings are sequences of
  five to ten steps, which is unusable as a one-shot. They are onset-sliced into single
  footfalls, peak-aligned to within 14ms, normalised and fade-tailed. 16-bit 44.1k mono.
- **cues under 8 seconds** — `runtime/<id>.wav`, 16-bit 44.1k. WAV rather than MP3
  because every MP3 decoder inserts its own leading silence, and a cue that answers a
  key press cannot start late.
- **beds, and cues over 8 seconds** — `runtime/<id>.mp3`, VBR ~112k. MP3 rather than
  Ogg because Safari could not decode Vorbis until 17.4 and this has to work everywhere.
  **Beds are cut to 30 seconds and long one-shots to 20** — that is a memory decision,
  not a bandwidth one: `decodeAudioData` expands to 32-bit float at the context rate, so
  the 208-second drone would have been 73MB of RAM decoded. The engine crossfade-loops
  beds, so a 30-second window of a wash is indistinguishable from all of it.

---

## Interior / home ambience

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 511688 | `511688__jerryberumen__inside_hacienda_house.wav` | 61.4s | `bed.interior.house` | Farmhouse / Disconnected Home interior room tone. |
| 751329 | `751329__klankbeeld__room-tone-apartment-656-am-240215_0663.ogg` | 66.0s | `bed.interior.quiet` | Suburbia house interior room tone — the quietest of the three. |
| 714170 | `714170__klankbeeld__basement-room-tone-638-220811_0491.wav` | 35.1s | `bed.interior.basement` | Basement / cellar room tone; under-floor spaces. |
| 416002 | `416002__nixeno__nixeno-house-ambiance-with-clock-tik-tak (1).mp3` | 40.0s | `bed.interior.clock` | House ambience with a clock — Suburbia living rooms. |
| 805394 | `805394__designerschoice__ambroom_room-tone-distant-heavy-rain-or-wind-on-window_nicholas-judy_tdc.wav` | 18.0s | `bed.haven.room` | Room tone with weather on the window. The Haven room layer. |
| 790019 | `790019__nox_sound__foley_object_clock_old_tick_sequence_stereo.wav` | 16.4s | `bed.interior.tick` | Old clock tick sequence — loops as an interior detail layer. |
| 328067 | `328067__guntherdorksen__old-clock-ticking_-broken-antique-grandfather-clock-ticking-inconsistent-tickingsfx.wav` | 27.5s | `sfx.clock.wrong` | Broken grandfather clock, inconsistent ticking. Wrong-house rooms. |
| 342926 ⚠ | `342926__robinhood76__06583-old-clock-pendulum-ticking.wav` | 9.6s | `sfx.clock.pendulum` | Old clock pendulum. NONCOMMERCIAL. |

---

## Haven

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 387128 | `387128__nooneisreal__the-fireplace-3.wav` | 93.5s | `bed.haven.hearth` | The Haven hearth. The fire layer, and the second thing taken away. |
| 259228 | `259228__decembered__outdoors-cabin-substation.wav` | 106.0s | `bed.haven.outside` | Outdoors beyond the cabin — the Haven outside layer, taken away first. |
| 829081 | `829081__geoff-bremner-audio__still-outdoor-air-2-loop.wav` | 12.2s | `bed.air.still` | Still outdoor air, authored as a loop. Calm exterior anywhere. |

---

## Footsteps

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 813621 | `813621__securesubset__footsteps-dirt-grass-ground-nature.wav` | 3.7s | 6 footfalls | Dirt / grass / soil steps. Overworld and Farmland default. |
| 807862 | `807862__designerschoice__feethmn-mcu_footsteps-on-grass_nicholas-judy_tdc.wav` | 7.8s | 8 footfalls | Steps on grass. |
| 352870 | `352870__potatokingxii__footsteps-dirt-gravel.wav` | 35.0s | 8 footfalls | Steps on dirt and gravel — roads and farm tracks. |
| 530384 | `530384__nox_sound__footsteps_boots_gritty_ground_stones_leaves_mono.wav` | 10.9s | 8 footfalls | Boots on gritty ground, stones and leaves. Forest floor. |
| 548384 | `548384__nox_sound__footsteps_mountain_boots_mud_mono.wav` | 14.6s | 8 footfalls | Boots in mud — wet Farmland soil, pond margins. |
| 813622 | `813622__securesubset__footsteps-stone-rock-concrete-cement.wav` | 6.7s | 6 footfalls | Steps on stone, rock and concrete. Suburbia paving, stone. |
| 682773 | `audio continued/682773__thomasanthony321__walking-footsteps-on-pavement.wav` | 19.9s | 8 footfalls | Walking on pavement — Suburbia streets. |
| 366111 | `366111__wakuwakuwakuwaku__indoor-footsteps.wav` | 3.8s | 5 footfalls | Indoor footsteps — interiors on boards. |
| 459970 | `459970__florianreichelt__footsteps-on-hollow-wood.mp3` | 27.0s | 8 footfalls | Footsteps on hollow wood — porches, barn floors. |
| 830503 | `830503__shaunhillyard__walking-upstairs.wav` | 11.0s | 8 footfalls | Walking upstairs. |
| 19263 | `19263__martian__steps (1).aiff` | 53.2s | 8 footfalls | Generic step sequence. AIFF — runtime copy required. |

---

## Doors, furniture and objects

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 213406 | `213406__chewiesmissus__wooddooropen.wav` | 1.7s | `sfx.door.open` | Wooden door opening. The default door-open cue. |
| 213404 | `213404__chewiesmissus__wooddoorcloselatch.wav` | 1.0s | `sfx.door.close` | Wooden door closing with a latch. The default door-close cue. |
| 432562 | `432562__alessnox__dooropening.flac` | 7.4s | `sfx.door.open2` | A second door-open take, for variation. |
| 340046 | `340046__iesp__wood-door-closing.wav` | 19.0s | `sfx.door.close2` | Heavier wood door closing. |
| 858958 | `858958__moulaythami__sfx-squeaky-door-opening-and-closing.wav` | 35.8s | `sfx.door.squeak` | Squeaky door opening and closing — abandoned structures. |
| 848616 | `848616__richtone59__wooden-screen-door-opening-and-closing.m4a` | 11.9s | `sfx.door.screen` | Wooden screen door — the farmhouse porch door. |
| 583119 | `583119__sfxafrik__the-door-creak.wav` | 77.9s | `sfx.creak.long` | A long door creak. Used as a slow creak, not a door cue. |
| 704612 | `704612__lilmati__the-door-creaks-youre-not-alone.wav` | 8.5s | `sfx.creak.door` | Door creak, close mic. |
| 534337 | `audio continued/534337__defaultv__door_interaction1.mp3` | 33.2s | `sfx.door.handle` | Door interaction handle rattle. |
| 841281 | `audio continued/841281__blou27__door-knock-1.wav` | 0.7s | `sfx.knock.near` | Single door knock. |
| 728214 | `728214__tcurless__knock-on-door.mp3` | 13.5s | `sfx.knock.seq` | Knock on door, sequence. |
| 186517 | `186517__ragamuffin__door-knock-open-wooden_distant.wav` | 23.8s | `sfx.knock.distant` | Distant wooden door knock and open — heard from another room. |
| 450791 | `450791__kyles__door-slam-distant-roomy-boom.wav` | 21.7s | `sfx.door.slam` | Distant door slam with room boom. Suburbia anomaly. |
| 440869 | `440869__v23__doorbell-ringing-far1-d15.wav` | 16.5s | `sfx.doorbell` | A doorbell, far off. Suburbia anomaly. |
| 364106 | `364106__rudmer_rotteveel__wooden_drawer_open_close_1-of-2.wav` | 4.6s | `sfx.drawer` | Wooden drawer open and close. |
| 421033 | `421033__soundslikefoley__desk-cabinet-door-close.wav` | 3.4s | `sfx.cabinet` | Desk cabinet door close. |
| 470619 | `470619__mrrap4food__bathroom-cabinet-opening.wav` | 5.5s | `sfx.cabinet2` | Bathroom cabinet opening. |
| 415939 | `audio continued/415939__aiwha__wooden-chair-4.wav` | 1.4s | `sfx.chair` | Wooden chair. |
| 654148 | `audio continued/654148__glen_dorner__plastic_chair_scraping_over_bricks_1.wav` | 8.0s | `sfx.chair.drag` | Plastic chair dragged over brick — yards and porches. |
| 766645 ⚠ | `766645__dianeleroux__couch-creak.wav` | 27.8s | `sfx.couch` | Couch creak. NONCOMMERCIAL. |
| 238288 | `238288__loafdv__quiet-creak.flac` | 3.0s | `sfx.creak.quiet` | A quiet creak — furniture settling. |
| 502505 | `502505__rudmer_rotteveel__wood-creak-single-v1.wav` | 1.0s | `sfx.creak.a` | Single wood creak. |
| 506665 | `506665__rudmer_rotteveel__wood-creak-single-v10.wav` | 1.2s | `sfx.creak.b` | Single wood creak, second take. |
| 796507 | `796507__kvv_audio__woodfric_wood-creak-01_kvv-audio_free.wav` | 14.1s | `sfx.creak.c` | Wood friction creak. |
| 261371 | `261371__f4kf4ce__creak-wood-floor-single-06.wav` | 0.2s | `sfx.floor.single` | ONE floor board. This is the Phase 31 occupancy footfall. |
| 822745 | `822745__nox_sound__foley_creak_wood_floor_sequence_stereo.wav` | 20.7s | `sfx.floor.seq` | Wood floor creak sequence. |
| 570864 | `audio continued/570864__tosha73__creaking-boards.wav` | 31.1s | `sfx.floor.boards` | Creaking boards. |
| 264014 | `audio continued/264014__cell31_sound_productions__door_metal_groans_ext.wav` | 21.5s | `sfx.metal.groan` | Metal door groaning — barn doors, gates. |
| 481787 | `audio continued/481787__crinkem__metallic-groan-long.wav` | 1.6s | `sfx.metal.groan2` | Short metallic groan. |
| 863059 | `863059__bassimat__knuckles-hitting-a-metal-box.wav` | 11.7s | `sfx.metal.knock` | Knuckles on a metal box — machinery, tanks, the water tower. |
| 617608 | `617608__cpfcfan10__light-switch-click.wav` | 2.6s | `sfx.switch` | Light switch click. |
| 423512 | `423512__someonecool15__light-switch-click-on-and-off.mp3` | 4.1s | `sfx.switch2` | Light switch on and off. |

---

## Forest

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 803224 | `803224__designerschoice__ambrurl_birds-faint-room-tone-buzzing-light-breeze-through-trees_nicholas-judy_tdc.wav` | 71.1s | `bed.overworld.day` | Birds, faint room tone, breeze through trees. THE Overworld day bed. |
| 496512 | `496512__deanobamos__happy-forest-ambience.wav` | 8.0s | `bed.overworld.calm` | Bright forest ambience — the calm Overworld variant. |
| 62489 | `62489__moxobna__1103octobernight2.wav` | 53.0s | `bed.overworld.night` | An October night in open country. THE Overworld night bed. |
| 520959 | `520959__andersmmg__night-ambience-2.wav` | 8.3s | `bed.overworld.night2` | Night ambience, short — the alternate night bed. |
| 638404 | `638404__klankbeeld__border-forestfarmfield-734am-nl-eu-220515_0345.wav` | 70.2s | `bed.border` | The border between forest and farm field at dawn. The seam bed. |
| 758395 | `758395__sarahgb55__leaves-rustling.wav` | 9.9s | `sfx.leaves` | Leaves rustling. |
| 765491 ⚠ | `765491__ismailbulbulia__rustling-bush-leaves.wav` | 9.6s | `sfx.bush` | Rustling bush leaves. NONCOMMERCIAL. |
| 95263 | `95263__department64__tree_creak_05.wav` | 13.2s | `sfx.tree.creak` | Tree creak. |
| 85433 | `85433__jasonelrod__branch-snap.aiff` | 2.2s | `sfx.branch` | A branch snap. AIFF — runtime copy required. |
| 811529 | `811529__designerschoice__woodbrk-blue-snowball-microphone-cu_branch-snaps-crackles_nicholas-judy_tdc.wav` | 11.7s | `sfx.branch.crackle` | Branch snaps and crackles — also the Stalker moving through cover. |
| 396012 | `396012__morganpurkis__rustling-grass-3.wav` | 0.5s | `sfx.grass` | A short grass rustle. |

---

## Farmlands

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 488067 | `488067__bendrain__ambience_farm_04.wav` | 59.5s | `bed.farm.day` | Farm ambience, wide and open. THE Farmlands day bed. |
| 488066 | `488066__bendrain__ambience_farm_05.wav` | 28.6s | `bed.farm.day2` | Farm ambience, second take — the alternate day bed. |
| 584590 | `584590__klankbeeld__night-farmfields-943pm-210811_0307.wav` | 50.2s | `bed.farm.night` | Night farm fields. THE Farmlands night bed. |
| 523374 | `523374__nickmaysoundmusic__open_field_winds_summer_ambience.wav` | 27.9s | `bed.farm.wind` | Open field summer wind. |
| 454364 | `454364__kyles__wind-medium-brisk-breeze-through-stiff-dry-corn-stalks-or-grass-sharp-whistle.flac` | 60.4s | `bed.farm.crop` | Wind through dry corn stalks. The wheat-field layer of the journey. |
| 542254 | `542254__jerryberumen__tall-grass-rustling-2.wav` | 33.7s | `sfx.crop` | Tall grass rustling — close crop movement. |
| 403978 | `403978__arundasstp__crows-call-from-distant-woods.wav` | 17.3s | `sfx.crows` | Crows calling from distant woods. |
| 464764 | `464764__breviceps__field-recording-birds-crow-distant-road.wav` | 17.3s | `sfx.birds.road` | Birds, a crow, a distant road. |
| 813114 | `813114__qubodup__crow-call.flac` | 0.8s | `sfx.crow` | A single crow call. FLAC — runtime copy required. |
| 344984 | `344984__bluesy1905__old-tractor-passing-hatz.wav` | 41.0s | `sfx.tractor` | An old tractor passing, far off. Rural infrastructure that still runs. |
| 570376 | `570376__garuda1982__tractor-drive-past-sound-effect.wav` | 10.5s | `sfx.tractor2` | Tractor driving past. |
| 820267 | `820267__ienba__distant-dogs.wav` | 15.6s | `sfx.dogs` | Distant dogs. |
| 507465 | `507465__danjocross__four-quiet-distant-clangs.aiff` | 15.4s | `sfx.clang.far` | Four quiet distant clangs. AIFF — runtime copy required. |
| 507469 | `507469__danjocross__three-low-metal-clangs-with-reverb.aiff` | 15.4s | `sfx.clang.low` | Three low metal clangs with reverb. AIFF — runtime copy required. |
| 333988 | `333988__kostrava__distant-falling-glassmetal.wav` | 26.6s | `sfx.collapse.far` | Distant falling glass and metal — something gave way, out of sight. |
| 80450 ⚠ | `80450__turtlelg__metalcreakingandfalling.wav` | 5.2s | `sfx.metal.fall` | Metal creaking and falling. NONCOMMERCIAL. |
| 124122 ⚠ | `124122__timbre__remix-of-108732__klankbeeld__creaking_metal_spokes_of_the_bicycle_wheel_06.flac` | 14.7s | `sfx.rust.turn` | Rusted metal spokes turning. NONCOMMERCIAL. |

---

## Animals

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 867553 | `audio continued/867553__calebmills99__cow_moo.wav` | 5.4s | `sfx.animal.cow` | Cow. |
| 692900 | `audio continued/692900__satoristudios3__ewe-shetland-sheep-baa.mp3` | 3.8s | `sfx.animal.sheep` | Sheep. |
| 456803 | `audio continued/456803__breviceps__chicken-clucking.wav` | 14.9s | `sfx.animal.chicken` | Chicken. |
| 418428 ⚠ | `audio continued/418428__soundslikewillem__neighing-horse.wav` | 7.6s | `sfx.animal.horse` | Horse. NONCOMMERCIAL — and the only horse in the library. |

---

## Weather

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 96729 | `96729__ryding__light-rain.wav` | 54.9s | `bed.rain.light` | Light rain. |
| 640651 | `640651__barkenov__heavy-rain-and-gutter.wav` | 39.8s | `bed.rain.heavy` | Heavy rain and gutter. |
| 823199 | `823199__curious_world_on_youtube__rain-on-a-plastic-roof.wav` | 22.3s | `bed.rain.roof` | Rain on a plastic roof — heard from inside. |
| 751720 | `751720__klankbeeld__storm-wind-room-tone-414-pm-231102_0633.wav` | 90.0s | `bed.storm.room` | Storm wind heard as a room tone. Interior during weather. |
| 238743 | `238743__csengeri__distant-thunder-in-suburban-area.wav` | 34.7s | `sfx.thunder.sub` | Distant thunder over a suburb. |
| 398206 | `398206__tnk__distant-thunder-2-july-23rd-2017.wav` | 43.7s | `sfx.thunder.far` | Distant thunder, open country. |
| 16950 ⚠ | `16950__finnbuster__wind.wav` | 63.4s | `bed.wind.open` | Open wind bed. NONCOMMERCIAL. |
| 361487 | `361487__funwithsound__wind-whipping-by.wav` | 27.7s | `sfx.gust` | A wind gust whipping past. |

---

## Water

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 325324 | `325324__inspectorj__stream-water-a.wav` | 57.4s | `bed.water.stream` | A stream. The Farmland watercourse bed. |
| 536124 | `536124__babelfishtank__27stream.wav` | 27.6s | `bed.water.stream2` | A second stream take. |
| 271336 | `271336__inspectorj__water-dripping-fast-a.wav` | 27.1s | `sfx.drip.fast` | Fast dripping water. |
| 442480 | `442480__bonnyorbit__water-dripping-under-bridge-in-small-town.wav` | 31.4s | `sfx.drip.slow` | Water dripping under a bridge — drainage, culverts. |
| 666290 | `666290__ekrcoaster__water-steaming-on-hot-surface-1.ogg` | 7.0s | `sfx.steam` | Water steaming on a hot surface. |

---

## Suburbia

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 481964 | `481964__ahriik__quiet-neighborhood-ambience-light-wind-no-people.wav` | 39.0s | `bed.sub.day` | Quiet neighbourhood, light wind, no people. THE Suburbia day bed. |
| 135074 | `135074__mzui__residential-street-ambience-quiet-birds.wav` | 75.3s | `bed.sub.day2` | Residential street with quiet birds — the alternate day bed. |
| 535761 | `535761__postproddog__sketchy-neighborhood-night-crickets-and-electrical-hum-ambience.mp3` | 24.2s | `bed.sub.night` | Neighbourhood night: crickets and an electrical hum. THE Suburbia night bed. |
| 428844 | `428844__splushionsindasky__roof-top-distant-traffic.wav` | 111.0s | `bed.sub.traffic` | Distant traffic from a rooftop — the city that is still out there. |
| 669729 | `669729__geoff-bremner-audio__distant-car-pass.wav` | 6.3s | `sfx.car.pass` | A single car passing, far off. |
| 614573 | `audio continued/614573__lavenderlux__muffled-voices.mp3` | 31.8s | `sfx.voices.muffled` | Muffled voices through a wall. No words are legible. |

---

## Electrical / hum

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 553075 | `553075__nox_sound__foley_mechanism_light_buzz_short_loop_mono_dr05.wav` | 20.0s | `bed.hum.buzz` | Short mechanism buzz, authored as a loop. Lights and fittings. |
| 740110 | `740110__fossarts__large-refrigerator-compressor-hum-1.wav` | 11.8s | `bed.hum.fridge` | Large refrigerator compressor hum — kitchens. |
| 72091 | `72091__joedinessound__low-frequency-humming-noise.wav` | 10.0s | `bed.hum.low` | Low-frequency humming. |
| 865628 | `865628__kkenny101__mechanical-drone-texture-seamless-loop.wav` | 6.0s | `bed.hum.mech` | Mechanical drone texture, seamless loop. |
| 816619 ⚠ | `816619__nicotep__ligne-haute-tension-6.wav` | 66.0s | `bed.hum.powerline` | High-tension power line. NONCOMMERCIAL. |
| 407233 | `407233__pointparkcinema__electricity-2.wav` | 5.7s | `sfx.electric` | An electrical arc / crackle. |
| 799662 | `799662__lukacafuka__analog-video-hum-2.wav` | 10.2s | `bed.hum.crt` | Analog video hum — the Suburbia CRT layer. |

---

## Rift / reality distortion

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 745231 | `745231__jamielynchpost__radio-static.wav` | 52.8s | `bed.rift.static` | Radio static. The Rift interference layer. |
| 852315 | `852315__tommasomotteran__sci-fi-horror-ambience-living-alien-ship-interior-with-organic-pulsing-drone-loop.wav` | 81.0s | `bed.rift.pulse` | Organic pulsing drone, authored as a loop. The Rift body. |
| 344612 | `344612__waveplaysfx__synth-drone-short-distorted-drone-like-fade-in-fade-out.wav` | 41.4s | `bed.rift.drone` | A distorted synth drone that fades in and out. |
| 211603 | `211603__littlecloudcinema__eerie-background-space-sound.wav` | 58.9s | `bed.rift.space` | Eerie background space tone. |
| 826582 ⚠ | `826582__newlocknew__dsgnerie_a-far-dark-otherworldly-transitions-2-x4_em.mp3` | 84.5s | `sfx.rift.transition` | Four otherworldly transitions. NONCOMMERCIAL. |
| 562643 | `562643__juanpbueno7__instrument-distortion.wav` | 11.1s | `sfx.rift.distort` | Instrument distortion — a familiar sound coming apart. |
| 381223 ⚠ | `381223__ticktockgj__distorted-scraping.wav` | 8.4s | `sfx.rift.scrape` | Distorted scraping. NONCOMMERCIAL. |
| 90335 | `90335__greysound__freakenfurby_glitch_37.wav` | 1.7s | `sfx.rift.glitch` | A short glitch. |
| 30611 | `30611__erh__distorted-music-box-3.wav` | 8.0s | `sfx.rift.musicbox` | A distorted music box — memory that has been reconstructed wrongly. |
| 61617 | `61617__shimsewn__thwushyknack.wav` | 58.0s | `sfx.rift.knack` | Designed whoosh-and-knock texture. |

---

## Stalker

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 383724 | `383724__deleted_user_7146007__heavy-footsteps-walking.wav` | 21.2s | 8 footfalls | Heavy walking. The Stalker approach steps. |
| 152004 | `152004__serithi__creepy9.ogg` | 17.9s | 8 footfalls | Loud heavy footsteps. The Stalker at close range. |
| 788342 | `788342__xkeril__clothes-movements-walking-foley.wav` | 49.3s | 8 footfalls | Clothing moving as something walks. Sliced into cloth ticks. |
| 195572 | `195572__jacobalcook__creature-breath-2.wav` | 3.5s | `sfx.stalker.breath` | Creature breath. |
| 369294 | `audio continued/369294__georgisound__creepy_breathing.wav` | 23.4s | `sfx.stalker.breath2` | Slow, wrong breathing. |
| 121584 | `121584__slugzilla__ghostbreath1.wav` | 10.5s | `sfx.stalker.breath3` | A single exhaled breath, close. |
| 528506 ⚠ | `528506__audio_dread__creepy-creature-horror-2.wav` | 27.8s | `sfx.stalker.creature` | Creature horror texture. NONCOMMERCIAL. |

---

## Horror tension

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 826597 | `826597__harmonicmess__dark-tension-drone.wav` | 19.2s | `bed.tension.dark` | Dark tension drone. |
| 845551 | `845551__skyspeira__high-tension-pulsing-drone-suspense-soundscape.wav` | 26.5s | `bed.tension.pulse` | High tension pulsing drone. |
| 744080 | `744080__moulaythami__drone-horror-a.wav` | 74.0s | `bed.tension.long` | A long horror drone. |
| 628917 | `628917__bernhoftbret__drone-003.mp3` | 120.0s | `bed.tension.slow` | Drone 003 — a two-minute bed. |
| 81034 | `audio continued/81034__juskiddink__cello-bass-drone-4.wav` | 25.3s | `bed.tension.cello` | Cello bass drone — the closest thing in the library to music. |
| 355738 | `355738__supercolio__drone5 (1).mp3` | 208.5s | `bed.tension.deep` | A three-and-a-half minute drone. |
| 867568 | `867568__bassimat__echoing-wind-chimes-over-a-deep-low-frequency-ambient-drone.wav` | 68.0s | `bed.tension.chime` | Wind chimes over a deep drone. |
| 548621 | `548621__zhr__horror-reversed-piano.mp3` | 170.8s | `bed.tension.piano` | Reversed piano, nearly three minutes. |
| 529138 | `529138__waveplaysfx__ambient-loop-deep-ambient-pulses-3-added-drums.wav` | 21.3s | `bed.tension.pulsedrum` | Deep ambient pulses with drums. |
| 540967 | `540967__univ_lyon3__meyer_thomas_2020_2021_eerieatmosphere.wav` | 9.2s | `sfx.eerie` | A short eerie atmosphere. |
| 554110 ⚠ | `554110__audio_dread__long-horror-ambiance-drone.wav` | 68.4s | `bed.tension.nc1` | Long horror ambience drone. NONCOMMERCIAL. |
| 555179 ⚠ | `555179__audio_dread__creepy-horror-ambient-drone.wav` | 39.6s | `bed.tension.nc2` | Creepy horror ambient drone. NONCOMMERCIAL. |
| 567662 | `567662__badoink__odd-bass-swell.wav` | 30.1s | `sfx.swell.odd` | An odd bass swell. |
| 192574 | `192574__aishabag23__bass_swell_long_01_16bitmono_154bpm.aiff` | 21.8s | `sfx.swell.long` | A long bass swell. AIFF — runtime copy required. |
| 218354 | `218354__jordivburgel__movie-short-swell.wav` | 8.0s | `sfx.swell.short` | A short cinematic swell. |
| 443968 ⚠ | `443968__richheard__piano-d-swellecho-distortedgated.wav` | 12.0s | `sfx.swell.piano` | Distorted gated piano swell. NONCOMMERCIAL. |
| 612641 ⚠ | `audio continued/612641__newlocknew__heart-beat-2frightthe-increase-and-decrease-in-heart-rate6lrs.wav` | 56.7s | `bed.heartbeat` | Heartbeat rising and falling. NONCOMMERCIAL. |

---

## Blood Night

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 473725 | `473725__majortonic__20190530_low_noise_rumble.wav` | 26.1s | `bed.blood.rumble` | Low noise rumble. The Blood Night floor. |
| 16947 ⚠ | `16947__finnbuster__earth.wav` | 35.4s | `bed.blood.earth` | Deep earth rumble. NONCOMMERCIAL. |
| 320788 | `320788__kostrava__distant-explosions.wav` | 64.0s | `bed.blood.far` | Distant explosions — something happening a long way off. |
| 324277 | `324277__kostrava__distant-explosion.mp3` | 8.6s | `sfx.blast.far` | A single distant explosion. |
| 529566 | `529566__drmrsir__distantrumble.wav` | 1.6s | `sfx.rumble.short` | A short distant rumble. |

---

## Hollowed Behemoth

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 456854 | `456854__slaking_97__dragon-growl-04-far.wav` | 12.2s | `sfx.behemoth.far` | A far-off growl. The Behemoth heard before it is seen. |
| 837799 | `837799__bikkit99__sea-creature-roar.wav` | 11.0s | `sfx.behemoth.roar` | A large, wet, non-human roar. |
| 841961 | `841961__artninja__monster_berserker_reverbrance_roar_sound_01122026.wav` | 7.2s | `sfx.behemoth.roar2` | A heavy reverberant roar. |
| 261147 | `261147__chobiboko__monster-roar-in-distance.mp3` | 1.8s | `sfx.behemoth.dist` | A monster heard at distance. |
| 181374 | `181374__l4red0__zombie-tries-to-talk.wav` | 3.8s | `sfx.behemoth.voice` | A broken attempt at a voice. |

---

## Haven disappearance

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 853575 | `853575__bassimat__low-frequency-drone-deep-sub-bass-rumble-slowly-shifting-metallic-resonance.wav` | 12.7s | `bed.vanish.low` | Low drone with a slow metallic shift. The Haven dissolve floor. |
| 810737 | `810737__mokasza__long-airy-whoosh.mp3` | 5.0s | `sfx.vanish.air` | A long airy whoosh — the room letting go. |
| 73263 | `73263__junggle__whooshsoft.wav` | 0.4s | `sfx.whoosh.soft` | A soft whoosh. |

---

## Final creature / finale

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 867251 | `867251__bassimat__deep-rumbling-drone-with-expansive-reverberating-echoes.wav` | 63.0s | `bed.finale.deep` | Deep rumbling drone with enormous reverb. THE finale floor. |
| 321812 | `321812__mmasonghi__cinematic-deep-bass-rumble.wav` | 28.2s | `bed.finale.rumble` | Cinematic deep bass rumble. The finale scale layer. |
| 529620 | `529620__kostas17__massive-structure-bend.wav` | 18.0s | `sfx.finale.bend` | A massive structure bending. Something that size moving. |
| 653294 | `653294__osvoldon__big-structure-collision-heard-from-inside (1).wav` | 6.5s | `sfx.finale.collide` | A big structural collision heard from inside. |
| 845339 | `audio continued/845339__artninja__air_bending_burst_sounds_02132026.wav` | 48.5s | `bed.finale.air` | Air moving in bursts — pressure rather than a voice. |
| 856174 | `856174__brktkrgll__subterranean-deep-sub-bass-rumble-drop.mp3` | 4.0s | `sfx.finale.drop` | A subterranean sub-bass drop. |
| 754422 | `754422__zazzsounddesign__dsgnimpt_deep-cinematic-impact-3_zazz.wav` | 7.9s | `sfx.finale.strike` | Deep cinematic impact. The one strike on the face beat. |
| 754424 | `754424__zazzsounddesign__dsgnimpt_deep-cinematic-impact-5_zazz.wav` | 6.8s | `sfx.finale.strike2` | Deep cinematic impact, alternate. |

---

## UI / interaction

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 342898 | `342898__kickhat__menu-click-hat.wav` | 0.9s | `sfx.ui.click` | Menu click. |
| 687108 | `687108__aphom000__mouse-2-button-long-click.wav` | 1.3s | `sfx.ui.click2` | A longer button click. |
| 327738 | `audio continued/327738__distillerystudio__error_01.wav` | 1.0s | `sfx.ui.deny` | An error / refusal tick. |
| 868506 | `868506__lspec__pickup_item_pop_effect.wav` | 0.0s | `sfx.ui.pickup` | Item pickup pop. |
| 761011 | `761011__geoff-bremner-audio__marker-cap-open-3.wav` | 0.6s | `sfx.ui.pop` | A small cap pop — chest lid, container open. |

---

## Impacts and stings

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 162850 | `162850__beman87__cinema-boom-impact-1.wav` | 8.8s | `sfx.impact.boom` | Cinema boom impact. |
| 475005 | `475005__alexlane__synth-bass-drop-impact.wav` | 2.8s | `sfx.impact.drop` | Synth bass drop impact. |
| 475040 | `475040__tyops__percussion-hit.wav` | 5.0s | `sfx.impact.perc` | Percussion hit. |
| 388950 | `388950__waveplaysfx__ambient-bass-deep-soft-bassy-hit-alternate.wav` | 15.4s | `sfx.impact.soft` | Deep soft bassy hit. |
| 825797 | `825797__artninja__yasomasa_or_akazawa_inspired_bass_kick_explosion_drum_09082025.wav` | 22.8s | `sfx.impact.kick` | Bass kick explosion. |
| 177126 ⚠ | `177126__robinhood76__04050-cinematic-drum-hit.wav` | 5.5s | `sfx.impact.drum` | Cinematic drum hit. NONCOMMERCIAL. |

---

## Voices, whispers and breath

| id | file | dur | manifest key | use |
|---|---|---|---|---|
| 193818 | `193818__geoneo0__four_voices_whispering_6_wecho.wav` | 13.6s | `sfx.whisper.four` | Four overlapping whispers. No words legible. |
| 730965 | `730965__soundbitersfx__whisper-evil-little-nothings-to-me.wav` | 26.8s | `sfx.whisper.close` | Close whispering. No words legible. |
| 7998 | `7998__schluppipuppie__breath.wav` | 62.6s | `sfx.breath.player` | Human breathing. |
| 512741 | `audio continued/512741__exe2be__man-breathing-regularly-then-faster.wav` | 16.2s | `sfx.breath.fast` | Breathing that speeds up. |
| 554735 | `audio continued/554735__dynamique__quiet-respiration-woman.wav` | 16.9s | `sfx.breath.quiet` | Quiet respiration. |

---

## Catalogued, not wired

Four assets are in the library and reach no code path. Each is here so a later phase
can find it and know why it was held back rather than rediscovering the reason.

| id | file | dur | why not |
|---|---|---|---|
| 118083 ⚠ | `118083__pintsogin87__file0310.wav` | 8.7s | Unidentified field recording. SAMPLING+ — quarantined, not wired. |
| 636777 | `636777__kevp888__r4_00328-2_exp.wav` | 10.0s | Unlabelled field recording; content not identifiable from metadata. |
| 503270 | `audio continued/503270__ladyimperatrix__come-back-alive-whisper.mp3` | 26.5s | A whispered English sentence. STORY.md section 13 forbids legible speech. |
| 242933 | `audio continued/242933__obxjohn__child-laughing-mp3-file.mp3` | 13.4s | A child laughing. Too explicit a horror signal for this game. |

---

## LICENCE QUARANTINE — do not ship these commercially

Every asset below is **NonCommercial** or **Sampling+**. Freesound's NonCommercial and
Sampling+ terms permit this build and forbid a paid release, a monetised release, and a
release bundled with advertising. Nothing here has been deleted — the phase brief says
to keep them and mark them — but a commercial build must replace or remove all of them.

Four of them are load-bearing today and would leave a hole:

| id | licence | manifest key | what breaks without it |
|---|---|---|---|
| 418428 | Attribution NonCommercial 4.0 | `sfx.animal.horse` | The only horse recording in the library. The Farmland horse would fall back to the procedural call. |
| 16950 | Attribution NonCommercial 3.0 | `bed.wind.open` | One of two open-wind beds. `bed.wind.open` would fall back to `bed.farm.wind`. |
| 816619 | Attribution NonCommercial 4.0 | `bed.hum.powerline` | The power-line hum. The Farmland pylon layer would go silent. |
| 612641 | Attribution NonCommercial 4.0 | `bed.heartbeat` | The heartbeat bed. Nothing in Era 1 plays it yet. |

The rest are alternates, variants or unwired, and dropping them costs a texture, not a
feature:

| id | licence | manifest key |
|---|---|---|
| 342926 | Attribution NonCommercial 4.0 | `sfx.clock.pendulum` |
| 766645 | Attribution NonCommercial 4.0 | `sfx.couch` |
| 765491 | Attribution NonCommercial 4.0 | `sfx.bush` |
| 80450 | Attribution NonCommercial 3.0 | `sfx.metal.fall` |
| 124122 | Attribution NonCommercial 4.0 | `sfx.rust.turn` |
| 826582 | Attribution NonCommercial 4.0 | `sfx.rift.transition` |
| 381223 | Attribution NonCommercial 4.0 | `sfx.rift.scrape` |
| 528506 | Attribution NonCommercial 4.0 | `sfx.stalker.creature` |
| 554110 | Attribution NonCommercial 4.0 | `bed.tension.nc1` |
| 555179 | Attribution NonCommercial 4.0 | `bed.tension.nc2` |
| 443968 | Attribution NonCommercial 3.0 | `sfx.swell.piano` |
| 16947 | Attribution NonCommercial 3.0 | `bed.blood.earth` |
| 177126 | Attribution NonCommercial 4.0 | `sfx.impact.drum` |
| 118083 | Sampling+ | — (not wired) |

---

## Audit notes

- **188 source assets**, 188 unique Freesound ids — one file per id, no duplicates.
- **13 byte-identical duplicate copies were removed** in this phase. Each was a second
  copy of a root asset that had been re-uploaded into `audio continued/`; every one was
  verified identical by MD5 before deletion, and the root copy was kept.
- **`AUDIO_CREDITS` gained exactly one line** — `867251` was on disk with no attribution
  at all, which is a licence problem rather than a tidiness one. The line was written in
  the file's existing format after confirming the sound's title, author and CC0 licence
  on Freesound. Nothing else in the file was touched.
- **AUDIO_CREDITS still lists 14 ids that were never downloaded** (`376809`, `75162`,
  `346654`, `32839`, `803690`, `829852`, `841932`, `841837`, `845300`, `845298`,
  `845296`, `834213`, `134829`, `594625`) and repeats three lines verbatim (`416002`,
  `19263`, `653294`). Neither was corrected: crediting a sound you did not ship is
  harmless, and the brief asks for the file to be left alone unless a change is
  required. They are recorded here so nobody re-derives them.
- **Four filenames carry a ` (1)` suffix** (`19263`, `355738`, `416002`, `653294`).
  Those are the ONLY copies of those sounds — the originals were deleted and re-added
  during collection — so the suffix is not evidence of a duplicate. The names were left
  as they are because the Freesound id, which is the part that matters, is intact.
- **One format could not be used by the browser at all**: AIFF (`19263`, `85433`,
  `192574`, `507465`, `507469`). Chrome and Firefox do not decode it. All five have
  runtime copies; all five originals are untouched.
- **Two formats were converted defensively**: FLAC (`124122`, `238288`, `432562`,
  `454364`, `813114`) because Safari's support is inconsistent, and M4A/AAC (`848616`)
  for the same reason. Both decode in Chrome today.
- **Nothing was listened to.** No audio playback or analysis tool capable of judging
  content was available. Every classification in this file is derived from the
  filename, the `AUDIO_CREDITS` title, and `ffprobe` duration/channel data. Rows for
  `118083` and `636777` say plainly that the content is unknown.
