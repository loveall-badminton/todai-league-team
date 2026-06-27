---
title: 開発時のテスト
description: ステージング環境へのテストデータ投入とk6負荷テストの実行手順です。
published: false
order: 10
---

## 前提条件

- Node.js, pnpm, wrangler がインストール済み
- `wrangler.staging.jsonc` の D1 バインディング・BETTER_AUTH_URL が正しく設定されている
- ステージングアプリがデプロイされアクセス可能
- k6 がインストール済み（`brew install k6`）

## ステージング環境

| 項目     | 値                                                              |
| -------- | --------------------------------------------------------------- |
| App URL  | `https://todai-league-staging.qwg2pfmvzk.workers.dev`           |
| D1 DB    | `todai-league-staging` (`3d75ba3e-36e6-4af4-9fcc-62c44f445e6d`) |
| Wrangler | `-c wrangler.staging.jsonc`                                     |
| 管理者   | `testadmin@accounts.local` / `TestAdmin123`                     |

## シード手順

```bash
# 1. マイグレーションを適用
npx wrangler d1 migrations apply todai-league-staging -c wrangler.staging.jsonc --remote

# 2. シードスクリプト実行（40チーム・160選手・20対戦・100試合・オーダー・管理者を作成）
npx tsx scripts/seed-staging-data.ts --db=todai-league-staging --base-url=https://todai-league-staging.qwg2pfmvzk.workers.dev

# 3. データ投入を確認
npx wrangler d1 execute todai-league-staging -c wrangler.staging.jsonc --remote --command "SELECT COUNT(*) FROM teams; SELECT COUNT(*) FROM ties; SELECT COUNT(*) FROM rubbers; SELECT COUNT(*) FROM matches; SELECT COUNT(*) FROM match_snapshots; SELECT COUNT(*) FROM match_service_states;"
```

シード後の期待件数:

| テーブル             | 件数 |
| -------------------- | ---- |
| teams                | 40   |
| team_players         | 160  |
| ties                 | 20   |
| rubbers              | 100  |
| matches              | 100  |
| match_sides          | 200  |
| match_side_players   | 400  |
| match_snapshots      | 100  |
| match_service_states | 100  |
| lineup_submissions   | 40   |
| lineup_items         | 200  |

### シードスクリプトの処理内容

1. D1マイグレーションを実行
2. テストデータを全削除（`DELETE FROM`）
3. 以下を挿入: スコアリングルール、アプリ設定、トーナメント、40チーム、160選手、20対戦、100試合、100rubber（matchに紐付け済み）、100件のmatch_snapshots、100件のmatch_service_states（初期値null）、200件のmatch_sides、400件のmatch_side_players、40件のlineup_submissions、200件のlineup_items
4. 管理者アカウントを作成（サインアップAPI + SQLでロール昇格）
5. 全試合を開始（各試合に `?/remote=start` をPOST）— `match_service_states` に実際のサーバー/レシーバー情報が設定される
6. `load-tests/match-assignments.json` を出力

## 既知のデータ不具合と修正方法

シードスクリプトのSQLフェーズですべてのテーブルにデータを挿入しますが、過去の実行では各試合の開始（手順5）に失敗した場合にデータが欠落することがありました。以下の問題が発生した場合は、シードを再実行するかクイックフィックスを適用してください:

1. **対戦ページで「スコア入力」ボタンが表示されない** — `rubbers.match_id` が NULL になっている。修正:

   ```sql
   UPDATE rubbers SET match_id = (SELECT id FROM matches WHERE matches.rubber_id = rubbers.id) WHERE rubbers.match_id IS NULL;
   ```

2. **審判ページでプレイヤー選択ができない** — `match_sides` と `match_side_players` が不足している。修正: `scripts/sql/patch-match-sides.sql` を実行。

