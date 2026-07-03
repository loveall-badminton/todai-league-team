import { and, asc, eq, inArray } from 'drizzle-orm';
import { getRequestDb } from '$lib/server/db/request';
import {
	buildCreateMatchWithPlayersStatements,
	createMatchWithPlayers
} from '$lib/server/repositories/matchRepository';
import type { RequestDb } from '$lib/server/repositories/matchStateStore';
import {
	lineupItems,
	lineupSubmissions,
	matchSnapshots,
	matches,
	rubbers,
	scoringRules,
	teamPlayers,
	teams,
	ties
} from '$lib/server/db/schema';
import { MatchStateSchema } from '$lib/domain/schemas';
import { isTerminalRubberStatus } from '$lib/domain/matchStatus';
import { calculateTieResult, rubberStatusFromMatchResultStatus } from '$lib/domain/tieProgress';
import { applyMatchCancellation } from '$lib/domain/scoring';
import * as v from 'valibot';
import {
	INTERNAL_TOURNAMENT_ID,
	ensureInternalTournament,
	scoringConfigFromRule
} from './tokyoLeagueSetupService';
import { buildRevealLineupsStatements } from './lineupService';

export async function startTie(tieId: string, options: { force?: boolean; now?: string } = {}) {
	const db = await getRequestDbOrThrow();
	const now = options.now ?? new Date().toISOString();
	const tie = await db.query.ties.findFirst({ where: eq(ties.id, tieId) });
	if (!tie) throw new Error('対戦が見つかりません');

	const submissions = await db
		.select()
		.from(lineupSubmissions)
		.where(eq(lineupSubmissions.tieId, tieId));
	const ready =
		submissions.length >= 2 &&
		submissions.every((submission) =>
			['submitted', 'locked', 'revealed'].includes(submission.status)
		);
	if (!ready && !options.force) throw new Error('両チームのオーダー提出が必要です');

	const allRubbers = await db.select().from(rubbers).where(eq(rubbers.tieId, tieId));
	type DbStatement = Parameters<typeof db.batch>[0][number];
	const statements: DbStatement[] = [];
	await ensureInternalTournament(now);

	if (!tie.lineupsRevealedAt) {
		statements.push(...buildRevealLineupsStatements(db, tieId, submissions, now));
	}

	const submissionIds = submissions.map((submission) => submission.id);
	const lineupRows =
		submissionIds.length > 0
			? await db.select().from(lineupItems).where(inArray(lineupItems.submissionId, submissionIds))
			: [];
	const playerIds = [...new Set(lineupRows.flatMap((row) => [row.player1Id, row.player2Id]))];
	const teamIds = [...new Set(submissions.map((submission) => submission.teamId))];
	const playerRows =
		playerIds.length > 0
			? await db.select().from(teamPlayers).where(inArray(teamPlayers.id, playerIds))
			: [];
	const teamRows =
		teamIds.length > 0 ? await db.select().from(teams).where(inArray(teams.id, teamIds)) : [];
	const scoringRuleIds = [...new Set(allRubbers.map((rubber) => rubber.scoringRuleId))];
	const scoringRuleRows =
		scoringRuleIds.length > 0
			? await db.select().from(scoringRules).where(inArray(scoringRules.id, scoringRuleIds))
			: [];
	const playerById = new Map(playerRows.map((player) => [player.id, player]));
	const teamNameById = new Map(teamRows.map((team) => [team.id, team.name]));
	const scoringRuleById = new Map(scoringRuleRows.map((rule) => [rule.id, rule]));
	const submissionBySide = new Map(submissions.map((submission) => [submission.side, submission]));
	const lineupBySubmissionIdAndCode = new Map(
		lineupRows.map((row) => [`${row.submissionId}:${row.rubberCode}`, row])
	);

	for (const rubber of allRubbers) {
		if (rubber.matchId) continue;
		const sideAPlayers = buildMatchPlayersForRubber({
			rubberCode: rubber.code,
			side: 'A',
			submissionBySide,
			lineupBySubmissionIdAndCode,
			playerById,
			teamNameById
		});
		const sideBPlayers = buildMatchPlayersForRubber({
			rubberCode: rubber.code,
			side: 'B',
			submissionBySide,
			lineupBySubmissionIdAndCode,
			playerById,
			teamNameById
		});
		const scoringRule = scoringRuleById.get(rubber.scoringRuleId);
		if (!scoringRule) throw new Error('Scoring rule not found');

		const createInput = {
			tournamentId: INTERNAL_TOURNAMENT_ID,
			courtId: null,
			discipline: rubber.discipline,
			eventName: tie.tieCode,
			category: tie.roundLabel,
			roundName: rubber.code,
			rubberId: rubber.id,
			scoringRuleId: rubber.scoringRuleId,
			scoring: scoringConfigFromRule(scoringRule),
			players: [...sideAPlayers, ...sideBPlayers],
			now
		};
		const prepared = buildCreateMatchWithPlayersStatements(db, createInput);
		statements.push(...prepared.statements);
		statements.push(
			db
				.update(rubbers)
				.set({ matchId: prepared.matchId, status: 'scheduled', updatedAt: now })
				.where(eq(rubbers.id, rubber.id))
		);
	}

	statements.push(
		db
			.update(ties)
			.set({ status: 'playing', actualStartAt: tie.actualStartAt ?? now, updatedAt: now })
			.where(eq(ties.id, tieId)),
		db.update(rubbers).set({ status: 'scheduled', updatedAt: now }).where(eq(rubbers.tieId, tieId))
	);

	await db.batch(statements as [DbStatement, ...DbStatement[]]);
}

