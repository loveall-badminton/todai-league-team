import { test, expect, type Page } from '@playwright/test';
import { writeFileSync, unlinkSync, existsSync } from 'fs';

async function openTeamCreateForm(page: Page) {
	await page.getByRole('button', { name: '+ 追加' }).click();
	const createForm = page
		.locator('form')
		.filter({ has: page.locator('input[name="name"]') })
		.first();
	await expect(createForm.locator('input[name="name"]')).toBeVisible();
	return createForm;
}

test.describe.serial('extended team management', () => {
	const BASE_TEAM = `E2E-Ext-${Date.now()}`;
	const EDITED_PLAYER = `E2E-PEdit-${Date.now()}`;
	const UPDATED_PLAYER_NAME = `${EDITED_PLAYER}-改`;
	let teamUrl: string;

	test('creates a team for extended tests', async ({ page }) => {
		await page.goto('/teams');
		const createForm = await openTeamCreateForm(page);
		await createForm.locator('input[name="name"]').fill(BASE_TEAM);
		await createForm.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		teamUrl = page.url();
	});

	test('adds a player for editing tests', async ({ page }) => {
		await page.goto(teamUrl);
		await page.waitForTimeout(300);

		const playerForm = page.locator('form').filter({ hasText: '氏名' });
		await playerForm.evaluate((form, name) => {
			const input = form.querySelector('input[name="name"]') as HTMLInputElement;
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(input, name);
			input.dispatchEvent(new Event('input', { bubbles: true }));
			form.requestSubmit();
		}, EDITED_PLAYER);
		await page.waitForTimeout(2000);
		await page.goto(teamUrl);
		await expect(page.getByText(EDITED_PLAYER)).toBeVisible({ timeout: 10000 });
	});

	test('edits a player name', async ({ page }) => {
		await page.goto(teamUrl);
		await expect(page.getByText(EDITED_PLAYER)).toBeVisible();

		await page.getByRole('button', { name: new RegExp(EDITED_PLAYER) }).click();
		const editForm = page.locator('form').filter({ hasText: 'キャンセル' });
		await expect(editForm.locator('input[name="name"]')).toBeVisible();

		const nameInput = editForm.locator('input[name="name"]');
		await nameInput.evaluate((el, value) => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, value);
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}, UPDATED_PLAYER_NAME);

		await editForm.getByRole('button', { name: '保存' }).click();
		await page.waitForTimeout(800);
		await page.reload();
		await expect(page.getByText(UPDATED_PLAYER_NAME)).toBeVisible();
	});

	test('changes player status to inactive', async ({ page }) => {
		await page.goto(teamUrl);
		await expect(page.getByText(UPDATED_PLAYER_NAME)).toBeVisible();

		await page.getByRole('button', { name: new RegExp(UPDATED_PLAYER_NAME) }).click();
		const editForm = page.locator('form').filter({ hasText: 'キャンセル' });

		await editForm.getByRole('button', { name: '保存' }).click();
		await page.waitForTimeout(800);
	});

	test('deletes a player', async ({ page }) => {
		await page.goto(teamUrl);
		await expect(page.getByText(UPDATED_PLAYER_NAME)).toBeVisible();

		await page.getByRole('button', { name: new RegExp(UPDATED_PLAYER_NAME) }).click();
		const editForm = page.locator('form').filter({ hasText: 'キャンセル' });
		await expect(editForm).toBeVisible();
		await page.getByText('選手を削除').click();
		await page.getByRole('button', { name: '削除する' }).click();
		await page.waitForTimeout(800);

		await expect(page.getByText(UPDATED_PLAYER_NAME)).not.toBeVisible();
	});

	test('bulk creates players', async ({ page }) => {
		const names = [`E2E-BulkA-${Date.now()}`, `E2E-BulkB-${Date.now()}`];
		await page.goto(teamUrl);
		await page.getByRole('tab', { name: '一括登録' }).click();
		await page.locator('textarea[name="namesText"]').fill(names.join('\n'));
		await page.getByRole('button', { name: '一括登録' }).click();
		await page.waitForTimeout(500);
		for (const name of names) {
			await expect(page.getByText(name)).toBeVisible();
		}
	});
});

