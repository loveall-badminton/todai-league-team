import type { MatchState } from '$lib/domain/types';
import {
	applyMatchActionWithDb,
	type ApplyMatchActionParams
} from '$lib/server/services/matchActionCore';

export type { ApplyMatchActionParams };
export { applyMatchActionWithDb };

export async function applyMatchAction(params: ApplyMatchActionParams): Promise<MatchState> {
	const { getRequestDb } = await import('$lib/server/db/request');
	const db = getRequestDb();
	const result = await applyMatchActionWithDb(db, params);
	return result.afterState;
}