function buildMatchPlayersForRubber(params: {
	rubberCode: string;
	side: 'A' | 'B';
	submissionBySide: Map<'A' | 'B', typeof lineupSubmissions.$inferSelect>;
	lineupBySubmissionIdAndCode: Map<string, typeof lineupItems.$inferSelect>;
	playerById: Map<string, typeof teamPlayers.$inferSelect>;
	teamNameById: Map<string, string>;
}) {
	const submission = params.submissionBySide.get(params.side);
	if (!submission) {
		throw new Error(`${params.side}側のオーダーがありません`);
	}
	const lineup = params.lineupBySubmissionIdAndCode.get(`${submission.id}:${params.rubberCode}`);
	const [player1, player2] = resolveRubberLineupPlayers({
		rubberCode: params.rubberCode,
		lineup,
		player1: lineup ? params.playerById.get(lineup.player1Id) : undefined,
		player2: lineup ? params.playerById.get(lineup.player2Id) : undefined
	});
	const teamName = params.teamNameById.get(submission.teamId) ?? null;
	return [
		{ side: params.side, order: 1 as const, name: player1.name, teamName },
		{ side: params.side, order: 2 as const, name: player2.name, teamName }
	];
}

function resolveRubberLineupPlayers(params: {
	rubberCode: string;
	lineup: typeof lineupItems.$inferSelect | undefined;
	player1: typeof teamPlayers.$inferSelect | undefined;
	player2: typeof teamPlayers.$inferSelect | undefined;
}) {
	if (!params.lineup) {
		throw new Error(`${params.rubberCode}のオーダーがありません`);
	}
	if (!params.player1 || !params.player2) {
		throw new Error('選手が見つかりません');
	}
	return [params.player1, params.player2] as const;
}

