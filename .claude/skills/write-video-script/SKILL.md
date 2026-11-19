---
name: write-video-script
description: Use when writing, editing or fixing a script.json for a content video (content/<date>/<channel>__NN-slug/), when `npm run content -- check` reports errors or warnings, or when adding a new episode to Cosmic What If or Inside Your Body.
---

# Writing a video script

Read **channel-guides** first for tone, outro, disclaimer and medical rules.

## Animated episodes (`"style": "anim"`) — the default from 2026-11-25 on

Every episode from 2026-11-25 is a **character animation**: the channel's own doodle character (big round head, curl of hair, coloured T-shirt with a star/heart) plays "you". No images, no headlines/subs. Each scene has an `anim` instead of `visual` (the outro keeps `"visual": {"type": "outro"}` and adds `"anim": {"action": "wave", "outro": true}`):

```json
{ "narration": "Soon your feet are pulled much harder than your head.",
  "anim": { "action": "stretch", "props": [{ "icon": "black-hole", "at": "right", "size": "l" }],
            "text": "SPAGHETTIFICATION", "camera": "shake" } }
```

| field | values |
|---|---|
| `action` (required) | `talk` (default gestures) · `wave` · `point` · `present` · `think` · `shocked` · `cheer` · `jump` · `walk` · `run` · `exercise` · `float` · `fall-toward` · `stretch` · `swallowed` · `hold-breath` · `breathe` · `tired` · `sick` · `shiver` · `sleep` · `yawn` · `sit` · `eat` · `drink` · `look-up` · `grow` · `shrink` · `spin` · `hidden` |
| `props` (0–4) | `{ "icon", "at", "size", "anim" }` — `icon`: a **Fluent Emoji Flat** name (kebab-case, e.g. `anatomical-heart`, `lungs`, `brain`, `tooth`, `bone`, `drop-of-blood`, `microbe`, `dna`, `pill`, `thermometer`, `alarm-clock`, `hot-beverage`, `ice`, `sun`, `full-moon`, `ringed-planet`, `globe-showing-americas`, `rocket`, `satellite`, `comet`, `milky-way`, `telescope`, `high-voltage`, `fire`, `snowflake`, `droplet`, `sneezing-face`, `hot-face`, `cold-face`) or the hand-drawn `black-hole`. Check a name with `npm run content:search`-style lookup at `https://api.iconify.design/fluent-emoji-flat.json?icons=<name>`; unknown icons are silently skipped |
| `at` | `right` (default) · `left` · `center` · `top` · `far-right` · `above` · `top-left` · `bottom-right` · `hand` (held, for `eat`/`drink`) · `bubble` (inside the thought bubble of `think`) |
| `size` | `s` · `m` (default) · `l` · `xl` |
| prop `anim` | `none` · `bob` · `spin` · `pulse` · `orbit` · `fall` · `grow` · `shrink` · `shake` · `approach` · `fade-in` |
| `face` | `smile` · `grin` · `worry` · `shock` · `think` · `sleep` · `hold` · `sick` (the mouth also moves while the narration speaks) |
| `text` | ≤ 4 words, the scene's key idea in caps (`EVENT HORIZON`, `37°C`, `20 MINUTES`) — use on ~1 scene in 3, not every scene |
| `bg` | Cosmic default `space`; also `night`, `sky`. Body default `paper`; also `room`, `park`, `lab`, `body`, `night` |
| `camera` | `drift` (default) · `zoom-in` · `zoom-out` · `shake` · `none` |

Rules for good animation:
- **Act out the sentence**: what is "you" doing or feeling? Pick the action first, then 1–2 props that show the subject. Never the same action 3 scenes in a row; use `talk` for at most a third of scenes.
- Keep props concrete and recognisable; one main prop at `right`, a small supporting one elsewhere.
- Optional `"thumbnail_anim": { "thumbAction": "shocked", "props": [...] }` at the top level picks the thumbnail pose; otherwise the first scene with props is used.
- `npm run content -- check <id>` validates every `anim` (unknown action/position/size/background are errors). Headline/sub/visual rules do not apply to animated scenes.
- Long episodes (6–8 min, `target_minutes` 6.0–7.9) have ~30–40 scenes of 25–45 words.

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
