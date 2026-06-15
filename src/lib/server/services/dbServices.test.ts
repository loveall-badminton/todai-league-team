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
import { createTestDb, type TestDb } from '$lib/server/testDb';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
	db: null as TestDb['db'] | null
}));

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: () => {
		if (!mockState.db) throw new Error('test db is not initialized');
		return mockState.db;
	}
}));

import {
	getLineupsForTie,
	getLineupItemsForTeam,
	lockLineup,
	revealLineups,
	saveLineupDraft,
	submitLineup,
	unlockLineup,
	unrevealLineups,
	validateLineup,
	validateLineupWarnings
} from './lineupService';
import { createRankingTiebreaker } from './rankingTiebreakerService';
import {
	confirmTie,
	createMatchFromRubber,
	recalculateTieResult,
	startTie,
	syncRubberResultFromMatch
} from './tieOperationService';
import {
	createTieWithRubbers,
	ensureRubbersForTie,
	generateGroupRoundRobinTies
} from './tieService';
import { ensureDefaultSettings } from './tokyoLeagueSetupService';

type RubberInsert = typeof rubbers.$inferInsert;

let testDb: TestDb;
const now = '2026-06-15T01:00:00.000Z';

beforeEach(() => {
	testDb = createTestDb();
	mockState.db = testDb.db;
});

afterEach(() => {
	mockState.db = null;
	testDb.close();
});

