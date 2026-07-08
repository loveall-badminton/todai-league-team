import { describe, expect, test } from 'vitest';
import {
	canGenerateSemifinals,
	getSemifinalsHint,
	canGenerateFinals,
	getFinalsHint
} from './finalsHelpers';

const allReady = {
	groupAAllDone: true,
	groupBAllDone: true,
	noTiebreakerA: true,
	noTiebreakerB: true
};

// ─── canGenerateSemifinals ────────────────────────────────────────────────────

describe('canGenerateSemifinals', () => {
	test('returns true when all preconditions are met', () => {
		expect(canGenerateSemifinals(allReady)).toBe(true);
	});

	test('returns false when group A is not fully done', () => {
		expect(canGenerateSemifinals({ ...allReady, groupAAllDone: false })).toBe(false);
	});

	test('returns false when group B is not fully done', () => {
		expect(canGenerateSemifinals({ ...allReady, groupBAllDone: false })).toBe(false);
	});

	test('returns false when group A still has a tiebreaker', () => {
		expect(canGenerateSemifinals({ ...allReady, noTiebreakerA: false })).toBe(false);
	});

	test('returns false when group B still has a tiebreaker', () => {
		expect(canGenerateSemifinals({ ...allReady, noTiebreakerB: false })).toBe(false);
	});

	test('returns false when all preconditions are unmet', () => {
		expect(
			canGenerateSemifinals({
				groupAAllDone: false,
				groupBAllDone: false,
				noTiebreakerA: false,
				noTiebreakerB: false
			})
		).toBe(false);
	});
});

// ─── getSemifinalsHint ────────────────────────────────────────────────────────

describe('getSemifinalsHint', () => {
	test('returns null when generation is possible', () => {
		expect(getSemifinalsHint(allReady)).toBeNull();
	});

	test('mentions only group A when group A is incomplete', () => {
		const hint = getSemifinalsHint({ ...allReady, groupAAllDone: false });
		expect(hint).toContain('Aリーグ');
		expect(hint).not.toContain('Bリーグ');
	});

	test('mentions only group B when group B is incomplete', () => {
		const hint = getSemifinalsHint({ ...allReady, groupBAllDone: false });
		expect(hint).toContain('Bリーグ');
		expect(hint).not.toContain('Aリーグ');
	});

	test('mentions both groups when both are incomplete', () => {
		const hint = getSemifinalsHint({ ...allReady, groupAAllDone: false, groupBAllDone: false });
		expect(hint).toContain('Aリーグ');
		expect(hint).toContain('Bリーグ');
	});

	test('mentions tiebreaker when matches are done but tiebreaker is pending', () => {
		const hint = getSemifinalsHint({ ...allReady, noTiebreakerA: false });
		expect(hint).toContain('同点チーム');
	});

	test('match-incomplete hint takes priority over tiebreaker hint', () => {
		const hint = getSemifinalsHint({
			groupAAllDone: false,
			groupBAllDone: true,
			noTiebreakerA: false,
			noTiebreakerB: true
		});
		expect(hint).toContain('完了してから');
		expect(hint).not.toContain('同点チーム');
	});
});

// ─── canGenerateFinals ────────────────────────────────────────────────────────

describe('canGenerateFinals', () => {
	const finishedSemi = { tieCode: 'X-1', status: 'finished' };
	const confirmedSemi = { tieCode: 'X-2', status: 'confirmed' };
	const playingSemi = { tieCode: 'X-1', status: 'playing' };

	test('returns true when both semis are finished', () => {
		expect(canGenerateFinals(finishedSemi, { tieCode: 'X-2', status: 'finished' })).toBe(true);
	});

	test('returns true when both semis are confirmed', () => {
		expect(canGenerateFinals(confirmedSemi, { tieCode: 'X-1', status: 'confirmed' })).toBe(true);
	});

	test('returns true when one semi is finished and the other confirmed', () => {
		expect(canGenerateFinals(finishedSemi, confirmedSemi)).toBe(true);
	});

	test('returns false when semi 1 is still playing', () => {
		expect(canGenerateFinals(playingSemi, confirmedSemi)).toBe(false);
	});

	test('returns false when semi 1 is null', () => {
		expect(canGenerateFinals(null, confirmedSemi)).toBe(false);
	});

	test('returns false when semi 2 is null', () => {
		expect(canGenerateFinals(finishedSemi, null)).toBe(false);
	});

	test('returns false when both semis are null', () => {
		expect(canGenerateFinals(null, null)).toBe(false);
	});

	test('returns false when semi 2 is undefined', () => {
		expect(canGenerateFinals(finishedSemi, undefined)).toBe(false);
	});
});

// ─── getFinalsHint ────────────────────────────────────────────────────────────

describe('getFinalsHint', () => {
	const finished = { tieCode: 'X-1', status: 'finished' };
	const confirmed = { tieCode: 'X-2', status: 'confirmed' };
	const playing = { tieCode: 'X-1', status: 'playing' };

	test('returns null when both semis are finished', () => {
		expect(getFinalsHint(finished, confirmed)).toBeNull();
	});

	test('mentions generation when either semi is missing', () => {
		const hint = getFinalsHint(null, finished);
		expect(hint).toContain('準決勝');
		expect(hint).toContain('生成');
	});

	test('mentions missing semi when one is undefined', () => {
		const hint = getFinalsHint(finished, undefined);
		expect(hint).toContain('準決勝');
	});

	test('mentions result confirmation when semis exist but are not done', () => {
		const hint = getFinalsHint(playing, finished);
		expect(hint).toContain('結果確定後');
	});

	test('returns null when both semis are confirmed', () => {
		expect(getFinalsHint(confirmed, { tieCode: 'X-2', status: 'confirmed' })).toBeNull();
	});
});
