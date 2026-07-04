# 指示書: Cloudflare Workers + D1 大会運営システムの緊急バックアップ・紙運用継続機能の実装

## 目的

Cloudflare Workers + D1 で構築された大会運営システムについて、システム障害・D1障害・ネットワーク障害・管理画面障害が発生しても、大会運営をすぐに継続できるようにする。

単なる D1 の SQL バックアップではなく、障害時に本部PCやスマートフォンから開いて即座に印刷できる **緊急運営継続パケット** を定期生成することを主目的とする。

## 基本方針

バックアップは次の3層で設計する。

1. **復旧用バックアップ**

   - D1 の状態を復元するための JSON / SQL / event log。
   - システム復旧後の再構築に使う。

2. **運営継続用バックアップ**

   - `emergency.html`
   - `emergency.pdf`
   - `emergency.md`
   - `scores.csv`
   - これらを R2 に保存し、障害時にすぐ印刷できるようにする。

3. **再入力用バックアップ**

   - `event-log.ndjson`
   - 紙運用に切り替えた後、復旧時にどこから手入力すればよいか分かるようにする。

最重要ファイルは `emergency.html` とする。PDF生成に失敗しても、HTMLをブラウザ印刷できれば大会は継続できる。

---

## 実装対象

以下を実装する。

### P0: 必須

- D1から現在の大会状態を取得するバックアップ生成処理
- R2への定期保存
- `emergency.html` の生成
- `emergency.md` の生成
- `state.json` の生成
- `scores.csv` の生成
- R2からバックアップをダウンロードするための専用 Worker
- 管理者向けの固定ダウンロードURL
- 本部PCで5分ごとに最新バックアップを取得できるスクリプト

### P1: 重要

- `emergency.pdf` の生成
- `event-log.ndjson` の生成
- 管理画面からの「今すぐ緊急パケット生成」ボタン
- バックアップ生成履歴の一覧
- `manifest.json` の生成

### P2: 余裕があれば実装

- 外部保存先への同期

  - Google Drive
  - GitHub private repository
  - S3互換ストレージ
  - 本部PCローカル

- 障害時モード UI
- 紙運用後の再入力補助 UI

---

## 保存先構造

R2 bucket には以下の構造で保存する。

```txt
backups/
  tournament-2026/
    latest/
      emergency.html
      emergency.pdf
      emergency.md
      state.json
      event-log.ndjson
      scores.csv
      manifest.json

    snapshots/
      2026-07-02T10-00-00+09-00/
        emergency.html
        emergency.pdf
        emergency.md
        state.json
        event-log.ndjson
        scores.csv
        manifest.json
```

`latest/` は緊急時に直接参照する最新版。
`snapshots/` は時系列で保存する監査・復元用。

---

## 生成すべきファイル

### 1. `emergency.html`

最重要ファイル。ブラウザで開いて、そのまま印刷できること。

含める内容:

- 大会名
- 生成時刻
- 最終イベント番号
- 最終更新時刻
- 全コートの現在状態
- 実施中の試合
- 待機中の試合
- 完了済み試合
- 団体戦の勝敗状況
- 各コート用の紙スコアシート
- 未実施試合一覧
- 障害時の手順
- 復旧後の再入力手順

A4印刷を前提に CSS を整える。

```css
@page {
	size: A4;
	margin: 12mm;
}

body {
	font-family: system-ui, sans-serif;
	font-size: 11pt;
	color: #111;
}

table {
	width: 100%;
	border-collapse: collapse;
	font-size: 9pt;
}

th,
td {
	border: 1px solid #333;
	padding: 3px 5px;
}

h1,
h2,
h3 {
	break-after: avoid;
}

.page-break {
	break-before: page;
}

.no-break {
	break-inside: avoid;
}

.critical {
	border: 2px solid #111;
	padding: 8px;
	margin: 8px 0;
}
```

### 2. `emergency.md`

人間が読める緊急用 Markdown。
GitHub / Obsidian / テキストエディタでも開けるようにする。

構成例:

