---
name: produce-video
description: Use when rendering slides, thumbnails, previews or final videos for the content pipeline, when the user has recorded a voiceover (voice.mp3) and wants the final video, when preparing the daily upload, or when something in the /content UI or `npm run content` commands fails.
---

# Producing a video

Everything is done ahead of time **except the voiceover**. Each day the user records the voice on ElevenLabs (on their Mac), drops it into the UI, gets `final.mp4`, and uploads.

## Prerequisites

Node 22, Homebrew `ffmpeg`/`ffprobe`, Chrome (Puppeteer renders slides). `PIXABAY_API_KEY` goes in the repo `.env`, pasted by the user. The Inside Your Body voice must be chosen (channel-guides) before its first render.

## Commands

`npm run content -- <command> <target>` — target is a video id (`2026-11-23/cosmic-what-if__01-fell-into-a-black-hole`), a date (`2026-11-23`), a folder prefix, or `all`.

| Command | Produces | Needs |
|---|---|---|
| `check` | validation report | script.json |
| `images` | images/*.jpg, credits.json | network (see source-visuals) |
| `slides` | slides/sceneNN.png, slides/contact.jpg | images or svg per scene |
| `thumb` | thumbnail.png 1280×720 | scene images |
| `package` | narration.txt, metadata.md | script.json, credits.json |
| `preview` | preview.mp4 (silent, estimated timing) | slides |
| `render` | final.mp4 + captions.srt | slides + **voice.mp3** |

Full prep for a day: `check → images → slides → thumb → package → preview`. Tests: `npm run test:content`.

Media files (jpg, slides/, thumbnail.png, mp4, mp3, srt) are gitignored. `script.json`, `credits.json`, `review.json`, `narration.txt`, `metadata.md` and `images/*.svg` are committed.

## The /content UI

Frontend `/content` (backend `/api/v1/content`):
- List: grouped by post date, thumbnail, title, stage, 8 step dots (green done, grey todo, amber stale, red error).
- Detail: action buttons (run on a serial job queue), voice drop-zone, players, copy buttons for title/description/tags/metadata, scene-by-scene script with slides, **Đã duyệt ảnh** and uploaded-link fields (saved to `review.json`).

Status is computed from files on disk (`content-tools/lib/status.js`), so after running a CLI command the UI is already up to date. A step turns amber when its inputs are newer than its output — re-run it.

## Daily voice workflow (the user's routine)

1. Open today's two videos in `/content`.
2. Click **Copy lời đọc** → paste into ElevenLabs with the channel voice (channel-guides). Paragraph breaks = scene breaks; keep them.
3. Download the mp3 → drag it onto the voice drop-zone. The backend converts it to `voice.mp3` and queues `render`.
4. Watch `final.mp4`; check captions line up.
5. Upload to YouTube with the copied title/description/tags and `thumbnail.png`, scheduled for 12:00 PM ET.
6. Paste the YouTube link into **Link sau khi đăng** → stage becomes "Đã đăng".

## How render aligns the voice

`render` uses ffmpeg `silencedetect` and a DP that maps sentence ends to pauses (`content-tools/lib/align.js`). If captions drift: the voice probably skipped or merged sentences, or narration.txt was stale when recorded. Re-run `package`, re-record that video, render again.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| ffmpeg "No such filter: drawtext/subtitles" | Expected — Homebrew ffmpeg lacks them; captions are PNG overlays. Don't add those filters. |
| Red TODO card on a slide | Missing image/svg for that scene → source-visuals |
| `render` button disabled | No voice.mp3 yet |
| Job stuck "đang chờ" | Queue is serial; one job runs at a time |
| UI shows nothing | Backend not on `PORT` from `.env` / frontend `NEXT_PUBLIC_API_URL` mismatch |
| Upload rejected | Only .mp3/.m4a/.wav, ≤ 50 MB. Export a lower-bitrate mp3 from ElevenLabs, or place it as `voice.mp3` in the video folder and run `render` |
