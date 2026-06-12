## Project Configuration

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Add-ons**: prettier, eslint, vitest, tailwindcss, drizzle, better-auth, mcp

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

# バドミントン・ライブスコアシステム 実装要件定義 v0.1

## 0. 目的

SvelteKit + Cloudflare D1 + Drizzle ORM を用いて、バドミントンの大会・コート・試合・審判入力・ライブスコア表示を行うWebアプリケーションを実装する。

対象機能は以下とする。

- 大会作成
- コート作成
- 試合作成
- シングルス・ダブルス対応
- ダブルスのサーバー・レシーバー・左右サービスコート管理
- 審判入力
  - 試合開始
  - 得点 +1
  - undo
  - correction
  - 棄権
  - リタイア
  - 中断
  - 再開
  - 結果確定

- 公開ライブスコア表示
- イベントログ保存
- 将来のWebSocket配信に耐えるイベントソーシング設計

## 1. 技術スタック

### 必須

- SvelteKit
- TypeScript
- Svelte 5 syntax
- `+page.server.ts` の `load` と `actions`
- Cloudflare adapter
- Cloudflare D1
- Drizzle ORM
- Drizzle Kit
- Wrangler
- Vitest

### 原則

- サーバーサイド処理は、原則として `+page.server.ts` の `load` / `actions` に書く。
- この段階では `+server.ts` を原則使わない。
- DBアクセスはすべて `src/lib/server/db` 以下に閉じる。
- バドミントンのルール計算はDBに依存しない純粋関数として `src/lib/domain` 以下に置く。
- 得点や訂正の正本は `score_events` の append-only ログとする。
- `matches` の現在スコアは表示高速化用の冗長状態とする。
- `match_snapshots.state_json` は復旧・undo・将来のDurable Objects移行用の現在状態スナップショットとする。

## 2. ディレクトリ構成

以下の構成を基本とする。

```txt
src/
  app.d.ts

  lib/
    domain/
      types.ts
      scoring.ts
      service.ts
      state.ts
      scoring.test.ts
      service.test.ts

    server/
      db/
        schema.ts
        client.ts
      repositories/
        matchRepository.ts
        tournamentRepository.ts
        scoreEventRepository.ts
      services/
        matchActionService.ts

  routes/
    tournaments/
      +page.svelte
      +page.server.ts

    tournaments/[tournamentId]/
      +page.svelte
      +page.server.ts

    tournaments/[tournamentId]/matches/new/
      +page.svelte
      +page.server.ts

    referee/[matchId]/
      +page.svelte
      +page.server.ts

    live/[tournamentId]/
      +page.svelte
      +page.server.ts

drizzle/
drizzle.config.ts
wrangler.toml
```

## 3. ドメイン概念

### 3.1 Side

```ts
export type Side = 'A' | 'B';
```

### 3.2 Discipline

```ts
export type MatchDiscipline = 'MS' | 'WS' | 'MD' | 'WD' | 'XD';
```

- `MS`: 男子シングルス
- `WS`: 女子シングルス
- `MD`: 男子ダブルス
- `WD`: 女子ダブルス
- `XD`: 混合ダブルス

### 3.3 ServiceCourt

```ts
export type ServiceCourt = 'right' | 'left';
```

意味は、各サイドから見た右サービスコート・左サービスコートである。

## 4. バドミントン得点ルール

### 4.1 通常得点方式

通常は以下を採用する。

```ts
export interface ScoringConfig {
	maxGames: number;
	gamesToWin: number;
	pointsToWin: number;
	winBy: number;
	maxPoints: number;
	midGameIntervalPoint: number;
}

export const DEFAULT_BWF_SCORING_CONFIG: ScoringConfig = {
	maxGames: 3,
	gamesToWin: 2,
	pointsToWin: 21,
	winBy: 2,
	maxPoints: 30,
	midGameIntervalPoint: 11
};
```

### 4.2 ゲーム勝利判定

`isGameWon(score, side, config)` を実装する。

要件:

- `own < 21` なら勝利ではない。
- `own >= 21` かつ `own - other >= 2` なら勝利。
- ただし `own === 30` なら、点差が1点でも勝利。
- 例:
  - 21-19: 勝利
  - 21-20: 未勝利
  - 22-20: 勝利
  - 29-29: 未勝利
  - 30-29: 勝利

### 4.3 マッチ勝利判定

`isMatchWon(gamesWon, side, config)` を実装する。

要件:

- 通常は2ゲーム先取でマッチ勝利。
- `gamesWon[side] >= config.gamesToWin` ならマッチ勝利。

## 5. サーブ管理要件

## 5.1 シングルス

シングルスでは以下を満たすこと。

- サーバー側の得点が偶数なら右サービスコート。
- サーバー側の得点が奇数なら左サービスコート。
- サーバーがラリーを取った場合、同じプレイヤーが反対側のサービスコートから再度サーブ。
- レシーバーがラリーを取った場合、レシーバーが新サーバーになる。

## 5.2 ダブルス

