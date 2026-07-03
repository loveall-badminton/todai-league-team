import { describe, expect, test } from 'vitest';
import { eventTypeForInput } from './scoreEvents';

describe('eventTypeForInput', () => {
	test('maps undo to undo_applied', () => {
		expect(
			eventTypeForInput({
				type: 'undo',
				idempotencyKey: 'k1',
				observedSeqNo: 7
			})
		).toBe('undo_applied');
	});

	test('maps correction to correction_applied', () => {
		expect(
			eventTypeForInput({
				type: 'correction',
				idempotencyKey: 'k2',
				observedSeqNo: 7,
				gameNo: 1,
				score: { A: 21, B: 18 },
				reason: 'typo'
			})
		).toBe('correction_applied');
	});

	test('preserves other event types', () => {
		expect(
			eventTypeForInput({
				type: 'rally_won',
				idempotencyKey: 'k3',
				observedSeqNo: 7,
				side: 'A'
			})
		).toBe('rally_won');
	});
});
