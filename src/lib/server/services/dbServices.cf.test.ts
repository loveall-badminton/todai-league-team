/// <reference types="@cloudflare/vitest-pool-workers/types" />

import type { RubberCode } from '$lib/domain/tokyoLeague';
import {
	lineupItems,
	lineupSubmissions,
	matches,
	matchSidePlayers,
	rankingTiebreakers,
	rubbers,
	teamPlayers,
	teams,
	ties,
	tournaments
} from '$lib/server/db/schema';
import { createCfTestDb, type CfTestDb } from '$lib/server/cfTestDb';
import { asc, eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
	db: null as CfTestDb['db'] | null
}));

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: () => {
		if (!mockState.db) throw new Error('test db is not initialized');
		return mockState.db;
	}
}));

import {
	buildRevealLineupsStatements,
	getLineupsForTie,
	getLineupItemsForTeam,
	lockLineup,
	saveLineupDraft,
	submitLineup,
	unlockLineup,
	validateLineup,
	validateLineupRules
} from './lineupService';
import { createRankingTiebreaker } from './rankingTiebreakerService';
import {
	confirmTie,
	createMatchFromRubber,
	cutoffTie,
	recalculateTieResult,
	startTie,
	syncRubberResultFromMatch,
	unstartTie
} from './tieOperationService';
import {
	createTieWithRubbers,
	ensureRubbersForTie,
	generateGroupRoundRobinTies
} from './tieService';
import { ensureDefaultSettings, resetTournamentEnsured } from './tokyoLeagueSetupService';

type RubberInsert = typeof rubbers.$inferInsert;

let cfTestDb: CfTestDb;
const now = '2026-06-15T01:00:00.000Z';

beforeAll(() => {
	cfTestDb = createCfTestDb(env.DB);
});

beforeEach(async () => {
	mockState.db = cfTestDb.db;
	await cfTestDb.reset();
	resetTournamentEnsured();
});

async function seedTeams() {
	await ensureDefaultSettings(now);
	await cfTestDb.db.insert(teams).values([
		{
			id: 'team-a',
			name: 'Team A',
			groupCode: 'A',
			displayOrder: 1,
			createdAt: now,
			updatedAt: now
		},
		{
			id: 'team-b',
			name: 'Team B',
			groupCode: 'A',
			displayOrder: 2,
			createdAt: now,
			updatedAt: now
		},
		{
			id: 'team-c',
			name: 'Team C',
			groupCode: 'A',
			displayOrder: 3,
			createdAt: now,
			updatedAt: now
		}
	]);
	const male = { gender: 'male' as const, createdAt: now, updatedAt: now };
	const female = { gender: 'female' as const, createdAt: now, updatedAt: now };
	await cfTestDb.db.insert(teamPlayers).values([
		{ id: 'a-m1', teamId: 'team-a', name: 'A 男1', ...male },
		{ id: 'a-m2', teamId: 'team-a', name: 'A 男2', ...male },
		{ id: 'a-m3', teamId: 'team-a', name: 'A 男3', ...male },
		{ id: 'a-m4', teamId: 'team-a', name: 'A 男4', ...male },
		{ id: 'a-m5', teamId: 'team-a', name: 'A 男5', ...male },
		{ id: 'a-m6', teamId: 'team-a', name: 'A 男6', ...male },
		{ id: 'a-m7', teamId: 'team-a', name: 'A 男7', ...male },
		{ id: 'a-f1', teamId: 'team-a', name: 'A 女1', ...female },
		{ id: 'a-f2', teamId: 'team-a', name: 'A 女2', ...female },
		{ id: 'a-f3', teamId: 'team-a', name: 'A 女3', ...female }
	]);
	await cfTestDb.db.insert(teamPlayers).values([
		{ id: 'b-m1', teamId: 'team-b', name: 'B 男1', ...male },
		{ id: 'b-m2', teamId: 'team-b', name: 'B 男2', ...male },
		{ id: 'b-m3', teamId: 'team-b', name: 'B 男3', ...male },
		{ id: 'b-m4', teamId: 'team-b', name: 'B 男4', ...male },
		{ id: 'b-m5', teamId: 'team-b', name: 'B 男5', ...male },
		{ id: 'b-m6', teamId: 'team-b', name: 'B 男6', ...male },
		{ id: 'b-m7', teamId: 'team-b', name: 'B 男7', ...male },
		{ id: 'b-f1', teamId: 'team-b', name: 'B 女1', ...female },
		{ id: 'b-f2', teamId: 'team-b', name: 'B 女2', ...female },
		{ id: 'b-f3', teamId: 'team-b', name: 'B 女3', ...female }
	]);
	await cfTestDb.db.insert(teamPlayers).values([
		{ id: 'c-m1', teamId: 'team-c', name: 'C 男1', ...male },
		{ id: 'c-m2', teamId: 'team-c', name: 'C 男2', ...male },
		{ id: 'c-m3', teamId: 'team-c', name: 'C 男3', ...male },
		{ id: 'c-m4', teamId: 'team-c', name: 'C 男4', ...male },
		{ id: 'c-m5', teamId: 'team-c', name: 'C 男5', ...male },
		{ id: 'c-m6', teamId: 'team-c', name: 'C 男6', ...male },
		{ id: 'c-m7', teamId: 'team-c', name: 'C 男7', ...male },
		{ id: 'c-f1', teamId: 'team-c', name: 'C 女1', ...female },
		{ id: 'c-f2', teamId: 'team-c', name: 'C 女2', ...female },
		{ id: 'c-f3', teamId: 'team-c', name: 'C 女3', ...female }
	]);
}

