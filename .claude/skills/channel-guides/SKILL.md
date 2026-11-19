---
name: channel-guides
description: Use when working on content for the Cosmic What If or Inside Your Body YouTube channels — choosing topics, tone, voice, visual style, posting schedule, or answering "what are the rules for this channel". Read before write-video-script, source-visuals or produce-video.
---

# Channel guides

Two English-language science channels aimed at a **US audience**. Every video is a slide video: a still image or diagram per scene, slow zoom, burned-in captions, voiceover recorded by the user on ElevenLabs.

## The channels

| | Cosmic What If | Inside Your Body |
|---|---|---|
| Promise | "What if…" space and physics scenarios, answered with real science | What your body is doing, and why |
| Tone | Awe, playful, a little dramatic | Warm, curious, reassuring — never alarmist |
| Visuals | NASA imagery first, dark purple diagrams with star field; AI illustrations in purple/indigo as last resort | Clean anatomy illustrations, teal/blue diagrams, no gore; AI illustrations in teal/navy as last resort |
| Voice (default, free) | Kokoro `am_michael` (male) | Kokoro `af_heart` (female, warm) |
| Voice (optional, paid) | ElevenLabs Adam — deep, steady | not chosen |
| Outro (exact) | `Follow Cosmic What If for more mind-bending science.` | `Follow Inside Your Body for more of the science of you.` |
| Disclaimer | none | `This video is for educational purposes only and is not medical advice.` must appear in `description` |
| Accent / base color | `#ffb347` on `#05040f` | `#ffe08a` on `#06233d` |

Branding (avatars, banners) lives in `branding/`. Colors and slide themes come from `content-tools/lib/theme.js` — change them there, never per video.

## Schedule

- Season 1: one video per day per channel, episodes 03–34, **Wed 2026-11-25 → Sat 2026-12-26**. Episodes 01–02 were dropped on 2026-11-19 (numbering is unchanged, so the first video is #03).
- Video NN posts on `2026-11-23 + (NN−1)` days, folder `content/<date>/<channel>__NN-<slug>/`.
- Post time: **12:00 PM ET**. In winter (EST, UTC−5, which covers this season) that is 00:00 Vietnam time the next day; during US daylight time it is 23:00 Vietnam time the same day.
- Length: every video is **6–8 minutes** (for watch time). `target_minutes` 6.0–7.9, rising slowly from video to video (episodes 01–08 were expanded on 2026-11-19 to 6.0 → 7.4, +0.2 per video; 09–14 stay at 6.33–9.67; 15–34 run 6.0 → 7.9). Never write a new episode under 6 minutes. Narration rate is 163 wpm, so words ≈ `target_minutes × 163`.

## Medical policy (Inside Your Body)

- Explain normal physiology. Never diagnose, prescribe doses, or tell viewers to start/stop a treatment.
- Any claim about health effects needs a source from NIH/NCBI, CDC, Mayo Clinic, Cleveland Clinic, NHS, or a peer-reviewed review.
- If a topic touches risk (sleep loss, holding breath, caffeine), say when to see a doctor in plain words, and keep the disclaimer.
- No shock imagery: no blood, surgery photos, or diseased tissue.

## Accuracy policy (both)

- Every number in the narration must be traceable to a `sources` entry; prefer NASA, ESA, NIH, peer-reviewed reviews, university pages.
- Say "about", "roughly", "scientists think" when the science is uncertain. Never invent dates, ranges or labels on diagrams.
- Write numbers as words in narration (TTS reads them better); years may stay as digits.

## Related skills

- **write-video-script** — writing/editing `script.json`
- **source-visuals** — images, licenses, SVG diagrams
- **produce-video** — commands, daily voice workflow, the /content UI
