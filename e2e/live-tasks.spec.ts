import { test, expect, type Page } from '@playwright/test';

const TS = Date.now();
const TEAM_NAME = `Task-T-${TS}`;
const TEAM2_NAME = `Task-T2-${TS}`;
const TIE_CODE = `Task-Tie-${TS}`;
const ACCOUNT_ID = `task-${TS}`;
const ACCOUNT_PW = 'TaskPass789';
const PLAYER = `Task-P-${TS}`;

test.describe.serial('team tasks dashboard', () => {
	async function addPlayer(page: Page, name: string, teamUrl: string) {
		await page.goto(teamUrl);
		const form = page.locator('form').filter({ hasText: '氏名' });
		const input = form.locator('input[name="name"]');
		await input.evaluate((el: HTMLInputElement, value: string) => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, value);
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}, name);
		await form.evaluate((f: HTMLFormElement) => f.requestSubmit());
		await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
	}

	test('setup: create teams, team account, and tie', async ({ page }) => {
		await page.goto('/teams');
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_NAME);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		const teamId = page.url().split('/').pop()!;
		await addPlayer(page, PLAYER, page.url());

		await page.goto('/teams');
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM2_NAME);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		await addPlayer(page, `${PLAYER}-2`, page.url());

		await page.goto('/ties');
		await page.getByRole('button', { name: '新規作成' }).click();
		await page.getByPlaceholder('A-1').fill(TIE_CODE);
		await page
			.locator('span')
			.filter({ hasText: 'A側チーム' })
			.locator('..')
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: TEAM_NAME }).click();
		await page
			.locator('span')
			.filter({ hasText: 'B側チーム' })
			.locator('..')
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: TEAM2_NAME }).click();
		await page.getByRole('button', { name: '作成', exact: true }).click();
		await page.waitForTimeout(1000);

		// Create team account — inject hidden inputs + submit
		await page.goto('/settings/accounts');
		await page.locator('input[name="accountId"]').fill(ACCOUNT_ID);
		await page.locator('input[name="name"]').fill(`Task-Acct-${TS}`);
		await page.locator('input[name="password"]').fill(ACCOUNT_PW);

		await page.evaluate((tid) => {
			const form = document.querySelector('form') as HTMLFormElement;
			const at = document.createElement('input');
			at.type = 'hidden';
			at.name = 'accountType';
			at.value = 'team';
			form.appendChild(at);
			const ti = document.createElement('input');
			ti.type = 'hidden';
			ti.name = 'teamId';
			ti.value = tid;
			form.appendChild(ti);
		}, teamId);

		await page.getByRole('button', { name: '発行' }).click();
		await page.waitForTimeout(800);
	});

	test('team account can login and view tasks dashboard', async ({ browser }) => {
		const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
		const page = await context.newPage();

		try {
			await page.goto('/auth/login');
			await page.waitForTimeout(500);
			await page.locator('input[name="accountId"]').fill(ACCOUNT_ID);
			await page.locator('input[name="password"]').fill(ACCOUNT_PW);
			await page.locator('button[type="submit"]').click();
			await page.waitForTimeout(2000);
			await expect(page).not.toHaveURL(/\/auth/);

			await page.goto('/live/tasks');
			await page.waitForTimeout(1500);

			await expect(page).toHaveURL(/\/live\/tasks/);
		} finally {
			await context.close();
		}
	});

	test('team account cannot access admin pages', async ({ browser }) => {
		const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
		const page = await context.newPage();

		try {
			await page.goto('/auth/login');
			await page.waitForTimeout(500);
			await page.locator('input[name="accountId"]').fill(ACCOUNT_ID);
			await page.locator('input[name="password"]').fill(ACCOUNT_PW);
			await page.locator('button[type="submit"]').click();
			await page.waitForTimeout(1500);

			await page.goto('/settings');
			await page.waitForTimeout(1000);
			await expect(page.getByText('運営アカウントでログインしてください')).toBeVisible();
		} finally {
			await context.close();
		}
	});
});
