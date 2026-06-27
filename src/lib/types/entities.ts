export interface EntityOption {
	id: string;
	name: string;
}

export type RubberRow = {
	id: string;
	code: string;
	status: string;
	matchStatus?: string | null;
	winnerSide: 'A' | 'B' | null;
	playersA: string[];
	playersB: string[];
	loserLabel: string | null;
	gamesScore: string | null;
	gameDetails: { gameNo: number; scoreA: number; scoreB: number; winnerSide?: 'A' | 'B' | null }[];
	matchId?: string | null;
};
