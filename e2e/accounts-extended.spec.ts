import { test, expect, type Page } from '@playwright/test';

test.describe.serial('extended account management', () => {
	const ADMIN_ID = `e2e-admin-${Date.now()}`;
	const ADMIN_NAME = `E2E-Admin-${Date.now()}`;
	const TEAM_ACCOUNT_ID = `e2e-teamacct-${Date.now()}`;
	const TEAM_ACCOUNT_NAME = `E2E-TeamAcct-${Date.now()}`;
	const PASSWORD = 'TestPass123';

	async function selectBitsUiTrigger(page: Page, labelText: string) {
		const btn = page
			.locator('label')
			.filter({ hasText: labelText })
			.locator('button[aria-haspopup="listbox"]');
		await btn.click();
		await page.waitForTimeout(200);
	}

	async function selectOption(page: Page, optionLabel: string) {
		await page.getByRole('option', { name: optionLabel }).click();
	}

	test('shows team select only when account type is team', async ({ page }) => {
		await page.goto('/settings/accounts');
		await expect(page).toHaveURL(/\/settings\/accounts/);

		// Default: 一般参加者 → team select should NOT be visible
		await expect(page.locator('input[name="teamId"]')).not.toBeVisible();

		// Select "チーム" → team select should appear
		await selectBitsUiTrigger(page, '種別');
		await selectOption(page, 'チーム');
		await page.waitForTimeout(300);
		await expect(page.locator('input[name="teamId"]')).toBeVisible();

		// Select "運営" (admin) → team select should disappear
		await selectBitsUiTrigger(page, '種別');
		await selectOption(page, '運営');
		await page.waitForTimeout(300);
		await expect(page.locator('input[name="teamId"]')).not.toBeVisible();

		// Select "一般参加者" (participant) → team select should remain hidden
		await selectBitsUiTrigger(page, '種別');
		await selectOption(page, '一般参加者');
		await page.waitForTimeout(300);
		await expect(page.locator('input[name="teamId"]')).not.toBeVisible();
	});

	test('creates an admin account', async ({ page }) => {
		await page.goto('/settings/accounts');
		await expect(page).toHaveURL(/\/settings\/accounts/);

		await page.locator('input[name="accountId"]').fill(ADMIN_ID);
		await selectBitsUiTrigger(page, '種別');
		await selectOption(page, '運営');
		await page.locator('input[name="name"]').fill(ADMIN_NAME);
		await page.locator('input[name="password"]').fill(PASSWORD);

		await page.getByRole('button', { name: '発行' }).click();
		await page.waitForTimeout(800);

		const table = page.locator('table');
		await expect(table.getByText(ADMIN_ID, { exact: true })).toBeVisible();
		await expect(table.getByText(ADMIN_NAME, { exact: true })).toBeVisible();
	});

	test('creates a team account', async ({ page }) => {
		// Create a team first so the team dropdown has options
		await page.goto('/teams');
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(`e2e-acctteam-${Date.now()}`);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await page.waitForTimeout(500);

		await page.goto('/settings/accounts');

		await page.locator('input[name="accountId"]').fill(TEAM_ACCOUNT_ID);
		await selectBitsUiTrigger(page, '種別');
		await selectOption(page, 'チーム');
		await page.waitForTimeout(500);
		await expect(page.locator('input[name="teamId"]')).toBeVisible();

		// Open team dropdown and select first team
		await page
			.locator('label')
			.filter({ hasText: 'チーム' })
			.nth(1)
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(300);
		await page.getByRole('option').first().click();
		await page.waitForTimeout(200);

		await page.locator('input[name="name"]').fill(TEAM_ACCOUNT_NAME);
		await page.locator('input[name="password"]').fill(PASSWORD);

		await page.getByRole('button', { name: '発行' }).click();
		await page.waitForTimeout(800);

		const table = page.locator('table');
		await expect(table.getByText(TEAM_ACCOUNT_ID, { exact: true })).toBeVisible();
	});

	test('edits account display name', async ({ page }) => {
		const UPDATED_NAME = `${ADMIN_NAME}-改`;
		await page.goto('/settings/accounts');

		const row = page.locator('tr').filter({ hasText: ADMIN_ID });
		await row.getByRole('button', { name: '編集' }).click();
		await expect(page.locator('[role="dialog"]')).toBeVisible();

		const nameInput = page.locator('[role="dialog"] input[name="name"]');
		await nameInput.evaluate((el, value) => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, value);
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}, UPDATED_NAME);

		await page.locator('[role="dialog"]').getByRole('button', { name: '保存' }).click();
		await page.waitForTimeout(500);

		await page.reload();
		await expect(page.getByText(UPDATED_NAME)).toBeVisible();
	});

	test('deletes the team account', async ({ page }) => {
		await page.goto('/settings/accounts');

		const row = page.locator('tr').filter({ hasText: TEAM_ACCOUNT_ID });
		await row.getByRole('button', { name: '削除' }).click();
		await page.getByRole('button', { name: '削除する' }).click();
		await page.waitForTimeout(800);

		await expect(page.getByText(TEAM_ACCOUNT_ID)).not.toBeVisible();
	});

	test('deletes the admin test account', async ({ page }) => {
		await page.goto('/settings/accounts');

		const row = page.locator('tr').filter({ hasText: ADMIN_ID });
		await row.getByRole('button', { name: '削除' }).click();
		await page.getByRole('button', { name: '削除する' }).click();
		await page.waitForTimeout(800);

		await expect(page.getByText(ADMIN_ID)).not.toBeVisible();
	});
});
