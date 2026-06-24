import { test, expect } from '@playwright/test';

const TEST_EVENT_NAME = `E2Eテスト大会${Date.now()}`;

test.describe('settings page', () => {
	test('loads settings page with form', async ({ page }) => {
		await page.goto('/settings');
		await expect(page).toHaveURL(/\/settings/);
		await expect(page.locator('input[name="eventName"]')).toBeVisible();
	});

	test('updates league event name', async ({ page }) => {
		await page.goto('/settings');

		await page.locator('input[name="eventName"]').clear();
		await page.locator('input[name="eventName"]').fill(TEST_EVENT_NAME);
		await page.locator('input[name="eventName"]').blur();

		const leagueFormSubmit = page
			.locator('form')
			.filter({ has: page.locator('input[name="eventName"]') })
			.getByRole('button', { name: '保存' });
		await leagueFormSubmit.click();
		await page.waitForTimeout(800);

		await page.reload();
		await expect(page.locator('input[name="eventName"]')).toHaveValue(TEST_EVENT_NAME);
	});
});