async function seedTeams() {
	await ensureDefaultSettings(now);
	await testDb.db.insert(teams).values([
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
	await testDb.db.insert(teamPlayers).values([
		{ id: 'a-m1', teamId: 'team-a', name: 'A 男1', gender: 'male', createdAt: now, updatedAt: now },
		{ id: 'a-m2', teamId: 'team-a', name: 'A 男2', gender: 'male', createdAt: now, updatedAt: now },
		{
			id: 'a-f1',
			teamId: 'team-a',
			name: 'A 女1',
			gender: 'female',
			createdAt: now,
			updatedAt: now
		},
		{
			id: 'a-f2',
			teamId: 'team-a',
			name: 'A 女2',
			gender: 'female',
			createdAt: now,
			updatedAt: now
		},
		{ id: 'b-m1', teamId: 'team-b', name: 'B 男1', gender: 'male', createdAt: now, updatedAt: now },
		{ id: 'b-m2', teamId: 'team-b', name: 'B 男2', gender: 'male', createdAt: now, updatedAt: now },
		{
			id: 'b-f1',
			teamId: 'team-b',
			name: 'B 女1',
			gender: 'female',
			createdAt: now,
			updatedAt: now
		},
		{
			id: 'b-f2',
			teamId: 'team-b',
			name: 'B 女2',
			gender: 'female',
			createdAt: now,
			updatedAt: now
		},
		{ id: 'c-m1', teamId: 'team-c', name: 'C 男1', gender: 'male', createdAt: now, updatedAt: now },
		{ id: 'c-m2', teamId: 'team-c', name: 'C 男2', gender: 'male', createdAt: now, updatedAt: now },
		{
			id: 'c-f1',
			teamId: 'team-c',
			name: 'C 女1',
			gender: 'female',
			createdAt: now,
			updatedAt: now
		},
		{
			id: 'c-f2',
			teamId: 'team-c',
			name: 'C 女2',
			gender: 'female',
			createdAt: now,
			updatedAt: now
		}
	]);
}

function completeLineup(prefix: 'a' | 'b' | 'c') {
	return [
		item('WD1', `${prefix}-f1`, `${prefix}-f2`),
		item('XD1', `${prefix}-m1`, `${prefix}-f1`),
		item('MD3', `${prefix}-m1`, `${prefix}-m2`),
		item('MD2', `${prefix}-m1`, `${prefix}-m2`),
		item('MD1', `${prefix}-m1`, `${prefix}-m2`)
	];
}

function item(rubberCode: RubberCode, player1Id: string, player2Id: string) {
	return { rubberCode, player1Id, player2Id };
}

async function seedTie(id = 'tie-1') {
	await testDb.db.insert(ties).values({
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

describe('lineupService DB flows', () => {
	test('validates, saves, submits, locks, unlocks, reveals and unreveals lineups', async () => {
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

		let tie = await testDb.db.query.ties.findFirst({ where: eq(ties.id, tieId) });
		expect(tie?.status).toBe('lineup_submitted');

		await lockLineup({ tieId, teamId: 'team-a', now });
		let submissionA = await testDb.db.query.lineupSubmissions.findFirst({
			where: eq(lineupSubmissions.teamId, 'team-a')
		});
		expect(submissionA?.status).toBe('locked');

		await unlockLineup({ tieId, teamId: 'team-a', now });
		submissionA = await testDb.db.query.lineupSubmissions.findFirst({
			where: eq(lineupSubmissions.teamId, 'team-a')
		});
		expect(submissionA?.status).toBe('submitted');

		await revealLineups(tieId, now);
		tie = await testDb.db.query.ties.findFirst({ where: eq(ties.id, tieId) });
		expect(tie).toMatchObject({ status: 'ready', lineupsRevealedAt: now });

		const lineups = await getLineupsForTie(tieId);
		expect(lineups).toHaveLength(2);
		expect(lineups[0].items).toHaveLength(5);

		await unrevealLineups(tieId, now);
		tie = await testDb.db.query.ties.findFirst({ where: eq(ties.id, tieId) });
		expect(tie).toMatchObject({ status: 'lineup_submitted', lineupsRevealedAt: null });
	});

	test('reports validation errors and due-date warning', async () => {
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
		expect(validation.warnings).toContain('提出期限を過ぎています');
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

	test('reports gender and duplicate-player warnings without DB access', () => {
		const warnings = validateLineupWarnings(
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

		expect(warnings).toEqual(
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
			tieCode: 'start',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'team-a',
			teamBId: 'team-b',
			scoringRuleId: 'GROUP_15',
			now
		});
		await seedSubmittedLineups(tieId);

		await startTie(tieId, { now });

		const tie = await testDb.db.query.ties.findFirst({ where: eq(ties.id, tieId) });
		const rubberRows = await testDb.db.select().from(rubbers).where(eq(rubbers.tieId, tieId));
		expect(tie).toMatchObject({ status: 'playing', actualStartAt: now, lineupsRevealedAt: now });
		expect(rubberRows).toHaveLength(5);
		expect(rubberRows.every((rubber) => rubber.status === 'scheduled')).toBe(true);
		expect(rubberRows.every((rubber) => rubber.matchId)).toBe(true);
	});

	test('syncRubberResultFromMatch updates rubber result and recalculates tie score', async () => {
		await seedTeams();
		await testDb.db.insert(ties).values({
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
		await testDb.db.insert(rubbers).values({
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
		await testDb.db.insert(tournaments).values({
			id: 'tokyo-league-default',
			name: '東大リーグ団体戦',
			status: 'running',
			createdAt: now,
			updatedAt: now
		});
		await testDb.db.insert(matches).values({
			id: 'match-result',
			tournamentId: 'tokyo-league-default',
			discipline: 'WD',
			rubberId: 'rubber-result',
			status: 'finished',
			winnerSide: 'B',
			createdAt: now,
			updatedAt: now
		});
		await testDb.db
			.update(rubbers)
			.set({ matchId: 'match-result' })
			.where(eq(rubbers.id, 'rubber-result'));

		await syncRubberResultFromMatch('match-result', now);

		const rubber = await testDb.db.query.rubbers.findFirst({
			where: eq(rubbers.id, 'rubber-result')
		});
		const tie = await testDb.db.query.ties.findFirst({ where: eq(ties.id, 'tie-result') });
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
		await testDb.db.insert(ties).values({
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
		await testDb.db.insert(rubbers).values(rubberRows);

		await recalculateTieResult('tie-complete', now);
		let tie = await testDb.db.query.ties.findFirst({ where: eq(ties.id, 'tie-complete') });
		expect(tie).toMatchObject({
			teamScoreA: 3,
			teamScoreB: 2,
			winnerTeamId: 'team-a',
			status: 'finished',
			actualEndAt: now
		});

		await confirmTie('tie-complete', now);
		tie = await testDb.db.query.ties.findFirst({ where: eq(ties.id, 'tie-complete') });
		expect(tie?.status).toBe('confirmed');
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
			playerAId: 'a-m1',
			playerBId: 'b-m1',
			now
		});

		const tiebreaker = await testDb.db.query.rankingTiebreakers.findFirst({
			where: eq(rankingTiebreakers.id, result.rankingTiebreakerId)
		});
		const match = await testDb.db.query.matches.findFirst({
			where: eq(matches.id, result.matchId)
		});
		const players = await testDb.db
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
			discipline: 'MS',
			eventName: 'Aリーグ順位決定再試合',
			category: '1位同率',
			roundName: 'Team A vs Team B',
			rankingTiebreakerId: result.rankingTiebreakerId
		});
		expect(players.map((player) => [player.side, player.name, player.teamName])).toEqual([
			['A', 'A 男1', 'Team A'],
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

		const tie = await testDb.db.query.ties.findFirst({ where: eq(ties.id, tieId) });
		const rubberRows = await testDb.db.select().from(rubbers).where(eq(rubbers.tieId, tieId));

		expect(tie).toMatchObject({
			tieCode: 'A-1',
			status: 'lineup_pending',
			displayOrder: 7,
			lineupDueAt: '2026-06-15T01:50:00.000Z'
		});
		expect(rubberRows.map((rubber) => rubber.code)).toEqual(['WD1', 'XD1', 'MD3', 'MD2', 'MD1']);
	});

	test('rejects duplicate or empty tie code', async () => {
		await seedTeams();
		await createTieWithRubbers({
			tieCode: 'A-1',
			phase: 'group_a',
			groupCode: 'A',
			scoringRuleId: 'GROUP_15',
			now
		});

		await expect(
			createTieWithRubbers({
				tieCode: 'A-1',
				phase: 'group_a',
				groupCode: 'A',
				scoringRuleId: 'GROUP_15',
				now
			})
		).rejects.toThrow('tieCode A-1 already exists');
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
		await testDb.db.delete(rubbers).where(eq(rubbers.code, 'MD1'));

		await ensureRubbersForTie({ tieId, scoringRuleId: 'GROUP_15', now });
		await ensureRubbersForTie({ tieId, scoringRuleId: 'GROUP_15', now });

		const rubberRows = await testDb.db.select().from(rubbers).where(eq(rubbers.tieId, tieId));
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

		const tieRows = await testDb.db.select().from(ties).where(eq(ties.groupCode, 'A'));
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
		const [rubber] = await testDb.db.select().from(rubbers).where(eq(rubbers.tieId, tieId));

		await expect(createMatchFromRubber(rubber.id, now)).rejects.toThrow(
			'オーダー公開後にmatchを作成できます'
		);

		await seedSubmittedLineups(tieId);
		await revealLineups(tieId, now);
		const matchId = await createMatchFromRubber(rubber.id, now);
		const linkedRubber = await testDb.db.query.rubbers.findFirst({
			where: eq(rubbers.id, rubber.id)
		});
		const players = await testDb.db
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
		const [rubber] = await testDb.db.select().from(rubbers).where(eq(rubbers.tieId, tieId));
		await seedSubmittedLineups(tieId);
		await testDb.db.update(ties).set({ lineupsRevealedAt: now }).where(eq(ties.id, tieId));

		await expect(createMatchFromRubber(rubber.id, now)).rejects.toThrow(
			'A側のオーダーが公開されていません'
		);

		await revealLineups(tieId, now);
		const lineups = await getLineupsForTie(tieId);
		await testDb.db
			.delete(lineupItems)
			.where(eq(lineupItems.submissionId, lineups[0].submission.id));

		await expect(createMatchFromRubber(rubber.id, now)).rejects.toThrow(
			'WD1のオーダーがありません'
		);
	});
});
