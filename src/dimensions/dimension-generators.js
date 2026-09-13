"use strict";
/* =====================================================================================
   HOW THE ENGINE ASKS A DIMENSION WHAT GOES IN A CHUNK
   ERA 1.5.3 — THE DISPATCH, AS A TABLE.

   `VoxelWorld._generateChunk` used to carry the whole of this as an if / else-if / else
   naming eight dimension methods. It worked, and it was the shape that makes a fourth
   dimension a code change in the engine rather than a row in a table — which is exactly
   what Era 2 and The Below (STORY.md: creative D3) need it not to be.

   So the branch is now the DATA below, and the engine does one thing:

       chunkGeneratorFor(cx, cz).generateChunk(this, chunk)

   WHAT DID NOT CHANGE, AND MUST NOT. The order of the rows IS the order of the old
   branch — Suburbia, then the Farmlands, then the Overworld as the fallback — and each
   row calls exactly the methods the branch called, in the order it called them. World
   generation is deterministic and a reordering here is a different world, not a tidier
   file. The Overworld's six calls in particular are a sequence with reasons written
   against it: cave mouths after terrain so there is rock to open, trees and decor after
   mouths so nothing grows inside one, and the environmental story last so a story object
   is never grown through.

   WHAT THIS TABLE IS NOT. It is not a dimension descriptor and it is not a lifecycle.
   `src/dimensions/dimension-descriptors.js` owns identity (stable id, creative number,
   save name); this owns one question — who fills a chunk — and nothing else. Two edges
   from the engine into dimension content remain outside it and are deliberately left for
   Era 1.5.4, which owns startup and lifecycle: the constructor's eager region builds
   (`_genFarmlandsRegion`, `_genStaticSuburbiaRegion`) and `setBlockWorld`'s call to
   `_farmWaterNotify`. Both are named in ARCHITECTURE.md as deferred coupling.

   ORDER OF LOADING. Every reference to a dimension method or a coordinate predicate is
   inside a function body, so this file may load before any of them exist.
   ===================================================================================== */

/* A row is four fields and no cleverness: which place it is, whether it holds a chunk,
   and how that chunk is filled. A new dimension adds a row. */
const DIMENSION_CHUNK_GENERATORS = Object.freeze([
  Object.freeze({
    dimension: 'suburbia',
    holdsChunk: (cx, cz) => isStaticSuburbiaChunk(cx, cz),
    generateChunk: (world, chunk) => { world._genSuburbiaChunk(chunk); },
  }),
  Object.freeze({
    dimension: 'farmlands',
    holdsChunk: (cx, cz) => isFarmlandsChunk(cx, cz),
    generateChunk: (world, chunk) => { world._genFarmlandsChunk(chunk); },
  }),
]);

/* THE FALLBACK, AND IT IS A ROW LIKE THE OTHERS SO NOTHING ABOUT IT IS SPECIAL EXCEPT
   THAT IT ANSWERS LAST. The Overworld is everything the bands above do not claim. */
const OVERWORLD_CHUNK_GENERATOR = Object.freeze({
  dimension: 'overworld',
  holdsChunk: () => true,
  generateChunk: (world, chunk) => {
    world._generateTerrain(chunk);
    // PHASE 8 — runs after the base terrain so it has solid rock to open, and before
    // trees/decor/chests so nothing grows or spawns inside a mouth. Critically it is
    // still BEFORE the editedChunks replay in _generateChunk, so player edits always win.
    world._generateCaveMouths(chunk);
    world._generateTrees(chunk);
    world._generateDecor(chunk);
    world._generateTreasureChests(chunk);
    /* PHASE 31 — last, so a story object is never grown through by a tree and never
       overwrites a chest. See _envStoryStamp for why it works before Game exists. */
    world._envStoryStamp(chunk, 'overworld');
  },
});

/* First row whose band holds the chunk; the Overworld otherwise. The scan is over two
   rows and runs once per generated chunk, which is the same two coordinate tests the
   old branch made. */
function chunkGeneratorFor(cx, cz) {
  for (const g of DIMENSION_CHUNK_GENERATORS) if (g.holdsChunk(cx, cz)) return g;
  return OVERWORLD_CHUNK_GENERATOR;
}
