---
name: write-video-script
description: Use when writing, editing or fixing a script.json for a content video (content/<date>/<channel>__NN-slug/), when `npm run content -- check` reports errors or warnings, or when adding a new episode to Cosmic What If or Inside Your Body.
---

# Writing a video script

Read **channel-guides** first for tone, outro, disclaimer and medical rules.

## The file

`content/<date>/<channel>__NN-<slug>/script.json`:

```json
{
  "channel": "inside-your-body", "number": 1, "slug": "hold-your-breath",
  "target_minutes": 1.0,
  "title": "What Happens to Your Body When You Hold Your Breath?",
  "thumbnail_text": "HOLD YOUR BREATH",
  "description": "…\n\nThis video is for educational purposes only and is not medical advice.",
  "tags": ["breath holding", "human body", "science"],
  "sources": [{ "title": "NCBI — Physiology, Respiration", "url": "https://…" }],
  "scenes": [{
    "narration": "Your lungs hold enough oxygen to keep you going for about four minutes. …",
    "headline": "FOUR MINUTES OF <em>OXYGEN</em>",
    "sub": "Most people quit after one",
    "visual": { "type": "science", "query": "human lungs anatomy illustration", "note": "clean anatomical illustration" }
  }]
}
```

`visual.type` is `nasa` | `stock` | `science` | `diagram` | `outro` — see **source-visuals**.

## Rules the checker enforces

Run `npm run content -- check <id|date|all>`. It enforces (see `content-tools/lib/check.js`):

- total narration words within **±7%** of `target_minutes × 163`
- scene 1 (hook) ≤ 25 words; middle scenes 20–60 words (warning under 25)
- last scene narration is exactly the channel outro and `visual.type` is `outro`
- headline ≤ 6 words with exactly one `<em>…</em>`; sub ≤ 8 words
- title ≤ 70 characters; `thumbnail_text` ≤ 4 words; ≥ 2 sources
- Inside Your Body: description contains the disclaimer
- digits in narration → warning (years allowed)

Fix every error and read every warning. Don't loosen the checker to pass a script.

## Judgement the checker can't make

1. **Hook in the first sentence**: the question in the title, asked to "you". Example: "What if you fell into a black hole?"
2. **One idea per scene.** A scene is one slide; if you need two images, it's two scenes.
3. **Escalate**: each scene raises a new stake or surprise; the payoff comes before the outro.
4. **Write for the ear**: short sentences, numbers as words, spell out what TTS mispronounces ("Sagittarius A star"). Add the on-screen spelling to `CAPTION_DISPLAY` in `content-tools/lib/channels.js`.
5. **Every fact has a source** in `sources`. If you can't source it, cut it.
6. **Headlines are the slide text**, not a summary of the narration: punchy, ALL CAPS, the `<em>` word is the payoff.
7. **Title**: curiosity + plain words a US viewer searches for. No clickbait the video doesn't pay off.
8. Aim for 30–45 words per middle scene (the checker's hard limits are 20–60). Longer videos get more scenes, not longer ones.

## After editing

```bash
npm run content -- check <id>        # must pass
npm run content -- package <id>      # narration.txt + metadata.md
```

Then continue with **source-visuals** (new/changed scenes) and **produce-video**.

## Common mistakes

| Mistake | Fix |
|---|---|
| Changed narration, forgot `package` | narration.txt is stale → UI shows wrong text to record |
| Outro paraphrased | Copy it exactly from channel-guides |
| Digit "4 minutes" in narration | "four minutes" |
| Two `<em>` in a headline | Exactly one |
| Diagram label invented ("1988–97") | Only label what a source states |