function completeLineup(prefix: 'a' | 'b' | 'c') {
	return [
		item('WD1', `${prefix}-f1`, `${prefix}-f2`),
		item('XD1', `${prefix}-m1`, `${prefix}-f3`),
		item('MD3', `${prefix}-m2`, `${prefix}-m3`),
		item('MD2', `${prefix}-m4`, `${prefix}-m5`),
		item('MD1', `${prefix}-m6`, `${prefix}-m7`)
	];
}

function item(rubberCode: RubberCode, player1Id: string, player2Id: string) {
	return { rubberCode, player1Id, player2Id };
}

async function seedTie(id = 'tie-1') {
	await cfTestDb.db.insert(ties).values({
		id,
		tieCode: id,
		phase: 'group_a',
		groupCode: 'A',
		teamAId: 'team-a',
		teamBId: 'team-b',
		status: 'lineup_pending',
		lineupDueAt: '2026-06-15T00:30:00.000Z',
		createdAt: now,
		updatedAt: now
	});
	return id;
}

async function seedSubmittedLineups(tieId: string) {
	await saveLineupDraft({ tieId, teamId: 'team-a', items: completeLineup('a'), now });
	await saveLineupDraft({ tieId, teamId: 'team-b', items: completeLineup('b'), now });
	await submitLineup({ tieId, teamId: 'team-a', now });
	await submitLineup({ tieId, teamId: 'team-b', now });
}

async function seedApprovedLineups(tieId: string) {
	await seedSubmittedLineups(tieId);
	await lockLineup({ tieId, teamId: 'team-a', now });
	await lockLineup({ tieId, teamId: 'team-b', now });
}

// startTie がオーダー公開を兼ねるため、公開単体の DB 挙動はここで直接検証する。
async function revealLineups(tieId: string, revealNow: string) {
	const submissions = await cfTestDb.db
		.select()
		.from(lineupSubmissions)
		.where(eq(lineupSubmissions.tieId, tieId));
	const statements = buildRevealLineupsStatements(cfTestDb.db, tieId, submissions, revealNow);
	await cfTestDb.db.batch(statements as unknown as Parameters<typeof cfTestDb.db.batch>[0]);
}

