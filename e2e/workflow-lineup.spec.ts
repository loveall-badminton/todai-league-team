import { test, expect, type Page } from '@playwright/test';

const TS = Date.now();
const TEAM_A = `WF-A-${TS}`;
const TEAM_B = `WF-B-${TS}`;
const TIE_CODE = `W-${TS}`;
// 10 players each; indices 2 (male) and 3 (female) are used for XD1
const PLAYERS_A = [
	{ name: `WF-A1-${TS}`, gender: 'unknown' as const },
	{ name: `WF-A2-${TS}`, gender: 'unknown' as const },
	{ name: `WF-A3-${TS}`, gender: 'male' as const },
	{ name: `WF-A4-${TS}`, gender: 'female' as const },
	{ name: `WF-A5-${TS}`, gender: 'unknown' as const },
	{ name: `WF-A6-${TS}`, gender: 'unknown' as const },
	{ name: `WF-A7-${TS}`, gender: 'unknown' as const },
	{ name: `WF-A8-${TS}`, gender: 'unknown' as const },
	{ name: `WF-A9-${TS}`, gender: 'unknown' as const },
	{ name: `WF-A10-${TS}`, gender: 'unknown' as const }
];
const PLAYERS_B = [
	{ name: `WF-B1-${TS}`, gender: 'unknown' as const },
	{ name: `WF-B2-${TS}`, gender: 'unknown' as const },
	{ name: `WF-B3-${TS}`, gender: 'male' as const },
	{ name: `WF-B4-${TS}`, gender: 'female' as const },
	{ name: `WF-B5-${TS}`, gender: 'unknown' as const },
	{ name: `WF-B6-${TS}`, gender: 'unknown' as const },
	{ name: `WF-B7-${TS}`, gender: 'unknown' as const },
	{ name: `WF-B8-${TS}`, gender: 'unknown' as const },
	{ name: `WF-B9-${TS}`, gender: 'unknown' as const },
	{ name: `WF-B10-${TS}`, gender: 'unknown' as const }
];

const RUBBER_LABELS = [
	'女子ダブルス',
	'ミックスダブルス',
	'男子ダブルス3',
	'男子ダブルス2',
	'男子ダブルス1'
];

