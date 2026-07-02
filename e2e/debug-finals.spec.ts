import { test, expect } from '@playwright/test';

test('debug finals generation', async ({ page }) => {
	await page.goto('/finals');
	await page.waitForTimeout(500);

	const semisSection = page.locator('section').filter({ hasText: '準決勝 / 5位決定戦' });
	const finalsSection = page.locator('section').filter({ hasText: '決勝 / 3位決定戦' });
	const semisLinks = semisSection.locator('a[href^="/ties/"]');
	const finalsLinks = finalsSection.locator('a[href^="/ties/"]');

	console.log('before semis count', await semisLinks.count());
	console.log('before finals count', await finalsLinks.count());
	console.log('body text start', (await page.locator('body').textContent())?.slice(0, 1000));

	const semisBtn = page.getByRole('button', { name: '準決勝・5位決定戦生成' });
	await expect(semisBtn).toBeVisible();
	await semisBtn.evaluate((el) => (el as HTMLButtonElement).click());
	console.log('clicked semis');
	await page.waitForTimeout(3000);
	await page.goto('/finals');
	await page.waitForTimeout(500);

	console.log('after semis count', await semisLinks.count());
	console.log('after finals count', await finalsLinks.count());
	console.log('body text end', (await page.locator('body').textContent())?.slice(0, 1000));
});
