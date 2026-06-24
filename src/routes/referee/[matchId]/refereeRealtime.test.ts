import { describe, expect, test } from 'vitest';
import {
	DEFAULT_BWF_SCORING_CONFIG,
	type MatchState,
	type ScoreEventInput
} from '$lib/domain/types';
import { buildRealtimeScoreEvent, resolveRealtimeInput } from './refereeRealtime';

function createMatchState(overrides: Partial<MatchState> = {}): MatchState {
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
				score: { A: 1, B: 0 },
				winnerSide: null,
				midGameIntervalTaken: false,
				changeEndsRequired: false,
				changeEndsCompleted: false
			}
		],
		gamesWon: { A: 0, B: 0 },
		service: null,
		winnerSide: null,
		terminalReason: null,
		lastSeqNo: 3,
		createdAt: '2026-06-20T08:00:00.000Z',
		updatedAt: '2026-06-20T09:00:00.000Z',
		...overrides
	};
}

describe('resolveRealtimeInput', () => {
	test('fills in targetSeqNo for undo before applyMatchAction and notifications use it', () => {
		const input: ScoreEventInput = {
			type: 'undo',
			idempotencyKey: 'undo-1',
			observedSeqNo: 3,
			reason: 'fix'
		};

		const resolved = resolveRealtimeInput(input, 3);

		expect(resolved).toMatchObject({
			type: 'undo',
			targetSeqNo: 3,
			observedSeqNo: 3
		});

		const scoreEvent = buildRealtimeScoreEvent(
			resolved,
			createMatchState(),
			createMatchState({ lastSeqNo: 4 })
		);

		expect(scoreEvent).toMatchObject({
			type: 'undo_applied',
			seqNo: 4,
			targetSeqNo: 3
		});
	});

	test('does not override an explicit undo target', () => {
		const input: ScoreEventInput = {
			type: 'undo',
			idempotencyKey: 'undo-2',
			observedSeqNo: 5,
			targetSeqNo: 2
		};

		expect(resolveRealtimeInput(input, 4)).toBe(input);
	});
});
