"""Tạo giọng đọc offline bằng Kokoro-82M (Apache-2.0).

Đầu vào (JSON qua stdin): {"voice": "am_michael", "speed": 1.0, "out": "/path/voice.wav",
                           "scenes": [["Câu 1.", "Câu 2."], ["Câu 3."]], "sentence_gap": 0.5, "scene_gap": 0.9,
                           "timings": "/path/voice.timings.json"}
Mỗi câu đọc riêng, cắt bớt im lặng Kokoro tự thêm ở hai đầu (giữ tối đa KEEP giây), rồi ghép với khoảng lặng
cố định. Nếu có "timings": ghi mốc bắt đầu/kết thúc thật của từng câu (giây) → phụ đề khớp chính xác,
không phải đoán lại bằng silencedetect.
In tiến độ dạng "PROGRESS <0..1>" ra stdout.
"""
import json
import sys

import numpy as np
import soundfile as sf
from kokoro import KPipeline

SR = 24000
TRIM_DB = -45   # dưới ngưỡng này coi là im lặng
KEEP = 0.1      # giữ lại tối đa 0.1s im lặng ở mỗi đầu câu (không cắt cụt phụ âm cuối)


def trim(audio, sr=SR):
    thr = 10 ** (TRIM_DB / 20)
    idx = np.flatnonzero(np.abs(audio) > thr)
    if idx.size == 0:
        return audio
    keep = int(sr * KEEP)
    return audio[max(0, idx[0] - keep):min(len(audio), idx[-1] + keep + 1)]


def main():
    job = json.load(sys.stdin)
    pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    total = sum(len(s) for s in job["scenes"]) or 1
    done = 0
    parts = [np.zeros(int(SR * 0.3), dtype=np.float32)]
    pos = len(parts[0])
    sentences, timings = [], []
    for si, scene in enumerate(job["scenes"]):
        for ki, sentence in enumerate(scene):
            chunks = [np.asarray(a, dtype=np.float32)
                      for _, _, a in pipe(sentence, voice=job["voice"], speed=job.get("speed", 1.0), split_pattern=None)]
            audio = trim(np.concatenate(chunks)) if chunks else np.zeros(int(SR * 0.2), dtype=np.float32)
            parts.append(audio)
            sentences.append(sentence)
            timings.append({"start": round(pos / SR, 3), "end": round((pos + len(audio)) / SR, 3)})
            pos += len(audio)
            last = si == len(job["scenes"]) - 1 and ki == len(scene) - 1
            if not last:
                gap = job.get("scene_gap", 0.9) if ki == len(scene) - 1 else job.get("sentence_gap", 0.5)
                silence = np.zeros(int(SR * gap), dtype=np.float32)
                parts.append(silence)
                pos += len(silence)
            done += 1
            print(f"PROGRESS {done / total:.3f}", flush=True)
    sf.write(job["out"], np.concatenate(parts), SR)
    if job.get("timings"):
        with open(job["timings"], "w", encoding="utf-8") as f:
            json.dump({"sentences": sentences, "timings": timings, "duration": round(pos / SR, 3)}, f, ensure_ascii=False)


if __name__ == "__main__":
    main()