3. **`/referee/{matchId}` が500エラーになる** — `match_snapshots` または `match_service_states` が不足している。エラー: `Error: Match snapshot not found at getMatchState`。シードを再実行するか、手動で挿入:

   ```sql
   -- 初期スナップショットを挿入（試合ごとに1件、seq_no=0）
   INSERT INTO match_snapshots (match_id, seq_no, state_json, updated_at)
   SELECT id, 0, '{"schemaVersion":1,"matchId":"' || id || '","tournamentId":"tournament-001","courtId":null,"discipline":"MD","status":"scheduled","scoring":{"maxGames":3,"gamesToWin":2,"pointsToWin":21,"winBy":2,"maxPoints":30,"midGameIntervalPoint":11},"currentGameNo":1,"games":[{"gameNo":1,"score":{"A":0,"B":0},"winnerSide":null,"midGameIntervalTaken":false,"changeEndsRequired":false,"changeEndsCompleted":false}],"gamesWon":{"A":0,"B":0},"winnerSide":null,"terminalReason":null,"service":null,"lastSeqNo":0,"createdAt":"' || strftime('%Y-%m-%d %H:%M:%S', 'now') || '","updatedAt":"' || strftime('%Y-%m-%d %H:%M:%S', 'now') || '"}', strftime('%Y-%m-%d %H:%M:%S', 'now')
   FROM matches WHERE id NOT IN (SELECT match_id FROM match_snapshots);

   -- 初期サービス状態を挿入（試合ごとに1件、game_no=1、seq_no=0）
   INSERT INTO match_service_states (match_id, seq_no, game_no, serving_side, server_player_id, receiver_player_id, server_position, receiver_position, service_side, service_number, is_first_servers_game, service_over, updated_at)
   SELECT id, 0, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, strftime('%Y-%m-%d %H:%M:%S', 'now')
   FROM matches WHERE id NOT IN (SELECT match_id FROM match_service_states);
   ```

## k6 負荷テストの実行

全 k6 スクリプトは `load-tests/` に配置されています。管理者として認証し、`match-assignments.json` の試合IDに対してリクエストを送信します。

### スコアリングテスト（50同時接続の審判）

```bash
k6 run load-tests/scoring.js -e BASE_URL=https://todai-league-staging.qwg2pfmvzk.workers.dev
```

50人の審判が2分間ラリーのスコアを入力するシナリオ。各VUはサイドA/Bを交互に200〜500ms間隔でポストします。

### ライブページテスト（500同時接続の視聴者）

```bash
k6 run load-tests/live-page.js -e BASE_URL=https://todai-league-staging.qwg2pfmvzk.workers.dev
```

500人の視聴者が `/live` ページを閲覧するシナリオ。DOキャッシュを温めるため緩やかにランプアップします（30秒→5VU、30秒→10VU、その後500まで上昇）。

### 複合テスト（500視聴者 + 50審判の同時実行）

```bash
k6 run load-tests/combined.js -e BASE_URL=https://todai-league-staging.qwg2pfmvzk.workers.dev
```

2つのシナリオを並列実行:

- `live_viewers`: 500VUまでランプアップ、`/live` をポーリング
- `referees`: 50VUまでランプアップ、ラリースコアをポスト

### 管理者認証情報のカスタマイズ

```bash
k6 run load-tests/scoring.js -e BASE_URL=https://... -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD=secret
```

### 試合割り当てファイルのカスタマイズ

```bash
k6 run load-tests/scoring.js -e ASSIGNMENTS_PATH=./my-assignments.json
```

## 動作確認チェックリスト

シード後にブラウザ（管理者ログイン済み）で確認:

- [ ] `/ties/tie-001` — 5種目が表示され、各々に「スコア入力」ボタンがある
- [ ] `/referee/match-001` — 審判スコア入力ページが表示される（500エラーにならない）
- [ ] `/live` — ライブスコアが表示される
- [ ] `/admin/ties` — 対戦一覧に status "playing" と表示される
- [ ] データ件数: teams=40, match_sides=200, match_side_players=400, match_snapshots=100, match_service_states=100

## クイックフィックス

シードを再実行せずにデータ不具合を修正する場合:

```bash
# 1. rubbers.match_id のNULLを修正
npx wrangler d1 execute todai-league-staging -c wrangler.staging.jsonc --remote --command "UPDATE rubbers SET match_id = (SELECT id FROM matches WHERE matches.rubber_id = rubbers.id) WHERE rubbers.match_id IS NULL;"

# 2. match_sides が不足している場合
npx wrangler d1 execute todai-league-staging -c wrangler.staging.jsonc --remote --file="scripts/sql/patch-match-sides.sql"

# 3. スナップショット/サービスの不足を確認（各100件が正解）
npx wrangler d1 execute todai-league-staging -c wrangler.staging.jsonc --remote --command "SELECT COUNT(*) FROM match_snapshots; SELECT COUNT(*) FROM match_service_states; SELECT COUNT(*) FROM match_sides; SELECT COUNT(*) FROM match_side_players;"
```
