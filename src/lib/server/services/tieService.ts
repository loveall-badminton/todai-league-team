import { and, asc, eq, like, sql } from 'drizzle-orm';
import {
	groupPhaseFor,
	RUBBER_DEFINITIONS,
	type GroupCode,
	type TiePhase,
	type VenueCode
} from '$lib/domain/tokyoLeague';
import { getRequestDb } from '$lib/server/db/request';
import { rubbers, teams, ties } from '$lib/server/db/schema';
import { ensureDefaultSettings } from './tokyoLeagueSetupService';

type LineupDuePolicy = 'first_match_before_opening' | 'ten_minutes_before' | 'manual';

export async function createTieWithRubbers(params: {
	tieCode: string;
	phase: TiePhase;
	groupCode?: GroupCode | null;
	roundLabel?: string | null;
	teamAId?: string | null;
	teamBId?: string | null;
	scheduledStartAt?: string | null;
	venue?: VenueCode | null;
	courtBlockCode?: string | null;
	scoringRuleId: string;
	displayOrder?: number;
	lineupDueAt?: string | null;
	lineupDuePolicy?: LineupDuePolicy;
	now?: string;
}): Promise<string> {
	const db = getRequestDb();
	const tieCode = params.tieCode.trim();
	if (!tieCode) throw new Error('tieCode is required');
	if (!/^[A-Za-z]+-\d+$/.test(tieCode)) {
		throw new Error(
			`tieCode must be in format {PREFIX}-{NUMBER} (e.g. A-1, LIVE-2), got "${tieCode}"`
		);
	}

	const now = params.now ?? new Date().toISOString();
	const settings = await ensureDefaultSettings(now);
	const lineupDueAt =
		params.lineupDueAt ??
		inferLineupDueAt(
			params.scheduledStartAt ?? null,
			settings.defaultLineupDueMinutesBefore,
			params.lineupDuePolicy
		);
	const tieId = crypto.randomUUID();

	await db.insert(ties).values({
		id: tieId,
		tieCode,
		phase: params.phase,
		groupCode: params.groupCode ?? null,
		roundLabel: params.roundLabel ?? null,
		teamAId: params.teamAId ?? null,
		teamBId: params.teamBId ?? null,
		status: 'lineup_pending',
		displayOrder: params.displayOrder ?? 0,
		scheduledStartAt: params.scheduledStartAt ?? null,
		venue: params.venue ?? null,
		courtBlockCode: params.courtBlockCode ?? null,
		lineupDueAt,
		lineupDuePolicy: params.lineupDuePolicy ?? 'ten_minutes_before',
		createdAt: now,
		updatedAt: now
	});

	await db.insert(rubbers).values(
		RUBBER_DEFINITIONS.map((rubber) => ({
			id: crypto.randomUUID(),
			tieId,
			code: rubber.code,
			discipline: rubber.discipline,
			displayOrder: rubber.displayOrder,
			scoringRuleId: params.scoringRuleId,
			status: 'not_ready' as const,
			createdAt: now,
			updatedAt: now
		}))
	);

	return tieId;
}

export async function ensureRubbersForTie(params: {
	tieId: string;
	scoringRuleId: string;
	now?: string;
}) {
	const db = getRequestDb();
	const [{ count: existingCount }] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(rubbers)
		.where(eq(rubbers.tieId, params.tieId));
	if (existingCount >= RUBBER_DEFINITIONS.length) return;

	const existing = await db
		.select()
		.from(rubbers)
		.where(eq(rubbers.tieId, params.tieId))
		.orderBy(asc(rubbers.displayOrder));

	const existingCodes = new Set(existing.map((rubber) => rubber.code));
	const now = params.now ?? new Date().toISOString();
	const missing = RUBBER_DEFINITIONS.filter((rubber) => !existingCodes.has(rubber.code));
	if (missing.length === 0) return;

	await db.insert(rubbers).values(
		missing.map((rubber) => ({
			id: crypto.randomUUID(),
			tieId: params.tieId,
			code: rubber.code,
			discipline: rubber.discipline,
			displayOrder: rubber.displayOrder,
			scoringRuleId: params.scoringRuleId,
			status: 'not_ready' as const,
			createdAt: now,
			updatedAt: now
		}))
	);
}

