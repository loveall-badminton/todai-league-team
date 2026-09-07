# AGENTS.md

Canonical guidance for AI coding agents working in this repository. `CLAUDE.md` imports this file — edit here, not there.

## Commands

```bash
pnpm dev              # Vite dev server (no D1/DO — UI only, no auth redirect)
pnpm preview          # wrangler dev with D1 + Durable Objects (port 4173, full auth)
pnpm build                        # gen:check + vite build (production)
pnpm run deploy                       # build + wrangler deploy (CLI/bootstrap route)
pnpm run deploy:workers-builds        # Deploy-command-only path for Cloudflare Workers Builds (existing env only)
pnpm run deploy:button                # Cloudflare Deploy Button initial deploy (isolated environment, browser-only)

pnpm check            # svelte-check (runs gen first)
pnpm lint             # prettier --check + eslint (run format first to fix)
pnpm format           # prettier --write
pnpm test             # vitest run (unit + component)
pnpm test:unit        # vitest watch
pnpm test:related     # vitest related --run (pass source file(s) after `--`, see Testing below)
pnpm test:coverage    # vitest coverage (90% line / 80% branch thresholds)
pnpm test:e2e         # playwright (chromium project; auto-starts server via webServer)
pnpm test:e2e:full    # playwright full-simulation project (excluded from normal runs)

pnpm gen              # wrangler types → worker-configuration.d.ts (needed before check/build)
pnpm db:push          # push schema to D1
pnpm db:studio        # drizzle-kit studio
pnpm db:migrate:staging  # apply pending migrations to staging D1 (remote)
pnpm db:migrate:prod     # apply pending migrations to production D1 (remote)

pnpm backup:dev       # BCP backup worker locally (port 4174)
pnpm backup:check     # typecheck backup worker
pnpm backup:deploy    # deploy backup worker
```

**`pnpm dev` vs `pnpm preview`**: `dev` runs Vite only — no D1, no DOs, no auth redirect. Use for rapid UI iteration. `preview` runs full wrangler with all bindings and auth. If D1/DO/real data is needed, use `preview`.

`pnpm check` must be run with wrangler types already generated. `pnpm gen` handles that automatically; CI uses `pnpm gen:check` (no side effects).

**Pre-commit** (lefthook) runs prettier/eslint on staged files plus svelte-check and unit tests in parallel. **Pre-push** runs the chromium e2e suite. **CI** (`.github/workflows/ci.yml`) runs lint, check:ci, unit tests, build, and the backup worker typecheck.

## Architecture

**Stack**: SvelteKit (Svelte 5 runes) + Cloudflare Workers + D1 (SQLite via Drizzle) + Durable Objects (partyserver)

**Auth**: `better-auth` with three roles — `admin`, `team`, `participant`. `src/hooks.server.ts` injects `locals.auth`, `locals.session`, `locals.user`, `locals.authProfile` and redirects unauthenticated requests to `/auth/login`. Guard functions live in `src/lib/server/auth/access.ts`: `requireAdmin()`, `requireUser()`, `requireTeamLineupAccess(teamId)`, `requireRefereeMatchAccess(matchId)`.

**Database access**: `getRequestDb()` from `$lib/server/db/request` returns a Drizzle client bound to the D1 `DB` binding from the current request's platform context. Call it from server-side code (load functions, form actions, `.remote.ts`). Schema is in `src/lib/server/db/schema.ts`.

## Key directories

```
src/lib/domain/         # Pure functions, no DB/server deps (types, scoring, service, tokyoLeague)
src/lib/server/db/      # Drizzle schema, auth schema, DB client
src/lib/server/repositories/  # DB queries (matchRepo, scoreEventRepo, tournamentRepo, tokyoLeagueRepo)
src/lib/server/services/      # Orchestration (matchActionCore, tieOperationService, lineupService, etc.)
src/lib/server/realtime/      # WebSocket broadcast helpers (notifyLiveBoard, notifyMatch)
src/lib/realtime/       # Shared (client+server) channel types, WebSocket client wrapper
src/lib/components/     # Domain-specific shared components (TieEditForm, RealtimeSync, etc.)
src/lib/components/ui/  # Generic UI primitives (AppButton, Card, Badge, PageHeader, etc.)
src/lib/types/          # Shared TypeScript types (entities, forms, ui)
src/lib/optimistic/     # Client-side optimistic update helpers
src/parties/            # Durable Objects (LiveBoard.ts, MatchActionCoordinator.ts)
workers/backup/         # Independent BCP backup worker (Hono)
```