ダブルスでは以下を満たすこと。

- サーブ側の得点が偶数なら右サービスコートからサーブ。
- サーブ側の得点が奇数なら左サービスコートからサーブ。
- サーブ側がラリーを取った場合:
  - サーブ側に1点加算。
  - 同じサーバーがサーブ継続。
  - サーブ側の2人だけ左右サービスコートを入れ替える。
  - レシーブ側の2人は左右を入れ替えない。
  - レシーバーは、サーバーの対角サービスコートにいる相手プレイヤーになる。

- レシーブ側がラリーを取った場合:
  - レシーブ側に1点加算。
  - レシーブ側が新しいサーブ側になる。
  - どちらのペアも左右サービスコートを入れ替えない。
  - 新サーブ側の得点偶奇に対応するサービスコートにいるプレイヤーが新サーバーになる。
  - その対角サービスコートにいる相手プレイヤーが新レシーバーになる。

- プレイヤーは「自分のサイドがサーブ側として得点したとき」までサービスコートを入れ替えない。
- 次ゲームでは、前ゲーム勝者側のどちらのプレイヤーが最初にサーブしてもよい。敗者側のどちらのプレイヤーが最初にレシーブしてもよい。したがって、次ゲーム開始時にはUIで初期サーバー・初期レシーバーを選択させる。

## 6. ドメイン型

`src/lib/domain/types.ts` に以下を定義する。

```ts
export type Side = 'A' | 'B';

export type MatchDiscipline = 'MS' | 'WS' | 'MD' | 'WD' | 'XD';

export type ServiceCourt = 'right' | 'left';

export type MatchStatus =
	| 'scheduled'
	| 'playing'
	| 'interval'
	| 'suspended'
	| 'finished'
	| 'confirmed'
	| 'forfeited'
	| 'retired'
	| 'cancelled';

export type TerminalReason =
	| 'normal'
	| 'forfeit'
	| 'retirement'
	| 'disqualification'
	| 'walkover'
	| 'cancelled';

export interface GameScore {
	A: number;
	B: number;
}

export interface MatchPlayer {
	id: string;
	side: Side;
	order: 1 | 2;
	name: string;
	teamName?: string | null;
}

export interface CourtAssignment {
	right: string;
	left: string;
}

export interface CourtAssignments {
	A: CourtAssignment;
	B: CourtAssignment;
}

export interface SinglesServiceState {
	discipline: 'singles';
	servingSide: Side;
	serviceCourt: ServiceCourt;
	serverPlayerId: string;
	receiverPlayerId: string;
}

export interface DoublesServiceState {
	discipline: 'doubles';
	servingSide: Side;
	serviceCourt: ServiceCourt;
	serverPlayerId: string;
	receiverPlayerId: string;
	courtAssignments: CourtAssignments;
	initialServerPlayerId: string;
	initialReceiverPlayerId: string;
}

export type ServiceState = SinglesServiceState | DoublesServiceState;

export interface ScoringConfig {
	maxGames: number;
	gamesToWin: number;
	pointsToWin: number;
	winBy: number;
	maxPoints: number;
	midGameIntervalPoint: number;
}

export interface GameState {
	gameNo: number;
	score: GameScore;
	winnerSide: Side | null;
	midGameIntervalTaken: boolean;
	changeEndsRequired: boolean;
	changeEndsCompleted: boolean;
}

export interface MatchState {
	schemaVersion: 1;

	matchId: string;
	tournamentId: string;
	courtId: string | null;

	discipline: MatchDiscipline;

	status: MatchStatus;

	scoring: ScoringConfig;

	currentGameNo: number;

	games: GameState[];

	gamesWon: {
		A: number;
		B: number;
	};

	winnerSide: Side | null;
	terminalReason: TerminalReason | null;

	service: ServiceState | null;

	lastSeqNo: number;

	createdAt: string;
	updatedAt: string;
}
```

## 7. ScoreEventInput

`ScoreEventInput` は審判端末から送られる操作である。
現在スコアを直接送らせず、「何が起きたか」を送らせる。

