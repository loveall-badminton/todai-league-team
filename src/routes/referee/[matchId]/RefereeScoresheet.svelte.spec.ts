import type { GameState, MatchPlayer } from '$lib/domain/types';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import RefereeScoresheet from './RefereeScoresheet.svelte';
import type { EventRow } from './scoresheetHelpers';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makePlayer(id: string, side: 'A' | 'B', name: string): MatchPlayer {
	return { id, side, order: 1, name };
}

function makeGameState(
	gameNo: number,
	scoreA: number,
	scoreB: number,
	winnerSide: 'A' | 'B' | null = null
): GameState {
	return {
		gameNo,
		score: { A: scoreA, B: scoreB },
		winnerSide,
		midGameIntervalTaken: false,
		changeEndsRequired: false,
		changeEndsCompleted: false
	};
}

let seqNo = 0;

function resetSeq() {
	seqNo = 0;
}

function matchStartedEvent(serverId: string, receiverId: string): EventRow {
	return {
		seqNo: ++seqNo,
		eventType: 'match_started',
		side: null,
		gameNo: 1,
		scoreAAfter: null,
		scoreBAfter: null,
		serverPlayerIdBefore: null,
		serverPlayerIdAfter: serverId,
		receiverPlayerIdBefore: null,
		receiverPlayerIdAfter: receiverId,
		targetSeqNo: null
	};
}

function rallyWonEvent(
	side: 'A' | 'B',
	scoreA: number,
	scoreB: number,
	serverBefore: string,
	serverAfter: string
): EventRow {
	return {
		seqNo: ++seqNo,
		eventType: 'rally_won',
		side,
		gameNo: null,
		scoreAAfter: scoreA,
		scoreBAfter: scoreB,
		serverPlayerIdBefore: serverBefore,
		serverPlayerIdAfter: serverAfter,
		receiverPlayerIdBefore: null,
		receiverPlayerIdAfter: null,
		targetSeqNo: null
	};
}

// ─── empty state ──────────────────────────────────────────────────────────────

// NOTE: 'events' is a Svelte reserved option name, so ALL props must be placed
// under the `props` key when calling render().

describe('RefereeScoresheet.svelte — empty state', () => {
	it('shows「得点データがありません」when events is empty', async () => {
		render(RefereeScoresheet, {
			props: { events: [], games: [], sideAPlayers: [], sideBPlayers: [], players: [] }
		});
		await expect.element(page.getByText('得点データがありません')).toBeInTheDocument();
	});

	it('shows「スコアシート」heading', async () => {
		render(RefereeScoresheet, {
			props: { events: [], games: [], sideAPlayers: [], sideBPlayers: [], players: [] }
		});
		await expect.element(page.getByText('スコアシート')).toBeInTheDocument();
	});
});

// ─── game rendering ───────────────────────────────────────────────────────────

