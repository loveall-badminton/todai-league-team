# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Vite dev server (no D1/DO — UI only)
pnpm preview          # wrangler dev with D1 + Durable Objects (port 4173)
pnpm build            # gen:check + vite build (production)
pnpm deploy           # build + wrangler deploy

pnpm check            # svelte-check (runs gen first)
pnpm lint             # prettier + eslint
pnpm format           # prettier --write
pnpm test             # vitest run (unit)
pnpm test:unit        # vitest watch
pnpm test:coverage    # vitest coverage
pnpm test:e2e         # playwright (chromium project; needs test:e2e:server running)
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

`pnpm check` must be run with wrangler types already generated. `pnpm gen` handles that automatically; CI uses `pnpm gen:check` (no side effects).

The pre-commit hook (lefthook) runs format, lint, svelte-check, and tests in parallel.

## Architecture

**Stack**: SvelteKit (Svelte 5) + Cloudflare Workers + D1 (SQLite via Drizzle) + Durable Objects (partyserver)

**Auth**: `better-auth` with three roles — `admin`, `team`, `participant`. `src/hooks.server.ts` injects `locals.auth`, `locals.session`, `locals.user`, `locals.authProfile` and redirects unauthenticated requests to `/auth/login`. Guard functions live in `src/lib/server/auth/access.ts`: `requireAdmin()`, `requireUser()`, `requireTeamLineupAccess(teamId)`, `requireRefereeMatchAccess(matchId)`.

**Database access**: `getRequestDb()` from `$lib/server/db/request` returns a Drizzle client bound to the D1 `DB` binding from the current request's platform context. Call it from server-side code (load functions, form actions, `.remote.ts`). Schema is in `src/lib/server/db/schema.ts`.

**Route conventions**:

- `+page.server.ts` — SvelteKit page server load / form actions
- `*.remote.ts` — server-only utilities using `$app/server` primitives (`form`, `command`, `query`); imported by both `+page.server.ts` and `+page.svelte`
- Validation in `.remote.ts` uses **Valibot** schemas passed to `form(schema, handler)`.

**Domain layer** (`src/lib/domain/`): Pure TypeScript with no server or DB dependencies. Key modules:

- `types.ts` — `MatchState`, `ServiceState`, `ScoreEventInput` and all match event types
- `scoring.ts` — rally/game scoring logic
- `matchStatus.ts` — match/rubber status predicates (terminal, result, confirmable)
- `tieProgress.ts` — tie result aggregation (`calculateTieResult`, 3-win clinch rules)
- `tokyoLeague.ts` — rubber definitions, tie phases, finals bracket structure

**Server services** (`src/lib/server/services/`): Orchestrate DB operations. Key services:

- `tieOperationService.ts` — start/confirm/cutoff a tie, calculate rubber/match results. `startTie` requires both lineups to be `locked` (admin-approved) and reveals them if not yet revealed
- `lineupService.ts` — save/submit/lock (approve)/reveal lineup submissions
- `matchActionCore.ts` — `applyMatchActionWithDb`: the single write path for score events (idempotency check, domain logic, batch write, tie recalculation)
- `matchActionSerializedService.ts` — routes score actions through the `MatchActionCoordinator` DO to serialize concurrent writes per match; falls back to direct DB when the DO is unavailable
- `liveBoardService.ts` — aggregate live view data

**Repository layer** (`src/lib/server/repositories/`): Drizzle queries. `tokyoLeagueRepository.ts` covers most list/update operations.

**Realtime** (WebSocket live scores):

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
