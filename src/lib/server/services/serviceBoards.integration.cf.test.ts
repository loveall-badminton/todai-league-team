/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createCfTestDb, type CfTestDb } from '$lib/server/cfTestDb';
import {
	lineupItems,
	lineupSubmissions,
	appSettings,
	matches,
	rankingTiebreakers,
	rubbers,
	matchSnapshots,
	teamPlayers,
	teams,
	ties,
	tournaments
} from '$lib/server/db/schema';

const mockState = vi.hoisted(() => ({
	db: null as CfTestDb['db'] | null
}));

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: () => {
		if (!mockState.db) throw new Error('test db is not initialized');
		return mockState.db;
	}
}));

import { generateFinalAndThirdPlace, generateSemifinalsAndFifthPlace } from './finalsService';
import { getPublicRubbers } from './liveBoardService';
import { createRankingTiebreaker, syncRankingTiebreakerResult } from './rankingTiebreakerService';
import { createTieWithRubbers } from './tieService';
import { ensureDefaultSettings, resetTournamentEnsured } from './tokyoLeagueSetupService';

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
		{ id: 'a1', name: 'A1', groupCode: 'A', displayOrder: 1, createdAt: now, updatedAt: now },
		{ id: 'a2', name: 'A2', groupCode: 'A', displayOrder: 2, createdAt: now, updatedAt: now },
		{ id: 'a3', name: 'A3', groupCode: 'A', displayOrder: 3, createdAt: now, updatedAt: now },
		{ id: 'b1', name: 'B1', groupCode: 'B', displayOrder: 1, createdAt: now, updatedAt: now },
		{ id: 'b2', name: 'B2', groupCode: 'B', displayOrder: 2, createdAt: now, updatedAt: now },
		{ id: 'b3', name: 'B3', groupCode: 'B', displayOrder: 3, createdAt: now, updatedAt: now }
	]);
	await cfTestDb.db.insert(teamPlayers).values([
		{ id: 'a1-p1', teamId: 'a1', name: 'A1 P1', gender: 'female', createdAt: now, updatedAt: now },
		{ id: 'a1-p2', teamId: 'a1', name: 'A1 P2', gender: 'female', createdAt: now, updatedAt: now },
		{ id: 'b1-p1', teamId: 'b1', name: 'B1 P1', gender: 'female', createdAt: now, updatedAt: now },
		{ id: 'b1-p2', teamId: 'b1', name: 'B1 P2', gender: 'female', createdAt: now, updatedAt: now },
		{ id: 'b2-p1', teamId: 'b2', name: 'B2 P1', gender: 'female', createdAt: now, updatedAt: now },
		{ id: 'b2-p2', teamId: 'b2', name: 'B2 P2', gender: 'female', createdAt: now, updatedAt: now }
	]);
}

async function seedFinishedGroupTie(params: {
	id: string;
	tieCode: string;
	groupCode: 'A' | 'B';
	teamAId: string;
	teamBId: string;
	winnerTeamId: string;
	displayOrder: number;
}) {
	await cfTestDb.db.insert(ties).values({
		id: params.id,
		tieCode: params.tieCode,
		phase: params.groupCode === 'A' ? 'group_a' : 'group_b',
		groupCode: params.groupCode,
		teamAId: params.teamAId,
		teamBId: params.teamBId,
		status: 'finished',
		winnerTeamId: params.winnerTeamId,
		displayOrder: params.displayOrder,
		createdAt: now,
		updatedAt: now
	});
}

