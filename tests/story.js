/* THE CANONICAL STORY BIBLE, AND THE BUILD THAT HAS TO AGREE WITH IT.

   WHAT THIS FILE CAN AND CANNOT DO.

   It CANNOT test whether the story is good. Nothing in this repository can, nothing here
   pretends to, and no assertion below makes a claim about writing quality, atmosphere,
   pacing or whether a premise lands. The real deliverable is a document, and a document is
   judged by a person.

   What it CAN do is protect the document and the build it governs:

     1. the bible exists and is structurally sound, and every canonical subject has its own
        section — asked for BY TITLE, so the author may renumber freely
     2. the canon is anchored to mechanics that are actually in the build
     3. the retired names are gone from the shipped build, everywhere
     4. the finale is not named on screen like a boss
     5. the narrative fragments the audit catalogued are STILL THERE — the whole risk of a
        story phase is that it quietly replaces the material it was supposed to preserve,
        so every surviving string is pinned here by exact text
     6. no lore dump was smuggled into the game
     7. the vocabulary table is ENFORCED: no term the bible marks internal, working or
        retired reaches the player
     8. the never-explain list still names the core unknowns

   Points 5, 6 and 7 are the ones with teeth. They are why this file exists.

   ERA 1.5.2 REWROTE THE DOCUMENT-FACING HALF OF THIS FILE. The bible was replaced by its
   author with a new canonical story and horror bible: renumbered, restructured, and with
   The Below promoted to a full dimension. Twenty-two checks across four suites were still
   matching `^## 18. FAKE HAVEN` and similar, and failed — not because the canon was wrong
   but because the tests were pinned to the old document's typography.

   They were not weakened and no coverage was dropped. They now ask the shared parser in
   harness/story.js for a section BY TITLE, and assert the RULES the bible states rather
   than the heading syntax it states them under. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BIBLE = require('./harness/story.js');
const STORY = BIBLE.TEXT;
const GAME = require('./harness/source.js').buildSource()   /* ERA 1.5: the WHOLE build — every
   src/ module plus the inline <script>. Reading game.html directly would scan less
   and less code as Era 1.5 extracts, while going on passing. See ARCHITECTURE.md §0. */;
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
// 1. THE BIBLE EXISTS, IS STRUCTURALLY SOUND, AND COVERS EVERY CANONICAL SUBJECT
// =====================================================================================
{
  chk(STORY.length > 12000, `STORY.md exists and is substantial (${STORY.length} characters)`);
  chk(/CANONICAL STORY & HORROR BIBLE/.test(STORY.slice(0, 400)),
      'and declares itself the canonical story and horror bible in its opening lines');
  chk(/authoritative source/i.test(STORY.slice(0, 1200)),
      'and says it is the authoritative source, so a future session knows it outranks a brief');

  /* THE DOCUMENT PARSES. Not a formatting check — a check that the thing the other three
     suites slice by section really does have unambiguous sections. Section 35 is a
     numbered list of fifteen principles, and a naive parse reported sixteen extra
     sections numbered 1-15, which would have made every slice after it silently wrong. */
  const ns = BIBLE.numbers();
  chk(ns.length >= 40, `${ns.length} numbered sections parse out of the bible`);
  chk(ns.every((n, i) => i === 0 || n > ns[i - 1]),
      'and they are strictly ascending with no duplicates — section slicing is unambiguous');
  chk(ns[0] === 0, 'the document opens at section 0, the rule that outranks everything');

  /* EVERY CANONICAL SUBJECT HAS ITS OWN SECTION, ASKED FOR BY TITLE.

     By title, not by number, and that is the whole point of this rewrite. The author
     renumbered the bible between Phase 36 and Era 1.5.2 and it cost twenty-two checks;
     matched this way, the next renumbering costs nothing. A subject cannot be satisfied
     by a passing mention somewhere else, because a section is where the rules live. */
  const REQUIRED = [
    ['the rule that outranks everything', 'THE RULE THAT OUTRANKS EVERYTHING'],
    ['canonical premise',                 'CANONICAL PREMISE'],
    ['what the player is',                'WHAT THE PLAYER IS'],
    ['the central idea of fear',          'THE CENTRAL IDEA OF FEAR'],
    ['Dimension 1, the Farmlands',        'SHATTERED FARMLANDS'],
    ['Dimension 2, Static Suburbia',      'STATIC SUBURBIA'],
    ['Dimension 3, The Below',            'THE BELOW'],
    ['the Stalker',                       'THE STALKER'],
    ['the Behemoth',                      'HOLLOWED BEHEMOTH'],
    ['the Anchor',                        'THE ANCHOR'],
    ['the Rift',                          'THE RIFT'],
    ['Rift Cores',                        'RIFT CORES'],
    ['the Disconnected Home',             'THE DISCONNECTED HOME'],
    ['the Eastward Journey',              'THE EASTWARD JOURNEY'],
    ['player-facing language',            'THE FALSE LANGUAGE OF THE WORLD'],
    ['Haven',                             'FAKE HAVEN / HAVEN'],
    ['Haven horror escalation',           'HAVEN HORROR ESCALATION'],
    ['the final creature',                'THE FINAL CREATURE'],
    ['the final sequence',                'THE FINAL SEQUENCE'],
    ['horror escalation, whole game',     'HORROR ESCALATION ACROSS THE WHOLE GAME'],
    ['what makes a scare good',           'WHAT MAKES A SCARE CANONICALLY GOOD'],
    ['jumpscares',                        'JUMPSCARES'],
    ['player trust',                      'PLAYER TRUST AND BETRAYAL'],
    ['observation rules',                 'OBSERVATION RULES'],
    ['the world remembers',               'THE WORLD REMEMBERS'],
    ['what must never be explained',      'THINGS THE GAME MUST NEVER EXPLAIN'],
    ['what may be figured out',           'THINGS THE PLAYER MAY EVENTUALLY FIGURE OUT'],
    ['the knowledge curve',               'THE CANONICAL KNOWLEDGE CURVE'],
    ['dimension relationships',           'DIMENSIONS AS ONE STORY'],
    ['visual and audio horror rules',     'VISUAL AND AUDIO HORROR RULES'],
    ['the safe space rule',               'SAFE SPACE RULE'],
    ['physical vs psychological',         'PHYSICAL HORROR VERSUS PSYCHOLOGICAL HORROR'],
    ['what not to do',                    'WHAT NOT TO DO'],
    ['Era 2 art direction',               'ERA 2 ART DIRECTION RULE'],
    ['final principles',                  'FINAL CANONICAL PRINCIPLES'],
    ['title meaning',                     'TITLE MEANING'],
    ['future-phase compatibility',        'FUTURE-PHASE COMPATIBILITY'],
    ['the one-paragraph rule',            'THE ONE-PARAGRAPH RULE'],
    ['canonical vocabulary',              'CANONICAL VOCABULARY'],
    ['the final rule',                    'FINAL RULE'],
  ];
  const missing = REQUIRED.filter(([, title]) => !BIBLE.has(title)).map(([label]) => label);
  chk(missing.length === 0,
      `all ${REQUIRED.length} canonical subjects have their own section` +
      (missing.length ? ` — MISSING: ${missing.join(', ')}` : ''));

  /* The one-paragraph rule is the bible's own handoff to a session that reads nothing
     else. If it goes, a future session inherits 2,300 lines and no entry point. */
  const para = BIBLE.byTitle('ONE-PARAGRAPH RULE');
  chk(/reads only one paragraph/i.test(para),
      'the one-paragraph rule exists — the entry point for a session that reads nothing else');
  chk(/reconstructed from an incomplete record/i.test(para),
      'and that paragraph still states the premise: a world rebuilt from an incomplete record');
  chk(/never be told why/i.test(para),
      'and still ends on the mystery rather than on an answer');
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
  /* THE PRINCIPLE THE FIVE SHARE, asserted against the section that states it rather than
     against a remembered sentence. The old check matched one phrasing from the previous
     bible; the rule itself is unchanged and is section 24's first two canonical rules. */
  const obs = BIBLE.byTitle('OBSERVATION RULES');
  chk(/change only when not observed/i.test(obs) && /freeze when watched/i.test(obs),
      'and the bible states the principle they share: things change unwatched, things freeze watched');
  chk(/never explain every observation-dependent event/i.test(obs),
      'and forbids explaining them, which is why none of the five is ever announced');
  chk(/Observation does not make the player safe/i.test(obs),
      'and refuses to make looking a safety mechanic');

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
  /* PHASE 29 — the title carries one deliberately misaligned letter in a <span>, so the
     markup no longer contains the words as a contiguous run. What matters is what the
     player READS, so the tags are stripped and the text asserted — which is a better
     check than the one it replaces, and would have caught a title broken by a typo in
     the span as well. */
  const h1 = (GAME.match(/<h1>([\s\S]*?)<\/h1>/) || [null, ''])[1]
    .replace(/<[^>]+>/g, '').replace(/&rsquo;/g, '\u2019').trim();
  chk(h1 === 'WHERE IT ISN\u2019T', `the start screen reads "${h1}"`);
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

  /* =================================================================================
     PHASE 32 DELETED FOUR OF THESE ON PURPOSE, AND THIS IS NOW THE STRONGER CHECK.

     Until Phase 32 the four lines below were audited as fragments that must SURVIVE,
     on the general principle that a story phase must not delete the story. Phase 32
     deleted them anyway, because each one was the game telling the player how to feel
     about a room it had just put them in:

       'The room goes bright — and keeps going.'   narrating the transition
       'Somewhere safe. Somewhere warm.'           TELLING the player they are safe
       'The warmth was never yours.'               reframing the Haven as a betrayal
       'You close your eyes — and it is already here.'   ditto, on the bed

     The middle two are the load-bearing ones. STORY.md section 18 requires that the
     safety be REAL and that the ending not be a betrayal — "Nothing turns on the
     player. The Haven RUNS OUT, and what is underneath it was always underneath it."
     A player who is told a room is safe has been asked to take the game's word for it;
     a player who works it out over two silent minutes has invested something they can
     then lose, which is the entire mechanism of the sequence.

     So the audit is inverted rather than dropped: these must now stay OUT. Deleting
     the story is still forbidden — the list above is what that rule protects. Putting
     a caption back on the Haven is a different mistake and this catches it.

     The search is over the script with comments stripped, because the phase's own
     comments quote the lines they removed in order to explain why. */
  const NO_COMMENTS = SCRIPT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const REMOVED_BY_32 = [
    ['the Haven arrival caption',         'Somewhere safe. Somewhere warm.'],
    ['the Haven shift line',              'The warmth was never yours.'],
    ['the bed variant of the shift line', 'You close your eyes'],
    ['the white-wash caption',            'The room goes bright'],
  ];
  const returned = REMOVED_BY_32.filter(([, text]) => NO_COMMENTS.indexOf(text) >= 0)
                                .map(([label]) => label);
  chk(returned.length === 0,
      'the four captions Phase 32 removed from the Haven have not come back' +
      (returned.length ? ` — RETURNED: ${returned.join(', ')}` : ''));
  chk(/STORY\.md section 18/.test(GAME) || /section 18/.test(GAME),
      'and the build cites the canon section that required their removal');

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
  /* THE ROADMAP STILL CARRIES THE DELIVERED PHASES, AND STILL MARKS THEM DELIVERED.

     Matched on the roadmap's own `PHASE N — TITLE` / `STATUS: ...` shape rather than on a
     section number and a markdown bold run, because the author rewrote ROADMAP.md at the
     same time as STORY.md and the old pattern was pinned to the previous typography. The
     invariant was never "Phase 25 is section 43" — it is "a delivered phase is not
     quietly dropped from the record", and this catches that without failing every time a
     new phase lands. Phase 24 is now marked superseded, which is still a completion. */
  const phaseStatus = (n) => {
    const m = ROADMAP.match(new RegExp('^PHASE ' + n + ' — [^\\n]*\\nSTATUS: ([^\\n]*)', 'm'));
    return m ? m[1].trim() : null;
  };
  chk(/COMPLETE/.test(phaseStatus(24) || ''),
      `ROADMAP.md still carries Phase 24, marked "${phaseStatus(24)}"`);
  chk(/COMPLETE/.test(phaseStatus(25) || ''),
      `and still carries Phase 25, marked "${phaseStatus(25)}"`);
  chk(/COMPLETE/.test(phaseStatus(36) || ''),
      `and Phase 36, marked "${phaseStatus(36)}"`);
  /* The bible's own handoff to the phases that come next. */
  chk(/Era 1\.5 Architecture Split/i.test(BIBLE.byTitle('FUTURE-PHASE COMPATIBILITY')),
      'and the bible names the architecture split as a phase that must not change the canon');
}

