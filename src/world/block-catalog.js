"use strict";
/* =====================================================================================
   THE BLOCK VOCABULARY — WHAT BLOCKS EXIST
   ERA 1.5.2 — EXTRACTED VERBATIM FROM game.html.

   Pure data: the block id table, the colour table, the special-render set, the id
   ceiling, the shade boosts and the door constants. No behaviour, no THREE, no DOM.

   A BLOCK ID IS A SAVE-FILE VALUE. APPEND, NEVER INSERT. CLAUDE.md sections 57 and 62.2:
   Phase 31 shipped a bug by defining a furniture id where it belonged conceptually rather
   than on the end, and rewrote the chunk data of the entire suburb.

   THIS LIVES IN world/, NOT shared/. The 1.5.1 work order filed it under shared/ on the
   grounds that it is pure data. It is — but it is the VOCABULARY OF THE VOXEL WORLD, and
   Era 2 replaces it. shared/ is for what survives the renderer; this does not.

   The DIMENSION enum used to sit in the middle of this block. It moved to
   src/dimensions/dimension-registry.js, which is why the file resumes at BLOCK_COLOR.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md and src/world/LAYER.md.
   ===================================================================================== */

const BLOCK = {
  AIR:0, GRASS:1, DIRT:2, STONE:3, OAK_LOG:4, LEAVES:5, TORCH:6, CORRUPTED_STONE:7,
  MIMIC_BLOCK:8, SAFEHOUSE_ANCHOR:9, COAL_ORE:10, WATER:11, IRON_ORE:12, OBSIDIAN:13,
  TREASURE_CHEST:18,
  ANDESITE:19, GRANITE:20,
  // Level 2 (The Shattered Farmlands) biome blocks.
  ROTTED_SOIL:21, ASH_WOOD:22, BLACK_CANOPY:23,
  // PHASE 4B — advanced Level 2 craftable light/safe-zone props.
  LANTERN:24, SOUL_ANCHOR:25,
  // PHASE 5A — Level 3 (Static Suburbia) street materials: dark asphalt roads
  // and light concrete sidewalks tiling the repeating house grid.
  ASPHALT:26, CONCRETE:27,
  // PHASE 5A PART 3 — LEVEL 4 (The Fake Haven) cabin materials.
  // POLISHED_OAK: warm, sanded, honey-toned floorboards (the cabin's floor).
  // HAVEN_GLASS: clear window pane — rendered in its own transparent pass (see
  //   SPECIAL_RENDER_BLOCKS / _buildGlassMesh) but still solid to collision, so
  //   the bright blue outdoor light reads through without being walkable.
  // HAVEN_BARRIER: never meshed at all (it's in SPECIAL_RENDER_BLOCKS and has no
  //   geometry pass of its own) yet still returns true from isSolid — an entirely
  //   invisible wall, which is what makes the surrounding fog wall impenetrable
  //   without a visible seam giving the illusion away.
  POLISHED_OAK:28, HAVEN_GLASS:29, HAVEN_BARRIER:30,
  /* PHASE 9 — Static Suburbia siding palette. Pastel clapboard in the Edward-
     Scissorhands idiom the dimension is modelled on: without colour the suburb
     reads as grey blocks and loses the entire "too cheerful to be real" tone.
     These are surfaces only — no ores, no drops, no new mechanics. */
  SIDE_PINK:31, SIDE_MINT:32, SIDE_BUTTER:33, SIDE_SKY:34, SIDE_PEACH:35,
  SIDE_CREAM:36, SHINGLE:37,
  /* PHASE 10 — Fake Haven interior surfaces. Two blocks only, both purely
     decorative: the red brick of a proper hearth and the warm woven rug that
     anchors the room. These are the two colours the cosy-cabin reference is
     actually built out of, and nothing in the existing palette stands in for
     either. No ores, no drops, no mechanics. */
  BRICK:38, RUG:39,

  /* =================================================================================
     PHASE 13 — STATIC SUBURBIA ARCHITECTURAL VOCABULARY.

     Everything from 40 up is Suburbia-only. Two families live here:

       MATERIALS (40-73) are ordinary full cubes with new atlas tiles — the muted
       siding, natural roof colours, believable turf, dark asphalt and concrete the
       brief calls for.

       SHAPED PIECES (74-219) are NOT cubes. Each one carries a small list of boxes,
       wedges and prisms (see SUB_SHAPE_DEF) that the chunk mesher expands into real
       sub-voxel geometry: slabs, curbs, stair treads, angled roof planes, ridge caps,
       fascia, gutters, thin walls, railings, poles and trim. They are still ordinary
       entries in chunk.data, so they stream, free, collide, persist and regenerate
       through the exact same code Phase 9/11/12 already rely on — the mesher simply
       draws something other than a cube for them.

     Everything fits inside the existing Uint8 chunk store (max id 219 < 255), so no
     chunk memory, streaming or persistence behaviour changes at all.
     ================================================================================= */
  // --- Ground, road and paving materials -----------------------------------------
  LAWN:40, LAWN_DRY:41, MULCH:42, SIDEWALK:43, DRIVEWAY:44, ROAD:45, ROAD_LINE:46,
  ROAD_SEAM:47, CURB_MAT:48,
  // --- Muted siding palette -------------------------------------------------------
  SID_SAGE:49, SID_CLAY:50, SID_SLATE:51, SID_CREAM:52, SID_TAUPE:53, SID_OLIVE:54,
  SID_WHITE:55, SID_SAND:56,
  // --- Wall accents ---------------------------------------------------------------
  SHAKE:57, BRICK_TAN:58, STONE_VENEER:59,
  // --- Trim / structure -----------------------------------------------------------
  TRIM:60, SOFFIT:61, DECK:62,
  // --- Natural roof colours -------------------------------------------------------
  ROOF_CHAR:63, ROOF_BROWN:64, ROOF_SLATE:65,
  // --- Interior surfaces ----------------------------------------------------------
  CARPET:66, DRYWALL:67, TILE_FLOOR:68, WOOD_FLOOR:69,
  // --- Misc materials -------------------------------------------------------------
  GLASS_DARK:70, HEDGE_MAT:71, FOLIAGE:72, BARK:73,

  // --- SHAPED: slabs (half height, sit on the bottom of their cell) ---------------
  SLAB_SIDEWALK:74, SLAB_DRIVEWAY:75, SLAB_ASPHALT:76, SLAB_GUTTER:77, SLAB_CONC:78,
  SLAB_DECK:79, SLAB_TRIM:80, SLAB_LAWN:81,
  // --- SHAPED: kerb line ----------------------------------------------------------
  CURB:82, CURB_RAMP_N:83, CURB_RAMP_E:84, CURB_RAMP_S:85, CURB_RAMP_W:86,
  DRAIN_GRATE:87, CURB_INLET_N:88, CURB_INLET_E:89, CURB_INLET_S:90, CURB_INLET_W:91,
  CROSSWALK_X:92, CROSSWALK_Z:93,
  // --- SHAPED: roofs. Three material families, 18 pieces each (see SUB_ROOF_SETS).
  //     +0..7   shallow slope halves, N/E/S/W, low then high
  //     +8..15  hip corner halves, NE/SE/SW/NW, low then high
  //     +16,17  ridge caps along X and along Z
  ROOF_A:94, ROOF_B:112, ROOF_C:130,
  // --- SHAPED: eaves ---------------------------------------------------------------
  FASCIA_N:148, FASCIA_E:149, FASCIA_S:150, FASCIA_W:151,
  GUTTER_N:152, GUTTER_E:153, GUTTER_S:154, GUTTER_W:155,
  DOWNSPOUT:156, RAKE_X:157, RAKE_Z:158, SOFFIT_PANEL:159,
  // --- SHAPED: openings -------------------------------------------------------------
  WIN_X:160, WIN_Z:161, WIN_WIDE_X:162, WIN_WIDE_Z:163, SHUTTER_X:164, SHUTTER_Z:165,
  DOOR_A_X:166, DOOR_A_Z:167, DOOR_B_X:168, DOOR_B_Z:169, DOOR_C_X:170, DOOR_C_Z:171,
  GARAGE_X:172, GARAGE_Z:173, GABLE_VENT_X:174, GABLE_VENT_Z:175,
  // --- SHAPED: porch / structure ----------------------------------------------------
  POST:176, COLUMN:177, RAIL_X:178, RAIL_Z:179,
  STEP_N:180, STEP_E:181, STEP_S:182, STEP_W:183,
  BELT_COURSE:184, PORCH_LIGHT_X:185, PORCH_LIGHT_Z:186,
  // --- SHAPED: landscaping ----------------------------------------------------------
  PICKET_X:187, PICKET_Z:188, PICKET_POST:189, PRIVACY_X:190, PRIVACY_Z:191,
  HEDGE_TALL:192, HEDGE_LOW:193, SHRUB:194, FLOWERS:195, TREE_TRUNK:196,
  TREE_CANOPY:197, AC_UNIT:198,
  // --- SHAPED: street furniture -----------------------------------------------------
  BIN:199, DOORMAT:200, LAMP_POST:201, LAMP_ARM_N:202, LAMP_ARM_E:203, LAMP_ARM_S:204,
  LAMP_ARM_W:205, MAILBOX_X:206, MAILBOX_Z:207, HYDRANT:208, UTIL_POLE:209,
  CROSSARM_X:210, CROSSARM_Z:211, WIRE_X:212, WIRE_Z:213, SIGN_POST:214, SIGN_X:215,
  SIGN_Z:216, STOP_SIGN:217, CHIMNEY_CAP:218, ROOF_VENT:219,

  /* =================================================================================
     PHASE 16 — THE SHATTERED FARMLANDS AGRICULTURAL VOCABULARY (220-241).

     Same two families as Phase 13: ordinary full cubes with new atlas tiles for the
     ground, and SHAPED pieces (see SUB_SHAPE_DEF) for everything that stands up out of
     it. The shaped pieces matter more here than they did in the suburb, because they
     REPLACE the per-stalk THREE.Group decor the finite pocket used. A withered crop is
     now voxel data: it streams with its chunk, frees with its chunk, needs no disposal
     path, allocates no geometry and no material, and cannot leak. An infinite field of
     crops was the single largest scaling hazard in the old implementation and it is
     answered here, not managed.

     All of these are sky-passable (light: true) apart from the two canopies. That is
     load-bearing: a field of crops that cast skylight columns would darken the whole
     Rotting Fields to light level 0, which would change both the Sanity drain and the
     torch-decay zone test. Crops are thin; the sky goes straight through them. */
  // --- Ground materials (full cubes) -----------------------------------------------
  FARM_TRACK:220, FARM_RUT:221, DEAD_EARTH:222, TILLED_X:223, TILLED_Z:224,
  DITCH_MUD:225, ORCHARD_CANOPY:226, HEDGEROW:227,
  // --- Shaped: standing vegetation and field furniture -----------------------------
  WITHERED_CROP:228, CROP_TALL:229, STUBBLE:230, DRY_TUSSOCK:231, REEDS:232,
  HAY_BALE:233, FARM_FENCE_X:234, FARM_FENCE_Z:235, FENCE_POST:236,
  DEAD_SAPLING:237, FARM_STONE_X:238, FARM_STONE_Z:239, TROUGH:240, SCARECROW:241,

  /* =================================================================================
     PHASE 17 — RURAL ARCHITECTURE AND LANDMARKS (242-283).

     The suburb's mass -> shell -> roof pipeline is reused wholesale for Farmlands
     buildings, so this block does NOT re-invent walls, roofs, eaves, soffits, gutters,
     doors or windows — all of those already exist and already work on any rectangular
     mass at any base height. What is missing is RURAL MATERIAL and RURAL FURNITURE: a
     barn is not a house with different paint, it is board-and-batten over a fieldstone
     footing under a corrugated gambrel, and a graveyard is unreadable without stones
     that are visibly hand-cut and uneven.

     Sidings here are deliberately NOT registered in SIDE_LINED. _subStampShell falls
     back to plain siding when a material has no lined variant, which is correct for
     these: a barn's interior IS bare board, and skipping the lining also means Phase 17
     allocates no dynamic shape ids and therefore cannot shift a single Suburbia id.

     WHY 1200 AND NOT 242. The obvious next free id after Phase 16 is 242, and that is
     wrong: _furnNextId starts at 256 and Phase 14 allocates interior furniture upward
     from there, currently reaching 911. Ids 256-286 were therefore claimed twice, and
     furniture registration silently overwrote thirty-one Phase 17 blocks — caught by a
     break-time spot check reporting a headstone at 0.9s instead of 6.0s. Raising
     _furnNextId would have shifted every furniture id and rewritten Suburbia's chunk
     data, so Phase 17 sits ABOVE the dynamic range instead, with ~290 ids of headroom
     before it and 800 after. BLOCK_ID_COUNT is 2048 and chunk data is Uint16Array, so
     the sparseness costs nothing. */
  // --- Rural cladding, footing and roofing (full cubes) -----------------------------
  BARN_RED:1200, BARN_WHITE:1201, FARM_CLAPBOARD:1202, FIELDSTONE:1203,
  CORRUGATED:1204, SILO_TILE:1205, LOFT_HAY:1206, ROT_PLANK:1207, GRAVE_SOIL:1208,
  CHAPEL_STONE:1209,
  // --- Structural timber (shaped) ---------------------------------------------------
  BEAM_X:1210, BEAM_Z:1211, POST_TIMBER:1212, RAFTER_X:1213, RAFTER_Z:1214, LADDER_N:1215,
  LADDER_S:1216, LADDER_E:1217, LADDER_W:1218,
  // --- Openings and boundaries (shaped) ---------------------------------------------
  BARN_DOOR_X:1219, BARN_DOOR_Z:1220, FIELD_GATE_X:1221, FIELD_GATE_Z:1222,
  WIN_BOARDED:1223, WIN_BROKEN:1224,
  // --- The well ----------------------------------------------------------------------
  WELL_RIM:1225, WELL_POST:1226, WELL_WINCH:1227,
  // --- Abandoned equipment (shaped) -------------------------------------------------
  CRATE:1228, BARREL:1229, SACK_PILE:1230, TRACTOR_BODY:1231, TRACTOR_WHEEL:1232,
  WAGON_BED:1233, WHEEL_SPOKE:1234, PLOUGH:1235, HAND_TOOLS:1236,
  // --- Landmarks ---------------------------------------------------------------------
  HEADSTONE_ROUND:1237, HEADSTONE_SLAB:1238, HEADSTONE_CROSS:1239, GRAVE_MARKER:1240,
  CHAPEL_PEW:1241, CHAPEL_BELL:1242, MEMORIAL:1243, SILO_CONE:1244,
  /* A FOURTH ROOF FAMILY, 1245-1262. The suburb's three are asphalt and slate, which
     is wrong on a barn — agricultural roofs are corrugated sheet, and the ribbed
     silhouette is half of why a barn reads as a barn. _subStampRoof indexes a family
     as base+0..17, so a roof material CANNOT be an ordinary cube: passing CORRUGATED
     directly made every slope piece resolve to a garbage id, which is exactly what an
     isolated archetype render caught. Registered through the same roofSet() helper as
     the other three, so it inherits the whole eave/soffit/fascia/gutter pipeline. */
  ROOF_TIN:1245,

  /* =================================================================================
     PHASE 18 — RURAL SIGNAGE (1300-1363).

     Signs are the only new VOXEL vocabulary this phase needs. The animals are scene
     entities (see FarmAnimalManager) and the water tower is assembled entirely from
     Phase 16/17 pieces — timber posts, corrugated sheet, a silo cap and a ladder — so
     nothing here is spent on geometry that already exists.

     WHY A NAME IS A BLOCK ID. A readable sign needs LETTERING, and the renderer has
     exactly one material and one atlas: there is no per-object texture and there must
     not be one, because a sign that allocated a canvas would reintroduce precisely the
     per-decor material leak Phase 16 removed from the crops. So the destination
     vocabulary is CLOSED and small, its lettering is baked into the shared atlas at
     load exactly like every other surface, and a named board is an ordinary entry in
     chunk.data. Signs stream, free, collide and persist through editedChunks with
     everything else, and cost no allocation of any kind at run time.

     FOUR IDS PER NAME, not eight. A board is two cells wide and carries its text on
     BOTH faces, so the halves have to swap between the two sides — the half that reads
     first from the north reads second from the south. Rather than a facing per side,
     each cell carries two lettered plates (one per outward face) whose tiles are
     already the correct half for a reader on that side. That leaves only the run axis
     and which end of the run a cell sits at:
       +0 run along X, lower-x cell    +1 run along X, upper-x cell
       +2 run along Z, lower-z cell    +3 run along Z, upper-z cell */
  SIGN_POST:1300, SIGN_BLANK_X:1301, SIGN_BLANK_Z:1302,
  SIGN_ARROW_XP:1303, SIGN_ARROW_XN:1304, SIGN_ARROW_ZP:1305, SIGN_ARROW_ZN:1306,
  MAILBOX:1307,
  /* The lettered boards. FARM_SIGN_NAMES.length * 4 ids from here; the registration
     loop asserts it stays inside the 1320..1399 window it is given. */
  SIGN_TEXT_BASE:1320,

  /* =================================================================================
     PHASE 19 — FARMLANDS ECOLOGY AND WATER (1400-1433).

     Thirty-four ids, and the budget was spent on the two things statistics could not
     fake: GROUND that differs because the land was used differently, and DETAIL that
     accumulates where detail actually accumulates. Everything else this phase needed —
     tractors, ploughs, barrels, gates, wells, troughs, silos, water towers — already
     exists from Phase 17 and is REUSED rather than reinvented, which is why a phase
     this wide costs so few new blocks.

     WATER_SHALLOW is the single most load-bearing id here. Depth as a second block id
     rather than as per-cell metadata means the mesher, the collision test, the player
     controller and the flow simulation all read it for free out of chunk.data, it
     streams and persists through editedChunks like any other block, and — critically —
     it gives every pond a wadeable rim by construction. See _farmCache: terrain steps
     are one block, so a depth-2 pool ALWAYS has a depth-1 ring around it, and that ring
     is what the player walks out through. The escape guarantee is geometric, not a
     special case bolted onto the controller. */
  // --- Ground states (full cubes) ---------------------------------------------------
  SOIL_DRY:1400, SOIL_EXHAUSTED:1401, SOIL_FERTILE:1402, SOIL_TRAMPLED:1403,
  SOIL_WET:1404, FARM_MUD:1405, SOIL_OVERGROWN:1406, ASH_GROUND:1407, TIRE_TRACK:1408,
  // --- Water depth -------------------------------------------------------------------
  WATER_SHALLOW:1409,
  // --- Foreground debris (shaped, noclip, sky-passable) ------------------------------
  SMALL_STONES:1410, STICKS:1411, LEAF_LITTER:1412, WEED_CLUMP:1413, BROKEN_WOOD:1414,
  CROP_FLAT:1415, ASH_DRIFT:1416,
  // --- Burnt ecology ------------------------------------------------------------------
  BURNT_STUMP:1417, DEADWOOD_X:1418, DEADWOOD_Z:1419, CHARRED_BRANCH:1420,
  // --- Fence deterioration states ----------------------------------------------------
  FENCE_OLD_X:1421, FENCE_OLD_Z:1422, FENCE_LEAN_X:1423, FENCE_LEAN_Z:1424,
  FENCE_BROKEN_X:1425, FENCE_BROKEN_Z:1426, POST_BROKEN:1427,
  // --- Rural infrastructure ------------------------------------------------------------
  UTILITY_POLE:1428, POLE_ARM:1429, CULVERT_X:1430, CULVERT_Z:1431, WATER_PUMP:1432,
  MARKER_STONE:1433,

  /* =================================================================================
     PHASE 20 — THE JOURNEY WATER TOWER (1434-1447).

     FOURTEEN IDS, AND THIRTEEN OF THEM EXIST FOR ONE STRUCTURE. That is deliberate and
     it is the whole difference between the Phase 18 water tower and this one. Phase 18
     assembled a ten-block tower out of timber posts and corrugated sheet because it
     needed a second tall silhouette and a referent for a sign; Phase 20 needs a
     landmark a player can steer by from a quarter of a kilometre away and still
     recognise standing underneath, and a thirty-seven-block structure built out of
     fence posts reads as scaffolding.

     So the legs are their own heavy section, the tank is its own riveted plate with a
     rib band, the dome is a real cap rather than a stack of shrinking cubes, and the
     catwalk, riser and valve are the pieces that make it read as WATER infrastructure
     rather than as a tall thing. Everything else the facility needs — fieldstone
     footings, corrugated sheet, ladders, a pump house, a service track — is Phase
     16/17/19 vocabulary, reused.

     THE LAMP IS A BLOCK, AND THE LIGHT IS NOT. TOWER_LAMP is the physical housing at
     the top of the mast and it is always there, dark, in chunk data. What flashes is a
     scene sprite (see VoxelWorld._farmTowerBeacon / updateFarmTowerLight), because the
     anomaly has to react to where the player is LOOKING and a voxel cannot. Keeping the
     housing in the world and the emission outside it also means the flash costs no
     remesh, ever. */
  TOWER_LEG:1434, TOWER_BRACE_X:1435, TOWER_BRACE_Z:1436, TOWER_TANK:1437,
  TOWER_TANK_RIB:1438, TOWER_DOME:1439, TOWER_MAST:1440, TOWER_LAMP:1441,
  CATWALK_X:1442, CATWALK_Z:1443, RISER_PIPE:1444, PIPE_X:1445, PIPE_Z:1446,
  VALVE_WHEEL:1447,

  /* THE ONLY WINDOW IN THE GAME YOU CAN ACTUALLY SEE THROUGH (1448-1449).

     Every window in Suburbia and the Farmlands puts its pane in the OPAQUE pass on a
     dark reflective tile, which is deliberate and right: it is how a real house reads
     from outside under overcast, and it is why you cannot look into a farmhouse from the
     yard. Phase 13's mesher left the routing for a genuinely transparent pane in place
     anyway (see _buildGlassMesh's own comment: "so a later phase can add a genuinely
     transparent pane without touching the mesher again") and this is that phase.

     It exists for exactly one window: the one in the basement of the Disconnected Home
     that looks out on six cells of Static Suburbia. Rendered with an ordinary pane that
     window was a black rectangle in a wall — a well-made frame with nothing behind it —
     which is the single beat in this phase that has to be SEEN to mean anything. */
  WIN_CLEAR_X:1448, WIN_CLEAR_Z:1449,

  /* =================================================================================
     PHASE 20 REVISION — THE LANDMARK CHAIN (1450-1459).

     The first playtest found the systems working and the COMPOSITION not: the Farmlands
     still read as a procedural grid of roads with destinations on it rather than as one
     authored rural chapter. The fix is a chain of landmarks at escalating scale strung
     along a single main road, and these are the pieces that chain needs which nothing in
     Phases 16-20 already has.

     THE GREAT TREE IS WHY MOST OF THESE EXIST. It has to be, by a wide margin, the
     largest object anywhere in the region — wider than the water tower is tall — and it
     has to read as LUSH against dead ground. Every piece of tree vocabulary this
     dimension owns is the opposite of that: ASH_WOOD and BLACK_CANOPY make a four-block
     dead sapling in near-black. A forty-block tree built out of them would be a big dead
     tree, which is a completely different image and the wrong one.

     GREAT_LEAF IS LIGHT-PASSABLE, like LEAVES and unlike BLACK_CANOPY. A fifty-block
     canopy that cast a skylight column would put a disc of true darkness a hundred
     blocks across under the one thing in the dimension that is supposed to look alive,
     and would drag the torch-decay zone test and the Sanity light term along with it.
     Dappled shade is both the better image and the cheaper one. */
  GREAT_BARK:1450, GREAT_LEAF:1451, GREAT_ROOT_X:1452, GREAT_ROOT_Z:1453,
  GREAT_LIMB_X:1454, GREAT_LIMB_Z:1455, GREAT_LIMB_Y:1456,
  // The fallen tower's ruptured plate, and the ground the great tree has killed.
  TANK_TORN:1457, ROTTEN_GROUND:1458, ROTTEN_STUBBLE:1459
};

