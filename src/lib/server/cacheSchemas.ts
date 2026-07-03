import * as v from 'valibot';

const NullableString = v.nullable(v.string());
const NullableNumber = v.nullable(v.number());
const TiePhaseSchema = v.picklist([
	'group_a',
	'group_b',
	'semifinal',
	'final',
	'third_place',
	'fifth_place',
	'ranking_tiebreaker'
]);
const TieStatusSchema = v.picklist([
	'scheduled',
	'lineup_pending',
	'lineup_submitted',
	'ready',
	'playing',
	'finished',
	'confirmed',
	'cancelled'
]);
const VenueSchema = v.nullable(v.picklist(['first_gym', 'second_gym']));
const RubberCodeSchema = v.picklist(['WD1', 'XD1', 'MD3', 'MD2', 'MD1']);
const RubberStatusSchema = v.picklist([
	'scheduled',
	'not_ready',
	'ready',
	'playing',
	'finished',
	'confirmed',
	'skipped',
	'cancelled'
]);
const MatchStatusSchema = v.nullable(
	v.picklist([
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
	])
);

const LiveGameScoreSchema = v.object({
	gameNo: v.number(),
	scoreA: v.number(),
	scoreB: v.number(),
	winnerSide: v.nullable(v.picklist(['A', 'B']))
});

const PublicRubberSummarySchema = v.object({
	id: v.string(),
	code: RubberCodeSchema,
	matchId: NullableString,
	status: RubberStatusSchema,
	winnerSide: v.nullable(v.picklist(['A', 'B'])),
	matchStatus: MatchStatusSchema,
	gamesScore: NullableString,
	pointScore: NullableString,
	gameDetails: v.array(LiveGameScoreSchema),
	sideAPlayers: NullableString,
	sideBPlayers: NullableString
});

export const TiePageDataSchema = v.object({
	tie: v.object({
		id: v.string(),
		phase: TiePhaseSchema,
		tieCode: v.string(),
		status: TieStatusSchema,
		teamAId: NullableString,
		teamBId: NullableString,
		teamAName: NullableString,
		teamBName: NullableString,
		teamScoreA: v.number(),
		teamScoreB: v.number(),
		venue: VenueSchema,
		courtBlockCode: NullableString,
		scheduledStartAt: NullableString
	}),
	rubbers: v.array(PublicRubberSummarySchema)
});

export const ScoreProgressionDataSchema = v.object({
	byMatchId: v.record(
		v.string(),
		v.array(
			v.object({
				gameNo: v.number(),
				scoreA: v.number(),
				scoreB: v.number()
			})
		)
	),
	eventsByMatchId: v.record(
		v.string(),
		v.array(
			v.object({
				type: v.string(),
				seqNo: v.number(),
				gameNo: v.nullable(v.number()),
				scoreA: v.nullable(v.number()),
				scoreB: v.nullable(v.number()),
				targetSeqNo: v.nullable(v.number())
			})
		)
	)
});

export const ScheduleDataSchema = v.array(
	v.object({
		id: v.string(),
		tieCode: v.string(),
		teamAId: NullableString,
		teamBId: NullableString,
		winnerTeamId: NullableString,
		scheduledStartAt: NullableString,
		lineupDueAt: NullableString,
		teamAName: NullableString,
		teamBName: NullableString,
		status: TieStatusSchema,
		teamScoreA: v.number(),
		teamScoreB: v.number(),
		phase: TiePhaseSchema
	})
);

const StandingRowSchema = v.object({
	teamId: v.string(),
	teamName: v.string(),
	rank: NullableNumber,
	teamMatchesWon: v.number(),
	teamMatchesLost: v.number(),
	rubbersWon: v.number(),
	rubbersLost: v.number(),
	gamesWon: v.number(),
	gamesLost: v.number(),
	headToHeadSummary: v.nullish(v.string()),
	tiedTeamsRubbersWon: v.nullish(v.number()),
	tiedTeamsGamesWon: v.nullish(v.number()),
	requiresTiebreaker: v.boolean(),
	manualRank: v.nullish(v.number())
});

const FinalsTieSchema = v.object({
	id: v.string(),
	tieCode: v.string(),
	phase: TiePhaseSchema,
	teamAId: NullableString,
	teamBId: NullableString,
	teamAName: NullableString,
	teamBName: NullableString,
	winnerTeamId: NullableString,
	status: TieStatusSchema
});

export const StandingsDataSchema = v.object({
	standingA: v.array(StandingRowSchema),
	standingB: v.array(StandingRowSchema),
	groupA: ScheduleDataSchema,
	groupB: ScheduleDataSchema,
	teams: v.array(
		v.object({
			id: v.string(),
			name: v.string()
		})
	),
	finalsTies: v.array(FinalsTieSchema)
});

export const CACHE_TTL = {
	tieDetail: 3,
	tieProgression: 10,
	standings: 5,
	schedule: 3
} as const;