describe('lineupService DB flows', () => {
	test('validates, saves, submits, locks, unlocks and reveals lineups', async () => {
		await seedTeams();
		const tieId = await seedTie();

		const draftValidation = await saveLineupDraft({
			tieId,
			teamId: 'team-a',
			items: completeLineup('a'),
			now
		});
		expect(draftValidation.errors).toEqual([]);

		await submitLineup({ tieId, teamId: 'team-a', now });
		await saveLineupDraft({ tieId, teamId: 'team-b', items: completeLineup('b'), now });
		await submitLineup({ tieId, teamId: 'team-b', now });

		let tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, tieId) });
		expect(tie?.status).toBe('lineup_submitted');

		await lockLineup({ tieId, teamId: 'team-a', now });
		let submissionA = await cfTestDb.db.query.lineupSubmissions.findFirst({
			where: eq(lineupSubmissions.teamId, 'team-a')
		});
		expect(submissionA?.status).toBe('locked');

		await unlockLineup({ tieId, teamId: 'team-a', now });
		submissionA = await cfTestDb.db.query.lineupSubmissions.findFirst({
			where: eq(lineupSubmissions.teamId, 'team-a')
		});
		expect(submissionA?.status).toBe('submitted');

		await revealLineups(tieId, now);
		tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, tieId) });
		expect(tie).toMatchObject({ status: 'lineup_submitted', lineupsRevealedAt: now });

		const lineups = await getLineupsForTie(tieId);
		expect(lineups).toHaveLength(2);
		expect(lineups[0].items).toHaveLength(5);
	});

	test('reports validation errors without due-date warning', async () => {
		await seedTeams();
		const tieId = await seedTie();
		const validation = await validateLineup({
			tieId,
			teamId: 'team-a',
			items: [item('WD1', 'a-f1', 'a-f1'), item('XD1', 'b-m1', 'a-f1')],
			now
		});

		expect(validation.errors).toEqual(
			expect.arrayContaining([
				'女子ダブルス: 同一種目内で同じ選手は選べません',
				'男子ダブルス1: 未入力です',
				'チーム外の選手が含まれています'
			])
		);
		expect(validation.warnings).toEqual([]);
	});

	test('rejects editing a locked draft and revealing incomplete submissions', async () => {
		await seedTeams();
		const tieId = await seedTie();
		await saveLineupDraft({ tieId, teamId: 'team-a', items: completeLineup('a'), now });
		await submitLineup({ tieId, teamId: 'team-a', now });
		await lockLineup({ tieId, teamId: 'team-a', now });

		await expect(
			saveLineupDraft({ tieId, teamId: 'team-a', items: completeLineup('a'), now })
		).rejects.toThrow('提出済みまたは公開済みのオーダーは編集できません');

		await expect(revealLineups(tieId, now)).rejects.toThrow(
			'両チームのオーダーが提出されていません'
		);
	});

	test('errors on gender and duplicate-player violations without DB access', () => {
		const errors = validateLineupRules(
			[
				item('WD1', 'male-1', 'female-1'),
				item('XD1', 'female-1', 'female-2'),
				item('MD1', 'female-2', 'male-1')
			],
			[
				{ id: 'male-1', teamId: 'team-a', gender: 'male' },
				{ id: 'female-1', teamId: 'team-a', gender: 'female' },
				{ id: 'female-2', teamId: 'team-a', gender: 'female' }
			]
		);

		expect(errors).toEqual(
			expect.arrayContaining([
				'女子ダブルスに男性が含まれています',
				'ミックスダブルスが男女ペアではありません',
				'男子ダブルス1に女性が含まれています',
				'同一選手が複数種目に出場しています'
			])
		);
	});

	test('rejects missing ties, unassigned teams and submitting without a draft', async () => {
		await seedTeams();
		const tieId = await seedTie();

		await expect(
			saveLineupDraft({
				tieId,
				teamId: 'team-a',
				items: [item('WD1', 'a-f1', 'a-f1')],
				now
			})
		).rejects.toThrow('同一種目内で同じ選手は選べません');
		await expect(
			saveLineupDraft({ tieId: 'missing-tie', teamId: 'team-a', items: completeLineup('a'), now })
		).rejects.toThrow('Tie not found');
		await expect(
			saveLineupDraft({ tieId, teamId: 'team-c', items: completeLineup('c'), now })
		).rejects.toThrow('Team is not assigned to this tie');
		await expect(submitLineup({ tieId, teamId: 'team-a', now })).rejects.toThrow(
			'オーダー下書きがありません'
		);
	});

	test('updates an existing draft in place', async () => {
		await seedTeams();
		const tieId = await seedTie();
		await saveLineupDraft({ tieId, teamId: 'team-a', items: completeLineup('a'), now });
		await saveLineupDraft({
			tieId,
			teamId: 'team-a',
			items: [item('WD1', 'a-f2', 'a-f1'), ...completeLineup('a').slice(1)],
			now
		});

		const { submission, items } = await getLineupItemsForTeam(tieId, 'team-a');
		expect(submission).toMatchObject({ status: 'draft' });
		expect(items.find((row) => row.rubberCode === 'WD1')).toMatchObject({
			player1Id: 'a-f2',
			player2Id: 'a-f1'
		});
	});

	test('rejects revealing draft submissions and returns empty lineup items for missing submissions', async () => {
		await seedTeams();
		const tieId = await seedTie();
		await saveLineupDraft({ tieId, teamId: 'team-a', items: completeLineup('a'), now });
		await saveLineupDraft({ tieId, teamId: 'team-b', items: completeLineup('b'), now });

		await expect(revealLineups(tieId, now)).rejects.toThrow(
			'下書き状態のオーダーがあります。先に提出してください'
		);

		const missing = await getLineupItemsForTeam(tieId, 'team-c');
		expect(missing).toEqual({ submission: null, items: [] });
	});

	test('rejects submitting locked or revealed lineups', async () => {
		await seedTeams();
		const lockedTieId = await seedTie('tie-locked-submit');
		await saveLineupDraft({
			tieId: lockedTieId,
			teamId: 'team-a',
			items: completeLineup('a'),
			now
		});
		await submitLineup({ tieId: lockedTieId, teamId: 'team-a', now });
		await lockLineup({ tieId: lockedTieId, teamId: 'team-a', now });

		await expect(submitLineup({ tieId: lockedTieId, teamId: 'team-a', now })).rejects.toThrow(
			'ロック済みまたは公開済みのオーダーです'
		);

		const revealedTieId = await seedTie('tie-revealed-submit');
		await seedSubmittedLineups(revealedTieId);
		await revealLineups(revealedTieId, now);

		await expect(submitLineup({ tieId: revealedTieId, teamId: 'team-a', now })).rejects.toThrow(
			'ロック済みまたは公開済みのオーダーです'
		);
	});
});

