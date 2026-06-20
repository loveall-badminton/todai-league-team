import * as v from 'valibot';

const intPositive = v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1));
const intNonNeg = v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(0));

export const updateSettingsSchema = v.object({
	eventName: v.pipe(v.string(), v.trim(), v.nonEmpty('大会名は必須です')),
	groupStageScoringRuleId: v.string(),
	knockoutScoringRuleId: v.string(),
	tiebreakerScoringRuleId: v.string(),
	lineupRevealPolicy: v.picklist(['on_tie_start', 'manual'] as const),
	defaultLineupDueMinutesBefore: intNonNeg
});

export const updateScoringRuleSchema = v.object({
	id: v.string(),
	name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	maxGames: intPositive,
	gamesToWin: intPositive,
	pointsToWin: intPositive,
	winBy: intPositive,
	maxPoints: intPositive,
	midGameIntervalPoint: intPositive
});