describe('RefereeScoresheet.svelte — game section', () => {
	it('renders「第1ゲーム」label when game 1 exists', async () => {
		resetSeq();
		const sA = makePlayer('s1', 'A', '田中');
		const rB = makePlayer('r1', 'B', '鈴木');

		render(RefereeScoresheet, {
			props: {
				events: [matchStartedEvent('s1', 'r1')],
				games: [],
				sideAPlayers: [sA],
				sideBPlayers: [rB],
				players: [sA, rB]
			}
		});
		await expect.element(page.getByText('第1ゲーム')).toBeInTheDocument();
	});

	it('renders player A name in row header', async () => {
		resetSeq();
		const sA = makePlayer('s1', 'A', '田中太郎');
		const rB = makePlayer('r1', 'B', '鈴木一郎');

		render(RefereeScoresheet, {
			props: {
				events: [matchStartedEvent('s1', 'r1')],
				games: [],
				sideAPlayers: [sA],
				sideBPlayers: [rB],
				players: [sA, rB]
			}
		});
		await expect.element(page.getByText('田中太郎')).toBeInTheDocument();
	});

	it('renders player B name in row header', async () => {
		resetSeq();
		const sA = makePlayer('s1', 'A', '山田花子');
		const rB = makePlayer('r1', 'B', '佐藤美咲');

		render(RefereeScoresheet, {
			props: {
				events: [matchStartedEvent('s1', 'r1')],
				games: [],
				sideAPlayers: [sA],
				sideBPlayers: [rB],
				players: [sA, rB]
			}
		});
		await expect.element(page.getByText('佐藤美咲')).toBeInTheDocument();
	});

	it('renders score numbers in cells from rally events', async () => {
		resetSeq();
		const sA = makePlayer('s1', 'A', '田中');
		const rB = makePlayer('r1', 'B', '鈴木');

		render(RefereeScoresheet, {
			props: {
				events: [
					matchStartedEvent('s1', 'r1'),
					rallyWonEvent('A', 1, 0, 's1', 's1'),
					rallyWonEvent('A', 2, 0, 's1', 's1')
				],
				games: [],
				sideAPlayers: [sA],
				sideBPlayers: [rB],
				players: [sA, rB]
			}
		});
		// exact: true avoids matching substrings (e.g. '1' in '21')
		await expect.element(page.getByText('1', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('2', { exact: true })).toBeInTheDocument();
	});

	it('renders winner score badge when winnerSide is set', async () => {
		resetSeq();
		const sA = makePlayer('s1', 'A', '田中');
		const rB = makePlayer('r1', 'B', '鈴木');
		const games = [makeGameState(1, 21, 15, 'A')];

		render(RefereeScoresheet, {
			props: {
				events: [matchStartedEvent('s1', 'r1')],
				games,
				sideAPlayers: [sA],
				sideBPlayers: [rB],
				players: [sA, rB]
			}
		});
		// Winner badge shows final score with en-dash separator
		await expect.element(page.getByText('21–15')).toBeInTheDocument();
	});

	it('no winner badge when winnerSide is null', async () => {
		resetSeq();
		const sA = makePlayer('s1', 'A', '田中');
		const rB = makePlayer('r1', 'B', '鈴木');
		const games = [makeGameState(1, 10, 8, null)];

		render(RefereeScoresheet, {
			props: {
				events: [matchStartedEvent('s1', 'r1')],
				games,
				sideAPlayers: [sA],
				sideBPlayers: [rB],
				players: [sA, rB]
			}
		});
		// No winner → no score badge matching "NN–NN" format
		await expect.element(page.getByText(/^\d+–\d+$/)).not.toBeInTheDocument();
	});
});

// ─── multi-game ───────────────────────────────────────────────────────────────

describe('RefereeScoresheet.svelte — multi-game', () => {
	it('renders both game sections for a two-game match', async () => {
		resetSeq();
		const sA = makePlayer('s1', 'A', '田中');
		const rB = makePlayer('r1', 'B', '鈴木');

		const gameStartedEvent: EventRow = {
			seqNo: ++seqNo,
			eventType: 'game_started',
			side: null,
			gameNo: 2,
			scoreAAfter: null,
			scoreBAfter: null,
			serverPlayerIdBefore: null,
			serverPlayerIdAfter: 'r1',
			receiverPlayerIdBefore: null,
			receiverPlayerIdAfter: 's1',
			targetSeqNo: null
		};

		render(RefereeScoresheet, {
			props: {
				events: [matchStartedEvent('s1', 'r1'), gameStartedEvent],
				games: [makeGameState(1, 21, 15, 'A')],
				sideAPlayers: [sA],
				sideBPlayers: [rB],
				players: [sA, rB]
			}
		});
		await expect.element(page.getByText('第1ゲーム')).toBeInTheDocument();
		await expect.element(page.getByText('第2ゲーム')).toBeInTheDocument();
	});
});

// ─── undo filtering ───────────────────────────────────────────────────────────

describe('RefereeScoresheet.svelte — undo filtering', () => {
	it('undone rally score does not appear in scoresheet', async () => {
		resetSeq();
		const sA = makePlayer('s1', 'A', '田中');
		const rB = makePlayer('r1', 'B', '鈴木');

		const rally = rallyWonEvent('A', 5, 0, 's1', 's1');
		const rallySeq = rally.seqNo;
		const undoEvent: EventRow = {
			seqNo: ++seqNo,
			eventType: 'undo_applied',
			side: null,
			gameNo: null,
			scoreAAfter: null,
			scoreBAfter: null,
			serverPlayerIdBefore: null,
			serverPlayerIdAfter: null,
			receiverPlayerIdBefore: null,
			receiverPlayerIdAfter: null,
			targetSeqNo: rallySeq
		};

		render(RefereeScoresheet, {
			props: {
				events: [matchStartedEvent('s1', 'r1'), rally, undoEvent],
				games: [],
				sideAPlayers: [sA],
				sideBPlayers: [rB],
				players: [sA, rB]
			}
		});
		// Score 5 should not appear (undone); exact: true avoids matching '15', '5面' etc.
		await expect.element(page.getByText('5', { exact: true })).not.toBeInTheDocument();
	});
});
