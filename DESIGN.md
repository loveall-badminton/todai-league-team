# 東大リーグ団体戦専用ライブスコア・運営アプリ 実装指示書 v1.1

## 0. 方針

本アプリは、東大リーグ団体戦専用の運営・ライブスコアアプリとして実装する。

汎用大会管理アプリにはしない。個人戦には対応しない。大会・競技・種目を自由に作れる抽象化も入れない。

ただし、前回大会プログラムに書かれているチーム名、試合番号、時刻、審判割り振りは seed しない。今回の大会では変わる可能性があるためである。

実装するのは、前回大会プログラムから抽出できる以下の「構造」と「運営ルール」である。

- Aリーグ・Bリーグの2リーグ制
- 予選リーグ総当たり
- 各リーグ上位2チームが決勝トーナメントへ
- 各リーグ3位が5位決定戦へ
- 準決勝1: A1位 vs B2位
- 準決勝2: A2位 vs B1位
- 5位決定戦: A3位 vs B3位
- 決勝: 準決勝1勝者 vs 準決勝2勝者
- 3位決定戦: 準決勝1敗者 vs 準決勝2敗者
- 団体戦1tieは5rubber固定
- rubber構成は `MD1`, `MD2`, `MD3`, `XD1`, `WD1`
- 実施順は `WD1 → XD1 → MD3 → MD2 → MD1`
- 予選は15点3ゲーム2ゲーム先取、デュースあり、21点上限
- 決勝トーナメントは21点3ゲーム2ゲーム先取、デュースあり、30点上限
- 予選順位決定方法は大会規則に従う
- それでも順位が確定しない場合、21点1ゲームマッチの再試合を作れる
- オーダーは試合前に提出
- 初戦のオーダー提出期限は手動設定可能
- 2戦目以降のオーダー提出期限は原則予定時刻10分前
- オーダーはtie開始時まで対戦相手・公開画面に表示しない
- 審判割り振りを管理できる
- 体育館・コートブロック・予定時刻を管理できる
- 当日進行変更を許容する

## 1. 不採用とする概念

以下の汎用概念は新規実装では使わない。

```txt
Tournament
Competition
Stage
Entry
Generic Fixture
Generic Bracket
Generic Team Match Format
```

既存コードからは極力削除する。

## 2. 中心概念

本アプリの中心概念は以下である。

```txt
team
  出場チーム

team_player
  チーム所属選手

tie
  団体戦カード
  例: Aリーグ第1戦、準決勝1、決勝

rubber
  tie内の個別試合
  WD1, XD1, MD3, MD2, MD1 のいずれか

match
  既存ライブスコアエンジンで進行する1試合

lineup_submission
  tieごとのチームオーダー提出

lineup_item
  オーダー内の各rubberの出場選手2名

officiating_assignment
  審判担当団体の割り振り

ranking_tiebreaker
  順位決定再試合
```

関係は以下。

```txt
tie
  ├─ rubber WD1 ─ match
  ├─ rubber XD1 ─ match
  ├─ rubber MD3 ─ match
  ├─ rubber MD2 ─ match
  └─ rubber MD1 ─ match

tie
  ├─ lineup_submission for team A
  │    ├─ lineup_item WD1
  │    ├─ lineup_item XD1
  │    ├─ lineup_item MD3
  │    ├─ lineup_item MD2
  │    └─ lineup_item MD1
  └─ lineup_submission for team B
       ├─ lineup_item WD1
       ├─ lineup_item XD1
       ├─ lineup_item MD3
       ├─ lineup_item MD2
       └─ lineup_item MD1
```

## 3. 固定定数

`src/lib/domain/tokyoLeague.ts` を作成し、以下を定義する。

```ts
export type GroupCode = 'A' | 'B';

export type VenueCode = 'first_gym' | 'second_gym';

export type TiePhase =
	| 'group_a'
	| 'group_b'
	| 'semifinal'
	| 'final'
	| 'third_place'
	| 'fifth_place'
	| 'ranking_tiebreaker';

export type RubberCode = 'WD1' | 'XD1' | 'MD3' | 'MD2' | 'MD1';

export type DoublesDiscipline = 'WD' | 'XD' | 'MD';

export const RUBBER_DEFINITIONS = [
	{
		code: 'WD1',
		discipline: 'WD',
		displayOrder: 1,
		label: '女子ダブルス'
	},
	{
		code: 'XD1',
		discipline: 'XD',
		displayOrder: 2,
		label: 'ミックスダブルス'
	},
	{
		code: 'MD3',
		discipline: 'MD',
		displayOrder: 3,
		label: '男子ダブルス3'
	},
	{
		code: 'MD2',
		discipline: 'MD',
		displayOrder: 4,
		label: '男子ダブルス2'
	},
	{
		code: 'MD1',
		discipline: 'MD',
		displayOrder: 5,
		label: '男子ダブルス1'
	}
] as const;

export const FINAL_TIE_DEFINITIONS = [
	{
		tieCode: 'x-1',
		phase: 'semifinal',
		roundLabel: '準決勝1',
		teamASource: 'A1',
		teamBSource: 'B2'
	},
	{
		tieCode: 'x-2',
		phase: 'semifinal',
		roundLabel: '準決勝2',
		teamASource: 'A2',
		teamBSource: 'B1'
	},
	{
		tieCode: 'x-3',
		phase: 'fifth_place',
		roundLabel: '5位決定戦',
		teamASource: 'A3',
		teamBSource: 'B3'
	},
	{
		tieCode: 'x-4',
		phase: 'third_place',
		roundLabel: '3位決定戦',
		teamASource: 'x-1_loser',
		teamBSource: 'x-2_loser'
	},
	{
		tieCode: 'x-5',
		phase: 'final',
		roundLabel: '決勝',
		teamASource: 'x-1_winner',
		teamBSource: 'x-2_winner'
	}
] as const;

export const COURT_BLOCKS = [
	{
		code: 'first_1_3',
		venue: 'first_gym',
		label: '第一体育館 1-3コート',
		courtNumbers: [1, 2, 3]
	},
	{
		code: 'first_4_6',
		venue: 'first_gym',
		label: '第一体育館 4-6コート',
		courtNumbers: [4, 5, 6]
	},
	{
		code: 'second_1_5',
		venue: 'second_gym',
		label: '第二体育館 1,5コート',
		courtNumbers: [1, 5]
	},
	{
		code: 'second_2_4',
		venue: 'second_gym',
		label: '第二体育館 2-4コート',
		courtNumbers: [2, 3, 4]
	},
	{
		code: 'second_6_8',
		venue: 'second_gym',
		label: '第二体育館 6-8コート',
		courtNumbers: [6, 7, 8]
	}
] as const;
```

