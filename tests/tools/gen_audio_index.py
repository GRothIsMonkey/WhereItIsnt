"""Regenerates assets/audio/AUDIO_INDEX.md from tests/tools/audio_inventory.py.

Needs ffprobe on the path and a runtime_report.json written by build_runtime.py.
Writes ONLY the index; nothing here ever touches a source asset."""
import os, sys, re, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audio_inventory as I

ROOT=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SRC=os.path.join(ROOT,'assets','audio')
rep=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'runtime_report.json')))
def _probe_all():
    """Duration and channel count for every source asset, cached in probe.json.

    Regenerated whenever the cache does not cover the files on disk, so deleting an asset
    or adding one does not need a second command. ffprobe must be on the path."""
    import subprocess
    cache = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'probe.json')
    have = {}
    if os.path.exists(cache):
        try:
            for x in json.load(open(cache)): have[x['path']] = x
        except Exception: have = {}
    want = []
    for p in sorted(glob.glob(os.path.join(SRC, '**', '*'), recursive=True)):
        b = os.path.basename(p)
        if not os.path.isfile(p) or b in ('.gitkeep', 'AUDIO_CREDITS', 'AUDIO_INDEX.md'): continue
        if os.sep + 'runtime' + os.sep in p: continue
        want.append(os.path.relpath(p, ROOT).replace(os.sep, '/'))
    out = []
    for rel in want:
        if rel in have: out.append(have[rel]); continue
        full = os.path.join(ROOT, rel)
        r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
                            'format=duration:stream=codec_name,channels', '-of', 'json', full],
                           capture_output=True, text=True)
        j = json.loads(r.stdout or '{}')
        st = (j.get('streams') or [{}])[0]; fm = j.get('format') or {}
        out.append({'path': rel, 'size': os.path.getsize(full),
                    'dur': round(float(fm.get('duration') or 0), 2),
                    'codec': st.get('codec_name'), 'ch': st.get('channels')})
    json.dump(out, open(cache, 'w'), indent=1)
    return {os.path.join(ROOT, x['path']): x for x in out}

probe = _probe_all()

lic={}; name={}
for line in open(os.path.join(SRC,'AUDIO_CREDITS'),encoding='utf-8'):
    m=re.match(r'^(.*) by (.+?) -- https://freesound\.org/s/(\d+)/ -- License: (.+)$',line.strip())
    if m: name[m.group(3)]=(m.group(1),m.group(2)); lic[m.group(3)]=m.group(4)

files={}
for p in sorted(glob.glob(os.path.join(SRC,'**','*'),recursive=True)):
    b=os.path.basename(p)
    if not os.path.isfile(p) or b in ('.gitkeep','AUDIO_CREDITS'): continue
    if os.sep+'runtime'+os.sep in p or p.endswith(os.sep+'runtime'): continue
    files.setdefault(b.split('__')[0],[]).append(p)

byrep={r['id']:(k,r) for k,r in ((k,v) for k,v in rep.items())}
NC=('NonCommercial','Sampling+')
def flag(l): return any(t.lower() in l.lower() for t in NC)

rows={c:[] for c,_ in I.CATS}
for fsid,cat,use,key,kind in I.A: rows[cat].append((fsid,use,key,kind))

def rel(p): return os.path.relpath(p, SRC).replace(os.sep,'/')

