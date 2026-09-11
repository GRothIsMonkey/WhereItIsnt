"use strict";
/* =====================================================================================
   WHAT A BLOCK DOES WHEN IT IS STRUCK, AND WHAT IT IS CALLED
   ERA 1.5.2 — EXTRACTED VERBATIM FROM game.html.

   Hardness, the pickaxe and axe tier tables, computeBreakTime(), the mining feedback
   constants, the display-name table and the no-highlight set.

   KEPT TOGETHER DELIBERATELY. Hardness and display name look like two concerns, and they
   are not separable: one load-time loop writes BLOCK_DISPLAY_NAME and BLOCK_HARDNESS for
   the same eighteen roof ids. Splitting them would mean splitting that loop, which is a
   refactor, and Era 1.5 moves code without rewriting it.

   computeBreakTime() is a pure function of a block id, a tool and a bonus. It reads no
   world state, no player object and no clock.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md and src/world/LAYER.md.
   ===================================================================================== */

/* PHASE 26 — the per-block and per-chest XP reward tables stood here. Mining a log and
   cracking a chest no longer pay a currency; what a log and a chest give the player is
   the log and the chest's contents. */

/* ---------------------------------------------------------------------------------
   BLOCK HARDNESS & TOOL SPEEDS
   Base break times (seconds, bare hands) per block type, plus which blocks require
   a Pickaxe to actually drop loot (breaking them without one just clears the block).
   --------------------------------------------------------------------------------- */
const BLOCK_HARDNESS = {
  [BLOCK.GRASS]: 0.8, [BLOCK.DIRT]: 0.8, [BLOCK.LEAVES]: 0.3, [BLOCK.OAK_LOG]: 2.5,
  [BLOCK.STONE]: 8.0, [BLOCK.COAL_ORE]: 10.0, [BLOCK.IRON_ORE]: 10.0, [BLOCK.OBSIDIAN]: 14.0,
  [BLOCK.CORRUPTED_STONE]: 8.0,
  [BLOCK.TORCH]: 0.1, [BLOCK.SAFEHOUSE_ANCHOR]: 3.0,
  [BLOCK.TREASURE_CHEST]: 1.5, [BLOCK.MIMIC_BLOCK]: 8.0,
  [BLOCK.ANDESITE]: 8.5, [BLOCK.GRANITE]: 9.0,
  [BLOCK.ROTTED_SOIL]: 0.8, [BLOCK.ASH_WOOD]: 2.5, [BLOCK.BLACK_CANOPY]: 0.3,
  [BLOCK.LANTERN]: 1.0, [BLOCK.SOUL_ANCHOR]: 2.0,
  [BLOCK.ASPHALT]: 7.0, [BLOCK.CONCRETE]: 6.5,
  // LEVEL 4 — the Haven's own materials. The barrier is deliberately absurd
  // (effectively unbreakable) so the fog wall can never be mined through.
  [BLOCK.POLISHED_OAK]: 2.2, [BLOCK.HAVEN_GLASS]: 0.6, [BLOCK.HAVEN_BARRIER]: 1e9,
  // PHASE 9 — Suburbia siding/shingle: soft, quick to break, like the rest of the
  // dimension's set-dressing.
  [BLOCK.SIDE_PINK]: 1.4, [BLOCK.SIDE_MINT]: 1.4, [BLOCK.SIDE_BUTTER]: 1.4,
  [BLOCK.SIDE_SKY]: 1.4, [BLOCK.SIDE_PEACH]: 1.4, [BLOCK.SIDE_CREAM]: 1.4,
  [BLOCK.SHINGLE]: 1.6,
  [BLOCK.BRICK]: 2.0, [BLOCK.RUG]: 0.4
};

/* PHASE 13 — hardness for the Suburbia vocabulary. Everything here is set dressing, so
   it breaks about as fast as the Phase 9 siding did; only the paving is stubborn enough
   to feel like poured concrete. Applied programmatically because there are ~180 ids and
   a hand-written table would rot the first time one moved. */