```md
# 緊急運営継続パケット

大会: 東京大学リーグ 2026
生成時刻: 2026-07-02 13:05 JST
最終イベント番号: 1842

## 現在の進行状況

| コート | 状態 | 対戦 | 試合 | 現在スコア | 備考 |
| ------ | ---- | ---- | ---- | ---------- | ---- |

## 団体戦結果

| 対戦 | MD1 | MD2 | MD3 | XD  | WD  | 勝敗 |
| ---- | --- | --- | --- | --- | --- | ---- |

## 未実施試合

| 優先 | 対戦 | 種目 | コート候補 | 備考 |
| ---: | ---- | ---- | ---------- | ---- |

## 障害時の運営手順

1. このファイルまたは emergency.html を開く。
2. 必要なページを印刷する。
3. 各コートに紙スコアシートを配布する。
4. 以後のスコアは紙に記録する。
5. 復旧後、最終イベント番号以降をシステムに再入力する。
```

### 3. `emergency.pdf`

印刷用PDF。
PDF生成に失敗してもバックアップ全体を失敗扱いにしないこと。PDFは補助ファイルであり、主ファイルは `emergency.html` とする。

PDF生成は以下のいずれかを使う。

- Cloudflare Browser Rendering / Browser API
- Puppeteer 相当のPDF生成手段
- 外部サービス
- 既存環境に導入済みのHTML-to-PDFツール

### 4. `state.json`

システム復旧用の完全スナップショット。

含める情報:

```ts
type BackupState = {
	generatedAt: string;
	tournamentId: string;
	lastEventId: number;
	teams: unknown[];
	ties: unknown[];
	matches: unknown[];
	games: unknown[];
	courts: unknown[];
	standings?: unknown[];
	recentEvents: unknown[];
};
```

既存スキーマに合わせて型を調整すること。

### 5. `event-log.ndjson`

イベントログを NDJSON 形式で保存する。

例:

```json
{"id":1840,"type":"score.point","matchId":"m_123","side":"home","game":2,"home":10,"away":9}
{"id":1841,"type":"score.point","matchId":"m_123","side":"home","game":2,"home":11,"away":9}
{"id":1842,"type":"court.assigned","matchId":"m_124","courtId":"court_2"}
```

紙運用に切り替える際は、`lastEventId + 1` から手書き記録を開始できるようにする。

### 6. `scores.csv`

Excel / Numbers / Google Sheets で開けるスコア一覧。

列の例:

```csv
tie_id,tie_name,match_id,rubber_code,court,status,home_team,away_team,home_players,away_players,game1,game2,game3,winner
```

既存DBスキーマに合わせて調整する。

### 7. `manifest.json`

最新版バックアップのメタ情報。

```json
{
	"generatedAt": "2026-07-02T13:05:00+09:00",
	"tournamentId": "tournament-2026",
	"lastEventId": 1842,
	"files": [
		"emergency.html",
		"emergency.pdf",
		"emergency.md",
		"state.json",
		"event-log.ndjson",
		"scores.csv"
	]
}
```

---

## D1側の設計

既存の通常テーブルとは別に、可能であれば append-only の `event_log` テーブルを追加する。

```sql
CREATE TABLE IF NOT EXISTS event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  actor_id TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_log_tournament_id
ON event_log (tournament_id, id);
```

重要操作では、通常テーブル更新と `event_log` 追記を同時に行う。

対象操作:

- 試合開始
- 試合終了
- スコア加算
- undo
- correction
- コート割当
- 棄権
- 中断
- 再開
- 団体戦勝敗確定

可能であれば `idempotency_key` を使い、二重送信に耐えるようにする。

---

## backup-worker の要件

メインの大会運営アプリとは別 Worker として実装する。

理由:

- メインアプリが壊れてもバックアップ生成機能を残すため
- 管理画面障害時にも直接バックアップURLを使えるようにするため
- 責務を分離するため

### binding

必要な binding:

```ts
interface Env {
	DB: D1Database;
	BACKUP_BUCKET: R2Bucket;
	BACKUP_SECRET: string;
}
```

PDF生成を Worker 内で行う場合は、必要に応じて Browser Rendering 系の binding も追加する。

### scheduled handler

Cron Trigger により、1〜5分ごとにバックアップを生成する。

大会中は5分以下が望ましい。
スコア更新が多い場合、HTML / Markdown / JSON は1〜2分ごと、PDFは5分ごとでもよい。

### fetch handler

手動実行用エンドポイントを用意する。

```txt
POST /backup-now
Authorization: Bearer <BACKUP_SECRET>
```

