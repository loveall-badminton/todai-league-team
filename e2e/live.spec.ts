import { test, expect } from '@playwright/test';

test.describe.serial('live board', () => {
	test('loads live page without console errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') errors.push(msg.text());
		});

		await page.goto('/live');
		// Live board is CSR-only (ssr=false) — wait for schedule query + hydration
		await expect(page.getByText('ライブ表示')).toBeVisible({ timeout: 10000 });

		expect(errors).toHaveLength(0);
	});
});
