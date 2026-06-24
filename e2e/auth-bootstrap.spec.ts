import { test, expect } from '@playwright/test';

test.describe('auth bootstrap page', () => {
	test('redirects authenticated users to home', async ({ page }) => {
		await page.goto('/auth/bootstrap');
		await expect(page).toHaveURL(/\/(?!auth\/bootstrap)/);
	});

	test.describe('unauthenticated', () => {
		test.use({ storageState: { cookies: [], origins: [] } });

		test('shows already-created message when users exist', async ({ page }) => {
			await page.goto('/auth/bootstrap');
			await expect(page.getByText('初回管理者は作成済みです')).toBeVisible();
			await expect(page.getByRole('link', { name: 'ログインへ' })).toBeVisible();
		});

		test('login link navigates to login page', async ({ page }) => {
			await page.goto('/auth/bootstrap');
			await page.getByRole('link', { name: 'ログインへ' }).click();
			await expect(page).toHaveURL(/\/auth\/login/);
		});
	});
});
