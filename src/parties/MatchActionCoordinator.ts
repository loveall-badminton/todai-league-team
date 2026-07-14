import { DurableObject } from 'cloudflare:workers';
import { getDb } from '$lib/server/db';
import { applyMatchActionWithDb } from '$lib/server/services/matchActionCore';
import {
	MATCH_ACTION_COORDINATOR_URL,
	MatchActionCoordinatorRequestSchema,
	type MatchActionCoordinatorResponse,
	type MatchActionCoordinatorSuccess
} from '$lib/server/services/matchActionProtocol';
import { resolvePlayersCache } from './matchActionCache';
import type { MatchPlayer, MatchState, ScoreEventInput } from '$lib/domain/types';
import * as v from 'valibot';

export class MatchActionCoordinator extends DurableObject<Env> {
	private cachedPlayers: MatchPlayer[] | undefined;

	async fetch(request: Request): Promise<Response> {
		return this.ctx.blockConcurrencyWhile(async () => {
			if (request.method !== 'POST' || request.url !== MATCH_ACTION_COORDINATOR_URL) {
				return new Response('Not found', { status: 404 });
			}

			let raw: unknown;
			try {
				raw = await request.json();
			} catch {
				return Response.json(
					{ ok: false, error: 'invalid json' } satisfies MatchActionCoordinatorResponse,
					{ status: 400 }
				);
			}

			const parsed = v.safeParse(MatchActionCoordinatorRequestSchema, raw);
			if (!parsed.success) {
				return Response.json(
					{ ok: false, error: 'invalid payload' } satisfies MatchActionCoordinatorResponse,
					{ status: 400 }
				);
			}

			const matchId = parsed.output.matchId;
			const clientBeforeState: MatchState | undefined = parsed.output.beforeState ?? undefined;
			const clientPlayers: MatchPlayer[] | undefined = parsed.output.players ?? undefined;
			const input: ScoreEventInput = parsed.output.input;
			const inputType = input.type;

			const { players, nextCache } = resolvePlayersCache(clientPlayers, this.cachedPlayers);
			this.cachedPlayers = nextCache;

			try {
				const db = getDb(this.env.DB);
				const result = await applyMatchActionWithDb(db, {
					matchId,
					input,
					actorName: parsed.output.actorName ?? null,
					now: parsed.output.now,
					beforeState: clientBeforeState,
					players
				});
				return Response.json({ ok: true, ...result } satisfies MatchActionCoordinatorSuccess);
			} catch (err) {
				const label = `DO:${matchId}/${inputType}`;
				const message = err instanceof Error ? err.message : '操作に失敗しました';
				return Response.json(
					{
						ok: false,
						error: `[${label}] ${message}`
					} satisfies MatchActionCoordinatorResponse,
					{ status: 409 }
				);
			}
		});
	}
}