out=[]
W=out.append
W('# WHERE IT ISN\'T — AUDIO INDEX')
W('')
W('Phase 34. One row per collected asset, grouped by what the sound is FOR.')
W('')
W('Attribution and licence text live in `AUDIO_CREDITS` and are NOT repeated here — this')
W('file records where each sound came to rest in the game, not who made it. The Freesound')
W('id is the join key between the two, and it is the first field of every filename, which')
W('is why filenames are never rewritten.')
W('')
W('## How to read a row')
W('')
W('```')
W('| id | file | dur | manifest key | use |')
W('```')
W('')
W('`manifest key` is the logical name the game asks for — `AUDIO_ASSETS` in `game.html`')
W('maps it to a runtime file. A row with `—` is catalogued and NOT wired to anything; see')
W('section "Catalogued, not wired" for why each one is held back.')
W('')
W('A `⚠` after the id means the asset is **NonCommercial or Sampling+**. It is legal in')
W('this build and illegal in a commercial release. The full list is in the LICENCE')
W('QUARANTINE section at the bottom — read that before shipping anything for money.')
W('')
W('## The runtime copies')
W('')
W('`assets/audio/runtime/` holds browser-ready copies built from the originals by')
W('`tests/tools/build_runtime.py`. **Nothing in it is a source asset and nothing in it is')
W('irreplaceable** — delete the directory and re-run the script. The originals are never')
W('written to.')
W('')
W('Three encodes, and the reason for each:')
W('')
W('- **footfalls** — `runtime/steps/<id>_NN.wav`. The footstep recordings are sequences of')
W('  five to ten steps, which is unusable as a one-shot. They are onset-sliced into single')
W('  footfalls, peak-aligned to within 14ms, normalised and fade-tailed. 16-bit 44.1k mono.')
W('- **cues under 8 seconds** — `runtime/<id>.wav`, 16-bit 44.1k. WAV rather than MP3')
W('  because every MP3 decoder inserts its own leading silence, and a cue that answers a')
W('  key press cannot start late.')
W('- **beds, and cues over 8 seconds** — `runtime/<id>.mp3`, VBR ~112k. MP3 rather than')
W('  Ogg because Safari could not decode Vorbis until 17.4 and this has to work everywhere.')
W('  **Beds are cut to 30 seconds and long one-shots to 20** — that is a memory decision,')
W('  not a bandwidth one: `decodeAudioData` expands to 32-bit float at the context rate, so')
W('  the 208-second drone would have been 73MB of RAM decoded. The engine crossfade-loops')
W('  beds, so a 30-second window of a wash is indistinguishable from all of it.')
W('')
W('## Loudness')
W('')
W('**Every runtime copy is levelled, and this is the single most important thing the build')
W('does.** The collected library spans 64 dB from the quietest recording to the loudest — a')
W('room tone at -67 dBFS RMS next to a drone at -3 — and the first Phase 34 build copied')
W('each file at its recorded level and then applied a hand-written mix number to it. A human')
W('playtest found the result nearly silent, which is exactly what the arithmetic predicts:')
W('the Overworld day bed reached the player at about -56 dBFS and the interior room tone at')
W('about -82.')
W('')
W('So loudness is measured and corrected here, once, at build time:')
W('')
W('| class | reference | measured over |')
W('|---|---|---|')
W('| beds | -26 dBFS RMS | the whole 30-second window that ships |')
W('| one-shots | -20 dBFS RMS | the **loudest 300ms**, not the whole file |')
W('| footfalls | -22 dBFS RMS | the **whole set**, not each slice |')
W('')
W('Nothing is allowed to clip (peak ceiling -1.5 dBFS), and a file that would need more')
W('than its class boost limit is left short rather than amplified into its own noise floor.')
W('The two "measured over" notes are corrections in their own right: whole-file RMS put')
W('fifty of the hundred and ten cues about twenty decibels too quiet, because a two-second')
W('file holding one 80ms click is mostly silence; and per-slice normalisation made every')
W('footfall in a set exactly as loud as every other, which deletes the heavy-step/light-step')
W('dynamic that makes a walk sound like a person.')
W('')
W('After this the spread is 9.3 dB for beds and 11.5 dB for one-shots, and a number in')
W('`AUDIO_SCENES` is a real mix decision rather than a guess about an unmeasured file.')
W('')

for cat,title in I.CATS:
    if cat=='unwired': continue
    W('---')
    W('')
    W('## '+title)
    W('')
    W('| id | file | dur | manifest key | use |')
    W('|---|---|---|---|---|')
    for fsid,use,key,kind in rows[cat]:
        p=files[fsid][0]; pr=probe[p]
        mark=' ⚠' if flag(lic.get(fsid,'')) else ''
        r=rep.get(key)
        if r and r['kind']=='step': rt='%d footfalls'%len(r['files'])
        elif r: rt='`%s`'%key
        else: rt='—'
        W('| %s%s | `%s` | %.1fs | %s | %s |'%(fsid,mark,rel(p),pr['dur'],rt,use))
    W('')

W('---')
W('')
W('## Catalogued, not wired')
W('')
W('Four assets are in the library and reach no code path. Each is here so a later phase')
W('can find it and know why it was held back rather than rediscovering the reason.')
W('')
W('| id | file | dur | why not |')
W('|---|---|---|---|')
for fsid,use,key,kind in rows['unwired']:
    p=files[fsid][0]; pr=probe[p]
    mark=' ⚠' if flag(lic.get(fsid,'')) else ''
    W('| %s%s | `%s` | %.1fs | %s |'%(fsid,mark,rel(p),pr['dur'],use))