// =====================================================================================
// 8. THE THINGS THAT MUST STAY UNANSWERED ARE WRITTEN DOWN AS SUCH
// =====================================================================================
{
  const never = BIBLE.byTitle('MUST NEVER EXPLAIN');
  chk(never.length > 400, 'the never-explain section is present and substantial');

  /* The core unknowns, in the NEW bible's own words. The previous list was phrased
     against the previous document; the rules are the same and several are now stated
     more strongly. Seven instead of five, because the new bible forbids more. */
  const MUSTNOT = [
    'what is doing the rebuilding',
    'whether the player is original',
    'why the Anchor works',
    'whether Haven belongs to the player',
    'what the final creature ultimately is',
    'whether the world can be repaired',
    'what exactly the record is',
  ];
  const absent = MUSTNOT.filter(t => never.toLowerCase().indexOf(t.toLowerCase()) < 0);
  chk(absent.length === 0,
      `the never-explain list names all ${MUSTNOT.length} core unknowns` +
      (absent.length ? ` — MISSING: ${absent.join('; ')}` : ''));

  /* A REPAIRED-WORLD ENDING IS RULED OUT. The previous bible said "no cure, no reversal";
     the new one forbids ever answering whether the world CAN be repaired — the same
     prohibition stated as a mystery rather than as an outcome. Both halves asserted so a
     later phase cannot write a restoration ending by accident. */
  chk(/whether the world can be repaired/i.test(never),
      'and rules out a repaired-world ending, so no later phase writes one by accident');
  chk(/whether the player escaped the reconstruction/i.test(never),
      'and an escaped-player ending with it');
  chk(/redesign the mechanic/i.test(never),
      'and says a mechanic needing one of them explained is the thing that must change');

  /* THE OTHER HALF OF THE SAME RULE, which no test has ever covered: what the player IS
     allowed to work out. A bible that only forbids becomes a bible that forbids
     everything, and this section is what keeps the world legible. */
  const may = BIBLE.byTitle('MAY EVENTUALLY FIGURE OUT');
  chk(/the dimensions are the same underlying place/i.test(may) &&
      /reality is being reconstructed/i.test(may),
      'and the bible separately lists what the player MAY infer — the world stays legible');
  chk(/Never from a lore dump/i.test(may),
      'and requires those inferences to come from play rather than from a lore dump');
}

