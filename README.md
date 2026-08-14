# 東大リーグ団体戦 運営システム

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button.svg)](https://deploy.workers.cloudflare.com/?url=https://github.com/loveall-badminton/todai-league-team)

東大リーグ団体戦の運営・スコア管理アプリです。大会のセットアップから試合進行、結果確定までの一連の流れをデジタル化し、参加者・運営者・観戦者のそれぞれに適した情報を提供します。

本システムは東大リーグ団体戦向けに設計されています。
東大リーグ団体戦以外の大会で使用することは妨げませんが、個別大会への対応や機能追加を保証するものではありません。

## 主な機能

- **ライブスコア配信** — 各コートの試合スコアがリアルタイムで反映され、会場外からでも確認できます
- **オーダー管理** — チームごとの種目エントリー提出・承認・公開のワークフロー
- **対戦カード管理** — グループステージ・決勝トーナメントの日程・会場・進行管理
- **順位自動計算** — 勝敗・得失点差に基づくリーグ順位の自動集計

## 運営者向け：ブラウザからの初回デプロイ（Deploy to Cloudflare ボタン）

上記の **Deploy to Cloudflare** バッジから、ターミナルや Git 操作なしで初回デプロイできます。

1. バッジをクリックして Cloudflare アカウントでログインします（プロンプトに従うだけ）。
2. プロジェクト名などを確認・決定します。
3. Cloudflare がリポジトリを読み込み、D1 データベース（`todai-league`）と Durable Objects（`LiveBoard`、`MatchActionCoordinator`）を新規にプロビジョニングして Worker をデプロイします。

この経路は **Deploy Button 専用の隔離された環境** を作成します。既存の `pnpm deploy` 環境や手元の D1 データベースには接続しません。D1 にはボタンによってプロビジョニングされたデータベースが使用されます。

`BETTER_AUTH_SECRET` は、Workers Builds の実行権限が許せば `deploy:button` によって自動的に作成されます。作成に成功すると Worker が再デプロイされて反映されます。もし secret の作成に失敗した場合は、Cloudflare ダッシュボード → Workers & Pages → 対象 Worker → **Secrets** から `BETTER_AUTH_SECRET` を手動で作成し、ダッシュボードの「Retry deploy」で再デプロイをトリガーしてください。値は強固な乱数を安全な方法で生成してください。

> [!IMPORTANT]
> Deploy Button 経路で D1 migration や secret 作成に失敗した場合、ターミナルコマンドは実行せず、Cloudflare ダッシュボードから復旧してください。復旧手順は [docs/admin/deployment.md](./docs/admin/deployment.md) を参照してください。
> Deploy Button は新規の隔離環境の初回セットアップ用です。既存環境の更新には [Workers Builds](#運営者向け通常の更新ターミナル不要) を使用してください。

## 運営者向け：初回デプロイ（開発者・CLI 向け）

ターミナルが使える開発者や、staging 環境を含めて細かく制御したい場合は `pnpm deploy` を使ってください。ブラウザだけで済ませたい場合は上記の Deploy Button を利用してください。

1. Cloudflare ダッシュボードにログインするか、CLI でログインします。

   ```bash
   pnpm exec wrangler login
   ```

2. 依存関係をインストールします。

   ```bash
   corepack enable
   pnpm install
   ```

3. 本番環境にデプロイします。

   ```bash
   pnpm deploy
   ```

   `pnpm deploy` は preflight を自動的に実行します。`pnpm preflight` はトラブルシューティング時の任意の診断コマンドです。

   `pnpm deploy` は次の順で実行されます：

   1. `pnpm preflight` — 環境チェック
   2. `pnpm build` — 型生成 + svelte-check + Vite build
   3. D1 binding の確認/プロビジョニング — `database_id` が未設定ならリモート DB の有無を確認し、存在しなければ作成して ID を対象の wrangler 設定に書き戻す
   4. `wrangler d1 migrations apply todai-league` — D1 データベースに migration を適用
   5. `wrangler deploy` — Worker をアップロード
   6. `scripts/ensure-cloudflare-secrets.mjs` — `BETTER_AUTH_SECRET` が未設定なら自動生成
   7. 新しい secret を作成した場合のみ `wrangler deploy` — Worker を再デプロイ

   `BETTER_AUTH_SECRET` は CLI デプロイ時に自動生成されます。Git 管理や手動コミットは不要です。

   **初回デプロイの D1 作成**: リポジトリの wrangler 設定は初回デプロイ時まで `database_id` を省略しています。`pnpm deploy` はこの状態を検出し、リモートに同名の D1 データベースが存在しないことを確認してから `wrangler d1 create` でデータベースを作成します。作成後、Cloudflare から取得した UUID を `wrangler.jsonc`（本番）または `wrangler.staging.jsonc`（staging）の `d1_databases[0].database_id` に書き込みます。**この設定ファイルの変更は必ずコミットしてください**。database_id は機密情報ではありません。

   もしリモートに同名のデータベースがすでに存在するのに設定に `database_id` が記載されていない場合、`pnpm deploy` はエラーを出して停止します。その場合は既存のデータベース ID をダッシュボードまたは `pnpm exec wrangler d1 info todai-league --json` で確認し、対象の wrangler 設定に手動で追記してから再実行してください。

   初回セットアップは、ブラウザだけで済ませたい場合は README 上部の **Deploy to Cloudflare** バッジから、開発者が細かく制御したい場合は `pnpm deploy` を使ってください。Deploy Button は **新規の隔離環境** の初回セットアップに使用できますが、既存の本番環境や staging 環境を更新する用途には使わず、Workers Builds を使用してください（後述）。

4. デプロイ後に表示された Worker URL を開き、`/auth/bootstrap` にアクセスして管理者アカウントを作成します。

   - `/auth/bootstrap` は初回のみ有効です
   - 作成後は `/auth/login` からログインします

5. 管理画面から大会の基本設定（大会名・ルールなど）を入力します。

6. ユーザー・チームを作成し、対戦を生成して運用を開始します。

詳細な運用ガイドは [docs/admin/deployment.md](./docs/admin/deployment.md) を参照してください。

## 運営者向け：通常の更新（ターミナル不要）

初回セットアップが完了し、`wrangler.jsonc` に本番 D1 の `database_id` がコミット済みで、`BETTER_AUTH_SECRET` が Cloudflare ダッシュボードの secret として設定済みなら、以降のコード更新は **ブラウザだけ** でデプロイできます。

1. GitHub / GitLab の Web UI で main ブランチへ変更をマージ / プッシュします。
2. Cloudflare ダッシュボードで Workers Builds が自動的にビルド → デプロイを実行します。
   - Build command: `pnpm build`
   - Deploy command: `pnpm run deploy:workers-builds`

ダッシュボードの「Retry deploy」や手動トリガーでも同じコマンドが実行されます。

### Workers Builds 設定チェックリスト（初回のみ）

- [ ] リポジトリが GitHub または GitLab にある
- [ ] 本番 Worker および D1 データベース（`todai-league`）が既に作成済み
- [ ] `wrangler.jsonc` の `d1_databases[0].database_id` に本番 D1 の UUID がコミット済み
- [ ] `BETTER_AUTH_SECRET` を Cloudflare ダッシュボードの **Secrets** から作成済み
- [ ] Cloudflare ダッシュボードで Workers Builds を有効化し、本番ブランチを `main` に設定
- [ ] Build command: `pnpm build`
- [ ] Deploy command: `pnpm run deploy:workers-builds`
- [ ] Node.js 22 / pnpm が corepack / `packageManager` フィールドで有効になっている

詳細は [docs/admin/deployment.md](./docs/admin/deployment.md) と Cloudflare 公式ドキュメントを参照してください。

- [Workers Builds 概要](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Workers Builds 設定](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [D1 Migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

> [!IMPORTANT]
> `deploy:workers-builds` は **既存のリソースに対してのみ** 動作します。D1 の作成、database_id の書き込み、secret の生成は行いません。これらは初回デプロイ時に `pnpm deploy` またはダッシュボード操作で済ませてください。

### ロールバック

Cloudflare ダッシュボードから Worker のバージョンロールバックができます。ただし **D1 migration は自動で巻き戻りません**。データベースの変更を元に戻す必要がある場合は、開発者に相談してください。`BETTER_AUTH_SECRET` などの秘密情報は必ずダッシュボード secret として管理し、リポジトリやビルドログに含めないでください。

## 運営者向け：ターミナルからの本番デプロイ

Workers Builds を使わず、開発者が直接実行する場合は `pnpm deploy` を使います。これは初回セットアップや staging 確認で使う経路です。

```bash
pnpm deploy
```

`pnpm deploy` は preflight を自動的に実行します。`pnpm preflight` は任意の診断コマンドとしてトラブルシューティング時にも個別に実行できます。

## 開発者向け：ローカル開発

```bash
corepack enable
pnpm install
cp .env.example .env
```

`.env` は drizzle-kit や Vite ビルド用の環境変数（`CLOUDFLARE_*` など）に使用します。`pnpm preview` など wrangler dev で動作させるには、wrangler が読み込む `.dev.vars` を作成し、`BETTER_AUTH_SECRET` を設定してください：

```bash
pnpm dlx auth@latest secret
```

生成された値を `.dev.vars` に貼り付けます：

```
BETTER_AUTH_SECRET="<generated-secret>"
```

UI のみ素早く確認する場合：

```bash
pnpm dev
```

D1、Durable Objects、認証、WebSocket を含めて確認する場合：

```bash
pnpm preview
```

## 便利なコマンド

```bash
pnpm preflight                 # 環境チェック
pnpm deploy                    # 本番デプロイ（deploy:prod と同じ。CLI/bootstrap 用）
pnpm deploy:staging            # Staging デプロイ
pnpm deploy:workers-builds     # Workers Builds の Deploy コマンド用（既存環境のみ）
pnpm deploy:button             # Deploy to Cloudflare ボタンの初回デプロイ用（隔離環境）
pnpm dev                       # Vite dev サーバー（UI のみ）
pnpm preview                   # wrangler dev（D1/DO/auth あり）
pnpm build                     # 型生成 + svelte-check + Vite build
pnpm check                     # gen + svelte-check
pnpm lint                      # Prettier check + ESLint
pnpm format                    # Prettier write
pnpm test                      # vitest run
pnpm db:migrate:prod           # 本番 D1 に migration を適用
pnpm db:migrate:staging        # Staging D1 に migration を適用
```

## 注意事項

- `BETTER_AUTH_URL` は任意です。未設定なら request origin を使うため、`workers.dev` URL でも動作します。カスタムドメインを強制したい場合のみ `wrangler secret put BETTER_AUTH_URL` で設定してください。
- バックアップ Worker は必須ではありません。必要な場合は `pnpm backup:deploy` で別途デプロイし、`BACKUP_WORKER_URL` / `BACKUP_DOWNLOAD_TOKEN` を `wrangler secret put` で設定してください。
- 大会当日に安定して運用するため、Cloudflare Workers の有料プランの利用を推奨します。利用料金は各主管団体が契約内容を確認し、自己の責任で負担してください。

## 開発 / クレジット

- **開発**: 東京大学ラブオール
- **ソースコード**: [GitHub](https://github.com/loveall-badminton/todai-league-team)

本システムは、東大リーグ団体戦の運営を支援するために東京大学ラブオールが開発したものです。

本システムを東京大学ラブオール以外の団体が主管する大会で使用する場合、その大会におけるセットアップ、参加者情報の登録、試合進行、結果確定、公開情報の確認等の運用責任は、当該大会の主管団体が負うものとします。

東京大学ラブオールは、本システムの開発・保守および必要に応じた技術的助言を行うことがありますが、東京大学ラブオール以外の団体が主管する大会における運用上の判断、入力内容、公開情報、試合結果、その他本システムの利用により生じた不都合について責任を負いません。

## お問い合わせ / フィードバック

バグ報告や機能要望は [GitHub Issues](https://github.com/loveall-badminton/todai-league-team/issues) までお寄せください。
Pull Requests は、機能追加やバグ修正の提案を歓迎します。ただし、すべての提案・修正の採用を保証するものではありません。

## ライセンス

本システムは、MIT License の下で提供されています。
詳しくは、[LICENSE](./LICENSE) を参照してください。
