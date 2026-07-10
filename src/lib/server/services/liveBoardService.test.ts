import { describe, expect, test } from 'vitest';
import { createPublicRubberSummaries } from './liveBoardService';

const rubber = {
	id: 'rubber-1',
	code: 'WD1' as const,
	matchId: 'match-1',
	status: 'ready' as const,
	winnerSide: null
};

const match = {
	id: 'match-1',
	gamesWonA: 1,
	gamesWonB: 0,
	currentScoreA: 15,
	currentScoreB: 12,
	currentGameNo: 2,
	status: 'playing' as const,
	lastSeqNo: 3,
	refereeName: null
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
		expect(summaries[0].lastSeqNo).toBe(3);
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

	test('rubber with no associated match has null scores and keeps its own status', () => {
		const summaries = createPublicRubberSummaries({
			rubbers: [{ ...rubber, matchId: null }],
			matches: [],
			gameScores: [],
			revealed: false,
			submissions: [],
			items: [],
			players: []
		});

		expect(summaries[0]).toMatchObject({
			matchStatus: null,
			status: 'ready',
			gamesScore: null,
			pointScore: null,
			gameDetails: []
		});
	});

	test('match in scheduled status produces empty gameDetails for game 1', () => {
		const scheduledMatch = {
			id: 'match-s',
			gamesWonA: 0,
			gamesWonB: 0,
			currentScoreA: 0,
			currentScoreB: 0,
			currentGameNo: 1,
			status: 'scheduled' as const,
			lastSeqNo: 0,
			refereeName: null
		};
		const summaries = createPublicRubberSummaries({
			rubbers: [{ ...rubber, matchId: 'match-s' }],
			matches: [scheduledMatch],
			gameScores: [],
			revealed: false,
			submissions: [],
			items: [],
			players: []
		});

		expect(summaries[0]).toMatchObject({
			status: 'scheduled',
			gamesScore: '0-0',
			pointScore: '0-0',
			gameDetails: []
		});
	});

	test('confirmed match sets rubber status to confirmed', () => {
		const confirmedMatch = { ...match, id: 'match-c', status: 'confirmed' as const };
		const summaries = createPublicRubberSummaries({
			rubbers: [{ ...rubber, matchId: 'match-c' }],
			matches: [confirmedMatch],
			gameScores,
			revealed: false,
			submissions: [],
			items: [],
			players: []
		});

		expect(summaries[0].status).toBe('confirmed');
	});

	test('suspended match is shown as playing rubber', () => {
		const suspendedMatch = { ...match, id: 'match-sp', status: 'suspended' as const };
		const summaries = createPublicRubberSummaries({
			rubbers: [{ ...rubber, matchId: 'match-sp' }],
			matches: [suspendedMatch],
			gameScores: [],
			revealed: false,
			submissions: [],
			items: [],
			players: []
		});

		expect(summaries[0].status).toBe('playing');
	});

	test('cancelled match rubber shows cancelled status', () => {
		const cancelledMatch = {
			...match,
			id: 'match-cx',
			status: 'cancelled' as const
		};
		const summaries = createPublicRubberSummaries({
			rubbers: [{ ...rubber, matchId: 'match-cx' }],
			matches: [cancelledMatch],
			gameScores: [],
			revealed: false,
			submissions: [],
			items: [],
			players: []
		});

		expect(summaries[0].status).toBe('cancelled');
	});

	test('revealed=true but no submission for a side returns null players for that side', () => {
		const summaries = createPublicRubberSummaries({
			rubbers: [rubber],
			matches: [match],
			gameScores,
			revealed: true,
			submissions: [{ id: 'submission-a', side: 'A' as const }],
			items: [
				{
					submissionId: 'submission-a',
					rubberCode: 'WD1' as const,
					player1Id: 'a1',
					player2Id: 'a2'
				}
			],
			players: [
				{ id: 'a1', name: 'A One' },
				{ id: 'a2', name: 'A Two' }
			]
		});

		expect(summaries[0].sideAPlayers).toBe('A One / A Two');
		expect(summaries[0].sideBPlayers).toBeNull();
	});

	test('single player lineup renders only one name without separator', () => {
		const singleItems = [
			{ submissionId: 'submission-a', rubberCode: 'WD1' as const, player1Id: 'a1', player2Id: '' }
		];
		const summaries = createPublicRubberSummaries({
			rubbers: [rubber],
			matches: [match],
			gameScores,
			revealed: true,
			submissions,
			items: singleItems,
			players: [{ id: 'a1', name: 'Solo Player' }]
		});

		expect(summaries[0].sideAPlayers).toBe('Solo Player');
	});

	test('lineup item for a different rubber code does not leak into another rubber', () => {
		const twoRubbers = [rubber, { ...rubber, id: 'rubber-2', code: 'MD1' as const }];
		const summaries = createPublicRubberSummaries({
			rubbers: twoRubbers,
			matches: [match],
			gameScores,
			revealed: true,
			submissions,
			items: [
				{
					submissionId: 'submission-a',
					rubberCode: 'WD1' as const,
					player1Id: 'a1',
					player2Id: 'a2'
				}
			],
			players
		});

		expect(summaries[0].sideAPlayers).toBe('A One / A Two');
		expect(summaries[1].sideAPlayers).toBeNull();
	});

	test('finished match uses eventScores for final game when available', () => {
		const finishedMatch = {
			...match,
			id: 'match-f',
			gamesWonA: 1,
			gamesWonB: 1,
			currentGameNo: 2,
			currentScoreA: 21,
			currentScoreB: 18,
			status: 'finished' as const
		};
		const eventGameScores = [
			{ matchId: 'match-f', gameNo: 1, scoreA: 21, scoreB: 15 },
			{ matchId: 'match-f', gameNo: 2, scoreA: 21, scoreB: 18 }
		];
		const summaries = createPublicRubberSummaries({
			rubbers: [{ ...rubber, matchId: 'match-f' }],
			matches: [finishedMatch],
			gameScores: eventGameScores,
			revealed: false,
			submissions: [],
			items: [],
			players: []
		});

		expect(summaries[0].gameDetails).toEqual([
			{ gameNo: 1, scoreA: 21, scoreB: 15, winnerSide: 'A' },
			{ gameNo: 2, scoreA: 21, scoreB: 18, winnerSide: 'A' }
		]);
	});

	test('finished match falls back to matches table when final event score is missing', () => {
		const finishedMatch = {
			...match,
			id: 'match-fallback',
			gamesWonA: 2,
			gamesWonB: 1,
			currentGameNo: 3,
			currentScoreA: 21,
			currentScoreB: 19,
			status: 'finished' as const
		};
		const summaries = createPublicRubberSummaries({
			rubbers: [{ ...rubber, matchId: 'match-fallback' }],
			matches: [finishedMatch],
			gameScores: [
				{ matchId: 'match-fallback', gameNo: 1, scoreA: 19, scoreB: 21 },
				{ matchId: 'match-fallback', gameNo: 2, scoreA: 21, scoreB: 16 }
			],
			revealed: false,
			submissions: [],
			items: [],
			players: []
		});

		expect(summaries[0].gameDetails).toEqual([
			{ gameNo: 1, scoreA: 19, scoreB: 21, winnerSide: 'B' },
			{ gameNo: 2, scoreA: 21, scoreB: 16, winnerSide: 'A' },
			{ gameNo: 3, scoreA: 21, scoreB: 19, winnerSide: 'A' }
		]);
	});

	test('warmup match is shown as scheduled rubber', () => {
		const warmupMatch = { ...match, id: 'match-warmup', status: 'warmup' as const };
		const summaries = createPublicRubberSummaries({
			rubbers: [{ ...rubber, matchId: 'match-warmup' }],
			matches: [warmupMatch],
			gameScores: [],
			revealed: false,
			submissions: [],
			items: [],
			players: []
		});

		expect(summaries[0].status).toBe('scheduled');
		expect(summaries[0].gameDetails).toEqual([]);
	});

	test('unknown match status keeps current rubber status', () => {
		const unknownStatusMatch = {
			...match,
			id: 'match-unknown',
			status: 'mystery' as typeof match.status
		};
		const summaries = createPublicRubberSummaries({
			rubbers: [{ ...rubber, status: 'ready' as const, matchId: 'match-unknown' }],
			matches: [unknownStatusMatch],
			gameScores: [],
			revealed: false,
			submissions: [],
			items: [],
			players: []
		});

		expect(summaries[0].status).toBe('ready');
		expect(summaries[0].matchStatus).toBe('mystery');
	});
});
