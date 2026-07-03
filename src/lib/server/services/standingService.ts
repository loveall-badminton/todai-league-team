import type { GroupCode } from '$lib/domain/tokyoLeague';
import { getRequestDb } from '$lib/server/db/request';
import { batchQuery } from '$lib/server/db/utils';
import { groupStandingOverrides, matches, rubbers, teams, ties } from '$lib/server/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';

export interface GroupStanding {
	teamId: string;
	teamName: string;
	rank: number | null;
	teamMatchesWon: number;
	teamMatchesLost: number;
	rubbersWon: number;
	rubbersLost: number;
	gamesWon: number;
	gamesLost: number;
	headToHeadSummary?: string | null;
	tiedTeamsRubbersWon?: number | null;
	tiedTeamsGamesWon?: number | null;
	requiresTiebreaker: boolean;
	manualRank?: number | null;
}

type GroupTie = typeof ties.$inferSelect;
type GroupRubber = typeof rubbers.$inferSelect;
type GroupMatch = typeof matches.$inferSelect;

export type StandingTeamRecord = {
	id: string;
	name: string;
};

export type StandingTieRecord = Pick<GroupTie, 'id' | 'teamAId' | 'teamBId' | 'winnerTeamId'>;
export type StandingRubberRecord = Pick<GroupRubber, 'id' | 'tieId' | 'matchId' | 'winnerSide'>;
export type StandingMatchRecord = Pick<GroupMatch, 'id' | 'gamesWonA' | 'gamesWonB'>;
export type StandingOverrideRecord = {
	teamId: string;
	manualRank: number;
};

export async function calculateGroupStandings(groupCode: GroupCode): Promise<GroupStanding[]> {
	const all = await calculateAllGroupStandings();
	return all[groupCode];
}

export function isRoundRobinComplete(ties: Pick<StandingTieRecord, 'winnerTeamId'>[]): boolean {
	return ties.length > 0 && ties.every((tie) => !!tie.winnerTeamId);
}

export async function calculateAllGroupStandings(): Promise<Record<GroupCode, GroupStanding[]>> {
	const db = getRequestDb();

	const groupCodes: GroupCode[] = ['A', 'B'];

	// Fetch both groups' data in single queries
	const allTeams = await db
		.select()
		.from(teams)
		.where(and(inArray(teams.groupCode, groupCodes), eq(teams.status, 'active')))
		.orderBy(asc(teams.displayOrder), asc(teams.name));

	const allTies = await db
		.select()
		.from(ties)
		.where(inArray(ties.groupCode, groupCodes))
		.orderBy(asc(ties.displayOrder), asc(ties.tieCode));

	// D1 の bind 変数上限(100)を超えないよう分割して取得する
	const tieIds = allTies.map((tie) => tie.id);
	const rubberRows = await batchQuery(tieIds, (batch) =>
		db.select().from(rubbers).where(inArray(rubbers.tieId, batch))
	);
	const matchIds = rubberRows.map((rubber) => rubber.matchId).filter((id): id is string => !!id);
	const matchRows = await batchQuery(matchIds, (batch) =>
		db.select().from(matches).where(inArray(matches.id, batch))
	);
	const overrides = await db
		.select()
		.from(groupStandingOverrides)
		.where(inArray(groupStandingOverrides.groupCode, groupCodes));

	return {
		A: calculateGroupStandingsFromRecords({
			teams: allTeams.filter((t) => t.groupCode === 'A'),
			ties: allTies.filter((t) => t.groupCode === 'A'),
			rubbers: rubberRows,
			matches: matchRows,
			overrides: overrides.filter((o) => o.groupCode === 'A')
		}),
		B: calculateGroupStandingsFromRecords({
			teams: allTeams.filter((t) => t.groupCode === 'B'),
			ties: allTies.filter((t) => t.groupCode === 'B'),
			rubbers: rubberRows,
			matches: matchRows,
			overrides: overrides.filter((o) => o.groupCode === 'B')
		})
	};
}