```ts
export interface ScoreEventInputBase {
	idempotencyKey: string;
	observedSeqNo: number;
	clientSeqNo?: number;
	clientCreatedAt?: string;
}

export type ScoreEventInput =
	| MatchStartedInput
	| GameStartedInput
	| RallyWonInput
	| UndoInput
	| CorrectionInput
	| LetCalledInput
	| MatchSuspendedInput
	| MatchResumedInput
	| SideForfeitedInput
	| SideRetiredInput
	| MatchConfirmedInput;

export interface MatchStartedInput extends ScoreEventInputBase {
	type: 'match_started';
	initialServerPlayerId: string;
	initialReceiverPlayerId: string;
}

export interface GameStartedInput extends ScoreEventInputBase {
	type: 'game_started';
	gameNo: number;
	initialServerPlayerId: string;
	initialReceiverPlayerId: string;
}

export interface RallyWonInput extends ScoreEventInputBase {
	type: 'rally_won';
	side: Side;
}

export interface UndoInput extends ScoreEventInputBase {
	type: 'undo';
	targetSeqNo?: number;
	reason?: string;
}

export interface CorrectionInput extends ScoreEventInputBase {
	type: 'correction';
	gameNo: number;
	score: GameScore;
	gamesWon?: {
		A: number;
		B: number;
	};
	service?: ServiceState | null;
	reason: string;
}

export interface LetCalledInput extends ScoreEventInputBase {
	type: 'let_called';
	reason:
		| 'receiver_not_ready'
		| 'both_faulted'
		| 'shuttle_caught_on_net'
		| 'shuttle_disintegrated'
		| 'line_judge_unsighted'
		| 'unforeseen_situation'
		| 'other';
	note?: string;
}

export interface MatchSuspendedInput extends ScoreEventInputBase {
	type: 'match_suspended';
	reason:
		| 'injury'
		| 'equipment'
		| 'court_condition'
		| 'power_failure'
		| 'weather'
		| 'referee_decision'
		| 'other';
	note?: string;
}

export interface MatchResumedInput extends ScoreEventInputBase {
	type: 'match_resumed';
	note?: string;
}

export interface SideForfeitedInput extends ScoreEventInputBase {
	type: 'side_forfeited';
	side: Side;
	reason: 'no_show' | 'withdrawal' | 'disqualification' | 'other';
	note?: string;
}

export interface SideRetiredInput extends ScoreEventInputBase {
	type: 'side_retired';
	side: Side;
	reason: 'injury' | 'illness' | 'other';
	note?: string;
}

export interface MatchConfirmedInput extends ScoreEventInputBase {
	type: 'match_confirmed';
	note?: string;
}
```

## 8. 純粋関数要件

`src/lib/domain/service.ts` に以下を実装する。

### 8.1 基本補助関数

```ts
otherSide(side: Side): Side
otherCourt(court: ServiceCourt): ServiceCourt
serviceCourtForScore(score: number): ServiceCourt
scoreOfSide(score: GameScore, side: Side): number
playerOnCourt(assignments: CourtAssignments, side: Side, court: ServiceCourt): string
swapCourtsForSide(assignments: CourtAssignments, side: Side): CourtAssignments
sideOfPlayer(players: MatchPlayer[], playerId: string): Side
validateDoublesPlayers(players: MatchPlayer[]): void
```

要件:

- `serviceCourtForScore(0)` は `'right'`
- `serviceCourtForScore(1)` は `'left'`
- 偶数点は `'right'`
- 奇数点は `'left'`
- `validateDoublesPlayers` はA/Bそれぞれ2名でない場合に例外を投げる。

### 8.2 ダブルス初期サービス状態

```ts
createInitialDoublesServiceState(params: {
  players: MatchPlayer[];
  initialServerPlayerId: string;
  initialReceiverPlayerId: string;
}): DoublesServiceState
```

要件:

- A/Bそれぞれ2名であること。
- initial server と initial receiver は反対サイドであること。
- 0-0開始なので initial server は右サービスコートに置く。
- initial receiver も右サービスコートに置く。
- それぞれのパートナーは左サービスコートに置く。
- `servingSide` は initial server の所属サイド。
- `serviceCourt` は `'right'`
- `serverPlayerId` は initial server
- `receiverPlayerId` は initial receiver
- `courtAssignments` は両サイドの右/左配置を保持する。

### 8.3 ダブルスのラリー後サービス更新

```ts
applyDoublesServiceAfterRally(params: {
  before: DoublesServiceState;
  scoreAfter: GameScore;
  rallyWinner: Side;
}): DoublesServiceState
```

要件:

サーブ側がラリーを取った場合:

- `servingSide` は変わらない。
- `serverPlayerId` は変わらない。
- サーブ側の `courtAssignments` だけ左右を入れ替える。
- レシーブ側の `courtAssignments` は変えない。
- `serviceCourt` は得点後のサーブ側スコアの偶奇から決める。
- `receiverPlayerId` は、新しい `serviceCourt` と対角になるレシーブ側プレイヤーとする。

レシーブ側がラリーを取った場合:

- レシーブ側が新しい `servingSide` になる。
- A/Bどちらの `courtAssignments` も変更しない。
- `serviceCourt` は得点後の新サーブ側スコアの偶奇から決める。
- `serverPlayerId` は新サーブ側の `serviceCourt` にいるプレイヤー。
- `receiverPlayerId` は新レシーブ側の同じ `serviceCourt` にいるプレイヤー。

## 9. scoring.ts 要件

`src/lib/domain/scoring.ts` に以下を実装する。

```ts
createInitialMatchState(params: {
  matchId: string;
  tournamentId: string;
  courtId: string | null;
  discipline: MatchDiscipline;
  now: string;
  scoring?: ScoringConfig;
}): MatchState

getCurrentGame(state: MatchState): GameState

isGameWon(score: GameScore, side: Side, config: ScoringConfig): boolean

isMatchWon(gamesWon: { A: number; B: number }, side: Side, config: ScoringConfig): boolean

applyScoreEvent(params: {
  state: MatchState;
  input: ScoreEventInput;
  players: MatchPlayer[];
  now: string;
}): MatchState
```

