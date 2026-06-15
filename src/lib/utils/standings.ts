export type StandingsTieRecord = {
	id: string;
	tieCode: string;
	teamAId: string | null;
	teamBId: string | null;
	winnerTeamId: string | null;
	teamScoreA: number;
	teamScoreB: number;
	status: string;
};

export type CellInfo = {
	tie: StandingsTieRecord;
	myScore: number;
	theirScore: number;
	won: boolean;
	lost: boolean;
	done: boolean;
};

/**
 * グループステージ対戦表の1セルに必要な情報を返す。
 * チームAとBどちらが row になっても正しいスコアと勝敗を返す。
 */
export function getCellInfo(
	rowTeamId: string,
	colTeamId: string,
	ties: StandingsTieRecord[]
): CellInfo | null {
	const tie = ties.find(
		(t) =>
			(t.teamAId === rowTeamId && t.teamBId === colTeamId) ||
			(t.teamAId === colTeamId && t.teamBId === rowTeamId)
	);
	if (!tie) return null;

	const myScore = tie.teamAId === rowTeamId ? tie.teamScoreA : tie.teamScoreB;
	const theirScore = tie.teamAId === rowTeamId ? tie.teamScoreB : tie.teamScoreA;
	const won = tie.winnerTeamId === rowTeamId || (!!tie.winnerTeamId && myScore > theirScore);
	const lost = !!tie.winnerTeamId && tie.winnerTeamId !== rowTeamId;
	const done = tie.status === 'finished' || tie.status === 'confirmed' || !!tie.winnerTeamId;
	return { tie, myScore, theirScore, won, lost, done };
}
