import * as v from 'valibot';

export const liveTopicSchema = v.picklist(['score', 'standings', 'schedule', 'finals'] as const);

export type LiveTopic = v.InferOutput<typeof liveTopicSchema>;

export const ALL_LIVE_TOPICS: readonly LiveTopic[] = ['score', 'standings', 'schedule', 'finals'];

const helloMessageSchema = v.object({
	type: v.literal('hello'),
	at: v.string()
});

const updatedMessageSchema = v.object({
	type: v.literal('updated'),
	topics: v.array(liveTopicSchema),
	at: v.string()
});

export const liveMessageSchema = v.union([helloMessageSchema, updatedMessageSchema]);

export type LiveMessage = v.InferOutput<typeof liveMessageSchema>;

export function parseLiveMessage(data: unknown): LiveMessage | null {
	const result = v.safeParse(liveMessageSchema, data);
	return result.success ? result.output : null;
}

export const LIVE_BOARD_CHANNEL = 'live-board';

export function matchChannel(matchId: string): string {
	return `match:${matchId}`;
}

export const PARTY_PREFIX = 'parties';

export const LIVE_BOARD_PARTY = 'live-board';
