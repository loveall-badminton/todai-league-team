import { test, expect } from '@playwright/test';

test.describe.serial('tie extended operations', () => {
	const TIE_CODE_A = `E2E-TA-${Date.now()}`;
	const TEAM_A = `E2E-TieTeamA-${Date.now()}`;
	const TEAM_B = `E2E-TieTeamB-${Date.now()}`;
	const PLAYER_A = `E2E-TiePlayerA-${Date.now()}`;
	const PLAYER_B = `E2E-TiePlayerB-${Date.now()}`;
	let tieUrl: string;

	test('creates two teams with players', async ({ page }) => {
		await page.goto('/teams');

		// Team A
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_A);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);

		// Add player to team A
		const playerFormA = page.locator('form').filter({ hasText: '氏名' });
		const playerInputA = playerFormA.locator('input[name="name"]');
		await playerInputA.evaluate((el, value) => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, value);
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}, PLAYER_A);
		await playerFormA.evaluate((f: HTMLFormElement) => f.requestSubmit());
		await expect(page.getByText(PLAYER_A)).toBeVisible({ timeout: 10000 });

		// Team B
		await page.goto('/teams');
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_B);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);

		// Add player to team B
		const playerFormB = page.locator('form').filter({ hasText: '氏名' });
		const playerInputB = playerFormB.locator('input[name="name"]');
		await playerInputB.evaluate((el, value) => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, value);
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}, PLAYER_B);
		await playerFormB.evaluate((f: HTMLFormElement) => f.requestSubmit());
		await expect(page.getByText(PLAYER_B)).toBeVisible({ timeout: 10000 });
	});

	test('creates a tie between the two teams', async ({ page }) => {
		await page.goto('/ties');
		await page.getByRole('button', { name: '新規作成' }).click();
		await expect(page.getByText('対戦を作成')).toBeVisible();

		await page.getByPlaceholder('A-1').fill(TIE_CODE_A);

		// Select team A
		await page
			.locator('span')
			.filter({ hasText: 'A側チーム' })
			.locator('..')
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: TEAM_A }).click();

		// Select team B
		await page
			.locator('span')
			.filter({ hasText: 'B側チーム' })
			.locator('..')
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: TEAM_B }).click();

		await page.getByRole('button', { name: '作成', exact: true }).click();
		await page.waitForTimeout(1000);

		const currentUrl = page.url();
		expect(currentUrl).toMatch(/\/ties\/[a-zA-Z0-9-]+$/);
		tieUrl = currentUrl;
		await expect(page.locator('h1')).toContainText(TIE_CODE_A);
	});

	test('edits tie schedule info', async ({ page }) => {
		await page.goto(tieUrl);
		await expect(page.locator('h1')).toContainText(TIE_CODE_A);

		await page.getByRole('button', { name: '編集' }).click();
		await expect(page.getByRole('button', { name: '保存' })).toBeVisible();

		// Fill venue (AppSelect)
		await page
			.locator('span')
			.filter({ hasText: '体育館・コート' })
			.locator('..')
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: '第一体育館' }).click();

		await page.getByRole('button', { name: '保存' }).click();
		await page.waitForTimeout(800);
		await page.reload();

		// Verify the venue is saved
		await expect(page.getByText('第一体育館')).toBeVisible();
	});

	test('navigates to lineup page', async ({ page }) => {
		await page.goto(tieUrl);
		await expect(page.locator('h1')).toContainText(TIE_CODE_A);

		// Should have an "入力ページ" link for team A
		const lineupLink = page.getByRole('link', { name: '入力ページ' }).first();
		await expect(lineupLink).toBeVisible();
	});

	test('deletes the tie', async ({ page }) => {
		await page.goto(tieUrl);
		await expect(page.locator('h1')).toContainText(TIE_CODE_A);

		await page.getByText('対戦を削除').click();
		await page.getByRole('button', { name: '削除する' }).click();
		await expect(page).toHaveURL(/\/ties$/);
	});
});

test.describe.serial('tie reordering', () => {
	const TIE_1 = `E2E-RO1-${Date.now()}`;
	const TIE_2 = `E2E-RO2-${Date.now()}`;

	test('creates two ties for reorder test', async ({ page }) => {
		await page.goto('/ties');

		// Tie 1
		await page.getByRole('button', { name: '新規作成' }).click();
		await expect(page.getByPlaceholder('A-1')).toBeVisible({ timeout: 5000 });
		await page.getByPlaceholder('A-1').fill(TIE_1);
		await page.getByRole('button', { name: '作成', exact: true }).click();
		await page.waitForTimeout(500);

		// Tie 2
		await page.goto('/ties');
		await page.getByRole('button', { name: '新規作成' }).click();
		await expect(page.getByPlaceholder('A-1')).toBeVisible({ timeout: 5000 });
		await page.getByPlaceholder('A-1').fill(TIE_2);
		await page.getByRole('button', { name: '作成', exact: true }).click();
		await page.waitForTimeout(500);
	});

	test('shows both ties in the list', async ({ page }) => {
		await page.goto('/ties');
		await expect(page.getByText(TIE_1)).toBeVisible();
		await expect(page.getByText(TIE_2)).toBeVisible();
	});
});
