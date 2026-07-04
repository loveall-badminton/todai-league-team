import { MatchStateSchema, ScoreEventInputSchema } from '$lib/domain/schemas';
import type { MatchPlayer, MatchState, ScoreEventInput } from '$lib/domain/types';
import * as v from 'valibot';

export const MATCH_ACTION_COORDINATOR_URL = 'https://match-action.internal/apply';

const MatchPlayerSchema = v.object({
	id: v.string(),
	name: v.string(),
	side: v.picklist(['A', 'B'] as const),
	order: v.union([v.literal(1), v.literal(2)]),
	teamName: v.nullable(v.string())
});

export const MatchActionCoordinatorRequestSchema = v.object({
	matchId: v.string(),
	input: ScoreEventInputSchema,
	actorName: v.optional(v.nullable(v.string())),
	now: v.string(),
	beforeState: v.optional(v.nullable(MatchStateSchema)),
	players: v.optional(v.nullable(v.array(MatchPlayerSchema)))
});

export const MatchActionCoordinatorSuccessSchema = v.object({
	ok: v.literal(true),
	afterState: MatchStateSchema,
	input: ScoreEventInputSchema
});

export const MatchActionCoordinatorErrorSchema = v.object({
	ok: v.literal(false),
	error: v.string()
});

export const MatchActionCoordinatorResponseSchema = v.union([
	MatchActionCoordinatorSuccessSchema,
	MatchActionCoordinatorErrorSchema
]);

export type MatchActionCoordinatorRequest = {
	matchId: string;
	input: ScoreEventInput;
	actorName?: string | null;
	now: string;
	beforeState?: MatchState | null;
	players?: MatchPlayer[] | null;
};

export type MatchActionCoordinatorSuccess = {
	ok: true;
	afterState: MatchState;
	input: ScoreEventInput;
};

export type MatchActionCoordinatorError = {
	ok: false;
	error: string;
};

export type MatchActionCoordinatorResponse =
	MatchActionCoordinatorSuccess | MatchActionCoordinatorError;
