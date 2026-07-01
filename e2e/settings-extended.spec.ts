import { test, expect } from '@playwright/test';

test.describe('settings extended', () => {
	test('loads settings with scoring rules', async ({ page }) => {
		await page.goto('/settings');
		await expect(page).toHaveURL(/\/settings/);
		await expect(page.getByText('得点ルール')).toBeVisible();
	});

	test('updates scoring rule name', async ({ page }) => {
		await page.goto('/settings');
		const updatedName = `E2E-Rule-${Date.now()}`;

		const nameInput = page.locator('input[name="name"]').first();

		await nameInput.evaluate((el, value) => {
			const form = el.closest('form') as HTMLFormElement;
			if (!form) return;

			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, value);
			el.dispatchEvent(new Event('input', { bubbles: true }));

			const codeEl = form.querySelector('.font-mono');
			const ruleId = codeEl?.textContent?.trim();
			const idInput = form.querySelector('input[name="id"]') as HTMLInputElement;
			if (idInput && ruleId) {
				idInput.value = ruleId;
			}
		}, updatedName);
		await page.waitForTimeout(200);

		const saveBtn = nameInput.locator('..').locator('..').getByRole('button', { name: '保存' });
		await saveBtn.click();
		await page.waitForTimeout(3000);
		await page.reload();

		await expect(page.locator('input[name="name"]').first()).toHaveValue(updatedName);
	});

	test('changes lineup reveal policy', async ({ page }) => {
		await page.goto('/settings');
		await page.waitForTimeout(500);
		await expect(page).toHaveURL(/\/settings/);

		const trigger = page
			.locator('button[data-select-trigger]')
			.filter({ hasText: '試合開始時に公開' });
		await trigger.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: '手動' }).click();

		const saveBtn = page.locator('button[type="submit"]').filter({ hasText: '保存' }).first();
		await saveBtn.click();
		await page.waitForTimeout(800);
		await page.reload();

		await expect(page.getByText('手動').first()).toBeVisible();

		const trigger2 = page.locator('button[data-select-trigger]').filter({ hasText: '手動' });
		await trigger2.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: '試合開始時に公開' }).click();
		await saveBtn.click();
		await page.waitForTimeout(500);
	});
});
