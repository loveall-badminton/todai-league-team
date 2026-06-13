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
	test('sets winner at three rubber wins without finishing the tie early', () => {
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
			status: 'playing',
			allDone: false
		});
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

	test('3-2 final score: winner set but not allDone when 5th rubber still scheduled', () => {
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
			status: 'playing',
			allDone: false
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
});
