import { getRequestDb } from '$lib/server/db/request';
import {
	MatchActionCoordinatorResponseSchema,
	MATCH_ACTION_COORDINATOR_URL
} from './matchActionProtocol';
import { applyMatchActionWithDb, type ApplyMatchActionParams } from './matchActionCore';
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
	let response: Response;
	try {
		response = await stub.fetch(MATCH_ACTION_COORDINATOR_URL, {
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
	} catch {
		const db = getRequestDb();
		return applyMatchActionWithDb(db, params);
	}
	let raw: unknown;
	try {
		raw = await response.json();
	} catch (err) {
		throw new Error(
			`[DO:${params.matchId}/${params.input.type}] invalid JSON response (${response.status}): ${err instanceof Error ? err.message : String(err)}`,
			{ cause: err }
		);
	}
	const parsed = v.safeParse(MatchActionCoordinatorResponseSchema, raw);
	if (!parsed.success) {
		throw new Error(
			`[DO:${params.matchId}/${params.input.type}] unexpected response shape: body=${JSON.stringify(raw).slice(0, 200)}`
		);
	}
	if (!parsed.output.ok) {
		throw new Error(parsed.output.error);
	}

	return {
		afterState: parsed.output.afterState,
		input: parsed.output.input as ScoreEventInput
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
