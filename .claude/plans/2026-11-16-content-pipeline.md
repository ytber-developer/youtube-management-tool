# Content Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the slide-video pipeline into the repo as `npm run content:*` commands, a `/content` control page in the tool, and Claude skills, with the 28 videos organised under `content/<date>/`.

**Architecture:** Pure logic lives in `content-tools/lib/*` (CommonJS, no new deps) and is shared by a thin CLI (`content-tools/cli.js`) and the Express backend (`src/services/content.service.js`), which adds a serial job queue and status computed from files on disk. The Next.js frontend gets list + detail pages that call `/api/v1/content`. Media is gitignored; only sources (script, credits, narration, metadata, SVG) are tracked.

**Tech Stack:** Node 22 CommonJS, Puppeteer (already a dependency), system ffmpeg/ffprobe (Homebrew on this Mac), Express + multer (existing), Next.js 14 + Tailwind (existing), tests with built-in `node:test`.

**Spec:** `.claude/specs/2026-11-16-content-pipeline-design.md`

## Global Constraints
- Content root: `content/` at repo root. Video id format: `YYYY-MM-DD/<channel>__NN-<slug>`, channel ∈ `cosmic-what-if`, `inside-your-body`; regex `^\d{4}-\d{2}-\d{2}/(cosmic-what-if|inside-your-body)__\d{2}-[a-z0-9-]+$`.
- Schedule: video NN of each channel publishes on 2026-11-23 + (NN−1) days; both channels the same day; 14 days (ends 2026-12-06). Suggested post time: 12:00 PM ET = 00:00 Vietnam time the next calendar day.
- Narration speed for estimates: 163 words/minute. Word count tolerance ±7% of `target_minutes × 163`.
- Allowed image licenses: NASA, Public Domain, CC0, CC BY (any version), Pixabay Content License. Never BY-SA, NC, ND.
- Gitignored inside `content/`: `images/*.jpg`, `slides/`, `thumbnail.png`, `preview.mp4`, `voice.mp3`, `final.mp4`, `captions.srt`, `caps/`. Tracked: `script.json`, `credits.json`, `narration.txt`, `metadata.md`, `review.json`, `images/*.svg`, `content/schedule.json`.
- API only reads/writes inside `content/`; no shell command built from request input. Commits as `ytber-developer <thuanlv0410@gmail.com>`.
- Slides 1920×1080, thumbnails 1280×720, video H.264 30 fps + AAC.

## Review Focus
- Voice files whose pauses don't match sentence count (extra breaths, merged sentences): alignment must still return monotonic, gap-free timings that end at the audio duration (Task 5 test `align tolerates extra and missing pauses`).
- Uploading a non-audio or oversized file as voice: rejected with a clear message, nothing written (Task 7 test `voice upload rejects non-mp3`).
- A video id containing `..` or an unknown folder in any API route or static file URL: 404, never reads outside `content/` (Task 7 test `rejects traversal ids`).
- Two jobs triggered at once for the same video (double click): run one after another, never in parallel (Task 7 test `queue runs jobs serially`).
- Script or image edited after slides were rendered: status shows slides as stale (Task 7 test `slides stale when script newer`).

---

### Task 1: Content layout, schedule and migration

**Files:**
- Create: `content-tools/lib/paths.js`, `content-tools/lib/schedule.js`, `content-tools/migrate.js`, `content-tools/test/paths.test.js`, `content-tools/test/schedule.test.js`
- Modify: `.gitignore`, `package.json` (scripts `content`, `test:content`)

**Interfaces:**
- Produces: `paths.CONTENT_ROOT: string`; `paths.isValidId(id: string): boolean`; `paths.resolveVideoDir(id: string): string | null` (null if invalid or missing); `paths.listVideoIds(): string[]` (sorted by date then channel); `schedule.dateFor(number: number, start = '2026-11-23'): string`; `schedule.build(videos: {channel, number, slug, title}[]): {date, videos: {id, channel, number, title}[]}[]`.