注意:

- 前回大会のチーム名やA-1/B-1などの具体的なtieはseedしない。
- `FINAL_TIE_DEFINITIONS` の `x-1` から `x-5` は構造として採用してよい。
- 予選の `A-1` や `B-1` は、今回のチーム数や進行表に応じて管理者が生成・編集できるようにする。

## 4. 得点ルール

`scoring_rules` に以下の3種類を作れるようにする。

```txt
GROUP_15:
  予選用15点ルール

KNOCKOUT_21:
  決勝トーナメント21点ルール

TIEBREAKER_21_SINGLE_GAME:
  順位決定再試合用21点1ゲームマッチ
```

初期値:

```ts
GROUP_15 = {
	maxGames: 3,
	gamesToWin: 2,
	pointsToWin: 15,
	winBy: 2,
	maxPoints: 21,
	midGameIntervalPoint: 8
};

KNOCKOUT_21 = {
	maxGames: 3,
	gamesToWin: 2,
	pointsToWin: 21,
	winBy: 2,
	maxPoints: 30,
	midGameIntervalPoint: 11
};

TIEBREAKER_21_SINGLE_GAME = {
	maxGames: 1,
	gamesToWin: 1,
	pointsToWin: 21,
	winBy: 2,
	maxPoints: 30,
	midGameIntervalPoint: 11
};
```

要件:

- 予選リーグのtieでは原則 `GROUP_15` を使う。
- 準決勝、決勝、3位決定戦、5位決定戦では原則 `KNOCKOUT_21` を使う。
- 順位決定再試合では `TIEBREAKER_21_SINGLE_GAME` を使う。
- 管理画面でscoring ruleを編集できるようにする。
- 15点/21点をif文でハードコードしない。
- `rubbers.scoringRuleId` または `matches.scoringRuleId` から最終的な `ScoringConfig` を解決する。

## 5. DBスキーマ

Drizzle schemaとして定義する。

既存テーブル:

```txt
matches
match_sides
match_side_players
match_snapshots
match_service_states
score_events
```

これらは維持する。

## 5.1 `app_settings`

```ts
export const appSettings = sqliteTable('app_settings', {
	id: text('id').primaryKey(),

	eventName: text('event_name').notNull().default('東大リーグ団体戦'),

	groupStageScoringRuleId: text('group_stage_scoring_rule_id').references(() => scoringRules.id),

	knockoutScoringRuleId: text('knockout_scoring_rule_id').references(() => scoringRules.id),

	tiebreakerScoringRuleId: text('tiebreaker_scoring_rule_id').references(() => scoringRules.id),

	lineupRevealPolicy: text('lineup_reveal_policy', {
		enum: ['on_tie_start', 'manual']
	})
		.notNull()
		.default('on_tie_start'),

	defaultLineupDueMinutesBefore: integer('default_lineup_due_minutes_before').notNull().default(10),

	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});
```

要件:

- `id = 'default'` の1行だけ使う。
- 複数大会対応はしない。

## 5.2 `scoring_rules`

```ts
export const scoringRules = sqliteTable('scoring_rules', {
	id: text('id').primaryKey(),

	code: text('code').notNull().unique(),
	name: text('name').notNull(),

	maxGames: integer('max_games').notNull(),
	gamesToWin: integer('games_to_win').notNull(),
	pointsToWin: integer('points_to_win').notNull(),
	winBy: integer('win_by').notNull(),
	maxPoints: integer('max_points').notNull(),
	midGameIntervalPoint: integer('mid_game_interval_point').notNull(),

	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});
```

## 5.3 `teams`

```ts
export const teams = sqliteTable('teams', {
	id: text('id').primaryKey(),

	name: text('name').notNull(),
	shortName: text('short_name'),

	groupCode: text('group_code', {
		enum: ['A', 'B']
	}),

	displayOrder: integer('display_order').notNull().default(0),

	status: text('status', {
		enum: ['active', 'withdrawn']
	})
		.notNull()
		.default('active'),

	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});
```

## 5.4 `team_players`