export function calculateGroupStandingsFromRecords(params: {
	teams: StandingTeamRecord[];
	ties: StandingTieRecord[];
	rubbers: StandingRubberRecord[];
	matches: StandingMatchRecord[];
	overrides?: StandingOverrideRecord[];
}): GroupStanding[] {
	const overrides = params.overrides ?? [];
	const rows = params.teams.map<GroupStanding>((team) => ({
		teamId: team.id,
		teamName: team.name,
		rank: null,
		teamMatchesWon: 0,
		teamMatchesLost: 0,
		rubbersWon: 0,
		rubbersLost: 0,
		gamesWon: 0,
		gamesLost: 0,
		headToHeadSummary: null,
		tiedTeamsRubbersWon: null,
		tiedTeamsGamesWon: null,
		requiresTiebreaker: false,
		manualRank: overrides.find((override) => override.teamId === team.id)?.manualRank ?? null
	}));
	const byTeam = new Map(rows.map((row) => [row.teamId, row]));

	for (const tie of params.ties) {
		if (!tie.teamAId || !tie.teamBId) continue;
		const sideATeam = byTeam.get(tie.teamAId);
		const sideBTeam = byTeam.get(tie.teamBId);
		if (!sideATeam || !sideBTeam) continue;

		if (tie.winnerTeamId === tie.teamAId) {
			sideATeam.teamMatchesWon += 1;
			sideBTeam.teamMatchesLost += 1;
		} else if (tie.winnerTeamId === tie.teamBId) {
			sideBTeam.teamMatchesWon += 1;
			sideATeam.teamMatchesLost += 1;
		}

		for (const rubber of params.rubbers.filter((row) => row.tieId === tie.id)) {
			applyRubberStats({
				rubber,
				tie,
				match: params.matches.find((row) => row.id === rubber.matchId) ?? null,
				sideATeam,
				sideBTeam
			});
		}
	}

	const groups = groupByRecord(rows, (row) => String(row.teamMatchesWon));
	for (const tiedRows of groups.values()) {
		if (tiedRows.length < 2) continue;
		const tiedIds = new Set(tiedRows.map((row) => row.teamId));
		for (const row of tiedRows) {
			const tiedStats = statsAgainst(
				params.ties,
				params.rubbers,
				params.matches,
				row.teamId,
				tiedIds
			);
			row.tiedTeamsRubbersWon = tiedStats.rubbersWon;
			row.tiedTeamsGamesWon = tiedStats.gamesWon;
		}
		if (tiedRows.length === 2) {
			const [first, second] = tiedRows;
			const headToHead = params.ties.find(
				(tie) =>
					tie.teamAId &&
					tie.teamBId &&
					new Set([tie.teamAId, tie.teamBId]).size === 2 &&
					new Set([tie.teamAId, tie.teamBId]).has(first.teamId) &&
					new Set([tie.teamAId, tie.teamBId]).has(second.teamId)
			);
			if (headToHead?.winnerTeamId) {
				first.headToHeadSummary =
					headToHead.winnerTeamId === first.teamId ? '直接対決勝利' : '直接対決敗戦';
				second.headToHeadSummary =
					headToHead.winnerTeamId === second.teamId ? '直接対決勝利' : '直接対決敗戦';
			}
		}
	}

	const activeTeamMatchesWonGroupSizes = new Map<number, number>();
	for (const row of rows) {
		if (row.manualRank === null) {
			activeTeamMatchesWonGroupSizes.set(
				row.teamMatchesWon,
				(activeTeamMatchesWonGroupSizes.get(row.teamMatchesWon) ?? 0) + 1
			);
		}
	}

	const sorted = [...rows].sort(
		(a, b) =>
			compareStanding(a, b, params.ties, activeTeamMatchesWonGroupSizes) ||
			a.teamName.localeCompare(b.teamName)
	);

	const roundRobinComplete = isRoundRobinComplete(params.ties);
	if (roundRobinComplete) {
		for (const tiedRows of groupByRecord(sorted, standingTieKey).values()) {
			if (tiedRows.length < 2) continue;
			for (const row of tiedRows) {
				if (row.manualRank !== null) continue;
				row.requiresTiebreaker = true;
			}
		}
	}

	let rank = 1;
	let prevKey: string | null = null;
	for (const row of sorted) {
		if (row.manualRank) {
			row.rank = row.manualRank;
			rank = Math.max(rank, row.manualRank + 1);
			prevKey = null;
			continue;
		}
		const key = standingTieKey(row);
		if (prevKey !== null && key !== prevKey) {
			rank += 1;
		}
		prevKey = key;
		row.rank = rank;
	}
	return sorted.sort(
		(a, b) => (a.rank ?? 999) - (b.rank ?? 999) || a.teamName.localeCompare(b.teamName)
	);
}

