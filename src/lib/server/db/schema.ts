export * from './auth.schema';

import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

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
	(table) => ({
		publicSlugUnique: uniqueIndex('tournaments_public_slug_unique').on(table.publicSlug)
	})
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
	(table) => ({
		tournamentIdx: index('courts_tournament_id_idx').on(table.tournamentId),
		tournamentNameUnique: uniqueIndex('courts_tournament_name_unique').on(
			table.tournamentId,
			table.name
		)
	})
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

		createdAt: text('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),

		updatedAt: text('updated_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => ({
		tournamentIdx: index('matches_tournament_id_idx').on(table.tournamentId),
		courtIdx: index('matches_court_id_idx').on(table.courtId),
		serverIdx: index('matches_current_server_idx').on(table.currentServerPlayerId)
	})
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
	(table) => ({
		matchIdx: index('match_sides_match_id_idx').on(table.matchId),
		matchSideUnique: uniqueIndex('match_sides_match_side_unique').on(table.matchId, table.side)
	})
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
	(table) => ({
		matchIdx: index('match_side_players_match_id_idx').on(table.matchId),
		matchSideIdx: index('match_side_players_match_side_idx').on(table.matchId, table.side),
		matchSideOrderUnique: uniqueIndex('match_side_players_match_side_order_unique').on(
			table.matchId,
			table.side,
			table.playerOrder
		)
	})
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
				'match_confirmed'
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
	(table) => ({
		matchSeqUnique: uniqueIndex('score_events_match_seq_unique').on(table.matchId, table.seqNo),
		matchIdempotencyUnique: uniqueIndex('score_events_match_idempotency_unique').on(
			table.matchId,
			table.idempotencyKey
		),
		matchSeqIdx: index('score_events_match_seq_idx').on(table.matchId, table.seqNo)
	})
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
	(table) => ({
		matchTargetUnique: uniqueIndex('score_event_undo_links_match_target_unique').on(
			table.matchId,
			table.targetSeqNo
		)
	})
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
