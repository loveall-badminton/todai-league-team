import { test, expect, type Page } from '@playwright/test';

const TS = Date.now();
const TEAM_A = `Forf-A-${TS}`;
const TEAM_B = `Forf-B-${TS}`;
const TIE_CODE = `F-${TS}`;
// 10 players each; indices 2 (male) and 3 (female) are used for XD1
const PLAYERS_A = [
	{ name: `Forf-A1-${TS}`, gender: 'unknown' as const },
	{ name: `Forf-A2-${TS}`, gender: 'unknown' as const },
	{ name: `Forf-A3-${TS}`, gender: 'male' as const },
	{ name: `Forf-A4-${TS}`, gender: 'female' as const },
	{ name: `Forf-A5-${TS}`, gender: 'unknown' as const },
	{ name: `Forf-A6-${TS}`, gender: 'unknown' as const },
	{ name: `Forf-A7-${TS}`, gender: 'unknown' as const },
	{ name: `Forf-A8-${TS}`, gender: 'unknown' as const },
	{ name: `Forf-A9-${TS}`, gender: 'unknown' as const },
	{ name: `Forf-A10-${TS}`, gender: 'unknown' as const }
];
const PLAYERS_B = [
	{ name: `Forf-B1-${TS}`, gender: 'unknown' as const },
	{ name: `Forf-B2-${TS}`, gender: 'unknown' as const },
	{ name: `Forf-B3-${TS}`, gender: 'male' as const },
	{ name: `Forf-B4-${TS}`, gender: 'female' as const },
	{ name: `Forf-B5-${TS}`, gender: 'unknown' as const },
	{ name: `Forf-B6-${TS}`, gender: 'unknown' as const },
	{ name: `Forf-B7-${TS}`, gender: 'unknown' as const },
	{ name: `Forf-B8-${TS}`, gender: 'unknown' as const },
	{ name: `Forf-B9-${TS}`, gender: 'unknown' as const },
	{ name: `Forf-B10-${TS}`, gender: 'unknown' as const }
];

test.describe.serial('referee forfeit', () => {
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

	test('setup: create teams, tie, and start match', async ({ page }) => {
		// Create team A
		await page.goto('/teams');
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_A);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		const teamAUrl = page.url();
		for (const p of PLAYERS_A) await addPlayer(page, p.name, teamAUrl, p.gender);

		// Create team B
		await page.goto('/teams');
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_B);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		const teamBUrl = page.url();
		for (const p of PLAYERS_B) await addPlayer(page, p.name, teamBUrl, p.gender);

		// Create tie
		await page.goto('/ties');
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

		// Approve lineups, start tie
		await page.goto(tieUrl);
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

	test('forfeit a match and confirm result', async ({ page }) => {
		test.setTimeout(60_000);

		// Navigate to referee page
		await page.goto(tieUrl);
		await page.getByRole('link', { name: 'スコア入力' }).first().click();
		await page.waitForURL(/\/referee\/.+/, { timeout: 5000 });
		await page.waitForTimeout(1500);

		// Start the game if needed
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
			await page.waitForTimeout(1500);
		}

		// CollapsibleSection "棄権" trigger click
		await page.locator('button').filter({ hasText: '棄権' }).first().click();
		await page.waitForTimeout(800);

		// Match side name = player names joined by " / " plus "棄権" (e.g., "PlayerA1 / PlayerA2 棄権")
		await page
			.locator('button')
			.filter({ hasText: '棄権' })
			.filter({ hasText: PLAYERS_A[0].name })
			.first()
			.click({ force: true, timeout: 10000 });
		await page.waitForTimeout(500);

		// Confirm forfeit inside Dialog
		await page.getByRole('button', { name: '棄権を確定する' }).click();
		await page.waitForTimeout(1500);

		// Match is now in forfeited state — +1 button disabled, admin confirms separately
		await expect(page.getByText('+1').first()).toBeDisabled({ timeout: 5000 });
	});

	test('retire a match and confirm result', async ({ page }) => {
		test.setTimeout(60_000);

		// Navigate to a different rubber (the second one which is still playing)
		await page.goto(tieUrl);
		await page.waitForTimeout(500);
		const scoreLinks = page.getByRole('link', { name: 'スコア入力' });
		await scoreLinks.nth(1).click();
		await page.waitForURL(/\/referee\/.+/, { timeout: 5000 });
		await page.waitForTimeout(1500);

		// Start the game if needed
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
			await page.waitForTimeout(1500);
		}

		// Expand "リタイア" section
		await page.getByRole('button', { name: 'リタイア' }).click();
		await page.waitForTimeout(500);

		// Click retire for side B (side name = player names + "リタイア")
		await page
			.locator('button')
			.filter({ hasText: 'リタイア' })
			.filter({ hasText: PLAYERS_B[2].name })
			.first()
			.click({ force: true, timeout: 10000 });
		await page.waitForTimeout(500);

		// Confirm retire
		await page.getByRole('button', { name: 'リタイアを確定する' }).click();
		await page.waitForTimeout(1500);

		// Match is now in retired state — +1 button disabled, admin confirms separately
		await expect(page.getByText('+1').first()).toBeDisabled({ timeout: 5000 });

		// Verify on tie page
		await page.goto(tieUrl);
		await expect(page.getByText(TIE_CODE).first()).toBeVisible();
	});
});