function applyRubberStats(params: {
	rubber: StandingRubberRecord;
	tie: StandingTieRecord;
	match: StandingMatchRecord | null;
	sideATeam: GroupStanding;
	sideBTeam: GroupStanding;
}) {
	const { rubber, tie, match, sideATeam, sideBTeam } = params;
	if (rubber.winnerSide === 'A') {
		sideATeam.rubbersWon += 1;
		sideBTeam.rubbersLost += 1;
	} else if (rubber.winnerSide === 'B') {
		sideBTeam.rubbersWon += 1;
		sideATeam.rubbersLost += 1;
	}

	if (!match || !tie.teamAId || !tie.teamBId) return;
	sideATeam.gamesWon += match.gamesWonA;
	sideATeam.gamesLost += match.gamesWonB;
	sideBTeam.gamesWon += match.gamesWonB;
	sideBTeam.gamesLost += match.gamesWonA;
}

function statsAgainst(
	groupTies: StandingTieRecord[],
	rubberRows: StandingRubberRecord[],
	matchRows: StandingMatchRecord[],
	teamId: string,
	tiedTeamIds: Set<string>
) {
	const targetTies = groupTies.filter(
		(tie) =>
			tie.teamAId && tie.teamBId && tiedTeamIds.has(tie.teamAId) && tiedTeamIds.has(tie.teamBId)
	);
	let rubbersWon = 0;
	let gamesWon = 0;
	for (const tie of targetTies) {
		const isSideA = tie.teamAId === teamId;
		const isSideB = tie.teamBId === teamId;
		if (!isSideA && !isSideB) continue;
		for (const rubber of rubberRows.filter((row) => row.tieId === tie.id)) {
			if ((isSideA && rubber.winnerSide === 'A') || (isSideB && rubber.winnerSide === 'B')) {
				rubbersWon += 1;
			}
			const match = matchRows.find((row) => row.id === rubber.matchId);
			if (match) gamesWon += isSideA ? match.gamesWonA : match.gamesWonB;
		}
	}
	return { rubbersWon, gamesWon };
}

function compareStanding(
	a: GroupStanding,
	b: GroupStanding,
	groupTies: StandingTieRecord[],
	teamMatchesWonGroupSizes: Map<number, number>
) {
	if (a.manualRank !== null || b.manualRank !== null) {
		return (a.manualRank ?? 999) - (b.manualRank ?? 999);
	}
	if (b.teamMatchesWon !== a.teamMatchesWon) return b.teamMatchesWon - a.teamMatchesWon;
	if ((teamMatchesWonGroupSizes.get(a.teamMatchesWon) ?? 0) === 2) {
		const headToHead = headToHeadOrder(a, b, groupTies);
		if (headToHead !== 0) return headToHead;
	}
	if (b.rubbersWon !== a.rubbersWon) return b.rubbersWon - a.rubbersWon;
	if ((b.tiedTeamsRubbersWon ?? 0) !== (a.tiedTeamsRubbersWon ?? 0)) {
		return (b.tiedTeamsRubbersWon ?? 0) - (a.tiedTeamsRubbersWon ?? 0);
	}
	if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
	if ((b.tiedTeamsGamesWon ?? 0) !== (a.tiedTeamsGamesWon ?? 0)) {
		return (b.tiedTeamsGamesWon ?? 0) - (a.tiedTeamsGamesWon ?? 0);
	}
	return 0;
}

function headToHeadOrder(a: GroupStanding, b: GroupStanding, groupTies: StandingTieRecord[]) {
	const tie = groupTies.find(
		(row) =>
			row.teamAId &&
			row.teamBId &&
			new Set([row.teamAId, row.teamBId]).has(a.teamId) &&
			new Set([row.teamAId, row.teamBId]).has(b.teamId)
	);
	if (!tie?.winnerTeamId) return 0;
	if (tie.winnerTeamId === a.teamId) return -1;
	if (tie.winnerTeamId === b.teamId) return 1;
	return 0;
}

function standingTieKey(row: GroupStanding) {
	return [
		row.teamMatchesWon,
		row.rubbersWon,
		row.tiedTeamsRubbersWon ?? 0,
		row.gamesWon,
		row.tiedTeamsGamesWon ?? 0,
		row.headToHeadSummary ?? ''
	].join(':');
}

function groupByRecord<T>(items: T[], keyFor: (item: T) => string) {
	const map = new Map<string, T[]>();
	for (const item of items) {
		const key = keyFor(item);
		map.set(key, [...(map.get(key) ?? []), item]);
	}
	return map;
}
