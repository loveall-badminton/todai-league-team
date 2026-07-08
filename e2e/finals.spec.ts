import { test, expect, type Page } from '@playwright/test';

test.describe.serial('finals operations', () => {
	const TEAMS = {
		F1: `E2E-Fin1-${Date.now()}`,
		F2: `E2E-Fin2-${Date.now()}`,
		F3: `E2E-Fin3-${Date.now()}`,
		F4: `E2E-Fin4-${Date.now()}`
	};

	async function selectGroup(page: Page, group: string) {
		await page
			.locator('label')
			.filter({ hasText: 'リーグ' })
			.locator('button[data-select-trigger]')
			.click();
		await page.waitForTimeout(200);
		const label = group === 'A' ? 'Aリーグ' : 'Bリーグ';
		await page.getByRole('option', { name: label }).click();
	}

	test('creates 4 teams with group assignments', async ({ page }) => {
		for (const [key, name] of Object.entries(TEAMS)) {
			await page.goto('/teams');
			await page.waitForTimeout(500);
			await page.getByRole('button', { name: '+ 追加' }).click();
			await page.locator('input[name="name"]').fill(name);

			const group = key === 'F1' || key === 'F2' ? 'A' : 'B';
			await selectGroup(page, group);

			await page.getByRole('button', { name: '追加', exact: true }).click();
			await page.waitForTimeout(300);
		}
	});

	test('generates round-robin for both groups', async ({ page }) => {
		for (const group of ['A', 'B']) {
			await page.goto(`/groups/${group}`);
			await page.waitForTimeout(500);
			await page.getByRole('button', { name: '総当たり生成' }).click();
			await page.waitForTimeout(1000);
		}
	});

	test('shows finals page', async ({ page }) => {
		await page.goto('/finals');
		await expect(page).toHaveURL(/\/finals/);
		await expect(page.getByText('決勝トーナメント')).toBeVisible();
	});

	test('generates semifinals and fifth-place ties', async ({ page }) => {
		await page.goto('/finals');
		await expect(page.getByText('決勝トーナメント')).toBeVisible();

		const semifinalBtn = page.getByRole('button', { name: '準決勝・5位決定戦生成' });
		const isDisabled = await semifinalBtn.isDisabled();
		if (!isDisabled) {
			await semifinalBtn.click();
			await page.waitForTimeout(1000);
			await page.reload();
			await expect(page.getByText(/X-1|X-2|X-3|X-4|X-5/).first()).toBeVisible();
		}
	});
});
