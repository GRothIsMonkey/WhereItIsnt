"use strict";
/* =====================================================================================
   ITEM IDS, ITEM DATA AND THE CRAFTING RECIPE TABLE
   ERA 1.5.1 — EXTRACTED VERBATIM FROM game.html.

   Pure frozen data. An item id is a save-file value: APPEND, NEVER INSERT.

   This is a CLASSIC script, not an ES module. It shares one global lexical scope with
   every other file in src/ and with game.html's inline <script>, which is why the move
   needed no code change. Load order is declared in game.html and mirrored by
   tests/harness/load.js; see ARCHITECTURE.md.
   ===================================================================================== */

const ITEM = {
  NONE: 0,
  GRASS: 1, DIRT: 2, STONE: 3, OAK_LOG: 4, LEAVES: 5, TORCH: 6,
  COBBLESTONE: 7, SAPLING: 8, STICK: 9, SEED: 10, WOOD_PLANK: 11,
  STONE_PICKAXE: 12, SAFEHOUSE_ANCHOR: 13, COAL: 14,
  WOODEN_SWORD: 15, STONE_SWORD: 16, IRON_ORE: 17, IRON_INGOT: 18, IRON_PICKAXE: 19,
  BONE: 20, STRING: 21, OBSIDIAN: 22,
  VOID_SHIELD: 25, WATER_BUCKET: 27, BOW: 28, ARROW: 29, IRON_SWORD: 30,
  TREASURE_CHEST: 31, WOODEN_PICKAXE: 32, WOODEN_AXE: 33, STONE_AXE: 34, IRON_AXE: 35,
  CORE_DISK: 36,
  // PHASE 4B — advanced Level 2 craftables & the Level 3 dimension key.
  CORRUPTED_STONE_ITEM: 37, CORE_DISK_L2: 38, LANTERN: 39, SOUL_ANCHOR: 40,
  // PHASE 5A PART 2 — the Level 4 dimension key, recovered from Static Suburbia's
  // own Disconnected Home.
  CORE_DISK_L3: 41,
  /* PHASE 35 — ASH LOG. Appended, never inserted: an id is a save-file value and every
     number in this table has to keep meaning what it meant. See below for why the
     Farmlands needed a wood the player can actually pick up. */
  ASH_LOG: 42
};

