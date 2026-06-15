import { describe, expect, test } from 'vitest';
import { getCellInfo, type StandingsTieRecord } from './standings';

function tie(
	overrides: Partial<StandingsTieRecord> & { teamAId: string; teamBId: string }
): StandingsTieRecord {
	return {
		id: 'tie-1',
		tieCode: 'A-1',
		winnerTeamId: null,
		teamScoreA: 0,
		teamScoreB: 0,
		status: 'scheduled',
		...overrides
	};
}

describe('getCellInfo', () => {
	// ─── no tie ────────────────────────────────────────────────────────────────

	test('returns null when no tie exists between the two teams', () => {
		expect(getCellInfo('team-a', 'team-b', [])).toBeNull();
	});

	test('returns null when only unrelated ties exist', () => {
		const ties = [tie({ id: 'x', teamAId: 'team-c', teamBId: 'team-d' })];
		expect(getCellInfo('team-a', 'team-b', ties)).toBeNull();
	});

	// ─── score perspective ──────────────────────────────────────────────────────

	test('returns correct myScore/theirScore when row team is teamA', () => {
		const ties = [tie({ teamAId: 'a', teamBId: 'b', teamScoreA: 3, teamScoreB: 2 })];
		const cell = getCellInfo('a', 'b', ties);
		expect(cell?.myScore).toBe(3);
		expect(cell?.theirScore).toBe(2);
	});

	test('returns correct myScore/theirScore when row team is teamB (reversed perspective)', () => {
		const ties = [tie({ teamAId: 'a', teamBId: 'b', teamScoreA: 3, teamScoreB: 2 })];
		const cell = getCellInfo('b', 'a', ties);
		expect(cell?.myScore).toBe(2);
		expect(cell?.theirScore).toBe(3);
	});

	// ─── won / lost ─────────────────────────────────────────────────────────────

	test('won=true when winnerTeamId matches rowTeamId', () => {
		const ties = [
			tie({ teamAId: 'a', teamBId: 'b', winnerTeamId: 'a', teamScoreA: 3, teamScoreB: 1 })
		];
		const cell = getCellInfo('a', 'b', ties);
		expect(cell?.won).toBe(true);
		expect(cell?.lost).toBe(false);
	});

	test('lost=true when winnerTeamId does not match rowTeamId', () => {
		const ties = [
			tie({ teamAId: 'a', teamBId: 'b', winnerTeamId: 'b', teamScoreA: 1, teamScoreB: 3 })
		];
		const cell = getCellInfo('a', 'b', ties);
		expect(cell?.lost).toBe(true);
		expect(cell?.won).toBe(false);
	});

	test('won=true by score comparison when winnerTeamId is set but not rowTeamId', () => {
		// winnerTeamId set and myScore > theirScore → won even if winnerTeamId differs
		const ties = [
			tie({ teamAId: 'a', teamBId: 'b', winnerTeamId: 'other', teamScoreA: 4, teamScoreB: 1 })
		];
		const cell = getCellInfo('a', 'b', ties);
		expect(cell?.won).toBe(true);
	});

	test('won=false and lost=false when winnerTeamId is null (unfinished)', () => {
		const ties = [tie({ teamAId: 'a', teamBId: 'b', winnerTeamId: null })];
		const cell = getCellInfo('a', 'b', ties);
		expect(cell?.won).toBe(false);
		expect(cell?.lost).toBe(false);
	});

	// ─── done flag ──────────────────────────────────────────────────────────────

	test('done=true when status is finished', () => {
		const ties = [tie({ teamAId: 'a', teamBId: 'b', status: 'finished' })];
		expect(getCellInfo('a', 'b', ties)?.done).toBe(true);
	});

	test('done=true when status is confirmed', () => {
		const ties = [tie({ teamAId: 'a', teamBId: 'b', status: 'confirmed' })];
		expect(getCellInfo('a', 'b', ties)?.done).toBe(true);
	});

	test('done=true when winnerTeamId is set even if status is playing', () => {
		const ties = [tie({ teamAId: 'a', teamBId: 'b', status: 'playing', winnerTeamId: 'a' })];
		expect(getCellInfo('a', 'b', ties)?.done).toBe(true);
	});

	test('done=false when status is scheduled and no winner yet', () => {
		const ties = [tie({ teamAId: 'a', teamBId: 'b', status: 'scheduled', winnerTeamId: null })];
		expect(getCellInfo('a', 'b', ties)?.done).toBe(false);
	});

	// ─── bidirectional lookup ────────────────────────────────────────────────────

	test('finds tie when teams are stored as A=col, B=row', () => {
		const ties = [tie({ teamAId: 'x', teamBId: 'y' })];
		expect(getCellInfo('y', 'x', ties)).not.toBeNull();
	});

	test('tie reference is the same object from the input array', () => {
		const t = tie({ teamAId: 'a', teamBId: 'b' });
		const cell = getCellInfo('a', 'b', [t]);
		expect(cell?.tie).toBe(t);
	});

	// ─── multiple ties ───────────────────────────────────────────────────────────

	test('finds the correct tie among several', () => {
		const ties = [
			tie({ id: 'ab', teamAId: 'a', teamBId: 'b', teamScoreA: 3, teamScoreB: 2 }),
			tie({ id: 'ac', teamAId: 'a', teamBId: 'c', teamScoreA: 1, teamScoreB: 4 })
		];
		const cell = getCellInfo('a', 'c', ties);
		expect(cell?.tie.id).toBe('ac');
		expect(cell?.myScore).toBe(1);
		expect(cell?.theirScore).toBe(4);
	});
});