```ts
export const teamPlayers = sqliteTable('team_players', {
	id: text('id').primaryKey(),

	teamId: text('team_id')
		.notNull()
		.references(() => teams.id, { onDelete: 'cascade' }),

	name: text('name').notNull(),

	gender: text('gender', {
		enum: ['male', 'female', 'unknown']
	})
		.notNull()
		.default('unknown'),

	displayOrder: integer('display_order').notNull().default(0),

	status: text('status', {
		enum: ['active', 'inactive']
	})
		.notNull()
		.default('active'),

	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});
```

## 5.5 `ties`

団体戦カードを表す。

```ts
export const ties = sqliteTable('ties', {
	id: text('id').primaryKey(),

	tieCode: text('tie_code').notNull().unique(),

	phase: text('phase', {
		enum: [
			'group_a',
			'group_b',
			'semifinal',
			'final',
			'third_place',
			'fifth_place',
			'ranking_tiebreaker'
		]
	}).notNull(),

	groupCode: text('group_code', {
		enum: ['A', 'B']
	}),

	roundLabel: text('round_label'),

	teamAId: text('team_a_id').references(() => teams.id, { onDelete: 'set null' }),
	teamBId: text('team_b_id').references(() => teams.id, { onDelete: 'set null' }),

	status: text('status', {
		enum: [
			'scheduled',
			'lineup_pending',
			'lineup_submitted',
			'ready',
			'playing',
			'finished',
			'confirmed',
			'cancelled'
		]
	})
		.notNull()
		.default('scheduled'),

	teamScoreA: integer('team_score_a').notNull().default(0),
	teamScoreB: integer('team_score_b').notNull().default(0),

	winnerTeamId: text('winner_team_id').references(() => teams.id, {
		onDelete: 'set null'
	}),

	displayOrder: integer('display_order').notNull().default(0),

	scheduledStartAt: text('scheduled_start_at'),
	actualStartAt: text('actual_start_at'),
	actualEndAt: text('actual_end_at'),

	venue: text('venue', {
		enum: ['first_gym', 'second_gym']
	}),

	courtBlockCode: text('court_block_code'),

	lineupDueAt: text('lineup_due_at'),

	lineupDuePolicy: text('lineup_due_policy', {
		enum: ['first_match_before_opening', 'ten_minutes_before', 'manual']
	})
		.notNull()
		.default('ten_minutes_before'),

	lineupsRevealedAt: text('lineups_revealed_at'),

	operationNote: text('operation_note'),

	scheduleChanged: integer('schedule_changed', { mode: 'boolean' }).notNull().default(false),

	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});
```

要件:

- `tieCode` は `A-1`, `B-1`, `x-1` などの運営上の試合番号を表す。
- ただし具体的な `A-1` などはseedしない。
- 管理者が作成・編集できるようにする。
- `lineupDueAt` はオーダー提出期限。
- 原則として `scheduledStartAt - defaultLineupDueMinutesBefore` を自動設定する。
- 初戦や特殊ケースは手動設定できる。
- `venue`, `courtBlockCode` は予定上の体育館・コートブロック。
- 当日変更があれば `scheduleChanged = true` にする。

## 5.6 `rubbers`

```ts
export const rubbers = sqliteTable('rubbers', {
	id: text('id').primaryKey(),

	tieId: text('tie_id')
		.notNull()
		.references(() => ties.id, { onDelete: 'cascade' }),

	code: text('code', {
		enum: ['WD1', 'XD1', 'MD3', 'MD2', 'MD1']
	}).notNull(),

	discipline: text('discipline', {
		enum: ['WD', 'XD', 'MD']
	}).notNull(),

	displayOrder: integer('display_order').notNull(),

	scoringRuleId: text('scoring_rule_id')
		.notNull()
		.references(() => scoringRules.id),

	matchId: text('match_id').references(() => matches.id, {
		onDelete: 'set null'
	}),

	status: text('status', {
		enum: [
			'not_ready',
			'ready',
			'scheduled',
			'playing',
			'finished',
			'confirmed',
			'skipped',
			'cancelled'
		]
	})
		.notNull()
		.default('not_ready'),

	winnerSide: text('winner_side', {
		enum: ['A', 'B']
	}),

	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});
```

要件:

- tie作成時に必ず5rubberを自動作成する。
- 順序は `WD1 → XD1 → MD3 → MD2 → MD1`。
- 表示・オーダー入力・match作成もこの順序に従う。

## 5.7 `lineup_submissions`

```ts
export const lineupSubmissions = sqliteTable(
	'lineup_submissions',
	{
		id: text('id').primaryKey(),

		tieId: text('tie_id')
			.notNull()
			.references(() => ties.id, { onDelete: 'cascade' }),

		teamId: text('team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),

		side: text('side', {
			enum: ['A', 'B']
		}).notNull(),

		status: text('status', {
			enum: ['draft', 'submitted', 'locked', 'revealed']
		})
			.notNull()
			.default('draft'),

		submittedAt: text('submitted_at'),
		lockedAt: text('locked_at'),
		revealedAt: text('revealed_at'),

		createdAt: text('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => ({
		tieTeamUnique: uniqueIndex('lineup_submissions_tie_team_unique').on(table.tieId, table.teamId),
		tieSideUnique: uniqueIndex('lineup_submissions_tie_side_unique').on(table.tieId, table.side)
	})
);
```