export async function generateGroupRoundRobinTies(params: {
	groupCode: GroupCode;
	scoringRuleId: string;
	tieCodePrefix: GroupCode;
	now?: string;
}): Promise<number> {
	const db = getRequestDb();
	const now = params.now ?? new Date().toISOString();
	const settings = await ensureDefaultSettings(now);
	const lineupDueAt = inferLineupDueAt(
		null,
		settings.defaultLineupDueMinutesBefore,
		'ten_minutes_before'
	);
	const groupTeams = await db
		.select()
		.from(teams)
		.where(and(eq(teams.groupCode, params.groupCode), eq(teams.status, 'active')))
		.orderBy(asc(teams.displayOrder), asc(teams.name));

	let nextNo = await nextTieNumber(params.tieCodePrefix);

	const existingTies = await db
		.select({ teamAId: ties.teamAId, teamBId: ties.teamBId })
		.from(ties)
		.where(eq(ties.groupCode, params.groupCode));

	const existingPairs = new Set(existingTies.map((t) => [t.teamAId, t.teamBId].sort().join('|')));

	const tieInserts: unknown[] = [];
	const rubberInserts: unknown[] = [];

	for (let i = 0; i < groupTeams.length; i += 1) {
		for (let j = i + 1; j < groupTeams.length; j += 1) {
			const teamA = groupTeams[i];
			const teamB = groupTeams[j];
			if (existingPairs.has([teamA.id, teamB.id].sort().join('|'))) continue;

			const tieId = crypto.randomUUID();
			tieInserts.push(
				db.insert(ties).values({
					id: tieId,
					tieCode: `${params.tieCodePrefix}-${nextNo}`,
					phase: groupPhaseFor(params.groupCode),
					groupCode: params.groupCode,
					roundLabel: `${params.groupCode}リーグ`,
					teamAId: teamA.id,
					teamBId: teamB.id,
					status: 'lineup_pending',
					displayOrder: nextNo,
					lineupDueAt,
					lineupDuePolicy: 'ten_minutes_before',
					createdAt: now,
					updatedAt: now
				})
			);
			rubberInserts.push(
				db.insert(rubbers).values(
					RUBBER_DEFINITIONS.map((rubber) => ({
						id: crypto.randomUUID(),
						tieId,
						code: rubber.code,
						discipline: rubber.discipline,
						displayOrder: rubber.displayOrder,
						scoringRuleId: params.scoringRuleId,
						status: 'not_ready' as const,
						createdAt: now,
						updatedAt: now
					}))
				)
			);
			nextNo += 1;
		}
	}

	if (tieInserts.length > 0) {
		await (db.batch as unknown as (q: unknown[]) => Promise<unknown>)([
			...tieInserts,
			...rubberInserts
		]);
	}

	return tieInserts.length;
}

export function inferLineupDueAt(
	scheduledStartAt: string | null,
	defaultMinutesBefore: number,
	policy: LineupDuePolicy | undefined
) {
	if (!scheduledStartAt || policy === 'manual' || policy === 'first_match_before_opening') {
		return null;
	}
	const date = new Date(scheduledStartAt);
	if (Number.isNaN(date.getTime())) return null;
	date.setMinutes(date.getMinutes() - defaultMinutesBefore);
	return date.toISOString();
}

export function generateRoundRobinPairs<T>(teams: T[]): [T, T][] {
	const pairs: [T, T][] = [];
	for (let i = 0; i < teams.length; i++) {
		for (let j = i + 1; j < teams.length; j++) {
			pairs.push([teams[i], teams[j]]);
		}
	}
	return pairs;
}

async function nextTieNumber(prefix: GroupCode) {
	const db = getRequestDb();
	const start = prefix.length + 2; // 1-indexed: skip "PREFIX-"
	const [row] = await db
		.select({
			maxNo: sql<number>`MAX(CAST(SUBSTR(${ties.tieCode}, ${start}) AS INTEGER))`
		})
		.from(ties)
		.where(like(ties.tieCode, `${prefix}-%`));
	return (row?.maxNo ?? 0) + 1;
}