(function () {
  const HARD = [
    [[BLOCK.SIDEWALK, BLOCK.DRIVEWAY, BLOCK.ROAD, BLOCK.ROAD_LINE, BLOCK.ROAD_SEAM,
      BLOCK.CURB_MAT, BLOCK.STONE_VENEER, BLOCK.BRICK_TAN, BLOCK.BELT_COURSE,
      BLOCK.SLAB_SIDEWALK, BLOCK.SLAB_DRIVEWAY, BLOCK.SLAB_ASPHALT, BLOCK.SLAB_GUTTER,
      BLOCK.SLAB_CONC, BLOCK.CURB, BLOCK.CURB_RAMP_N, BLOCK.CURB_RAMP_E,
      BLOCK.CURB_RAMP_S, BLOCK.CURB_RAMP_W, BLOCK.DRAIN_GRATE, BLOCK.CURB_INLET_N,
      BLOCK.CURB_INLET_E, BLOCK.CURB_INLET_S, BLOCK.CURB_INLET_W, BLOCK.CROSSWALK_X,
      BLOCK.CROSSWALK_Z, BLOCK.STEP_N, BLOCK.STEP_E, BLOCK.STEP_S, BLOCK.STEP_W], 6.5],
    [[BLOCK.LAWN, BLOCK.LAWN_DRY, BLOCK.MULCH, BLOCK.SLAB_LAWN, BLOCK.FLOWERS,
      BLOCK.HEDGE_TALL, BLOCK.HEDGE_LOW, BLOCK.SHRUB, BLOCK.TREE_CANOPY,
      BLOCK.FOLIAGE, BLOCK.HEDGE_MAT, BLOCK.DOORMAT], 0.6],
    [[BLOCK.TREE_TRUNK, BLOCK.BARK, BLOCK.UTIL_POLE, BLOCK.CROSSARM_X, BLOCK.CROSSARM_Z,
      BLOCK.DECK, BLOCK.SLAB_DECK, BLOCK.PRIVACY_X, BLOCK.PRIVACY_Z], 2.2],
    /* PHASE 16 — the Farmlands. Soil matches Rotted Soil (0.8) so the whole dimension
       digs at one consistent rate; standing vegetation is brushed aside almost
       instantly, which matters because a player crossing a crop field would otherwise
       be fighting through it. */
    [[BLOCK.FARM_TRACK, BLOCK.FARM_RUT, BLOCK.DEAD_EARTH, BLOCK.TILLED_X,
      BLOCK.TILLED_Z, BLOCK.DITCH_MUD], 0.8],
    [[BLOCK.WITHERED_CROP, BLOCK.CROP_TALL, BLOCK.STUBBLE, BLOCK.DRY_TUSSOCK,
      BLOCK.REEDS, BLOCK.ORCHARD_CANOPY, BLOCK.HEDGEROW, BLOCK.DEAD_SAPLING], 0.3],
    [[BLOCK.HAY_BALE, BLOCK.SCARECROW, BLOCK.TROUGH, BLOCK.FARM_FENCE_X,
      BLOCK.FARM_FENCE_Z, BLOCK.FENCE_POST], 1.2],
    [[BLOCK.FARM_STONE_X, BLOCK.FARM_STONE_Z], 5.0],
    /* PHASE 17. Barn board and clapboard match the suburb's siding (1.4) so rural and
       suburban architecture dig at one rate. Stone landmark pieces are deliberately slow
       — a headstone should feel like stone, and the friction discourages idly clearing a
       cemetery, which is the one place in this dimension where that would cheapen it. */
    [[BLOCK.BARN_RED, BLOCK.BARN_WHITE, BLOCK.FARM_CLAPBOARD, BLOCK.ROT_PLANK,
      BLOCK.LOFT_HAY], 1.4],
    [[BLOCK.FIELDSTONE, BLOCK.SILO_TILE, BLOCK.CHAPEL_STONE], 4.5],
    [[BLOCK.HEADSTONE_ROUND, BLOCK.HEADSTONE_SLAB, BLOCK.HEADSTONE_CROSS,
      BLOCK.MEMORIAL], 6.0],
    [[BLOCK.CORRUGATED, BLOCK.SILO_CONE, BLOCK.TRACTOR_BODY, BLOCK.TRACTOR_WHEEL,
      BLOCK.PLOUGH], 3.2],
    [[BLOCK.BEAM_X, BLOCK.BEAM_Z, BLOCK.POST_TIMBER, BLOCK.RAFTER_X, BLOCK.RAFTER_Z,
      BLOCK.BARN_DOOR_X, BLOCK.BARN_DOOR_Z, BLOCK.FIELD_GATE_X, BLOCK.FIELD_GATE_Z,
      BLOCK.WELL_POST, BLOCK.WELL_WINCH, BLOCK.CHAPEL_PEW, BLOCK.WAGON_BED,
      BLOCK.GRAVE_MARKER], 2.2],
    [[BLOCK.LADDER_N, BLOCK.LADDER_S, BLOCK.LADDER_E, BLOCK.LADDER_W, BLOCK.CRATE,
      BLOCK.BARREL, BLOCK.SACK_PILE, BLOCK.WHEEL_SPOKE, BLOCK.HAND_TOOLS,
      BLOCK.WIN_BOARDED, BLOCK.WIN_BROKEN, BLOCK.CHAPEL_BELL], 1.0],
    [[BLOCK.WELL_RIM, BLOCK.GRAVE_SOIL], 2.6],
  ];
  for (const [ids, h] of HARD) for (const id of ids) BLOCK_HARDNESS[id] = h;
  // Everything else in the 40+ range is light set dressing.
  for (let id = 40; id <= 219; id++) if (BLOCK_HARDNESS[id] === undefined) BLOCK_HARDNESS[id] = 1.4;
  // PHASE 14 — anything the interior compiler allocates and did not name explicitly is
  // set dressing, and breaks about as easily as the siding does.
  for (let id = 220; id < BLOCK_ID_COUNT; id++) if (BLOCK_HARDNESS[id] === undefined) BLOCK_HARDNESS[id] = 1.0;

  /* PHASE 14 — the interior brightness trim, applied to the plain cube materials as well
     as the shaped ones. Without this the furniture, the partitions and the plaster skins
     were lifted but the floors, the carpet and the underside of the upper deck were not,
     so a stairwell read as a black hole in an otherwise lit room. These four blocks are
     used by Suburbia interiors and nothing else, so nothing outside a house moves. */
  for (const id of [BLOCK.CARPET, BLOCK.DRYWALL, BLOCK.TILE_FLOOR, BLOCK.WOOD_FLOOR]) {
    BLOCK_SHADE_BOOST[id] = INTERIOR_SHADE_BOOST;
  }
})();
const BLOCK_HARDNESS_DEFAULT = 1.5;

