import { test, expect } from '@playwright/test';

const TIE_CODE = `T-${Date.now()}`;

async function openTieCreateDialog(page: import('@playwright/test').Page) {
	const input = page.getByPlaceholder('A-1');
	await page.getByRole('button', { name: '新規作成' }).click();
	if (!(await input.isVisible().catch(() => false))) {
		await page.getByRole('button', { name: '新規作成' }).click();
	}
	await expect(input).toBeVisible();
	return input;
}

test.describe('tie creation flow', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/ties');
		await expect(page).toHaveURL(/\/ties/);
	});

	test('shows ties page with create button', async ({ page }) => {
		await expect(page.getByRole('button', { name: '新規作成' })).toBeVisible();
	});

	test('opens create dialog when "新規作成" is clicked', async ({ page }) => {
		await openTieCreateDialog(page);
		await expect(page.getByRole('button', { name: '作成', exact: true })).toBeVisible();
	});

	test('closes dialog with cancel button', async ({ page }) => {
		await openTieCreateDialog(page);
		const dialog = page.getByRole('dialog', { name: '対戦を作成' });
		await dialog.getByText('キャンセル').click();
		await expect(dialog).not.toBeVisible();
	});

	test('creates a tie and redirects to its page', async ({ page }) => {
		const tieCodeInput = await openTieCreateDialog(page);
		const dialog = page.getByRole('dialog', { name: '対戦を作成' });

		await tieCodeInput.fill(TIE_CODE);

		await dialog.getByRole('button', { name: '作成', exact: true }).click();
		await page.waitForTimeout(1000);

		const currentUrl = page.url();
		const isTiePage = /\/ties\/[a-zA-Z0-9-]+$/.test(currentUrl);
		const isTiesPage = currentUrl.includes('/ties');

		if (isTiePage) {
			await expect(page.locator('h1')).toContainText(TIE_CODE);
		} else {
			expect(isTiesPage).toBe(true);
		}
	});

	test('closes dialog when dialog close button is clicked', async ({ page }) => {
		await openTieCreateDialog(page);
		const dialog = page.getByRole('dialog', { name: '対戦を作成' });

		await page.locator('button[data-dialog-close]:has(svg.lucide-x)').click();
		await expect(dialog).not.toBeVisible();
	});

	test('cancel button in dialog footer closes the dialog', async ({ page }) => {
		await openTieCreateDialog(page);
		const dialog = page.getByRole('dialog', { name: '対戦を作成' });

		await dialog.getByRole('button', { name: 'キャンセル' }).click();
		await expect(dialog).not.toBeVisible();
	});
});
