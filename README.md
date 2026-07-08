# Todai League

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/loveall-badminton/todai-league-team)

東大リーグ団体戦の運営・スコア管理アプリです。

SvelteKit を Cloudflare Workers 上で動かし、D1 に大会データを保存し、Durable Objects + WebSocket でライブスコアを配信します。

## Stack

- SvelteKit + Svelte 5 runes
- Cloudflare Workers
- Cloudflare D1 + Drizzle ORM
- Durable Objects + PartyServer
- better-auth
- Valibot
- Tailwind CSS v4
- Vitest + Playwright

## Quick Start

```bash
corepack enable
pnpm install
cp .env.example .env
```

ローカル開発用に `.env` の `BETTER_AUTH_SECRET` を設定してください。

```bash
pnpm dlx auth@latest secret
```

Cloudflare / D1 の remote 操作をする場合は、`.env` に以下も設定します。

```bash
CLOUDFLARE_ACCOUNT_ID=""
CLOUDFLARE_DATABASE_ID=""
CLOUDFLARE_D1_TOKEN=""
```

UI を素早く確認するだけなら:

```bash
pnpm dev
```

D1、Durable Objects、認証、WebSocket を含めて確認するなら:

```bash
pnpm preview
```

`pnpm dev` は Vite のみです。D1 / Durable Objects / Cloudflare bindings / 本番相当の認証 redirect が必要な作業では `pnpm preview` を使ってください。

## Commands

| Command              | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `pnpm dev`           | Vite dev server。UI の高速確認用。                         |
| `pnpm preview`       | `wrangler dev`。D1 / DO / auth ありの本番相当ローカル。    |
| `pnpm gen`           | `worker-configuration.d.ts` を生成。                       |
| `pnpm check`         | Wrangler types 生成 + `svelte-check`。                     |
| `pnpm lint`          | Prettier check + ESLint。                                  |
| `pnpm format`        | Prettier write。                                           |
| `pnpm test`          | Vitest を run mode で実行。                                |
| `pnpm test:unit`     | Vitest watch。                                             |
| `pnpm test:coverage` | Coverage thresholds 付きで実行。                           |
| `pnpm build`         | Wrangler types check + production build。                  |
| `pnpm deploy`        | Cloudflare Workers へ deploy。Deploy button でも使われる。 |

DB / backup 関連:

| Command                   | Purpose                                                 |
| ------------------------- | ------------------------------------------------------- |
| `pnpm db:generate`        | Drizzle migration を生成。                              |
| `pnpm db:migrate:prod`    | production D1 に migration を適用。                     |
| `pnpm db:migrate:staging` | staging D1 に migration を適用。                        |
| `pnpm db:migrate:deploy`  | Deploy button / `pnpm deploy` 用。`DB` binding に適用。 |
| `pnpm db:push`            | Drizzle schema を remote D1 に push。                   |
| `pnpm db:studio`          | Drizzle Studio。                                        |
| `pnpm backup:dev`         | backup Worker を local 起動。                           |
| `pnpm backup:deploy`      | backup Worker を deploy。                               |

## Deploy to Cloudflare Workers

README 先頭の Deploy button から Cloudflare Workers にデプロイできます。Cloudflare の Deploy to Cloudflare flow は public GitHub / GitLab repository を clone し、`wrangler.jsonc` を読んで D1 や Durable Objects などの resources を provision します。

この repo の `deploy` script は初回デプロイも通るように、次の順で動きます。

1. `pnpm build`
2. Worker を一度 upload
3. `BETTER_AUTH_SECRET` がなければ自動生成して Cloudflare Worker secret に保存
4. D1 migrations を `DB` binding に適用
5. 最終 Worker を deploy

`BETTER_AUTH_URL` は任意です。未設定なら request origin を使うため、生成された `workers.dev` URL でもそのまま動きます。custom domain などに固定したい場合だけ設定してください。

