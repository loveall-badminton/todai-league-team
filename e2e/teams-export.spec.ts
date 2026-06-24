import { test, expect } from '@playwright/test';

test.describe('teams CSV export', () => {
	test('downloads CSV with correct headers', async ({ page }) => {
		const response = await page.request.get('/teams/export');
		expect(response.ok()).toBeTruthy();
		expect(response.headers()['content-type']).toContain('text/csv');
		expect(response.headers()['content-disposition']).toContain('players.csv');

		const csvText = await response.text();
		expect(csvText).toContain('チーム名');
		expect(csvText).toContain('選手名');
		expect(csvText).toContain('性別');
	});
});