test.describe.serial('lineup full workflow', () => {
	let tieUrl: string;

	async function addPlayer(page: Page, name: string, teamUrl: string, gender = 'unknown') {
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
		if (gender !== 'unknown') {
			await form.locator('button[data-select-trigger]').click();
			await page.waitForTimeout(200);
			await page.getByRole('option', { name: gender === 'male' ? '男性' : '女性' }).click();
			await page.waitForTimeout(200);
		}
		await form.evaluate((f: HTMLFormElement) => f.requestSubmit());
		await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
	}

	// lineup: array of [player1Name, player2Name] per rubber, in RUBBER_LABELS order
	async function selectPlayersForRubbers(page: Page, lineup: [string, string][]) {
		for (let i = 0; i < RUBBER_LABELS.length; i++) {
			const label = RUBBER_LABELS[i];
			const [p1, p2] = lineup[i];
			const section = page.locator('p').filter({ hasText: label }).first().locator('..');
			const triggers = section.locator('button[data-select-trigger]');
			await triggers.nth(0).click();
			await page.waitForTimeout(200);
			await page.getByRole('option', { name: p1 }).click();
			await page.waitForTimeout(200);
			await triggers.nth(1).click();
			await page.waitForTimeout(200);
			await page.getByRole('option', { name: p2 }).click();
			await page.waitForTimeout(200);
		}
	}

	async function clickTeamLineupLink(page: Page, teamName: string) {
		const headerRow = page
			.locator('h2')
			.filter({ hasText: teamName })
			.first()
			.locator('..')
			.locator('..');
		await headerRow.getByRole('link', { name: '入力ページ' }).click();
		await page.waitForURL(/\/ties\/.+\/lineups\/.+/, { timeout: 5000 });
		await page.waitForTimeout(1000);
	}

	async function fillAndSubmitLineup(page: Page, teamName: string, lineup: [string, string][]) {
		await page.goto(tieUrl);
		await page.waitForTimeout(1500);
		await clickTeamLineupLink(page, teamName);
		await selectPlayersForRubbers(page, lineup);
		await page.getByRole('button', { name: '提出する' }).click();
		await page.waitForTimeout(1500);
		await expect(page.getByText('オーダーを提出しました').first()).toBeVisible({ timeout: 5000 });
	}

	test('setup: create teams, players, tie', async ({ page }) => {
		test.setTimeout(120_000);
		await page.goto('/teams');
		await page.waitForTimeout(500);
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_A);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		const urlA = page.url();
		for (const p of PLAYERS_A) await addPlayer(page, p.name, urlA, p.gender);

		await page.goto('/teams');
		await page.waitForTimeout(500);
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_B);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		const urlB = page.url();
		for (const p of PLAYERS_B) await addPlayer(page, p.name, urlB, p.gender);

		await page.goto('/ties');
		await page.waitForTimeout(500);
		await page.getByRole('button', { name: '新規作成' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.getByPlaceholder('A-1').fill(TIE_CODE);

		await page
			.locator('span')
			.filter({ hasText: 'A側チーム' })
			.locator('..')
			.locator('button[data-select-trigger]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: TEAM_A }).click();
		await page
			.locator('span')
			.filter({ hasText: 'B側チーム' })
			.locator('..')
			.locator('button[data-select-trigger]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: TEAM_B }).click();

		await page.getByRole('button', { name: '作成', exact: true }).click();
		await page.waitForTimeout(1000);
		tieUrl = page.url();
		expect(tieUrl).toMatch(/\/ties\/[a-zA-Z0-9-]+$/);
	});

	// Each rubber gets unique players; XD1 slot 0 = female (idx 3), slot 1 = male (idx 2)
	const lineupA: [string, string][] = [
		[PLAYERS_A[0].name, PLAYERS_A[1].name], // 女子ダブルス (WD1)
		[PLAYERS_A[3].name, PLAYERS_A[2].name], // ミックスダブルス (XD1) — female slot0, male slot1
		[PLAYERS_A[4].name, PLAYERS_A[5].name], // 男子ダブルス3 (MD3)
		[PLAYERS_A[6].name, PLAYERS_A[7].name], // 男子ダブルス2 (MD2)
		[PLAYERS_A[8].name, PLAYERS_A[9].name] // 男子ダブルス1 (MD1)
	];
	const lineupB: [string, string][] = [
		[PLAYERS_B[0].name, PLAYERS_B[1].name],
		[PLAYERS_B[3].name, PLAYERS_B[2].name], // XD1 — female slot0, male slot1
		[PLAYERS_B[4].name, PLAYERS_B[5].name],
		[PLAYERS_B[6].name, PLAYERS_B[7].name],
		[PLAYERS_B[8].name, PLAYERS_B[9].name]
	];

	test('submit lineup for team A', async ({ page }) => {
		await fillAndSubmitLineup(page, TEAM_A, lineupA);
	});

	test('submit lineup for team B', async ({ page }) => {
		await fillAndSubmitLineup(page, TEAM_B, lineupB);
	});

	test('approve lineups, reveal, start tie', async ({ page }) => {
		await page.goto(tieUrl);
		await page.waitForTimeout(1500);

		await page.getByText('承認する').first().click();
		await page.waitForTimeout(500);
		await page.getByText('承認する').last().click();
		await page.waitForTimeout(500);

		await page.getByText('対戦を開始').click();
		await page.waitForTimeout(1500);

		await expect(page.getByText('進行中').first()).toBeVisible({ timeout: 3000 });
	});

	test('complete a match and confirm result', async ({ page }) => {
		test.setTimeout(90_000);
		await page.goto(tieUrl);
		await page.waitForTimeout(2000);

		// Navigate to first match referee page
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
				.locator('button[data-select-trigger]')
				.click();
			await page.waitForTimeout(200);
			await page.getByRole('option').first().click();
			await page
				.locator('span')
				.filter({ hasText: '1st レシーバー' })
				.locator('..')
				.locator('button[data-select-trigger]')
				.click();
			await page.waitForTimeout(200);
			await page.getByRole('option').first().click();
			await page.getByRole('button', { name: '開始' }).click();
			await page.waitForTimeout(2000);
		}

		// Score game 1
		for (let i = 0; i < 25; i++) {
			const btn = page.getByText('+1').first();
			await page.waitForTimeout(300);
			if (!(await btn.isEnabled().catch(() => false))) break;
			await btn.click();
		}

		// Start game 2 if needed
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
				.locator('button[data-select-trigger]')
				.click();
			await page.waitForTimeout(200);
			await page.getByRole('option').first().click();
			await page
				.locator('span')
				.filter({ hasText: '1st レシーバー' })
				.locator('..')
				.locator('button[data-select-trigger]')
				.click();
			await page.waitForTimeout(200);
			await page.getByRole('option').first().click();
			await page.getByRole('button', { name: '開始' }).click();
			await page.waitForTimeout(1000);

			for (let i = 0; i < 25; i++) {
				const btn = page.getByText('+1').first();
				await page.waitForTimeout(300);
				if (!(await btn.isEnabled().catch(() => false))) break;
				await btn.click();
			}
		}

		// Match finishes — status becomes 'finished' (admin confirms separately)
		await expect(page.getByText('試合終了')).toBeVisible({ timeout: 10000 });
		await page.getByPlaceholder('審判の名前を入力').fill('審判 太郎');
		await page.getByRole('button', { name: '保存' }).click();
		await expect(page.getByText('審判名を保存しました')).toBeVisible({ timeout: 5000 });
		await expect(page.getByPlaceholder('審判の名前を入力')).toHaveValue('審判 太郎');
		await page.getByRole('button', { name: '試合結果を確認' }).click();
		await expect(page.getByRole('button', { name: '確認を取り消す' })).toBeVisible({
			timeout: 5000
		});

		// Verify on tie page: rubber shows '結果確認待ち' until admin confirms
		// (審判名は IconMeta で表示され、「審判:」ラベルは aria-label/tooltip 側にある)
		await page.goto(tieUrl);
		await expect(page.getByLabel('審判: 審判 太郎').first()).toBeVisible({ timeout: 5000 });
		await expect(page.getByRole('button', { name: '運営承認' }).first()).toBeVisible({
			timeout: 5000
		});
	});
});
