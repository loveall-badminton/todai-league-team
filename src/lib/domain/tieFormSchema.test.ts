import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { updateTieFormFields } from './tieFormSchema';

const schema = v.object(updateTieFormFields);

const baseInput = {
	tieCode: 'A-1'
};

describe('update tie form schema', () => {
	it('normalizes a single assigned team id submitted as a string', () => {
		const result = v.parse(schema, {
			...baseInput,
			assignedTeamIds: 'team-a'
		});

		expect(result.assignedTeamIds).toEqual(['team-a']);
	});

	it('keeps multiple assigned team ids submitted as an array', () => {
		const result = v.parse(schema, {
			...baseInput,
			assignedTeamIds: ['team-a', 'team-b']
		});

		expect(result.assignedTeamIds).toEqual(['team-a', 'team-b']);
	});

	it('normalizes an empty assigned team value to no assignments', () => {
		const result = v.parse(schema, {
			...baseInput,
			assignedTeamIds: ''
		});

		expect(result.assignedTeamIds).toEqual([]);
	});
});