describe('tieOperationService DB state transitions', () => {
	test('startTie reveals submitted lineups and moves tie/rubbers into play-ready state', async () => {
		await seedTeams();
		const tieId = await createTieWithRubbers({
			tieCode: 'T-1',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'team-a',
			teamBId: 'team-b',
			scoringRuleId: 'GROUP_15',
			now
		});
		await seedApprovedLineups(tieId);

		await startTie(tieId, { now });

		const tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, tieId) });
		const rubberRows = await cfTestDb.db.select().from(rubbers).where(eq(rubbers.tieId, tieId));
		expect(tie).toMatchObject({ status: 'playing', actualStartAt: now, lineupsRevealedAt: now });
		expect(rubberRows).toHaveLength(5);
		expect(rubberRows.every((rubber) => rubber.status === 'scheduled')).toBe(true);
		expect(rubberRows.every((rubber) => rubber.matchId)).toBe(true);
	});

	test('unstartTie reverses startTie back to lineup_submitted before any score is entered', async () => {
		await seedTeams();
		const tieId = await createTieWithRubbers({
			tieCode: 'T-101',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'team-a',
			teamBId: 'team-b',
			scoringRuleId: 'GROUP_15',
			now
		});
		await seedApprovedLineups(tieId);
		await startTie(tieId, { now });

		await unstartTie(tieId, now);

		const tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, tieId) });
		const rubberRows = await cfTestDb.db.select().from(rubbers).where(eq(rubbers.tieId, tieId));
		const submissions = await cfTestDb.db
			.select()
			.from(lineupSubmissions)
			.where(eq(lineupSubmissions.tieId, tieId));
		expect(tie).toMatchObject({
			status: 'lineup_submitted',
			lineupsRevealedAt: null,
			actualStartAt: null,
			teamScoreA: 0,
			teamScoreB: 0,
			winnerTeamId: null
		});
		expect(rubberRows).toHaveLength(5);
		expect(rubberRows.every((rubber) => rubber.status === 'not_ready' && !rubber.matchId)).toBe(
			true
		);
		expect(submissions.every((submission) => submission.status === 'locked')).toBe(true);

		const matchRows = await cfTestDb.db.select().from(matches);
		expect(matchRows).toHaveLength(0);
	});

	test('unstartTie rejects ties that are not playing or already have scores', async () => {
		await seedTeams();
		const tieId = await createTieWithRubbers({
			tieCode: 'T-102',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'team-a',
			teamBId: 'team-b',
			scoringRuleId: 'GROUP_15',
			now
		});
		await seedApprovedLineups(tieId);

		await expect(unstartTie(tieId, now)).rejects.toThrow('開始済みの対戦のみ取り消せます');

		await startTie(tieId, { now });
		const [rubber] = await cfTestDb.db.select().from(rubbers).where(eq(rubbers.tieId, tieId));
		await cfTestDb.db.update(rubbers).set({ status: 'playing' }).where(eq(rubbers.id, rubber.id));

		await expect(unstartTie(tieId, now)).rejects.toThrow(
			'スコアが入力された種目があるため開始を取り消せません'
		);
	});

	test('startTie rejects ties whose lineups are submitted but not approved', async () => {
		await seedTeams();
		const tieId = await createTieWithRubbers({
			tieCode: 'T-3',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'team-a',
			teamBId: 'team-b',
			scoringRuleId: 'GROUP_15',
			now
		});
		await seedSubmittedLineups(tieId);

		await expect(startTie(tieId, { now })).rejects.toThrow('両チームのオーダー承認が必要です');

		const tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, tieId) });
		expect(tie).toMatchObject({
			status: 'lineup_submitted',
			lineupsRevealedAt: null,
			actualStartAt: null
		});
	});

	test('startTie does not move tie into playing state when match creation fails', async () => {
		await seedTeams();
		const tieId = await createTieWithRubbers({
			tieCode: 'T-2',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'team-a',
			teamBId: 'team-b',
			scoringRuleId: 'GROUP_15',
			now
		});
		await seedApprovedLineups(tieId);

		const submissionA = await cfTestDb.db.query.lineupSubmissions.findFirst({
			where: eq(lineupSubmissions.tieId, tieId)
		});
		await cfTestDb.db.delete(lineupItems).where(eq(lineupItems.submissionId, submissionA!.id));

		await expect(startTie(tieId, { now })).rejects.toThrow();

		const tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, tieId) });
		const rubberRows = await cfTestDb.db.select().from(rubbers).where(eq(rubbers.tieId, tieId));
		expect(tie).toMatchObject({
			status: 'lineup_submitted',
			lineupsRevealedAt: null,
			actualStartAt: null
		});
		expect(rubberRows.every((rubber) => !rubber.matchId)).toBe(true);
		expect(rubberRows.every((rubber) => rubber.status !== 'playing')).toBe(true);
	});

	test('syncRubberResultFromMatch updates rubber result and recalculates tie score', async () => {
		await seedTeams();
		await cfTestDb.db.insert(ties).values({
			id: 'tie-result',
			tieCode: 'result',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'team-a',
			teamBId: 'team-b',
			status: 'playing',
			createdAt: now,
			updatedAt: now
		});
		await cfTestDb.db.insert(rubbers).values({
			id: 'rubber-result',
			tieId: 'tie-result',
			code: 'WD1',
			discipline: 'WD',
			displayOrder: 1,
			scoringRuleId: 'GROUP_15',
			status: 'playing',
			createdAt: now,
			updatedAt: now
		});
		await cfTestDb.db.insert(tournaments).values({
			id: 'tokyo-league-default',
			name: '東大リーグ団体戦',
			status: 'running',
			createdAt: now,
			updatedAt: now
		});
		await cfTestDb.db.insert(matches).values({
			id: 'match-result',
			tournamentId: 'tokyo-league-default',
			discipline: 'WD',
			rubberId: 'rubber-result',
			status: 'finished',
			winnerSide: 'B',
			createdAt: now,
			updatedAt: now
		});
		await cfTestDb.db
			.update(rubbers)
			.set({ matchId: 'match-result' })
			.where(eq(rubbers.id, 'rubber-result'));

		await syncRubberResultFromMatch('match-result', now);

		const rubber = await cfTestDb.db.query.rubbers.findFirst({
			where: eq(rubbers.id, 'rubber-result')
		});
		const tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, 'tie-result') });
		expect(rubber).toMatchObject({ status: 'finished', winnerSide: 'B' });
		expect(tie).toMatchObject({
			teamScoreA: 0,
			teamScoreB: 1,
			winnerTeamId: null,
			status: 'playing'
		});
	});

	test('recalculateTieResult finishes all-done ties and confirmTie confirms them', async () => {
		await seedTeams();
		await cfTestDb.db.insert(ties).values({
			id: 'tie-complete',
			tieCode: 'complete',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'team-a',
			teamBId: 'team-b',
			status: 'playing',
			createdAt: now,
			updatedAt: now
		});
		const rubberRows: RubberInsert[] = (['WD1', 'XD1', 'MD3', 'MD2', 'MD1'] as const).map(
			(code, index) => {
				const discipline = code === 'WD1' ? 'WD' : code === 'XD1' ? 'XD' : 'MD';
				const winnerSide = index < 3 ? 'A' : 'B';
				return {
					id: `complete-${code}`,
					tieId: 'tie-complete',
					code,
					discipline,
					displayOrder: index + 1,
					scoringRuleId: 'GROUP_15',
					status: 'finished' as const,
					winnerSide,
					createdAt: now,
					updatedAt: now
				};
			}
		);
		await cfTestDb.db.insert(rubbers).values(rubberRows);

		await recalculateTieResult('tie-complete', now);
		let tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, 'tie-complete') });
		expect(tie).toMatchObject({
			teamScoreA: 3,
			teamScoreB: 2,
			winnerTeamId: 'team-a',
			status: 'finished',
			actualEndAt: now
		});

		await confirmTie('tie-complete', now);
		tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, 'tie-complete') });
		expect(tie?.status).toBe('confirmed');
	});

	test('recalculateTieResult finishes a tie as soon as three rubbers are won, without waiting for the rest', async () => {
		await seedTeams();
		await cfTestDb.db.insert(ties).values({
			id: 'tie-early-decision',
			tieCode: 'early-decision',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'team-a',
			teamBId: 'team-b',
			status: 'playing',
			createdAt: now,
			updatedAt: now
		});
		const rubberRows: RubberInsert[] = (['WD1', 'XD1', 'MD3', 'MD2', 'MD1'] as const).map(
			(code, index) => {
				const discipline = code === 'WD1' ? 'WD' : code === 'XD1' ? 'XD' : 'MD';
				return {
					id: `early-${code}`,
					tieId: 'tie-early-decision',
					code,
					discipline,
					displayOrder: index + 1,
					scoringRuleId: 'GROUP_15',
					status: index < 3 ? ('finished' as const) : ('scheduled' as const),
					winnerSide: index < 3 ? ('A' as const) : null,
					createdAt: now,
					updatedAt: now
				};
			}
		);
		await cfTestDb.db.insert(rubbers).values(rubberRows);

		await recalculateTieResult('tie-early-decision', now);
		let tie = await cfTestDb.db.query.ties.findFirst({
			where: eq(ties.id, 'tie-early-decision')
		});
		expect(tie).toMatchObject({
			teamScoreA: 3,
			teamScoreB: 0,
			winnerTeamId: 'team-a',
			status: 'finished',
			actualEndAt: now
		});

		// 打ち切らずに残っている4戦目を開始すると、再び進行中の扱いに戻る
		await cfTestDb.db.update(rubbers).set({ status: 'playing' }).where(eq(rubbers.id, 'early-MD2'));
		await recalculateTieResult('tie-early-decision', '2026-06-15T02:00:00.000Z');
		tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, 'tie-early-decision') });
		expect(tie?.status).toBe('playing');

		// 4戦目が終わると、5戦目が未着手でも再び finished 扱いに戻る
		await cfTestDb.db
			.update(rubbers)
			.set({ status: 'finished', winnerSide: 'B' })
			.where(eq(rubbers.id, 'early-MD2'));
		await recalculateTieResult('tie-early-decision', '2026-06-15T03:00:00.000Z');
		tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, 'tie-early-decision') });
		expect(tie).toMatchObject({ status: 'finished', teamScoreA: 3, teamScoreB: 1 });
	});

	test('cutoffTie cancels all remaining rubbers after a team reaches three wins', async () => {
		await seedTeams();
		await cfTestDb.db.insert(ties).values({
			id: 'tie-cutoff',
			tieCode: 'cutoff',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'team-a',
			teamBId: 'team-b',
			status: 'playing',
			createdAt: now,
			updatedAt: now
		});
		const rubberRows: RubberInsert[] = (['WD1', 'XD1', 'MD3', 'MD2', 'MD1'] as const).map(
			(code, index) => {
				const discipline = code === 'WD1' ? 'WD' : code === 'XD1' ? 'XD' : 'MD';
				return {
					id: `cutoff-${code}`,
					tieId: 'tie-cutoff',
					code,
					discipline,
					displayOrder: index + 1,
					scoringRuleId: 'GROUP_15',
					status: index < 3 ? ('finished' as const) : ('scheduled' as const),
					winnerSide: index < 3 ? ('A' as const) : null,
					createdAt: now,
					updatedAt: now
				};
			}
		);
		await cfTestDb.db.insert(rubbers).values(rubberRows);

		const result = await cutoffTie('tie-cutoff', now);

		const tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, 'tie-cutoff') });
		const updatedRubbers = await cfTestDb.db
			.select()
			.from(rubbers)
			.where(eq(rubbers.tieId, 'tie-cutoff'))
			.orderBy(asc(rubbers.displayOrder));

		expect(result.affectedMatchIds).toEqual([]);
		expect(tie).toMatchObject({
			teamScoreA: 3,
			teamScoreB: 0,
			winnerTeamId: 'team-a',
			status: 'finished'
		});
		expect(updatedRubbers.slice(3).map((rubber) => rubber.status)).toEqual([
			'cancelled',
			'cancelled'
		]);
	});
});