const BLOCK_COLOR = {
  1: [0x4f8a3a, 0.35], 2: [0x6b4423, 0.25], 3: [0x8a8a8a, 0.20],
  4: [0x6e4a28, 0.30], 5: [0x357a34, 0.30], 6: [0xffb35c, 0.15],
  7: [0x5a1230, 0.30], 8: [0x160608, 0.35], 9: [0xffcf6b, 0.40],
  10: [0x8a8a8a, 0.20], 12: [0xc9a98a, 0.22], 13: [0x180a24, 0.18],
  18: [0x5a3a1a, 0.20],
  19: [0x4A4A52, 0.18], 20: [0x6B524B, 0.22],
  // Rotted Soil: dark decayed farmland dirt with a sickly olive undertone.
  21: [0x342f22, 0.24],
  // Ash Wood: charred, near-black trunk.
  22: [0x241c14, 0.20],
  // Black Canopy: dense near-black foliage that reads almost as a silhouette.
  23: [0x121510, 0.28],
  // Lantern: warm brass housing tinted toward its steady #FFCC66 glow.
  24: [0xFFCC66, 0.12],
  // Soul Anchor: dark corrupted stone base with a faint teal soul-glow undertone.
  25: [0x2c3f3c, 0.18],
  // Asphalt: dark, flat, faintly speckled road surface.
  26: [0x2b2b2e, 0.14],
  // Concrete: pale, flat sidewalk slab.
  27: [0xb8b6ae, 0.10],
  // LEVEL 4 — Polished Oak: warm honey floorboards, low jitter so they read as
  // sanded and cared-for rather than rough overworld timber.
  28: [0xc08e50, 0.10],
  // LEVEL 4 — Haven Glass: near-white pane tint (the transparent material below
  // does the real work; this entry only exists to keep the atlas indices aligned).
  29: [0xdff0ff, 0.04],
  // LEVEL 4 — Haven Barrier: never rendered, color is a placeholder only.
  30: [0x000000, 0.0],
  /* PHASE 9 — Suburbia pastel siding. Low jitter on purpose: these are painted
     clapboard walls, and heavy per-pixel noise would read as stone. */
  31: [0xE8A9AE, 0.05], 32: [0xA9D6BC, 0.05], 33: [0xEFDCA0, 0.05],
  34: [0xA9C8DE, 0.05], 35: [0xEFC0A0, 0.05], 36: [0xE6DFCB, 0.05],
  // Roof shingle: warm grey-brown, higher jitter so it reads as coarse tile.
  37: [0x6B6259, 0.18],
  // PHASE 10 — Haven hearth brick and floor rug.
  38: [0x9C4B38, 0.14], 39: [0xB2413C, 0.10]
};
// Blocks excluded from the standard opaque atlas mesh pass (handled with dedicated materials)
// HAVEN_GLASS gets its own transparent geometry pass (_buildGlassMesh); HAVEN_BARRIER
// gets no pass at all, which is precisely how it stays invisible while still solid.
const SPECIAL_RENDER_BLOCKS = new Set([BLOCK.TORCH, BLOCK.WATER, BLOCK.WATER_SHALLOW,
                                      BLOCK.HAVEN_GLASS, BLOCK.HAVEN_BARRIER]);