// =====================================================================================
// 9. THE CANONICAL VOCABULARY IS ENFORCED, NOT MERELY LISTED
//    The table marks every term in-game / internal only / working / retired. A term the
//    bible marks internal or retired must never reach the player — and the list is
//    derived FROM THE DOCUMENT, so it cannot drift away from it.
// =====================================================================================
{
  const vocab = BIBLE.byTitle('CANONICAL VOCABULARY');
  chk(vocab.length > 300, 'the vocabulary table exists, so future sessions do not invent synonyms');

  const rows = vocab.split('\n')
    .map(l => l.split('\t'))
    .filter(c => c.length >= 3 && c[0].trim() && !/^Term$/i.test(c[0].trim()))
    .map(c => ({ term: c[0].trim(), status: c[1].trim().toLowerCase() }));
  chk(rows.length >= 15, `${rows.length} vocabulary rows parse out of the table`);

  const inGame   = rows.filter(r => r.status === 'in-game').map(r => r.term);
  const internal = rows.filter(r => /internal|working|retired/.test(r.status)).map(r => r.term);
  chk(inGame.length >= 8 && internal.length >= 4,
      `${inGame.length} terms are in-game, ${internal.length} internal / working / retired`);

  /* THE PAGE MARKUP IS PURELY PLAYER-FACING — every word of it is read by somebody. This
     is the mechanical version of the hand-written Void Sovereign and Block & Ruin checks
     above, derived from the bible itself, so a future retirement is enforced the moment
     it is written down rather than the next time someone remembers to add a test. */
  const markup = GAME.slice(0, GAME.indexOf('<script>'));
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const leaked = internal.filter(t => new RegExp('\\b' + esc(t) + '\\b', 'i').test(markup));
  chk(leaked.length === 0,
      'no internal, working or retired term appears in the page markup' +
      (leaked.length ? ` — LEAKED: ${leaked.join(', ')}` : ''));

  chk(/Void Sovereign[^\n]*retired/i.test(vocab),
      "the finale's old name is recorded as RETIRED rather than pretending it never existed");
  chk(/Block & Ruin[^\n]*retired/i.test(vocab),
      'and so is the old project title');
}

