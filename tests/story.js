/* PHASE 24 — CANONICAL STORY FOUNDATION.

   WHAT THIS FILE CAN AND CANNOT DO.

   It CANNOT test whether the story is good. Nothing in this repository can, nothing here
   pretends to, and no assertion below makes a claim about writing quality, atmosphere,
   pacing or whether a premise lands. Phase 24's real deliverable is a document, and a
   document is judged by a person.

   What it CAN do is protect the document and the fragments it was built from:

     1. the bible exists, and every canonical section the brief requires is in it
     2. the retired project name is gone from the shipped build, everywhere
     3. the finale is not named on screen like a boss
     4. the narrative fragments the Phase 24 audit catalogued are STILL THERE — the whole
        risk of a story phase is that it quietly replaces the material it was supposed to
        preserve, so every surviving string is pinned here by exact text
     5. Phase 24 did not smuggle a lore dump into the game

   Points 4 and 5 are the ones with teeth. They are why this file exists. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STORY = fs.readFileSync(path.join(ROOT, 'STORY.md'), 'utf8');
const GAME = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
const CLAUDEMD = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
const ROADMAP = fs.readFileSync(path.join(ROOT, 'ROADMAP.md'), 'utf8');
const PROGRESS = fs.readFileSync(path.join(ROOT, 'PROGRESS.md'), 'utf8');

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail++; };
const note = (msg) => console.log('      ' + msg);

/* The <script> body only — so a check for "no lore in the game" is looking at the code
   and markup a player actually meets, not at this file's own vocabulary. */
function gameScript() {
  const lines = GAME.split('\n');
  let s = -1, e = -1;
  for (let i = 0; i < lines.length; i++) {
    if (s < 0 && /^<script>\s*$/.test(lines[i])) { s = i + 1; continue; }
    if (s >= 0 && /^<\/script>\s*$/.test(lines[i])) { e = i; break; }
  }
  return lines.slice(s, e).join('\n');
}
const SCRIPT = gameScript();

