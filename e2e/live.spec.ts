import { test, expect } from '@playwright/test';

test.describe.serial('live board', () => {
	test('loads live page without console errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') errors.push(msg.text());
		});

		await page.goto('/live');
		await expect(page.getByText('ライブ表示')).toBeVisible();
		await expect(
			page.getByText('接続中').or(page.getByText('自動更新')).or(page.getByText('接続中…'))
		).toBeVisible();

		expect(errors).toHaveLength(0);
	});
});
