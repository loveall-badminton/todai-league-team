---
title: デプロイと運用
description: Cloudflare Workers へのデプロイ手順、更新方法、トラブルシューティング、ロールバックの注意点です。
order: 5
---

本ページは、システムを初めてデプロイする運営者や、更新作業を担当する運営者向けのガイドです。コマンドの詳細な動作については開発者に確認してください。

## 前提条件

作業を始める前に、以下を準備してください。

- [ ] Cloudflare アカウントを所持している
- [ ] 本リポジトリをローカルに clone 済み
- [ ] Node.js 22 以上、pnpm がインストール済み
- [ ] `corepack enable && pnpm install` を実行済み

## 初回デプロイ

### 1. Cloudflare へのログイン

ブラウザで [Cloudflare ダッシュボード](https://dash.cloudflare.com/) にログインするか、ターミナルで以下を実行してください。

```bash
pnpm exec wrangler login
```

ブラウザが開いて許可を求められたら、承認してください。

`pnpm deploy` は環境チェック（preflight）を自動的に実行します。`pnpm preflight` はトラブルシューティング時に任意の診断コマンドとして個別に利用できます。

### 2. デプロイ実行

```bash
pnpm deploy
```

`pnpm deploy` は preflight を自動的に実行します。個別の `pnpm preflight` は任意の診断コマンドです。

`pnpm deploy` は以下を順に行います。

1. 環境チェック (`pnpm preflight`)
2. アプリをビルドする
3. D1 binding の確認/プロビジョニング — `database_id` が未設定ならリモート DB の有無を確認し、存在しなければ作成して ID を wrangler 設定に書き戻す
4. 既存の D1 データベースに migration を適用する
5. Worker をデプロイする
6. `BETTER_AUTH_SECRET` が未設定なら自動生成して Cloudflare secret に登録する
7. 新しい secret を作成した場合のみ Worker を再デプロイする

`BETTER_AUTH_SECRET` は自動作成されます。Git に含めたり、チャットに貼ったりしないでください。

**初回デプロイの D1 作成**: リポジトリの wrangler 設定は初回デプロイ時まで `database_id` を省略しています。`pnpm deploy` はこの状態を検出すると、`wrangler d1 list --json` でリモートに同名の D1 データベースが存在しないことを確認してから `wrangler d1 create` で作成します。作成後、`wrangler d1 info <name> --json` から取得した UUID を対象の wrangler 設定の `d1_databases[0].database_id` に書き込みます。**この設定ファイルの変更は必ずコミットしてください**。database_id は機密情報ではありません。

同名のデータベースがすでに存在するのに `database_id` が設定されていない場合、`pnpm deploy` はエラーで停止します。復旧するには、既存のデータベース ID を以下のいずれかで確認し、対象の wrangler 設定に手動で追記してください。

- Cloudflare ダッシュボード: Workers & Pages → D1 → `<データベース名>` → database ID をコピー
- CLI: `pnpm exec wrangler d1 info <データベース名> --json` の `uuid` フィールド

手動で追記したら `pnpm deploy` を再実行してください。

### 3. リソースの確認

本プロジェクトのデプロイは必ず `pnpm deploy` 経由で行ってください。上部の「Deploy to Cloudflare」ボタンは使用しないでください。このボタンは本リポジトリの migration / secret / bootstrap オーケストレーションをバイパスするためです。**デプロイ後は必ず Cloudflare ダッシュボードで生成されたリソースを確認してください**。

確認すべき主なリソース：

- Workers & Pages（Worker 名・ルート・トリガー）
- D1 データベース（`todai-league` または `todai-league-staging`）
- Durable Objects（`LiveBoard`、`MatchActionCoordinator`）
- R2 / KV（バックアップ Worker を使う場合）

### 4. 管理者アカウントの作成

デプロイ後に表示された Worker URL を開き、以下にアクセスしてください。

```
https://<your-worker-url>/auth/bootstrap
```

`/auth/bootstrap` は初回のみ有効です。管理者アカウントを作成した後はアクセスできなくなります。

### 5. 大会の基本設定

管理者アカウントでログイン後、設定画面から以下を入力してください。

- 大会名
- 使用ルール
- その他の大会基本情報

### 6. ユーザー・チームの作成

- 「ユーザー管理」から運営アカウントや審判アカウントを発行する
- 「チーム」から参加チームと選手を登録する
- 必要に応じて A / B リーグに振り分ける

## 通常の更新

コードを更新した後は、以下で本番に反映します。

```bash
pnpm deploy
```

`pnpm deploy` は preflight を自動的に実行します。`pnpm preflight` は任意の診断コマンドとしてトラブルシューティング時にも個別に実行できます。

migration が追加されている場合は、Worker をデプロイする前に自動的に適用されます。通常の更新では Worker は 1 回のデプロイで済み、新しい secret を作成した場合のみ追加の再デプロイが行われます。

## Staging 環境

`wrangler.staging.jsonc` で staging Worker と D1（`todai-league-staging`）が定義されています。

```bash
pnpm deploy:staging
```

staging は本番投入前の動作確認用です。本番データに影響を与えません。Staging も `scripts/deploy.mjs` でデプロイされ、本番と同じく D1 確認 → migration → deploy → secret の順序で実行されます。Staging は独立した D1 データベース（`todai-league-staging`）を使用し、初回デプロイ時に `wrangler.staging.jsonc` へその `database_id` が書き込まれます。

## ロールバック

直前の Worker バージョンに戻す場合は以下を実行します。

```bash
pnpm exec wrangler rollback --config wrangler.jsonc
```

実行すると、CLI 上でバージョンの選択や確認を求められることがあります。表示に従って進めてください。

> [!WARNING]
> `wrangler rollback` は Worker のコードと設定を巻き戻しますが、**D1 の migration は巻き戻しません**。データベースの変更を元に戻す必要がある場合は、開発者と相談してください。

## トラブルシューティング

### `pnpm preflight` で `[BLOCKER]` が出る

表示された項目を修正してください。多くの場合、以下のいずれかです。

- Node.js のバージョンが 22 未満
- `pnpm install` が未実行
- `wrangler login` が未実行
- `wrangler.jsonc` が見つからない

### `pnpm preview` で `BETTER_AUTH_SECRET is not configured`

`pnpm preview` は wrangler dev を使用するため、秘密鍵は `.dev.vars` から読み込まれます。`.dev.vars` を作成し、`BETTER_AUTH_SECRET` を設定してください。

```bash
pnpm dlx auth@latest secret
```

生成された値を `.dev.vars` に貼り付けます：

```
BETTER_AUTH_SECRET="<generated-secret>"
```

`.env` は drizzle-kit や Vite ビルド用の変数に使用するため、`pnpm preview` には反映されません。

### デプロイ中に secret の作成に失敗する

`wrangler` が Cloudflare に認証されていない可能性があります。`pnpm exec wrangler whoami` で確認し、必要に応じて `pnpm exec wrangler login` を実行してください。

### カスタムドメインを使いたい

`workers.dev` の URL でも動作します。カスタムドメインを強制したい場合のみ、以下を実行してください。

```bash
pnpm exec wrangler secret put BETTER_AUTH_URL --config wrangler.jsonc
```

値としてカスタムドメインの URL（例：`https://badminton.example.com`）を入力してください。

## 開発者への引き継ぎ

以下は、運営者から開発者へ確認が必要なトピックです。

- migration の追加・変更履歴
- カスタムドメイン・`BETTER_AUTH_URL` の設定有無
- バックアップ Worker のデプロイ状況
- D1 / Durable Objects の手動補正が必要な事象
