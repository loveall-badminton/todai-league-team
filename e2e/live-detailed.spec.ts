import { test, expect, type Page } from '@playwright/test';

const TS = Date.now();
const TEAM_A = `Live-A-${TS}`;
const TEAM_B = `Live-B-${TS}`;
const TIE_CODE = `L-${TS}`;
// 10 players each; indices 2 (male) and 3 (female) are used for XD1
const PLAYERS_A = [
	{ name: `Live-A1-${TS}`, gender: 'unknown' as const },
	{ name: `Live-A2-${TS}`, gender: 'unknown' as const },
	{ name: `Live-A3-${TS}`, gender: 'male' as const },
	{ name: `Live-A4-${TS}`, gender: 'female' as const },
	{ name: `Live-A5-${TS}`, gender: 'unknown' as const },
	{ name: `Live-A6-${TS}`, gender: 'unknown' as const },
	{ name: `Live-A7-${TS}`, gender: 'unknown' as const },
	{ name: `Live-A8-${TS}`, gender: 'unknown' as const },
	{ name: `Live-A9-${TS}`, gender: 'unknown' as const },
	{ name: `Live-A10-${TS}`, gender: 'unknown' as const }
];
const PLAYERS_B = [
	{ name: `Live-B1-${TS}`, gender: 'unknown' as const },
	{ name: `Live-B2-${TS}`, gender: 'unknown' as const },
	{ name: `Live-B3-${TS}`, gender: 'male' as const },
	{ name: `Live-B4-${TS}`, gender: 'female' as const },
	{ name: `Live-B5-${TS}`, gender: 'unknown' as const },
	{ name: `Live-B6-${TS}`, gender: 'unknown' as const },
	{ name: `Live-B7-${TS}`, gender: 'unknown' as const },
	{ name: `Live-B8-${TS}`, gender: 'unknown' as const },
	{ name: `Live-B9-${TS}`, gender: 'unknown' as const },
	{ name: `Live-B10-${TS}`, gender: 'unknown' as const }
];

test.describe.serial('live page with real data', () => {
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

	async function selectBitsUiTrigger(page: Page, labelText: string) {
		const section = page.locator('span').filter({ hasText: labelText }).locator('..');
		await section.locator('button[data-select-trigger]').click();
		await page.waitForTimeout(200);
	}

	async function selectLineupPlayer(
		page: Page,
		rubberCode: string,
		slotIndex: 0 | 1,
		playerName: string
	) {
		const rubberSection = page
			.locator(`input[name$=".rubberCode"][value="${rubberCode}"]`)
			.locator('..');
		const triggers = rubberSection.locator('button[data-select-trigger]');
		await triggers.nth(slotIndex).click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: playerName }).click();
	}

	test('setup: create teams, players, tie, and start match', async ({ page }) => {
		test.setTimeout(120_000);

		// Create team A
		await page.goto('/teams');
		await page.waitForTimeout(500);
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_A);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		const teamAUrl = page.url();
		for (const p of PLAYERS_A) await addPlayer(page, p.name, teamAUrl, p.gender);

		// Create team B
		await page.goto('/teams');
		await page.waitForTimeout(500);
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_B);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		const teamBUrl = page.url();
		for (const p of PLAYERS_B) await addPlayer(page, p.name, teamBUrl, p.gender);

		// Create tie
		await page.goto('/ties');
		await page.waitForTimeout(500);
		await page.getByRole('button', { name: '新規作成' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.getByPlaceholder('A-1').fill(TIE_CODE);
		await selectBitsUiTrigger(page, 'A側チーム');
		await page.getByRole('option', { name: TEAM_A }).click();
		await selectBitsUiTrigger(page, 'B側チーム');
		await page.getByRole('option', { name: TEAM_B }).click();
		await page.getByRole('button', { name: '作成', exact: true }).click();
		await page.waitForTimeout(1000);
		tieUrl = page.url();
		expect(tieUrl).toMatch(/\/ties\/[a-zA-Z0-9-]+$/);

		// Submit lineup for team A
		await page.goto(tieUrl);
		await page.getByRole('link', { name: '入力ページ' }).first().click();
		await page.waitForTimeout(500);
		// Each rubber gets unique players; XD1 slot 0 = female (idx 3), slot 1 = male (idx 2)
		const lineup: [string, number, number][] = [
			['WD1', 0, 1],
			['XD1', 3, 2],
			['MD3', 4, 5],
			['MD2', 6, 7],
			['MD1', 8, 9]
		];
		for (const [code, i1, i2] of lineup) {
			await selectLineupPlayer(page, code, 0, PLAYERS_A[i1].name);
			await selectLineupPlayer(page, code, 1, PLAYERS_A[i2].name);
		}
		await page.getByRole('button', { name: '提出する' }).click();
		await page.waitForTimeout(1000);

		// Submit lineup for team B
		await page.goto(tieUrl);
		await page.getByRole('link', { name: '入力ページ' }).last().click();
		await page.waitForTimeout(500);
		for (const [code, i1, i2] of lineup) {
			await selectLineupPlayer(page, code, 0, PLAYERS_B[i1].name);
			await selectLineupPlayer(page, code, 1, PLAYERS_B[i2].name);
		}
		await page.getByRole('button', { name: '提出する' }).click();
		await page.waitForTimeout(1000);

		// Approve lineups
		await page.goto(tieUrl);
		await page.waitForTimeout(500);
		const approveBtns = page.getByRole('button', { name: '承認する' });
		const count = await approveBtns.count();
		for (let i = 0; i < count; i++) {
			await approveBtns.first().click();
			await page.waitForTimeout(500);
		}

		// Start tie
		await page.getByRole('button', { name: '対戦を開始' }).click();
		await page.waitForTimeout(1000);
		await expect(page.getByText('スコア入力').first()).toBeVisible({ timeout: 5000 });

		// Start first match on referee page
		await page.getByRole('link', { name: 'スコア入力' }).first().click();
		await page.waitForURL(/\/referee\/.+/, { timeout: 5000 });
		await page.waitForTimeout(1000);
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
		await page.waitForTimeout(1500);
		await expect(page.getByText('+1').first()).toBeVisible({ timeout: 3000 });

		// Score a few points so match is clearly "playing"
		for (let i = 0; i < 5; i++) {
			const btn = page.getByText('+1').first();
			if (!(await btn.isEnabled().catch(() => false))) break;
			await btn.click();
			await page.waitForTimeout(150);
		}
	});

	test('live page loads without console errors with real data', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') errors.push(msg.text());
		});

		await page.goto('/live');
		await page.waitForTimeout(3000);

		// Header is always visible
		await expect(page.getByText('ライブ表示')).toBeVisible({ timeout: 10000 });

		expect(errors).toHaveLength(0);
	});
});
