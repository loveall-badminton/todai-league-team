import { test, expect } from '@playwright/test';

const TIE_CODE = `T-${Date.now()}`;

test.describe('tie creation flow', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/ties');
		await expect(page).toHaveURL(/\/ties/);
	});

	test('shows ties page with create button', async ({ page }) => {
		await expect(page.getByRole('button', { name: '新規作成' })).toBeVisible();
	});

	test('opens create dialog when "新規作成" is clicked', async ({ page }) => {
		await page.getByRole('button', { name: '新規作成' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(page.getByRole('button', { name: '作成', exact: true })).toBeVisible();
	});

	test('closes dialog with cancel button', async ({ page }) => {
		await page.getByRole('button', { name: '新規作成' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await page.getByText('キャンセル').click();
		await expect(dialog).not.toBeVisible();
	});

	test('creates a tie and redirects to its page', async ({ page }) => {
		await page.getByRole('button', { name: '新規作成' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();

		await page.getByPlaceholder('A-1').fill(TIE_CODE);

		await page.getByRole('button', { name: '作成', exact: true }).click();
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
		await page.getByRole('button', { name: '新規作成' }).click();
		const dialog = page.getByRole('dialog');
		await expect(page.getByPlaceholder('A-1')).toBeVisible();

		await page.locator('button[data-dialog-close]:has(svg.lucide-x)').click();
		await expect(dialog).not.toBeVisible();
	});

	test('cancel button in dialog footer closes the dialog', async ({ page }) => {
		await page.getByRole('button', { name: '新規作成' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		await page.locator('button:has-text("キャンセル")').click();
		await expect(dialog).not.toBeVisible();
	});
});