### 9.1 applyScoreEvent 共通要件

- `input.observedSeqNo !== state.lastSeqNo` の場合は例外を投げる。
- 正常適用時は `lastSeqNo` を必ず1増やす。
- 正常適用時は `updatedAt` を `now` にする。
- `idempotencyKey` の重複排除はDB保存層で行う。
- 不正な状態遷移は例外を投げる。
- 例外時はDBを更新しない。

### 9.2 match_started

要件:

- `state.status === 'scheduled'` のときのみ実行可能。
- `discipline` がダブルスなら `createInitialDoublesServiceState` を使う。
- `discipline` がシングルスならシングルス用サービス状態を作る。
- `status` を `'playing'` にする。
- `service` をセットする。

### 9.3 game_started

要件:

- `state.status === 'interval'` のときのみ実行可能。
- `gameNo === state.currentGameNo` であること。
- 次ゲームの初期サーバー・初期レシーバーをセットする。
- `status` を `'playing'` にする。
- `service` をセットする。

### 9.4 rally_won

要件:

- `state.status === 'playing'` のときのみ実行可能。
- `side` に1点加算する。
- 11点インターバル到達時は `midGameIntervalTaken` を `true` にする。
- ゲーム未終了なら、サーブ状態を更新して継続。
- ゲーム終了なら:
  - 対象 `GameState.winnerSide` をセット。
  - `gamesWon[side] += 1`
  - マッチ終了なら `status = 'finished'`, `winnerSide = side`, `terminalReason = 'normal'`, `service = null`
  - マッチ未終了なら `status = 'interval'`, `currentGameNo += 1`, 次ゲームの空 `GameState` を追加, `service = null`

- 第3ゲームでどちらかが11点に到達した場合、`changeEndsRequired = true` にする。
- チェンジエンド自体の完了管理は後続UIで行う。MVPではフラグのみでよい。

### 9.5 correction

要件:

- `score.A` と `score.B` は0以上。
- `score.A` と `score.B` は `maxPoints` 以下。
- 指定 `gameNo` のスコアを上書きする。
- `service` が渡された場合、`state.service` も上書きする。
- correctionは強権操作なので、UIでは理由必須。
- correction時はゲーム勝敗・マッチ勝敗を自動再計算してもよいが、MVPでは現在ゲーム中のスコア修正に限定してよい。
- 実装する場合、終了済みゲームのcorrectionは後回しでよい。

### 9.6 undo

要件:

- 過去イベントを削除しない。
- 新しい `undo_applied` イベントとして保存する。
- undo対象は指定がなければ直近の取り消し可能イベント。
- 取り消し可能イベントは `rally_won`, `correction_applied`, `match_suspended`, `match_resumed` とする。
- MVPでは `score_events.payloadJson.afterState` または `payloadJson.beforeState` を保存し、undo時に対象イベントの `beforeState` へ戻す。
- 同じ `targetSeqNo` を二重にundoしてはいけない。
- 二重undo防止のため、後述の `score_event_undo_links` を使う。

### 9.7 let_called

要件:

- スコアは変化しない。
- サーブ状態も変化しない。
- イベントログには残す。
- `lastSeqNo` は1増やす。

### 9.8 match_suspended

要件:

- `status === 'playing'` または `status === 'interval'` のときのみ実行可能。
- `status = 'suspended'`
- スコア・サーブ状態は変えない。
- イベントログに理由を保存する。

### 9.9 match_resumed

要件:

- `status === 'suspended'` のときのみ実行可能。
- `status = 'playing'`
- スコア・サーブ状態は変えない。

### 9.10 side_forfeited

要件:

- 指定された `side` が棄権側。
- 相手側を `winnerSide` にする。
- `status = 'forfeited'`
- `terminalReason = 'forfeit'`
- `service = null`

### 9.11 side_retired

要件:

- 指定された `side` がリタイア側。
- 相手側を `winnerSide` にする。
- `status = 'retired'`
- `terminalReason = 'retirement'`
- `service = null`

### 9.12 match_confirmed

要件:

- `status` が `finished`, `forfeited`, `retired` のいずれかの場合のみ実行可能。
- `status = 'confirmed'`
- スコア・サーブ状態は変えない。

## 10. DBスキーマ要件

Drizzle schemaを `src/lib/server/db/schema.ts` に定義する。

### 10.1 tournaments

目的: 大会情報。

必須カラム:

- `id text primary key`
- `name text not null`
- `venue text nullable`
- `startsAt text nullable`
- `endsAt text nullable`
- `status text not null default 'draft'`
- `publicSlug text unique nullable`
- `createdAt text not null default CURRENT_TIMESTAMP`
- `updatedAt text not null default CURRENT_TIMESTAMP`

status enum:

- `draft`
- `published`
- `running`
- `finished`
- `archived`
- `cancelled`

