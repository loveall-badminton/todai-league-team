import { describe, expect, test } from 'vitest';
import {
	canGenerateFifthPlace,
	canGenerateSemifinals,
	getFifthPlaceHint,
	getSemifinalsHint,
	canGenerateFinals,
	getFinalsHint
} from './finalsHelpers';

const allReady = {
	x1TeamAId: 'a1',
	x1TeamBId: 'b2',
	x2TeamAId: 'a2',
	x2TeamBId: 'b1'
};

// ─── canGenerateSemifinals ────────────────────────────────────────────────────

describe('canGenerateSemifinals', () => {
	test('returns true when all semifinal teams are selected', () => {
		expect(canGenerateSemifinals(allReady)).toBe(true);
	});

	test('returns false when a semifinal slot is empty', () => {
		expect(canGenerateSemifinals({ ...allReady, x1TeamAId: '' })).toBe(false);
	});

	test('returns false when a team is duplicated', () => {
		expect(canGenerateSemifinals({ ...allReady, x2TeamAId: 'a1' })).toBe(false);
	});
});

// ─── getSemifinalsHint ────────────────────────────────────────────────────────

describe('getSemifinalsHint', () => {
	test('returns null when generation is possible', () => {
		expect(getSemifinalsHint(allReady)).toBeNull();
	});

	test('mentions missing semifinal selections', () => {
		const hint = getSemifinalsHint({ ...allReady, x1TeamBId: '' });
		expect(hint).toContain('準決勝の全チーム');
	});

	test('mentions duplicated selections', () => {
		const hint = getSemifinalsHint({ ...allReady, x2TeamBId: 'a1' });
		expect(hint).toContain('同じチーム');
	});
});

describe('canGenerateFifthPlace', () => {
	test('returns true when both teams are selected', () => {
		expect(canGenerateFifthPlace({ x3TeamAId: 'a3', x3TeamBId: 'b3' })).toBe(true);
	});

	test('returns false when a slot is empty', () => {
		expect(canGenerateFifthPlace({ x3TeamAId: 'a3', x3TeamBId: '' })).toBe(false);
	});

	test('returns false when the same team is selected twice', () => {
		expect(canGenerateFifthPlace({ x3TeamAId: 'a3', x3TeamBId: 'a3' })).toBe(false);
	});
});

describe('getFifthPlaceHint', () => {
	test('returns null when generation is possible', () => {
		expect(getFifthPlaceHint({ x3TeamAId: 'a3', x3TeamBId: 'b3' })).toBeNull();
	});

	test('mentions missing fifth-place selections', () => {
		expect(getFifthPlaceHint({ x3TeamAId: '', x3TeamBId: 'b3' })).toContain('5位決定戦');
	});

	test('mentions duplicated fifth-place selections', () => {
		expect(getFifthPlaceHint({ x3TeamAId: 'a3', x3TeamBId: 'a3' })).toContain('同じチーム');
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
