"use strict";
/* =====================================================================================
   COMBAT FEEL AND DROPPED-ITEM PHYSICS — THE TUNING NUMBERS
   ERA 1.5.2 — EXTRACTED VERBATIM FROM game.html.

   Knockback readability, the player's step-assist ceiling, mob collision substepping,
   the void reap line, dropped-item gravity, friction, bounce and pickup radius, and the
   rift arming delay. Plain numbers with no dependencies at all.

   NOTHING HERE TOUCHES MOB HP, DAMAGE, SPEED, SPAWN RATES OR LOOT — that was true when
   Phase 1 grouped them and it is why they group cleanly now.

   CHANGING A NUMBER IN THIS FILE CHANGES HOW THE GAME FEELS. Era 1.5 moved them; it did
   not touch one of them.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md and src/gameplay/LAYER.md.
   ===================================================================================== */

/* ---------------------------------------------------------------------------------
   PHASE 1 — COMBAT FEEL TUNING CONSTANTS
   All numbers that govern knockback readability and dropped-item physics live here so
   they can be tuned in one place. Nothing in this block touches mob HP, damage, speed,
   spawn rates or loot tables.
   --------------------------------------------------------------------------------- */
// --- Mob knockback --------------------------------------------------------------
/* PHASE 13 — STEP ASSIST TUNING. The ceiling sits deliberately below a full block:
   every block outside Static Suburbia is a full cube, so the smallest rise anywhere
   else in the game is 1.0 and remains unsteppable. This value only ever lets the
   player walk up the suburb's half-block kerbs and slabs. It is set slightly above
   half a block on purpose: the gutter pan dishes 1/16 below the carriageway, so the
   real rise from standing in the gutter onto the kerb is 0.5625, and a 0.55 ceiling
   would have left the player stuck at the edge of every road. */
/* PHASE 35 — see AnchorMonumentManager.riftArming. Long enough that the Anchor is seen
   to answer the Disk; short enough that it never reads as a wait. */
const RIFT_ARM_TIME = 1.6;

const PLAYER_STEP_HEIGHT = 0.62;
const PLAYER_STEP_STEPS = 8;     // probe granularity, ~0.069 blocks per attempt

const MOB_KB_SCALE = 1.25;          // weapon "knockback" stat -> impulse speed (blocks/s)
const MOB_KB_MAX_SPEED = 11.0;      // hard cap on the horizontal impulse speed
const MOB_KB_DECAY = 6.0;           // exponential decay rate (per second) of the impulse
const MOB_KB_DURATION = 0.45;       // seconds the impulse is allowed to persist at all
const MOB_KB_MIN_SPEED = 0.35;      // below this the impulse is snapped to zero
const MOB_KB_LIFT = 3.6;            // small upward pop so the hit reads as physical
const MOB_KB_AI_DAMP = 0.25;        // AI steering authority while being knocked back
const MOB_KB_BOSS_MULT = 0.14;      // bosses shrug off most of the impulse
// --- Mob movement integration ---------------------------------------------------
const MOB_MAX_STEP_DIST = 0.35;     // max horizontal travel per collision substep (blocks)
const MOB_MAX_SUBSTEPS = 6;         // ceiling on substeps so a spike can't stall a frame
/* PHASE 36 — below this a mob is out of the world and is reaped rather than left to
   fall. Deliberately well under the lowest ground anywhere in the game (the Farmlands
   basins bottom out in the twenties and the Disconnected Home's cellar at twelve), so
   nothing standing on real terrain can ever be mistaken for it. */
const MOB_VOID_Y = -8;
// --- Dropped item physics -------------------------------------------------------
const ITEM_GRAVITY = 18.0;          // blocks/s^2
const ITEM_TERMINAL_VY = -26.0;     // terminal fall speed
const ITEM_HALF = 0.13;             // half-extent of the item's collision box
const ITEM_SIZE_Y = 0.25;           // full height of the item's collision box
const ITEM_MAX_STEP_DIST = 0.30;    // max travel per collision substep (blocks)
const ITEM_MAX_SUBSTEPS = 8;
const ITEM_SPAWN_POP = 2.2;         // upward pop applied on spawn
const ITEM_SPAWN_SCATTER = 1.1;     // horizontal scatter speed applied on spawn
const ITEM_GROUND_FRICTION = 7.0;   // horizontal damping while sliding/airborne
const ITEM_REST_SPEED = 0.25;       // below this horizontal speed a grounded item rests
const ITEM_BOUNCE = 0.22;           // vertical restitution on landing
const ITEM_PICKUP_RADIUS = 1.5;     // UNCHANGED from pre-Phase-1 behaviour

/* =====================================================================================
   PHASE 21 — DROPPED ITEM GROUND CONTACT

   THE DEFECT, AND IT WAS ONE NUMBER. `position` is the item's FOOT: the collider runs
   from `position.y` up to `position.y + ITEM_SIZE_Y`, and every physics path — landing,
   the spawn-overlap escape, the support test — is written against that. The MESH did not
   agree. THREE.BoxGeometry is centred on its origin (measured, not assumed: bounds
   -0.125..+0.125 on every axis), and it was drawn at `position.y` directly, so the
   rendered cube's bottom sat 0.125 blocks BELOW the surface the item was standing on.

   THE BOB MADE IT WORSE RATHER THAN BETTER. Applied as +/-0.08 around that already-sunk
   centre, the rendered bottom oscillated between 0.045 and 0.205 blocks under the
   ground: a dropped item never once touched the surface it was resting on, and was at
   its deepest at the bottom of every bob cycle.

   THE FIX IS TO DRAW THE MESH WHERE THE COLLIDER ALREADY IS, not to move the collider or
   re-tune the physics. Half the item's height lifts the centred geometry so its bottom
   face coincides with the collider's bottom face, and the bob is re-based to swing
   UPWARD from that contact rather than through it.

   THE BOB'S CHARACTER IS PRESERVED EXACTLY: same 3.0 rad/s rate, same 0.16 peak-to-peak
   travel, same per-item phase desync. Only its zero point moved — from "centred on the
   floor" to "resting on the floor" — which is what requirement 16 asks for when it says
   the bob must be centred around a valid grounded position and must not penetrate. */
const ITEM_MESH_HALF_Y = ITEM_SIZE_Y * 0.5;   // BoxGeometry(0.25) is centred on its origin
const ITEM_BOB_RATE = 3.0;                    // rad/s — unchanged
const ITEM_BOB_TRAVEL = 0.16;                 // peak-to-peak — unchanged (was +/-0.08)
/* How far down the support probe reaches. Small enough that it can only ever find the
   surface the item is actually standing on, large enough to survive float error in the
   resting position. */
const ITEM_SUPPORT_PROBE = 0.02;

/* Reused across every collision query so the item system allocates nothing in the frame
   loop. collidesAABB reads these fields and never retains the object. */
const _itemAABB = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