- [ ] **Step 1: Tests** — `dateFor(1) === '2026-11-23'`, `dateFor(14) === '2026-12-06'`; `isValidId('2026-11-23/cosmic-what-if__01-fell-into-a-black-hole') === true`, `isValidId('../etc')`, `isValidId('2026-11-23/other__01-x')`, `isValidId('2026-11-23/cosmic-what-if__01-x/../..')` all `false`.
- [ ] **Step 2:** `node --test content-tools/test` → FAIL (modules missing).
- [ ] **Step 3: Implement** paths + schedule. `migrate.js` copies each `../ytb-content/<channel>/<NN-slug>/` (script.json, credits.json, images/, slides/) to `content/<dateFor(NN)>/<channel>__<NN-slug>/` and writes `content/schedule.json` via `schedule.build`. Copy, never move (source stays as backup).
- [ ] **Step 4:** tests PASS; run `node content-tools/migrate.js` → 28 folders, `schedule.json` has 14 dates × 2 videos.
- [ ] **Step 5:** add gitignore rules from Global Constraints; `git status` shows only tracked kinds. Commit.

### Task 2: Script validator (`content:check`)

**Files:**
- Create: `content-tools/lib/check.js`, `content-tools/cli.js`, `content-tools/test/check.test.js`

**Interfaces:**
- Produces: `check.validateScript(script: object): {ok: boolean, errors: string[], warnings: string[], words: number, target: number}`; CLI `node content-tools/cli.js <cmd> <target>` where target is a video id, a date (`2026-11-23`), or `all`; `cli.resolveTargets(target): string[]`.

- [ ] **Step 1: Tests** using the migrated black-hole script as fixture: valid → `ok`. Mutations each produce one error: words outside ±7%; middle scene > 60 words; first scene > 25 words; last scene not the channel outro (`Follow Cosmic What If for more mind-bending science.` / `Follow Inside Your Body for more of the science of you.`); headline > 6 words or not exactly one `<em>`; digits in narration other than 4-digit years (warning, not error); missing `visual`; body channel description without `This video is for educational purposes only and is not medical advice.`; fewer than 2 sources.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS; `npm run content -- check all` prints one line per video and exits non-zero if any error.
- [ ] **Step 5:** Commit.

### Task 3: Images, slides and thumbnail

**Files:**
- Create: `content-tools/lib/images.js` (port of `ytb-content/_tools/fetch-images.js`), `content-tools/lib/slides.js` (port of `render-slides.js`), `content-tools/lib/thumb.js`, `content-tools/lib/env.js`, `content-tools/test/images.test.js`
- Modify: `content-tools/cli.js` (commands `images`, `slides`, `thumb`)

**Interfaces:**
- Produces: `images.fetchForVideo(dir, {onProgress?, onlyMissing = true}): Promise<{ok, missing: number[]}>`; `images.allowedLicense(short: string): boolean`; `images.matchScore(query, text): number`; `slides.renderVideo(dir, {onProgress?}): Promise<{todo: number[]}>`; `thumb.render(dir): Promise<string>`; `env.load()` reads repo `.env` keys `PIXABAY_API_KEY`, `ELEVENLABS_API_KEY` (fallback `../ytb-content/.env`).

- [ ] **Step 1: Tests** — `allowedLicense`: true for `Public domain`, `CC0`, `CC BY 2.0`, `CC BY 4.0`; false for `CC BY-SA 4.0`, `CC BY-NC 2.0`, `CC BY-ND`, `GFDL`. `matchScore('person yawning', 'Woman yawning while reading') >= 0.5`; `matchScore('puffed cheeks', 'Early Medieval Coin') === 0`.
- [ ] **Step 2–4:** FAIL → port code unchanged in behaviour (pinned `nasa_id`, relevance filter, Pixabay → Openverse for `stock`, Commons → Openverse for `science`, 2.5 s Commons spacing, ensure real JPEG) → PASS. `onlyMissing` skips scenes whose image already exists. Thumbnail: scene-1 image (or slide-1 background), channel theme, `thumbnail_text` ≤ 4 words in 120–150px uppercase, 1280×720.
- [ ] **Step 5:** `npm run content -- slides 2026-11-23` renders both day-1 videos; open `slides/contact.jpg` and check. Commit.

### Task 4: Packaging (`narration.txt`, `metadata.md`)

**Files:**
- Create: `content-tools/lib/pack.js`, `content-tools/test/pack.test.js`
- Modify: `content-tools/cli.js` (command `package`)

