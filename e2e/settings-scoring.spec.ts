import { test, expect } from '@playwright/test';

test.describe('settings scoring rules', () => {
	test('loads settings page with scoring rules', async ({ page }) => {
		await page.goto('/settings');
		await expect(page).toHaveURL(/\/settings/);
		await expect(page.getByText('得点ルール')).toBeVisible();
	});

	test('updates scoring rule numeric field and verifies persistence', async ({ page }) => {
		await page.goto('/settings');

		// Find the last rule form (KNOCKOUT_21) to avoid GROUP_15 defaults
		const forms = page.locator('form').filter({ has: page.locator('.font-mono') });
		const count = await forms.count();
		expect(count).toBeGreaterThanOrEqual(1);
		const form = forms.nth(count - 1);
		await expect(form).toBeVisible();

		const codeEl = form.locator('.font-mono').first();
		const ruleCode = await codeEl.textContent();
		expect(ruleCode).toBeTruthy();

		// Set hidden id for the enhanced form to work
		await form
			.locator('input[name="name"]')
			.first()
			.evaluate((el: HTMLInputElement, code: string) => {
				const f = el.closest('form');
				if (!f) return;
				const idInput = f.querySelector('input[name="id"]') as HTMLInputElement;
				if (idInput) idInput.value = code.trim();
			}, ruleCode!.trim());

		// Change the interval point
		const intervalLabel = form.locator('span').filter({ hasText: 'インターバル' });
		await expect(intervalLabel).toBeVisible();
		const intervalField = intervalLabel.locator('..').locator('input');
		await intervalField.evaluate((el: HTMLInputElement) => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, '13');
			el.dispatchEvent(new Event('input', { bubbles: true }));
		});
		await page.waitForTimeout(200);

		// Save
		await form.getByRole('button', { name: '保存' }).click();
		await page.waitForTimeout(3000);

		// Reload and verify value persisted
		await page.reload();
		await page.waitForTimeout(1000);

		const reloadForms = page.locator('form').filter({ has: page.locator('.font-mono') });
		const reloadCount = await reloadForms.count();
		const reloadForm = reloadForms.nth(reloadCount - 1);
		const updatedInterval = reloadForm
			.locator('span')
			.filter({ hasText: 'インターバル' })
			.locator('..')
			.locator('input');
		await updatedInterval.waitFor({ state: 'attached', timeout: 3000 });
		const currentValue = await updatedInterval.inputValue();
		expect(currentValue).toBe('13');

		// Reset to original value
		await reloadForm
			.locator('input[name="name"]')
			.first()
			.evaluate((el: HTMLInputElement, code: string) => {
				const f = el.closest('form');
				if (!f) return;
				const idInput = f.querySelector('input[name="id"]') as HTMLInputElement;
				if (idInput) idInput.value = code.trim();
			}, ruleCode!.trim());
		await updatedInterval.evaluate((el: HTMLInputElement) => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, '11');
			el.dispatchEvent(new Event('input', { bubbles: true }));
		});
		await page.waitForTimeout(200);
		await reloadForm.getByRole('button', { name: '保存' }).click();
		await page.waitForTimeout(1000);
	});
});