## 5.8 `lineup_items`

```ts
export const lineupItems = sqliteTable(
	'lineup_items',
	{
		id: text('id').primaryKey(),

		submissionId: text('submission_id')
			.notNull()
			.references(() => lineupSubmissions.id, { onDelete: 'cascade' }),

		rubberCode: text('rubber_code', {
			enum: ['WD1', 'XD1', 'MD3', 'MD2', 'MD1']
		}).notNull(),

		player1Id: text('player1_id')
			.notNull()
			.references(() => teamPlayers.id, { onDelete: 'cascade' }),

		player2Id: text('player2_id')
			.notNull()
			.references(() => teamPlayers.id, { onDelete: 'cascade' }),

		createdAt: text('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => ({
		submissionRubberUnique: uniqueIndex('lineup_items_submission_rubber_unique').on(
			table.submissionId,
			table.rubberCode
		)
	})
);
```

要件:

- 同一rubber内で `player1Id === player2Id` は禁止する。
- 異なるrubber間の重複出場はMVPでは許可する。
- ただし警告表示する。

## 5.9 `officiating_assignments`

審判割り振り。

```ts
export const officiatingAssignments = sqliteTable('officiating_assignments', {
	id: text('id').primaryKey(),

	tieId: text('tie_id')
		.notNull()
		.references(() => ties.id, { onDelete: 'cascade' }),

	assignedTeamId: text('assigned_team_id').references(() => teams.id, { onDelete: 'set null' }),

	role: text('role', {
		enum: ['umpire_team', 'chief_umpire', 'line_judge']
	})
		.notNull()
		.default('umpire_team'),

	status: text('status', {
		enum: ['scheduled', 'confirmed', 'changed', 'cancelled']
	})
		.notNull()
		.default('scheduled'),

	note: text('note'),

	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});
```

要件:

- tieごとに審判担当団体を登録できる。
- 当日変更を許容する。
- 人員不足時のメモを残せる。
- MVPではrubber単位ではなくtie単位の割り振りでよい。
- 必要になればrubberIdをnullableで追加してrubber単位審判にも拡張する。

## 5.10 `group_standing_overrides`

```ts
export const groupStandingOverrides = sqliteTable(
	'group_standing_overrides',
	{
		id: text('id').primaryKey(),

		groupCode: text('group_code', {
			enum: ['A', 'B']
		}).notNull(),

		teamId: text('team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),

		manualRank: integer('manual_rank').notNull(),

		reason: text('reason'),

		createdAt: text('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => ({
		groupTeamUnique: uniqueIndex('group_standing_overrides_group_team_unique').on(
			table.groupCode,
			table.teamId
		),
		groupRankUnique: uniqueIndex('group_standing_overrides_group_rank_unique').on(
			table.groupCode,
			table.manualRank
		)
	})
);
```

## 5.11 `ranking_tiebreakers`

順位決定再試合。

```ts
export const rankingTiebreakers = sqliteTable('ranking_tiebreakers', {
	id: text('id').primaryKey(),

	groupCode: text('group_code', {
		enum: ['A', 'B']
	}).notNull(),

	reason: text('reason').notNull(),

	teamAId: text('team_a_id')
		.notNull()
		.references(() => teams.id, { onDelete: 'cascade' }),

	teamBId: text('team_b_id')
		.notNull()
		.references(() => teams.id, { onDelete: 'cascade' }),

	matchId: text('match_id').references(() => matches.id, {
		onDelete: 'set null'
	}),

	winnerTeamId: text('winner_team_id').references(() => teams.id, {
		onDelete: 'set null'
	}),

	status: text('status', {
		enum: ['scheduled', 'playing', 'finished', 'confirmed', 'cancelled']
	})
		.notNull()
		.default('scheduled'),

	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});
```

要件:

- 通常順位計算で確定しない場合に作成する。
- 21点1ゲームマッチで順位を決める。
- MVPでは団体戦tieではなく、1つのmatchとして作る。
- `matches.scoringRuleId` には `TIEBREAKER_21_SINGLE_GAME` を設定する。

## 6. 既存 `matches` への追加

既存 `matches` に以下を追加する。

```ts
rubberId: text('rubber_id').references(() => rubbers.id, { onDelete: 'set null' }),
rankingTiebreakerId: text('ranking_tiebreaker_id').references(() => rankingTiebreakers.id, { onDelete: 'set null' }),
scoringRuleId: text('scoring_rule_id').references(() => scoringRules.id)
```

要件:

- rubber由来のmatchでは `rubberId` を持つ。
- 順位決定再試合由来のmatchでは `rankingTiebreakerId` を持つ。
- `rubberId` と `rankingTiebreakerId` は同時に両方入らない想定。
- `scoringRuleId` から `ScoringConfig` を解決する。

## 7. サービス層

`src/lib/server/services/tokyoLeagueSetupService.ts`

```ts
ensureDefaultScoringRules(): Promise<void>
ensureDefaultSettings(): Promise<void>
```

要件:

- `GROUP_15`
- `KNOCKOUT_21`
- `TIEBREAKER_21_SINGLE_GAME`
- `app_settings.default`

を存在確認し、なければ作る。

チームやtieのseedはしない。

---

`src/lib/server/services/tieService.ts`