このエンドポイントは管理画面の「今すぐ緊急パケット生成」ボタンから呼び出す。

---

## backup-worker の疑似コード

```ts
export default {
	async scheduled(controller, env, ctx) {
		ctx.waitUntil(generateEmergencyBackup(env, 'tournament-2026'));
	},

	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		if (url.pathname === '/backup-now') {
			const auth = request.headers.get('authorization');

			if (auth !== `Bearer ${env.BACKUP_SECRET}`) {
				return new Response('Unauthorized', { status: 401 });
			}

			await generateEmergencyBackup(env, 'tournament-2026');
			return Response.json({ ok: true });
		}

		return new Response('Not found', { status: 404 });
	}
};
```

### `generateEmergencyBackup`

```ts
async function generateEmergencyBackup(env: Env, tournamentId: string) {
	const snapshot = await collectSnapshot(env.DB, tournamentId);

	const html = renderEmergencyHtml(snapshot);
	const md = renderEmergencyMarkdown(snapshot);
	const json = JSON.stringify(snapshot, null, 2);
	const csv = renderScoresCsv(snapshot);
	const ndjson = renderEventLogNdjson(snapshot.recentEvents);

	const timestamp = toSafeTimestamp(snapshot.generatedAt);

	const base = `backups/${tournamentId}/snapshots/${timestamp}`;
	const latest = `backups/${tournamentId}/latest`;

	await Promise.all([
		putText(env, `${base}/emergency.html`, html, 'text/html; charset=utf-8'),
		putText(env, `${base}/emergency.md`, md, 'text/markdown; charset=utf-8'),
		putText(env, `${base}/state.json`, json, 'application/json; charset=utf-8'),
		putText(env, `${base}/scores.csv`, csv, 'text/csv; charset=utf-8'),
		putText(env, `${base}/event-log.ndjson`, ndjson, 'application/x-ndjson; charset=utf-8'),

		putText(env, `${latest}/emergency.html`, html, 'text/html; charset=utf-8'),
		putText(env, `${latest}/emergency.md`, md, 'text/markdown; charset=utf-8'),
		putText(env, `${latest}/state.json`, json, 'application/json; charset=utf-8'),
		putText(env, `${latest}/scores.csv`, csv, 'text/csv; charset=utf-8'),
		putText(env, `${latest}/event-log.ndjson`, ndjson, 'application/x-ndjson; charset=utf-8')
	]);

	try {
		const pdf = await renderPdfFromHtml(env, html);

		await Promise.all([
			env.BACKUP_BUCKET.put(`${base}/emergency.pdf`, pdf, {
				httpMetadata: { contentType: 'application/pdf' }
			}),
			env.BACKUP_BUCKET.put(`${latest}/emergency.pdf`, pdf, {
				httpMetadata: { contentType: 'application/pdf' }
			})
		]);
	} catch (error) {
		console.error('PDF generation failed', error);
	}

	await putText(
		env,
		`${latest}/manifest.json`,
		JSON.stringify(
			{
				generatedAt: snapshot.generatedAt,
				tournamentId,
				lastEventId: snapshot.lastEventId,
				files: [
					'emergency.html',
					'emergency.pdf',
					'emergency.md',
					'state.json',
					'event-log.ndjson',
					'scores.csv'
				]
			},
			null,
			2
		),
		'application/json; charset=utf-8'
	);
}
```

---

## collectSnapshot の要件

D1から、緊急運営に必要な情報を一括取得する。

最低限取得するもの:

- チーム
- 団体戦
- 個別試合
- ゲームスコア
- コート
- 順位
- 直近イベント
- 最終イベントID

実際のSQLは既存スキーマに合わせて実装する。

疑似コード:

