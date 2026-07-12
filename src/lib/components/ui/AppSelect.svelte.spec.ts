import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import AppSelect from './AppSelect.svelte';

const items = [
	{ value: 'first_gym', label: '第一体育館' },
	{ value: 'second_gym', label: '第二体育館' }
];

function getTrigger(result: ReturnType<typeof render>) {
	const trigger = result.container.querySelector<HTMLButtonElement>('[data-select-trigger]');
	if (!trigger) throw new Error('[data-select-trigger] が見つかりません');
	return page.elementLocator(trigger);
}

describe('AppSelect.svelte', () => {
	it('shows the placeholder when value is empty', async () => {
		render(AppSelect, { name: 'venue', value: '', placeholder: '体育館を選択', items });

		await expect.element(page.getByText('体育館を選択')).toBeInTheDocument();
	});

	it('shows the selected item label', async () => {
		render(AppSelect, { name: 'venue', value: 'second_gym', items });

		await expect.element(page.getByText('第二体育館')).toBeInTheDocument();
	});

	it('falls back to placeholder when value is not in items', async () => {
		render(AppSelect, { name: 'venue', value: 'unknown', placeholder: '未設定', items });

		await expect.element(page.getByText('未設定')).toBeInTheDocument();
	});

	it('opens options and calls onValueChange when an item is selected', async () => {
		const onValueChange = vi.fn();
		const result = render(AppSelect, {
			name: 'venue',
			value: '',
			placeholder: '体育館を選択',
			items,
			onValueChange
		});

		await getTrigger(result).click();
		await expect.element(page.getByRole('option', { name: '第一体育館' })).toBeInTheDocument();

		await page.getByRole('option', { name: '第二体育館' }).click();

		expect(onValueChange).toHaveBeenCalledWith('second_gym');
		await expect.element(page.getByText('第二体育館')).toBeInTheDocument();
	});

	it('keeps the selected value after the parent form is reset', async () => {
		const form = document.body.appendChild(document.createElement('form'));
		render(AppSelect, {
			target: form,
			props: { name: 'venue', value: 'second_gym', items }
		});

		form.reset();
		await tick();

		await expect.element(page.getByText('第二体育館')).toBeInTheDocument();
		expect(new FormData(form).get('venue')).toBe('second_gym');
	});

	it('marks the trigger as disabled when disabled=true', async () => {
		const result = render(AppSelect, { name: 'venue', value: '', items, disabled: true });

		await expect.element(getTrigger(result)).toBeDisabled();
	});

	it('applies custom classes to the trigger', async () => {
		const result = render(AppSelect, { name: 'venue', value: '', items, class: 'max-w-xs' });

		await expect.element(getTrigger(result)).toHaveClass('max-w-xs');
	});
});
