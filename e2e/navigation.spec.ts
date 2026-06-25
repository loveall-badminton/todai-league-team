import { test, expect } from '@playwright/test';

test.describe('page navigation', () => {
	const PAGES = ['/', '/ties', '/settings', '/docs'];

	for (const path of PAGES) {
		test(`loads ${path} without errors`, async ({ page }) => {
			const errors: string[] = [];
			page.on('pageerror', (err) => errors.push(err.message));

			await page.goto(path, { waitUntil: 'networkidle' });
			await expect(page).toHaveURL(path);

			expect(errors).toEqual([]);
		});
	}

	test('navigates between pages without console errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(err.message));
		page.on('console', (msg) => {
			if (msg.type() === 'error') errors.push(msg.text());
		});

		await page.goto('/ties');
		await page.waitForLoadState('networkidle');

		await page.goto('/settings');
		await page.waitForLoadState('networkidle');

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		expect(errors).toEqual([]);
	});
});

test.describe('docs page', () => {
	test('renders sidebar with sections and main content', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(err.message));

		await page.goto('/docs', { waitUntil: 'networkidle' });
		await expect(page).toHaveURL('/docs');

		const sidebar = page.locator('main').getByRole('complementary').first();
		await expect(sidebar.getByRole('paragraph').filter({ hasText: '使い方ガイド' })).toBeVisible();
		await expect(sidebar.getByRole('paragraph').filter({ hasText: 'はじめに' })).toBeVisible();
		await expect(
			sidebar.getByRole('paragraph').filter({ hasText: '管理者マニュアル' })
		).toBeVisible();
		await expect(page.getByRole('heading', { level: 1, name: '使い方ガイド' })).toBeVisible();

		expect(errors).toEqual([]);
	});

	test('navigates to an admin doc page', async ({ page }) => {
		await page.goto('/docs/admin/setup', { waitUntil: 'networkidle' });
		await expect(page).toHaveURL('/docs/admin/setup');

		await expect(page.getByRole('heading', { level: 1, name: 'セットアップ' })).toBeVisible();
		await expect(page.getByRole('heading', { level: 2, name: 'アカウント作成' })).toBeVisible();

		const sidebarLink = page.locator('aside a', { hasText: 'セットアップ' });
		await expect(sidebarLink).toBeVisible();
	});
});
