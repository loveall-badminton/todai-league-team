import { describe, expect, test } from 'vitest';
import {
	rubberStatusTextClass,
	submissionBadgeColor,
	getCurrentWorkflowStep
} from './tiePageHelpers';

// ─── rubberStatusTextClass ────────────────────────────────────────────────────

describe('rubberStatusTextClass', () => {
	test.each([
		['not_ready', 'text-zinc-400'],
		['ready', 'text-violet-600'],
		['scheduled', 'text-zinc-600'],
		['playing', 'text-green-700 font-medium'],
		['finished', 'text-orange-700'],
		['confirmed', 'text-emerald-700 font-medium'],
		['skipped', 'text-zinc-400'],
		['cancelled', 'text-red-600']
	])('status=%s → %s', (status, expected) => {
		expect(rubberStatusTextClass(status)).toBe(expected);
	});

	test('unknown status → zinc-500 fallback', () => {
		expect(rubberStatusTextClass('unknown')).toBe('text-zinc-500');
	});

	test('empty string → zinc-500 fallback', () => {
		expect(rubberStatusTextClass('')).toBe('text-zinc-500');
	});
});

// ─── submissionBadgeColor ─────────────────────────────────────────────────────

describe('submissionBadgeColor', () => {
	test('draft → zinc', () => {
		expect(submissionBadgeColor('draft')).toBe('zinc');
	});

	test('submitted → blue', () => {
		expect(submissionBadgeColor('submitted')).toBe('blue');
	});

	test('locked → violet', () => {
		expect(submissionBadgeColor('locked')).toBe('violet');
	});

	test('revealed → emerald', () => {
		expect(submissionBadgeColor('revealed')).toBe('emerald');
	});

	test('null → zinc', () => {
		expect(submissionBadgeColor(null)).toBe('zinc');
	});

	test('undefined → zinc', () => {
		expect(submissionBadgeColor(undefined)).toBe('zinc');
	});

	test('unknown status → zinc fallback', () => {
		expect(submissionBadgeColor('pending')).toBe('zinc');
	});
});

// ─── getCurrentWorkflowStep ───────────────────────────────────────────────────

describe('getCurrentWorkflowStep', () => {
	test('scheduled → step 1', () => {
		expect(getCurrentWorkflowStep('scheduled')).toBe(1);
	});

	test('lineup_pending → step 1', () => {
		expect(getCurrentWorkflowStep('lineup_pending')).toBe(1);
	});

	test('lineup_submitted → step 2', () => {
		expect(getCurrentWorkflowStep('lineup_submitted')).toBe(2);
	});

	test('ready → step 3', () => {
		expect(getCurrentWorkflowStep('ready')).toBe(3);
	});

	test('playing → step 4', () => {
		expect(getCurrentWorkflowStep('playing')).toBe(4);
	});

	test('finished → step 5', () => {
		expect(getCurrentWorkflowStep('finished')).toBe(5);
	});

	test('confirmed → step 5 (same as finished)', () => {
		expect(getCurrentWorkflowStep('confirmed')).toBe(5);
	});

	test('unknown status → step 0', () => {
		expect(getCurrentWorkflowStep('cancelled')).toBe(0);
	});

	test('empty string → step 0', () => {
		expect(getCurrentWorkflowStep('')).toBe(0);
	});

	test('all valid statuses are distinct steps except finished/confirmed', () => {
		const steps = [
			getCurrentWorkflowStep('scheduled'),
			getCurrentWorkflowStep('lineup_submitted'),
			getCurrentWorkflowStep('ready'),
			getCurrentWorkflowStep('playing'),
			getCurrentWorkflowStep('finished')
		];
		// Steps should be monotonically increasing
		for (let i = 1; i < steps.length; i++) {
			expect(steps[i]).toBeGreaterThan(steps[i - 1]);
		}
	});
});