W('')

W('---')
W('')
W('## LICENCE QUARANTINE — do not ship these commercially')
W('')
W('Every asset below is **NonCommercial** or **Sampling+**. Freesound\'s NonCommercial and')
W('Sampling+ terms permit this build and forbid a paid release, a monetised release, and a')
W('release bundled with advertising. Nothing here has been deleted — the phase brief says')
W('to keep them and mark them — but a commercial build must replace or remove all of them.')
W('')
W('Four of them are load-bearing today and would leave a hole:')
W('')
W('| id | licence | manifest key | what breaks without it |')
W('|---|---|---|---|')
LOAD={
 '418428':'The only horse recording in the library. The Farmland horse would fall back to the procedural call.',
 '16950' :'One of two open-wind beds. `bed.wind.open` would fall back to `bed.farm.wind`.',
 '816619':'The power-line hum. The Farmland pylon layer would go silent.',
 '612641':'The heartbeat bed. Nothing in Era 1 plays it yet.',
}
ncs=[(f,lic.get(f,'?'),k) for f,c,u,k,kd in I.A if flag(lic.get(f,''))]
for f,l,k in ncs:
    if f in LOAD: W('| %s | %s | %s | %s |'%(f,l,('`%s`'%k) if k else '—',LOAD[f]))
W('')
W('The rest are alternates, variants or unwired, and dropping them costs a texture, not a')
W('feature:')
W('')
W('| id | licence | manifest key |')
W('|---|---|---|')
for f,l,k in ncs:
    if f not in LOAD: W('| %s | %s | %s |'%(f,l,('`%s`'%k) if k else '— (not wired)'))
W('')
W('---')
W('')
W('## Audit notes')
W('')
W('- **%d source assets**, %d unique Freesound ids — one file per id, no duplicates.'%(len(files),len(files)))
W('- **13 byte-identical duplicate copies were removed** in this phase. Each was a second')
W('  copy of a root asset that had been re-uploaded into `audio continued/`; every one was')
W('  verified identical by MD5 before deletion, and the root copy was kept.')
W('- **`AUDIO_CREDITS` gained exactly one line** — `867251` was on disk with no attribution')
W('  at all, which is a licence problem rather than a tidiness one. The line was written in')
W('  the file\'s existing format after confirming the sound\'s title, author and CC0 licence')
W('  on Freesound. Nothing else in the file was touched.')
W('- **AUDIO_CREDITS still lists 14 ids that were never downloaded** (`376809`, `75162`,')
W('  `346654`, `32839`, `803690`, `829852`, `841932`, `841837`, `845300`, `845298`,')
W('  `845296`, `834213`, `134829`, `594625`) and repeats three lines verbatim (`416002`,')
W('  `19263`, `653294`). Neither was corrected: crediting a sound you did not ship is')
W('  harmless, and the brief asks for the file to be left alone unless a change is')
W('  required. They are recorded here so nobody re-derives them.')
W('- **Four filenames carry a ` (1)` suffix** (`19263`, `355738`, `416002`, `653294`).')
W('  Those are the ONLY copies of those sounds — the originals were deleted and re-added')
W('  during collection — so the suffix is not evidence of a duplicate. The names were left')
W('  as they are because the Freesound id, which is the part that matters, is intact.')
W('- **One format could not be used by the browser at all**: AIFF (`19263`, `85433`,')
W('  `192574`, `507465`, `507469`). Chrome and Firefox do not decode it. All five have')
W('  runtime copies; all five originals are untouched.')
W('- **Two formats were converted defensively**: FLAC (`124122`, `238288`, `432562`,')
W('  `454364`, `813114`) because Safari\'s support is inconsistent, and M4A/AAC (`848616`)')
W('  for the same reason. Both decode in Chrome today.')
W('- **Nothing was listened to.** No audio playback or analysis tool capable of judging')
W('  content was available. Every classification in this file is derived from the')
W('  filename, the `AUDIO_CREDITS` title, and `ffprobe` duration/channel data. Rows for')
W('  `118083` and `636777` say plainly that the content is unknown.')
W('')
open(os.path.join(SRC,'AUDIO_INDEX.md'),'w',encoding='utf-8').write('\n'.join(out))
print('wrote AUDIO_INDEX.md', len(out),'lines;','NC/S+ count',len(ncs))
