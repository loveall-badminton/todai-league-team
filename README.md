# 東大リーグ団体戦 運営システム

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/loveall-badminton/todai-league-team)

東大リーグ団体戦の運営・スコア管理アプリです。

## スタック

- SvelteKit + Svelte 5 runes
- Cloudflare Workers
- Cloudflare D1 + Drizzle ORM
- Durable Objects + PartyServer
- better-auth
- Valibot
- Tailwind CSS v4
- Vitest + Playwright
- Hono (バックアップ Worker)

## クイックスタート

```bash
corepack enable
pnpm install
cp .env.example .env
```

ローカル開発用に `.env` の `BETTER_AUTH_SECRET` を設定してください。

```bash
pnpm dlx auth@latest secret
```

Cloudflare / D1 のリモート操作をする場合は `.env` に以下も設定します。

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

D1 / Durable Objects / Cloudflare bindings 等の本番環境と同様の環境が必要な作業では `pnpm preview` を使ってください。

## コマンド一覧

```bash
pnpm dev              # Vite dev サーバー (D1/DO なし — UI のみ)
pnpm preview          # wrangler dev port 4173 (D1/DO/auth あり)
pnpm build            # gen:check + vite build
pnpm run deploy           # build → deploy → secrets → migrations → deploy
pnpm gen              # worker-configuration.d.ts を生成
pnpm check            # gen + svelte-check
pnpm lint             # Prettier check + ESLint
pnpm format           # Prettier write
pnpm test             # vitest run
pnpm test:unit        # vitest watch
pnpm test:coverage    # カバレッジ閾値付きで実行
pnpm test:e2e         # Playwright (別途 test:e2e:server が必要)
pnpm db:generate      # Drizzle migration を生成
pnpm db:migrate:prod  # 本番 D1 に migration を適用
pnpm db:migrate:staging # staging D1 に migration を適用
pnpm db:push          # Drizzle schema をリモート D1 に push
pnpm db:studio        # Drizzle Studio
pnpm backup:deploy    # バックアップ Worker をデプロイ
```

## Cloudflare Workers へのデプロイ

初回デプロイは README 上部の Deploy button から行えます。Cloudflare の Deploy flow は公開リポジトリを clone し、`wrangler.jsonc` を読んで D1 や Durable Objects などのリソースをプロビジョニングします。

`pnpm run deploy` は次の順で動作します:

1. `pnpm build` — 型生成 + svelte-check + Vite build
2. `wrangler deploy` — Worker を一度アップロード (環境を作る)
3. `scripts/ensure-cloudflare-secrets.mjs` — `BETTER_AUTH_SECRET` が未設定なら自動生成
4. `wrangler d1 migrations apply DB` — D1 migrations を適用
5. `wrangler deploy` — 最終 Worker をデプロイ

`BETTER_AUTH_URL` は任意です。未設定なら request origin を使うため、生成された `workers.dev` URL でもそのまま動きます。カスタムドメインなどに固定したい場合だけ設定してください。

### Staging 環境

`wrangler.staging.jsonc` で staging Worker と D1 (`todai-league-staging`) が定義されています。

```bash
pnpm db:migrate:staging
```

### バックアップ Worker

`workers/backup/` は独立した Hono Worker (`todai-league-backup`) です。
緊急時の紙運用パケット (emergency.html/pdf/md, state.json, scores.csv, event-log.ndjson) を D1 から生成し、R2 バケットに保存・配信します。
Admin UI: `/settings/backup` (メイン Worker に `BACKUP_WORKER_URL` / `BACKUP_SECRET` / `BACKUP_DOWNLOAD_TOKEN` が必要)。

## トラブルシューティング

### `pnpm dev` で Cloudflare binding がない

`pnpm dev` は Vite のみです。
D1、Durable Objects、Worker env、auth リダイレクトを含めたい場合は `pnpm preview` を使ってください。

### `BETTER_AUTH_SECRET is not configured`

ローカルでは `.env` に `BETTER_AUTH_SECRET` を設定してください。
Cloudflare デプロイでは `pnpm run deploy` が未作成時のみ secret を生成します。

### E2E テストが `ERR_CONNECTION_REFUSED`

まず `pnpm test:e2e:server` を別ターミナルで起動してから `pnpm test:e2e` を実行してください。

## ライセンス

MIT License. See [LICENSE](./LICENSE).