// =====================================================================================
// 10. THE THREE DIMENSIONS, AND THE ONE THAT DOES NOT EXIST YET
//     The new bible promotes The Below to a full dimension and renumbers the CREATIVE
//     order. That renumbering is canon, not code — see ARCHITECTURE.md section 5 and
//     src/dimensions/. What this asserts is that the bible is internally consistent about
//     it, and that the build has NOT started implementing The Below.
// =====================================================================================
{
  const d1 = BIBLE.byTitle('SHATTERED FARMLANDS');
  const d2 = BIBLE.byTitle('STATIC SUBURBIA');
  const d3 = BIBLE.byTitle('THE BELOW');
  chk(/DIMENSION 1/.test(d1), 'the bible names the Shattered Farmlands as creative Dimension 1');
  chk(/DIMENSION 2/.test(d2), 'Static Suburbia as creative Dimension 2');
  chk(/DIMENSION 3/.test(d3), 'and The Below as creative Dimension 3');
  chk(d1.length > 2000 && d2.length > 2000 && d3.length > 2000,
      'each of the three carries a substantial section of its own, not a paragraph');

  /* THE BELOW IS CANON AND IS NOT BUILT. Era 1.5.2 established metadata that can
     REPRESENT it; the game does not contain it, and a later phase builds it. */
  const inBuild = ['The Collector'].filter(t => SCRIPT.indexOf(t) >= 0);
  chk(inBuild.length === 0,
      'The Below is canon but NOT implemented — its entity is nowhere in the build' +
      (inBuild.length ? ` — FOUND: ${inBuild.join(', ')}` : ''));
}

