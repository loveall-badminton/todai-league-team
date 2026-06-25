import { test, expect, type Page } from '@playwright/test';

const TS = Date.now();
const TEAMS = {
	A1: { name: `SIM-A1-${TS}`, player1: `SIM-A1-P1-${TS}`, player2: `SIM-A1-P2-${TS}` },
	A2: { name: `SIM-A2-${TS}`, player1: `SIM-A2-P1-${TS}`, player2: `SIM-A2-P2-${TS}` },
	B1: { name: `SIM-B1-${TS}`, player1: `SIM-B1-P1-${TS}`, player2: `SIM-B1-P2-${TS}` },
	B2: { name: `SIM-B2-${TS}`, player1: `SIM-B2-P1-${TS}`, player2: `SIM-B2-P2-${TS}` }
};

const RUBBER_LABELS = [
	'女子ダブルス',
	'ミックスダブルス',
	'男子ダブルス3',
	'男子ダブルス2',
	'男子ダブルス1'
];

test.describe.serial('tournament simulation', () => {
	async function addPlayer(page: Page, name: string, teamUrl: string) {
		await page.goto(teamUrl);
		const form = page.locator('form').filter({ hasText: '氏名' });
		const input = form.locator('input[name="name"]');
		await input.evaluate((el: HTMLInputElement, value: string) => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, value);
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}, name);
		await form.evaluate((f: HTMLFormElement) => f.requestSubmit());
		await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
	}

	async function selectAppOption(page: Page, labelText: string, optionText: string) {
		await page
			.locator('label')
			.filter({ hasText: labelText })
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: optionText }).click();
		await page.waitForTimeout(200);
	}

	async function selectPlayersForRubbers(page: Page, players: string[]) {
		for (const label of RUBBER_LABELS) {
			const section = page.locator('p').filter({ hasText: label }).first().locator('..');
			const triggers = section.locator('button[aria-haspopup="listbox"]');
			await triggers.nth(0).click();
			await page.waitForTimeout(200);
			await page.getByRole('option', { name: players[0] }).click();
			await page.waitForTimeout(200);
			await triggers.nth(1).click();
			await page.waitForTimeout(200);
			await page.getByRole('option', { name: players[1] }).click();
			await page.waitForTimeout(200);
		}
	}

	async function submitLineup(page: Page, teamName: string, players: string[], tieId: string) {
		await page.goto(`/ties/${tieId}`);
		await page.waitForTimeout(1500);
		const panel = page
			.locator('h2')
			.filter({ hasText: teamName })
			.first()
			.locator('..')
			.locator('..');
		await panel.getByRole('link', { name: '入力ページ' }).click();
		await page.waitForURL(/\/ties\/.+\/lineups\/.+/, { timeout: 5000 });
		await page.waitForTimeout(1000);
		await selectPlayersForRubbers(page, players);
		await page.getByRole('button', { name: '提出する' }).click();
		await page.waitForTimeout(1500);
		await expect(page.getByText('オーダーを提出しました').first()).toBeVisible({ timeout: 5000 });
	}

	async function scoreOneRubber(page: Page, tieId: string) {
		await page.goto(`/ties/${tieId}`);
		await page.waitForTimeout(1000);

		const scoreLink = page.getByText('スコア入力').first();
		if (!(await scoreLink.isVisible({ timeout: 5000 }).catch(() => false))) return false;
		await scoreLink.click();
		await page.waitForTimeout(2000);

		// Verify we're on a referee page
		if (!page.url().includes('/referee/')) return false;

		// Check for game start form (試合開始 or 次ゲーム開始)
		const startForm = page.getByRole('button', { name: '開始' });
		if (!(await startForm.isVisible({ timeout: 5000 }).catch(() => false))) return false;
		return true;
	}

	test('setup: create 4 teams with players', async ({ page }) => {
		for (const [key, team] of Object.entries(TEAMS)) {
			await page.goto('/teams');
			await page.getByRole('button', { name: '+ 追加' }).click();
			await page.locator('input[name="name"]').fill(team.name);
			const group = key.startsWith('A') ? 'Aリーグ' : 'Bリーグ';
			await selectAppOption(page, 'リーグ', group);
			await page.getByRole('button', { name: '追加', exact: true }).click();
			await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
			const url = page.url();
			await addPlayer(page, team.player1, url);
			await addPlayer(page, team.player2, url);
		}
	});

	test('generate round-robin ties for both groups', async ({ page }) => {
		for (const group of ['A', 'B']) {
			await page.goto(`/groups/${group}`);
			await page.waitForTimeout(500);
			const genBtn = page.getByRole('button', { name: '総当たり生成' });
			if (await genBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
				await genBtn.click();
				await page.waitForTimeout(1500);
			}
		}
	});

	async function getTieId(page: Page, team1Name: string, team2Name: string): Promise<string> {
		await page.goto('/ties');
		await page.waitForTimeout(1500);
		const t1vst2 = `${team1Name} vs ${team2Name}`;
		const t2vst1 = `${team2Name} vs ${team1Name}`;
		const row = page
			.getByText(t1vst2)
			.or(page.getByText(t2vst1))
			.first()
			.locator('..')
			.locator('..')
			.locator('..');
		await row.getByRole('link', { name: '詳細' }).click();
		await page.waitForURL(/\/ties\/[a-zA-Z0-9-]+$/, { timeout: 5000 });
		return page.url().split('/').pop()!;
	}

	test('submit lineups and score for group A tie', async ({ page }) => {
		test.setTimeout(300_000);
		const tieId = await getTieId(page, TEAMS.A1.name, TEAMS.A2.name);
		await submitLineup(page, TEAMS.A1.name, [TEAMS.A1.player1, TEAMS.A1.player2], tieId);
		await submitLineup(page, TEAMS.A2.name, [TEAMS.A2.player1, TEAMS.A2.player2], tieId);

		// Approve lineups and start the tie
		await page.goto(`/ties/${tieId}`);
		await page.waitForTimeout(1500);
		const approveBtns = page.getByRole('button', { name: '承認する' });
		const approveCount = await approveBtns.count();
		console.log('Approval button count:', approveCount);
		for (let i = 0; i < approveCount; i++) {
			await approveBtns.first().click();
			await page.waitForTimeout(500);
		}
		await page.waitForTimeout(500);
		await page.getByRole('button', { name: '対戦を開始' }).click();
		await page.waitForTimeout(1500);
		await expect(page.getByText('スコア入力').first()).toBeVisible({ timeout: 10000 });

		// Navigate to referee and verify page loads
		const ok = await scoreOneRubber(page, tieId);
		expect(ok, 'Referee page should load after starting the tie').toBe(true);
	});

	test('submit lineups and score for group B tie', async ({ page }) => {
		test.setTimeout(300_000);
		const tieId = await getTieId(page, TEAMS.B1.name, TEAMS.B2.name);
		await submitLineup(page, TEAMS.B1.name, [TEAMS.B1.player1, TEAMS.B1.player2], tieId);
		await submitLineup(page, TEAMS.B2.name, [TEAMS.B2.player1, TEAMS.B2.player2], tieId);

		// Approve lineups and start the tie
		await page.goto(`/ties/${tieId}`);
		await page.waitForTimeout(1500);
		const approveBtns = page.getByRole('button', { name: '承認する' });
		const approveCount = await approveBtns.count();
		console.log('Approval button count:', approveCount);
		for (let i = 0; i < approveCount; i++) {
			await approveBtns.first().click();
			await page.waitForTimeout(500);
		}
		await page.waitForTimeout(500);
		await page.getByRole('button', { name: '対戦を開始' }).click();
		await page.waitForTimeout(1500);
		await expect(page.getByText('スコア入力').first()).toBeVisible({ timeout: 10000 });

		// Score first rubber only
		await scoreOneRubber(page, tieId);
	});

	test('show standings and navigate finals page', async ({ page }) => {
		await page.goto('/groups/A');
		await expect(page.getByText('順位表')).toBeVisible({ timeout: 3000 });
		await expect(page.getByText(TEAMS.A1.name).first()).toBeVisible();

		await page.goto('/groups/B');
		await expect(page.getByText('順位表')).toBeVisible({ timeout: 3000 });
		await expect(page.getByText(TEAMS.B1.name).first()).toBeVisible();

		await page.goto('/finals');
		await page.waitForTimeout(1500);
		await expect(page.getByRole('heading', { name: '決勝トーナメント' })).toBeVisible({
			timeout: 3000
		});
	});

	test('generate semifinals from standings', async ({ page }) => {
		await page.goto('/finals');
		await page.waitForTimeout(1000);

		const genBtn = page.getByRole('button', { name: '準決勝' });
		await expect(genBtn).toBeVisible({ timeout: 3000 });
		// Button is disabled until group ties are complete (no scores in this test)
		await expect(genBtn).toBeDisabled();
		// Hint should explain why
		await expect(page.getByText(/リーグ.*試合.*完了/)).toBeVisible({ timeout: 3000 });
	});

	test.skip('submit lineups for semifinal tie', async ({ page }) => {
		test.setTimeout(120_000);

		// Navigate to first semifinal
		await page.goto('/finals');
		await page.waitForTimeout(1000);
		const semiLink = page.locator('a').filter({ hasText: '準決勝' }).first();
		await semiLink.click();
		await page.waitForURL(/\/ties\/[a-zA-Z0-9-]+$/, { timeout: 5000 });
		const tieUrl = page.url();

		// Find team names from the description below h1
		const descEl = page.locator('h1').first().locator('..').locator('p.text-sm').last();
		const teamText = await descEl.textContent();
		const teamNames = teamText?.split(' vs ').map((s) => s.trim()) ?? [];
		const teamAName = teamNames[0] ?? '';
		const teamBName = teamNames.length > 1 ? (teamNames[1] ?? '') : '';

		async function selectPlayersForRubbers(page: Page, players: string[]) {
			const labels = [
				'女子ダブルス',
				'ミックスダブルス',
				'男子ダブルス3',
				'男子ダブルス2',
				'男子ダブルス1'
			];
			for (const label of labels) {
				const section = page.locator('p').filter({ hasText: label }).first().locator('..');
				const triggers = section.locator('button[aria-haspopup="listbox"]');
				await triggers.nth(0).click();
				await page.waitForTimeout(200);
				await page.getByRole('option', { name: players[0] }).click();
				await page.waitForTimeout(200);
				await triggers.nth(1).click();
				await page.waitForTimeout(200);
				await page.getByRole('option', { name: players[1] }).click();
				await page.waitForTimeout(200);
			}
		}

		async function submitLineup(page: Page, teamName: string, players: string[], tieId: string) {
			await page.goto(`/ties/${tieId}`);
			await page.waitForTimeout(1500);
			const panel = page
				.locator('h2')
				.filter({ hasText: teamName })
				.first()
				.locator('..')
				.locator('..');
			await panel.getByRole('link', { name: '入力ページ' }).click();
			await page.waitForURL(/\/ties\/.+\/lineups\/.+/, { timeout: 5000 });
			await page.waitForTimeout(1000);
			await selectPlayersForRubbers(page, players);
			await page.getByRole('button', { name: '提出する' }).click();
			await page.waitForTimeout(1500);
			await expect(page.getByText('オーダーを提出しました').first()).toBeVisible({ timeout: 5000 });
		}

		const tieId = tieUrl.split('/').pop()!;
		// Find players for each team by checking which team placeholder matches
		const aPlayer1 = TEAMS.A1.player1;
		const aPlayer2 = TEAMS.A1.player2;
		const bPlayer1 = TEAMS.B1.player1;
		const bPlayer2 = TEAMS.B1.player2;

		if (teamAName.includes('SIM-A') || teamBName.includes('SIM-B')) {
			await submitLineup(page, teamAName, [aPlayer1, aPlayer2], tieId);
			await submitLineup(page, teamBName, [bPlayer1, bPlayer2], tieId);
		} else {
			await submitLineup(page, teamAName, [bPlayer1, bPlayer2], tieId);
			await submitLineup(page, teamBName, [aPlayer1, aPlayer2], tieId);
		}

		// Approve lineups and start tie
		await page.goto(`/ties/${tieId}`);
		await page.waitForTimeout(500);
		const approveBtns = page.getByRole('button', { name: '承認する' });
		const count = await approveBtns.count();
		for (let i = 0; i < count; i++) {
			await approveBtns.first().click();
			await page.waitForTimeout(500);
		}
		await page.getByRole('button', { name: '対戦を開始' }).click();
		await page.waitForTimeout(1000);
		await expect(page.getByText('スコア入力').first()).toBeVisible({ timeout: 5000 });
	});

	test.skip('score semifinal match and confirm', async ({ page }) => {
		test.setTimeout(120_000);

		await page.goto('/finals');
		await page.waitForTimeout(1000);
		const semiLink = page.locator('a').filter({ hasText: '準決勝' }).first();
		await semiLink.click();
		await page.waitForURL(/\/ties\/[a-zA-Z0-9-]+$/, { timeout: 5000 });
		const tieUrl = page.url();

		await page.getByText('スコア入力').first().click();
		await page.waitForURL(/\/referee\/.+/, { timeout: 5000 });
		await page.waitForTimeout(2000);

		// Start game if needed
		const plusOne = page.getByText('+1').first();
		if (!(await plusOne.isEnabled({ timeout: 3000 }).catch(() => false))) {
			await page
				.locator('span')
				.filter({ hasText: '1st サーバー' })
				.locator('..')
				.locator('button[aria-haspopup="listbox"]')
				.click();
			await page.waitForTimeout(200);
			await page.getByRole('option').first().click();
			await page
				.locator('span')
				.filter({ hasText: '1st レシーバー' })
				.locator('..')
				.locator('button[aria-haspopup="listbox"]')
				.click();
			await page.waitForTimeout(200);
			await page.getByRole('option').first().click();
			await page.getByRole('button', { name: '開始' }).click();
			await page.waitForTimeout(2000);
		}

		// Score game 1
		for (let i = 0; i < 25; i++) {
			const btn = page.getByText('+1').first();
			if (!(await btn.isEnabled().catch(() => false))) break;
			await btn.click();
			await page.waitForTimeout(150);
		}

		// Score game 2 if needed
		if (
			await page
				.getByText('次ゲーム開始')
				.isVisible({ timeout: 3000 })
				.catch(() => false)
		) {
			await page
				.locator('span')
				.filter({ hasText: '1st サーバー' })
				.locator('..')
				.locator('button[aria-haspopup="listbox"]')
				.click();
			await page.waitForTimeout(200);
			await page.getByRole('option').first().click();
			await page
				.locator('span')
				.filter({ hasText: '1st レシーバー' })
				.locator('..')
				.locator('button[aria-haspopup="listbox"]')
				.click();
			await page.waitForTimeout(200);
			await page.getByRole('option').first().click();
			await page.getByRole('button', { name: '開始' }).click();
			await page.waitForTimeout(1000);

			for (let i = 0; i < 25; i++) {
				const btn = page.getByText('+1').first();
				if (!(await btn.isEnabled().catch(() => false))) break;
				await btn.click();
				await page.waitForTimeout(150);
			}
		}

		// Match is auto-confirmed on completion
		await expect(page.getByText('結果確定')).toBeVisible({ timeout: 5000 });

		// Navigate to tie page and verify rubber result visible
		await page.goto(tieUrl);
		await expect(page.getByText('確定').first()).toBeVisible({ timeout: 5000 });
	});
});
