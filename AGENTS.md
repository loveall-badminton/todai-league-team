## Commands

```bash
pnpm dev              # Vite dev server (no D1/DO — UI only, no auth redirect)
pnpm preview          # wrangler dev with D1 + DO (port 4173, full auth)
pnpm build            # gen:check + vite build
pnpm deploy           # build + wrangler deploy

pnpm check            # svelte-check (requires wrangler types — run gen first)
pnpm lint             # prettier --check + eslint (run format first to fix)
pnpm format           # prettier --write
pnpm test             # vitest run (unit + component)
pnpm test:unit        # vitest watch
pnpm test:coverage    # vitest coverage (90% line / 80% branch thresholds)

pnpm gen              # wrangler types → worker-configuration.d.ts (needed before check/build)
pnpm db:push          # push schema to remote D1 (via drizzle-kit)
pnpm db:generate      # drizzle-kit generate (migration creation)
pnpm db:studio        # drizzle-kit studio
```

**`pnpm dev` vs `pnpm preview`**: `dev` runs Vite only — no D1, no DOs, no auth redirect. Use for rapid UI iteration. `preview` runs full wrangler with all bindings and auth. If D1/DO/real data is needed, use `preview`.

**Pre-commit** (lefthook) runs format, lint, check, and tests in parallel.

## Architecture

**Stack**: SvelteKit (Svelte 5 runes) + Cloudflare Workers + D1 (Drizzle ORM) + Durable Objects (PartyServer)

**Auth**: `better-auth` with three roles — `admin`, `participant`, `team`. `src/hooks.server.ts` injects `locals.auth`, `locals.session`, `locals.user`, `locals.authProfile` into every request. Unauthenticated users are redirected to `/auth/login` (except `/auth/login`, `/auth/bootstrap`, `/api/live`).

**DB access**: Call `getRequestDb()` from `$lib/server/db/request`. It pulls the D1 binding from the request's platform context. Use only in server-side code (`+page.server.ts`, `*.remote.ts`, services, repos). Schema: `src/lib/server/db/schema.ts`.

## Dual wrangler config — DO NOT MERGE

| File                     | Purpose                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `wrangler.jsonc`         | Production. `main: "src/worker.ts"` exports the SvelteKit handler and the DO classes.           |
| `wrangler.adapter.jsonc` | Build only. Points `main` at `.svelte-kit/cloudflare/_worker.js`. The adapter uses this config. |

`src/worker.ts` imports the adapter output via the `sveltekit-worker` alias (in `wrangler.jsonc`) and re-exports `LiveBoard` and `MatchActionCoordinator`.

## Route conventions

- **`+page.server.ts`** — load functions and form actions
- **`*.remote.ts`** — server-only utilities using `$app/server` primitives (`command`, `form`, `query`). Imported by both `+page.server.ts` and `+page.svelte`. Contains the actual logic, not just wrappers.
- **Validation**: Valibot schemas passed to `form(schema, handler)` or `command(schema, handler)` in `.remote.ts` files.

## Server-side tools (`$app/server`)

Use `command` for mutations that don't need form redirect, `form` for mutations that should redirect or return page data:

```ts
import { command, form } from '$app/server';
import * as v from 'valibot';

// For actions called from Svelte components (fire-and-forget-ish)
export const rallyWon = command(v.object({ side: v.picklist(['A', 'B']) }), async ({ side }) => {
	// ... DB work, broadcast
});

// For form submissions that redirect
export const create = form(v.object({ name: v.string() }), async ({ name }) => {
	// ... DB work
	redirect(303, `/page/${id}`);
});
```

## Domain terminology

| Code term | Meaning                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------- |
| `tie`     | 対抗戦 — one team vs another team fixture (5 rubbers)                                          |
| `rubber`  | 個人種目 — a discipline slot: WD1, XD1, MD3, MD2, MD1                                          |
| `match`   | A single badminton game played on court, linked 1:1 to a rubber                                |
| `phase`   | `group_a`, `group_b`, `semifinal`, `final`, `third_place`, `fifth_place`, `ranking_tiebreaker` |

## Key directories

```
src/lib/domain/         # Pure functions, no DB/server deps (types, scoring, service, tokyoLeague)
src/lib/server/db/      # Drizzle schema, auth schema, DB client
src/lib/server/repositories/  # DB queries (matchRepo, scoreEventRepo, tournamentRepo, tokyoLeagueRepo)
src/lib/server/services/      # Orchestration (matchActionCore, tieOperationService, lineupService, etc.)
src/lib/server/realtime/      # WebSocket broadcast helpers (notifyLiveBoard, notifyMatch)
src/lib/realtime/       # Shared (client+server) channel types, WebSocket client wrapper
src/lib/components/     # Shared UI components (AppButton, Card, etc.)
src/parties/            # Durable Objects (LiveBoard.ts, MatchActionCoordinator.ts)
```

## Domain layer (`src/lib/domain/`)

Pure TypeScript. Key exports:

- `types.ts` — `Side`, `MatchState`, `ServiceState`, `ScoreEventInput`, all event types
- `scoring.ts` — `applyScoreEvent()`, `isGameWon()`, `isMatchWon()`, `createInitialMatchState()`
- `service.ts` — `createInitialDoublesServiceState()`, `applyDoublesServiceAfterRally()`, helpers
- `matchStatus.ts` — status predicates (`isTerminalMatchStatus()`, `isResultMatchStatus()`, etc.)
- `tieProgress.ts` — `calculateTieResult()`, 3-win clinch / finished-state rules for ties

The domain layer MUST NOT import from `$lib/server` or any SvelteKit module.

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

## Realtime (WebSocket)

- `src/parties/LiveBoard.ts` — PartyServer DO. One per channel. Broadcasts to connected clients.
- `src/lib/server/realtime/broadcast.ts` — `notifyLiveBoard(topics)` / `notifyMatch(matchId)` / `notifyScoreChange(matchId, topics)`. Calls DO via `platform.env.LiveBoard.getByName(channel).fetch(broadcastUrl)`.
- `src/lib/realtime/liveChannel.svelte.ts` — Client-side WebSocket wrapper with auto-reconnect.
- `src/lib/components/RealtimeSync.svelte` — Toggle component; polls when WebSocket unavailable.

## Validation

Use **Valibot** (`import * as v from 'valibot'`). Form input helpers (`emptyToNull`, `uniqueNonEmpty`, `venueOrNull`) in `src/lib/utils/validation.ts`.

## Auth guards

In `src/lib/server/auth/access.ts`:

- `requireAdmin()` — throws 403 if not admin
- `requireUser()` — redirects to login if unauthenticated
- `requireTeamLineupAccess(teamId)` — team or admin
- `requireRefereeMatchAccess(matchId)` — checks officiating assignment

## Testing

Two vitest projects (client/server) defined in `vite.config.ts`:

- **client** — browser tests (Chromium headless via Playwright). `*.svelte.{test,spec}.{js,ts}`
- **server** — node environment. All other `*.{test,spec}.{js,ts}`

Run a single test file: `pnpm test:unit -- path/to/file.test.ts`

Coverage thresholds: 90% statements, 80% branches, 90% functions, 90% lines. Schema files are excluded.

## Environment

Required env vars (in `.env`):

```bash
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_DATABASE_ID
CLOUDFLARE_D1_TOKEN
BETTER_AUTH_SECRET
```

These are needed for `drizzle-kit` operations (push, generate, migrate, studio) and for auth.

## Tailwind v4

Uses `@tailwindcss/vite` (Tailwind CSS v4). No `tailwind.config.js` — configure directly in CSS with `@theme` and `@import "tailwindcss"`.