/* PHASE 19 — the two liquid ids, in one place, because eight separate call sites need
   to ask "is this water" and none of them should ever ask it as `id === BLOCK.WATER`
   again. Every one of those was a place shallow water would have behaved like stone. */
function isWaterId(id) { return id === BLOCK.WATER || id === BLOCK.WATER_SHALLOW; }

/* =====================================================================================
   PHASE 14 — THE BLOCK ID SPACE

   Phase 13 finished at id 219 with thirty-six spare. A furniture vocabulary of twenty-odd
   pieces, each sliced into per-cell shapes and compiled into four facings, needs several
   hundred — so the id is widened from a byte to a sixteen-bit word and chunk.data becomes
   a Uint16Array (see the Chunk class).

   THAT IS THE ENTIRE CHANGE. Nothing else about a block id changes: every read, write,
   comparison, edit record, mesh path, collision test and persistence path is untouched,
   because all of them already treat an id as an ordinary number. The cost is that a
   resident chunk's voxel data goes from 16 KB to 32 KB — about 10 MB across the whole
   unload radius instead of 5 MB — which buys an interior system that streams and frees
   with no new machinery whatsoever.

   Ids 220-255 are deliberately left free for future non-interior blocks; Phase 14
   allocates from 256 upward.
   ===================================================================================== */
const BLOCK_ID_COUNT = 2048;

/* Per-block brightness trim. Interiors are enclosed, so the skylight bake gives them
   nothing and every surface lands on the engine's hard light floor of 8/15 — which is
   readable but flat and gloomy, and "poor lighting" is exactly the failure this phase is
   meant to fix. Rather than raise the global floor (which would wash out caves), the
   interior materials and every piece of furniture carry a multiplier applied at mesh
   time. Nothing outside a Suburbia house uses these blocks, so nothing else moves. */
const BLOCK_SHADE_BOOST = new Float32Array(BLOCK_ID_COUNT).fill(1);
const INTERIOR_SHADE_BOOST = 1.30;

// Functional-door tuning. The state map is bounded on purpose: see the door system.
const DOOR_STATE_CAP = 512;      // remembered open doors, oldest evicted
const DOOR_SWING_POOL = 4;       // animated leaves alive at once, ever