Backup Worker は任意機能です。Deploy button では main Worker だけを対象にしています。backup 機能を使う場合は `workers/backup` を別途 deploy し、`BACKUP_WORKER_URL` と `BACKUP_DOWNLOAD_TOKEN` を設定してください。main Worker から backup Worker への接続は Service Binding ではなく、公開 URL + token で行います。

参考: [Cloudflare Deploy to Cloudflare buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/)

## Architecture

### Request Lifecycle

`src/hooks.server.ts` が全 request の入口です。

- `platform.env.DB` から D1 binding を取得
- better-auth instance を生成して `event.locals.auth` に注入
- session / user / authProfile を必要に応じて `locals` に設定
- 未ログイン request は `/auth/login` に redirect
- `/auth/login`、`/auth/bootstrap`、`/api/live` は public path

### Database Access

DB には server-side code からだけアクセスしてください。

- `+page.server.ts`
- `*.remote.ts`
- `src/lib/server/services/`
- `src/lib/server/repositories/`

request scope の DB は `getRequestDb()` from `$lib/server/db/request` を使います。schema は `src/lib/server/db/schema.ts` です。

### Dual Wrangler Config

この repo には Wrangler config が 2 つあります。役割が違うため、統合しないでください。

| File                     | Purpose                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `wrangler.jsonc`         | 本番 / preview / deploy 用。`main` は `src/worker.ts`。D1 / DO bindings の単一の真実。 |
| `wrangler.adapter.jsonc` | SvelteKit adapter の build 出力用。`main` は `.svelte-kit/cloudflare/_worker.js`。     |

`src/worker.ts` は `sveltekit-worker` alias で adapter output を読み込み、`LiveBoard` と `MatchActionCoordinator` を re-export します。

## Code Organization

```text
src/lib/domain/                Pure domain logic. DB / SvelteKit imports forbidden.
src/lib/server/db/             Drizzle schema, auth schema, DB client.
src/lib/server/repositories/   SQL / Drizzle query layer.
src/lib/server/services/       Application orchestration and workflows.
src/lib/server/realtime/       Server-side WebSocket broadcast helpers.
src/lib/realtime/              Shared realtime channel types and client wrapper.
src/lib/components/            Shared Svelte UI components.
src/parties/                   Durable Objects.
workers/backup/                Optional backup Worker.
drizzle/                       D1 migrations.
docs/                          In-app user/operator documentation.
```

### Route Conventions

- `+page.server.ts`: load functions and form actions
- `*.remote.ts`: server-only logic using `$app/server` primitives
- `+page.svelte`: UI and client interaction

Use `command` for mutations that do not need form redirects, and `form` for submissions that should redirect or return page data.

```ts
import { command, form } from '$app/server';
import * as v from 'valibot';

export const rallyWon = command(v.object({ side: v.picklist(['A', 'B']) }), async ({ side }) => {
	// DB work and realtime broadcast
});

export const create = form(v.object({ name: v.string() }), async ({ name }) => {
	// DB work, then redirect
});
```

Validation は Valibot を使います。共通 helper は `src/lib/utils/validation.ts` にあります。

## Domain Notes

| Code term | Meaning                                                          |
| --------- | ---------------------------------------------------------------- |
| `tie`     | 対抗戦。1 team vs 1 team の fixture。通常 5 rubbers。            |
| `rubber`  | 個人種目 slot。WD1, XD1, MD3, MD2, MD1。                         |
| `match`   | コート上で進行する 1 試合。rubber と 1:1。                       |
| `phase`   | `group_a`, `group_b`, `semifinal`, `final`, `third_place` など。 |

`src/lib/domain/` は pure TypeScript です。`$lib/server`、SvelteKit modules、DB client を import してはいけません。

## Score Event Flow

スコア変更は必ず `applyMatchActionWithRealtime()` を通してください。`matches.currentScoreA` などを直接更新しないでください。

