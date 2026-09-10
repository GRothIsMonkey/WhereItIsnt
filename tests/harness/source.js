/* ERA 1.5 — THE BUILD, AS TEXT.

   game.html is no longer the whole build. Era 1.5 moves code out of its inline <script>
   into ordered classic <script src> modules under src/, and it will keep doing that for
   several phases. Eighteen offline suites scan the build as TEXT — for a forbidden
   string, a stylesheet rule, an element id, an XP symbol, a setTimeout in a class that
   may not have one. Every one of those greps would have gone on passing while quietly
   scanning less and less code.

   So no suite reads game.html directly any more. This module reassembles the build the
   way the browser does — modules first, in the order game.html declares them, then the
   inline body — and hands back one string. Extraction can then continue for the rest of
   Era 1.5 without weakening a single text assertion.

   RULE: a <script src> that is a URL (three.js from the CDN) is NOT part of the build
   and is never inlined. Only repository-relative paths are.  */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const GAME = path.join(ROOT, 'game.html');

/* Every repository-relative <script src> in document order, as {tag, rel, abs}. */
function moduleRefs(html) {
  const out = [];
  const re = /<script\s+src="([^"]+)"\s*><\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const rel = m[1];
    if (/^[a-z]+:\/\//i.test(rel) || rel.startsWith('//')) continue;   // CDN — not ours
    out.push({ tag: m[0], rel, abs: path.join(ROOT, rel) });
  }
  return out;
}

function html() { return fs.readFileSync(GAME, 'utf8'); }

/* The ordered module list. Throws if game.html names a file that is not there, because
   a missing module is a broken build and must never read as "nothing to scan". */
function modules() {
  const refs = moduleRefs(html());
  for (const r of refs) {
    if (!fs.existsSync(r.abs)) throw new Error('game.html loads a module that does not exist: ' + r.rel);
  }
  return refs;
}

/* The inline <script> body — the part of the build that has not been extracted yet. */
function inlineBody() {
  const lines = html().split('\n');
  let start = -1, end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (start < 0 && /^<script>\s*$/.test(lines[i])) { start = i + 1; continue; }
    if (start >= 0 && /^<\/script>\s*$/.test(lines[i])) { end = i; break; }
  }
  if (start < 0 || end < 0) throw new Error('could not locate the inline <script> body');
  return { code: lines.slice(start, end).join('\n'), startLine: start };
}

/* ALL of the build's JavaScript, in load order. For suites that grep for code. */
function buildScript() {
  return modules().map(r => fs.readFileSync(r.abs, 'utf8')).concat([inlineBody().code]).join('\n');
}

/* The whole document as it was BEFORE the split: stylesheet, markup, and ONE <script>
   block containing every module followed by the inline body. Module tags are removed and
   their code is folded into that single block.

   The single block matters. A suite does not only grep this string — `story.js` walks it
   line by line for `^<script>` / `^</script>` to isolate "the code a player actually
   meets", and two suites split on `<script>` to get the markup. Handing them a document
   with five script blocks gave `story.js` the FIRST one — a 115-line module — and three
   checks that had been scanning forty thousand lines started scanning a hundred and
   fifteen, and went on passing four of them.

   That is the same trap this module exists to close, one level down: the fix for "a test
   silently scans less" must not itself make a test silently scan less. One block in, one
   block out, and every existing extraction idiom keeps working untouched. */
function buildSource() {
  const doc = html();
  const code = modules().map(r => fs.readFileSync(r.abs, 'utf8')).join('\n');
  let out = doc;
  for (const r of modules()) {
    /* drop the tag AND the newline it sits on, so the markup keeps its shape */
    out = out.replace(r.tag + '\n', '').replace(r.tag, '');
  }
  if (!code) return out;
  const at = out.indexOf('\n<script>\n');
  if (at < 0) throw new Error('could not locate the inline <script> body');
  return out.slice(0, at + '\n<script>\n'.length) + code + '\n' + out.slice(at + '\n<script>\n'.length);
}

module.exports = { ROOT, GAME, html, modules, inlineBody, buildScript, buildSource };
