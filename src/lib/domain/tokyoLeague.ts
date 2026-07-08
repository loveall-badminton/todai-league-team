export type GroupCode = 'A' | 'B';

export type VenueCode = 'first_gym' | 'second_gym';

export type TiePhase =
	| 'group_a'
	| 'group_b'
	| 'semifinal'
	| 'final'
	| 'third_place'
	| 'fifth_place'
	| 'ranking_tiebreaker';

export type RubberCode = 'WD1' | 'XD1' | 'MD3' | 'MD2' | 'MD1';

export const RUBBER_DEFINITIONS = [
	{
		code: 'WD1',
		discipline: 'WD',
		displayOrder: 1,
		label: '女子ダブルス'
	},
	{
		code: 'XD1',
		discipline: 'XD',
		displayOrder: 2,
		label: 'ミックスダブルス'
	},
	{
		code: 'MD3',
		discipline: 'MD',
		displayOrder: 3,
		label: '男子ダブルス3'
	},
	{
		code: 'MD2',
		discipline: 'MD',
		displayOrder: 4,
		label: '男子ダブルス2'
	},
	{
		code: 'MD1',
		discipline: 'MD',
		displayOrder: 5,
		label: '男子ダブルス1'
	}
] as const;

export const FINAL_TIE_DEFINITIONS = [
	{
		tieCode: 'X-1',
		phase: 'semifinal',
		roundLabel: '準決勝1',
		teamASource: 'A1',
		teamBSource: 'B2'
	},
	{
		tieCode: 'X-2',
		phase: 'semifinal',
		roundLabel: '準決勝2',
		teamASource: 'A2',
		teamBSource: 'B1'
	},
	{
		tieCode: 'X-3',
		phase: 'fifth_place',
		roundLabel: '5位決定戦',
		teamASource: 'A3',
		teamBSource: 'B3'
	},
	{
		tieCode: 'X-4',
		phase: 'third_place',
		roundLabel: '3位決定戦',
		teamASource: 'X-1_loser',
		teamBSource: 'X-2_loser'
	},
	{
		tieCode: 'X-5',
		phase: 'final',
		roundLabel: '決勝',
		teamASource: 'X-1_winner',
		teamBSource: 'X-2_winner'
	}
] as const;

export const VENUES = [
	{ code: 'first_gym' as const, label: '第一体育館', courtCount: 6 },
	{ code: 'second_gym' as const, label: '第二体育館', courtCount: 8 }
] as const;

export const COURT_BLOCKS = [
	{
		code: 'first_1_3',
		venue: 'first_gym',
		label: '第一体育館 1-3コート',
		courtNumbers: [1, 2, 3]
	},
	{
		code: 'first_4_6',
		venue: 'first_gym',
		label: '第一体育館 4-6コート',
		courtNumbers: [4, 5, 6]
	},
	{
		code: 'second_1_5',
		venue: 'second_gym',
		label: '第二体育館 1,5コート',
		courtNumbers: [1, 5]
	},
	{
		code: 'second_2_4',
		venue: 'second_gym',
		label: '第二体育館 2-4コート',
		courtNumbers: [2, 3, 4]
	},
	{
		code: 'second_6_8',
		venue: 'second_gym',
		label: '第二体育館 6-8コート',
		courtNumbers: [6, 7, 8]
	}
] as const;

export const TOKYO_LEAGUE_SCORING_RULES = [
	{
		code: 'GROUP_15',
		name: '予選用15点ルール',
		maxGames: 3,
		gamesToWin: 2,
		pointsToWin: 15,
		winBy: 2,
		maxPoints: 21,
		midGameIntervalPoint: 8
	},
	{
		code: 'KNOCKOUT_21',
		name: '決勝トーナメント21点ルール',
		maxGames: 3,
		gamesToWin: 2,
		pointsToWin: 21,
		winBy: 2,
		maxPoints: 30,
		midGameIntervalPoint: 11
	},
	{
		code: 'TIEBREAKER_21_SINGLE_GAME',
		name: '順位決定再試合用21点1ゲームマッチ',
		maxGames: 1,
		gamesToWin: 1,
		pointsToWin: 21,
		winBy: 2,
		maxPoints: 30,
		midGameIntervalPoint: 11
	}
] as const;

export const groupPhaseFor = (groupCode: GroupCode): TiePhase =>
	groupCode === 'A' ? 'group_a' : 'group_b';

export const isGroupPhase = (phase: TiePhase): phase is 'group_a' | 'group_b' =>
	phase === 'group_a' || phase === 'group_b';