```ts
createTieWithRubbers(params: {
  tieCode: string;
  phase: TiePhase;
  groupCode?: 'A' | 'B' | null;
  roundLabel?: string | null;
  teamAId?: string | null;
  teamBId?: string | null;
  scheduledStartAt?: string | null;
  venue?: VenueCode | null;
  courtBlockCode?: string | null;
  scoringRuleId: string;
  displayOrder?: number;
  lineupDueAt?: string | null;
  lineupDuePolicy?: 'first_match_before_opening' | 'ten_minutes_before' | 'manual';
}): Promise<string>
```

要件:

- `ties` を1件作成。
- `RUBBER_DEFINITIONS` に従ってrubbersを5件作成。
- 初期statusは `lineup_pending`。
- `tieCode` は必須。
- `tieCode` の重複は拒否。
- `scheduledStartAt` があり `lineupDueAt` が指定されない場合、原則10分前を自動設定。
- 初戦等では `lineupDuePolicy = first_match_before_opening` とし、`lineupDueAt` は手動設定可能にする。

```ts
generateGroupRoundRobinTies(params: {
  groupCode: 'A' | 'B';
  scoringRuleId: string;
  tieCodePrefix: 'A' | 'B';
}): Promise<void>
```

要件:

- 対象groupのactive teamsを取得。
- 全組み合わせのtieを作る。
- teamA/teamBが逆でも重複とみなす。
- `tieCode` は `A-1`, `A-2`, ... または `B-1`, `B-2`, ... を自動採番してよい。
- ただし、前回大会の具体的な番号割当はseedしない。
- 管理者がtieCodeや予定を後で編集できるようにする。

---

`src/lib/server/services/lineupService.ts`

```ts
saveLineupDraft(params: {
  tieId: string;
  teamId: string;
  items: {
    rubberCode: RubberCode;
    player1Id: string;
    player2Id: string;
  }[];
}): Promise<void>

validateLineup(params: {
  tieId: string;
  teamId: string;
  items: {
    rubberCode: RubberCode;
    player1Id: string;
    player2Id: string;
  }[];
}): Promise<{
  errors: string[];
  warnings: string[];
}>

submitLineup(params: {
  tieId: string;
  teamId: string;
}): Promise<void>

lockLineup(params: {
  tieId: string;
  teamId: string;
}): Promise<void>

revealLineups(tieId: string): Promise<void>
```

要件:

- 5rubber分が揃っていない場合はエラー。
- 同一rubber内で同一選手ならエラー。
- チーム外選手ならエラー。
- MDに女性が含まれる場合はwarning。
- WDに男性が含まれる場合はwarning。
- XDが男女ペアでない場合はwarning。
- 同一選手が複数rubberに出ている場合はwarning。
- warningがあっても保存・提出はできる。
- `locked` / `revealed` 状態は編集不可。

---

`src/lib/server/services/tieOperationService.ts`

```ts
startTie(tieId: string, options?: {
  force?: boolean;
}): Promise<void>

createMatchFromRubber(rubberId: string): Promise<string>

syncRubberResultFromMatch(matchId: string): Promise<void>

recalculateTieResult(tieId: string): Promise<void>

confirmTie(tieId: string): Promise<void>
```

要件:

### startTie

- 原則として両チームのlineupがsubmitted/locked/revealedのいずれかであること。
- `force = true` の場合は強制開始可能。
- `app_settings.lineupRevealPolicy = on_tie_start` の場合、`revealLineups` を呼ぶ。
- tie.statusを `playing` にする。
- actualStartAtをセットする。
- rubbers.statusを `ready` にする。

### createMatchFromRubber

- rubber.matchIdが既にある場合は既存matchIdを返す。
- tieのlineupsがrevealedであること。
- rubber codeに対応するA/Bのlineup itemを取得。
- 既存のライブスコア用 `matches` を作成。
- `matches.rubberId = rubber.id`
- `matches.scoringRuleId = rubber.scoringRuleId`
- `matches.discipline = rubber.discipline`
- `match_sides` をA/Bで作成。
- `match_side_players` をA/B各2名作成。
- `match_snapshots` を作成。
- `match_service_states` を作成。
- rubber.matchIdに作成matchIdを保存。
- rubber.status = scheduled

### syncRubberResultFromMatch

- match.statusがfinishedならrubber.status = finished
- match.statusがconfirmedならrubber.status = confirmed
- match.winnerSideをrubber.winnerSideに反映
- recalculateTieResultを呼ぶ

### recalculateTieResult

- rubber.winnerSideを集計。
- A勝利rubber数をteamScoreAに保存。
- B勝利rubber数をteamScoreBに保存。
- 3勝到達でwinnerTeamIdを設定。
- ただし3勝到達だけではtie.statusをfinishedにしない。
- 5rubberすべてfinished/confirmedならtie.status = finished。
- confirmTieでtie.status = confirmed。

---

`src/lib/server/services/standingService.ts`

```ts
calculateGroupStandings(groupCode: 'A' | 'B'): Promise<GroupStanding[]>
```

型:

```ts
interface GroupStanding {
	teamId: string;
	teamName: string;
	rank: number | null;

	teamMatchesWon: number;
	teamMatchesLost: number;

	rubbersWon: number;
	rubbersLost: number;

	gamesWon: number;
	gamesLost: number;

	headToHeadSummary?: string | null;

	tiedTeamsRubbersWon?: number | null;
	tiedTeamsGamesWon?: number | null;

	requiresTiebreaker: boolean;
	manualRank?: number | null;
}
```

