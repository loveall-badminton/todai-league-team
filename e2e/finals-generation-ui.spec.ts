import { test, expect } from '@playwright/test';

test('finals generation controls are split by stage', async ({ page }) => {
	await page.goto('/finals');

	await expect(page.getByRole('button', { name: '準決勝生成' })).toBeVisible();
	await expect(page.getByRole('tab', { name: '5位決定戦' })).toBeVisible();

	await page.getByRole('tab', { name: '5位決定戦' }).click();
	await expect(page.getByRole('button', { name: '5位決定戦生成' })).toBeVisible();
});
