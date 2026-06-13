import { describe, expect, test } from 'vitest';
import { createPublicRubberSummaries } from './liveBoardService';

const rubber = {
	id: 'rubber-1',
	code: 'WD1' as const,
	matchId: 'match-1',
	status: 'ready' as const
};

const match = {
	id: 'match-1',
	gamesWonA: 1,
	gamesWonB: 0,
	currentScoreA: 15,
	currentScoreB: 12,
	currentGameNo: 2,
	status: 'playing' as const
};

const gameScores = [{ matchId: 'match-1', gameNo: 1, scoreA: 21, scoreB: 15 }];

const submissions = [
	{ id: 'submission-a', side: 'A' as const },
	{ id: 'submission-b', side: 'B' as const }
];

const items = [
	{
		submissionId: 'submission-a',
		rubberCode: 'WD1' as const,
		player1Id: 'a1',
		player2Id: 'a2'
	},
	{
		submissionId: 'submission-b',
		rubberCode: 'WD1' as const,
		player1Id: 'b1',
		player2Id: 'b2'
	}
];

const players = [
	{ id: 'a1', name: 'A One' },
	{ id: 'a2', name: 'A Two' },
	{ id: 'b1', name: 'B One' },
	{ id: 'b2', name: 'B Two' }
];

describe('createPublicRubberSummaries', () => {
	test('hides lineup names before tie lineups are revealed', () => {
		const summaries = createPublicRubberSummaries({
			rubbers: [rubber],
			matches: [match],
			gameScores,
			revealed: false,
			submissions,
			items,
			players
		});

		expect(summaries[0]).toMatchObject({
			gamesScore: '1-0',
			pointScore: '15-12',
			status: 'playing',
			gameDetails: [
				{ gameNo: 1, scoreA: 21, scoreB: 15 },
				{ gameNo: 2, scoreA: 15, scoreB: 12 }
			],
			sideAPlayers: null,
			sideBPlayers: null
		});
	});

	test('shows lineup names after tie lineups are revealed', () => {
		const summaries = createPublicRubberSummaries({
			rubbers: [rubber],
			matches: [match],
			gameScores,
			revealed: true,
			submissions,
			items,
			players
		});

		expect(summaries[0]).toMatchObject({
			gamesScore: '1-0',
			pointScore: '15-12',
			sideAPlayers: 'A One / A Two',
			sideBPlayers: 'B One / B Two'
		});
	});

	test('treats forfeited and retired matches as finished public rubber results', () => {
		const summaries = createPublicRubberSummaries({
			rubbers: [rubber, { ...rubber, id: 'rubber-2', matchId: 'match-2' }],
			matches: [
				{
					...match,
					status: 'forfeited' as const,
					gamesWonA: 0,
					gamesWonB: 0,
					currentScoreA: 0,
					currentScoreB: 0
				},
				{
					...match,
					id: 'match-2',
					status: 'retired' as const,
					gamesWonA: 1,
					gamesWonB: 0
				}
			],
			gameScores: [],
			revealed: false,
			submissions,
			items,
			players
		});

		expect(summaries.map((summary) => summary.status)).toEqual(['finished', 'finished']);
		expect(summaries.map((summary) => summary.matchStatus)).toEqual(['forfeited', 'retired']);
		expect(summaries[0]).toMatchObject({ gamesScore: '0-0', pointScore: '0-0' });
		expect(summaries[1]).toMatchObject({ gamesScore: '1-0', pointScore: '15-12' });
	});
});
