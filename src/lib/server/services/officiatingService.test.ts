import { describe, expect, test } from 'vitest';
import {
	listUnassignedOfficiatingTies,
	nextOfficiatingAssignmentStatus
} from './officiatingService';

describe('nextOfficiatingAssignmentStatus', () => {
	test('creates a new assignment as scheduled', () => {
		expect(
			nextOfficiatingAssignmentStatus({
				existing: null,
				assignedTeamId: 'team-a',
				note: null
			})
		).toBe('scheduled');
	});

	test('marks existing assignment as changed when team changes', () => {
		expect(
			nextOfficiatingAssignmentStatus({
				existing: { assignedTeamId: 'team-a', note: null, status: 'confirmed' },
				assignedTeamId: 'team-b',
				note: null
			})
		).toBe('changed');
	});

	test('keeps existing status when assignment content does not change', () => {
		expect(
			nextOfficiatingAssignmentStatus({
				existing: { assignedTeamId: 'team-a', note: 'main court', status: 'confirmed' },
				assignedTeamId: 'team-a',
				note: 'main court'
			})
		).toBe('confirmed');
	});

	test('marks assignment as changed when only the note changes', () => {
		expect(
			nextOfficiatingAssignmentStatus({
				existing: { assignedTeamId: 'team-a', note: null, status: 'scheduled' },
				assignedTeamId: 'team-a',
				note: 'コート変更あり'
			})
		).toBe('changed');
	});

	test('treats null and undefined note as equivalent (no change)', () => {
		expect(
			nextOfficiatingAssignmentStatus({
				existing: { assignedTeamId: 'team-a', note: null, status: 'confirmed' },
				assignedTeamId: 'team-a',
				note: null
			})
		).toBe('confirmed');
	});
});

describe('listUnassignedOfficiatingTies', () => {
	test('detects ties without an assigned officiating team', () => {
		const ties = [
			{ id: 'a', officiatingTeamId: 'team-a', officiatingTeamName: 'Alpha' },
			{ id: 'b', officiatingTeamId: null, officiatingTeamName: null },
			{ id: 'c', officiatingTeamId: null, officiatingTeamName: '' },
			{ id: 'd', officiatingTeamIds: ['team-a'], officiatingTeamNames: ['Alpha'] }
		];

		expect(listUnassignedOfficiatingTies(ties).map((tie) => tie.id)).toEqual(['b', 'c']);
	});
});
