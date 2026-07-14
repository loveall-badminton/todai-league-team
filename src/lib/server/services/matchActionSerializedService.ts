import { now as nowIso } from '$lib/utils/now';
import { getRequestDb } from '$lib/server/db/request';
import {
	MatchActionCoordinatorResponseSchema,
	MATCH_ACTION_COORDINATOR_URL
} from './matchActionProtocol';
import { applyMatchActionWithDb, type ApplyMatchActionParams } from './matchActionCore';
import type { ScoreEventInput } from '$lib/domain/types';
import * as v from 'valibot';

const DO_FETCH_RETRY_DELAY_MS = 100;
// D1 が詰まって blockConcurrencyWhile が長時間返らないケースに備えたタイムアウト。
// DO 側の処理自体はキャンセルできない(D1 呼び出しに中断機構がない)ため、タイムアウトしても
// 直列化書き込みは裏で継続している可能性がある。よってタイムアウト時は直接DB書き込みへの
// フォールバックはせず(二重書き込みレースになるため)、呼び出し元にリトライを促すエラーを投げる。
const DO_FETCH_TIMEOUT_MS = 8000;

async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

function isTimeoutError(err: unknown): boolean {
	return (
		typeof err === 'object' &&
		err !== null &&
		'name' in err &&
		(err as { name: unknown }).name === 'TimeoutError'
	);
}

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
	const requestBody = JSON.stringify({
		matchId: params.matchId,
		input: params.input,
		actorName: params.actorName ?? null,
		now: params.now,
		beforeState: params.beforeState ?? null,
		players: params.players ?? null
	});

	let response: Response;
	try {
		response = await stub.fetch(MATCH_ACTION_COORDINATOR_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: requestBody,
			signal: AbortSignal.timeout(DO_FETCH_TIMEOUT_MS)
		});
	} catch (firstErr) {
		if (isTimeoutError(firstErr)) {
			console.error(
				'[matchAction] MatchActionCoordinator timed out (D1 write may still be in-flight)',
				{
					matchId: params.matchId,
					inputType: params.input.type,
					timeoutMs: DO_FETCH_TIMEOUT_MS,
					at: nowIso()
				}
			);
			throw new Error(
				`[DO:${params.matchId}/${params.input.type}] timed out — 処理が混み合っています。しばらくしてから再試行してください`,
				{ cause: firstErr }
			);
		}
		// 単発のネットワーク瞬断で直列化をバイパスしてしまわないよう、一度だけ再試行する
		await sleep(DO_FETCH_RETRY_DELAY_MS);
		try {
			response = await stub.fetch(MATCH_ACTION_COORDINATOR_URL, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: requestBody,
				signal: AbortSignal.timeout(DO_FETCH_TIMEOUT_MS)
			});
		} catch (secondErr) {
			if (isTimeoutError(secondErr)) {
				console.error('[matchAction] MatchActionCoordinator timed out on retry', {
					matchId: params.matchId,
					inputType: params.input.type,
					timeoutMs: DO_FETCH_TIMEOUT_MS,
					at: nowIso()
				});
				throw new Error(
					`[DO:${params.matchId}/${params.input.type}] timed out — 処理が混み合っています。しばらくしてから再試行してください`,
					{ cause: secondErr }
				);
			}
			// DO に本当に到達できない(=リージョン障害等)場合のみ、直列化なしの直接書き込みに
			// フォールバックする。同時書き込みレースが再発しうる経路のため必ずログに残す。
			console.error(
				'[matchAction] MatchActionCoordinator unreachable, falling back to direct DB write',
				{
					matchId: params.matchId,
					inputType: params.input.type,
					firstError: firstErr instanceof Error ? firstErr.message : String(firstErr),
					secondError: secondErr instanceof Error ? secondErr.message : String(secondErr),
					at: nowIso()
				}
			);
			const db = getRequestDb();
			return applyMatchActionWithDb(db, params);
		}
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
		input: parsed.output.input
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