```ts
async function collectSnapshot(db: D1Database, tournamentId: string): Promise<BackupState> {
	const [teams, ties, matches, games, courts, recentEvents, lastEvent] = await db.batch([
		db.prepare('SELECT * FROM teams WHERE tournament_id = ? ORDER BY name').bind(tournamentId),
		db.prepare('SELECT * FROM ties WHERE tournament_id = ? ORDER BY id').bind(tournamentId),
		db
			.prepare('SELECT * FROM matches WHERE tournament_id = ? ORDER BY court_id, id')
			.bind(tournamentId),
		db
			.prepare('SELECT * FROM games WHERE tournament_id = ? ORDER BY match_id, game_no')
			.bind(tournamentId),
		db.prepare('SELECT * FROM courts WHERE tournament_id = ? ORDER BY name').bind(tournamentId),
		db
			.prepare('SELECT * FROM event_log WHERE tournament_id = ? ORDER BY id DESC LIMIT 500')
			.bind(tournamentId),
		db
			.prepare(
				'SELECT COALESCE(MAX(id), 0) AS last_event_id FROM event_log WHERE tournament_id = ?'
			)
			.bind(tournamentId)
	]);

	return {
		generatedAt: new Date().toISOString(),
		tournamentId,
		lastEventId: Number(lastEvent.results?.[0]?.last_event_id ?? 0),
		teams: teams.results ?? [],
		ties: ties.results ?? [],
		matches: matches.results ?? [],
		games: games.results ?? [],
		courts: courts.results ?? [],
		recentEvents: recentEvents.results ?? []
	};
}
```

---

## emergency.html の構成

HTMLには以下のセクションを必ず含める。

### 1. 表紙

- 大会名
- 生成時刻
- 最終イベント番号
- 紙運用開始時の注意
- この資料を正として運営を継続する旨

### 2. 障害時手順

```txt
1. 本部PCで emergency.html または emergency.pdf を開く。
2. 必要ページを印刷する。
3. 各コートに紙スコアシートを配布する。
4. 以後の得点は紙に記録する。
5. 本部は団体戦進行表に転記する。
6. システム復旧後、最終イベント番号以降を手入力する。
7. 紙とシステムの勝敗・スコアを照合する。
```

### 3. コート別進行状況

| コート | 状態 | 対戦 | 種目 | 現在スコア | 備考 |
| ------ | ---- | ---- | ---- | ---------- | ---- |

### 4. 団体戦別勝敗状況

| 対戦 | MD1 | MD2 | MD3 | XD  | WD  | 勝敗 |
| ---- | --- | --- | --- | --- | --- | ---- |

### 5. 実施中試合

| コート | 対戦 | 種目 | 選手 | スコア | サーバー/備考 |
| ------ | ---- | ---- | ---- | ------ | ------------- |

### 6. 未実施試合

| 優先 | 対戦 | 種目 | コート候補 | 備考 |
| ---: | ---- | ---- | ---------- | ---- |

### 7. コート別紙スコアシート

各コートについて、手書き追記できる表を生成する。

```txt
コート: 1
対戦: A大学 vs B大学
種目: MD1
選手: A1/A2 vs B1/B2
現在スコア: 21-18, 11-9

以後は下に手書きで記録する。
```

|   No | 時刻 | 得点側 | Home | Away | 備考 |
| ---: | ---- | ------ | ---: | ---: | ---- |
| 1843 |      |        |      |      |      |
| 1844 |      |        |      |      |      |
| 1845 |      |        |      |      |      |
| 1846 |      |        |      |      |      |
| 1847 |      |        |      |      |      |

---

## backup-download Worker の要件

R2 bucket は public にしない。
専用 Worker 経由で必要ファイルだけを取得できるようにする。

### URL例

```txt
https://backup-admin.example.com/emergency.html?token=<DOWNLOAD_TOKEN>
https://backup-admin.example.com/emergency.pdf?token=<DOWNLOAD_TOKEN>
https://backup-admin.example.com/scores.csv?token=<DOWNLOAD_TOKEN>
https://backup-admin.example.com/state.json?token=<DOWNLOAD_TOKEN>
```

### 実装要件

- `DOWNLOAD_TOKEN` による簡易認証を行う
- R2 bucket は private のままにする
- `emergency.html` はブラウザで開けるよう `inline` にする
- `emergency.pdf` と `scores.csv` はダウンロードでも表示でもよい
- `state.json` と `event-log.ndjson` は管理者用とし、一般公開しない

### 疑似コード

