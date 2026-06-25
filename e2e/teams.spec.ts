import { test, expect } from '@playwright/test';

test.describe.serial('team management', () => {
	const TEAM_NAME = `E2E-Team-${Date.now()}`;
	const PLAYER_NAME = `E2E-Player-${Date.now()}`;
	let teamUrl: string;

	test('creates a team and redirects to team detail page', async ({ page }) => {
		await page.goto('/teams');
		await expect(page).toHaveURL(/\/teams/);
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_NAME);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		await expect(page.locator('h1')).toContainText(TEAM_NAME);
		teamUrl = page.url();
	});

	test('adds a player to a team', async ({ page }) => {
		await page.goto(teamUrl);
		await expect(page.locator('h1')).toContainText(TEAM_NAME);
		await page.waitForTimeout(300);

		const playerForm = page.locator('form').filter({ hasText: '氏名' });
		await playerForm.evaluate((form: HTMLFormElement, name) => {
			const input = form.querySelector('input[name="name"]') as HTMLInputElement;
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(input, name);
			input.dispatchEvent(new Event('input', { bubbles: true }));
			form.requestSubmit();
		}, PLAYER_NAME);
		await page.waitForTimeout(2000);
		await page.goto(teamUrl);
		await expect(page.getByText(PLAYER_NAME)).toBeVisible({ timeout: 10000 });
	});

	test('bulk creates players on a team', async ({ page }) => {
		const names = [`E2E-Bulk1-${Date.now()}`, `E2E-Bulk2-${Date.now()}`];
		await page.goto(teamUrl);
		await page.getByRole('tab', { name: '一括登録' }).click();
		await page.locator('textarea[name="namesText"]').fill(names.join('\n'));
		await page.getByRole('button', { name: '一括登録' }).click();
		await page.waitForTimeout(500);
		for (const name of names) {
			await expect(page.getByText(name)).toBeVisible();
		}
	});

	test('updates team name', async ({ page }) => {
		const updatedName = `${TEAM_NAME}-改`;
		await page.goto(teamUrl);
		await expect(page.locator('h1')).toContainText(TEAM_NAME);
		await page.waitForTimeout(300);

		const teamForm = page.locator('form').filter({ hasText: 'チーム名' });
		await teamForm.evaluate((form: HTMLFormElement, value) => {
			const input = form.querySelector('input[name="name"]') as HTMLInputElement;
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(input, value);
			input.dispatchEvent(new Event('input', { bubbles: true }));
			form.requestSubmit();
		}, updatedName);
		await page.waitForTimeout(2000);
		await page.goto(teamUrl);
		await expect(page.locator('h1')).toContainText(updatedName, { timeout: 10000 });
	});

	test('deletes a team', async ({ page }) => {
		await page.goto(teamUrl);
		await page.getByRole('button', { name: 'チームを削除' }).click();
		await page.getByRole('button', { name: '削除する' }).click();
		await expect(page).toHaveURL(/\/teams$/);
		await expect(page.getByText(TEAM_NAME)).not.toBeVisible();
	});
});
