"""demerit demo videos: the voice drives the edit (pipeline from Tidewater / Hireclaw).
  usage: VIDEO=gaia|baptiste ; python -I video.py tts (via with-secrets.ps1) ; node capture.mjs <v> ; python -I video.py assemble

  1. tts       ElevenLabs voice for every line of lines.json -> voice/<id>.mp3 + voice/durations.json
               (key injected by with-secrets.ps1 as SCAN_ELEVENLABS_2, never printed; voice id in $env:VOICE_ID)
  2. capture.js plays each shot for exactly its line's duration and records the marks
  3. assemble  frames -> 30 fps video, set-up time cut out, captions in a band under the picture,
               each line of voice placed at its mark -> tidewater-demo.mp4
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
VID = os.environ.get("VIDEO", "gaia")
SPEC = json.loads((HERE / f"lines-{VID}.json").read_text(encoding="utf-8"))
VOICE = HERE / f"voice-{VID}"
RAW = HERE / f"raw-{VID}"
LINES = SPEC["lines"]
W, H, BAND = 1440, 810, 110       # picture, then the caption band under it
FPS = 30
MODEL = "eleven_v3"
TEMPO = float(os.environ.get("TEMPO", "1.1"))
TAIL = 0.5                        # hold after the last line
GAP = 0.12                        # breath between two lines (capture.js uses the same)
OUT = HERE / SPEC["out"]


def run(*cmd: str) -> str:
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.strip()


def duration(p: Path) -> float:
    return float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)))


def fetch(line: dict, key: str, voice_id: str, out: Path) -> None:
    # eleven_v3 reads the [audio tags] as intonation; stability 0.5 = "natural"
    body = json.dumps({"text": line["text"], "model_id": MODEL,
                       "voice_settings": {"stability": 0.5, "similarity_boost": 0.8}}).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128",
        data=body, headers={"xi-api-key": key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            out.write_bytes(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs {e.code}: {e.read().decode()[:300]}")


def tts() -> None:
    raw = os.environ.get("SCAN_ELEVENLABS_2", "").strip()
    key = "s" + raw[1:] if raw[:3].lower() == "sk_" else raw   # vault copy starts with 'Sk_'
    voice_id = SPEC["voice"]
    VOICE.mkdir(exist_ok=True)
    durs = {}
    for line in LINES:
        out = VOICE / f"{line['id']}.mp3"
        stamp = VOICE / f"{line['id']}.txt"
        tag = voice_id + "|" + MODEL + "|" + line["text"]   # a new voice regenerates every line
        if not out.exists() or not stamp.exists() or stamp.read_text(encoding="utf-8") != tag:
            if not key:
                sys.exit("SCAN_ELEVENLABS_2 missing: run through with-secrets.ps1")
            fetch(line, key, voice_id, out)
            stamp.write_text(tag, encoding="utf-8")
        # trim the silence v3 leaves around each line, then a light speed-up (pitch kept)
        fx = VOICE / f"{line['id']}.fx.wav"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(out), "-af",
                        "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                        "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                        # long pauses inside a line are capped (v3 leaves up to a second at commas)
                        "silenceremove=stop_periods=-1:stop_duration=0.4:stop_threshold=-42dB:stop_silence=0.32,"
                        f"atempo={TEMPO},apad=pad_dur=0.05", str(fx)], check=True)
        durs[line["id"]] = round(duration(fx), 3)
        print(f"{line['id']:8s} {durs[line['id']]:5.2f} s")
    (VOICE / "durations.json").write_text(json.dumps(durs, indent=1))
    print(f"total voice {sum(durs.values()):.1f} s")


def timeline():
    """Kept frames with their output durations, and each mark mapped to output time."""
    frames = json.loads((RAW / "frames.json").read_text())        # [[file, epoch_s], ...]
    frames.sort(key=lambda f: f[1])
    meta = json.loads((RAW / "marks.json").read_text())           # {"marks": {id: epoch}, "cuts": [[a, b]], "stop": epoch}
    cuts, stop = meta["cuts"], meta["stop"]

    def kept(a: float, b: float) -> float:                        # length of [a, b] outside the cuts
        span = max(0.0, b - a)
        for c0, c1 in cuts:
            span -= max(0.0, min(b, c1) - max(a, c0))
        return max(0.0, span)

    t0 = frames[0][1]
    out, items = {}, []
    for i, (name, ts) in enumerate(frames):
        nxt = frames[i + 1][1] if i + 1 < len(frames) else stop
        d = kept(ts, nxt)
        if d > 0.0005:
            items.append((name, d))
    for k, ts in meta["marks"].items():
        out[k] = kept(t0, ts)
    return items, out, kept(t0, stop)


def plan(marks: dict, total: float, durs: dict) -> list:
    """Each shot's footage [a, b) is retimed to exactly its voice line + GAP.

    On a calm machine the factor stays near 1. When other jobs load the CPU/GPU
    the clicks land late and a shot runs long: it is played faster instead of
    leaving the voice behind. Returns [(id, src_a, src_b, out_a, out_len)].
    """
    out, t = [], 0.0
    for i, line in enumerate(LINES):
        a = marks[line["id"]]
        b = marks[LINES[i + 1]["id"]] if i + 1 < len(LINES) else total
        n = durs[line["id"]] + GAP
        out.append((line["id"], a, b, t, n))
        t += n
    return out


def sequence(items, shots: list) -> Path:
    """Resample to a constant 30 fps image sequence (hard links, no copy), shot by shot."""
    seq = RAW / "seq"
    seq.mkdir(exist_ok=True)
    for old in seq.glob("*.jpg"):
        old.unlink()
    starts, t = [], 0.0
    for _, d in items:
        starts.append(t)
        t += d
    end = shots[-1][3] + shots[-1][4]
    k, j, s = 0, 0, 0
    while k / FPS < end:
        o = k / FPS
        while s + 1 < len(shots) and shots[s + 1][3] <= o:
            s += 1
        _, a, b, oa, n = shots[s]
        src = a + (o - oa) * (b - a) / n
        while j + 1 < len(items) and starts[j + 1] <= src:
            j += 1
        while j > 0 and starts[j] > src:
            j -= 1
        os.link(RAW / items[j][0], seq / f"{k:06d}.jpg")
        k += 1
    return seq


def assemble() -> None:
    if not all((RAW / f"cap_{l['id']}.png").exists() for l in LINES):
        sys.exit("caption PNGs missing: run capture.js first")
    items, marks, total = timeline()
    durs = json.loads((VOICE / "durations.json").read_text())
    shots = plan(marks, total, durs)
    seq = sequence(items, shots)
    total = shots[-1][3] + shots[-1][4]
    inputs = ["-framerate", str(FPS), "-i", str(seq / "%06d.jpg")]
    vf = [f"[0:v]scale={W}:{H}:flags=lanczos,pad={W}:{H + BAND}:0:0:color=0x0d0719,"
          f"tpad=stop_mode=clone:stop_duration={TAIL},setpts=PTS-STARTPTS[v0]"]
    af = []
    for i, line in enumerate(LINES):
        _, sa, sb, a, n = shots[i]
        b = a + n if i + 1 < len(LINES) else total + TAIL
        inputs += ["-loop", "1", "-i", str(RAW / f"cap_{line['id']}.png")]
        inputs += ["-i", str(VOICE / f"{line['id']}.fx.wav")]
        img, snd = 1 + 2 * i, 2 + 2 * i
        vf.append(f"[v{i}][{img}:v]overlay=0:{H}:enable='between(t,{a:.3f},{b - 0.05:.3f})':shortest=1[v{i + 1}]")
        af.append(f"[{snd}:a]adelay={int(a * 1000)}:all=1[a{i}]")
        print(f"{line['id']:8s} at {a:6.2f} s  voice {durs[line['id']]:5.2f} s  filmed {sb - sa:5.2f} s  x{(sb - sa) / n:4.2f}")
    n = len(LINES)
    mix = "".join(f"[a{i}]" for i in range(n))
    graph = ";".join(vf + af + [f"{mix}amix=inputs={n}:normalize=0,loudnorm=I=-16:TP=-1.5,apad[aout]"])
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", graph,
                    "-map", f"[v{n}]", "-map", "[aout]", "-t", f"{total + TAIL:.3f}",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(OUT)],
                   check=True, cwd=RAW)
    print(f"done: {OUT} ({duration(OUT):.1f} s)")


if __name__ == "__main__":
    {"tts": tts, "assemble": assemble}[sys.argv[1] if len(sys.argv) > 1 else os.environ.get("STAGE", "")]()
