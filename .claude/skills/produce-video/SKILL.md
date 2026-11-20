---
name: produce-video
description: Use when building, rendering or voicing videos for the content pipeline (Cosmic What If, Inside Your Body) — "build video", "làm video", "tạo giọng", "render", setting up the pipeline on a new Mac or Windows machine, preparing the daily upload, or when the /content UI or `npm run content` commands fail.
---

# Producing a video

The pipeline runs **without paid credits**: free image sources → slides → local AI voice (Kokoro) → final video. Claude is needed to write scripts and to fill scenes that have no free image (source-visuals). Local AI illustrations exist but are off by default (`AI_IMAGES=1` to enable).

## The one command

```bash
npm run content -- build <id|date|all>
```

`build` checks status on disk and runs only the missing/stale steps, in order:
`images → slides → thumb → package → preview → voice (Kokoro) → render`.
- A script with `check` errors builds nothing — fix it first (write-video-script).
- An existing `voice.mp3` (e.g. a hand-recorded ElevenLabs take) is kept; only `render` reruns.
- Kokoro writes `voice.txt` (the exact narration it read). When the script's narration no longer matches it, status shows the voice as stale ("Chờ lồng tiếng (cũ)") and `build` re-voices automatically. Edits to title/tags/anim don't trigger this. A voice without `voice.txt` (hand-made) is never re-voiced automatically.
- Run long batches in the background; `build all` takes hours.

The `/content` page is **read-only**: status table + a detail page per video with everything to post (video, thumbnail, title, description, tags, captions, post time, copy buttons). Every action runs from chat through `npm run content`.

## Single steps

`npm run content -- <command> <target>` — target is an id (`2026-11-25/cosmic-what-if__03-hole-through-the-earth`), a date, a folder prefix, or `all`.

| Command | Produces | Notes |
|---|---|---|
| `check` | validation report | |
| `images` | images/*.jpg, credits.json | free sources, then AI (see source-visuals). `REFETCH=1` refetches all |
| `slides` | slides/sceneNN.png, contact.jpg | |
| `thumb` | thumbnail.png 1280×720 | |
| `package` | narration.txt, metadata.md | |
| `preview` | preview.mp4 (silent) | |
| `voice` | voice.mp3 via Kokoro, then final.mp4 | skips if voice exists; `REVOICE=1` overwrites; `VOICE=am_fenrir SPEED=1.1` to try others |
| `render` | final.mp4 + captions.srt | needs voice.mp3 |

Tests: `npm run test:content`.

## Setup on a new machine (Mac or Windows)

```bash
# macOS (Apple Silicon M1–M4, ≥16 GB RAM for AI images)
brew install python@3.12 ffmpeg
# Windows
winget install Python.Python.3.12 ; winget install Gyan.FFmpeg

npm install
npm run migrate
npm run content:setup          # .venv-tts (Kokoro) + .venv-img (mflux on Mac / diffusers+CUDA on Windows)
npm run content:setup -- tts   # voice only
```

- First run downloads models from Hugging Face: Kokoro ~330 MB, Z-Image-Turbo 4-bit several GB (to `~/.cache/huggingface`).
- Windows AI images need an NVIDIA GPU with ≥ 12 GB VRAM; without one, setup skips it and missing scenes show red TODO cards. **The Windows path is untested** — if `gen_images.py` fails, read its error and fix `torch_generator` in `content-tools/tts/gen_images.py`.
- Media is gitignored (images/*.jpg, slides/, thumbnail.png, mp4, mp3, srt). On a fresh clone, `build` regenerates it; copy `content/` over instead to keep already-reviewed images.

## Voices (Kokoro, Apache-2.0, offline)

Set per channel in `content-tools/lib/channels.js` (`ttsVoice`, optional `ttsSpeed`). Current: Cosmic `am_michael`, Body `af_heart`. Others: `af_bella`, `af_nicole`, `am_fenrir`, `am_puck`. Kokoro reads each sentence separately, trims its own trailing silence, inserts fixed gaps (0.5 s sentence, 0.9 s scene) and writes the exact start/end of every sentence to `voice.timings.json`; `render` uses that file, so captions match the voice exactly. Voices made before this file existed (or hand-recorded ElevenLabs takes) fall back to silence detection, which drifts on long videos — re-voice them with `REVOICE=1`. Kokoro reads a bit slower than 163 wpm → videos run ~10–20% longer than `target_minutes`; raise `ttsSpeed` (e.g. 1.1) if that matters.

ElevenLabs is optional: save the take as the video's `voice.mp3` (convert m4a/wav with `ffmpeg -i take.m4a -codec:a libmp3lame -q:a 2 voice.mp3`), then `npm run content -- render <id>`.

## Daily routine

1. Open today's two videos on `/content`. If not built: `npm run content -- build <date>`.
2. Watch `final.mp4`. Check every scene with the purple **AI** badge; reject → fix per source-visuals, rebuild.
3. (Slide-style videos only) after looking at every slide, set `"imagesReviewed": true` in the video's `review.json`. Animated videos skip this step.
4. Upload with title/description/tags copied from the detail page + `thumbnail.png` + `captions.srt`, scheduled 12:00 PM ET.
5. Mark it posted: `npm run content -- uploaded <id> https://youtu.be/…` (`-` instead of the link un-marks it).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Chưa cài Kokoro (.venv-tts)" | `npm run content:setup -- tts` |
| AI images never appear, scenes stay missing | `.venv-img` missing → `npm run content:setup -- img`; Windows without NVIDIA → hand-fix scenes |
| Mac runs out of memory during AI images | close Chrome/other apps; 16 GB is the minimum |
| ffmpeg "No such filter: drawtext/subtitles" | Expected — captions are PNG overlays. Don't add those filters. |
| Captions drift | no `voice.timings.json` next to voice.mp3 (old or hand-recorded voice), or narration changed after voicing → `REVOICE=1 npm run content -- voice <id>` |
| `build` stops "Còn thiếu ảnh cảnh …" | no free image → fix per source-visuals (pin / Commons / SVG); AI only if the user enables `AI_IMAGES=1` |
| UI shows nothing | backend `PORT` (.env) ≠ frontend `NEXT_PUBLIC_API_URL` |
| Upload rejected | only real audio .mp3/.m4a/.wav ≤ 50 MB (checked with ffprobe) |
