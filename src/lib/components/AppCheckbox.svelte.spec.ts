import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AppCheckbox from './AppCheckbox.svelte';

describe('AppCheckbox.svelte', () => {
	it('renders the optional label', async () => {
		render(AppCheckbox, { label: '出場可', checked: false });

		await expect.element(page.getByText('出場可')).toBeInTheDocument();
	});

	it('reflects the checked state through aria-checked and active styling', async () => {
		const result = render(AppCheckbox, { label: '選択済み', checked: true });

		const checkbox = page.getByRole('checkbox', { name: '選択済み' });
		const box = result.container.querySelector<HTMLDivElement>('[role="checkbox"] > div');
		if (!box) throw new Error('checkbox box が見つかりません');

		await expect.element(checkbox).toHaveAttribute('aria-checked', 'true');
		await expect.element(page.elementLocator(box)).toHaveClass('bg-zinc-950');
	});

	it('toggles when clicked and calls onCheckedChange', async () => {
		const onCheckedChange = vi.fn();
		render(AppCheckbox, { label: '1面', checked: false, onCheckedChange });

		const checkbox = page.getByRole('checkbox', { name: '1面' });
		await checkbox.click();

		await expect.element(checkbox).toHaveAttribute('aria-checked', 'true');
		expect(onCheckedChange).toHaveBeenCalledTimes(1);
	});

	it('keeps disabled checkbox from toggling', async () => {
		const onCheckedChange = vi.fn();
		render(AppCheckbox, { label: '停止中', checked: false, disabled: true, onCheckedChange });

		const checkbox = page.getByRole('checkbox', { name: '停止中' });
		await checkbox.click({ force: true });

		await expect.element(checkbox).toHaveAttribute('aria-checked', 'false');
		expect(onCheckedChange).not.toHaveBeenCalled();
	});

	it('passes name and value to the checkbox root', async () => {
		const result = render(AppCheckbox, {
			label: '提出',
			name: 'submitted',
			value: 'yes',
			checked: true
		});

		const input = result.container.querySelector<HTMLInputElement>('input[name="submitted"]');
		if (!input) throw new Error('input[name="submitted"] が見つかりません');

		const inputLocator = page.elementLocator(input);
		await expect.element(inputLocator).toHaveAttribute('value', 'yes');
		await expect.element(inputLocator).toBeChecked();
	});
});
