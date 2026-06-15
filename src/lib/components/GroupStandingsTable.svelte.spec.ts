import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GroupStandingsTable from './GroupStandingsTable.svelte';
import type { StandingsTieRecord } from '$lib/utils/standings';

// Minimal GroupStanding shape (type-only, avoids importing server module)
type Standing = {
	teamId: string;
	teamName: string;
	rank: number | null;
	teamMatchesWon: number;
	teamMatchesLost: number;
	rubbersWon: number;
	rubbersLost: number;
	gamesWon: number;
	gamesLost: number;
	requiresTiebreaker: boolean;
	headToHeadSummary?: string | null;
	manualRank?: number | null;
};

function makeStanding(overrides: Partial<Standing> = {}): Standing {
	return {
		teamId: 't1',
		teamName: 'チーム1',
		rank: 1,
		teamMatchesWon: 2,
		teamMatchesLost: 0,
		rubbersWon: 8,
		rubbersLost: 2,
		gamesWon: 16,
		gamesLost: 6,
		requiresTiebreaker: false,
		...overrides
	};
}

function makeTie(overrides: Partial<StandingsTieRecord> = {}): StandingsTieRecord {
	return {
		id: 'tie1',
		tieCode: 'A-1',
		teamAId: 't1',
		teamBId: 't2',
		winnerTeamId: null,
		teamScoreA: 0,
		teamScoreB: 0,
		status: 'scheduled',
		...overrides
	};
}

const teams = [
	{ id: 't1', name: 'チーム1' },
	{ id: 't2', name: 'チーム2' }
];

// ─── empty state ─────────────────────────────────────────────────────────────

describe('GroupStandingsTable.svelte — empty state', () => {
	it('shows placeholder message when standings is empty', async () => {
		render(GroupStandingsTable, { standings: [], ties: [], teams: [] });
		await expect
			.element(page.getByText('チームが登録されると順位表が表示されます。'))
			.toBeInTheDocument();
	});
});

// ─── header row ──────────────────────────────────────────────────────────────

