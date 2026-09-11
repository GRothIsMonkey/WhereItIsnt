"use strict";
/* =====================================================================================
   THE OBJECTIVE TABLES — WHAT THE LINE SAYS, AND WHEN
   ERA 1.5.2 — EXTRACTED VERBATIM FROM game.html.

   The four chain ids, the tick interval, the priority overrides and the four chains
   themselves. Pure data with pure predicates: every `when(s)` and `done(s)` is a
   function of one snapshot object and reads no global state, no world and no DOM.

   THE OBJECTIVE SYSTEM IS NOT HERE. ObjectiveSystem — which holds the cursor, resolves
   the line and decides when to repaint — is still in game.html. This file is the table
   it reads. That separation is the point: a data table that quietly executes progression
   is not a data table.

   NO LINE HERE MAY NAME A DESTINATION THE PLAYER HAS NOT REACHED. STORY.md's section on
   player-facing language, asserted by tests/objectives.js and tests/story.js.

   CLASSIC script, one shared global lexical scope, load order declared in game.html.
   See ARCHITECTURE.md and src/progression/LAYER.md.
   ===================================================================================== */

/* Which chain is running. Deliberately the same vocabulary the save file uses. */
const OBJECTIVE_CHAIN_IDS = ['overworld', 'farmlands', 'suburbia', 'haven'];

/* Seconds between evaluations. Objectives move on the scale of minutes; four times a
   second is already far more responsive than the thing being described. */
const OBJECTIVE_TICK = 0.25;

/* ---------------------------------------------------------------------------------
   SITUATIONAL OBJECTIVES — evaluated in this order, first match wins.

   `text: null` is a real answer and means "show nothing": the Haven after it turns, and
   the climax, are both places where an objective on screen would be an intrusion.
   --------------------------------------------------------------------------------- */
const OBJECTIVE_OVERRIDES = [
  /* The finale takes the screen. Nothing is asked of the player here, and Phase 33/34
     own everything past this point. */
  { id: 'climax', text: null, when: (s) => s.climax },

  /* THE HAVEN. One word while it is intact, and nothing at all once it turns. STORY.md
     section 18: the safety must be real, so the objective must not hedge. */
  { id: 'haven_rest', text: 'Rest.', when: (s) => s.haven && !s.havenShifted && !s.havenEnding },
  /* PHASE 32 — and nothing from the moment it starts to go. The line clears BEFORE the
     shift, not at it: the dissolution is twenty-six seconds long and an objective is the
     one thing on screen that could still be read as the game having a plan for the
     player. It does not. */
  { id: 'haven_after', text: null, when: (s) => s.haven },

  /* A POWERED RIFT OUTRANKS EVERYTHING. It is the one thing in the game that is both
     unmistakable and time-insensitive, and a player who has opened one and wandered off
     should be told what is waiting, not what they were doing an hour ago. */
  { id: 'enter_rift', text: 'Enter the Rift.', when: (s) => s.riftActive },

  /* Carrying a Core Disk with no rift open. The Anchor is where it goes; the line says
     where, and nothing about why.

     PHASE 35 — SPLIT IN TWO, BECAUSE THE ANCHOR IS NOT ALWAYS THERE. An Anchor is a
     block standing in one dimension, and it does not cross with the player (see
     Game._leaveDimension). So a player who walks out of the Farmlands' Disconnected Home
     holding the Level 2 Disk has, correctly, no Anchor anywhere — and "Bring it to the
     Anchor." was then pointing at a thing that did not exist, in the dimension where it
     matters most. The second line names the missing half instead. It explains no
     mechanic and names no key: the player raised one in the Overworld to survive their
     first night, so they already know what raising one means. */
  { id: 'bring_disk', text: 'Bring it to the Anchor.',
    when: (s) => s.hasDisk && !s.riftActive && s.hasAnchor && (s.overworld || s.farmlands) },
  { id: 'raise_anchor', text: 'Raise an Anchor.',
    when: (s) => s.hasDisk && !s.riftActive && !s.hasAnchor && (s.overworld || s.farmlands) },

  /* NIGHT. Two lines, and which one shows depends on where the player is standing: if
     they have an Anchor and are outside its glow, the useful sentence is where to go. */
  { id: 'return_anchor', text: 'Return to the Anchor.',
    when: (s) => s.night && s.hasAnchor && !s.inAnchorZone && !s.farmlands && !s.suburbia },
  { id: 'survive_night', text: 'Survive until dawn.',
    when: (s) => s.night && !s.farmlands && !s.suburbia },
];

/* ---------------------------------------------------------------------------------
   THE CHAINS.

   `done(s)` is a completion test, not an event. It is asked repeatedly and may become
   true at any time, including before the step was ever shown — which is exactly how a
   player who did things out of order gets credited for them.
   --------------------------------------------------------------------------------- */
