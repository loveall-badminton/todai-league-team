export * from './auth.schema';

import { relations, sql } from 'drizzle-orm';
import { user } from './auth.schema';
import {
	type AnySQLiteColumn,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
	index,
	unique
} from 'drizzle-orm/sqlite-core';
import { TIE_STATUSES } from '$lib/domain/tieProgress';

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

	// 大会実施日 (YYYY-MM-DD)。対戦の開始時刻・オーダー期限は HH:mm 文字列で保存されており、
	// この日付と組み合わせて実際の日時として解釈する。未設定の場合は当日として扱う。
	tournamentDate: text('tournament_date'),

	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

export const rateLimits = sqliteTable(
	'rate_limits',
	{
		key: text('key').notNull(),
		windowStart: integer('window_start_seconds').notNull(),
		count: integer('count').notNull().default(0),
		createdAt: text('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [unique('rate_limits_key_window_unique').on(table.key, table.windowStart)]
);

export const teams = sqliteTable(
	'teams',
	{
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
	},
	(table) => [index('teams_group_status_idx').on(table.groupCode, table.status)]
);

export const authUserProfiles = sqliteTable(
	'auth_user_profiles',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),

		accountType: text('account_type', {
			enum: ['admin', 'participant', 'team']
		})
			.notNull()
			.default('participant'),

		teamId: text('team_id').references(() => teams.id, { onDelete: 'set null' }),

		displayName: text('display_name'),

		createdAt: text('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		index('auth_user_profiles_account_type_idx').on(table.accountType),
		index('auth_user_profiles_team_id_idx').on(table.teamId)
	]
);

export const teamPlayers = sqliteTable(
	'team_players',
	{
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
	},
	(table) => [index('team_players_team_id_idx').on(table.teamId)]
);

export const ties = sqliteTable(
	'ties',
	{
		id: text('id').primaryKey(),

		tieCode: text('tie_code').notNull(),

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

		status: text('status', { enum: TIE_STATUSES }).notNull().default('scheduled'),

		teamScoreA: integer('team_score_a').notNull().default(0),
		teamScoreB: integer('team_score_b').notNull().default(0),

		winnerTeamId: text('winner_team_id').references(() => teams.id, { onDelete: 'set null' }),

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
	},
	(table) => [
		uniqueIndex('ties_tie_code_unique').on(table.tieCode),
		index('ties_group_code_idx').on(table.groupCode),
		index('ties_team_a_idx').on(table.teamAId),
		index('ties_team_b_idx').on(table.teamBId),
		index('ties_phase_idx').on(table.phase),
		index('ties_status_idx').on(table.status)
	]
);

export const tournaments = sqliteTable(
	'tournaments',
	{
		id: text('id').primaryKey(),

		name: text('name').notNull(),
		venue: text('venue'),

		startsAt: text('starts_at'),
		endsAt: text('ends_at'),

		status: text('status', {
			enum: ['draft', 'published', 'running', 'finished', 'archived', 'cancelled']
		})
			.notNull()
			.default('draft'),

		publicSlug: text('public_slug'),

		createdAt: text('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),

		updatedAt: text('updated_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [uniqueIndex('tournaments_public_slug_unique').on(table.publicSlug)]
);

export const courts = sqliteTable(
	'courts',
	{
		id: text('id').primaryKey(),

		tournamentId: text('tournament_id')
			.notNull()
			.references(() => tournaments.id, { onDelete: 'cascade' }),

		name: text('name').notNull(),

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
	},
	(table) => [
		index('courts_tournament_id_idx').on(table.tournamentId),
		uniqueIndex('courts_tournament_name_unique').on(table.tournamentId, table.name)
	]
);

export const matches = sqliteTable(
	'matches',
	{
		id: text('id').primaryKey(),

		tournamentId: text('tournament_id')
			.notNull()
			.references(() => tournaments.id, { onDelete: 'cascade' }),

		courtId: text('court_id').references(() => courts.id, { onDelete: 'set null' }),

		discipline: text('discipline', {
			enum: ['MS', 'WS', 'MD', 'WD', 'XD']
		})
			.notNull()
			.default('MS'),

		matchNo: integer('match_no'),
		displayOrder: integer('display_order').notNull().default(0),

		eventName: text('event_name'),
		category: text('category'),
		roundName: text('round_name'),

		scoringMode: text('scoring_mode', {
			enum: ['best_of_3_21', 'one_game_21', 'best_of_3_15', 'custom']
		})
			.notNull()
			.default('best_of_3_21'),

		rubberId: text('rubber_id').references((): AnySQLiteColumn => rubbers.id, {
			onDelete: 'set null'
		}),
		rankingTiebreakerId: text('ranking_tiebreaker_id').references(
			(): AnySQLiteColumn => rankingTiebreakers.id,
			{
				onDelete: 'set null'
			}
		),
		scoringRuleId: text('scoring_rule_id').references(() => scoringRules.id),

		status: text('status', {
			enum: [
				'scheduled',
				'called',
				'warmup',
				'playing',
				'interval',
				'suspended',
				'forfeited',
				'retired',
				'finished',
				'confirmed',
				'cancelled'
			]
		})
			.notNull()
			.default('scheduled'),

		currentGameNo: integer('current_game_no').notNull().default(1),

		currentScoreA: integer('current_score_a').notNull().default(0),
		currentScoreB: integer('current_score_b').notNull().default(0),

		gamesWonA: integer('games_won_a').notNull().default(0),
		gamesWonB: integer('games_won_b').notNull().default(0),

		winnerSide: text('winner_side', {
			enum: ['A', 'B']
		}),

		/**
		 * 現在サーブ状態。ライブ一覧表示用の冗長カラム。
		 */
		currentServingSide: text('current_serving_side', {
			enum: ['A', 'B']
		}),

		currentServiceCourt: text('current_service_court', {
			enum: ['right', 'left']
		}),

		currentServerPlayerId: text('current_server_player_id'),
		currentReceiverPlayerId: text('current_receiver_player_id'),

		lastSeqNo: integer('last_seq_no').notNull().default(0),

		scheduledStartAt: text('scheduled_start_at'),
		actualStartAt: text('actual_start_at'),
		actualEndAt: text('actual_end_at'),

		refereeName: text('referee_name'),
		winnerConfirmedAt: text('winner_confirmed_at'),
		winnerConfirmedBySide: text('winner_confirmed_by_side', {
			enum: ['A', 'B']
		}),

		createdAt: text('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),

		updatedAt: text('updated_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		index('matches_tournament_id_idx').on(table.tournamentId),
		index('matches_court_id_idx').on(table.courtId),
		index('matches_rubber_id_idx').on(table.rubberId),
		index('matches_ranking_tiebreaker_id_idx').on(table.rankingTiebreakerId),
		index('matches_scoring_rule_id_idx').on(table.scoringRuleId),
		index('matches_current_server_idx').on(table.currentServerPlayerId),
		index('matches_status_idx').on(table.status)
	]
);

export const matchSides = sqliteTable(
	'match_sides',
	{
		id: text('id').primaryKey(),

		matchId: text('match_id')
			.notNull()
			.references(() => matches.id, { onDelete: 'cascade' }),

		side: text('side', {
			enum: ['A', 'B']
		}).notNull(),

		displayName: text('display_name').notNull(),

		seedNo: integer('seed_no'),

		createdAt: text('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),

		updatedAt: text('updated_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		index('match_sides_match_id_idx').on(table.matchId),
		uniqueIndex('match_sides_match_side_unique').on(table.matchId, table.side)
	]
);

export const matchSidePlayers = sqliteTable(
	'match_side_players',
	{
		id: text('id').primaryKey(),

		matchId: text('match_id')
			.notNull()
			.references(() => matches.id, { onDelete: 'cascade' }),

		matchSideId: text('match_side_id')
			.notNull()
			.references(() => matchSides.id, { onDelete: 'cascade' }),

		side: text('side', {
			enum: ['A', 'B']
		}).notNull(),

		/**
		 * ダブルスでは 1 / 2。
		 * シングルスでは 1 のみ。
		 */
		playerOrder: integer('player_order').notNull(),

		name: text('name').notNull(),
		teamName: text('team_name'),

		createdAt: text('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),

		updatedAt: text('updated_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		index('match_side_players_match_id_idx').on(table.matchId),
		index('match_side_players_match_side_idx').on(table.matchId, table.side),
		uniqueIndex('match_side_players_match_side_order_unique').on(
			table.matchId,
			table.side,
			table.playerOrder
		)
	]
);

export const scoreEvents = sqliteTable(
	'score_events',
	{
		id: text('id').primaryKey(),

		matchId: text('match_id')
			.notNull()
			.references(() => matches.id, { onDelete: 'cascade' }),

		seqNo: integer('seq_no').notNull(),

		eventType: text('event_type', {
			enum: [
				'match_started',
				'game_started',
				'rally_won',
				'undo_applied',
				'correction_applied',
				'let_called',
				'match_suspended',
				'match_resumed',
				'side_forfeited',
				'side_retired',
				'match_finished',
				'match_confirmed',
				'match_unconfirmed'
			]
		}).notNull(),

		side: text('side', {
			enum: ['A', 'B']
		}),

		gameNo: integer('game_no'),

		scoreABefore: integer('score_a_before'),
		scoreBBefore: integer('score_b_before'),
		scoreAAfter: integer('score_a_after'),
		scoreBAfter: integer('score_b_after'),

		servingSideBefore: text('serving_side_before', {
			enum: ['A', 'B']
		}),
		serviceCourtBefore: text('service_court_before', {
			enum: ['right', 'left']
		}),
		serverPlayerIdBefore: text('server_player_id_before'),
		receiverPlayerIdBefore: text('receiver_player_id_before'),

		servingSideAfter: text('serving_side_after', {
			enum: ['A', 'B']
		}),
		serviceCourtAfter: text('service_court_after', {
			enum: ['right', 'left']
		}),
		serverPlayerIdAfter: text('server_player_id_after'),
		receiverPlayerIdAfter: text('receiver_player_id_after'),

		targetSeqNo: integer('target_seq_no'),

		reason: text('reason'),

		payloadJson: text('payload_json').notNull().default('{}'),

		actorName: text('actor_name'),

		idempotencyKey: text('idempotency_key').notNull(),

		createdAt: text('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		uniqueIndex('score_events_match_seq_unique').on(table.matchId, table.seqNo),
		uniqueIndex('score_events_match_idempotency_unique').on(table.matchId, table.idempotencyKey),
		index('score_events_match_seq_idx').on(table.matchId, table.seqNo),
		index('score_events_event_type_idx').on(table.eventType)
	]
);

export const matchSnapshots = sqliteTable('match_snapshots', {
	matchId: text('match_id')
		.primaryKey()
		.references(() => matches.id, { onDelete: 'cascade' }),

	seqNo: integer('seq_no').notNull(),

	stateJson: text('state_json').notNull(),

	updatedAt: text('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

export const matchServiceStates = sqliteTable('match_service_states', {
	matchId: text('match_id')
		.primaryKey()
		.references(() => matches.id, { onDelete: 'cascade' }),

	gameNo: integer('game_no').notNull(),

	servingSide: text('serving_side', {
		enum: ['A', 'B']
	}),

	serviceCourt: text('service_court', {
		enum: ['right', 'left']
	}),

	serverPlayerId: text('server_player_id'),
	receiverPlayerId: text('receiver_player_id'),

	courtAssignmentsJson: text('court_assignments_json').notNull().default('{}'),

	updatedAt: text('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

export const scoreEventUndoLinks = sqliteTable(
	'score_event_undo_links',
	{
		id: text('id').primaryKey(),

		matchId: text('match_id')
			.notNull()
			.references(() => matches.id, { onDelete: 'cascade' }),

		undoEventId: text('undo_event_id')
			.notNull()
			.references(() => scoreEvents.id, { onDelete: 'cascade' }),

		targetEventId: text('target_event_id')
			.notNull()
			.references(() => scoreEvents.id, { onDelete: 'cascade' }),

		targetSeqNo: integer('target_seq_no').notNull(),

		createdAt: text('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		uniqueIndex('score_event_undo_links_match_target_unique').on(table.matchId, table.targetSeqNo)
	]
);

export const rubbers = sqliteTable(
	'rubbers',
	{
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

		matchId: text('match_id').references((): AnySQLiteColumn => matches.id, {
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
	},
	(table) => [
		index('rubbers_tie_id_idx').on(table.tieId),
		uniqueIndex('rubbers_tie_code_unique').on(table.tieId, table.code),
		index('rubbers_match_id_idx').on(table.matchId),
		index('rubbers_status_pair_idx').on(table.status, table.matchId)
	]
);

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
	(table) => [
		uniqueIndex('lineup_submissions_tie_team_unique').on(table.tieId, table.teamId),
		uniqueIndex('lineup_submissions_tie_side_unique').on(table.tieId, table.side)
	]
);

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
	(table) => [
		uniqueIndex('lineup_items_submission_rubber_unique').on(table.submissionId, table.rubberCode)
	]
);

export const officiatingAssignments = sqliteTable(
	'officiating_assignments',
	{
		id: text('id').primaryKey(),

		tieId: text('tie_id')
			.notNull()
			.references(() => ties.id, { onDelete: 'cascade' }),

		assignedTeamId: text('assigned_team_id').references(() => teams.id, {
			onDelete: 'set null'
		}),

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
	},
	(table) => [
		index('officiating_assignments_tie_id_idx').on(table.tieId),
		index('officiating_assignments_assigned_team_id_idx').on(table.assignedTeamId)
	]
);

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
	(table) => [
		uniqueIndex('group_standing_overrides_group_team_unique').on(table.groupCode, table.teamId),
		uniqueIndex('group_standing_overrides_group_rank_unique').on(table.groupCode, table.manualRank)
	]
);

export const rankingTiebreakers = sqliteTable(
	'ranking_tiebreakers',
	{
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

		matchId: text('match_id').references((): AnySQLiteColumn => matches.id, {
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
	},
	(table) => [
		index('ranking_tiebreakers_group_code_idx').on(table.groupCode),
		index('ranking_tiebreakers_match_id_idx').on(table.matchId)
	]
);

export const tournamentsRelations = relations(tournaments, ({ many }) => ({
	courts: many(courts),
	matches: many(matches)
}));

export const courtsRelations = relations(courts, ({ one, many }) => ({
	tournament: one(tournaments, {
		fields: [courts.tournamentId],
		references: [tournaments.id]
	}),
	matches: many(matches)
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
	tournament: one(tournaments, {
		fields: [matches.tournamentId],
		references: [tournaments.id]
	}),
	court: one(courts, {
		fields: [matches.courtId],
		references: [courts.id]
	}),
	rubber: one(rubbers, {
		fields: [matches.rubberId],
		references: [rubbers.id]
	}),
	rankingTiebreaker: one(rankingTiebreakers, {
		fields: [matches.rankingTiebreakerId],
		references: [rankingTiebreakers.id]
	}),
	scoringRule: one(scoringRules, {
		fields: [matches.scoringRuleId],
		references: [scoringRules.id]
	}),
	sides: many(matchSides),
	events: many(scoreEvents),
	snapshot: one(matchSnapshots),
	serviceState: one(matchServiceStates)
}));

export const matchSidesRelations = relations(matchSides, ({ one, many }) => ({
	match: one(matches, {
		fields: [matchSides.matchId],
		references: [matches.id]
	}),
	players: many(matchSidePlayers)
}));

export const matchSidePlayersRelations = relations(matchSidePlayers, ({ one }) => ({
	match: one(matches, {
		fields: [matchSidePlayers.matchId],
		references: [matches.id]
	}),
	matchSide: one(matchSides, {
		fields: [matchSidePlayers.matchSideId],
		references: [matchSides.id]
	})
}));

export const scoreEventsRelations = relations(scoreEvents, ({ one }) => ({
	match: one(matches, {
		fields: [scoreEvents.matchId],
		references: [matches.id]
	})
}));

export const matchSnapshotsRelations = relations(matchSnapshots, ({ one }) => ({
	match: one(matches, {
		fields: [matchSnapshots.matchId],
		references: [matches.id]
	})
}));

export const matchServiceStatesRelations = relations(matchServiceStates, ({ one }) => ({
	match: one(matches, {
		fields: [matchServiceStates.matchId],
		references: [matches.id]
	})
}));

export const scoreEventUndoLinksRelations = relations(scoreEventUndoLinks, ({ one }) => ({
	match: one(matches, {
		fields: [scoreEventUndoLinks.matchId],
		references: [matches.id]
	}),
	undoEvent: one(scoreEvents, {
		fields: [scoreEventUndoLinks.undoEventId],
		references: [scoreEvents.id]
	}),
	targetEvent: one(scoreEvents, {
		fields: [scoreEventUndoLinks.targetEventId],
		references: [scoreEvents.id]
	})
}));

export const scoringRulesRelations = relations(scoringRules, ({ many }) => ({
	rubbers: many(rubbers),
	matches: many(matches)
}));

export const appSettingsRelations = relations(appSettings, ({ one }) => ({
	groupStageScoringRule: one(scoringRules, {
		fields: [appSettings.groupStageScoringRuleId],
		references: [scoringRules.id]
	}),
	knockoutScoringRule: one(scoringRules, {
		fields: [appSettings.knockoutScoringRuleId],
		references: [scoringRules.id]
	}),
	tiebreakerScoringRule: one(scoringRules, {
		fields: [appSettings.tiebreakerScoringRuleId],
		references: [scoringRules.id]
	})
}));

export const teamsRelations = relations(teams, ({ many }) => ({
	players: many(teamPlayers),
	tiesAsA: many(ties, { relationName: 'tiesTeamA' }),
	tiesAsB: many(ties, { relationName: 'tiesTeamB' }),
	lineupSubmissions: many(lineupSubmissions),
	officiatingAssignments: many(officiatingAssignments)
}));

export const teamPlayersRelations = relations(teamPlayers, ({ one, many }) => ({
	team: one(teams, {
		fields: [teamPlayers.teamId],
		references: [teams.id]
	}),
	lineupItemsAsPlayer1: many(lineupItems, { relationName: 'lineupItemPlayer1' }),
	lineupItemsAsPlayer2: many(lineupItems, { relationName: 'lineupItemPlayer2' })
}));

export const tiesRelations = relations(ties, ({ one, many }) => ({
	teamA: one(teams, {
		fields: [ties.teamAId],
		references: [teams.id],
		relationName: 'tiesTeamA'
	}),
	teamB: one(teams, {
		fields: [ties.teamBId],
		references: [teams.id],
		relationName: 'tiesTeamB'
	}),
	winnerTeam: one(teams, {
		fields: [ties.winnerTeamId],
		references: [teams.id]
	}),
	rubbers: many(rubbers),
	lineupSubmissions: many(lineupSubmissions),
	officiatingAssignments: many(officiatingAssignments)
}));

export const rubbersRelations = relations(rubbers, ({ one }) => ({
	tie: one(ties, {
		fields: [rubbers.tieId],
		references: [ties.id]
	}),
	scoringRule: one(scoringRules, {
		fields: [rubbers.scoringRuleId],
		references: [scoringRules.id]
	}),
	match: one(matches, {
		fields: [rubbers.matchId],
		references: [matches.id]
	})
}));

export const lineupSubmissionsRelations = relations(lineupSubmissions, ({ one, many }) => ({
	tie: one(ties, {
		fields: [lineupSubmissions.tieId],
		references: [ties.id]
	}),
	team: one(teams, {
		fields: [lineupSubmissions.teamId],
		references: [teams.id]
	}),
	items: many(lineupItems)
}));

export const lineupItemsRelations = relations(lineupItems, ({ one }) => ({
	submission: one(lineupSubmissions, {
		fields: [lineupItems.submissionId],
		references: [lineupSubmissions.id]
	}),
	player1: one(teamPlayers, {
		fields: [lineupItems.player1Id],
		references: [teamPlayers.id],
		relationName: 'lineupItemPlayer1'
	}),
	player2: one(teamPlayers, {
		fields: [lineupItems.player2Id],
		references: [teamPlayers.id],
		relationName: 'lineupItemPlayer2'
	})
}));

export const officiatingAssignmentsRelations = relations(officiatingAssignments, ({ one }) => ({
	tie: one(ties, {
		fields: [officiatingAssignments.tieId],
		references: [ties.id]
	}),
	assignedTeam: one(teams, {
		fields: [officiatingAssignments.assignedTeamId],
		references: [teams.id]
	})
}));

export const groupStandingOverridesRelations = relations(groupStandingOverrides, ({ one }) => ({
	team: one(teams, {
		fields: [groupStandingOverrides.teamId],
		references: [teams.id]
	})
}));

export const rankingTiebreakersRelations = relations(rankingTiebreakers, ({ one }) => ({
	teamA: one(teams, {
		fields: [rankingTiebreakers.teamAId],
		references: [teams.id]
	}),
	teamB: one(teams, {
		fields: [rankingTiebreakers.teamBId],
		references: [teams.id]
	}),
	match: one(matches, {
		fields: [rankingTiebreakers.matchId],
		references: [matches.id]
	}),
	winnerTeam: one(teams, {
		fields: [rankingTiebreakers.winnerTeamId],
		references: [teams.id]
	})
}));