describe('finalsService DB generation', () => {
	test('generates semifinals and fifth-place ties from completed group standings', async () => {
		await seedTeams();
		await seedFinishedGroupTie({
			id: 'a-1',
			tieCode: 'A-1',
			groupCode: 'A',
			teamAId: 'a1',
			teamBId: 'a2',
			winnerTeamId: 'a1',
			displayOrder: 1
		});
		await seedFinishedGroupTie({
			id: 'a-2',
			tieCode: 'A-2',
			groupCode: 'A',
			teamAId: 'a1',
			teamBId: 'a3',
			winnerTeamId: 'a1',
			displayOrder: 2
		});
		await seedFinishedGroupTie({
			id: 'a-3',
			tieCode: 'A-3',
			groupCode: 'A',
			teamAId: 'a2',
			teamBId: 'a3',
			winnerTeamId: 'a2',
			displayOrder: 3
		});
		await seedFinishedGroupTie({
			id: 'b-1',
			tieCode: 'B-1',
			groupCode: 'B',
			teamAId: 'b1',
			teamBId: 'b2',
			winnerTeamId: 'b1',
			displayOrder: 1
		});
		await seedFinishedGroupTie({
			id: 'b-2',
			tieCode: 'B-2',
			groupCode: 'B',
			teamAId: 'b1',
			teamBId: 'b3',
			winnerTeamId: 'b1',
			displayOrder: 2
		});
		await seedFinishedGroupTie({
			id: 'b-3',
			tieCode: 'B-3',
			groupCode: 'B',
			teamAId: 'b2',
			teamBId: 'b3',
			winnerTeamId: 'b2',
			displayOrder: 3
		});

		const changed = await generateSemifinalsAndFifthPlace(now);
		const finalTies = await cfTestDb.db.select().from(ties).where(eq(ties.phase, 'semifinal'));
		const fifthPlace = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.tieCode, 'X-3') });
		const rubberRows = await cfTestDb.db
			.select()
			.from(rubbers)
			.where(eq(rubbers.tieId, finalTies[0].id));

		expect(changed).toBe(3);
		expect(finalTies.map((tie) => [tie.tieCode, tie.teamAId, tie.teamBId]).sort()).toEqual([
			['X-1', 'a1', 'b2'],
			['X-2', 'a2', 'b1']
		]);
		expect(fifthPlace).toMatchObject({ phase: 'fifth_place', teamAId: 'a3', teamBId: 'b3' });
		expect(rubberRows).toHaveLength(5);
	});

	test('generates final and third-place ties, and updates existing final ties', async () => {
		await seedTeams();
		await cfTestDb.db.insert(ties).values([
			{
				id: 'x-1-id',
				tieCode: 'X-1',
				phase: 'semifinal',
				roundLabel: '準決勝1',
				teamAId: 'a1',
				teamBId: 'b2',
				status: 'confirmed',
				winnerTeamId: 'a1',
				displayOrder: 1,
				createdAt: now,
				updatedAt: now
			},
			{
				id: 'x-2-id',
				tieCode: 'X-2',
				phase: 'semifinal',
				roundLabel: '準決勝2',
				teamAId: 'a2',
				teamBId: 'b1',
				status: 'finished',
				winnerTeamId: 'b1',
				displayOrder: 2,
				createdAt: now,
				updatedAt: now
			}
		]);
		await createTieWithRubbers({
			tieCode: 'X-5',
			phase: 'final',
			roundLabel: '古い決勝',
			teamAId: 'a3',
			teamBId: 'b3',
			scoringRuleId: 'KNOCKOUT_21',
			displayOrder: 99,
			now
		});

		const changed = await generateFinalAndThirdPlace(now);
		const thirdPlace = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.tieCode, 'X-4') });
		const final = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.tieCode, 'X-5') });

		expect(changed).toBe(2);
		expect(thirdPlace).toMatchObject({
			phase: 'third_place',
			roundLabel: '3位決定戦',
			teamAId: 'b2',
			teamBId: 'a2',
			displayOrder: 4
		});
		expect(final).toMatchObject({
			phase: 'final',
			roundLabel: '決勝',
			teamAId: 'a1',
			teamBId: 'b1',
			displayOrder: 5
		});
	});

	test('rejects final generation before semifinals exist', async () => {
		await seedTeams();
		await expect(generateFinalAndThirdPlace(now)).rejects.toThrow('準決勝を先に生成してください');
	});

	test('rejects finals generation when knockout scoring rule is not configured', async () => {
		await seedTeams();
		await cfTestDb.db
			.update(appSettings)
			.set({ knockoutScoringRuleId: null, updatedAt: now })
			.where(eq(appSettings.id, 'default'));

		await expect(generateSemifinalsAndFifthPlace(now)).rejects.toThrow(
			'決勝トーナメント得点ルールが未設定です'
		);
		await expect(generateFinalAndThirdPlace(now)).rejects.toThrow(
			'決勝トーナメント得点ルールが未設定です'
		);
	});
});