export async function createMatchFromRubber(
	rubberId: string,
	now = new Date().toISOString()
): Promise<string> {
	const db = await getRequestDbOrThrow();
	const rubber = await db.query.rubbers.findFirst({ where: eq(rubbers.id, rubberId) });
	if (!rubber) throw new Error('種目が見つかりません');
	if (rubber.matchId) return rubber.matchId;

	const tie = await db.query.ties.findFirst({ where: eq(ties.id, rubber.tieId) });
	if (!tie) throw new Error('Tie not found');
	if (!tie.lineupsRevealedAt) throw new Error('オーダー公開後にmatchを作成できます');

	const [sideA, sideB] = await Promise.all([
		getLineupPlayersForRubber(tie.id, 'A', rubber.code),
		getLineupPlayersForRubber(tie.id, 'B', rubber.code)
	]);
	const scoringRule = await db.query.scoringRules.findFirst({
		where: eq(scoringRules.id, rubber.scoringRuleId)
	});
	if (!scoringRule) throw new Error('Scoring rule not found');

	await ensureInternalTournament(now);

	const matchId = await createMatchWithPlayers({
		tournamentId: INTERNAL_TOURNAMENT_ID,
		courtId: null,
		discipline: rubber.discipline,
		eventName: tie.tieCode,
		category: tie.roundLabel,
		roundName: rubber.code,
		rubberId: rubber.id,
		scoringRuleId: rubber.scoringRuleId,
		scoring: scoringConfigFromRule(scoringRule),
		players: [
			...sideA.map((player, index) => ({
				side: 'A' as const,
				order: (index + 1) as 1 | 2,
				name: player.name,
				teamName: player.teamName
			})),
			...sideB.map((player, index) => ({
				side: 'B' as const,
				order: (index + 1) as 1 | 2,
				name: player.name,
				teamName: player.teamName
			}))
		],
		now
	});

	await db
		.update(rubbers)
		.set({ matchId, status: 'scheduled', updatedAt: now })
		.where(eq(rubbers.id, rubber.id));
	return matchId;
}

export async function syncRubberResultFromMatch(matchId: string, now = new Date().toISOString()) {
	const db = await getRequestDbOrThrow();
	const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
	if (!match?.rubberId) return;
	const rubberStatus = rubberStatusFromMatchResultStatus(match.status);
	if (!rubberStatus || !match.winnerSide) return;

	await db
		.update(rubbers)
		.set({
			status: rubberStatus,
			winnerSide: match.winnerSide,
			updatedAt: now
		})
		.where(eq(rubbers.id, match.rubberId));

	const rubber = await db.query.rubbers.findFirst({ where: eq(rubbers.id, match.rubberId) });
	if (rubber) await recalculateTieResult(rubber.tieId, now);
}

export async function recalculateTieResult(
	tieId: string,
	now = new Date().toISOString(),
	dbParam?: RequestDb
) {
	const db = await getRequestDbOrThrow(dbParam);
	const tie = await db.query.ties.findFirst({ where: eq(ties.id, tieId) });
	if (!tie) throw new Error('Tie not found');
	const rubberRows = await db
		.select()
		.from(rubbers)
		.where(eq(rubbers.tieId, tieId))
		.orderBy(asc(rubbers.displayOrder));
	const result = calculateTieResult(tie, rubberRows);

	await db
		.update(ties)
		.set({
			teamScoreA: result.teamScoreA,
			teamScoreB: result.teamScoreB,
			winnerTeamId: result.winnerTeamId,
			status: result.status,
			actualEndAt: result.decided ? (tie.actualEndAt ?? now) : tie.actualEndAt,
			updatedAt: now
		})
		.where(eq(ties.id, tieId));
}

export async function cutoffTie(tieId: string, now = new Date().toISOString()) {
	const db = await getRequestDbOrThrow();
	const tie = await db.query.ties.findFirst({ where: eq(ties.id, tieId) });
	if (!tie) throw new Error('対戦が見つかりません');
	if (tie.status === 'confirmed') throw new Error('確定済みの対戦は打ち切りできません');

	const rubberRows = await db
		.select()
		.from(rubbers)
		.where(eq(rubbers.tieId, tieId))
		.orderBy(asc(rubbers.displayOrder));
	const currentResult = calculateTieResult(tie, rubberRows);
	if (!currentResult.winnerTeamId) {
		throw new Error('3勝到達後にのみ打ち切りできます');
	}

	const remainingRubbers = rubberRows.filter((rubber) => !isTerminalRubberStatus(rubber.status));
	if (remainingRubbers.length === 0) {
		throw new Error('打ち切りできる残りの種目がありません');
	}

	const affectedMatchIds: string[] = [];
	for (const rubber of remainingRubbers) {
		if (rubber.matchId) {
			affectedMatchIds.push(rubber.matchId);
			await cancelMatchRubber(rubber.matchId, now);
			continue;
		}

		await db
			.update(rubbers)
			.set({
				status: 'cancelled',
				winnerSide: null,
				updatedAt: now
			})
			.where(eq(rubbers.id, rubber.id));
	}

	await recalculateTieResult(tieId, now, db);
	return { affectedMatchIds };
}