```ts
interface Env {
	BACKUP_BUCKET: R2Bucket;
	DOWNLOAD_TOKEN: string;
}

const keyMap: Record<string, string> = {
	'/emergency.html': 'backups/tournament-2026/latest/emergency.html',
	'/emergency.pdf': 'backups/tournament-2026/latest/emergency.pdf',
	'/emergency.md': 'backups/tournament-2026/latest/emergency.md',
	'/scores.csv': 'backups/tournament-2026/latest/scores.csv',
	'/state.json': 'backups/tournament-2026/latest/state.json',
	'/event-log.ndjson': 'backups/tournament-2026/latest/event-log.ndjson',
	'/manifest.json': 'backups/tournament-2026/latest/manifest.json'
};

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		const token = url.searchParams.get('token');
		if (token !== env.DOWNLOAD_TOKEN) {
			return new Response('Unauthorized', { status: 401 });
		}

		const key = keyMap[url.pathname];

		if (!key) {
			return new Response('Not found', { status: 404 });
		}

		const object = await env.BACKUP_BUCKET.get(key);

		if (!object) {
			return new Response('Backup not found', { status: 404 });
		}

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set('etag', object.httpEtag);
		headers.set('cache-control', 'no-store');

		if (url.pathname.endsWith('.html')) {
			headers.set('content-type', 'text/html; charset=utf-8');
			headers.set('content-disposition', 'inline');
		}

		if (url.pathname.endsWith('.pdf')) {
			headers.set('content-type', 'application/pdf');
			headers.set('content-disposition', 'inline; filename="emergency.pdf"');
		}

		if (url.pathname.endsWith('.csv')) {
			headers.set('content-type', 'text/csv; charset=utf-8');
			headers.set('content-disposition', 'attachment; filename="scores.csv"');
		}

		return new Response(object.body, { headers });
	}
};
```

---

## 本部PC用の自動ダウンロードスクリプト

macOS / Linux 用に、以下のようなスクリプトを用意する。

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://backup-admin.example.com"
TOKEN="REPLACE_WITH_LONG_RANDOM_TOKEN"

DEST="$HOME/tournament-backup"
mkdir -p "$DEST"

curl -fsSL "$BASE_URL/emergency.html?token=$TOKEN" \
  -o "$DEST/emergency.html"

curl -fsSL "$BASE_URL/emergency.pdf?token=$TOKEN" \
  -o "$DEST/emergency.pdf" || true

curl -fsSL "$BASE_URL/emergency.md?token=$TOKEN" \
  -o "$DEST/emergency.md"

curl -fsSL "$BASE_URL/scores.csv?token=$TOKEN" \
  -o "$DEST/scores.csv"

curl -fsSL "$BASE_URL/manifest.json?token=$TOKEN" \
  -o "$DEST/manifest.json"

echo "Downloaded backup at $(date)"
```

このスクリプトを5分ごとに実行できるようにする。
macOSなら `launchd`、Linuxなら cron または systemd timer を使う。

---

## 管理画面への追加要件

既存の管理画面に以下を追加する。

### 緊急バックアップ画面

表示内容:

- 最新バックアップ生成時刻
- 最終イベント番号
- `emergency.html` を開くボタン
- `emergency.pdf` を開くボタン
- `scores.csv` をダウンロードするボタン
- `state.json` をダウンロードするボタン
- 「今すぐ緊急パケット生成」ボタン
- 障害時手順の簡易表示

### ボタン

```txt
[今すぐ緊急パケット生成]
[緊急HTMLを開く]
[緊急PDFを開く]
[スコアCSVをダウンロード]
[本部PC用スクリプトを表示]
```

管理画面が落ちた場合でも、ブックマーク済みの `backup-admin.example.com` のURLから直接開けるようにする。

---

## セキュリティ要件

- R2 bucket は原則 private にする。
- `state.json` と `event-log.ndjson` は公開しない。
- ダウンロード Worker は長いランダムトークンで保護する。
- トークンは `.env` や Cloudflare secrets に置く。
- トークンをリポジトリにコミットしない。
- `cache-control: no-store` を設定する。
- public URL を使う場合は、個人情報・選手名・内部IDを含まないファイルに限定する。
- 大会本部用のURLは、事前に本部PC・責任者スマホにブックマークしておく。

---

## 障害時運用手順

`emergency.html` と `emergency.pdf` の両方に、以下の手順を含める。

```txt
障害時の運営手順