// Blocks that require a Pickaxe in hand to drop anything at all
const REQUIRES_PICKAXE = new Set([
  BLOCK.STONE, BLOCK.COAL_ORE, BLOCK.IRON_ORE, BLOCK.OBSIDIAN,
  BLOCK.CORRUPTED_STONE, BLOCK.MIMIC_BLOCK,
  BLOCK.ANDESITE, BLOCK.GRANITE,
  BLOCK.ASPHALT, BLOCK.CONCRETE
]);

// Pickaxe tier -> time-on-Stone (seconds), used to derive a speed multiplier applied
// to every pickaxe-gated block (Stone, ores, obsidian...). Tier 0 = bare hands.
const PICKAXE_TIER_STONE_TIME = { 0: 8.0, 1: 2.5, 2: 1.2, 3: 0.6 };
// Axe tier -> multiplier applied to wood-family blocks (logs/planks-as-blocks).
const AXE_TIER_WOOD_MULT = { 0: 1.0, 1: 2.2, 2: 3.4, 3: 5.0 };
const WOOD_BLOCKS = new Set([BLOCK.OAK_LOG, BLOCK.ASH_WOOD]);

// Returns { time, willDrop } for breaking block `id` with the currently-held item meta.
function computeBreakTime(id, heldMeta, miningSpeedBonus) {
  const base = BLOCK_HARDNESS[id] !== undefined ? BLOCK_HARDNESS[id] : BLOCK_HARDNESS_DEFAULT;
  const needsPickaxe = REQUIRES_PICKAXE.has(id);
  const pickaxeTier = (heldMeta && heldMeta.isPickaxe) ? heldMeta.pickaxeTier : 0;
  const axeTier = (heldMeta && heldMeta.isAxe) ? heldMeta.axeTier : 0;

  let time;
  if (needsPickaxe) {
    // Scale this block's own hardness by the same ratio the tool gives on Stone,
    // so Coal Ore (10s base) speeds up proportionally to Stone (8s base).
    const stoneBase = BLOCK_HARDNESS[BLOCK.STONE];
    const stoneTime = PICKAXE_TIER_STONE_TIME[pickaxeTier];
    const ratio = stoneTime / stoneBase;
    time = base * ratio;
  } else if (WOOD_BLOCKS.has(id)) {
    time = base / AXE_TIER_WOOD_MULT[axeTier];
  } else {
    time = base;
  }
  /* PHASE 26 — miningSpeedBonus is now a LEGACY value only. Nothing in the running game
     increases it: mining speed comes from the tool in the player's hand (the tier tables
     above), which is the direct progression that replaced the XP curve. The term is kept
     because a save written before the removal may carry a bonus the player already
     earned, and silently deleting it would be taking progress away. */
  time = time / (1 + (miningSpeedBonus || 0));
  time = Math.max(0.05, time);

  const willDrop = !needsPickaxe || pickaxeTier > 0;
  return { time, willDrop, needsPickaxe, pickaxeTier, axeTier };
}

