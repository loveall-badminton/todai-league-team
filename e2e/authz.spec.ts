import { test, expect } from '@playwright/test';

const ADMIN_ROUTES = ['/settings', '/settings/accounts', '/finals'];

test.describe.serial('authorization guards', () => {
	test('unauthenticated user is redirected to login on admin pages', async ({ browser }) => {
		// Create an isolated context with no cookies
		const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
		const page = await anon.newPage();

		for (const route of ADMIN_ROUTES) {
			await page.goto(route, { waitUntil: 'networkidle' });
			expect(page.url()).toContain('/auth/login');
		}

		await anon.close();
	});
});
