import { test, expect } from '@playwright/test';

test.describe.serial('account management', () => {
	const ACCOUNT_ID = `e2e-test-${Date.now()}`;
	const ACCOUNT_NAME = `E2E-User-${Date.now()}`;
	const UPDATED_NAME = `${ACCOUNT_NAME}-改`;
	const PASSWORD = 'TestPass123';

	test('creates a participant account', async ({ page }) => {
		await page.goto('/settings/accounts');
		await expect(page).toHaveURL(/\/settings\/accounts/);

		await page.locator('input[name="accountId"]').fill(ACCOUNT_ID);
		await page.locator('input[name="name"]').fill(ACCOUNT_NAME);
		await page.locator('input[name="password"]').fill(PASSWORD);
		await page.getByRole('button', { name: '発行' }).click();
		await page.waitForTimeout(800);

		await expect(page.getByRole('table').getByText(ACCOUNT_ID)).toBeVisible();
		await expect(page.getByRole('table').getByText(ACCOUNT_NAME)).toBeVisible();
	});

	test('edits account name', async ({ page }) => {
		await page.goto('/settings/accounts');
		await page.waitForTimeout(500);

		const row = page.getByRole('table').locator('tr').filter({ hasText: ACCOUNT_ID });
		await row.getByRole('button', { name: '編集' }).click();
		await expect(page.locator('[role="dialog"]')).toBeVisible();

		await page.locator('[role="dialog"] input[name="name"]').clear();
		await page.locator('[role="dialog"] input[name="name"]').fill(UPDATED_NAME);
		await page.locator('[role="dialog"]').getByRole('button', { name: '保存' }).click();
		await page.waitForTimeout(500);

		await page.keyboard.press('Escape');
		await page.waitForTimeout(500);

		await expect(page.getByRole('table').getByText(UPDATED_NAME)).toBeVisible();
	});

	test('deletes an account', async ({ page }) => {
		await page.goto('/settings/accounts');
		await page.waitForTimeout(500);

		const row = page.getByRole('table').locator('tr').filter({ hasText: ACCOUNT_ID });
		await row.getByRole('button', { name: '削除' }).click();
		await page.getByRole('button', { name: '削除する' }).click();
		await page.waitForTimeout(800);

		await expect(page.getByRole('table').getByText(ACCOUNT_ID)).not.toBeVisible();
	});
});