describe('liveBoardService DB boards', () => {
	test('reads public rubbers with revealed lineup names before match start', async () => {
		await seedTeams();
		await cfTestDb.db.insert(tournaments).values({
			id: 'tokyo-league-default',
			name: '東大リーグ団体戦',
			status: 'running',
			createdAt: now,
			updatedAt: now
		});
		await cfTestDb.db.insert(ties).values({
			id: 'tie-live',
			tieCode: 'LIVE-1',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'a1',
			teamBId: 'b2',
			status: 'lineup_submitted',
			lineupsRevealedAt: now,
			displayOrder: 1,
			createdAt: now,
			updatedAt: now
		});
		await cfTestDb.db.insert(matches).values({
			id: 'match-live',
			tournamentId: 'tokyo-league-default',
			discipline: 'WD',
			status: 'finished',
			currentGameNo: 1,
			currentScoreA: 21,
			currentScoreB: 19,
			gamesWonA: 1,
			gamesWonB: 0,
			createdAt: now,
			updatedAt: now
		});
		await cfTestDb.db.insert(rubbers).values({
			id: 'rubber-live',
			tieId: 'tie-live',
			code: 'WD1',
			discipline: 'WD',
			displayOrder: 1,
			scoringRuleId: 'GROUP_15',
			matchId: 'match-live',
			status: 'playing',
			createdAt: now,
			updatedAt: now
		});
		await cfTestDb.db.insert(lineupSubmissions).values([
			{
				id: 'lineup-a',
				tieId: 'tie-live',
				teamId: 'a1',
				side: 'A',
				status: 'revealed',
				createdAt: now,
				updatedAt: now
			},
			{
				id: 'lineup-b',
				tieId: 'tie-live',
				teamId: 'b2',
				side: 'B',
				status: 'revealed',
				createdAt: now,
				updatedAt: now
			}
		]);
		await cfTestDb.db.insert(lineupItems).values([
			{
				id: 'item-a',
				submissionId: 'lineup-a',
				rubberCode: 'WD1',
				player1Id: 'a1-p1',
				player2Id: 'a1-p2',
				createdAt: now,
				updatedAt: now
			},
			{
				id: 'item-b',
				submissionId: 'lineup-b',
				rubberCode: 'WD1',
				player1Id: 'b2-p1',
				player2Id: 'b2-p2',
				createdAt: now,
				updatedAt: now
			}
		]);
		await cfTestDb.db.insert(matchSnapshots).values({
			matchId: 'match-live',
			seqNo: 10,
			stateJson: JSON.stringify({
				schemaVersion: 1,
				matchId: 'match-live',
				tournamentId: 'tokyo-league-default',
				courtId: null,
				discipline: 'WD',
				status: 'finished',
				scoring: {
					maxGames: 3,
					gamesToWin: 2,
					pointsToWin: 21,
					winBy: 2,
					maxPoints: 30,
					midGameIntervalPoint: 11
				},
				currentGameNo: 1,
				games: [
					{
						gameNo: 1,
						score: { A: 21, B: 19 },
						winnerSide: 'A',
						midGameIntervalTaken: true,
						changeEndsRequired: false,
						changeEndsCompleted: false
					}
				],
				gamesWon: { A: 1, B: 0 },
				winnerSide: 'A',
				terminalReason: 'normal',
				service: null,
				lastSeqNo: 10,
				createdAt: now,
				updatedAt: now
			}),
			updatedAt: now
		});

		const rubbersForTie = await getPublicRubbers('tie-live');

		expect(rubbersForTie[0]).toMatchObject({
			sideAPlayers: 'A1 P1 / A1 P2',
			sideBPlayers: 'B2 P1 / B2 P2',
			status: 'finished',
			gameDetails: [{ gameNo: 1, scoreA: 21, scoreB: 19 }]
		});
	});

	test('reads unrevealed public rubbers without lineup or match data', async () => {
		await expect(getPublicRubbers('missing')).resolves.toEqual([]);
		await seedTeams();
		await cfTestDb.db.insert(ties).values({
			id: 'tie-unrevealed',
			tieCode: 'HIDDEN-1',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'a1',
			teamBId: 'b1',
			status: 'lineup_pending',
			displayOrder: 1,
			createdAt: now,
			updatedAt: now
		});
		await cfTestDb.db.insert(rubbers).values({
			id: 'rubber-unrevealed',
			tieId: 'tie-unrevealed',
			code: 'WD1',
			discipline: 'WD',
			displayOrder: 1,
			scoringRuleId: 'GROUP_15',
			status: 'not_ready',
			createdAt: now,
			updatedAt: now
		});

		const publicRubbers = await getPublicRubbers('tie-unrevealed');

		expect(publicRubbers).toHaveLength(1);
		expect(publicRubbers[0]).toMatchObject({
			matchStatus: null,
			status: 'not_ready',
			gamesScore: null,
			sideAPlayers: null,
			sideBPlayers: null
		});
	});
});

