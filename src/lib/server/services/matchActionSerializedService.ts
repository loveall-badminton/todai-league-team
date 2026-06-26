import { getRequestDb } from '$lib/server/db/request';
import {
	MatchActionCoordinatorResponseSchema,
	MATCH_ACTION_COORDINATOR_URL
} from './matchActionProtocol';
import { applyMatchActionWithDb, type ApplyMatchActionParams } from './matchActionService';
import type { ScoreEventInput } from '$lib/domain/types';
import * as v from 'valibot';

export async function applySerializedMatchAction(params: ApplyMatchActionParams): Promise<{
	afterState: Awaited<ReturnType<typeof applyMatchActionWithDb>>['afterState'];
	input: ScoreEventInput;
}> {
	const namespace = await getMatchActionCoordinatorNamespace();
	if (!namespace) {
		const db = getRequestDb();
		return applyMatchActionWithDb(db, params);
	}

	const stub = namespace.getByName(params.matchId);
	const response = await stub.fetch(MATCH_ACTION_COORDINATOR_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			matchId: params.matchId,
			input: params.input,
			actorName: params.actorName ?? null,
			now: params.now,
			beforeState: params.beforeState ?? null,
			players: params.players ?? null
		})
	});
	const raw = await response.json();
	const parsed = v.parse(MatchActionCoordinatorResponseSchema, raw);
	if (!parsed.ok) {
		throw new Error(parsed.error);
	}

	return {
		afterState: parsed.afterState,
		input: parsed.input as ScoreEventInput
	};
}

async function getMatchActionCoordinatorNamespace() {
	try {
		const { getRequestEvent } = await import('$app/server');
		return getRequestEvent().platform?.env?.MatchActionCoordinator ?? null;
	} catch {
		return null;
	}
}