describe('rankingTiebreakerService tied-ranking DB flow', () => {
	test('creates a ranking tiebreaker match for same-group tied teams', async () => {
		await seedTeams();
		const result = await createRankingTiebreaker({
			groupCode: 'A',
			reason: '1位同率',
			teamAId: 'team-a',
			teamBId: 'team-b',
			discipline: 'XD',
			playerA1Id: 'a-f1',
			playerA2Id: 'a-m1',
			playerB1Id: 'b-f1',
			playerB2Id: 'b-m1',
			now
		});

		const tiebreaker = await cfTestDb.db.query.rankingTiebreakers.findFirst({
			where: eq(rankingTiebreakers.id, result.rankingTiebreakerId)
		});
		const match = await cfTestDb.db.query.matches.findFirst({
			where: eq(matches.id, result.matchId)
		});
		const players = await cfTestDb.db
			.select()
			.from(matchSidePlayers)
			.where(eq(matchSidePlayers.matchId, result.matchId));

		expect(tiebreaker).toMatchObject({
			groupCode: 'A',
			reason: '1位同率',
			teamAId: 'team-a',
			teamBId: 'team-b',
			status: 'scheduled',
			matchId: result.matchId
		});
		expect(match).toMatchObject({
			discipline: 'XD',
			eventName: 'Aリーグ順位決定再試合',
			category: '1位同率',
			roundName: 'Team A vs Team B',
			rankingTiebreakerId: result.rankingTiebreakerId
		});
		expect(players.map((player) => [player.side, player.name, player.teamName])).toEqual([
			['A', 'A 女1', 'Team A'],
			['A', 'A 男1', 'Team A'],
			['B', 'B 女1', 'Team B'],
			['B', 'B 男1', 'Team B']
		]);
	});
});