describe('rankingTiebreakerService DB result sync', () => {
	test('syncs confirmed ranking tiebreaker result to the winning team', async () => {
		await seedTeams();
		const created = await createRankingTiebreaker({
			groupCode: 'A',
			reason: '同率1位',
			teamAId: 'a1',
			teamBId: 'b1',
			discipline: 'WD',
			playerA1Id: 'a1-p1',
			playerA2Id: 'a1-p2',
			playerB1Id: 'b1-p1',
			playerB2Id: 'b1-p2',
			now
		});
		await cfTestDb.db
			.update(matches)
			.set({ status: 'confirmed', winnerSide: 'B', updatedAt: now })
			.where(eq(matches.id, created.matchId));

		await syncRankingTiebreakerResult(created.matchId, now);

		const tiebreaker = await cfTestDb.db.query.rankingTiebreakers.findFirst({
			where: eq(rankingTiebreakers.id, created.rankingTiebreakerId)
		});
		expect(tiebreaker).toMatchObject({
			status: 'confirmed',
			winnerTeamId: 'b1'
		});
	});

	test('does not update ranking tiebreaker for non-result matches', async () => {
		await seedTeams();
		const created = await createRankingTiebreaker({
			groupCode: 'A',
			reason: '同率2位',
			teamAId: 'a1',
			teamBId: 'b1',
			discipline: 'WD',
			playerA1Id: 'a1-p1',
			playerA2Id: 'a1-p2',
			playerB1Id: 'b1-p1',
			playerB2Id: 'b1-p2',
			now
		});

		await syncRankingTiebreakerResult(created.matchId, now);

		const tiebreaker = await cfTestDb.db.query.rankingTiebreakers.findFirst({
			where: eq(rankingTiebreakers.id, created.rankingTiebreakerId)
		});
		expect(tiebreaker).toMatchObject({ status: 'scheduled', winnerTeamId: null });
	});

	test('rejects creation when tiebreaker scoring rule is not configured', async () => {
		await seedTeams();
		await cfTestDb.db
			.update(appSettings)
			.set({ tiebreakerScoringRuleId: null, updatedAt: now })
			.where(eq(appSettings.id, 'default'));

		await expect(
			createRankingTiebreaker({
				groupCode: 'A',
				reason: '同率3位',
				teamAId: 'a1',
				teamBId: 'b1',
				discipline: 'WD',
				playerA1Id: 'a1-p1',
				playerA2Id: 'a1-p2',
				playerB1Id: 'b1-p1',
				playerB2Id: 'b1-p2',
				now
			})
		).rejects.toThrow('順位決定再試合ルールが未設定です');
	});

	test('does not update ranking tiebreaker when winner exists but match status is not a result', async () => {
		await seedTeams();
		const created = await createRankingTiebreaker({
			groupCode: 'A',
			reason: '同率4位',
			teamAId: 'a1',
			teamBId: 'b1',
			discipline: 'WD',
			playerA1Id: 'a1-p1',
			playerA2Id: 'a1-p2',
			playerB1Id: 'b1-p1',
			playerB2Id: 'b1-p2',
			now
		});
		await cfTestDb.db
			.update(matches)
			.set({ status: 'scheduled', winnerSide: 'A', updatedAt: now })
			.where(eq(matches.id, created.matchId));

		await syncRankingTiebreakerResult(created.matchId, now);
		await expect(syncRankingTiebreakerResult('missing-match', now)).resolves.toBeUndefined();

		const tiebreaker = await cfTestDb.db.query.rankingTiebreakers.findFirst({
			where: eq(rankingTiebreakers.id, created.rankingTiebreakerId)
		});
		expect(tiebreaker).toMatchObject({ status: 'scheduled', winnerTeamId: null });
	});
});