const OBJECTIVE_CHAINS = {
  /* THE OVERWORLD — the survival spine. Deliberately the shortest useful set of words at
     each step. PHASE 28: these lines are now the PRIMARY onboarding. Nothing explains
     crafting in advance any more — this chain asks for a tool, the cue above the hotbar
     names the key once, and the world explains everything else. */
  overworld: [
    { id: 'gather_wood',  text: 'Gather wood.',            done: (s) => s.hasWood || s.hasTool },
    { id: 'craft_tool',   text: 'Craft a basic tool.',     done: (s) => s.hasTool },
    { id: 'find_coal',    text: 'Find coal.',              done: (s) => s.hasCoal || s.hasTorch },
    { id: 'craft_torch',  text: 'Craft torches.',          done: (s) => s.hasTorch },
    { id: 'prepare',      text: 'Prepare for night.',      done: (s) => s.hasAnchor },
    /* One line covering the long middle of the Overworld: survive, build, and be there
       when the thing that carries the first Core Disk turns up. It never mentions the
       Behemoth, because the player has not met it yet. */
    { id: 'endure',       text: 'Endure the nights.',      done: (s) => s.hasDisk || s.riftActive || !s.overworld },
    { id: 'rift',         text: 'Investigate the Rift.',   done: (s) => !s.overworld },
  ],

  /* THE SHATTERED FARMLANDS — the Phase 20 journey lines, unchanged.

     These were written against requirement 74 and re-endorsed by STORY.md section 21 as
     the model every objective in the game should follow: each one describes something the
     player can already see, the property is never called a house until they are close
     enough to recognise one, and nothing points anywhere. They are thresholds on the
     journey ordinal, which is monotonic and already saved, so this chain needs no
     high-water mark of its own. */
  farmlands: [
    { id: 'farm_core',    text: 'Investigate the farmhouse.', when: (s) => s.farmCoreTaken, struck: true },
    { id: 'farm_house',   text: 'Investigate the farmhouse.', when: (s) => s.farmHouseSeen },
    { id: 'farm_home',    text: 'Investigate the property.',  when: (s) => s.farmOrd >= FARM_J_HOME },
    /* PHASE 25 DEFECT FIX. These two thresholds were both 22 (FARM_J_TREE - 3 and
       FARM_J_ECHO0 + 2 are the same parcel), and because the route line was tested first,
       "The fields are dying." could never appear at any ordinal — an authored Phase 20
       line the player could not reach. The dead land belongs to the great tree at
       FARM_J_TREE, so it moves to just before it and both lines are now reachable. */
    { id: 'farm_dying',   text: 'The fields are dying.',      when: (s) => s.farmOrd >= FARM_J_TREE - 1 },
    { id: 'farm_route',   text: 'Follow the old route.',      when: (s) => s.farmOrd >= FARM_J_ECHO0 + 2 },
    { id: 'farm_echo',    text: 'Something here feels familiar.', when: (s) => s.farmOrd >= FARM_J_ECHO0 },
    { id: 'farm_barn',    text: 'Keep to the road.',          when: (s) => s.farmOrd >= FARM_J_BARN - 2 },
    { id: 'farm_beyond',  text: 'Continue beyond the tower.', when: (s) => s.farmOrd > FARM_J_TOWER + 1 },
    { id: 'farm_tower',   text: 'Investigate the water tower.', when: (s) => s.farmOrd >= FARM_J_TOWER - 3 && s.farmTower },
    { id: 'farm_east',    text: 'Follow the road east.',      when: (s) => s.farmOrd >= FARM_J_FALLEN - 1 },
    { id: 'farm_road',    text: 'Follow the old farm road.',  when: (s) => s.farmOrd >= 1 },
    { id: 'farm_arrive',  text: 'Explore the Shattered Farmlands.', when: () => true },
  ],

  /* STATIC SUBURBIA — the guidance gets less certain as the place does.

     Nothing here is bound to a room, a house index or a generated coordinate: the suburb
     rearranges itself when nobody is looking, so anything positional would be a bug
     waiting for a player to stand still. The tests are a count of houses entered and the
     one stable chest key. */
  suburbia: [
    { id: 'sub_explore',  text: 'Explore the neighbourhood.', done: (s) => s.subVisits >= 1 },
    { id: 'sub_houses',   text: 'Investigate the houses.',    done: (s) => s.subVisits >= 4 },
    /* Deliberately vague, and deliberately NOT a mechanic. Nothing is highlighted,
       outlined or marked. The player's own attention is the instrument. */
    { id: 'sub_wrong',    text: "Find what doesn't belong.",  done: (s) => s.subCoreTaken },
    { id: 'sub_keep',     text: 'Keep going.',                done: () => false },
  ],

  haven: [],
};
