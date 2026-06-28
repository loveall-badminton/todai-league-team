import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 } });

test.describe.serial('mobile viewport', () => {
	const PAGES = ['/', '/live', '/groups'];
	for (const path of PAGES) {
		test(`loads ${path} on mobile`, async ({ page }) => {
			const errors: string[] = [];
			page.on('console', (msg) => {
				if (msg.type() === 'error') errors.push(msg.text());
			});

			// /live uses RealtimeSync polling so networkidle is never reached — use 'load' instead
			const waitUntil = path === '/live' ? 'load' : 'networkidle';
			await page.goto(path, { waitUntil });
			expect(errors).toHaveLength(0);
		});
	}
});