1. `applyMatchActionWithRealtime()` が action を受ける
2. `applySerializedMatchAction()` が `MatchActionCoordinator` Durable Object に送る
3. DO が matchId ごとに concurrent writes を serialize
4. `applyMatchActionWithDb()` が current snapshot を読み、idempotency key を確認
5. `applyScoreEvent()` で domain logic を適用
6. `score_events` / `matches` / `match_snapshots` / `match_service_states` を batch write
7. rubber に紐づく場合は tie result を再計算
8. WebSocket で score / live board を broadcast

DO が使えない場合は direct DB path に fallback します。

## Realtime

- `src/parties/LiveBoard.ts`: channel ごとの PartyServer Durable Object
- `src/lib/server/realtime/broadcast.ts`: `notifyLiveBoard()`, `notifyMatch()`, `notifyScoreChange()`
- `src/lib/realtime/liveChannel.svelte.ts`: client-side WebSocket wrapper
- `src/lib/components/RealtimeSync.svelte`: WebSocket unavailable 時の polling fallback UI

## Auth And Roles

Auth は better-auth です。主な role は `admin`、`participant`、`team` です。

Access guard は `src/lib/server/auth/access.ts` にあります。

- `requireAdmin()`
- `requireUser()`
- `requireTeamLineupAccess(teamId)`
- `requireRefereeMatchAccess(matchId)`

`BETTER_AUTH_SECRET` は production では Cloudflare secret として保持します。Deploy button / `pnpm deploy` では `scripts/ensure-cloudflare-secrets.mjs` が未作成時だけ生成します。既存 session を維持したい場合、secret は rotate しないでください。

## Testing

Vitest projects は `vite.config.ts` で client / server に分かれています。

- client: browser tests。`*.svelte.{test,spec}.{js,ts}`
- server: node environment。その他の `*.{test,spec}.{js,ts}`

よく使う実行例:

```bash
pnpm test
pnpm test:unit -- src/lib/domain/scoring.test.ts
pnpm test:e2e
pnpm test:coverage
```

Coverage thresholds:

- statements: 90%
- branches: 80%
- functions: 90%
- lines: 90%

## Database Workflow

Schema は `src/lib/server/db/schema.ts`、migrations は `drizzle/` です。

```bash
pnpm db:generate
pnpm db:migrate:staging
pnpm db:migrate:prod
```

Deploy button / `pnpm deploy` では `pnpm db:migrate:deploy` が使われます。この command は database name ではなく `DB` binding を参照します。Deploy button では利用者が database name を変更できるため、binding name を使う必要があります。

## Generated Files

`worker-configuration.d.ts` は Wrangler 生成物です。

```bash
pnpm gen
```

`pnpm gen` は `.env.wrangler-types` を使い、開発者ごとの `.env` にある secret や private URL が型定義に混ざらないようにしています。

## Tailwind CSS

Tailwind v4 を `@tailwindcss/vite` で使っています。`tailwind.config.js` はありません。theme は CSS 側の `@theme` と `@import "tailwindcss"` で管理します。

## Pre-commit

`lefthook` が `prepare` で install されます。pre-commit では format、lint、check、tests が並列実行されます。

## Troubleshooting

### `pnpm dev` で Cloudflare binding がない

`pnpm dev` は Vite のみです。D1、Durable Objects、Worker env、auth redirect を含めたい場合は `pnpm preview` を使ってください。

### `BETTER_AUTH_SECRET is not configured`

ローカルでは `.env` に `BETTER_AUTH_SECRET` を設定してください。Cloudflare deploy では `pnpm deploy` が未作成時だけ secret を生成します。

### `worker-configuration.d.ts` に local secret が混ざる

`wrangler types` を直接実行すると `.env` を読むことがあります。通常は `pnpm gen` を使ってください。

### backup Worker が未設定

backup 機能は optional です。main Worker の Deploy button では作成されません。必要な場合だけ `workers/backup` を deploy し、`BACKUP_WORKER_URL` と `BACKUP_DOWNLOAD_TOKEN` を設定してください。Service Binding は不要です。
