import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TieRubberList from './TieRubberList.svelte';
import type { RubberRow } from './TieRubberList.svelte';

function makeRubber(overrides: Partial<RubberRow> = {}): RubberRow {
	return {
		id: 'r1',
		code: 'WD1',
		status: 'scheduled',
		winnerSide: null,
		playersA: ['田中花子'],
		playersB: ['鈴木一郎'],
		loserLabel: null,
		gamesScore: null,
		gameDetails: [],
		...overrides
	};
}

// ─── compact variant (default) ───────────────────────────────────────────────

describe('TieRubberList.svelte — compact variant', () => {
	it('renders team names in header', async () => {
		render(TieRubberList, {
			rubbers: [makeRubber()],
			teamAName: '東大A',
			teamBName: '東大B'
		});
		await expect.element(page.getByText('東大A')).toBeInTheDocument();
		await expect.element(page.getByText('東大B')).toBeInTheDocument();
	});

	it('renders rubber label from code', async () => {
		render(TieRubberList, {
			rubbers: [makeRubber({ code: 'WD1' })],
			teamAName: 'A',
			teamBName: 'B'
		});
		// rubberLabel('WD1') = '女子ダブルス'
		await expect.element(page.getByText('女子ダブルス')).toBeInTheDocument();
	});

	it('renders player names for both sides', async () => {
		render(TieRubberList, {
			rubbers: [makeRubber({ playersA: ['山田A', '山田B'], playersB: ['佐藤A', '佐藤B'] })],
			teamAName: 'A',
			teamBName: 'B'
		});
		await expect.element(page.getByText('山田A')).toBeInTheDocument();
		await expect.element(page.getByText('山田B')).toBeInTheDocument();
		await expect.element(page.getByText('佐藤A')).toBeInTheDocument();
		await expect.element(page.getByText('佐藤B')).toBeInTheDocument();
	});

	it('shows「—」when a side has no players', async () => {
		render(TieRubberList, {
			rubbers: [makeRubber({ playersA: [], playersB: [] })],
			teamAName: 'A',
			teamBName: 'B'
		});
		// Both sides empty → two「—」marks
		const dashes = page.getByText('—');
		await expect.element(dashes.first()).toBeInTheDocument();
	});

	it('shows status label when gamesScore is null', async () => {
		render(TieRubberList, {
			rubbers: [makeRubber({ status: 'scheduled', gamesScore: null })],
			teamAName: 'A',
			teamBName: 'B'
		});
		// rubberStatusLabel('scheduled') = '予定'
		await expect.element(page.getByText('予定')).toBeInTheDocument();
	});

	it('shows gamesScore instead of status when provided', async () => {
		render(TieRubberList, {
			rubbers: [makeRubber({ gamesScore: '2–0', gameDetails: [] })],
			teamAName: 'A',
			teamBName: 'B'
		});
		await expect.element(page.getByText('2–0')).toBeInTheDocument();
	});

	it('shows per-game score details under gamesScore', async () => {
		render(TieRubberList, {
			rubbers: [
				makeRubber({
					gamesScore: '2–0',
					gameDetails: [
						{ gameNo: 1, scoreA: 21, scoreB: 15 },
						{ gameNo: 2, scoreA: 21, scoreB: 18 }
					]
				})
			],
			teamAName: 'A',
			teamBName: 'B'
		});
		await expect.element(page.getByText('21–15')).toBeInTheDocument();
		await expect.element(page.getByText('21–18')).toBeInTheDocument();
	});

	it('shows loserLabel under the losing side', async () => {
		render(TieRubberList, {
			rubbers: [makeRubber({ winnerSide: 'A', loserLabel: '棄権' })],
			teamAName: 'A',
			teamBName: 'B'
		});
		await expect.element(page.getByText('棄権')).toBeInTheDocument();
	});

	it('does not show loserLabel when winnerSide is null', async () => {
		render(TieRubberList, {
			rubbers: [makeRubber({ winnerSide: null, loserLabel: '棄権' })],
			teamAName: 'A',
			teamBName: 'B'
		});
		// loserLabel only appears when there is a winner
		const el = page.getByText('棄権');
		await expect.element(el).not.toBeInTheDocument();
	});

	it('shows playing status while a rubber is in progress', async () => {
		render(TieRubberList, {
			rubbers: [makeRubber({ status: 'playing' })],
			teamAName: 'A',
			teamBName: 'B'
		});
		await expect.element(page.getByText('進行中')).toBeInTheDocument();
	});

	it('renders winner player name with the final game score', async () => {
		render(TieRubberList, {
			rubbers: [makeRubber({ winnerSide: 'A', playersA: ['勝者選手'], gamesScore: '2–0' })],
			teamAName: 'A',
			teamBName: 'B'
		});
		await expect.element(page.getByText('勝者選手')).toBeInTheDocument();
		await expect.element(page.getByText('2–0', { exact: true })).toBeInTheDocument();
	});

	it('shows current gamesScore while match is playing without a winner', async () => {
		render(TieRubberList, {
			rubbers: [makeRubber({ status: 'playing', winnerSide: null, gamesScore: '1–0' })],
			teamAName: 'A',
			teamBName: 'B'
		});

		await expect.element(page.getByText('1–0', { exact: true })).toBeInTheDocument();
	});

	it('shows all game details while match is playing', async () => {
		render(TieRubberList, {
			rubbers: [
				makeRubber({
					status: 'playing',
					gamesScore: '1–0',
					gameDetails: [
						{ gameNo: 1, scoreA: 21, scoreB: 15 },
						{ gameNo: 2, scoreA: 10, scoreB: 8 }
					]
				})
			],
			teamAName: 'A',
			teamBName: 'B'
		});

		await expect.element(page.getByText('21–15')).toBeInTheDocument();
		await expect.element(page.getByText('10–8')).toBeInTheDocument();
	});

	it('shows winner gamesScore after the rubber has a winner', async () => {
		render(TieRubberList, {
			rubbers: [makeRubber({ winnerSide: 'B', gamesScore: '1–2' })],
			teamAName: 'A',
			teamBName: 'B'
		});

		await expect.element(page.getByText('1–2', { exact: true })).toBeInTheDocument();
	});

	it('multiple rubbers are all rendered', async () => {
		render(TieRubberList, {
			rubbers: [
				makeRubber({ id: 'r1', code: 'WD1' }),
				makeRubber({ id: 'r2', code: 'XD1' }),
				makeRubber({ id: 'r3', code: 'MD1' })
			],
			teamAName: 'A',
			teamBName: 'B'
		});
		await expect.element(page.getByText('女子ダブルス')).toBeInTheDocument();
		await expect.element(page.getByText('ミックスダブルス')).toBeInTheDocument();
		await expect.element(page.getByText('男子ダブルス1')).toBeInTheDocument();
	});
});

