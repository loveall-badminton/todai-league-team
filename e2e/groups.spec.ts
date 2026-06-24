import { test, expect, type Page } from '@playwright/test';

test.describe.serial('group operations', () => {
	const TEAMS = {
		A1: `E2E-GrpA1-${Date.now()}`,
		A2: `E2E-GrpA2-${Date.now()}`,
		B1: `E2E-GrpB1-${Date.now()}`,
		B2: `E2E-GrpB2-${Date.now()}`
	};

	async function selectAppSelectOption(page: Page, labelText: string, optionText: string) {
		await page
			.locator('label')
			.filter({ hasText: labelText })
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: optionText }).click();
	}

	test('creates 4 teams and assigns to groups', async ({ page }) => {
		for (const [key, name] of Object.entries(TEAMS)) {
			await page.goto('/teams');
			await page.getByRole('button', { name: '+ 追加' }).click();
			await page.locator('input[name="name"]').fill(name);

			const group = key.startsWith('A') ? 'Aリーグ' : 'Bリーグ';
			await selectAppSelectOption(page, 'リーグ', group);

			await page.getByRole('button', { name: '追加', exact: true }).click();
			await page.waitForTimeout(300);
		}

		await page.goto('/teams');
		for (const name of Object.values(TEAMS)) {
			await expect(page.getByText(name)).toBeVisible();
		}
	});

	test('shows groups overview page', async ({ page }) => {
		await page.goto('/groups');
		await expect(page.getByText('Aリーグ')).toBeVisible();
		await expect(page.getByText('Bリーグ').first()).toBeVisible();
	});

	test('generates round-robin for group A', async ({ page }) => {
		await page.goto('/groups/A');
		await expect(page.getByText('Aリーグ').first()).toBeVisible();

		await page.getByRole('button', { name: '総当たり生成' }).click();
		await page.waitForTimeout(1000);
		await page.reload();

		await expect(page.getByText(TEAMS.A1).first()).toBeVisible();
		await expect(page.getByText(TEAMS.A2).first()).toBeVisible();
	});

	test('shows standings for group A', async ({ page }) => {
		await page.goto('/groups/A');
		await expect(page.getByText('順位表')).toBeVisible();
	});

	test('generates round-robin for group B', async ({ page }) => {
		await page.goto('/groups/B');
		await expect(page.getByText('Bリーグ').first()).toBeVisible();

		await page.getByRole('button', { name: '総当たり生成' }).click();
		await page.waitForTimeout(1000);
		await page.reload();
	});

	test('sets manual rank for a team', async ({ page }) => {
		await page.goto('/groups/A');
		await expect(page.getByText('順位表')).toBeVisible();

		const rankInput = page
			.locator('input[placeholder="理由"]')
			.first()
			.locator('..')
			.locator('input[type="number"]')
			.first();
		await rankInput.evaluate((el, value) => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, value);
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}, '1');

		const reasonInput = page.locator('input[placeholder="理由"]').first();
		await reasonInput.evaluate((el, value) => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, value);
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}, 'E2E test');

		await reasonInput.locator('..').getByRole('button', { name: '保存' }).click();
		await page.waitForTimeout(800);
		await page.reload();

		await expect(page.getByText('手動').last()).toBeVisible();
	});
});