// =====================================================================================
// 11. THE LANGUAGE RULE THE OBJECTIVE LINES ARE WRITTEN TO
// =====================================================================================
{
  const lang = BIBLE.byTitle('FALSE LANGUAGE');
  chk(/what the player has seen/i.test(lang),
      'the bible says an objective describes what the player has SEEN');
  chk(/name hidden dimensions before discovery/i.test(lang),
      'and forbids naming a hidden dimension before it is discovered');
  chk(/use internal lore terms casually/i.test(lang),
      'and forbids internal lore terms in player-facing language');
  chk(/turn mystery into a quest checklist/i.test(lang),
      'and forbids turning the mystery into a checklist');
}

// =====================================================================================
// 12. THE TITLE IS NEVER EXPLAINED IN THE GAME
// =====================================================================================
{
  const title = BIBLE.byTitle('TITLE MEANING');
  chk(/Never explain the title in dialogue/i.test(title),
      'the bible forbids explaining the title in dialogue');
  chk(/Never place the title on a wall/i.test(title),
      'and forbids putting it on a wall as an in-world phrase');
  chk(/make the title true/i.test(title),
      'and requires the game to make the title true instead');
}

console.log('\n' + (fail === 0 ? 'ALL STORY-FOUNDATION CHECKS PASS' : fail + ' FAILURES'));
note('These are structural checks. Nothing here tests whether the story is good —');
note('that is a judgement for a person, and no test in this repository claims otherwise.');
process.exit(fail ? 1 : 0);