// ─── table variant ───────────────────────────────────────────────────────────

describe('TieRubberList.svelte — table variant', () => {
	it('renders column headers with team names', async () => {
		render(TieRubberList, {
			rubbers: [makeRubber()],
			teamAName: 'チームX',
			teamBName: 'チームY',
			variant: 'table'
		});
		// Team names appear in <th> elements — use getByText since columnheader role isn't computed
		await expect.element(page.getByText('チームX', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('チームY', { exact: true })).toBeInTheDocument();
	});

	it('shows「種目が作成されていません」when rubbers array is empty', async () => {
		render(TieRubberList, {
			rubbers: [],
			teamAName: 'A',
			teamBName: 'B',
			variant: 'table'
		});
		await expect.element(page.getByText('種目が作成されていません')).toBeInTheDocument();
	});

	it('shows「—」in score cell when gamesScore is null (table variant)', async () => {
		render(TieRubberList, {
			rubbers: [makeRubber({ gamesScore: null, playersA: [], playersB: [] })],
			teamAName: 'A',
			teamBName: 'B',
			variant: 'table'
		});
		// Empty player sides render '—' placeholders
		await expect.element(page.getByText('—').first()).toBeInTheDocument();
	});

	it('renders a playing rubber row in table variant', async () => {
		render(TieRubberList, {
			rubbers: [makeRubber({ status: 'playing' })],
			teamAName: 'A',
			teamBName: 'B',
			variant: 'table'
		});
		await expect.element(page.getByText('女子ダブルス')).toBeInTheDocument();
		await expect.element(page.getByText('田中花子')).toBeInTheDocument();
		await expect.element(page.getByText('鈴木一郎')).toBeInTheDocument();
		await expect.element(page.getByText('—')).toBeInTheDocument();
	});
});