順位決定順:

```txt
1. manualRank
2. チームとしての勝利数
3. 直接対決結果
4. 個々の試合の勝利数
5. 同率チーム間での個々の試合の勝利数
6. 獲得ゲーム数
7. 同率チーム間での獲得ゲーム数
8. 再試合
```

実装方針:

- まず手動順位があればそれを優先する。
- 手動順位がない場合、大会規則順で計算する。
- 2チーム同率なら直接対決を判定する。
- 3チーム以上同率の場合、同率チーム間成績を計算する。
- それでも決まらない場合、`requiresTiebreaker = true` にする。
- `requiresTiebreaker = true` のチームについて、管理者がranking_tiebreakerを作れるようにする。

---

`src/lib/server/services/finalsService.ts`

```ts
generateSemifinalsAndFifthPlace(): Promise<void>

generateFinalAndThirdPlace(): Promise<void>
```

### generateSemifinalsAndFifthPlace

要件:

- A/Bリーグ順位表を取得。
- A1, A2, A3, B1, B2, B3 を決定。
- 以下を作成または更新する。

```txt
x-1: A1 vs B2, 準決勝1
x-2: A2 vs B1, 準決勝2
x-3: A3 vs B3, 5位決定戦
```

- `phase = semifinal` または `fifth_place`
- scoringRuleは `KNOCKOUT_21`
- 既にx-1, x-2, x-3が存在する場合はteamA/teamBを更新する。
- rubbersがなければ5rubber作成。

### generateFinalAndThirdPlace

要件:

- x-1, x-2がfinishedまたはconfirmedであること。
- x-1勝者・敗者、x-2勝者・敗者を取得。
- 以下を作成または更新する。

```txt
x-4: x-1敗者 vs x-2敗者, 3位決定戦
x-5: x-1勝者 vs x-2勝者, 決勝
```

- scoringRuleは `KNOCKOUT_21`
- 決勝と3位決定戦は同時進行できる。

---

`src/lib/server/services/officiatingService.ts`

```ts
assignOfficiatingTeam(params: {
  tieId: string;
  assignedTeamId: string | null;
  role?: 'umpire_team' | 'chief_umpire' | 'line_judge';
  note?: string | null;
}): Promise<void>

listOfficiatingAssignments(): Promise<OfficiatingAssignmentSummary[]>
```

要件:

- tieごとに審判担当団体を登録できる。
- 変更時はstatusを `changed` にできる。
- 人員不足や当日変更のメモを残せる。

## 8. 画面構成

## 8.1 ナビゲーション

サイドバー:

```txt
ホーム
チーム
予選リーグ
決勝トーナメント
団体戦カード
オーダー管理
審判割り振り
コート・進行表
ライブ表示
設定
```

## 8.2 ホーム `/`

表示:

- Aリーグ進行状況
- Bリーグ進行状況
- 決勝トーナメント進行状況
- オーダー未提出tie
- オーダー提出期限超過tie
- 進行中tie
- 結果確認待ちtie
- 中断中match
- 審判未割当tie
- スケジュール変更ありtie

## 8.3 チーム `/teams`, `/teams/[teamId]`

機能:

- チーム作成
- チーム編集
- A/Bリーグ割当
- 選手登録
- 性別登録
- 表示順変更

## 8.4 予選リーグ `/groups`, `/groups/A`, `/groups/B`

表示:

- 所属チーム
- 総当たりtie一覧
- tieCode
- 予定時刻
- 体育館・コートブロック
- 審判担当団体
- 順位表
- 順位未確定警告
- 再試合作成ボタン
- manual rank override

操作:

- 総当たりtie生成
- tieCode編集
- 予定時刻編集
- コートブロック編集
- 審判割り振り編集
- 決勝トーナメント生成

## 8.5 決勝トーナメント `/finals`

表示:

```txt
x-1 準決勝1
x-2 準決勝2
x-3 5位決定戦
x-4 3位決定戦
x-5 決勝
```

操作:

- 予選順位からx-1/x-2/x-3生成
- 準決勝結果からx-4/x-5生成
- 各tie詳細へ遷移
- 予定時刻・コートブロック編集
- 審判割り振り編集

## 8.6 団体戦カード `/ties`, `/ties/[tieId]`

一覧フィルター:

```txt
すべて
Aリーグ
Bリーグ
準決勝
決勝
3位決定戦
5位決定戦
オーダー未提出
期限超過
進行中
結果確認待ち
スケジュール変更あり
```

tie詳細表示:

- tieCode
- phase
- teamA/teamB
- status
- teamScore
- scheduledStartAt
- lineupDueAt
- venue
- courtBlock
- officiating assignment
- lineupsRevealedAt
- operationNote
- rubber table

rubber table columns:

```txt
順序
コード
種目
A側選手
B側選手
得点ルール
状態
スコア
勝者
操作
```

操作:

- オーダー入力
- オーダー公開
- tie開始
- rubberからmatch作成
- 審判画面へ
- 結果同期
- tie確定
- スケジュール変更
- 審判割り振り変更

## 8.7 オーダー入力 `/ties/[tieId]/lineups`

rubber順は必ず以下。

```txt
WD1
XD1
MD3
MD2
MD1
```

管理者用MVPでは、A/B両チームを同時編集できる。

表示:

```txt
WD1  [A player 1] [A player 2]    [B player 1] [B player 2]
XD1  [A player 1] [A player 2]    [B player 1] [B player 2]
MD3  [A player 1] [A player 2]    [B player 1] [B player 2]
MD2  [A player 1] [A player 2]    [B player 1] [B player 2]
MD1  [A player 1] [A player 2]    [B player 1] [B player 2]
```

表示する警告:

- 未入力
- 同一rubber内同一選手
- WDに男性が含まれる
- XDが男女ペアでない
- MDに女性が含まれる
- 同一選手が複数rubberに出ている
- 提出期限超過

ボタン:

```txt
下書き保存
提出
ロック
公開
tie開始
```

## 8.8 審判割り振り `/officiating`

表示:

```txt
tieCode
対戦カード
予定時刻
会場
コートブロック
担当団体
状態
メモ
```

操作:

- 担当団体設定
- 変更
- メモ追加
- 未割当フィルター

## 8.9 コート・進行表 `/schedule`

表示:

- 時刻別
- 体育館別
- コートブロック別
- tieCode
- 対戦カード
- status
- 審判担当
- オーダー提出状態

操作:

- 予定時刻変更
- 会場変更
- コートブロック変更
- スケジュール変更フラグ
- operationNote編集

## 8.10 公開ライブ `/live`

表示:

- 進行中tie
- Aリーグ順位表
- Bリーグ順位表
- 決勝トーナメント
- 5位決定戦
- コート別表示
- tie詳細

注意:

- `ties.lineupsRevealedAt === null` の場合、選手名を表示しない。
- revealed前は `オーダー未公開` と表示する。
- revealed後はWD/XD/MD3/MD2/MD1の選手名を表示する。

## 9. 実装順序

## Phase 0: 既存機能確認

確認項目:

1. 既存の1試合ライブスコアが動く。
2. ダブルスのサーブ順管理が動く。
3. `createInitialMatchState` がscoring configを受け取れる。
4. match終了時にwinnerSideが正しく入る。

## Phase 1: スキーマ追加

追加:

```txt
app_settings
scoring_rules
teams
team_players
ties
rubbers
lineup_submissions
lineup_items
officiating_assignments
group_standing_overrides
ranking_tiebreakers
```

既存matchesに追加:

```txt
rubberId
rankingTiebreakerId
scoringRuleId
```

migrationを生成し、local D1に適用する。

## Phase 2: 初期設定

実装:

```txt
ensureDefaultScoringRules
ensureDefaultSettings
RUBBER_DEFINITIONS
COURT_BLOCKS
FINAL_TIE_DEFINITIONS
```

注意:

- チーム名、予選tie、審判割り振り、時刻表はseedしない。

## Phase 3: チーム管理

実装:

```txt
/teams
/teams/[teamId]
```

機能:

- チームCRUD
- 選手CRUD
- A/Bリーグ割当

## Phase 4: tie作成・予選生成

実装:

```txt
createTieWithRubbers
generateGroupRoundRobinTies
/groups
/groups/A
/groups/B
```

要件:

- tie作成で5rubber自動生成。
- rubber順はWD1/XD1/MD3/MD2/MD1。
- tieCodeを自動採番できる。
- 管理者がtieCodeを編集できる。
- 予定時刻・会場・コートブロック・オーダー期限を編集できる。

## Phase 5: オーダー

実装:

```txt
/ties/[tieId]/lineups
saveLineupDraft
validateLineup
submitLineup
lockLineup
revealLineups
startTie
```

## Phase 6: rubberからmatch作成

実装:

```txt
createMatchFromRubber
syncRubberResultFromMatch
recalculateTieResult
```

既存審判入力画面と接続する。

## Phase 7: 順位表

実装:

```txt
calculateGroupStandings
groupStandingOverrides
rankingTiebreakers
```

大会規則の順位決定順に従う。

## Phase 8: 決勝生成

実装:

```txt
generateSemifinalsAndFifthPlace
generateFinalAndThirdPlace
/finals
```

## Phase 9: 審判割り振り・進行表

実装:

```txt
/officiating
/schedule
assignOfficiatingTeam
schedule editing
operation notes
```

## Phase 10: 公開ライブ

実装:

```txt
/live
```

要件:

- revealed前はオーダー非表示。
- revealed後に選手名表示。
- 予選順位表、決勝表、進行中tieを表示。

## 10. テスト要件

## 10.1 rubber定義

- RUBBER_DEFINITIONSが5件。
- 順序がWD1, XD1, MD3, MD2, MD1。
- disciplineがWD, XD, MD, MD, MD。

## 10.2 tie作成

- tie作成で5rubberが作成される。
- rubber displayOrderが正しい。
- rubber scoringRuleIdが正しい。
- tieCode重複を拒否する。

## 10.3 総当たり生成

- Aリーグ3チームなら3tie。
- Aリーグ4チームなら6tie。
- Bリーグでも同様。
- teamA/teamB逆順も重複とみなす。

## 10.4 lineup

- 5rubber分保存できる。
- 同一rubber内同一選手を拒否。
- チーム外選手を拒否。
- submitted後は編集不可。
- revealed後は編集不可。
- 性別不整合はwarning。
- 複数rubber出場はwarning。
- 提出期限超過を検出できる。

## 10.5 reveal

