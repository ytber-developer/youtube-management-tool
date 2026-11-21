# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A local automation tool that drives real Chrome browsers (Puppeteer + `puppeteer-extra-plugin-stealth`) to manage Google/YouTube accounts: login with TOTP 2FA, channel creation, avatar upload, video upload campaigns (from Google Drive / URLs / local files), watch/view campaigns, Facebook reel/avatar scraping, and AdSense checks. Express + Sequelize/SQLite backend in `src/`, Next.js 14 frontend in `frontend/` (npm workspace).

**The root `README.md`, `ARCHITECTURE.md`, and `CONTRIBUTING.md` are stale**: they describe Playwright/Firefox and MySQL. The real stack is Puppeteer/Chrome + SQLite. Don't follow their setup steps (e.g. `npx playwright install firefox`). `src/services/browser-playwright.service.js` and `google.auth.playwright.service.js` are leftovers that `require('playwright')`, which isn't in `dependencies`.

## Commands

```bash
npm install                 # installs root + frontend workspace
npm run migrate             # apply pending migrations to tool_ytb.db (required; no auto-sync)
npm run dev                 # start-dev.sh: nodemon backend + frontend dev server
npm run dev:backend         # backend only (nodemon, watches src/, ignores migrations)
npm run dev:frontend        # frontend only (next dev)
npm start                   # backend without reload (src/server.js)

npm run lint -w frontend                      # next lint (backend has no linter; `npm run lint` is a no-op)
npx tsc --noEmit -p frontend/tsconfig.json    # type-check frontend
npm run build:frontend                        # next build (standalone output)
```

- There are **no automated tests** and no test runner (`npm test` exits 1). You check changes by running the app: `curl localhost:$PORT/health`, `GET /api/v1/setup/status` (DB + pending migrations), then hit the endpoint or start the flow from the UI.
- `npm run build` points at `./build-prod.sh`, which doesn't exist.
- `migrate:undo` / `migrate:fresh` don't do anything different: `src/database/migrate.js` ignores argv and only runs pending migrations.
- Ports don't match each other: `src/server.js` defaults to 3000, `.env.example` sets `PORT=9000`, and the frontend defaults `NEXT_PUBLIC_API_URL` to `http://localhost:3006` (`frontend/lib/constants.ts`, `next.config.js`). Set both sides to the same value.
- The entry point is `src/server.js`. The root `server.js` is a deprecated stub.

## Environment

`.env` (see `.env.example`): `PORT`, `NODE_ENV`, `CONCURRENT_TABS`, `CHROME_EXECUTABLE`, `CHROME_USER_DATA_DIR`, `CHROME_USE_TEMP_PROFILE`. There is no DB path setting: `src/config/database.js` hardcodes `<repo>/tool_ytb.db`.

## Architecture

Layered monolith: `routes/ → controllers/ → services/ → models/`, with two cron job queues running **in the same process** as the HTTP server.

