/* THE STORY BIBLE, PARSED — ONE READER, SO FOUR SUITES CANNOT DISAGREE ABOUT IT.

   STORY.md is the canonical story and horror bible, and four suites assert against it:
   story.js (the whole document), haven.js (the Haven section), finale.js (the final
   creature), objectives.js (the language rule). Before this existed each of them sliced
   the document with its own hard-coded `indexOf('## 18. FAKE HAVEN')`, which is why a
   single authored revision of STORY.md broke twenty-two checks across four files at once
   and why not one of them said anything useful about what had actually changed.

   THE DOCUMENT'S STRUCTURE IS ITS NUMBERED SECTIONS, and that is what this parses: a line
   that is exactly `N. TITLE`, at the start of a line, where TITLE begins with a capital.
   Nothing here depends on markdown heading syntax, on blank-line conventions, on
   indentation, or on a section's position in the file — the author may renumber, retitle
   or reorder, and a suite that asks for `byTitle('THE FINAL CREATURE')` still finds it.

   A suite should ask by TITLE, not by number. Numbers are the author's to change. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FILE = path.join(ROOT, 'STORY.md');
const TEXT = fs.readFileSync(FILE, 'utf8');

/* `N. TITLE` on its own line, where TITLE carries NO LOWER-CASE LETTER.

   The upper-case requirement is not decoration, it is the discriminator. STORY.md's
   section 35 is a numbered list of fifteen sentence-case principles ("1. The world is the
   mystery."), and a naive `^\d+\.` split swallowed section 35 whole and then reported
   sixteen more sections numbered 1-15 — which would have made section(1) ambiguous and
   every slice after it wrong, silently. Every real heading in the document is upper-case;
   no list item is.

   Sub-sections ("15.1 How Haven ends") are deliberately NOT matched — there is no
   whitespace after the first dot — so section(15) contains 15.1, which is where the rule
   about how Haven ends actually lives. */
const HEAD = /^(\d+)\.[ \t]+([A-Z0-9][^a-z\n]*)$/gm;

function index() {
  const out = [];
  let m;
  HEAD.lastIndex = 0;
  while ((m = HEAD.exec(TEXT)) !== null) {
    out.push({ n: parseInt(m[1], 10), title: m[2].trim(), start: m.index, headLine: m[0] });
  }
  for (let i = 0; i < out.length; i++) out[i].end = i + 1 < out.length ? out[i + 1].start : TEXT.length;
  return out;
}
const SECTIONS = index();

/* The body of a section, by its number. Empty string if it is not there — a caller
   asserting on content then fails loudly rather than matching against the whole file,
   which is what a bad `indexOf` slice does. */
function section(n) {
  const s = SECTIONS.find(x => x.n === n);
  return s ? TEXT.slice(s.start, s.end) : '';
}

/* The body of a section, found by a case-insensitive substring of its title. THIS IS THE
   ONE TO USE: it survives the author renumbering the document. */
function byTitle(needle) {
  const s = SECTIONS.find(x => x.title.toLowerCase().indexOf(String(needle).toLowerCase()) >= 0);
  return s ? TEXT.slice(s.start, s.end) : '';
}

function titles() { return SECTIONS.map(s => s.title); }
function numbers() { return SECTIONS.map(s => s.n); }
function has(needle) { return byTitle(needle).length > 0; }

module.exports = { FILE, TEXT, SECTIONS, section, byTitle, titles, numbers, has };