- revealLineupsで両submissionがrevealedになる。
- ties.lineupsRevealedAtが入る。
- revealed前は公開クエリが選手名を返さない。
- revealed後は公開クエリが選手名を返す。

## 10.6 startTie

- 両チームsubmittedなら開始できる。
- policyがon_tie_startなら自動revealされる。
- rubbersがreadyになる。
- 片方未提出なら通常開始は拒否。
- force=trueなら開始可能。

## 10.7 rubber to match

- lineupからmatchが作成される。
- match_sidesがA/Bで作られる。
- match_side_playersがA/B各2名作られる。
- rubber.matchIdが入る。
- 既にmatchIdがあれば重複作成しない。

## 10.8 tie結果

- rubber A勝利3件でteamAがwinner。
- rubber B勝利3件でteamBがwinner。
- 2-2ではwinnerTeamIdはnull。
- 5rubber終了でtie.statusがfinished。
- 3勝到達だけではstatusをfinishedにしない。

## 10.9 予選順位

順位決定順をテストする。

```txt
1. チームとしての勝利数
2. 直接対決結果
3. 個々の試合の勝利数
4. 同率チーム間での個々の試合の勝利数
5. 獲得ゲーム数
6. 同率チーム間での獲得ゲーム数
7. 再試合必要フラグ
8. manualRank
```

## 10.10 再試合

- 順位未確定の場合、ranking_tiebreakerを作れる。
- ranking_tiebreakerから21点1ゲームmatchを作れる。
- winnerTeamIdが順位表に反映される。

## 10.11 決勝生成

- A1 vs B2でx-1。
- A2 vs B1でx-2。
- A3 vs B3でx-3。
- x-1勝者 vs x-2勝者でx-5。
- x-1敗者 vs x-2敗者でx-4。

## 10.12 審判割り振り

- tieに担当団体を設定できる。
- 未割当tieを検出できる。
- 変更時にstatus changedにできる。

## 11. 禁止事項

- チーム名や前回大会の試合番号をseedしない。
- 前回大会のタイムテーブルをseedしない。
- 前回大会の審判割り振りをseedしない。
- ただし、それらを入力・編集できるUIは作る。
- rubber順をMD1から始めない。
- 実施順は必ずWD1, XD1, MD3, MD2, MD1。
- 順位決定にpointDiffを大会規則より優先して使わない。
- 再試合が必要なケースをmanualRankだけで握りつぶさない。
- オーダー公開前に公開画面へ選手名を出さない。
- オーダー公開前に相手チームへ選手名を出さない。
- score_eventsを削除・上書きしない。
- match結果とrubber結果を不整合にしない。

## 12. 次の一手

最初の実装単位は以下に限定する。

### Task 1: スキーマ追加

対象:

```txt
app_settings
scoring_rules
teams
team_players
ties
rubbers
lineup_submissions
lineup_items
officiating_assignments
group_standing_overrides
ranking_tiebreakers
matches.rubberId
matches.rankingTiebreakerId
matches.scoringRuleId
```

成果物:

```txt
schema.ts更新
migration生成
local D1 migration成功
型エラーなし
```

### Task 2: 固定定数・初期設定

対象:

```txt
src/lib/domain/tokyoLeague.ts
src/lib/server/services/tokyoLeagueSetupService.ts
```

実装:

```txt
RUBBER_DEFINITIONS
COURT_BLOCKS
FINAL_TIE_DEFINITIONS
ensureDefaultScoringRules
ensureDefaultSettings
```

注意:

```txt
チーム・tie・スケジュール・審判割り振りのseedはしない
```

### Task 3: チーム管理

対象:

```txt
/teams
/teams/[teamId]
```

実装:

```txt
チームCRUD
選手CRUD
A/Bリーグ割当
```

### Task 4: tie作成・rubber自動生成

対象:

```txt
createTieWithRubbers
generateGroupRoundRobinTies
/groups
/groups/A
/groups/B
```

実装:

```txt
tieCode対応
scheduledStartAt対応
venue対応
courtBlockCode対応
lineupDueAt対応
WD1/XD1/MD3/MD2/MD1順のrubber生成
```

ここまでを最初のPRまたは最初の実装単位とする。

## 13. MVP完了条件

1. チームを作成できる。
2. チームに選手を登録できる。
3. チームをA/Bリーグに割り当てられる。
4. A/Bリーグの総当たりtieを生成できる。
5. tieCodeを管理できる。
6. tieごとにWD1/XD1/MD3/MD2/MD1が自動生成される。
7. 予定時刻・体育館・コートブロックを設定できる。
8. オーダー提出期限を設定・確認できる。
9. 審判担当団体を割り振れる。
10. tieごとに両チームのオーダーを入力できる。
11. オーダーは試合開始前に非公開である。
12. tie開始時にオーダーが公開される。
13. rubberから既存ライブスコアmatchを生成できる。
14. 審判入力画面でスコアを進められる。
15. match終了結果がrubberに反映される。
16. rubber結果がtieスコアに反映される。
17. 大会規則順で予選リーグ順位表が表示される。
18. 順位未確定時に21点1ゲーム再試合を作れる。
19. A1/B2, A2/B1の準決勝を生成できる。
20. A3/B3の5位決定戦を生成できる。
21. 準決勝結果から決勝と3位決定戦を生成できる。
22. 公開ライブ画面で予選・決勝・順位表を確認できる。
23. revealed前のオーダーは公開ライブに表示されない。