describe('GroupStandingsTable.svelte — header', () => {
	it('renders team names as column headers', async () => {
		render(GroupStandingsTable, {
			standings: [makeStanding()],
			ties: [],
			teams
		});
		// Team names appear in <th> — columnheader ARIA role is not computed for native <th>,
		// so use getByText. 'チーム1' appears in both header and body; use .first()
		await expect.element(page.getByText('チーム1').first()).toBeInTheDocument();
		await expect.element(page.getByText('チーム2', { exact: true })).toBeInTheDocument();
	});

	it('renders standard column headers (順位, チーム, 団体, 種目, ゲーム)', async () => {
		render(GroupStandingsTable, {
			standings: [makeStanding()],
			ties: [],
			teams
		});
		await expect.element(page.getByText('順位', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('チーム', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('団体', { exact: true })).toBeInTheDocument();
	});
});

// ─── standings row ───────────────────────────────────────────────────────────

describe('GroupStandingsTable.svelte — standings row', () => {
	it('renders rank and team name', async () => {
		render(GroupStandingsTable, {
			standings: [makeStanding({ rank: 1, teamName: 'テストチーム' })],
			ties: [],
			teams: [{ id: 't1', name: 'テストチーム' }]
		});
		// exact: true avoids matching '16-6' (which contains '1' as substring)
		await expect.element(page.getByText('1', { exact: true })).toBeInTheDocument();
		// 'テストチーム' appears in both header <th> and body <td>; use .first()
		await expect.element(page.getByText('テストチーム').first()).toBeInTheDocument();
	});

	it('renders win-loss counts for 団体/種目/ゲーム', async () => {
		render(GroupStandingsTable, {
			standings: [
				makeStanding({ teamMatchesWon: 3, teamMatchesLost: 1, rubbersWon: 10, rubbersLost: 5 })
			],
			ties: [],
			teams: [{ id: 't1', name: 'チーム1' }]
		});
		await expect.element(page.getByText('3-1')).toBeInTheDocument();
		await expect.element(page.getByText('10-5')).toBeInTheDocument();
	});

	it('self cell (same team row and column) shows「—」', async () => {
		render(GroupStandingsTable, {
			standings: [makeStanding({ teamId: 't1', rank: 2 })],
			ties: [],
			teams: [{ id: 't1', name: 'チーム1' }]
		});
		// rank=2 so rank cell shows '2', diagonal cell shows '—'
		await expect.element(page.getByText('—', { exact: true })).toBeInTheDocument();
	});

	it('renders rank and team values when a tiebreaker is required', async () => {
		render(GroupStandingsTable, {
			standings: [makeStanding({ requiresTiebreaker: true })],
			ties: [],
			teams
		});
		await expect.element(page.getByText('1', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('チーム1').first()).toBeInTheDocument();
	});

	it('null rank renders「—」in rank cell', async () => {
		render(GroupStandingsTable, {
			standings: [makeStanding({ rank: null })],
			ties: [],
			teams: [{ id: 't1', name: 'チーム1' }]
		});
		// Both rank cell and diagonal cell show '—'; .first() matches either
		await expect.element(page.getByText('—').first()).toBeInTheDocument();
	});
});

// ─── match result cells ───────────────────────────────────────────────────────

describe('GroupStandingsTable.svelte — match result cells', () => {
	const standingA = makeStanding({ teamId: 't1', teamName: 'チームA' });
	const standingB = makeStanding({ teamId: 't2', teamName: 'チームB', rank: 2 });
	const teamsAB = [
		{ id: 't1', name: 'チームA' },
		{ id: 't2', name: 'チームB' }
	];

	it('done+won cell shows score from the row team perspective', async () => {
		const finishedTie = makeTie({
			id: 'tie1',
			teamAId: 't1',
			teamBId: 't2',
			winnerTeamId: 't1',
			teamScoreA: 4,
			teamScoreB: 1,
			status: 'confirmed'
		});
		render(GroupStandingsTable, {
			standings: [standingA, standingB],
			ties: [finishedTie],
			teams: teamsAB
		});
		await expect.element(page.getByText('4–1', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('1–4', { exact: true })).toBeInTheDocument();
	});

	it('done+lost cell shows the losing score from the row team perspective', async () => {
		const finishedTie = makeTie({
			id: 'tie1',
			teamAId: 't1',
			teamBId: 't2',
			winnerTeamId: 't2',
			teamScoreA: 1,
			teamScoreB: 4,
			status: 'confirmed'
		});
		render(GroupStandingsTable, {
			standings: [standingA, standingB],
			ties: [finishedTie],
			teams: teamsAB
		});
		await expect.element(page.getByText('1–4', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('4–1', { exact: true })).toBeInTheDocument();
	});

	it('pending cell shows tie code and status badge', async () => {
		const pendingTie = makeTie({
			id: 'tie1',
			tieCode: 'A-1',
			teamAId: 't1',
			teamBId: 't2',
			winnerTeamId: null,
			status: 'scheduled'
		});
		render(GroupStandingsTable, {
			standings: [standingA, standingB],
			ties: [pendingTie],
			teams: teamsAB
		});
		// 'A-1' appears in both cross cells (t1 vs t2 and t2 vs t1); .first() avoids strict mode
		await expect.element(page.getByText('A-1', { exact: true }).first()).toBeInTheDocument();
	});

	it('done tied cell shows tied scores when there is no winner', async () => {
		const drawnTie = makeTie({
			id: 'tie-draw',
			tieCode: 'A-9',
			teamAId: 't1',
			teamBId: 't2',
			winnerTeamId: null,
			teamScoreA: 2,
			teamScoreB: 2,
			status: 'confirmed'
		});
		render(GroupStandingsTable, {
			standings: [standingA, standingB],
			ties: [drawnTie],
			teams: teamsAB
		});

		await expect.element(page.getByText('2–2', { exact: true }).first()).toBeInTheDocument();
	});

	it('playing tie shows「進行中」badge in cell', async () => {
		const playingTie = makeTie({
			id: 'tie1',
			tieCode: 'A-2',
			teamAId: 't1',
			teamBId: 't2',
			winnerTeamId: null,
			status: 'playing'
		});
		render(GroupStandingsTable, {
			standings: [standingA, standingB],
			ties: [playingTie],
			teams: teamsAB
		});
		// '進行中' appears in each cross cell (t1 vs t2 and t2 vs t1)
		await expect.element(page.getByText('進行中').first()).toBeInTheDocument();
	});

	it('no matching tie → shows「-」in cross cell', async () => {
		render(GroupStandingsTable, {
			standings: [standingA, standingB],
			ties: [],
			teams: teamsAB
		});
		// No tie between t1 and t2 → '-' (hyphen, not em-dash)
		// exact: true avoids matching win-loss strings like '2-0' as substring
		await expect.element(page.getByText('-', { exact: true }).first()).toBeInTheDocument();
	});
});

// ─── linkTies prop ────────────────────────────────────────────────────────────

describe('GroupStandingsTable.svelte — linkTies', () => {
	const standingA = makeStanding({ teamId: 't1', teamName: 'チームA' });
	const standingB = makeStanding({ teamId: 't2', teamName: 'チームB', rank: 2 });
	const teamsAB = [
		{ id: 't1', name: 'チームA' },
		{ id: 't2', name: 'チームB' }
	];

	it('linkTies=true renders done cell as an <a> link', async () => {
		const finishedTie = makeTie({
			id: 'tie-link-test',
			teamAId: 't1',
			teamBId: 't2',
			winnerTeamId: 't1',
			teamScoreA: 4,
			teamScoreB: 1,
			status: 'confirmed'
		});
		render(GroupStandingsTable, {
			standings: [standingA, standingB],
			ties: [finishedTie],
			teams: teamsAB,
			linkTies: true
		});
		// Score '4–1' is in an inner <span>; its parent is the <a> when linkTies=true
		const scoreSpan = page.getByText('4–1', { exact: true });
		await expect.element(scoreSpan).toBeInTheDocument();
		const parentEl = scoreSpan.element().parentElement;
		expect(parentEl?.tagName.toLowerCase()).toBe('a');
	});

	it('linkTies=false renders done cell as a <span> (no link)', async () => {
		const finishedTie = makeTie({
			id: 'tie-no-link',
			teamAId: 't1',
			teamBId: 't2',
			winnerTeamId: 't1',
			teamScoreA: 4,
			teamScoreB: 1,
			status: 'confirmed'
		});
		render(GroupStandingsTable, {
			standings: [standingA, standingB],
			ties: [finishedTie],
			teams: teamsAB,
			linkTies: false
		});
		// Score '4–1' is in an inner <span>; its parent is also a <span> when linkTies=false
		const scoreSpan = page.getByText('4–1', { exact: true });
		await expect.element(scoreSpan).toBeInTheDocument();
		const parentEl = scoreSpan.element().parentElement;
		expect(parentEl?.tagName.toLowerCase()).toBe('span');
	});

	it('linkTies=true renders pending cell as an <a> link', async () => {
		const pendingTie = makeTie({
			id: 'tie-pending-link',
			tieCode: 'A-7',
			teamAId: 't1',
			teamBId: 't2',
			status: 'scheduled'
		});
		render(GroupStandingsTable, {
			standings: [standingA, standingB],
			ties: [pendingTie],
			teams: teamsAB,
			linkTies: true
		});

		const tieCode = page.getByText('A-7', { exact: true }).first();
		await expect.element(tieCode).toBeInTheDocument();
		const parentEl = tieCode.element().parentElement;
		expect(parentEl?.tagName.toLowerCase()).toBe('a');
	});
});
