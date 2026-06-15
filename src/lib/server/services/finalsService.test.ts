import { describe, expect, test } from 'vitest';
import {
	buildFinalAndThirdPlaceAssignments,
	buildSemifinalsAndFifthPlaceAssignments
} from './finalsService';

describe('buildSemifinalsAndFifthPlaceAssignments', () => {
	test('maps A/B group ranks to x-1, x-2 and x-3', () => {
		const assignments = buildSemifinalsAndFifthPlaceAssignments(
			[
				{ rank: 1, teamId: 'a1' },
				{ rank: 2, teamId: 'a2' },
				{ rank: 3, teamId: 'a3' }
			],
			[
				{ rank: 1, teamId: 'b1' },
				{ rank: 2, teamId: 'b2' },
				{ rank: 3, teamId: 'b3' }
			]
		);

		expect(assignments).toEqual([
			expect.objectContaining({
				tieCode: 'x-1',
				phase: 'semifinal',
				roundLabel: '準決勝1',
				teamAId: 'a1',
				teamBId: 'b2'
			}),
			expect.objectContaining({
				tieCode: 'x-2',
				phase: 'semifinal',
				roundLabel: '準決勝2',
				teamAId: 'a2',
				teamBId: 'b1'
			}),
			expect.objectContaining({
				tieCode: 'x-3',
				phase: 'fifth_place',
				roundLabel: '5位決定戦',
				teamAId: 'a3',
				teamBId: 'b3'
			})
		]);
	});

	test('leaves a side empty when the source rank still requires a tiebreaker', () => {
		const assignments = buildSemifinalsAndFifthPlaceAssignments(
			[
				{ rank: 1, teamId: 'a1', requiresTiebreaker: true },
				{ rank: 2, teamId: 'a2' },
				{ rank: 3, teamId: 'a3' }
			],
			[
				{ rank: 1, teamId: 'b1' },
				{ rank: 2, teamId: 'b2' },
				{ rank: 3, teamId: 'b3' }
			]
		);

		expect(assignments[0]).toMatchObject({ tieCode: 'x-1', teamAId: null, teamBId: 'b2' });
	});

	test('leaves a side empty when a source rank is missing', () => {
		const assignments = buildSemifinalsAndFifthPlaceAssignments(
			[
				{ rank: 1, teamId: 'a1' },
				{ rank: 2, teamId: 'a2' }
			],
			[
				{ rank: 1, teamId: 'b1' },
				{ rank: 2, teamId: 'b2' }
			]
		);

		expect(assignments[2]).toMatchObject({
			tieCode: 'x-3',
			teamAId: null,
			teamBId: null
		});
	});
});

describe('buildFinalAndThirdPlaceAssignments', () => {
	test('maps semifinal winners to x-5 and losers to x-4', () => {
		const assignments = buildFinalAndThirdPlaceAssignments(
			{
				tieCode: 'x-1',
				status: 'finished',
				teamAId: 'a1',
				teamBId: 'b2',
				winnerTeamId: 'a1'
			},
			{
				tieCode: 'x-2',
				status: 'confirmed',
				teamAId: 'a2',
				teamBId: 'b1',
				winnerTeamId: 'b1'
			}
		);

		expect(assignments).toEqual([
			expect.objectContaining({
				tieCode: 'x-4',
				phase: 'third_place',
				roundLabel: '3位決定戦',
				teamAId: 'b2',
				teamBId: 'a2'
			}),
			expect.objectContaining({
				tieCode: 'x-5',
				phase: 'final',
				roundLabel: '決勝',
				teamAId: 'a1',
				teamBId: 'b1'
			})
		]);
	});

	test('rejects generation before both semifinals have results', () => {
		expect(() =>
			buildFinalAndThirdPlaceAssignments(
				{
					tieCode: 'x-1',
					status: 'playing',
					teamAId: 'a1',
					teamBId: 'b2',
					winnerTeamId: null
				},
				{
					tieCode: 'x-2',
					status: 'finished',
					teamAId: 'a2',
					teamBId: 'b1',
					winnerTeamId: 'b1'
				}
			)
		).toThrow('準決勝1・準決勝2の結果確定後に生成できます');
	});

	test('rejects generation when a finished semifinal has no winner', () => {
		expect(() =>
			buildFinalAndThirdPlaceAssignments(
				{
					tieCode: 'x-1',
					status: 'finished',
					teamAId: 'a1',
					teamBId: 'b2',
					winnerTeamId: null
				},
				{
					tieCode: 'x-2',
					status: 'finished',
					teamAId: 'a2',
					teamBId: 'b1',
					winnerTeamId: 'b1'
				}
			)
		).toThrow('準決勝の勝敗が未確定です');
	});

	test('rejects generation when a semifinal side is unassigned', () => {
		expect(() =>
			buildFinalAndThirdPlaceAssignments(
				{
					tieCode: 'x-1',
					status: 'confirmed',
					teamAId: 'a1',
					teamBId: null,
					winnerTeamId: 'a1'
				},
				{
					tieCode: 'x-2',
					status: 'confirmed',
					teamAId: 'a2',
					teamBId: 'b1',
					winnerTeamId: 'b1'
				}
			)
		).toThrow('準決勝の勝敗が未確定です');
	});
});
