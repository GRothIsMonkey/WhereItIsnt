"""PHASE 34 — build assets/audio/runtime/ from the collected originals.

NEVER writes to an original. Everything it makes lands under assets/audio/runtime/.

  step  onset-sliced into individual footfalls, 16-bit 44.1k mono WAV
  sfx   <= 8s  -> 16-bit 44.1k WAV (sample exact: no codec delay on a cue)
        >  8s  -> MP3 (atmospheric one-shots, where a few ms of encoder delay is nothing)
  bed   MP3, 44.1k stereo, VBR ~112k, and looped in the engine by CROSSFADE so neither
        the encoder padding nor the recording's own seam is ever audible.
"""
import os, sys, glob, json, math, array, struct, subprocess, wave
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audio_inventory as I
ONLY = sys.argv[1] if len(sys.argv) > 1 else None

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SRCDIR = os.path.join(ROOT, 'assets', 'audio')
OUT = os.path.join(SRCDIR, 'runtime')
STEPS = os.path.join(OUT, 'steps')
SR = 44100
BED_CAP = 30.0     # seconds of a looping bed kept (see the encode branch)
SFX_CAP = 20.0     # seconds of a one-shot kept

def find(fsid):
    hits = []
    for p in glob.glob(os.path.join(SRCDIR, '**', '*'), recursive=True):
        b = os.path.basename(p)
        if os.path.isfile(p) and b not in ('.gitkeep', 'AUDIO_CREDITS') and b.split('__')[0] == fsid:
            if os.sep + 'runtime' + os.sep in p: continue
            hits.append(p)
    hits.sort(key=len)                      # the root copy before "audio continued"
    return hits[0] if hits else None

def run(args):
    r = subprocess.run(args, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(args[-1] + '\n' + r.stderr.decode()[-800:])

def probe(p):
    r = subprocess.run(['ffprobe','-v','error','-show_entries',
        'format=duration:stream=channels','-of','json',p], capture_output=True, text=True)
    j = json.loads(r.stdout)
    return float(j['format']['duration']), int(j['streams'][0].get('channels') or 1)

def raw_mono(p):
    """Decode to mono float32 at SR."""
    r = subprocess.run(['ffmpeg','-v','error','-i',p,'-ac','1','-ar',str(SR),
                        '-f','f32le','-'], capture_output=True)
    a = array.array('f'); a.frombytes(r.stdout)
    return a

def write_wav_mono(path, samples):
    pcm = array.array('h', (max(-32767, min(32767, int(s * 32767))) for s in samples))
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())

