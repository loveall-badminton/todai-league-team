import { DurableObject } from 'cloudflare:workers';
import { getDb } from '$lib/server/db';
import { applyMatchActionWithDb } from '$lib/server/services/matchActionService';
import {
	MATCH_ACTION_COORDINATOR_URL,
	MatchActionCoordinatorRequestSchema,
	type MatchActionCoordinatorResponse
} from '$lib/server/services/matchActionProtocol';
import type { MatchPlayer, MatchState, ScoreEventInput } from '$lib/domain/types';
import * as v from 'valibot';

export class MatchActionCoordinator extends DurableObject<Env> {
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
					{
						status: 400
					}
				);
			}

			const parsed = v.safeParse(MatchActionCoordinatorRequestSchema, raw);
			if (!parsed.success) {
				return Response.json(
					{ ok: false, error: 'invalid payload' } satisfies MatchActionCoordinatorResponse,
					{ status: 400 }
				);
			}

			try {
				const db = getDb(this.env.DB);
				const result = await applyMatchActionWithDb(db, {
					matchId: parsed.output.matchId,
					input: parsed.output.input as ScoreEventInput,
					actorName: parsed.output.actorName ?? null,
					now: parsed.output.now,
					beforeState: (parsed.output.beforeState ?? undefined) as MatchState | undefined,
					players: (parsed.output.players ?? undefined) as MatchPlayer[] | undefined
				});
				return Response.json({ ok: true, ...result } satisfies MatchActionCoordinatorResponse);
			} catch (err) {
				return Response.json(
					{
						ok: false,
						error: err instanceof Error ? err.message : '操作に失敗しました'
					} satisfies MatchActionCoordinatorResponse,
					{ status: 409 }
				);
			}
		});
	}
}
