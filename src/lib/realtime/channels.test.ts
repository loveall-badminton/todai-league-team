import { describe, expect, test } from 'vitest';
import { DEFAULT_BWF_SCORING_CONFIG, type MatchState } from '$lib/domain/types';
import {
	createLivePingMessage,
	createLivePongMessage,
	createLiveResyncMessage,
	createLiveUpdatedMessage,
	createResyncFailedMessage,
	filterSubscribedTopics,
	hasScoreUpdate,
	isLiveUpdatedMessage,
	isResyncFailedMessage,
	parseLiveMessage
} from './channels';

// @ts-expect-error score payload is not allowed when only schedule topic is declared
createLiveUpdatedMessage(['schedule'], { score: { state: createMatchState() } });

function createMatchState(): MatchState {
	return {
		schemaVersion: 1,
		matchId: 'match-1',
		tournamentId: 'tournament-1',
		courtId: null,
		discipline: 'MD',
		status: 'playing',
		scoring: DEFAULT_BWF_SCORING_CONFIG,
		currentGameNo: 1,
		games: [
			{
				gameNo: 1,
				score: { A: 3, B: 2 },
				winnerSide: null,
				midGameIntervalTaken: false,
				changeEndsRequired: false,
				changeEndsCompleted: false
			}
		],
		gamesWon: { A: 0, B: 0 },
		winnerSide: null,
		terminalReason: null,
		service: null,
		lastSeqNo: 5,
		createdAt: '2026-06-20T08:00:00.000Z',
		updatedAt: '2026-06-20T09:00:00.000Z'
	};
}

describe('realtime channel contracts', () => {
	test('parses a typed updated score message', () => {
		const raw = createLiveUpdatedMessage(['score'], {
			score: {
				state: createMatchState(),
				event: { type: 'rally_won', seqNo: 5, gameNo: 1, scoreA: 3, scoreB: 2 }
			}
		});

		const parsed = parseLiveMessage(raw);

		expect(parsed).not.toBeNull();
		expect(parsed && isLiveUpdatedMessage(parsed)).toBe(true);
		if (!parsed || !isLiveUpdatedMessage(parsed)) return;
		const data = parsed.data;
		expect(hasScoreUpdate(data)).toBe(true);
		if (!hasScoreUpdate(data)) return;
		expect(data.score.state.matchId).toBe('match-1');
	});

	test('rejects invalid score payloads', () => {
		const parsed = parseLiveMessage({
			type: 'updated',
			topics: ['score'],
			at: new Date().toISOString(),
			data: {
				score: { state: { matchId: 'missing-required-fields' } }
			}
		});

		expect(parsed).toBeNull();
	});

	test('filters subscribed topics and treats empty subscription as all topics', () => {
		expect(filterSubscribedTopics(['score', 'schedule'], ['score'])).toEqual(['score']);
		expect(filterSubscribedTopics(['score', 'schedule'], [])).toEqual(['score', 'schedule']);
	});

	test('parses typed standings/schedule/finals metadata payloads', () => {
		const parsed = parseLiveMessage(
			createLiveUpdatedMessage(['standings', 'schedule', 'finals'], {
				standings: { groupCodes: ['A'], tieIds: ['tie-1'] },
				schedule: {
					tieIds: ['tie-1'],
					phases: ['group_a'],
					scopes: ['tie_header'],
					ties: [
						{
							id: 'tie-1',
							tieCode: 'A-1',
							teamAId: 'team-a',
							teamBId: 'team-b',
							winnerTeamId: null,
							scheduledStartAt: null,
							lineupDueAt: null,
							teamAName: 'A',
							teamBName: 'B',
							status: 'finished',
							teamScoreA: 3,
							teamScoreB: 1,
							phase: 'group_a',
							updatedAt: '2026-07-08T07:00:00.000Z'
						}
					]
				},
				finals: { tieIds: ['X-1'], phases: ['final'] }
			})
		);

		expect(parsed && isLiveUpdatedMessage(parsed)).toBe(true);
		if (!parsed || !isLiveUpdatedMessage(parsed)) return;
		expect(parsed.data?.standings?.groupCodes).toEqual(['A']);
		expect(parsed.data?.schedule?.phases).toEqual(['group_a']);
		expect(parsed.data?.schedule?.scopes).toEqual(['tie_header']);
		expect(parsed.data?.schedule?.ties?.[0]?.teamScoreA).toBe(3);
		expect(parsed.data?.finals?.phases).toEqual(['final']);
	});

	test('round-trips ping/pong heartbeat messages', () => {
		const ping = parseLiveMessage(createLivePingMessage());
		const pong = parseLiveMessage(createLivePongMessage());

		expect(ping?.type).toBe('ping');
		expect(pong?.type).toBe('pong');
	});

	test('round-trips resync request/failure messages and carries seqNo on hello/updated', () => {
		const resync = parseLiveMessage(createLiveResyncMessage(5));
		expect(resync?.type).toBe('resync');
		if (resync?.type === 'resync') expect(resync.sinceSeqNo).toBe(5);

		const failed = parseLiveMessage(createResyncFailedMessage());
		expect(failed).not.toBeNull();
		expect(failed && isResyncFailedMessage(failed)).toBe(true);

		const hello = parseLiveMessage({ type: 'hello', at: new Date().toISOString(), seqNo: 3 });
		expect(hello?.type).toBe('hello');
		if (hello?.type === 'hello') expect(hello.seqNo).toBe(3);

		const updated = parseLiveMessage({
			...createLiveUpdatedMessage(['score']),
			seqNo: 7
		});
		expect(updated && isLiveUpdatedMessage(updated) && updated.seqNo).toBe(7);
	});

	test('rejects invalid topic metadata values', () => {
		const parsed = parseLiveMessage({
			type: 'updated',
			topics: ['standings'],
			at: new Date().toISOString(),
			data: {
				standings: { groupCodes: ['C'] }
			}
		});

		expect(parsed).toBeNull();
	});
});