**Interfaces:**
- Produces: `pack.narrationText(script): string` (scenes joined by `\n\n`); `pack.metadataMarkdown(script, credits, {date, postTimeNote}): string`; `pack.writeAll(dir): void`.

- [ ] **Step 1: Tests** — narration has exactly `scenes.length` paragraphs; metadata contains the title, the description, a `## Image credits` section listing every non-missing credit once (deduplicated), tags as one comma line, the suggested time `12:00 PM ET (00:00 giờ VN ngày hôm sau)`, the voice hint (`Cosmic What If`: Adam; `Inside Your Body`: chosen voice, default `TBD by user`).
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** run for `all`, commit generated `narration.txt`/`metadata.md`.

### Task 5: Alignment and captions

**Files:**
- Create: `content-tools/lib/align.js`, `content-tools/lib/captions.js`, `content-tools/test/align.test.js`, `content-tools/test/captions.test.js`

**Interfaces:**
- Produces: `align.splitSentences(text): string[]`; `align.detectPauses(audioFile): Promise<{start, end}[]>` (ffmpeg silencedetect −35 dB, ≥0.30 s); `align.alignSentences(sentences: string[], pauses, duration): {start, end}[]`; `align.estimateTimings(sentences, wpm = 163, gap = 0.35): {start, end}[]`; `captions.chunk(sentence, max = 40): string[]`; `captions.buildCues(sentences, timings): {start, end, text}[]`; `captions.toSrt(cues): string`.

- [ ] **Step 1: Tests** — fixture: the black-hole video's 17 sentences, duration 66.27 s and the 16 measured pauses (from the spike); `alignSentences` boundaries equal the pause midpoints within 0.05 s. `align tolerates extra and missing pauses`: with 3 extra short pauses and 2 removed, result has 17 monotonic timings, last end = duration, no gaps > 1.5 s. `chunk` never exceeds 40 chars unless a single word is longer; `toSrt` formats `00:00:02,470 --> 00:00:03,200`.
- [ ] **Step 2: FAIL. Step 3: Implement** `alignSentences` as DP: expected end of sentence k = duration × cumulative chars / total chars; choose an increasing subset of pause midpoints of size N−1 minimising Σ(midpoint − expected)² − λ·pauseLength (λ = 2 s², favours real breaks); if fewer than N−1 pauses, fill the missing boundaries with expected times.
- [ ] **Step 4:** PASS. **Step 5:** Commit.

### Task 6: Video render (`content:preview`, `content:render`)

**Files:**
- Create: `content-tools/lib/video.js`
- Modify: `content-tools/cli.js`

**Interfaces:**
- Consumes: `slides.renderVideo`, `align.*`, `captions.*`.
- Produces: `video.renderPreview(dir, {onProgress?}): Promise<string>` (no audio, timings from `estimateTimings`, silent track); `video.renderFinal(dir, {onProgress?}): Promise<{video, srt}>` (requires `voice.mp3`, timings from `alignSentences`). Both: scene durations = sum of their sentences, 0.6 s crossfade at scene boundaries, alternating 6% zoom, captions as transparent PNG overlay (skip burned captions on the outro scene, keep it in SRT), 1.2 s tail, output `preview.mp4` / `final.mp4` + `captions.srt`.

- [ ] **Step 1:** Copy the spike's `voice.mp3` into the day-1 Cosmic folder.
- [ ] **Step 2:** `npm run content -- render 2026-11-23/cosmic-what-if__01-fell-into-a-black-hole` → `final.mp4` ≈ 67.5 s; extract frames at 1, 9, 21, 35, 46, 56.5 s and check each shows the right slide and caption (matches the approved v2 spike).
- [ ] **Step 3:** `npm run content -- preview 2026-11-23` → both day-1 previews play, length ≈ words/163 min.
- [ ] **Step 4:** Commit.

### Task 7: Status + backend API

**Files:**
- Create: `content-tools/lib/status.js`, `content-tools/lib/queue.js`, `src/services/content.service.js`, `src/controllers/content.controller.js`, `src/routes/v1/content.routes.js`, `content-tools/test/status.test.js`, `content-tools/test/queue.test.js`, `content-tools/test/api.test.js`
- Modify: `src/routes/v1/index.js` (mount `/content`)