1. 本部PCの ~/tournament-backup/emergency.html を開く。
2. 開けない場合は backup-admin.example.com の緊急URLを開く。
3. emergency.pdf または emergency.html を印刷する。
4. 各コートに該当する紙スコアシートを配布する。
5. 各コートでは以後の得点を紙に記録する。
6. 本部は団体戦進行表に勝敗を転記する。
7. システム復旧後、最終イベント番号以降の紙記録を再入力する。
8. 再入力後、紙の勝敗・スコアとシステム表示を照合する。
```

---

## 復旧後の再入力方針

紙運用開始時点の `lastEventId` を基準にする。

例:

```txt
最終イベント番号: 1842
紙運用開始後の記録は 1843 番相当として扱う。
```

復旧後は以下の流れにする。

1. `state.json` で障害発生直前の状態を確認する。
2. `event-log.ndjson` で最後に反映済みのイベントを確認する。
3. 紙スコアシートの内容を時系列に入力する。
4. 団体戦勝敗を再計算する。
5. 紙の最終結果とシステムの最終結果を照合する。
6. 差分があれば、修正イベントとして記録する。

---

## バックアップ頻度

大会中の推奨頻度:

| ファイル           |        頻度 | 目的                 |
| ------------------ | ----------: | -------------------- |
| `state.json`       |  1〜2分ごと | 復旧                 |
| `event-log.ndjson` |  1〜2分ごと | 再入力               |
| `emergency.html`   |  1〜2分ごと | 即時印刷             |
| `emergency.md`     |  1〜2分ごと | 人間可読             |
| `scores.csv`       |  1〜2分ごと | 表計算・紙転記       |
| `emergency.pdf`    |     5分ごと | 印刷配布             |
| 外部同期           | 5〜15分ごと | Cloudflare外への退避 |

Cron Trigger は最短で必要な頻度に設定する。
PDF生成が重い場合、HTML / JSON / CSV と PDF を別スケジュールに分けてもよい。

---

## 実装上の注意

- PDF生成が失敗しても、HTML / Markdown / JSON / CSV の保存は成功扱いにする。
- `latest/` は常に上書きする。
- `snapshots/` は時刻付きで追記保存する。
- timestamp はファイルパスに使える安全な形式に変換する。
- 日本時間表示を使う場合、UI上では JST を明記する。
- 内部保存は ISO 8601 を基本とする。
- 既存DBスキーマを壊さない。
- 大会IDをハードコードしすぎない。可能なら環境変数にする。
- 重要操作は append-only event log に残す。
- バックアップ生成失敗時はログを出す。
- 管理画面に最後の成功時刻を表示できるようにする。
- 本番大会前に、必ず印刷テストを行えるようにする。

---

## 受け入れ条件

以下を満たせば完了とする。

### 必須条件

- D1から大会状態を取得できる。
- R2の `latest/` に `emergency.html` が生成される。
- `emergency.html` をブラウザで開いて印刷できる。
- R2の `latest/` に `emergency.md` が生成される。
- R2の `latest/` に `state.json` が生成される。
- R2の `latest/` に `scores.csv` が生成される。
- 専用 download Worker 経由で `emergency.html` を開ける。
- R2 bucket を public にしなくても取得できる。
- 本部PC用スクリプトで最新ファイルをローカル保存できる。

### 重要条件

- `emergency.pdf` が生成される。
- PDF生成失敗時も他ファイル生成は失敗しない。
- `manifest.json` に最新生成時刻と `lastEventId` が入る。
- 管理画面から手動バックアップ生成できる。
- 障害時手順が `emergency.html` / `emergency.pdf` に含まれる。
- コート別紙スコアシートが印刷される。

### テスト条件

- ローカルまたは staging D1 でバックアップ生成を実行できる。
- R2に期待通りのキーで保存される。
- `latest/` が上書きされる。
- `snapshots/` に時刻付き履歴が残る。
- download Worker で不正トークンが拒否される。
- 正しいトークンでは各ファイルを取得できる。
- `emergency.html` をA4印刷したときに表が崩れない。
- PDF生成失敗を意図的に起こしても、HTML / Markdown / JSON / CSV は残る。

---

## 最終的に目指す状態

大会中にシステムが落ちた場合でも、以下の流れで5分以内に紙運用へ移行できる状態を作る。

```txt
障害発生
  ↓
本部PCの ~/tournament-backup/emergency.html を開く
  ↓
印刷
  ↓
各コートに紙スコアシート配布
  ↓
紙で試合継続
  ↓
復旧後に lastEventId 以降を再入力
```

このため、実装では D1 復元よりも、`emergency.html` / `emergency.pdf` / `scores.csv` の可用性を優先すること。
