"use strict";
/* =====================================================================================
   THE THREE ONBOARDING CUES
   ERA 1.5.2 — EXTRACTED VERBATIM FROM game.html.

   Exactly three contextual prompts, each naming one key, each retired permanently the
   first time that key does its work. There is no tutorial in this build and a fourth cue
   is a design decision, not a convenience — CLAUDE.md section 54.

   A cue and a real affordance are the same { key, verb } spec and UIManager cannot tell
   them apart. That is deliberate, and it is why this is data rather than a system.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md and src/gameplay/LAYER.md.
   ===================================================================================== */

const ONBOARDING_CUES = Object.freeze([
  {
    id: 'break',
    key: 'LMB',
    when: (c) => c.target !== null,
    verb: (c) => (WOOD_BLOCKS.has(c.target) ? 'CHOP'
                : REQUIRES_PICKAXE.has(c.target) ? 'MINE' : 'BREAK'),
  },
  {
    /* Only once there is something to make. Offering the bench to a player with empty
       hands would be a menu advertisement; offering it to one holding a log is the next
       thing they were going to want. */
    id: 'craft',
    key: 'E',
    when: (c) => c.inv.hasItem(ITEM.OAK_LOG) || c.inv.hasItem(ITEM.ASH_LOG) ||
                 c.inv.hasItem(ITEM.WOOD_PLANK),
    verb: () => 'CRAFT',
  },
  {
    id: 'place',
    key: 'RMB',
    when: (c) => c.target !== null && c.holdingBlock,
    verb: () => 'PLACE',
  },
]);
const ONBOARDING_CUE_IDS = Object.freeze(ONBOARDING_CUES.map(c => c.id));
