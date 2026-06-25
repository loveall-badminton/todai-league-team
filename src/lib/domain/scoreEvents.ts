import type { ScoreEventInput } from '$lib/domain/types';

export function eventTypeForInput(input: ScoreEventInput) {
	if (input.type === 'undo') return 'undo_applied';
	if (input.type === 'correction') return 'correction_applied';
	return input.type;
}
