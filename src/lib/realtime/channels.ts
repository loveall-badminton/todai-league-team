import * as v from 'valibot';
import { MatchStateSchema } from '$lib/domain/schemas';

const liveTopicSchema = v.picklist(['score', 'standings', 'schedule', 'finals'] as const);

export type LiveTopic = v.InferOutput<typeof liveTopicSchema>;

export const ALL_LIVE_TOPICS: readonly LiveTopic[] = ['score', 'standings', 'schedule', 'finals'];
const groupCodeSchema = v.picklist(['A', 'B'] as const);
const tiePhaseSchema = v.picklist([
	'group_a',
	'group_b',
	'semifinal',
	'final',
	'third_place',
	'fifth_place',
	'ranking_tiebreaker'
] as const);
const scheduleScopeSchema = v.picklist(['tie_header', 'lineups', 'rubbers'] as const);
const tieStatusSchema = v.picklist([
	'scheduled',
	'lineup_pending',
	'lineup_submitted',
	'ready',
	'playing',
	'finished',
	'confirmed',
	'cancelled'
] as const);

export const liveScoreEventSchema = v.object({
	type: v.string(),
	seqNo: v.optional(v.number()),
	side: v.optional(v.string()),
	gameNo: v.optional(v.number()),
	scoreA: v.optional(v.number()),
	scoreB: v.optional(v.number()),
	targetSeqNo: v.optional(v.number()),
	// 審判画面のスコアシートをローカル差分適用するためのサービス情報
	// (DB の score_events 行と同じ意味の値)
	serverPlayerIdBefore: v.optional(v.nullable(v.string())),
	receiverPlayerIdBefore: v.optional(v.nullable(v.string())),
	serverPlayerIdAfter: v.optional(v.nullable(v.string())),
	receiverPlayerIdAfter: v.optional(v.nullable(v.string()))
});

export type LiveScoreEvent = v.InferOutput<typeof liveScoreEventSchema>;

export const liveScorePayloadSchema = v.object({
	state: MatchStateSchema,
	event: v.optional(liveScoreEventSchema)
});

export const liveStandingsPayloadSchema = v.object({
	groupCodes: v.optional(v.array(groupCodeSchema)),
	tieIds: v.optional(v.array(v.string()))
});

export const liveSchedulePayloadSchema = v.object({
	tieIds: v.optional(v.array(v.string())),
	matchIds: v.optional(v.array(v.string())),
	phases: v.optional(v.array(tiePhaseSchema)),
	scopes: v.optional(v.array(scheduleScopeSchema)),
	ties: v.optional(
		v.array(
			v.object({
				id: v.string(),
				tieCode: v.string(),
				teamAId: v.nullable(v.string()),
				teamBId: v.nullable(v.string()),
				winnerTeamId: v.nullable(v.string()),
				scheduledStartAt: v.nullable(v.string()),
				lineupDueAt: v.nullable(v.string()),
				teamAName: v.nullable(v.string()),
				teamBName: v.nullable(v.string()),
				status: tieStatusSchema,
				teamScoreA: v.number(),
				teamScoreB: v.number(),
				phase: tiePhaseSchema,
				updatedAt: v.string()
			})
		)
	)
});

export const liveFinalsPayloadSchema = v.object({
	tieIds: v.optional(v.array(v.string())),
	phases: v.optional(v.array(tiePhaseSchema))
});

export const liveUpdateDataSchema = v.partial(
	v.object({
		score: liveScorePayloadSchema,
		standings: liveStandingsPayloadSchema,
		schedule: liveSchedulePayloadSchema,
		finals: liveFinalsPayloadSchema
	})
);

export type LiveTopicPayloadMap = {
	score: v.InferOutput<typeof liveScorePayloadSchema>;
	standings: v.InferOutput<typeof liveStandingsPayloadSchema>;
	schedule: v.InferOutput<typeof liveSchedulePayloadSchema>;
	finals: v.InferOutput<typeof liveFinalsPayloadSchema>;
};

export type LiveUpdateData<TTopic extends LiveTopic = LiveTopic> = Partial<
	Pick<LiveTopicPayloadMap, TTopic>
>;

const helloMessageSchema = v.object({
	type: v.literal('hello'),
	at: v.string()
});

const updatedMessageSchema = v.object({
	type: v.literal('updated'),
	topics: v.array(liveTopicSchema),
	at: v.string(),
	data: v.optional(liveUpdateDataSchema)
});

export const liveMessageSchema = v.union([helloMessageSchema, updatedMessageSchema]);

export type LiveMessage = v.InferOutput<typeof liveMessageSchema>;
export type LiveUpdatedMessage = v.InferOutput<typeof updatedMessageSchema>;

export function parseLiveMessage(data: unknown): LiveMessage | null {
	const result = v.safeParse(liveMessageSchema, data);
	return result.success ? result.output : null;
}

export function createLiveUpdatedMessage<TTopics extends readonly LiveTopic[]>(
	topics: TTopics,
	data?: LiveUpdateData<TTopics[number]>
): LiveUpdatedMessage {
	return {
		type: 'updated',
		topics: [...topics],
		at: new Date().toISOString(),
		...(data ? { data } : {})
	};
}

export function isLiveUpdatedMessage(message: LiveMessage): message is LiveUpdatedMessage {
	return message.type === 'updated';
}

export function filterSubscribedTopics<TTopic extends LiveTopic>(
	messageTopics: readonly LiveTopic[],
	subscribedTopics: readonly TTopic[]
): TTopic[] {
	if (subscribedTopics.length === 0) return [...messageTopics] as TTopic[];
	return messageTopics.filter((topic): topic is TTopic =>
		(subscribedTopics as readonly LiveTopic[]).includes(topic)
	);
}

export function hasScoreUpdate(
	data: LiveUpdateData | undefined
): data is LiveUpdateData & { score: LiveTopicPayloadMap['score'] } {
	return data?.score !== undefined;
}

export const LIVE_BOARD_CHANNEL = 'live-board';

export function matchChannel(matchId: string): string {
	return `match:${matchId}`;
}
