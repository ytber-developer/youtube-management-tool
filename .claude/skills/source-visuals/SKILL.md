---
name: source-visuals
description: Use when a content video scene is missing an image, shows the wrong image, needs a NASA photo pinned, needs a hand-drawn SVG diagram, or when checking image licenses/credits (credits.json) for Cosmic What If or Inside Your Body.
---

# Sourcing visuals

Every scene needs `images/sceneNN.jpg` (photo) or `images/sceneNN.svg` (diagram), NN = scene number, two digits. Credits are written to `credits.json` automatically and end up in the YouTube description.

## Allowed licenses — nothing else

NASA (public domain), Public Domain, **CC0**, **CC BY** (with credit), **Pixabay License**, and our own **AI illustrations** (Z-Image-Turbo, Apache-2.0, generated locally). No CC BY-SA, no NC, no ND, no "editorial use", no Google Images, no cloud AI generators.

## visual.type → source (tried in order, `SOURCE_ORDER` in `content-tools/lib/images.js`)

| type | Sources | Use for |
|---|---|---|
| `nasa` | images.nasa.gov (pin with `visual.nasa_id`) → Wikimedia Commons → AI | space, planets, missions, astronauts |
| `stock` | Pixabay (`PIXABAY_API_KEY` in `.env`, optional) → Openverse → AI | everyday life, people, objects |
| `science` | Commons (≥1200px, match ≥0.6) → Commons relaxed (≥900px, ≥0.5) → Openverse → AI | anatomy, microscopy, lab figures |
| `diagram` | hand-drawn `images/sceneNN.svg` (not fetched) | mechanisms, comparisons, scales, charts |
| `outro` | nothing — channel outro card | last scene |

The user pastes API keys into `.env` themselves. Never write a key into a file.

## AI illustrations (the last resort)

`content-tools/lib/aigen.js` + `content-tools/tts/gen_images.py` run Z-Image-Turbo on the machine (mflux on Apple Silicon, diffusers+CUDA on Windows) for every scene still missing after the free sources — in one batch per video, 1344×768, ~30–60 s/image on M4, slower on M1.
- Style is a flat editorial vector illustration in the channel palette, no text. `science`/`nasa` scenes are drawn **symbolic** (no labels, no anatomical/astronomical detail) so they never pose as a real diagram or telescope image.
- Credited as "AI-generated illustration" (`ai: true` in credits.json) → purple **AI** badge in the UI. Review these first.
- AI is wrong for anything where accuracy is the point (heart chambers, a specific nebula, a named person). For those: pin a NASA id, find a Commons file, or switch the scene to `diagram` and draw it.
- To regenerate one AI scene with a different look: delete `images/sceneNN.jpg`, optionally sharpen `visual.query`/`visual.note`, run `images` again.

## Commands

```bash
npm run content -- images <id|date|all>            # fetch only missing scenes
REFETCH=1 npm run content -- images <id>           # refetch all scenes of that video
npm run content -- slides <id>                     # re-render; missing visuals become red TODO cards
```

Then open `slides/contact.jpg` (or the /content UI) and look at **every** slide.

## Fixing a wrong image

1. Make `visual.query` concrete and visual: "astronaut floating outside space station", not "weightlessness".
2. NASA: find the right item on images.nasa.gov and set `"nasa_id": "PIA12345"` in the scene's `visual` — a pin always wins, and plain `images` re-downloads that scene when the pin differs from `credits.json` (no `REFETCH` needed). Pins are the fix for the cosmic scenes that are still missing.
3. If no licensed photo fits, change the scene to `diagram` and draw it.
4. Re-run `images` then `slides`; tick **Đã duyệt ảnh** in the UI only after looking at every slide.

Reject: wrong subject (a coin for "puffed cheeks"), historical prints for modern topics, watermarks, text-heavy images, gore, low resolution (< 1280 px wide).

## Drawing an SVG diagram

The slide renderer puts the SVG on the right side over the channel's `diagramBg` gradient, so draw on a **transparent** background.

- `viewBox="0 0 900 760"`, `font-family="Avenir Next, Helvetica Neue, Arial, sans-serif"`
- Panels: `rect rx="24" fill="rgba(255,255,255,0.06)"`
- Lines: `stroke-width` 5–8, `stroke-linecap="round"`; arrows via a `<marker>`
- Text ≥ 26px, weight 600–800, ALL CAPS for labels, ≤ 4 words per label
- Palette — Cosmic: text `#d6d1ff`, accent `#ffb347`, secondary `#8f86d9`. Body: text `#e3fbff`, accent `#ffe08a`, cyan `#7fe3ff`, coral `#ff8a7a`
- One idea per diagram. Proportions and balances must match the narration (a scale "in balance" is drawn level).
- **Only label what a source states.** No guessed years, ranges or numbers.

Look at an existing one first, e.g. `content/2026-11-23/inside-your-body__01-hold-your-breath/images/scene03.svg`.

## Common mistakes

| Mistake | Fix |
|---|---|
| Image fits the words but not the meaning | Query for the thing the viewer should *see* |
| Edited script scenes, images now shifted | Scene numbers changed → `REFETCH=1` and redraw affected SVGs |
| Ticked "Đã duyệt ảnh" from the contact sheet thumbnail | Open slides full size |
| CC BY-SA image from Commons | Not allowed — find another or draw |
| AI illustration of a real named thing (Betelgeuse, Scott Kelly) | Replace with a pinned NASA/Commons image |
| Approved AI scene without opening it full size | AI hands, faces and objects can be malformed — always look |
