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

# --------------------------------------------------------------------------------------
# LOUDNESS, AND WHY THIS IS THE MOST IMPORTANT THING IN THE FILE.
#
# The first build of this directory copied every asset at its recorded level. Measured
# afterwards, the bed library spanned 64 dB from quietest to loudest — a room tone at
# -67 dBFS RMS next to a drone at -3. The mix table in game.html then gave each of them a
# hand-written level between 0.05 and 0.42 as if they were all the same loudness, so the
# Overworld's day bed reached the player at about -56 dBFS and its interior room tone at
# about -82. A human playtest reported the game "nearly silent apart from footsteps",
# which is exactly what those numbers predict.
#
# So loudness is MEASURED and CORRECTED here, at build time, once. After this every asset
# of a class arrives at the same reference level, which means a number in AUDIO_SCENES is
# a real mix decision — "the crop layer sits 8 dB under the field" — instead of a guess
# about a file nobody measured.
#
# It is done here rather than as a runtime gain because a runtime gain would have to be
# stored per asset, kept in step with the file, and applied on every voice; and because a
# value baked into the file is one a later phase can verify with ffmpeg instead of by
# reading code.
# --------------------------------------------------------------------------------------
TARGET_RMS = {'bed': -26.0, 'sfx': -20.0, 'step': -22.0}   # dBFS
PEAK_CEIL  = -1.5      # no asset may clip once its gain is applied
# A room tone recorded at -67 dBFS needs more than 30 dB to reach a usable level, and its
# own noise floor IS the content — that is what a room tone is. Beds get more headroom to
# climb than one-shots, whose quiet parts are silence and should stay silent.
MAX_BOOST  = {'bed': 42.0, 'sfx': 26.0, 'step': 26.0}

def measure(path, extra_in=None):
    """mean (RMS) and max (peak) level in dBFS, straight from ffmpeg's volumedetect."""
    args = ['ffmpeg', '-v', 'info']
    if extra_in: args += extra_in
    args += ['-i', path, '-af', 'volumedetect', '-f', 'null', '-']
    r = subprocess.run(args, capture_output=True, text=True)
    mean = peak = None
    for line in r.stderr.splitlines():
        if 'mean_volume:' in line: mean = float(line.split('mean_volume:')[1].split('dB')[0])
        if 'max_volume:' in line:  peak = float(line.split('max_volume:')[1].split('dB')[0])
    return mean, peak

def window_rms_db(path, win=0.30, extra_in=None):
    """The RMS of the LOUDEST `win` seconds, which is what a one-shot's loudness actually
    is. Whole-file RMS is the wrong measure for a sparse cue: a two-second file holding a
    single 80ms door click is mostly silence, so its mean level reads 20 dB below a
    continuous sound the ear judges equally loud, and normalising on that number makes
    every transient cue far too quiet. Fifty of the hundred and ten cues were being
    mismeasured this way."""
    args = ['ffmpeg', '-v', 'error']
    if extra_in: args += extra_in
    args += ['-i', path, '-ac', '1', '-ar', '22050', '-f', 'f32le', '-']
    r = subprocess.run(args, capture_output=True)
    a = array.array('f'); a.frombytes(r.stdout)
    n = len(a)
    if not n: return None, None
    peak = max(abs(v) for v in a)
    w = max(1, int(22050 * win))
    if n <= w:
        acc = sum(v * v for v in a)
        best = acc / n
    else:
        acc = sum(a[i] * a[i] for i in range(w))
        best = acc
        for i in range(w, n):
            acc += a[i] * a[i] - a[i - w] * a[i - w]
            if acc > best: best = acc
        best /= w
    import math as _m
    to_db = lambda x: 20 * _m.log10(max(x, 1e-9))
    return to_db(_m.sqrt(best)), to_db(peak)


def gain_for(path, kind, extra_in=None):
    """dB of gain that puts this file on its class reference without clipping it."""
    if kind == 'sfx':
        mean, peak = window_rms_db(path, 0.30, extra_in)
    else:
        mean, peak = measure(path, extra_in)
    if mean is None or peak is None: return 0.0, None, None
    want = TARGET_RMS[kind] - mean
    want = min(want, MAX_BOOST[kind])
    want = min(want, PEAK_CEIL - peak)        # never push the peak past the ceiling
    return round(want, 2), mean, peak

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
    cuts = []
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
        # RMS, NOT PEAK. Peak-normalising every footfall to 0.92 was the first version and
        # it is why a human playtester reported that all surfaces "sound effectively the
        # same": gravel, grass and boards are different partly in spectrum and largely in
        # LEVEL, and flattening every transient onto one ceiling throws the second half of
        # that away. Normalising the ENERGY instead keeps a step on stone louder than a
        # step in mud, which is what it is.
        rmsv = math.sqrt(sum(v * v for v in seg) / len(seg))
        if rmsv < 1e-5: continue
        cuts.append((seg, pk, rmsv, k))
        continue
    # ONE GAIN FOR THE WHOLE SET, not one per slice. Normalising each footfall
    # individually would make every step in a set exactly as loud as every other, which
    # deletes the natural heavy-step/light-step dynamic that makes a walk sound like a
    # person rather than a metronome. The SET is levelled against the other sets; inside
    # it, the recording keeps its own dynamics.
    if not cuts: return []
    setRms = math.sqrt(sum(r * r for _, _, r, _ in cuts) / len(cuts))
    gset = (10 ** (TARGET_RMS['step'] / 20.0)) / max(setRms, 1e-6)
    gset = min(gset, 10 ** (MAX_BOOST['step'] / 20.0))
    worst = max(pk for _, pk, _, _ in cuts)
    gset = min(gset, (10 ** (PEAK_CEIL / 20.0)) / max(worst, 1e-6))
    for seg, pk, rmsv, k in cuts:
        g = gset
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
            gdb, mean, peak = gain_for(src, 'sfx')
            run(['ffmpeg','-v','error','-y','-i',src,'-af','volume=%.2fdB' % gdb,
                 '-ar',str(SR),'-ac', '1' if ch == 1 else '2','-sample_fmt','s16',
                 os.path.join(OUT, name)])
            report[key] = {'id': fsid, 'kind': 'sfx', 'file': name, 'dur': round(dur,2),
                           'src': os.path.basename(src), 'gain_db': gdb, 'src_rms': mean}
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
            trim = ['-t', str(cap)] if dur > cap else []
            # Measured over the SAME window that will be encoded, not over the whole file:
            # a 200-second drone that fades in has a very different mean level from its
            # first thirty seconds, and the first thirty seconds are what ships.
            gdb, mean, peak = gain_for(src, kind, extra_in=trim)
            args = ['ffmpeg','-v','error','-y','-i',src] + trim
            args += ['-af','volume=%.2fdB' % gdb,
                     '-ar',str(SR),'-ac','1' if ch == 1 else '2',
                     '-codec:a','libmp3lame','-q:a','6', os.path.join(OUT, name)]
            run(args)
            report[key] = {'id': fsid, 'kind': kind, 'file': name,
                           'dur': round(min(dur, cap), 2), 'srcdur': round(dur, 2),
                           'capped': dur > cap, 'src': os.path.basename(src),
                           'gain_db': gdb, 'src_rms': mean}
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