# --------------------------------------------------------------------------------------
# footstep slicing
# --------------------------------------------------------------------------------------
def slice_steps(fsid, src, maxout=8):
    x = raw_mono(src)
    n = len(x)
    if n < SR // 4: return []
    win = int(SR * 0.010)
    env = []
    acc = 0.0
    # short-window RMS envelope
    for i in range(0, n - win, win):
        s = 0.0
        for j in range(i, i + win, 4): s += x[j] * x[j]
        env.append(math.sqrt(s / (win / 4)))
    if not env: return []
    peak = max(env)
    if peak <= 1e-5: return []
    floor = sorted(env)[len(env) // 4]                 # 25th percentile = the room
    thr = max(floor * 4.0, peak * 0.16)
    minGap = int(0.16 / 0.010)                          # 160ms between footfalls
    onsets = []
    i = 1
    while i < len(env):
        if env[i] > thr and env[i] >= env[i - 1] and (not onsets or i - onsets[-1] >= minGap):
            onsets.append(i)
            i += minGap
        else:
            i += 1
    made = []
    scored = sorted(onsets, key=lambda o: -env[o])[:maxout]
    for k, o in enumerate(sorted(scored)):
        # REFINE ONTO THE ACTUAL TRANSIENT. The 10ms RMS envelope finds the region a
        # footfall is in, not the sample it starts on, and on soft surfaces it latches
        # onto the shoe-leather rustle 100ms before the heel. Search forward for the loud
        # sample and cut from just before THAT, or the slice begins with the wrong noise.
        lo = o * win
        hi = min(n, lo + int(SR * 0.26))
        pk_i = lo
        pk_v = 0.0
        for j in range(lo, hi):
            av = x[j] if x[j] >= 0 else -x[j]
            if av > pk_v: pk_v = av; pk_i = j
        start = max(0, pk_i - int(SR * 0.014))
        end = min(n, start + int(SR * 0.42))
        seg = x[start:end]
        if len(seg) < int(SR * 0.05): continue
        pk = max(abs(v) for v in seg)
        if pk < 1e-4: continue
        g = 0.92 / pk
        fi = int(SR * 0.004); fo = int(SR * 0.09)
        out = []
        L = len(seg)
        for idx in range(L):
            v = seg[idx] * g
            if idx < fi: v *= idx / fi
            if idx > L - fo: v *= max(0.0, (L - idx) / fo)
            out.append(v)
        name = '%s_%02d.wav' % (fsid, k)
        write_wav_mono(os.path.join(STEPS, name), out)
        made.append(name)
    return made

# --------------------------------------------------------------------------------------
def main():
    os.makedirs(STEPS, exist_ok=True)
    report = {}
    for fsid, cat, use, key, kind in I.A:
        if not key: continue
        src = find(fsid)
        if not src: print('MISSING SOURCE', fsid); continue
        dur, ch = probe(src)
        if ONLY and kind != ONLY:
            continue
        if kind == 'step':
            made = slice_steps(fsid, src)
            report[key] = {'id': fsid, 'kind': 'step', 'files': made, 'src': os.path.basename(src)}
            print('%-22s %2d slices  %s' % (key, len(made), os.path.basename(src)[:52]))
        elif kind == 'sfx' and dur <= 8.0:
            name = fsid + '.wav'
            run(['ffmpeg','-v','error','-y','-i',src,'-ar',str(SR),
                 '-ac', '1' if ch == 1 else '2','-sample_fmt','s16',
                 os.path.join(OUT, name)])
            report[key] = {'id': fsid, 'kind': 'sfx', 'file': name, 'dur': round(dur,2),
                           'src': os.path.basename(src)}
        else:
            """LENGTH IS CAPPED HERE, AND IT IS A MEMORY DECISION, NOT A DOWNLOAD ONE.

            decodeAudioData expands to 32-bit float at the context rate whatever the file
            was: a 208-second stereo drone is 73MB of RAM once decoded, and three of those
            live at once would be the whole memory budget. A bed does not need to be
            208 seconds — the engine crossfade-loops it, so 30 seconds of a wash is
            indistinguishable from all of it and costs 11MB instead. One-shots are capped
            harder because nothing in this game holds a single cue for twenty seconds."""
            name = fsid + '.mp3'
            cap = BED_CAP if kind == 'bed' else SFX_CAP
            args = ['ffmpeg','-v','error','-y','-i',src]
            if dur > cap: args += ['-t', str(cap)]
            args += ['-ar',str(SR),'-ac','1' if ch == 1 else '2',
                     '-codec:a','libmp3lame','-q:a','6', os.path.join(OUT, name)]
            run(args)
            report[key] = {'id': fsid, 'kind': kind, 'file': name,
                           'dur': round(min(dur, cap), 2), 'srcdur': round(dur, 2),
                           'capped': dur > cap, 'src': os.path.basename(src)}
    if ONLY:
        prev = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'runtime_report.json')
        if os.path.exists(prev):
            base = json.load(open(prev)); base.update(report); report = base
    json.dump(report, open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                        'runtime_report.json'), 'w'), indent=1)
    tot = sum(os.path.getsize(p) for p in glob.glob(os.path.join(OUT,'**','*'), recursive=True)
              if os.path.isfile(p))
    nfiles = len([p for p in glob.glob(os.path.join(OUT,'**','*'), recursive=True) if os.path.isfile(p)])
    print('\nruntime/: %d files, %.2f MB' % (nfiles, tot/1e6))

main()