const ITEM_DATA = {
  [ITEM.GRASS]: { name: 'Grass Block', isBlock: true, blockId: 1, color: '#4f8a3a' },
  [ITEM.DIRT]: { name: 'Dirt', isBlock: true, blockId: 2, color: '#6b4423' },
  [ITEM.STONE]: { name: 'Stone', isBlock: true, blockId: 3, color: '#8a8a8a' },
  [ITEM.OAK_LOG]: { name: 'Oak Log', isBlock: true, blockId: 4, color: '#6e4a28' },
  [ITEM.LEAVES]: { name: 'Leaves', isBlock: true, blockId: 5, color: '#357a34' },
  [ITEM.TORCH]: { name: 'Torch', isBlock: true, blockId: 6, color: '#ffb35c' },
  [ITEM.COBBLESTONE]: { name: 'Cobblestone', isBlock: true, blockId: 3, color: '#737373' },
  [ITEM.SAPLING]: { name: 'Sapling', isBlock: false, color: '#44aa44' },
  [ITEM.STICK]: { name: 'Stick', isBlock: false, color: '#a07040' },
  [ITEM.SEED]: { name: 'Seed', isBlock: false, color: '#88bb44' },
  [ITEM.WOOD_PLANK]: { name: 'Wood Plank', isBlock: true, blockId: 4, color: '#b58a59' },
  [ITEM.STONE_PICKAXE]: { name: 'Stone Pickaxe', isBlock: false, color: '#aaaaaa' },
  [ITEM.SAFEHOUSE_ANCHOR]: { name: 'Anchor Monument', isBlock: true, blockId: 9, color: '#ffcf6b' },
  [ITEM.COAL]: { name: 'Coal', isBlock: false, color: '#2b2b2b' },
  [ITEM.WOODEN_SWORD]: { name: 'Wooden Sword', isBlock: false, color: '#b58a59', isWeapon: true, damage: 4, knockback: 5 },
  [ITEM.STONE_SWORD]: { name: 'Stone Sword', isBlock: false, color: '#9a9a9a', isWeapon: true, damage: 7, knockback: 7 },
  [ITEM.IRON_ORE]: { name: 'Iron Ore', isBlock: true, blockId: 12, color: '#c9a98a' },
  [ITEM.IRON_INGOT]: { name: 'Iron Ingot', isBlock: false, color: '#e2ddd0' },
  [ITEM.IRON_PICKAXE]: { name: 'Iron Pickaxe', isBlock: false, color: '#e2ddd0' },
  [ITEM.BONE]: { name: 'Bone', isBlock: false, color: '#e8e2c8' },
  [ITEM.STRING]: { name: 'String', isBlock: false, color: '#dedede' },
  [ITEM.OBSIDIAN]: { name: 'Obsidian', isBlock: true, blockId: 13, color: '#180a24' },
  [ITEM.VOID_SHIELD]: { name: 'Void Shield', isBlock: false, color: '#3fc8ff' },
  [ITEM.BOW]: { name: 'Bow', isBlock: false, color: '#8a6238', isRangedWeapon: true, damage: 6 },
  [ITEM.ARROW]: { name: 'Arrow', isBlock: false, color: '#c9a98a' },
  [ITEM.IRON_SWORD]: { name: 'Iron Sword', isBlock: false, color: '#e2ddd0', isWeapon: true, damage: 10, knockback: 8 },
  [ITEM.TREASURE_CHEST]: { name: 'Ancient Chest', isBlock: true, blockId: 18, color: '#5a3a1a' },
  [ITEM.WOODEN_PICKAXE]: { name: 'Wooden Pickaxe', isBlock: false, color: '#b58a59', isPickaxe: true, pickaxeTier: 1 },
  [ITEM.WOODEN_AXE]: { name: 'Wooden Axe', isBlock: false, color: '#b58a59', isAxe: true, axeTier: 1 },
  [ITEM.STONE_AXE]: { name: 'Stone Axe', isBlock: false, color: '#9a9a9a', isAxe: true, axeTier: 2 },
  [ITEM.IRON_AXE]: { name: 'Iron Axe', isBlock: false, color: '#e2ddd0', isAxe: true, axeTier: 3 },
  [ITEM.CORE_DISK]: { name: 'Core Disk', isBlock: false, color: '#7effe8' },
  // PHASE 4B additions ------------------------------------------------------------
  [ITEM.CORRUPTED_STONE_ITEM]: { name: 'Corrupted Stone', isBlock: true, blockId: 7, color: '#8a3a6a' },
  [ITEM.CORE_DISK_L2]: { name: 'Level 2 Rift Core Disk', isBlock: false, color: '#b98cff' },
  // PHASE 5A PART 2 — recovered from Static Suburbia's own Disconnected Home.
  [ITEM.CORE_DISK_L3]: { name: 'Level 3 Rift Core Disk', isBlock: false, color: '#ffe066' },
  [ITEM.LANTERN]: { name: 'Lantern', isBlock: true, blockId: 24, color: '#FFCC66' },
  [ITEM.SOUL_ANCHOR]: { name: 'Soul Anchor', isBlock: true, blockId: 25, color: '#5be0c8' },
  /* PHASE 35 — THE FARMLANDS HAD NO WOOD A PLAYER COULD PICK UP.

     ASH_WOOD is in WOOD_BLOCKS, it takes an axe, the cue above the hotbar reads CHOP
     when you look at it, and the Ashen Forest is full of it — and destroyBlock dropped
     NOTHING for it, in any build. Nothing else in the dimension yields wood either.

     That was a soft lock rather than an oversight. An Anchor Monument costs four planks,
     the Anchor is what a Rift Core Disk is fed to, and the Anchor a player raised in the
     Overworld stays in the Overworld. So a player who crossed into the Farmlands without
     spare planks, found the Level 2 Rift Core Disk exactly where the game guarantees it,
     and then went looking for wood, could not open the rift and could not get any. The
     tree the game tells them to chop gave them a hole in the forest.

     It is deliberately its own item rather than a second source of Oak Log: an ashen
     trunk is not an oak, section 14 is about not lying to the player with a label, and
     the recipe table already knows how to turn either one into planks. */
  [ITEM.ASH_LOG]: { name: 'Ash Log', isBlock: true, blockId: 22, color: '#4c4239' }
};
ITEM_DATA[ITEM.STONE_PICKAXE].isPickaxe = true; ITEM_DATA[ITEM.STONE_PICKAXE].pickaxeTier = 2;
ITEM_DATA[ITEM.IRON_PICKAXE].isPickaxe = true; ITEM_DATA[ITEM.IRON_PICKAXE].pickaxeTier = 3;

/* PHASE 26 — THERE IS NO LEVEL GATE ON A RECIPE ANY MORE.
   Every recipe here used to carry a `levelReq`, and every one of those numbers was
   redundant: a recipe's real gate has always been its INGREDIENTS, and the ingredients
   are themselves discoveries. Iron needs ore, and ore is underground. String comes off a
   spider. Obsidian is deep. Corrupted Stone comes out of a Rift. "Requires Level 3" was
   an XP threshold standing in front of a material the player either had found or had
   not, so removing it takes nothing away — it hands the gate back to the world. */
