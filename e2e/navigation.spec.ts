import { test, expect } from '@playwright/test';

test.describe('page navigation', () => {
	const PAGES = ['/', '/ties', '/settings'];

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
