---
name: source-visuals
description: Use when a content video scene is missing an image, shows the wrong image, needs a NASA photo pinned, needs a hand-drawn SVG diagram, or when checking image licenses/credits (credits.json) for Cosmic What If or Inside Your Body.
---

# Sourcing visuals

Every scene needs `images/sceneNN.jpg` (photo) or `images/sceneNN.svg` (diagram), NN = scene number, two digits. Credits are written to `credits.json` automatically and end up in the YouTube description.

## Allowed licenses — nothing else

NASA (public domain), Public Domain, **CC0**, **CC BY** (with credit), **Pixabay License**. No CC BY-SA, no NC, no ND, no "editorial use", no Google Images, no AI-generated look-alikes of real objects.

## visual.type → source

| type | Fetched from | Use for |
|---|---|---|
| `nasa` | images.nasa.gov (pin with `visual.nasa_id`) | space, planets, missions, astronauts |
| `stock` | Pixabay (needs `PIXABAY_API_KEY` in `.env`), then Openverse | everyday life, people, objects |
| `science` | Wikimedia Commons (science images only), then Openverse | anatomy, microscopy, lab figures |
| `diagram` | hand-drawn `images/sceneNN.svg` (not fetched) | mechanisms, comparisons, scales, charts |
| `outro` | nothing — channel outro card | last scene |

The user pastes API keys into `.env` themselves. Never write a key into a file.

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
