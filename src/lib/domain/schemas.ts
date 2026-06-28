import * as v from 'valibot';

export const SideSchema = v.picklist(['A', 'B'] as const);

export const ServiceCourtSchema = v.picklist(['right', 'left'] as const);

export const MatchDisciplineSchema = v.picklist(['MS', 'WS', 'MD', 'WD', 'XD'] as const);

export const MatchStatusSchema = v.picklist([
	'scheduled',
	'playing',
	'interval',
	'suspended',
	'finished',
	'confirmed',
	'forfeited',
	'retired',
	'cancelled'
] as const);

export const TerminalReasonSchema = v.picklist([
	'normal',
	'forfeit',
	'retirement',
	'disqualification',
	'walkover',
	'cancelled'
] as const);

export const GameScoreSchema = v.object({
	A: v.number(),
	B: v.number()
});

export const CourtAssignmentSchema = v.object({
	right: v.string(),
	left: v.string()
});

export const CourtAssignmentsSchema = v.object({
	A: CourtAssignmentSchema,
	B: CourtAssignmentSchema
});

export const ScoringConfigSchema = v.object({
	maxGames: v.number(),
	gamesToWin: v.number(),
	pointsToWin: v.number(),
	winBy: v.number(),
	maxPoints: v.number(),
	midGameIntervalPoint: v.number()
});

export const GameStateSchema = v.object({
	gameNo: v.number(),
	score: GameScoreSchema,
	winnerSide: v.nullable(SideSchema),
	midGameIntervalTaken: v.boolean(),
	changeEndsRequired: v.boolean(),
	changeEndsCompleted: v.boolean()
});

const SinglesServiceStateSchema = v.object({
	discipline: v.literal('singles'),
	servingSide: SideSchema,
	serviceCourt: ServiceCourtSchema,
	serverPlayerId: v.string(),
	receiverPlayerId: v.string()
});

const DoublesServiceStateSchema = v.object({
	discipline: v.literal('doubles'),
	servingSide: SideSchema,
	serviceCourt: ServiceCourtSchema,
	serverPlayerId: v.string(),
	receiverPlayerId: v.string(),
	courtAssignments: CourtAssignmentsSchema,
	initialServerPlayerId: v.string(),
	initialReceiverPlayerId: v.string()
});

export const ServiceStateSchema = v.variant('discipline', [
	SinglesServiceStateSchema,
	DoublesServiceStateSchema
]);

export const GamesWonSchema = v.object({
	A: v.number(),
	B: v.number()
});

export const MatchStateSchema = v.object({
	schemaVersion: v.literal(1 as const),
	matchId: v.string(),
	tournamentId: v.string(),
	courtId: v.nullable(v.string()),
	discipline: MatchDisciplineSchema,
	status: MatchStatusSchema,
	scoring: ScoringConfigSchema,
	currentGameNo: v.number(),
	games: v.array(GameStateSchema),
	gamesWon: GamesWonSchema,
	winnerSide: v.nullable(SideSchema),
	terminalReason: v.nullable(TerminalReasonSchema),
	service: v.nullable(ServiceStateSchema),
	lastSeqNo: v.number(),
	confirmedFromStatus: v.optional(v.nullable(MatchStatusSchema)),
	createdAt: v.string(),
	updatedAt: v.string()
});

export const MatchStatePayloadSchema = v.object({
	beforeState: v.optional(MatchStateSchema),
	afterState: v.optional(MatchStateSchema)
});

export const CourtNumbersSchema = v.array(v.number());

export const LetReasonSchema = v.picklist([
	'receiver_not_ready',
	'both_faulted',
	'shuttle_caught_on_net',
	'shuttle_disintegrated',
	'line_judge_unsighted',
	'unforeseen_situation',
	'other'
] as const);

export const SuspendReasonSchema = v.picklist([
	'injury',
	'equipment',
	'court_condition',
	'power_failure',
	'weather',
	'referee_decision',
	'other'
] as const);

const ScoreEventInputBaseSchema = v.object({
	idempotencyKey: v.string(),
	observedSeqNo: v.number(),
	clientSeqNo: v.optional(v.number()),
	clientCreatedAt: v.optional(v.string())
});

export const ScoreEventInputSchema = v.variant('type', [
	v.object({
		...ScoreEventInputBaseSchema.entries,
		type: v.literal('match_started'),
		initialServerPlayerId: v.string(),
		initialReceiverPlayerId: v.string()
	}),
	v.object({
		...ScoreEventInputBaseSchema.entries,
		type: v.literal('game_started'),
		gameNo: v.number(),
		initialServerPlayerId: v.string(),
		initialReceiverPlayerId: v.string()
	}),
	v.object({
		...ScoreEventInputBaseSchema.entries,
		type: v.literal('rally_won'),
		side: SideSchema
	}),
	v.object({
		...ScoreEventInputBaseSchema.entries,
		type: v.literal('undo'),
		targetSeqNo: v.optional(v.number()),
		reason: v.optional(v.string()),
		restoreState: v.optional(MatchStateSchema)
	}),
	v.object({
		...ScoreEventInputBaseSchema.entries,
		type: v.literal('correction'),
		gameNo: v.number(),
		score: GameScoreSchema,
		gamesWon: v.optional(GamesWonSchema),
		service: v.optional(v.nullable(ServiceStateSchema)),
		reason: v.string()
	}),
	v.object({
		...ScoreEventInputBaseSchema.entries,
		type: v.literal('let_called'),
		reason: LetReasonSchema,
		note: v.optional(v.string())
	}),
	v.object({
		...ScoreEventInputBaseSchema.entries,
		type: v.literal('match_suspended'),
		reason: SuspendReasonSchema,
		note: v.optional(v.string())
	}),
	v.object({
		...ScoreEventInputBaseSchema.entries,
		type: v.literal('match_resumed'),
		note: v.optional(v.string())
	}),
	v.object({
		...ScoreEventInputBaseSchema.entries,
		type: v.literal('side_forfeited'),
		side: SideSchema,
		reason: v.picklist(['no_show', 'withdrawal', 'disqualification', 'other'] as const),
		note: v.optional(v.string())
	}),
	v.object({
		...ScoreEventInputBaseSchema.entries,
		type: v.literal('side_retired'),
		side: SideSchema,
		reason: v.picklist(['injury', 'illness', 'other'] as const),
		note: v.optional(v.string())
	}),
	v.object({
		...ScoreEventInputBaseSchema.entries,
		type: v.literal('match_confirmed'),
		note: v.optional(v.string())
	}),
	v.object({
		...ScoreEventInputBaseSchema.entries,
		type: v.literal('match_unconfirmed'),
		note: v.optional(v.string())
	})
]);
