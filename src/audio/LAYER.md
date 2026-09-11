# `src/audio/` — WHAT IS AUDIBLE — AND IT ALREADY WORKS

`SoundEngine` owns the hardware. `AudioLibrary` owns files. `AudioDirector` owns policy.
**Era 1.5 draws a boundary around this and changes nothing inside it.**

## May depend on
`shared/`, `core/`.

## Must never
**library:** read a block id. **director:** create an `AudioNode`. **anyone else:** hold either.

## Scheduled to move here

| From `game.html` | What | Phase |
| --- | --- | --- |
| 2172–4322 | `SoundEngine` — 2,151 lines of synthesis that works. **Move it; do not improve it.** | 1.5.2 |
| 5815–6295 | `AudioLibrary` | 1.5.2 |
| 6593–7001 | `AudioDirector` | 1.5.2 |
| ✅ — | `audio-tables.js` — the manifest, limits, surfaces, scenes, events, preload, cues | **1.5.2 · done** |
| 39705–39790 | `Game._updateEnvironmentAudio` — 82 lines of POLICY in the wrong place (P2-3) | 1.5.4 |

> **MEASURED, NOT ASSUMED:** `AudioDirector` makes 0 Web Audio calls and `AudioLibrary`
> reads 0 block ids, today. `tests/audio.js` fails if either changes.
>
> `AUDIO_ASSETS` is **generated** — rebuild it with `tests/tools/build_runtime.py`, never by
> hand. A filename's Freesound id is the join key to `AUDIO_CREDITS` and `AUDIO_INDEX.md`;
> renaming a file is a licence break.