describe('tieService creation/update/constraint DB flows', () => {
	test('creates a tie with five rubbers and inferred lineup due date', async () => {
		await seedTeams();
		const tieId = await createTieWithRubbers({
			tieCode: 'A-1',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'team-a',
			teamBId: 'team-b',
			scheduledStartAt: '2026-06-15T02:00:00.000Z',
			scoringRuleId: 'GROUP_15',
			displayOrder: 7,
			now
		});

		const tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, tieId) });
		const rubberRows = await cfTestDb.db.select().from(rubbers).where(eq(rubbers.tieId, tieId));

		expect(tie).toMatchObject({
			tieCode: 'A-1',
			status: 'lineup_pending',
			displayOrder: 7,
			lineupDueAt: '2026-06-15T01:50:00.000Z'
		});
		expect(rubberRows.map((rubber) => rubber.code)).toEqual(['WD1', 'XD1', 'MD3', 'MD2', 'MD1']);
	});

	test('rejects empty tie code', async () => {
		await seedTeams();

		await expect(
			createTieWithRubbers({
				tieCode: '   ',
				phase: 'group_a',
				groupCode: 'A',
				scoringRuleId: 'GROUP_15',
				now
			})
		).rejects.toThrow('tieCode is required');
	});

	test('ensureRubbersForTie restores missing rubbers without duplicating existing ones', async () => {
		await seedTeams();
		const tieId = await createTieWithRubbers({
			tieCode: 'A-2',
			phase: 'group_a',
			groupCode: 'A',
			scoringRuleId: 'GROUP_15',
			now
		});
		await cfTestDb.db.delete(rubbers).where(eq(rubbers.code, 'MD1'));

		await ensureRubbersForTie({ tieId, scoringRuleId: 'GROUP_15', now });
		await ensureRubbersForTie({ tieId, scoringRuleId: 'GROUP_15', now });

		const rubberRows = await cfTestDb.db.select().from(rubbers).where(eq(rubbers.tieId, tieId));
		expect(rubberRows).toHaveLength(5);
		expect(rubberRows.filter((rubber) => rubber.code === 'MD1')).toHaveLength(1);
	});

	test('generateGroupRoundRobinTies creates missing pairs and skips duplicates', async () => {
		await seedTeams();
		const created = await generateGroupRoundRobinTies({
			groupCode: 'A',
			scoringRuleId: 'GROUP_15',
			tieCodePrefix: 'A',
			now
		});
		const createdAgain = await generateGroupRoundRobinTies({
			groupCode: 'A',
			scoringRuleId: 'GROUP_15',
			tieCodePrefix: 'A',
			now
		});

		const tieRows = await cfTestDb.db.select().from(ties).where(eq(ties.groupCode, 'A'));
		expect(created).toBe(3);
		expect(createdAgain).toBe(0);
		expect(tieRows.map((tie) => tie.tieCode).sort()).toEqual(['A-1', 'A-2', 'A-3']);
	});

	test('createMatchFromRubber rejects unrevealed lineups, then creates and links a match after reveal', async () => {
		await seedTeams();
		const tieId = await createTieWithRubbers({
			tieCode: 'A-9',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'team-a',
			teamBId: 'team-b',
			scoringRuleId: 'GROUP_15',
			now
		});
		const [rubber] = await cfTestDb.db.select().from(rubbers).where(eq(rubbers.tieId, tieId));

		await expect(createMatchFromRubber(rubber.id, now)).rejects.toThrow(
			'オーダー公開後にmatchを作成できます'
		);

		await seedSubmittedLineups(tieId);
		await revealLineups(tieId, now);
		const matchId = await createMatchFromRubber(rubber.id, now);
		const linkedRubber = await cfTestDb.db.query.rubbers.findFirst({
			where: eq(rubbers.id, rubber.id)
		});
		const players = await cfTestDb.db
			.select()
			.from(matchSidePlayers)
			.where(eq(matchSidePlayers.matchId, matchId));

		expect(linkedRubber).toMatchObject({ matchId, status: 'scheduled' });
		expect(players).toHaveLength(4);
	});

	test('createMatchFromRubber rejects inconsistent revealed lineup records', async () => {
		await seedTeams();
		const tieId = await createTieWithRubbers({
			tieCode: 'A-10',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'team-a',
			teamBId: 'team-b',
			scoringRuleId: 'GROUP_15',
			now
		});
		const [rubber] = await cfTestDb.db.select().from(rubbers).where(eq(rubbers.tieId, tieId));
		await seedSubmittedLineups(tieId);
		await cfTestDb.db.update(ties).set({ lineupsRevealedAt: now }).where(eq(ties.id, tieId));

		await expect(createMatchFromRubber(rubber.id, now)).rejects.toThrow(
			'A側のオーダーが公開されていません'
		);

		await revealLineups(tieId, now);
		const lineups = await getLineupsForTie(tieId);
		await cfTestDb.db
			.delete(lineupItems)
			.where(eq(lineupItems.submissionId, lineups[0].submission.id));

		await expect(createMatchFromRubber(rubber.id, now)).rejects.toThrow(
			'WD1のオーダーがありません'
		);
	});
});
