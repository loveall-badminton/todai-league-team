import { test, expect, type Page } from '@playwright/test';

const TIE_CODE = `E2E-Val-${Date.now()}`;
const TEAM_A = `E2E-ValA-${Date.now()}`;
const TEAM_B = `E2E-ValB-${Date.now()}`;
const MALE = `VM-Taro-${Date.now()}`;
const FEMALE = `VF-Hanako-${Date.now()}`;

test.describe.serial('lineup gender validation', () => {
	test('setup: create teams, players, tie', async ({ page }) => {
		// Team A with 2 players (male + female)
		await page.goto('/teams');
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_A);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);

		// Add male player
		const form = page.locator('form').filter({ hasText: '氏名' });
		const input = form.locator('input[name="name"]');
		await input.evaluate((el, value) => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, value);
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}, MALE);
		await page
			.locator('label')
			.filter({ hasText: '性別' })
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: '男性' }).click();
		await page.waitForTimeout(200);
		await form.evaluate((f) => f.requestSubmit());
		await expect(page.getByText(MALE)).toBeVisible({ timeout: 10000 });

		// Add female player
		await input.evaluate((el, value) => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, value);
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}, FEMALE);
		await page
			.locator('label')
			.filter({ hasText: '性別' })
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: '女性' }).click();
		await page.waitForTimeout(200);
		await form.evaluate((f) => f.requestSubmit());
		await expect(page.getByText(FEMALE)).toBeVisible({ timeout: 10000 });

		// Team B (just needs to exist)
		await page.goto('/teams');
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_B);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);

		// Create tie
		await page.goto('/ties');
		await page.getByRole('button', { name: '新規作成' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.getByPlaceholder('A-1').fill(TIE_CODE);

		await page
			.locator('span')
			.filter({ hasText: 'A側チーム' })
			.locator('..')
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: TEAM_A }).click();

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
		expect(page.url()).toMatch(/\/ties\/[a-zA-Z0-9-]+$/);
	});

	async function navigateToLineup(page: Page, teamName: string) {
		await page.goto('/ties');
		// The tie we created is the most recent one, its "詳細" link is last
		await page.getByRole('link', { name: '詳細' }).last().click();
		await page.waitForURL(/\/ties\/[a-zA-Z0-9-]+$/, { timeout: 5000 });
		await page.waitForTimeout(1500);

		// Wait for tie data to load
		await expect(page.getByText(teamName).first()).toBeVisible({ timeout: 5000 });

		// Click "入力ページ" link for the team
		await page.getByRole('link', { name: '入力ページ' }).first().click();
		await page.waitForURL(/\/ties\/.+\/lineups\/.+/, { timeout: 5000 });
		await page.waitForTimeout(1000);
	}

	test('MD slot only shows male players', async ({ page }) => {
		await navigateToLineup(page, TEAM_A);

		// Lineup form renders rubber label in <p> element, each rubber has 2 slot buttons
		const mdButton = page
			.locator('p')
			.filter({ hasText: '男子ダブルス' })
			.first()
			.locator('..')
			.locator('button[aria-haspopup="listbox"]')
			.first();
		await mdButton.click();
		await page.waitForTimeout(200);

		const texts = await page.locator('[role="option"]').allTextContents();
		expect(texts.some((t) => t.includes(MALE))).toBe(true);
		expect(texts.some((t) => t.includes(FEMALE))).toBe(false);

		await page.keyboard.press('Escape');
		await page.waitForTimeout(200);
	});

	test('WD slot only shows female players', async ({ page }) => {
		await navigateToLineup(page, TEAM_A);

		// Lineup form renders rubber label in <p> element, each rubber has 2 slot buttons
		const wdButton = page
			.locator('p')
			.filter({ hasText: '女子ダブルス' })
			.first()
			.locator('..')
			.locator('button[aria-haspopup="listbox"]')
			.first();
		await wdButton.click();
		await page.waitForTimeout(200);

		const texts = await page.locator('[role="option"]').allTextContents();
		expect(texts.some((t) => t.includes(FEMALE))).toBe(true);
		expect(texts.some((t) => t.includes(MALE))).toBe(false);

		await page.keyboard.press('Escape');
		await page.waitForTimeout(200);
	});
});