const CRAFTING_RECIPES = [
  { id: 'planks', result: ITEM.WOOD_PLANK, count: 4, reqs: [{ item: ITEM.OAK_LOG, count: 1 }] },
  /* PHASE 35 — the same four planks out of the Farmlands' own timber, so the Anchor a
     Level 2 Rift Core Disk needs can be raised in the dimension that hands out the
     Disk. Same yield as oak: this is a second SOURCE, not a better one. */
  { id: 'ash_planks', result: ITEM.WOOD_PLANK, count: 4, reqs: [{ item: ITEM.ASH_LOG, count: 1 }] },
  { id: 'sticks', result: ITEM.STICK, count: 4, reqs: [{ item: ITEM.WOOD_PLANK, count: 2 }] },
  { id: 'torches', result: ITEM.TORCH, count: 4, reqs: [{ item: ITEM.STICK, count: 1 }, { item: ITEM.COAL, count: 1 }] },
  { id: 'wooden_pickaxe', result: ITEM.WOODEN_PICKAXE, count: 1, reqs: [{ item: ITEM.WOOD_PLANK, count: 3 }, { item: ITEM.STICK, count: 2 }] },
  { id: 'wooden_axe', result: ITEM.WOODEN_AXE, count: 1, reqs: [{ item: ITEM.WOOD_PLANK, count: 3 }, { item: ITEM.STICK, count: 2 }] },
  { id: 'pickaxe', result: ITEM.STONE_PICKAXE, count: 1, reqs: [{ item: ITEM.COBBLESTONE, count: 3 }, { item: ITEM.STICK, count: 2 }] },
  { id: 'stone_axe', result: ITEM.STONE_AXE, count: 1, reqs: [{ item: ITEM.COBBLESTONE, count: 3 }, { item: ITEM.STICK, count: 2 }] },
  { id: 'anchor', result: ITEM.SAFEHOUSE_ANCHOR, count: 1, reqs: [{ item: ITEM.WOOD_PLANK, count: 4 }] },
  { id: 'wood_sword', result: ITEM.WOODEN_SWORD, count: 1, reqs: [{ item: ITEM.STICK, count: 2 }, { item: ITEM.WOOD_PLANK, count: 2 }] },
  { id: 'stone_sword', result: ITEM.STONE_SWORD, count: 1, reqs: [{ item: ITEM.STICK, count: 1 }, { item: ITEM.COBBLESTONE, count: 2 }] },
  { id: 'arrow', result: ITEM.ARROW, count: 4, reqs: [{ item: ITEM.STICK, count: 1 }, { item: ITEM.STRING, count: 1 }] },
  { id: 'bow', result: ITEM.BOW, count: 1, reqs: [{ item: ITEM.STICK, count: 3 }, { item: ITEM.STRING, count: 3 }] },
  { id: 'iron_ingot', result: ITEM.IRON_INGOT, count: 1, reqs: [{ item: ITEM.IRON_ORE, count: 1 }, { item: ITEM.COAL, count: 1 }] },
  { id: 'iron_pickaxe', result: ITEM.IRON_PICKAXE, count: 1, reqs: [{ item: ITEM.IRON_INGOT, count: 4 }, { item: ITEM.STICK, count: 2 }] },
  { id: 'iron_axe', result: ITEM.IRON_AXE, count: 1, reqs: [{ item: ITEM.IRON_INGOT, count: 3 }, { item: ITEM.STICK, count: 2 }] },
  { id: 'iron_sword', result: ITEM.IRON_SWORD, count: 1, reqs: [{ item: ITEM.IRON_INGOT, count: 3 }, { item: ITEM.STICK, count: 1 }] },
  { id: 'void_shield', result: ITEM.VOID_SHIELD, count: 1, reqs: [{ item: ITEM.IRON_INGOT, count: 5 }, { item: ITEM.OBSIDIAN, count: 2 }] },
  // PHASE 4B — advanced Level 2 lighting & crafting tier.
  { id: 'lantern', result: ITEM.LANTERN, count: 1, reqs: [{ item: ITEM.IRON_INGOT, count: 4 }, { item: ITEM.TORCH, count: 1 }] },
  { id: 'soul_anchor', result: ITEM.SOUL_ANCHOR, count: 1, reqs: [{ item: ITEM.COAL, count: 1 }, { item: ITEM.CORRUPTED_STONE_ITEM, count: 1 }] }
];