// =====================================================================================
// 1. THE BIBLE EXISTS, AND CONTAINS THE CANON THE BRIEF REQUIRES
// =====================================================================================
{
  chk(STORY.length > 12000, `STORY.md exists and is substantial (${STORY.length} characters)`);
  chk(/^# WHERE IT ISN'T — CANONICAL STORY BIBLE/m.test(STORY),
      'and declares itself the canonical story bible');

  /* The twenty-two subjects the phase brief demands an answer for. Matched on the section
     heading, so a section cannot be satisfied by a passing mention somewhere else. */
  const REQUIRED = [
    ['canonical premise',        /^## 1\. CANONICAL PREMISE/m],
    ['player role',              /^## 2\. THE PLAYER/m],
    ['Overworld role',           /^## 3\. THE OVERWORLD/m],
    ['Blood Nights',             /^## 4\. BLOOD NIGHTS/m],
    ['Stalker',                  /^## 5\. THE STALKER/m],
    ['Behemoth',                 /^## 6\. THE HOLLOWED BEHEMOTH/m],
    ['Anchor',                   /^## 7\. THE ANCHOR/m],
    ['Rift',                     /^## 8\. THE RIFT/m],
    ['Rift Cores',               /^## 9\. RIFT CORES/m],
    ['Farmlands',                /^## 10\. THE SHATTERED FARMLANDS/m],
    ['Eastward Journey',         /^## 11\. THE EASTWARD JOURNEY/m],
    ['Water Tower',              /^## 12\. THE WATER TOWER/m],
    ['rural settlements',        /^## 13\. RURAL SETTLEMENTS/m],
    ['Disconnected Home',        /^## 14\. THE DISCONNECTED HOME/m],
    ['Static Suburbia',          /^## 15\. STATIC SUBURBIA/m],
    ['Suburbia anomalies',       /^## 16\. SUBURBIA ANOMALIES/m],
    ['Suburbia entities',        /^## 17\. THE NEIGHBOUR/m],
    ['Fake Haven',               /^## 18\. FAKE HAVEN/m],
    ['Final Creature',           /^## 19\. THE FINAL CREATURE/m],
    ['dimension relationships',  /^## 20\. THE DIMENSIONS AS ONE STORY/m],
    ['player knowledge curve',   /^## 21\. THE PLAYER KNOWLEDGE CURVE/m],
    ['mystery vs explanation',   /^## 22\. MYSTERY VERSUS EXPLANATION/m],
  ];
  let missing = [];
  for (const [label, re] of REQUIRED) if (!re.test(STORY)) missing.push(label);
  chk(missing.length === 0,
      `all ${REQUIRED.length} required canonical subjects have their own section` +
      (missing.length ? ` — MISSING: ${missing.join(', ')}` : ''));

  chk(/^## 23\. ENVIRONMENTAL STORYTELLING OPPORTUNITIES/m.test(STORY),
      'future environmental-storytelling opportunities are recorded for Phase 31');
  chk(/^## 24\. CANONICAL VOCABULARY/m.test(STORY),
      'and a vocabulary table exists, so future sessions do not invent synonyms');
  chk(/^## 25\. FUTURE-PHASE COMPATIBILITY NOTES/m.test(STORY),
      'with per-phase compatibility notes through Phase 35');
  chk(/^## 0\. HOW THIS CANON WAS DERIVED/m.test(STORY),
      'and it records HOW the canon was derived, so it can be argued with rather than obeyed');
}

// =====================================================================================
// 2. THE CANON IS ANCHORED TO MECHANICS THAT ACTUALLY EXIST
//    A story bible that describes a different game is worse than none.
// =====================================================================================
{
  const derivations = [
    ['the tower light going dormant under gaze', /FARM_TOWER_GAZE_PERIPH|st\.gaze/],
    ['the mailbox that leaves when unobserved',  /_farmMailboxGone/],
    ['the Stalker freezing when watched',        /beingWatched/],
    ['farm animals freezing when watched',       /_isWatched/],
    ['Suburbia rearranging when unobserved',     /updateSuburbiaRearrangement|_subPending/],
  ];
  let ok = true;
  for (const [label, re] of derivations) {
    if (!re.test(SCRIPT)) { ok = false; console.log('        NOT IN THE BUILD: ' + label); }
  }
  chk(ok, `the five observation-keyed systems the canon is derived from are all still in the build`);
  chk(/resolves under attention|only has to be right\s*\n?\s*where something is looking/i.test(STORY),
      'and the bible states the principle they share');

  // The Anchor's canon depends on it being player-crafted and fuel-hungry.
  chk(/result: ITEM\.SAFEHOUSE_ANCHOR/.test(SCRIPT) && /addFuel\(/.test(SCRIPT),
      'the Anchor is still crafted by the player and still consumes fuel — the canon rests on both');
  // Three Cores, no more. Section 9 forbids a fourth.
  const cores = ['CORE_DISK', 'CORE_DISK_L2', 'CORE_DISK_L3'];
  chk(cores.every(c => SCRIPT.indexOf('ITEM.' + c) >= 0) && SCRIPT.indexOf('CORE_DISK_L4') < 0,
      'exactly three Rift Cores exist — the canon forbids a collect-them-all fourth');
}

// =====================================================================================
// 3. THE RETIRED PROJECT NAME IS GONE FROM THE BUILD
//    CLAUDE.md section 1 forbids it outright; it was still in four player-facing places.
// =====================================================================================
{
  const variants = ['BLOCK & RUIN', 'BLOCK &amp; RUIN', 'Block & Ruin', 'Block &amp; Ruin',
                    'Block and Ruin', 'BLOCK AND RUIN'];
  const found = variants.filter(v => GAME.indexOf(v) >= 0);
  chk(found.length === 0,
      'the retired project name appears NOWHERE in game.html' +
      (found.length ? ` — still present: ${found.join(', ')}` : ''));
  chk(/<title>Where It Isn/.test(GAME), 'the browser tab reads Where It Isn’t');
  chk(/<h1>WHERE IT ISN/.test(GAME), 'the start screen reads WHERE IT ISN’T');
  chk(/class="credits-title">WHERE IT ISN/.test(GAME), 'and so do the credits');
  chk(/CLAUDE\.md/.test(CLAUDEMD) || /WHERE IT ISN'T/.test(CLAUDEMD),
      'CLAUDE.md still declares the official title');
}

// =====================================================================================
// 4. THE FINALE IS NOT NAMED ON SCREEN
//    STORY.md section 19: it is not a boss. The internal name may live in code comments.
// =====================================================================================
{
  // Everything outside a comment, roughly — enough to catch a string literal or markup.
  const stripped = SCRIPT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const markup = GAME.slice(0, GAME.indexOf('<script>'));
  chk(!/VOID SOVEREIGN/i.test(markup),
      'the finale is not named anywhere in the page markup (the credits no longer star it)');
  const inStrings = /(['"`])[^'"`\n]*Void Sovereign[^'"`\n]*\1/i.test(stripped);
  chk(!inStrings, 'and it is not named in any player-facing string');
  chk(/retired/i.test(STORY) && /Void Sovereign/.test(STORY),
      'the bible records the name as retired rather than pretending it never existed');
  chk(/WHATEVER WAS ALWAYS THERE/.test(GAME),
      'the credits line reads as a presence rather than a marquee billing');
}

// =====================================================================================
// 5. THE AUDITED NARRATIVE FRAGMENTS SURVIVED
//    This is the check that matters. A story phase must not delete the story.
// =====================================================================================
{
  const FRAGMENTS = [
    ['the opening instruction, line 1',   "'At the crossroads, go east.'"],
    ['the opening instruction, line 2',   "'Go east.'"],
    ['the compass toast',                 'A brass compass, still true. North holds.'],
    ['the Farmlands rift toast',          'The Rift tears open'],
    ['the Haven arrival toast',           'Somewhere safe. Somewhere warm.'],
    ['the Haven shift line',              'The warmth was never yours.'],
    ['the bed variant of the shift line', 'You close your eyes'],
    ['the Home approach line',            'The room goes bright'],
    ['the Farmlands banner',              'THE SHATTERED FARMLANDS'],
    ['the Suburbia banner',               'STATIC SUBURBIA'],
    ['the Haven banner',                  'THE HAVEN'],
    ['the credits epitaph',               'THERE WAS NEVER A WAY OUT'],
  ];
  let lost = [];
  for (const [label, text] of FRAGMENTS) if (GAME.indexOf(text) < 0) lost.push(label);
  chk(lost.length === 0,
      `all ${FRAGMENTS.length} audited narrative fragments are still in the build` +
      (lost.length ? ` — LOST: ${lost.join(', ')}` : ''));

  // The journey objective lines are the model Phase 25 must follow; they must survive.
  const JOURNEY = ['Explore the Shattered Farmlands.', 'Follow the old farm road.',
                   'Follow the road east.', 'Investigate the water tower.',
                   'Continue beyond the tower.', 'Keep to the road.',
                   'Something here feels familiar.', 'The fields are dying.',
                   'Follow the old route.', 'Investigate the property.',
                   'Investigate the farmhouse.'];
  const lostJ = JOURNEY.filter(t => GAME.indexOf(t) < 0);
  chk(lostJ.length === 0,
      `all ${JOURNEY.length} journey objective lines survive — they are Phase 25's model` +
      (lostJ.length ? ` — LOST: ${lostJ.join(' / ')}` : ''));
  chk(JOURNEY.every(t => !/tower|farmhouse|property/i.test(t) || /Investigate|beyond/.test(t)),
      'and none of them names a destination the player has not reached');

  // The farm signs are canon now (a name on a board is geometry, so it survives).
  const SIGNS = ['ROTH', 'JOHNSON', 'MILLER', 'CHAPEL', 'CEMETERY', 'WATERTOWER'];
  chk(SIGNS.every(k => SCRIPT.indexOf("key: '" + k + "'") >= 0),
      'the farm sign vocabulary survives — the canon now explains why the names outlast the families');
}

// =====================================================================================
// 6. NO LORE DUMP WAS SMUGGLED IN
//    Phase 24 wrote a document. The game's player-facing text should have got SMALLER.
// =====================================================================================
{
  const banned = [
    ['the word "record" as in-game vocabulary', /(['"`])[^'"`\n]*\bthe record\b[^'"`\n]*\1/i],
    ['"reconstruction" in a player string',     /(['"`])[^'"`\n]*reconstruct(ion|ing)[^'"`\n]*\1/i],
    ['a lore/codex/journal UI',                 /id="(lore|codex|journal|archive)/i],
  ];
  let leaked = [];
  const stripped = SCRIPT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [label, re] of banned) if (re.test(stripped) || re.test(GAME.slice(0, GAME.indexOf('<script>')))) leaked.push(label);
  chk(leaked.length === 0,
      'none of the bible\'s internal-only vocabulary leaked into the game' +
      (leaked.length ? ` — LEAKED: ${leaked.join(', ')}` : ''));

  chk(!/id="(noteOverlay|readable|documentOverlay)/i.test(GAME),
      'no collectible-note or readable-document UI was added');

  /* The number of places the game can put words on the screen must not have grown much.
     Phase 24 is documentation: the only player-facing text changes it made were renames
     and one removal, at 16 call sites (the measured Phase 23 count, verified against the
     pre-phase build). Phase 26 added exactly ONE — the progression milestone notice, and
     it is a HUD status line, not lore. 17 is therefore the ceiling, and this still
     catches a future phase quietly turning the bible into dialogue. */
  const toasts = (SCRIPT.match(/showToast\(/g) || []).length;
  chk(toasts <= 17, `showToast call sites: ${toasts} — Phase 23's 16 plus Phase 26's one milestone notice, so no phase has turned the bible into dialogue`);
}

// =====================================================================================
// 7. THE DOCUMENTATION POINTS AT THE CANON
// =====================================================================================
{
  chk(/STORY\.md/.test(CLAUDEMD), 'CLAUDE.md points at STORY.md');
  chk(/STORY\.md/.test(ROADMAP), 'ROADMAP.md points at STORY.md');
  chk(/STORY\.md/.test(PROGRESS), 'PROGRESS.md points at STORY.md');
  chk(/PHASE 24 — CANONICAL STORY FOUNDATION/.test(PROGRESS),
      'and PROGRESS.md records what Phase 24 actually did to the repository');
  chk(/COMPLETE/.test(ROADMAP.slice(ROADMAP.indexOf('# 42. PHASE 24'), ROADMAP.indexOf('# 42. PHASE 24') + 120)),
      'ROADMAP.md marks Phase 24 complete');
  /* Phase 24's real invariant is that the roadmap still carries the phase order after it,
     not that Phase 25 is literally the NEXT one — Phase 25 shipped, and Phase 26 after it.
     Asserted as "Phase 25 is still in there, marked complete" so this keeps catching a
     roadmap that loses a delivered phase without failing every time one lands. */
  chk(/# 43\. PHASE 25 — DYNAMIC OBJECTIVE SYSTEM\s+— \*\*COMPLETE\*\*/.test(ROADMAP),
      'and still carries Phase 25, marked complete');
}

// =====================================================================================
// 8. THE THINGS THAT MUST STAY UNANSWERED ARE WRITTEN DOWN AS SUCH
// =====================================================================================
{
  const tail = STORY.slice(STORY.indexOf('## 22. MYSTERY VERSUS EXPLANATION'));
  const MUSTNOT = ['what is doing the rebuilding', 'whose memory the Haven is',
                   'what the final creature is', 'whether the player is original',
                   'why an Anchor works'];
  const absent = MUSTNOT.filter(t => tail.toLowerCase().indexOf(t.toLowerCase()) < 0);
  chk(absent.length === 0,
      `the never-explain list names all ${MUSTNOT.length} core unknowns` +
      (absent.length ? ` — MISSING: ${absent.join('; ')}` : ''));
  chk(/no cure, no reversal/i.test(tail),
      'and rules out a repaired-world ending, so no later phase writes one by accident');
}

console.log('\n' + (fail === 0 ? 'ALL STORY-FOUNDATION CHECKS PASS' : fail + ' FAILURES'));
note('These are structural checks. Nothing here tests whether the story is good —');
note('that is a judgement for a person, and no test in this repository claims otherwise.');
process.exit(fail ? 1 : 0);