### 10.2 courts

目的: 大会内コート。

必須カラム:

- `id text primary key`
- `tournamentId text not null references tournaments.id on delete cascade`
- `name text not null`
- `displayOrder integer not null default 0`
- `status text not null default 'active'`
- `createdAt`
- `updatedAt`

制約:

- unique `(tournamentId, name)`

### 10.3 matches

目的: 試合本体。ライブ一覧表示用の現在状態を冗長保持する。

必須カラム:

- `id text primary key`
- `tournamentId text not null references tournaments.id on delete cascade`
- `courtId text nullable references courts.id on delete set null`
- `discipline text not null`
- `matchNo integer nullable`
- `displayOrder integer not null default 0`
- `eventName text nullable`
- `category text nullable`
- `roundName text nullable`
- `scoringMode text not null default 'best_of_3_21'`
- `status text not null default 'scheduled'`
- `currentGameNo integer not null default 1`
- `currentScoreA integer not null default 0`
- `currentScoreB integer not null default 0`
- `gamesWonA integer not null default 0`
- `gamesWonB integer not null default 0`
- `winnerSide text nullable`
- `currentServingSide text nullable`
- `currentServiceCourt text nullable`
- `currentServerPlayerId text nullable`
- `currentReceiverPlayerId text nullable`
- `lastSeqNo integer not null default 0`
- `scheduledStartAt text nullable`
- `actualStartAt text nullable`
- `actualEndAt text nullable`
- `createdAt`
- `updatedAt`

discipline enum:

- `MS`
- `WS`
- `MD`
- `WD`
- `XD`

status enum:

- `scheduled`
- `called`
- `warmup`
- `playing`
- `interval`
- `suspended`
- `forfeited`
- `retired`
- `finished`
- `confirmed`
- `cancelled`

### 10.4 match_sides

目的: A/Bサイドの表示名・シード情報。

必須カラム:

- `id text primary key`
- `matchId text not null references matches.id on delete cascade`
- `side text not null`
- `displayName text not null`
- `seedNo integer nullable`
- `createdAt`
- `updatedAt`

制約:

- unique `(matchId, side)`

### 10.5 match_side_players

目的: サイド内の選手。ダブルスのサーブ順管理で必須。

必須カラム:

- `id text primary key`
- `matchId text not null references matches.id on delete cascade`
- `side text not null`
- `playerOrder integer not null`
- `name text not null`
- `teamName text nullable`
- `createdAt`
- `updatedAt`

制約:

- unique `(matchId, side, playerOrder)`

要件:

- シングルスでは各サイド `playerOrder = 1` のみ。
- ダブルスでは各サイド `playerOrder = 1, 2` が必須。
- `id` は `MatchPlayer.id` として使う。

### 10.6 match_snapshots

目的: 現在の `MatchState` JSONを保存する。

必須カラム:

- `matchId text primary key references matches.id on delete cascade`
- `seqNo integer not null`
- `stateJson text not null`
- `updatedAt text not null default CURRENT_TIMESTAMP`

要件:

- `stateJson` は `MatchState` をJSON.stringifyしたもの。
- `seqNo` は `state.lastSeqNo` と一致する。

### 10.7 match_service_states

目的: 現在サービス状態を検索しやすく保存する。

必須カラム:

- `matchId text primary key references matches.id on delete cascade`
- `gameNo integer not null`
- `servingSide text nullable`
- `serviceCourt text nullable`
- `serverPlayerId text nullable`
- `receiverPlayerId text nullable`
- `courtAssignmentsJson text not null default '{}'`
- `updatedAt text not null default CURRENT_TIMESTAMP`

要件:

- `courtAssignmentsJson` はダブルスの場合に以下形式:
  - `{ "A": { "right": "...", "left": "..." }, "B": { "right": "...", "left": "..." } }`

- シングルスでは `{}` でよい。

### 10.8 score_events

目的: append-onlyの試合イベントログ。正本。

必須カラム:

- `id text primary key`
- `matchId text not null references matches.id on delete cascade`
- `seqNo integer not null`
- `eventType text not null`
- `side text nullable`
- `gameNo integer nullable`
- `scoreABefore integer nullable`
- `scoreBBefore integer nullable`
- `scoreAAfter integer nullable`
- `scoreBAfter integer nullable`
- `servingSideBefore text nullable`
- `serviceCourtBefore text nullable`
- `serverPlayerIdBefore text nullable`
- `receiverPlayerIdBefore text nullable`
- `servingSideAfter text nullable`
- `serviceCourtAfter text nullable`
- `serverPlayerIdAfter text nullable`
- `receiverPlayerIdAfter text nullable`
- `targetSeqNo integer nullable`
- `reason text nullable`
- `payloadJson text not null default '{}'`
- `actorName text nullable`
- `idempotencyKey text not null`
- `createdAt text not null default CURRENT_TIMESTAMP`

eventType enum:

