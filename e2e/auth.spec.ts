import { test, expect } from '@playwright/test';

test.describe('authenticated user', () => {
	test('redirects to / when accessing login page while logged in', async ({ page }) => {
		await page.goto('/auth/login');
		await expect(page).toHaveURL(/\/(?!auth\/login)/);
	});

	test('shows admin navigation after login', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByText('運営ホーム')).toBeVisible();
	});

	test('can navigate to ties page', async ({ page }) => {
		await page.goto('/ties');
		await expect(page).toHaveURL(/\/ties/);
		await expect(page.getByRole('button', { name: '新規作成' })).toBeVisible();
	});
});

test.describe('unauthenticated user', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('redirects to login page', async ({ page }) => {
		await page.goto('/ties');
		await expect(page).toHaveURL(/\/auth\/login/);
	});

	test('redirectTo parameter preserves destination', async ({ page }) => {
		await page.goto('/ties');
		const url = page.url();
		expect(url).toContain('redirectTo=');
	});
});