/* ---------------------------------------------------------------------------------
   PHASE 2 — MINING FEEL

   The break maths above are UNCHANGED (same hardness table, same tier tables, same
   resulting seconds-per-block). Everything below is presentation: making the target
   legible, the progress readable, and the tool difference *perceptible* rather than
   merely true-on-paper.
   --------------------------------------------------------------------------------- */
const MINING_CRACK_STAGES = 6;        // crack overlay frames drawn across the break
// Cadence ceiling/floor for the mining hit tick. The ceiling is deliberately slow:
// at 0.34 the clamp collapsed bare-hands and a Wooden Pickaxe onto the SAME rhythm
// (8.0s and 2.5s both floor out), which flattened the single most important upgrade
// in the early game. At 0.55 every pickaxe tier lands on its own audible cadence.
const MINING_HIT_BASE_INTERVAL = 0.55; // slowest tick cadence (bare hands on stone)
const MINING_HIT_MIN_INTERVAL = 0.10;  // fastest allowed tick cadence (best tools)
const MINING_HIT_SOUND_GAIN = 0.055;   // deliberately quiet — this repeats constantly
const MINING_CHIP_COUNT = 7;           // voxel chips flung on a successful break
const MINING_TICK_CHIP_CHANCE = 0.55;  // chance a hit tick also sheds a single chip
const MINING_OUTLINE_IDLE = 0x0b0b0d;  // classic dark selection outline
const MINING_OUTLINE_ACTIVE = 0xffcf6b; // HUD amber while actively breaking
const MINING_OUTLINE_BLOCKED = 0xd8483f; // red when the held tool will yield nothing

