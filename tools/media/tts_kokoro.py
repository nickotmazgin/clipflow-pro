#!/usr/bin/env python3
"""Narration with Kokoro-82M (Apache-2.0 model, MIT kokoro-onnx runtime).

Runs inside the media venv (see tools/media/README.md). Usage:
  tts_kokoro.py <lines.json> <out-dir> [voice] [speed]
<lines.json> maps an id to the text to speak. Writes <out-dir>/<id>.wav and
prints a JSON map of id -> duration in seconds.
"""
import json
import os
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

MODEL_DIR = Path(os.environ.get('CLIPFLOW_MEDIA_TOOLS', Path.home() / '.cache' / 'clipflow-pro-media-tools'))


def main():
    lines = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    out = Path(sys.argv[2])
    voice = sys.argv[3] if len(sys.argv) > 3 else 'af_heart'
    speed = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
    out.mkdir(parents=True, exist_ok=True)
    kokoro = Kokoro(str(MODEL_DIR / 'kokoro-v1.0.onnx'), str(MODEL_DIR / 'voices-v1.0.bin'))
    durations = {}
    for key, text in lines.items():
        samples, rate = kokoro.create(text, voice=voice, speed=speed, lang='en-us')
        sf.write(out / f'{key}.wav', samples, rate)
        durations[key] = round(len(samples) / rate, 3)
    print(json.dumps(durations))


if __name__ == '__main__':
    main()