- `match_started`
- `game_started`
- `rally_won`
- `undo_applied`
- `correction_applied`
- `let_called`
- `match_suspended`
- `match_resumed`
- `side_forfeited`
- `side_retired`
- `match_finished`
- `match_confirmed`

制約:

- unique `(matchId, seqNo)`
- unique `(matchId, idempotencyKey)`

payloadJson要件:

- 元の `ScoreEventInput`
- `beforeState` の要約
- `afterState` の要約
- undo用に可能なら `beforeState` 全体と `afterState` 全体も保存する

### 10.9 score_event_undo_links

目的: 同じイベントの二重undo防止。

必須カラム:

- `id text primary key`
- `matchId text not null references matches.id on delete cascade`
- `undoEventId text not null references score_events.id on delete cascade`
- `targetEventId text not null references score_events.id on delete cascade`
- `targetSeqNo integer not null`
- `createdAt text not null default CURRENT_TIMESTAMP`

制約:

- unique `(matchId, targetSeqNo)`

## 11. Repository要件

### 11.1 `matchRepository.ts`

以下を実装する。

```ts
getMatchWithPlayers(db, matchId)
getMatchState(db, matchId): Promise<MatchState>
getMatchPlayers(db, matchId): Promise<MatchPlayer[]>
createMatchWithPlayers(db, input): Promise<string>
updateMatchDerivedState(db, state): Promise<void>
upsertMatchSnapshot(db, state): Promise<void>
upsertMatchServiceState(db, state): Promise<void>
```

### 11.2 `scoreEventRepository.ts`

以下を実装する。

```ts
insertScoreEvent(db, params): Promise<void>
getScoreEvents(db, matchId): Promise<ScoreEvent[]>
getScoreEventBySeqNo(db, matchId, seqNo): Promise<ScoreEvent | null>
hasUndoLink(db, matchId, targetSeqNo): Promise<boolean>
insertUndoLink(db, params): Promise<void>
```

### 11.3 `tournamentRepository.ts`

以下を実装する。

```ts
createTournament(db, input): Promise<string>
listTournaments(db): Promise<Tournament[]>
getTournament(db, tournamentId): Promise<Tournament | null>
createCourt(db, input): Promise<string>
listCourts(db, tournamentId): Promise<Court[]>
listMatchesForTournament(db, tournamentId): Promise<LiveMatchSummary[]>
```

## 12. Service要件

`src/lib/server/services/matchActionService.ts` に、DB更新を一括する関数を作る。

```ts
applyMatchAction(params: {
  db: AppDb;
  matchId: string;
  input: ScoreEventInput;
  actorName?: string | null;
  now: string;
}): Promise<MatchState>
```

要件:

1. `match_snapshots` から現在 `MatchState` を読む。
2. `match_side_players` から `MatchPlayer[]` を読む。
3. `score_events` で `idempotencyKey` 重複を確認する。
4. `applyScoreEvent({ state, input, players, now })` を実行する。
5. before/afterのスコア・サーブ状態を取り出す。
6. `score_events` にイベントをinsertする。
7. `matches` の冗長状態をupdateする。
8. `match_snapshots` をupdateする。
9. `match_service_states` をupsertする。
10. undoの場合は `score_event_undo_links` もinsertする。
11. 途中で失敗した場合は不整合を残さない。

D1で完全な長時間transactionに依存しすぎないこと。現段階では `db.batch([...])` でまとまった更新を行う。将来Durable Objectsへ移行し、1試合内イベントを直列化する。

## 13. SvelteKitルート要件

## 13.1 `/tournaments`

ファイル:

- `src/routes/tournaments/+page.server.ts`
- `src/routes/tournaments/+page.svelte`

機能:

- 大会一覧表示
- 大会作成フォーム

actions:

- `create`

入力:

- `name`
- `venue`
- `startsAt`
- `endsAt`

バリデーション:

- `name` 必須

成功時:

- `/tournaments/[tournamentId]` に303 redirect

## 13.2 `/tournaments/[tournamentId]`

機能:

- 大会詳細表示
- コート一覧
- コート作成
- 試合一覧
- 試合作成ページへのリンク
- 公開ライブページへのリンク

actions:

- `createCourt`

入力:

- `name`
- `displayOrder`

## 13.3 `/tournaments/[tournamentId]/matches/new`

機能:

- 試合作成
- シングルス・ダブルス対応
- A/B選手入力

入力:

- `courtId`
- `discipline`
- `eventName`
- `category`
- `roundName`
- `sideAPlayer1Name`
- `sideAPlayer2Name`
- `sideBPlayer1Name`
- `sideBPlayer2Name`

バリデーション:

- `discipline` が `MS` / `WS` の場合:
  - A1必須
  - B1必須
  - A2/B2は空でよい

- `discipline` が `MD` / `WD` / `XD` の場合:
  - A1, A2, B1, B2すべて必須

- `XD` では性別管理はMVPでは不要。

作成時:

- `matches` 作成
- `match_sides` A/B作成
- `match_side_players` 作成
- `match_snapshots` に初期 `MatchState` を保存
- `match_service_states` に空状態を保存してもよい

