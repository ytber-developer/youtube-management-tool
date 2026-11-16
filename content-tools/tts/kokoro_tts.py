"""Tạo giọng đọc offline bằng Kokoro-82M (Apache-2.0).

Đầu vào (JSON qua stdin): {"voice": "am_michael", "speed": 1.0, "out": "/path/voice.wav",
                           "scenes": [["Câu 1.", "Câu 2."], ["Câu 3."]], "sentence_gap": 0.35, "scene_gap": 0.8}
Mỗi câu đọc riêng rồi ghép, chèn khoảng lặng cố định → bước canh phụ đề (silencedetect) khớp chính xác.
In tiến độ dạng "PROGRESS <0..1>" ra stdout.
"""
import json
import sys

import numpy as np
import soundfile as sf
from kokoro import KPipeline

SR = 24000


def main():
    job = json.load(sys.stdin)
    pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    total = sum(len(s) for s in job["scenes"]) or 1
    done = 0
    parts = []
    lead = np.zeros(int(SR * 0.3), dtype=np.float32)
    parts.append(lead)
    for si, scene in enumerate(job["scenes"]):
        for ki, sentence in enumerate(scene):
            for _, _, audio in pipe(sentence, voice=job["voice"], speed=job.get("speed", 1.0), split_pattern=None):
                parts.append(np.asarray(audio, dtype=np.float32))
            last = si == len(job["scenes"]) - 1 and ki == len(scene) - 1
            if not last:
                gap = job.get("scene_gap", 0.8) if ki == len(scene) - 1 else job.get("sentence_gap", 0.35)
                parts.append(np.zeros(int(SR * gap), dtype=np.float32))
            done += 1
            print(f"PROGRESS {done / total:.3f}", flush=True)
    sf.write(job["out"], np.concatenate(parts), SR)


if __name__ == "__main__":
    main()