export async function cancelMatchRubber(matchId: string, now = new Date().toISOString()) {
	const db = await getRequestDbOrThrow();
	const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
	if (!match?.rubberId) throw new Error('この試合は種目と紐づいていません');

	const rubber = await db.query.rubbers.findFirst({ where: eq(rubbers.id, match.rubberId) });
	if (!rubber) throw new Error('種目が見つかりません');
	if (isTerminalRubberStatus(rubber.status)) {
		throw new Error('すでに終了している種目は打ち切りできません');
	}

	const snapshot = await db.query.matchSnapshots.findFirst({
		where: eq(matchSnapshots.matchId, matchId)
	});
	let nextSeqNo = 0;
	let stateJson = '{}';

	if (snapshot) {
		const state = applyMatchCancellation(
			v.parse(MatchStateSchema, JSON.parse(snapshot.stateJson)),
			now
		);
		nextSeqNo = state.lastSeqNo;
		stateJson = JSON.stringify(state);
	}

	const ops: ReturnType<typeof db.batch>[0] = [
		db.update(matches).set({ status: 'cancelled', updatedAt: now }).where(eq(matches.id, matchId)),
		db
			.update(rubbers)
			.set({ status: 'cancelled', updatedAt: now })
			.where(eq(rubbers.id, match.rubberId))
	];

	if (snapshot) {
		ops.push(
			db
				.update(matchSnapshots)
				.set({
					stateJson,
					seqNo: nextSeqNo,
					updatedAt: now
				})
				.where(eq(matchSnapshots.matchId, matchId))
		);
	}

	await db.batch(ops);
	await recalculateTieResult(rubber.tieId, now);
}

export async function confirmTie(tieId: string, now = new Date().toISOString()) {
	const db = await getRequestDbOrThrow();
	await recalculateTieResult(tieId, now);
	await db.update(ties).set({ status: 'confirmed', updatedAt: now }).where(eq(ties.id, tieId));
}

async function getLineupPlayersForRubber(tieId: string, side: 'A' | 'B', rubberCode: string) {
	const db = await getRequestDbOrThrow();
	const submission = await db.query.lineupSubmissions.findFirst({
		where: and(eq(lineupSubmissions.tieId, tieId), eq(lineupSubmissions.side, side))
	});
	if (!submission || submission.status !== 'revealed') {
		throw new Error(`${side}側のオーダーが公開されていません`);
	}
	const item = await db.query.lineupItems.findFirst({
		where: and(
			eq(lineupItems.submissionId, submission.id),
			eq(lineupItems.rubberCode, rubberCode as never)
		)
	});
	const players = item
		? await db
				.select()
				.from(teamPlayers)
				.where(inArray(teamPlayers.id, [item.player1Id, item.player2Id]))
		: [];
	const playerById = new Map(players.map((player) => [player.id, player]));
	const [player1, player2] = resolveRubberLineupPlayers({
		rubberCode,
		lineup: item,
		player1: item ? playerById.get(item.player1Id) : undefined,
		player2: item ? playerById.get(item.player2Id) : undefined
	});
	const team = await db.query.teams.findFirst({ where: eq(teams.id, submission.teamId) });
	const teamName = team?.name ?? null;
	return [player1, player2].map((player) => ({ ...player, teamName }));
}

async function getRequestDbOrThrow(dbParam?: RequestDb): Promise<RequestDb> {
	if (dbParam) return dbParam;
	return getRequestDb();
}