/* Human-readable names for the mining HUD. Falls back to a prettified enum key. */
const BLOCK_DISPLAY_NAME = {
  [BLOCK.GRASS]: 'Grass', [BLOCK.DIRT]: 'Dirt', [BLOCK.STONE]: 'Stone',
  [BLOCK.OAK_LOG]: 'Oak Log', [BLOCK.LEAVES]: 'Leaves', [BLOCK.TORCH]: 'Torch',
  [BLOCK.CORRUPTED_STONE]: 'Corrupted Stone', [BLOCK.MIMIC_BLOCK]: 'Stone',
  [BLOCK.SAFEHOUSE_ANCHOR]: 'Safehouse Anchor', [BLOCK.COAL_ORE]: 'Coal Ore',
  [BLOCK.IRON_ORE]: 'Iron Ore', [BLOCK.OBSIDIAN]: 'Obsidian',
  [BLOCK.TREASURE_CHEST]: 'Ancient Chest', [BLOCK.ANDESITE]: 'Andesite',
  [BLOCK.GRANITE]: 'Granite', [BLOCK.ROTTED_SOIL]: 'Rotted Soil',
  [BLOCK.ASH_WOOD]: 'Ash Wood', [BLOCK.BLACK_CANOPY]: 'Black Canopy',
  [BLOCK.LANTERN]: 'Lantern', [BLOCK.SOUL_ANCHOR]: 'Soul Anchor',
  [BLOCK.ASPHALT]: 'Asphalt', [BLOCK.CONCRETE]: 'Concrete',
  [BLOCK.POLISHED_OAK]: 'Polished Oak', [BLOCK.HAVEN_GLASS]: 'Glass',
  [BLOCK.SIDE_PINK]: 'Pink Siding', [BLOCK.SIDE_MINT]: 'Mint Siding',
  [BLOCK.SIDE_BUTTER]: 'Butter Siding', [BLOCK.SIDE_SKY]: 'Sky Siding',
  [BLOCK.SIDE_PEACH]: 'Peach Siding', [BLOCK.SIDE_CREAM]: 'Cream Siding',
  [BLOCK.SHINGLE]: 'Shingle',
  [BLOCK.BRICK]: 'Brick', [BLOCK.RUG]: 'Woven Rug',
  // PHASE 13 — the Suburbia vocabulary. Named by what a resident would call them, not
  // by their geometry, so the readout never says "half-slab" at anybody.
  [BLOCK.LAWN]: 'Lawn', [BLOCK.LAWN_DRY]: 'Dry Lawn', [BLOCK.MULCH]: 'Mulch',
  [BLOCK.SIDEWALK]: 'Sidewalk', [BLOCK.DRIVEWAY]: 'Driveway', [BLOCK.ROAD]: 'Asphalt',
  [BLOCK.ROAD_LINE]: 'Road Marking', [BLOCK.ROAD_SEAM]: 'Patched Asphalt',
  [BLOCK.CURB_MAT]: 'Kerbstone', [BLOCK.CURB]: 'Kerb', [BLOCK.DRAIN_GRATE]: 'Storm Drain',
  [BLOCK.SLAB_SIDEWALK]: 'Sidewalk', [BLOCK.SLAB_DRIVEWAY]: 'Driveway',
  [BLOCK.SLAB_LAWN]: 'Lawn', [BLOCK.SLAB_CONC]: 'Concrete Slab',
  [BLOCK.SLAB_DECK]: 'Deck Board', [BLOCK.SLAB_GUTTER]: 'Gutter Pan',
  [BLOCK.SLAB_ASPHALT]: 'Asphalt', [BLOCK.SLAB_TRIM]: 'Trim Board',
  [BLOCK.CROSSWALK_X]: 'Road Marking', [BLOCK.CROSSWALK_Z]: 'Road Marking',
  [BLOCK.SID_SAGE]: 'Sage Siding', [BLOCK.SID_CLAY]: 'Clay Siding',
  [BLOCK.SID_SLATE]: 'Slate Siding', [BLOCK.SID_CREAM]: 'Cream Siding',
  [BLOCK.SID_TAUPE]: 'Taupe Siding', [BLOCK.SID_OLIVE]: 'Olive Siding',
  [BLOCK.SID_WHITE]: 'White Siding', [BLOCK.SID_SAND]: 'Sand Siding',
  [BLOCK.SHAKE]: 'Cedar Shake', [BLOCK.BRICK_TAN]: 'Tan Brick',
  [BLOCK.STONE_VENEER]: 'Stone Veneer', [BLOCK.TRIM]: 'Trim', [BLOCK.SOFFIT]: 'Soffit',
  [BLOCK.DECK]: 'Decking', [BLOCK.BELT_COURSE]: 'Foundation',
  [BLOCK.ROOF_CHAR]: 'Charcoal Shingle', [BLOCK.ROOF_BROWN]: 'Brown Shingle',
  [BLOCK.ROOF_SLATE]: 'Slate Shingle',
  [BLOCK.CARPET]: 'Carpet', [BLOCK.DRYWALL]: 'Drywall',
  [BLOCK.TILE_FLOOR]: 'Floor Tile', [BLOCK.WOOD_FLOOR]: 'Floorboards',
  [BLOCK.GLASS_DARK]: 'Window Pane', [BLOCK.WIN_X]: 'Window', [BLOCK.WIN_Z]: 'Window',
  [BLOCK.WIN_WIDE_X]: 'Picture Window', [BLOCK.WIN_WIDE_Z]: 'Picture Window',
  [BLOCK.SHUTTER_X]: 'Shuttered Window', [BLOCK.SHUTTER_Z]: 'Shuttered Window',
  [BLOCK.GABLE_VENT_X]: 'Gable Vent', [BLOCK.GABLE_VENT_Z]: 'Gable Vent',
  [BLOCK.DOOR_A_X]: 'Front Door', [BLOCK.DOOR_A_Z]: 'Front Door',
  [BLOCK.DOOR_B_X]: 'Front Door', [BLOCK.DOOR_B_Z]: 'Front Door',
  [BLOCK.DOOR_C_X]: 'Front Door', [BLOCK.DOOR_C_Z]: 'Front Door',
  [BLOCK.GARAGE_X]: 'Garage Door', [BLOCK.GARAGE_Z]: 'Garage Door',
  [BLOCK.POST]: 'Porch Post', [BLOCK.COLUMN]: 'Porch Column',
  [BLOCK.RAIL_X]: 'Railing', [BLOCK.RAIL_Z]: 'Railing',
  [BLOCK.STEP_N]: 'Step', [BLOCK.STEP_E]: 'Step', [BLOCK.STEP_S]: 'Step', [BLOCK.STEP_W]: 'Step',
  [BLOCK.PICKET_X]: 'Picket Fence', [BLOCK.PICKET_Z]: 'Picket Fence',
  [BLOCK.PICKET_POST]: 'Fence Post',
  [BLOCK.PRIVACY_X]: 'Board Fence', [BLOCK.PRIVACY_Z]: 'Board Fence',
  [BLOCK.HEDGE_TALL]: 'Hedge', [BLOCK.HEDGE_LOW]: 'Low Hedge', [BLOCK.SHRUB]: 'Shrub',
  [BLOCK.FLOWERS]: 'Flower Bed', [BLOCK.TREE_TRUNK]: 'Tree Trunk',
  [BLOCK.TREE_CANOPY]: 'Foliage', [BLOCK.AC_UNIT]: 'Air Conditioner',
  [BLOCK.BIN]: 'Trash Bin', [BLOCK.DOORMAT]: 'Doormat',
  [BLOCK.LAMP_POST]: 'Street Lamp', [BLOCK.LAMP_ARM_N]: 'Street Lamp',
  [BLOCK.LAMP_ARM_E]: 'Street Lamp', [BLOCK.LAMP_ARM_S]: 'Street Lamp',
  [BLOCK.LAMP_ARM_W]: 'Street Lamp',
  [BLOCK.MAILBOX_X]: 'Mailbox', [BLOCK.MAILBOX_Z]: 'Mailbox',
  [BLOCK.HYDRANT]: 'Fire Hydrant', [BLOCK.UTIL_POLE]: 'Utility Pole',
  [BLOCK.CROSSARM_X]: 'Utility Pole', [BLOCK.CROSSARM_Z]: 'Utility Pole',
  [BLOCK.WIRE_X]: 'Power Line', [BLOCK.WIRE_Z]: 'Power Line',
  [BLOCK.SIGN_POST]: 'Sign Post', [BLOCK.SIGN_X]: 'Street Sign',
  [BLOCK.SIGN_Z]: 'Street Sign', [BLOCK.STOP_SIGN]: 'Stop Sign',
  [BLOCK.GUTTER_N]: 'Gutter', [BLOCK.GUTTER_E]: 'Gutter',
  [BLOCK.GUTTER_S]: 'Gutter', [BLOCK.GUTTER_W]: 'Gutter',
  [BLOCK.FASCIA_N]: 'Fascia', [BLOCK.FASCIA_E]: 'Fascia',
  [BLOCK.FASCIA_S]: 'Fascia', [BLOCK.FASCIA_W]: 'Fascia',
  [BLOCK.DOWNSPOUT]: 'Downspout', [BLOCK.RAKE_X]: 'Rake Board',
  [BLOCK.RAKE_Z]: 'Rake Board', [BLOCK.SOFFIT_PANEL]: 'Soffit',
  [BLOCK.CHIMNEY_CAP]: 'Chimney', [BLOCK.ROOF_VENT]: 'Roof Vent',
  [BLOCK.PORCH_LIGHT_X]: 'Porch Light', [BLOCK.PORCH_LIGHT_Z]: 'Porch Light',
};
/* PHASE 16 — the Farmlands vocabulary, named the way a farmhand would name it. */
Object.assign(BLOCK_DISPLAY_NAME, {
  [BLOCK.FARM_TRACK]: 'Cart Track', [BLOCK.FARM_RUT]: 'Cart Track',
  [BLOCK.DEAD_EARTH]: 'Dead Earth', [BLOCK.TILLED_X]: 'Tilled Soil',
  [BLOCK.TILLED_Z]: 'Tilled Soil', [BLOCK.DITCH_MUD]: 'Ditch Silt',
  [BLOCK.ORCHARD_CANOPY]: 'Blighted Boughs', [BLOCK.HEDGEROW]: 'Dead Hedgerow',
  [BLOCK.WITHERED_CROP]: 'Withered Crop', [BLOCK.CROP_TALL]: 'Withered Crop',
  [BLOCK.STUBBLE]: 'Stubble', [BLOCK.DRY_TUSSOCK]: 'Dry Grass',
  [BLOCK.REEDS]: 'Reeds', [BLOCK.HAY_BALE]: 'Rotted Bale',
  [BLOCK.FARM_FENCE_X]: 'Fence Rail', [BLOCK.FARM_FENCE_Z]: 'Fence Rail',
  [BLOCK.FENCE_POST]: 'Fence Post', [BLOCK.DEAD_SAPLING]: 'Dead Sapling',
  [BLOCK.FARM_STONE_X]: 'Field Wall', [BLOCK.FARM_STONE_Z]: 'Field Wall',
  [BLOCK.TROUGH]: 'Water Trough', [BLOCK.SCARECROW]: 'Scarecrow',
});

