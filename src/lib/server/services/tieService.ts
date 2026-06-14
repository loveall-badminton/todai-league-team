import { and, asc, eq, or } from 'drizzle-orm';
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

	const existing = await db.query.ties.findFirst({ where: eq(ties.tieCode, tieCode) });
	if (existing) throw new Error(`tieCode ${tieCode} already exists`);

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
	const existing = await db
		.select()
		.from(rubbers)
		.where(eq(rubbers.tieId, params.tieId))
		.orderBy(asc(rubbers.displayOrder));
	if (existing.length === RUBBER_DEFINITIONS.length) return;

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
	const groupTeams = await db
		.select()
		.from(teams)
		.where(and(eq(teams.groupCode, params.groupCode), eq(teams.status, 'active')))
		.orderBy(asc(teams.displayOrder), asc(teams.name));

	let created = 0;
	let nextNo = await nextTieNumber(params.tieCodePrefix);

	for (let i = 0; i < groupTeams.length; i += 1) {
		for (let j = i + 1; j < groupTeams.length; j += 1) {
			const teamA = groupTeams[i];
			const teamB = groupTeams[j];
			const duplicate = await db.query.ties.findFirst({
				where: and(
					eq(ties.groupCode, params.groupCode),
					or(
						and(eq(ties.teamAId, teamA.id), eq(ties.teamBId, teamB.id)),
						and(eq(ties.teamAId, teamB.id), eq(ties.teamBId, teamA.id))
					)
				)
			});
			if (duplicate) continue;

			await createTieWithRubbers({
				tieCode: `${params.tieCodePrefix}-${nextNo}`,
				phase: groupPhaseFor(params.groupCode),
				groupCode: params.groupCode,
				roundLabel: `${params.groupCode}リーグ`,
				teamAId: teamA.id,
				teamBId: teamB.id,
				scoringRuleId: params.scoringRuleId,
				displayOrder: nextNo,
				now
			});
			created += 1;
			nextNo += 1;
		}
	}

	return created;
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
	const existing = await db.select({ tieCode: ties.tieCode }).from(ties);
	const usedNumbers = existing
		.map((tie) => {
			const match = new RegExp(`^${prefix}-(\\d+)$`).exec(tie.tieCode);
			return match ? Number(match[1]) : 0;
		})
		.filter((value) => Number.isInteger(value) && value > 0);
	return Math.max(0, ...usedNumbers) + 1;
}
