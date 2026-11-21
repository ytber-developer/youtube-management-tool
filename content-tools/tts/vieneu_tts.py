"""Đọc nhiều đoạn tiếng Việt bằng VieNeu-TTS v3 Turbo (CPU/ONNX) trong một lần tải model.

Dùng:  .venv-tts-vi/bin/python content-tools/tts/vieneu_tts.py jobs.json
jobs.json: { "voice": "Hải Đăng", "jobs": [ { "text": "...", "out": "/abs/path/s0.wav" }, ... ] }
In ra một dòng JSON mỗi job: {"out": ..., "seconds": ...}
"""
import json
import pathlib
import sys
import time

import numpy as np
import soundfile as sf
from vieneu import Vieneu

spec = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
voice = spec.get('voice') or 'Hải Đăng'
t0 = time.time()
tts = Vieneu()
sr = getattr(tts, 'sample_rate', None) or getattr(tts, 'sr', None) or 48000
print(json.dumps({'model_ready_seconds': round(time.time() - t0, 1), 'sample_rate': sr}), flush=True)

for job in spec['jobs']:
    t1 = time.time()
    audio = np.asarray(tts.infer(job['text'], voice=voice), dtype=np.float32).squeeze()
    out = pathlib.Path(job['out'])
    out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(out, audio, sr)
    print(json.dumps({'out': str(out), 'seconds': round(len(audio) / sr, 2), 'gen_seconds': round(time.time() - t1, 1)}, ensure_ascii=False), flush=True)