成功時:

- `/referee/[matchId]` にredirect

## 13.4 `/referee/[matchId]`

機能:

- 審判入力画面
- 現在スコア表示
- 現在ゲーム表示
- 現在サーバー表示
- 現在レシーバー表示
- サービスコート表示
- ダブルスの場合、A/B各ペアの右/左サービスコート配置表示
- 得点+1ボタン
- 試合開始フォーム
- 次ゲーム開始フォーム
- undo
- correction
- 中断
- 再開
- 棄権
- リタイア
- 結果確定

actions:

- `start`
- `startGame`
- `rallyWon`
- `undo`
- `correction`
- `letCalled`
- `suspend`
- `resume`
- `forfeit`
- `retire`
- `confirm`

### start action

試合開始前のみ表示。

入力:

- `initialServerPlayerId`
- `initialReceiverPlayerId`

バリデーション:

- サーバーとレシーバーは反対サイド。
- ダブルスの場合、両サイド2人ずつ存在。
- シングルスの場合、両サイド1人ずつ存在。

### startGame action

ゲーム間インターバル中のみ表示。

入力:

- `gameNo`
- `initialServerPlayerId`
- `initialReceiverPlayerId`

要件:

- 前ゲーム勝者側のどちらかがサーバー。
- 前ゲーム敗者側のどちらかがレシーバー。
- MVPではこの制約を厳密にしなくてもよいが、実装可能なら行う。

### rallyWon action

入力:

- `side`: `A` or `B`

要件:

- `applyMatchAction` を呼ぶ。
- `idempotencyKey` はサーバー側で `crypto.randomUUID()` により生成してよい。
- `observedSeqNo` は現在snapshotの `lastSeqNo` を使う。

### correction action

入力:

- `gameNo`
- `scoreA`
- `scoreB`
- `reason`
- 任意で:
  - `servingSide`
  - `serviceCourt`
  - `serverPlayerId`
  - `receiverPlayerId`
  - `courtAssignmentsJson`

要件:

- reason必須。
- サービス状態を修正する場合は全項目必須。
- 不正なサーバー/レシーバーの組み合わせは拒否する。

### undo action

入力:

- `targetSeqNo` nullable
- `reason` nullable

要件:

- targetSeqNo指定なしなら直近の取り消し可能イベントを対象にする。
- 二重undoを拒否する。
- undo自体もイベントログに残す。

## 13.5 `/live/[tournamentId]`

機能:

- 公開ライブスコア一覧
- コート別表示
- 試合ステータス表示
- スコア表示
- ゲームカウント表示
- 現在サーバー表示
- 現在サービスコート表示

MVP:

- `load` でD1から現在状態を取得。
- 自動更新は不要。
- 後でWebSocket/SSE/定期ポーリングを追加する。

## 14. UI要件

### 14.1 審判入力画面

必須:

- スマホ・タブレットで押しやすい大きなボタン
- A +1 / B +1 は画面中央に大きく配置
- 誤タップ防止のため、棄権・リタイア・correctionは確認UIを挟む
- 画面上部に以下を表示:
  - 試合名
  - コート
  - 現在ゲーム
  - ステータス
  - seqNo

- スコアは非常に大きく表示
- 現在サーバーには「サーバー」ラベルを付ける
- 現在レシーバーには「レシーバー」ラベルを付ける
- ダブルスでは右/左サービスコート配置を表示

### 14.2 公開ライブスコア画面

必須:

- コート順に表示
- 試合中、待機中、終了の区別
- A/Bサイド名
- 各ゲームスコア
- 現在ゲームスコア
- ゲームカウント
- 現在サーバー
- `finished` / `confirmed` の区別

## 15. テスト要件

Vitestで以下を必ず実装する。

### 15.1 得点判定

- 21-19はゲーム勝利
- 21-20は未勝利
- 22-20はゲーム勝利
- 29-29は未勝利
- 30-29はゲーム勝利
- 2ゲーム先取でマッチ勝利

### 15.2 ダブルス初期配置

例:

- A1/A2 vs B1/B2
- initial server = A1
- initial receiver = B1

期待:

- servingSide = A
- serviceCourt = right
- serverPlayerId = A1
- receiverPlayerId = B1
- A.right = A1
- A.left = A2
- B.right = B1
- B.left = B2

### 15.3 ダブルス: サーブ側が得点

初期:

- A1が右からサーブ
- A 0 - B 0

Aが得点後:

- A 1 - B 0
- servingSide = A
- serverPlayerId = A1
- serviceCourt = left
- A.right = A2
- A.left = A1
- B.right = B1
- B.left = B2
- receiverPlayerId = B2

### 15.4 ダブルス: レシーブ側が得点

初期:

- A1が右からサーブ
- A 0 - B 0

Bが得点後:

- A 0 - B 1
- servingSide = B
- serviceCourt = left
- B.leftにいるプレイヤーがserver
- A.leftにいるプレイヤーがreceiver
- A/Bの左右配置は変わらない

