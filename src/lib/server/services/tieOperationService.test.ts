import { describe, expect, test } from 'vitest';
import { calculateTieResult, rubberStatusFromMatchResultStatus } from './tieOperationService';

describe('rubberStatusFromMatchResultStatus', () => {
	test('maps forfeit and retirement match results to finished rubbers', () => {
		expect(rubberStatusFromMatchResultStatus('finished')).toBe('finished');
		expect(rubberStatusFromMatchResultStatus('forfeited')).toBe('finished');
		expect(rubberStatusFromMatchResultStatus('retired')).toBe('finished');
		expect(rubberStatusFromMatchResultStatus('confirmed')).toBe('confirmed');
	});

	test('ignores non-result match statuses', () => {
		expect(rubberStatusFromMatchResultStatus('playing')).toBeNull();
		expect(rubberStatusFromMatchResultStatus('suspended')).toBeNull();
		expect(rubberStatusFromMatchResultStatus('scheduled')).toBeNull();
	});
});

describe('calculateTieResult', () => {
	test('finishes as soon as three rubbers are won and no rubber is still in progress', () => {
		const result = calculateTieResult({ teamAId: 'team-a', teamBId: 'team-b', status: 'playing' }, [
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: null, status: 'scheduled' },
			{ winnerSide: null, status: 'scheduled' }
		]);

		expect(result).toMatchObject({
			teamScoreA: 3,
			teamScoreB: 0,
			winnerTeamId: 'team-a',
			status: 'finished',
			allDone: false,
			decided: true
		});
	});

	test('keeps showing playing while a rubber started after the winner was decided is still in progress', () => {
		const result = calculateTieResult(
			{ teamAId: 'team-a', teamBId: 'team-b', status: 'finished' },
			[
				{ winnerSide: 'A', status: 'finished' },
				{ winnerSide: 'A', status: 'finished' },
				{ winnerSide: 'A', status: 'finished' },
				{ winnerSide: null, status: 'playing' },
				{ winnerSide: null, status: 'scheduled' }
			]
		);

		expect(result).toMatchObject({
			winnerTeamId: 'team-a',
			status: 'playing',
			allDone: false,
			decided: false
		});
	});

	test('returns to finished once the extra rubber started after a decision completes', () => {
		const result = calculateTieResult({ teamAId: 'team-a', teamBId: 'team-b', status: 'playing' }, [
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'B', status: 'finished' },
			{ winnerSide: null, status: 'scheduled' }
		]);

		expect(result).toMatchObject({
			winnerTeamId: 'team-a',
			status: 'finished',
			allDone: false,
			decided: true
		});
	});

	test('never downgrades a confirmed tie back to finished', () => {
		const result = calculateTieResult(
			{ teamAId: 'team-a', teamBId: 'team-b', status: 'confirmed' },
			[
				{ winnerSide: 'A', status: 'finished' },
				{ winnerSide: 'A', status: 'finished' },
				{ winnerSide: 'A', status: 'finished' },
				{ winnerSide: null, status: 'scheduled' },
				{ winnerSide: null, status: 'scheduled' }
			]
		);

		expect(result.status).toBe('confirmed');
	});

	test('finishes only when all five rubbers are terminal', () => {
		const result = calculateTieResult({ teamAId: 'team-a', teamBId: 'team-b', status: 'playing' }, [
			{ winnerSide: 'B', status: 'confirmed' },
			{ winnerSide: 'B', status: 'finished' },
			{ winnerSide: 'B', status: 'finished' },
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'A', status: 'cancelled' }
		]);

		expect(result).toMatchObject({
			teamScoreA: 2,
			teamScoreB: 3,
			winnerTeamId: 'team-b',
			status: 'finished',
			allDone: true
		});
	});

	test('2-2 with one rubber remaining has no winner and is not finished', () => {
		const result = calculateTieResult({ teamAId: 'team-a', teamBId: 'team-b', status: 'playing' }, [
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'B', status: 'finished' },
			{ winnerSide: 'B', status: 'finished' },
			{ winnerSide: null, status: 'playing' }
		]);

		expect(result).toMatchObject({
			teamScoreA: 2,
			teamScoreB: 2,
			winnerTeamId: null,
			status: 'playing',
			allDone: false
		});
	});

	test('3-2 final score: finished but not allDone when 5th rubber still scheduled', () => {
		const result = calculateTieResult({ teamAId: 'team-a', teamBId: 'team-b', status: 'playing' }, [
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'B', status: 'finished' },
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'B', status: 'finished' },
			{ winnerSide: 'A', status: 'scheduled' }
		]);

		expect(result).toMatchObject({
			teamScoreA: 3,
			teamScoreB: 2,
			winnerTeamId: 'team-a',
			status: 'finished',
			allDone: false,
			decided: true
		});
	});

	test('skipped counts as a terminal status for allDone', () => {
		const result = calculateTieResult({ teamAId: 'team-a', teamBId: 'team-b', status: 'playing' }, [
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: null, status: 'skipped' },
			{ winnerSide: null, status: 'skipped' }
		]);

		expect(result).toMatchObject({
			teamScoreA: 3,
			teamScoreB: 0,
			winnerTeamId: 'team-a',
			status: 'finished',
			allDone: true
		});
	});

	test('null teamIds produce null winnerTeamId even when one side wins 3', () => {
		const result = calculateTieResult({ teamAId: null, teamBId: null, status: 'playing' }, [
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: null, status: 'scheduled' },
			{ winnerSide: null, status: 'scheduled' }
		]);

		expect(result.winnerTeamId).toBeNull();
		expect(result.teamScoreA).toBe(3);
	});

	test('cancelled rubbers are terminal for allDone but do not add team score', () => {
		const result = calculateTieResult({ teamAId: 'team-a', teamBId: 'team-b', status: 'playing' }, [
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'B', status: 'finished' },
			{ winnerSide: null, status: 'cancelled' },
			{ winnerSide: null, status: 'cancelled' },
			{ winnerSide: null, status: 'cancelled' }
		]);

		expect(result).toMatchObject({
			teamScoreA: 1,
			teamScoreB: 1,
			winnerTeamId: null,
			status: 'finished',
			allDone: true
		});
	});

	test('does not finish when fewer than five terminal rubbers are present', () => {
		const result = calculateTieResult({ teamAId: 'team-a', teamBId: 'team-b', status: 'playing' }, [
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'A', status: 'finished' },
			{ winnerSide: 'B', status: 'confirmed' },
			{ winnerSide: 'B', status: 'skipped' }
		]);

		expect(result).toMatchObject({
			teamScoreA: 2,
			teamScoreB: 2,
			winnerTeamId: null,
			status: 'playing',
			allDone: false
		});
	});
});
