# todai-league-backup Worker

大会運営システムの **緊急バックアップ・紙運用継続機能** (BCP.md 参照)。
メインアプリとは独立した Worker として動作し、D1 から大会状態を取得して
緊急運営継続パケットを R2 に定期保存・配信する。

## 生成物

R2 bucket `todai-league-backups`:

```txt
backups/
  current-tournament.txt        # download 用の大会IDポインタ (D1 障害時にも解決可能)
  <tournamentId>/
    latest/                     # 緊急時に直接参照する最新版 (常に上書き)
      emergency.html            # 最重要。ブラウザで開いてそのまま A4 印刷できる
      emergency.pdf             # 補助。生成失敗しても他ファイルは成功扱い
      emergency.md
      state.json                # 復旧用フルスナップショット
      event-log.ndjson          # 直近500イベント。lastEventId 以降を紙で継続する
      scores.csv                # Excel / Numbers / Google Sheets 用 (BOM付きUTF-8)
      manifest.json
    snapshots/<JSTタイムスタンプ>/  # 監査・復元用の時系列履歴
```

`lastEventId` は score_events の rowid の最大値(大会全体の通し番号)。
紙運用に切り替えたら `lastEventId + 1` から手書きの通し番号を振る。

## スケジュール

- `*/2 * * * *` — HTML / MD / JSON / CSV / NDJSON
- `*/30 * * * *` — 上記 + PDF (Browser Run)

PDF 生成には Cloudflare Browser Run (旧 Browser Rendering) を使う。
Free プランでも利用可能 (ブラウザ実行時間 10分/日・同時3ブラウザまで) だが、
上限を超えると PDF 生成のみ失敗する (HTML 等のバックアップは影響を受けない)。
このため PDF の cron は30分間隔にしている。手動の「今すぐ緊急パケット生成」
は常に PDF 込みで実行される。確実に高頻度の PDF が必要なら Paid プラン
(10時間/月) にして cron を狭める。

## エンドポイント

| Method | Path                             | 認証                                    | 用途                                    |
| ------ | -------------------------------- | --------------------------------------- | --------------------------------------- |
| POST   | `/backup-now`                    | `Authorization: Bearer <BACKUP_SECRET>` | 今すぐ緊急パケット生成 (PDF込み)        |
| GET    | `/emergency.html` ほか各ファイル | `?token=<DOWNLOAD_TOKEN>`               | 最新版の取得。`&snapshot=<ts>` で履歴版 |
| GET    | `/snapshots`                     | `?token=<DOWNLOAD_TOKEN>`               | 生成履歴の一覧                          |

R2 bucket は private のまま。`state.json` / `event-log.ndjson` を含め、
すべてトークン必須で配信する。トークンは絶対にコミットしないこと。

## セットアップ

```bash
# R2 bucket 作成 (初回のみ)
wrangler r2 bucket create todai-league-backups

# secrets
wrangler secret put BACKUP_SECRET -c workers/backup/wrangler.jsonc
wrangler secret put DOWNLOAD_TOKEN -c workers/backup/wrangler.jsonc
# トークン生成例: openssl rand -hex 32

# デプロイ / 開発
pnpm backup:deploy
pnpm backup:dev      # ローカル (port 4174)。--remote を付けると本番 D1/R2 を参照
pnpm backup:check    # 型チェック
```

対象大会は `running` > `published` の tournaments から自動選択する。
固定したい場合は wrangler.jsonc の vars に `TOURNAMENT_ID` を設定する。

## メインアプリ側の設定

管理画面 (`/settings/backup`) 用に、メインアプリの環境変数
(`.dev.vars` / `wrangler secret put`) を設定する:

```txt
BACKUP_WORKER_URL=https://todai-league-backup.<subdomain>.workers.dev
BACKUP_SECRET=<backup worker と同じ値>
BACKUP_DOWNLOAD_TOKEN=<DOWNLOAD_TOKEN と同じ値>
```

メインアプリから backup Worker への接続は Service Binding ではなく、
`BACKUP_WORKER_URL` の公開エンドポイント + token で行う。

## 本部PC

`scripts/fetch-backup.sh` で最新パケットを `~/tournament-backup/` に保存できる。
5分ごとの自動実行は `scripts/fetch-backup.plist` (macOS launchd) を使う。

**大会前チェックリスト:**

1. `/settings/backup` から「今すぐ緊急パケット生成」を実行
2. emergency.html を開いて A4 印刷テスト
3. 本部PCで fetch-backup.sh の自動実行を確認
4. 緊急HTMLのURLを本部PC・責任者スマホにブックマーク