### 15.5 ダブルス連続ラリー例

次の流れをテストする。

1. A1が0-0右からサーブ
2. Aが得点 → 1-0、A1が左からサーブ
3. Bが得点 → 1-1、Bの左側プレイヤーがサーブ
4. Bが得点 → 1-2、同じBサーバーが右からサーブ
5. Aが得点 → 2-2、Aの右側プレイヤーがサーブ

各時点で server/receiver/courtAssignments を検証する。

### 15.6 stale input

- `observedSeqNo !== state.lastSeqNo` の入力は拒否する。

### 15.7 correction

- スコアを修正できる。
- 不正な負のスコアを拒否する。
- 30点超を拒否する。
- サービス状態を指定した場合、state.serviceが更新される。

### 15.8 undo

- rally_wonをundoすると、スコアとサーブ状態が戻る。
- 同じtargetSeqNoを二重undoできない。
- undoイベントはscore_eventsに残る。

## 16. 実装順序

### Phase 1: ドメイン層

1. `types.ts`
2. `service.ts`
3. `scoring.ts`
4. `service.test.ts`
5. `scoring.test.ts`

この段階ではDBに触れない。

### Phase 2: DB層

1. `schema.ts`
2. `client.ts`
3. `drizzle.config.ts`
4. migration生成
5. local D1 migration適用
6. repository実装

### Phase 3: SvelteKit画面

1. `/tournaments`
2. `/tournaments/[tournamentId]`
3. `/tournaments/[tournamentId]/matches/new`
4. `/referee/[matchId]`
5. `/live/[tournamentId]`

### Phase 4: イベントログ・undo/correction強化

1. `score_events.payloadJson` にbefore/after state保存
2. undo実装
3. correction実装
4. 履歴表示

### Phase 5: リアルタイム化

この段階ではまだ実装しないが、将来は以下に移行する。

- 1試合1 Durable Object
- `applyMatchAction` の中身をDurable Objectに移す
- WebSocketで `score_event` をbroadcast
- D1は永続ログ・スナップショット・一覧表示用に維持

## 17. 非機能要件

### 17.1 一貫性

- 同一試合内のイベントは `seqNo` で全順序を持つ。
- `seqNo` は1から単調増加。
- `matches.lastSeqNo`, `match_snapshots.seqNo`, `MatchState.lastSeqNo` は一致すること。
- `score_events` は削除しない。

### 17.2 idempotency

- すべての `ScoreEventInput` に `idempotencyKey` を持たせる。
- DB上で `(matchId, idempotencyKey)` をuniqueにする。
- 同じ入力が再送された場合、二重加点してはいけない。

### 17.3 復旧性

- `match_snapshots.stateJson` から現在状態を復元できること。
- `score_events` から履歴を確認できること。
- 将来的には `score_events` の再適用でstateを再構成できること。

### 17.4 セキュリティ

MVPでは認証を最小限にしてよいが、以下を想定して実装箇所を分離する。

- 管理者
- 大会管理者
- コート管理者
- 審判
- 公開閲覧者

審判入力は将来的に一時コードまたはセッションで保護する。

### 17.5 型安全性

- `any` は原則使わない。
- JSON parse時は Valibot の型検証関数を挟む。
- `MatchState` の `schemaVersion` を持たせ、将来のstate migrationに備える。

## 18. 実装上の禁止事項

- 得点操作で `matches.currentScoreA += 1` のような直接更新だけを行ってはいけない。
- `score_events` を残さずにスコアだけ更新してはいけない。
- undoで過去イベントを削除してはいけない。
- correctionで理由なし更新を許してはいけない。
- ダブルスのサーブ順を単純な配列ローテーションだけで管理してはいけない。
- ダブルスでは、必ず各サイドの右/左サービスコート配置を状態として持つこと。
- DBアクセスをSvelteコンポーネント内に書いてはいけない。
- `src/lib/domain` からDBやSvelteKitに依存してはいけない。

## 19. 完了条件

以下が動作すれば、このフェーズは完了とする。

1. 大会を作成できる。
2. コートを作成できる。
3. シングルス試合を作成できる。
4. ダブルス試合を作成できる。
5. ダブルス試合でA/B各2名を登録できる。
6. 試合開始時に初期サーバー・初期レシーバーを選択できる。
7. A/B +1でスコアが更新される。
8. ダブルスのサーバー・レシーバー・右/左配置が正しく更新される。
9. 21点・2点差・30点上限でゲームが終了する。
10. 2ゲーム先取でマッチが終了する。
11. 次ゲーム開始時に初期サーバー・初期レシーバーを選べる。
12. 中断・再開ができる。
13. 棄権・リタイアができる。
14. correctionができる。
15. undoができる。
16. `score_events` に全操作がappend-onlyで保存される。
17. `match_snapshots` に最新 `MatchState` が保存される。
18. `/live/[tournamentId]` で現在スコア一覧を表示できる。
19. Vitestの得点・ダブルスサーブ順テストが通る。