- **Routing**: `src/routes/index.js` mounts `src/routes/v1/` at both `/api/v1` and `/api` (fallback). Route groups: `authenticator`, `youtube`, `watch`, `login`, `upload`, `accounts`, `facebook`, `setup`, `campaigns`, `proxies`. The API has no auth, so `src/middlewares/security.js` limits access instead: the server listens on `127.0.0.1` by default (`HOST` env to change), CORS only allows localhost origins plus `CORS_ORIGINS`, write requests from other origins get a 403 (CSRF guard), and `/setup/pull` and `/setup/migrate` only accept loopback requests.
- **Frontend → backend**: every endpoint path lives in `frontend/lib/constants.ts` (`API_ENDPOINTS`) and is called only through the axios client in `frontend/lib/api.ts`. When you change or add a backend route, update both files. Pages are under `frontend/app/<route>/page.tsx`.
- **Responses**: controllers wrap results with `src/helpers/response.helper.js` (`successResponse`, `successListResponse`, `errorResponse` → `{ success, message, data, pagination }`). DB columns are snake_case (`underscored: true`). The frontend `Account` type uses camelCase, and controllers do the mapping.
- **Browser layer**: `browser.service.js` is a singleton that keeps an `activeBrowsers` Map and reuses an already-open browser/tab for the same email. `session.service.js` gives each email its own persistent Chrome profile at `browser-profiles/<slug>` (cookies stay, so the account doesn't log in again). Because the profiles are exclusive, only one browser can use an account at a time. If a Chrome for that profile is still running from a previous backend process (nodemon restart or crash while Chrome was kept open), `launchBrowser` reconnects to it through `browser-profiles/<slug>/DevToolsActivePort` (`reconnectExisting` → `adoptBrowser`, re-applying the fingerprint to its tabs) instead of launching, which would fail with "Opening in existing browser session"; if the Chrome can't be reached, `killChromeUsingProfile` ends it and the launch is retried. Accounts with a proxy always relaunch (the old Chrome points at the dead proxy bridge). `fingerprint.service.js` gives each profile a fixed browser fingerprint (`browser-profiles/<slug>/fingerprint.json`, seeded from the email: screen/window size, CPU cores, RAM, WebGL GPU string drawn from real values for the OS the tool runs on (Mac Metal/OpenGL, Windows Direct3D11, Linux Mesa), tiny canvas/audio noise, languages, timezone from the account's proxy country); a file generated on another OS is regenerated to match the current machine; it is applied with `evaluateOnNewDocument` on every tab, so it only takes effect after a real navigation (not `setContent`). The User-Agent is never faked (Client Hints would mismatch). `GET/POST /api/v1/accounts/:id/fingerprint[/regenerate]` and the fingerprint button on the channels page show or re-roll it; the stealth plugin's hardwareConcurrency/languages/webgl.vendor evasions are disabled in favour of it.
- **Google login**: `google.auth.service.js` handles login plus the 2FA and verification popups. `authenticator.service.js` makes TOTP codes from the stored secret with `speakeasy`. Passwords and TOTP secrets are stored in plaintext in `AccountYoutube`.
- **YouTube automation is DOM-driven.** No official APIs are used. Selectors live in `src/config/constants.js` (`YOUTUBE_SELECTORS`, often as fallback arrays because YouTube's UI keeps changing), along with timeouts and channel-naming vocabulary. The upload flow is orchestrated by `src/services/youtube.upload.service.js`, which calls step helpers in `src/services/youtube/`: `youtube.upload.ui.service` (dialogs and navigation), `youtube.upload.form.service` (title/description/metadata), `youtube.upload.visibility.service`, and `youtube.upload.publish.service` (the final publish, including blocking dialogs like "still checking"). Channel creation uses `channel.service` plus `retry.service`, which retries with name variants from `helpers/name.generator.js`.
- **Video sources**: `video.download.service.js` routes by URL type: Google Drive (`google.drive.service.js` drives the Drive UI/CDP downloads, including large files that show the virus-scan warning) or a direct URL. Files land in `downloads/`. Local uploads go through multer middleware into `uploads/`.
- **Watch routing**: `watch.service.js` sends Shorts and normal videos to `youtube/watch.short.puppeteer.service.js` or `watch.normal.puppeteer.service.js`.

### Background queues (the subtle part)

Both queues are started from `startServer()` in `src/server.js`. They tick every 5 minutes, use a module-scoped `isProcessing` lock, and run **at most one campaign globally at a time**. Status lifecycle: `new → running → done`. `pending` means manually held and is never auto-promoted.

- `src/services/campaign.service.js` (WatchCampaign / WatchTask): N accounts × M videos cross-product, processed in `batch_size` groups per video. A tick is skipped if any WatchTask is still `running`.
- `src/services/upload.queue.service.js` (UploadCampaign / UploadedVideo): one video at a time in `order_index` order. A tick is skipped while any video is `downloading`/`uploading`. Campaigns are promoted only when `scheduled_start_at <= now`. Time is handled as Vietnam time with a hardcoded +7h offset (`vnNow`, `toVNString`).
- On boot, `recoverStuckTasks()` and `recoverStuckUploads()` reset records stuck mid-run after a crash. If you change status semantics, keep these recovery functions in sync.
- `uncaughtException` and `unhandledRejection` call `process.exit(1)`, so a single unhandled async error in automation kills the API and every running campaign. `browser.service.js` installs its own handler to swallow the stealth plugin's `TargetCloseError`.

### Database

SQLite file `tool_ytb.db`, Sequelize models in `src/models/` (associations are declared in `src/models/index.js`; `UploadQueue.js` is an empty leftover). Schema changes **must** be new files in `src/database/migrations/` exporting `up(queryInterface, Sequelize)`. `migrate.service.js` runs them in **lexicographic filename order** and records them in a `migrations` table. Existing names mix the `YYYYMMDDNNNNNN-desc.js` and `YYYYMMDD_desc.js` styles, so check that a new name sorts after the migrations it depends on. The app never calls `sequelize.sync()`.

## Conventions

- Backend is CommonJS with relative requires only. Files are named `<domain>.<layer>.js`. Services export a singleton instance (`module.exports = new XService()`). Cron modules export plain functions. Controllers and helpers use `exports.fn =`. Lazy `require` inside functions is used deliberately to break circular imports.
- Logging is `console.log` with emoji markers (✅ ❌ 🔐 ⏳). Comments and log messages mix English and Vietnamese, and commit messages are usually Vietnamese with conventional prefixes (`fix:`, `docs:`).
- Pure timing helpers (`sleep`, `randomDelay`) are in `src/helpers/timing.helper.js`. Human-like browser actions are in `src/helpers/human.helper.js`: `pause(min,max)`, `humanClick(page, el)` (mouse travels to the element, then clicks), `pasteText(page, text, { replace })` (one input event via `keyboard.sendCharacter`, like Ctrl+V; selection is done with a Range because synthetic Cmd+A is ignored on macOS). The YouTube upload flow uses these instead of fixed sleeps and per-character typing; keep new browser steps consistent with it and avoid extra `page.goto` calls (each Studio load is slow and looks robotic).
- Runtime state lives on local disk and is gitignored: `tool_ytb.db`, `browser-profiles/`, `downloads/`, `uploads/`, `fb-cookies.json`, `.env`. Never commit these. Account data (emails, passwords, TOTP secrets) once leaked through a committed DB dump and import script, and history had to be purged, so never put real account data in code, fixtures or scripts.
- A pre-commit hook in `.githooks/` (enabled by `npm install` through the `prepare` script) blocks `.db`/`.sql`/`.env.*`/cookie files and scans staged changes with gitleaks using `.gitleaks.toml`, which adds rules for hardcoded passwords and TOTP secrets. `npm run secrets:scan` scans the whole history.

## Content pipeline

A separate tool for making the videos for two US science channels (Cosmic What If, Inside Your Body). It doesn't touch the account automation.

- Videos live in `content/<post-date>/<channel>__NN-<slug>/`. `script.json`, `credits.json`, `review.json`, `narration.txt`, `metadata.md` and `images/*.svg` are committed. Media files (jpg, `slides/`, `thumbnail.png`, mp4, mp3, srt) are gitignored.
- `npm run content -- build <id|date|all>` makes a finished video with no Claude and no paid credits: free images (NASA, Commons, Openverse, optional Pixabay) → slides → thumbnail → local AI voice (Kokoro, which also writes `voice.timings.json` with the exact start/end of every sentence) → `final.mp4` + captions timed from that file (voices without it fall back to silence detection, which drifts on long videos). Scenes with no free image are fixed by Claude (pin a NASA/Commons file or draw an SVG diagram, see `source-visuals`). Local AI illustrations (Z-Image-Turbo) exist but are **off by default** — heavy; enable with `AI_IMAGES=1` only when the user asks. Single steps: `check|images|slides|thumb|package|preview|voice|render`. Code in `content-tools/`. Tests: `npm run test:content` (`node:test`, the only automated tests in the repo).
- Local AI tools live in gitignored venvs: `.venv-tts` (Kokoro) and `.venv-img` (mflux on Apple Silicon, diffusers+CUDA on Windows). Install with `npm run content:setup` (also needs Python 3.12 + ffmpeg). Models download to `~/.cache/huggingface` on first use. The Windows path is untested.
- UI at `/content`: a status table (refreshes every 15 s), a detail page per video with everything needed to post on YouTube (final.mp4, thumbnail, title, description incl. credits, tags, captions.srt, post time, copy buttons), and **auto-upload**: pick a YouTube account per channel and queue the ready videos (or one video from its detail page). `src/services/content.upload.service.js` creates `UploadedVideo` rows with `content_id` (no campaign) that the normal upload queue processes: final.mp4 + `thumbnail.png` + tags, visibility public scheduled at `scheduleAt` (detail page has a date-time picker; default 12:00 PM America/New_York of the post date; past times publish immediately). Pressing Đăng starts the upload right away (one video at a time); after a content upload the account's Chrome stays open (campaign uploads still close it). On success the queue writes `review.json.uploadedUrl` via `content-tools/lib/uploaded.js`, so the page shows "Đã đăng". Content rows are never deleted from disk. API: `GET /api/v1/content`, `/:date/:folder`, `/file/:date/:folder/<thumbnail.png|final.mp4|captions.srt>`, `POST /upload { ids, accountId, scheduleAt? }`, `DELETE /upload/:date/:folder` (`src/services/content.service.js`); status is computed from files on disk (`content-tools/lib/status.js`). Build actions (write script, build, voice, render) still run from chat via `npm run content`. Mark a video posted by hand with `npm run content -- uploaded <id> <youtube-url>`. Animated videos have no image-review step.
- Subagent `.claude/agents/content-builder.md` (Haiku) runs builds and reports status cheaply. Hand it long `build` runs instead of doing them in the main session.
- Specs and plans: `.claude/specs/`, `.claude/plans/`.

## Facebook knowledge page (Vietnamese)

A second, separate content line: one Vietnamese Facebook page sharing mixed knowledge (science, history, body, animals...) as Reels + photo posts, goal = enable Meta monetization. Rules and workflow are in skill `fb-knowledge-page`. Agents: `fb-planner` (calendar → `content-vi/calendar.md`), `fb-script-writer` (→ `content-vi/<date>/NN-<slug>.md`), `fb-fact-checker` (verifies and fixes the file). Always write → fact-check before making any media. `content-tools/` is English/Kokoro only and has no vertical-Reels step yet, so don't push these posts through it until Vietnamese TTS and a `reel` step exist. Page name: "Hôm Nay Mới Biết"; voice: VieNeu "Hải Đăng". Reels are built with `content-vi/tools/` (`draw.js` + `make-reel.js`, hand-drawn SVG scenes, not stock photos). UI at `/fb-page` manages the posts: `src/services/fbpage.service.js` reads `content-vi/calendar.md` + `<date>/<slug>.md` + `reel.mp4` (nothing in the DB) and stores the hand-set state (fact-checked, posted link/time, note) in `content-vi/posts.json`. API `GET /api/v1/fbpage/posts`, `GET|PATCH /posts/:date/:slug`, `GET /posts/:date/:slug/video`. It does not post to Facebook: the user copies caption/video over by hand and marks the post as posted.

## Further docs

`docs/codebase/` (STACK, STRUCTURE, ARCHITECTURE, CONVENTIONS, INTEGRATIONS, TESTING, CONCERNS; written in Vietnamese, added in commit `e61b603`) maps the repo from the actual source and lists known risks. Trust it over the root-level docs.