## Route conventions

- `+page.server.ts` — SvelteKit page server load / form actions
- `*.remote.ts` — server-only utilities using `$app/server` primitives (`form`, `command`, `query`); imported by both `+page.server.ts` and `+page.svelte`. Contains the actual logic, not just wrappers.
- Validation in `.remote.ts` uses **Valibot** schemas passed to `form(schema, handler)` or `command(schema, handler)`.
- Use `command` for mutations called from components; use `form` for submissions that redirect or return page data.

## Domain layer (`src/lib/domain/`)

Pure TypeScript with no server or DB dependencies. The domain layer MUST NOT import from `$lib/server` or any SvelteKit module. Key modules:

- `types.ts` — `MatchState`, `ServiceState`, `ScoreEventInput` and all match event types
- `scoring.ts` — rally/game scoring logic (`applyScoreEvent()`, `isGameWon()`, `isMatchWon()`)
- `service.ts` — doubles service-rotation state helpers
- `matchStatus.ts` — match/rubber status predicates (terminal, result, confirmable)
- `tieProgress.ts` — tie result aggregation (`calculateTieResult`, 3-win clinch rules)
- `tokyoLeague.ts` — rubber definitions, tie phases, finals bracket structure

## Score event architecture

All score changes go through `applyMatchActionWithRealtime()` (`matchRealtimeActionService.ts`), which delegates to `applySerializedMatchAction()` (`matchActionSerializedService.ts`):

1. Route the action to the `MatchActionCoordinator` DO (one instance per matchId) to serialize concurrent writes; falls back to direct DB if the DO is unavailable
2. The actual write is `applyMatchActionWithDb()` in `matchActionCore.ts`:
   - Read current state from `match_snapshots`
   - Check idempotency key (duplicates return cached result)
   - Apply domain logic via `applyScoreEvent()`
   - Batch-write: `score_events` insert, `matches` update, `match_snapshots` upsert, `match_service_states` upsert
   - If tied to a rubber, recalculate tie result
3. Broadcast via WebSocket (notifyScoreChange / notifyLiveBoard)

**Never** directly update `matches.currentScoreA` without going through this path.

## Realtime (WebSocket live scores)

- `src/parties/LiveBoard.ts` — Cloudflare Durable Object (partyserver `Server` class). One instance per named channel. Accepts POST `/broadcast` to fan-out messages to all connected WebSocket clients; also hosts the L2 entry cache used by `layeredCache.ts`.
- `src/parties/MatchActionCoordinator.ts` — Durable Object that serializes score-event writes per match (one instance per matchId).
- `src/lib/server/realtime/broadcast.ts` — `notifyLiveBoard(topics)` / `notifyMatch(matchId)` / `notifyScoreChange(matchId, topics)` called from server actions after mutations; reaches the DO via `platform.env.LiveBoard.getByName(channel).fetch(...)`.
- `src/lib/realtime/channels.ts` — shared message schemas (Valibot), topic types, channel name helpers. Imported on both client and server.
- `src/lib/realtime/liveChannel.svelte.ts` — client-side WebSocket wrapper (PartySocket). Reconnects on visibility change; validates incoming messages.
- `src/lib/components/RealtimeSync.svelte` — UI toggle component; falls back to polling when WebSocket is unavailable.
- WebSocket routing: `src/routes/parties/live-board/[room]/+server.ts` → `routePartykitRequest` (dynamic import to avoid Vite SSR bundling `cloudflare:workers`).

## Dual wrangler config — do not merge

Two wrangler config files serve distinct purposes and **must remain separate**:

| File                     | Purpose                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `wrangler.jsonc`         | Production deploy. `main: "src/worker.ts"` re-exports the SvelteKit handler and the `LiveBoard` / `MatchActionCoordinator` DO classes.                       |
| `wrangler.adapter.jsonc` | Used only by `@sveltejs/adapter-cloudflare` at build time. Points `main` at `.svelte-kit/cloudflare/_worker.js` to avoid overwriting the custom entry point. |

`src/worker.ts` bridges the two: it imports the SvelteKit adapter output via the `sveltekit-worker` alias (defined in `wrangler.jsonc`) and re-exports `LiveBoard` and `MatchActionCoordinator` so wrangler can find the DO classes.

## Emergency backup (BCP)

`workers/backup/` is an independent Hono worker (`todai-league-backup`) that generates the emergency paper-ops packet (emergency.html/pdf/md, state.json, scores.csv, event-log.ndjson) from D1 into the `todai-league-backups` R2 bucket on a cron, and serves it via token-protected download URLs. See `workers/backup/README.md` and `BCP.md`. Admin UI: `/settings/backup` (needs `BACKUP_WORKER_URL` / `BACKUP_SECRET` / `BACKUP_DOWNLOAD_TOKEN` env vars on the main app). The global event number (`lastEventId`) is `MAX(score_events.rowid)` scoped to the tournament.

## Domain terminology

| Code term | Domain meaning                                                         |
| --------- | ---------------------------------------------------------------------- |
| `tie`     | 対抗戦 — one team vs another team fixture (contains multiple rubbers)  |
| `rubber`  | 個人種目 — a discipline slot within a tie (WD1, XD1, MD3, MD2, MD1)    |
| `match`   | 実際の試合 — the physical game played on court, linked 1:1 to a rubber |

Tie phases: `group_a`, `group_b`, `semifinal`, `final`, `third_place`, `fifth_place`, `ranking_tiebreaker`.

## Validation

Use **Valibot** (`import * as v from 'valibot'`) for all schema validation. Message schemas shared between client and server live in `src/lib/realtime/channels.ts`. Form input helpers (`emptyToNull`, `uniqueNonEmpty`, `venueOrNull`) are in `src/lib/utils/validation.ts`.

## Testing

Vitest projects defined in `vite.config.ts`:

- **client** — browser tests (Chromium headless via Playwright). `*.svelte.{test,spec}.{js,ts}`
- **server** — node environment. All other `*.{test,spec}.{js,ts}` (excluding `*.cf.*`)
- **cloudflare** — workerd environment via `@cloudflare/vitest-pool-workers`. `*.cf.{test,spec}.{js,ts}`

Run a single test file: `pnpm test:unit -- path/to/file.test.ts`

Run tests related to changed source files: `pnpm test:related src/lib/realtime/updates.ts`. This uses Vitest's `related` mode to discover tests that import the given source file(s). It is intended only as a fast local feedback shortcut; it is not a substitute for `pnpm test` or CI.

E2E tests run with `workers: 1` and `fullyParallel: false` in `playwright.config.ts` because they share a persisted local D1 database (`--persist-to .wrangler/e2e-state`) and global authentication state.

Coverage thresholds: 90% statements, 80% branches, 90% functions, 90% lines. Schema files are excluded.

## Environment

`.env` (see `.env.example`) provides `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_DATABASE_ID` / `CLOUDFLARE_D1_TOKEN` for `drizzle-kit` operations (push, generate, migrate, studio). `BETTER_AUTH_SECRET` is generated automatically on first CLI deploy (`pnpm run deploy` or `pnpm run deploy:button` when Workers Builds has permission); for local development put it in `.dev.vars`. For routine Workers Builds deployments, set `BETTER_AUTH_SECRET` once via the Cloudflare dashboard and never commit or regenerate it per build.

## Tailwind v4

Uses `@tailwindcss/vite` (Tailwind CSS v4). No `tailwind.config.js` — configure directly in CSS with `@theme` and `@import "tailwindcss"`.