**Interfaces:**
- Produces: `status.videoStatus(dir): {steps: {script, images, review, slides, preview, voice, final, uploaded}: 'done'|'todo'|'stale'|'error', stage: string, imagesHave, imagesNeed, missingScenes: number[], durationEst: number, uploadedUrl?: string}`; `queue.enqueue({videoId, action}): job`; `queue.list(): job[]` (job: `{id, videoId, action, state: 'queued'|'running'|'done'|'error', progress: 0..1, message}`).
- Routes (all under `/api/v1/content`): `GET /` list (id, date, channel, number, title, durationEst, status); `GET /:date/:folder` detail (+ script, credits, metadata, slide list); `GET /file/:date/:folder/*` static file restricted to that video dir and extensions png/jpg/svg/mp4/mp3/srt/txt/md; `POST /:date/:folder/actions/:action` with action ∈ `images|slides|thumb|package|preview|render`; `POST /:date/:folder/voice` (multer, single `voice`, mp3/m4a/wav ≤ 50 MB, saved as `voice.mp3` converted via ffmpeg if not mp3, then enqueue `render`); `PUT /:date/:folder/review` body `{imagesReviewed?: boolean, uploadedUrl?: string|null}`; `GET /jobs`.

- [ ] **Step 1: Tests** — status of a fixture folder: missing slide → `slides: 'todo'`; `slides stale when script newer` (touch script after slides) → `'stale'`; review.json `uploadedUrl` → `uploaded: 'done'`. `queue runs jobs serially`: two jobs with 50 ms tasks never overlap. `rejects traversal ids`: `resolveVideoDir('2026-11-23/../../src')` null and `GET /api/v1/content/file/2026-11-23/..%2F..%2Fpackage.json` → 404. `voice upload rejects non-mp3`: posting a `.txt` returns 400 and writes nothing.
- [ ] **Step 2–4:** FAIL → implement → PASS (API test starts the Express router on an ephemeral port with `CONTENT_ROOT` pointed at a temp fixture).
- [ ] **Step 5:** curl the list and one detail against the dev server; commit.

### Task 8: Frontend control page

**Files:**
- Create: `frontend/app/content/page.tsx` (list), `frontend/app/content/[date]/[folder]/page.tsx` (detail)
- Modify: `frontend/lib/constants.ts` (`API_ENDPOINTS.CONTENT`), `frontend/lib/api.ts` (`contentAPI` + types `ContentVideo`, `ContentDetail`, `ContentJob`), `frontend/components/Sidebar.tsx` (item "Nội dung", icon `Clapperboard`)

**Interfaces:**
- Consumes: Task 7 routes.

- [ ] **Step 1:** List page: filters (channel, stage), table with date, channel, #, title, duration, 7 step dots + uploaded badge, totals line; rows link to detail; polls `/jobs` every 3 s while any job is running.
- [ ] **Step 2:** Detail page: slide grid (missing/TODO slides outlined red, click to enlarge), action buttons wired to `/actions/:action` with per-job progress bar, "Đã duyệt ảnh" toggle, copy buttons (narration with char count, title, description, tags), voice drop-zone (`/voice`), `<video>` players for preview/final, SRT download, uploaded URL input.
- [ ] **Step 3:** `npx tsc --noEmit -p frontend/tsconfig.json` passes; open `/content` and one detail page in Chrome, no console errors; trigger `slides` on day 1 and watch progress complete. Commit.

### Task 9: Skills and CLAUDE.md

**Files:**
- Create: `.claude/skills/write-video-script/SKILL.md`, `.claude/skills/source-visuals/SKILL.md`, `.claude/skills/produce-video/SKILL.md`, `.claude/skills/channel-guides/SKILL.md`
- Modify: `CLAUDE.md` (section "Content pipeline" pointing to commands + skills)

- [ ] **Step 1:** Write each skill (use superpowers:writing-skills): frontmatter `name` + trigger-rich `description`; body = the rules already enforced by code plus the judgement rules code can't check (accuracy sourcing, medical policy, license list, diagram SVG style guide from the drawing briefs, daily voice workflow, commands to run). Keep each under ~150 lines, refer to commands instead of restating logic.
- [ ] **Step 2:** `npm run content -- check all` and `node --test content-tools/test` pass; commit.