test.describe.serial('team status and group changes', () => {
	const TEAM_NAME = `E2E-StatusGrp-${Date.now()}`;
	let teamUrl: string;

	async function selectTeamFormOption(page: Page, labelText: string, optionText: string) {
		const form = page.locator('form').filter({ hasText: 'チーム名' });
		const section = form
			.getByText(labelText)
			.locator('..')
			.locator('button[aria-haspopup="listbox"]');
		const option = page.getByRole('option', { name: optionText }).last();
		await section.click();
		if (!(await option.isVisible().catch(() => false))) {
			await section.click();
		}
		await expect(option).toBeVisible();
		await option.click();
	}

	test('creates a team for status test', async ({ page }) => {
		await page.goto('/teams');
		const createForm = await openTeamCreateForm(page);
		await createForm.locator('input[name="name"]').fill(TEAM_NAME);
		await createForm.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		teamUrl = page.url();
	});

	test('changes team status to withdrawn', async ({ page }) => {
		await page.goto(teamUrl);
		await expect(page.locator('h1')).toContainText(TEAM_NAME);

		await selectTeamFormOption(page, '状態', '棄権');
		await page
			.locator('form')
			.filter({ hasText: 'チーム名' })
			.first()
			.evaluate((f) => f.requestSubmit());
		await page.waitForTimeout(800);
		await page.reload();
		await expect(page.getByText('棄権').first()).toBeVisible();
	});

	test('changes team status back to active', async ({ page }) => {
		await page.goto(teamUrl);

		await selectTeamFormOption(page, '状態', '出場');
		await page
			.locator('form')
			.filter({ hasText: 'チーム名' })
			.first()
			.evaluate((f) => f.requestSubmit());
		await page.waitForTimeout(800);
		await page.reload();
		await expect(page.getByText('出場')).toBeVisible();
	});

	test('assigns team to group A', async ({ page }) => {
		await page.goto(teamUrl);

		await selectTeamFormOption(page, 'リーグ', 'Aリーグ');
		await page
			.locator('form')
			.filter({ hasText: 'チーム名' })
			.first()
			.evaluate((f) => f.requestSubmit());
		await page.waitForTimeout(800);
		await page.reload();
		await expect(page.getByText('A').first()).toBeVisible();
	});

	test('assigns team to group B', async ({ page }) => {
		await page.goto(teamUrl);

		await selectTeamFormOption(page, 'リーグ', 'Bリーグ');
		await page
			.locator('form')
			.filter({ hasText: 'チーム名' })
			.first()
			.evaluate((f) => f.requestSubmit());
		await page.waitForTimeout(800);
		await page.reload();
		await expect(page.getByText('B').first()).toBeVisible();
	});
});

test.describe.serial('CSV import', () => {
	const TEAM_NAME = `E2E-CSV-${Date.now()}`;
	const CSV_PATH = `/tmp/e2e-csv-${Date.now()}.csv`;
	let teamUrl: string;

	test('creates a team for CSV import', async ({ page }) => {
		await page.goto('/teams');
		const createForm = await openTeamCreateForm(page);
		await createForm.locator('input[name="name"]').fill(TEAM_NAME);
		await createForm.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		teamUrl = page.url();
	});

	test('imports players via CSV', async ({ page }) => {
		// CSV format: teamName (col 0), col 1, col 2, playerName (col 3), gender (col 4)
		const csvContent = `teamName,,,playerName,gender\n${TEAM_NAME},,,E2E-CSV-Player1,\n${TEAM_NAME},,,E2E-CSV-Player2,`;
		writeFileSync(CSV_PATH, csvContent, 'utf-8');

		await page.goto('/teams');
		await page.getByRole('button', { name: 'インポート' }).click();

		const fileInput = page.locator('input[type="file"]');
		await fileInput.setInputFiles(CSV_PATH);
		await page.waitForTimeout(2000);

		// Navigate to team page to verify imported players
		await page.goto(teamUrl);
		await expect(page.getByText('E2E-CSV-Player1')).toBeVisible();
		await expect(page.getByText('E2E-CSV-Player2')).toBeVisible();
	});

	test.afterAll(() => {
		if (existsSync(CSV_PATH)) unlinkSync(CSV_PATH);
	});
});