/* PHASE 17 — rural architecture and landmarks. Landmark pieces are named plainly and
   without atmosphere: a headstone reports as "Headstone". The horror in this phase is
   compositional, and a block tooltip that editorialises would undercut it. */
Object.assign(BLOCK_DISPLAY_NAME, {
  [BLOCK.BARN_RED]: 'Barn Board', [BLOCK.BARN_WHITE]: 'Barn Board',
  [BLOCK.FARM_CLAPBOARD]: 'Weathered Clapboard', [BLOCK.FIELDSTONE]: 'Fieldstone',
  [BLOCK.CORRUGATED]: 'Corrugated Sheet', [BLOCK.SILO_TILE]: 'Silo Tile',
  [BLOCK.LOFT_HAY]: 'Loft Hay', [BLOCK.ROT_PLANK]: 'Rotten Planks',
  [BLOCK.GRAVE_SOIL]: 'Turned Earth', [BLOCK.CHAPEL_STONE]: 'Chapel Stone',
  [BLOCK.BEAM_X]: 'Timber Beam', [BLOCK.BEAM_Z]: 'Timber Beam',
  [BLOCK.POST_TIMBER]: 'Timber Post', [BLOCK.RAFTER_X]: 'Rafter', [BLOCK.RAFTER_Z]: 'Rafter',
  [BLOCK.LADDER_N]: 'Ladder', [BLOCK.LADDER_S]: 'Ladder',
  [BLOCK.LADDER_E]: 'Ladder', [BLOCK.LADDER_W]: 'Ladder',
  [BLOCK.BARN_DOOR_X]: 'Barn Door', [BLOCK.BARN_DOOR_Z]: 'Barn Door',
  [BLOCK.FIELD_GATE_X]: 'Field Gate', [BLOCK.FIELD_GATE_Z]: 'Field Gate',
  [BLOCK.WIN_BOARDED]: 'Boarded Window', [BLOCK.WIN_BROKEN]: 'Broken Window',
  [BLOCK.WELL_RIM]: 'Well', [BLOCK.WELL_POST]: 'Well Post', [BLOCK.WELL_WINCH]: 'Well Winch',
  [BLOCK.CRATE]: 'Crate', [BLOCK.BARREL]: 'Barrel', [BLOCK.SACK_PILE]: 'Feed Sacks',
  [BLOCK.TRACTOR_BODY]: 'Derelict Tractor', [BLOCK.TRACTOR_WHEEL]: 'Derelict Tractor',
  [BLOCK.WAGON_BED]: 'Broken Wagon', [BLOCK.WHEEL_SPOKE]: 'Cart Wheel',
  [BLOCK.PLOUGH]: 'Old Plough', [BLOCK.HAND_TOOLS]: 'Hand Tools',
  [BLOCK.HEADSTONE_ROUND]: 'Headstone', [BLOCK.HEADSTONE_SLAB]: 'Headstone',
  [BLOCK.HEADSTONE_CROSS]: 'Headstone', [BLOCK.GRAVE_MARKER]: 'Grave Marker',
  [BLOCK.CHAPEL_PEW]: 'Pew', [BLOCK.CHAPEL_BELL]: 'Chapel Bell',
  [BLOCK.MEMORIAL]: 'Memorial', [BLOCK.SILO_CONE]: 'Silo Cap',
});
for (let i = 0; i < 18; i++) {
  BLOCK_DISPLAY_NAME[BLOCK.ROOF_TIN + i] = 'Corrugated Roof';
  BLOCK_HARDNESS[BLOCK.ROOF_TIN + i] = 1.8;
}


// Roof pieces all report as their material — the player has no use for knowing whether
// they are looking at a hip corner or a ridge cap.
for (let i = 0; i < 18; i++) {
  BLOCK_DISPLAY_NAME[BLOCK.ROOF_A + i] = 'Charcoal Shingle';
  BLOCK_DISPLAY_NAME[BLOCK.ROOF_B + i] = 'Brown Shingle';
  BLOCK_DISPLAY_NAME[BLOCK.ROOF_C + i] = 'Slate Shingle';
}

/* Blocks that must never be highlighted. HAVEN_BARRIER is the invisible fog wall —
   drawing a selection box on it would hand the player a visible seam and give the
   Fake Haven illusion away outright. */
const NO_HIGHLIGHT_BLOCKS = new Set([BLOCK.HAVEN_BARRIER]);
