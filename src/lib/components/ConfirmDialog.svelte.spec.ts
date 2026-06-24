import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ConfirmDialog from './ConfirmDialog.svelte';

describe('ConfirmDialog.svelte', () => {
	it('renders trigger button with label', async () => {
		render(ConfirmDialog, {
			props: { triggerLabel: '削除', title: '確認' }
		});
		await expect.element(page.getByRole('button', { name: '削除' })).toBeInTheDocument();
	});

	it('dialog is not visible initially', async () => {
		render(ConfirmDialog, {
			props: { triggerLabel: '削除', title: '確認' }
		});
		await expect.element(page.getByRole('button', { name: '削除' })).toBeInTheDocument();
	});

	it('opens dialog when trigger is clicked', async () => {
		render(ConfirmDialog, {
			props: { triggerLabel: '削除', title: '本当に削除しますか？' }
		});
		await page.getByRole('button', { name: '削除' }).click();
		await expect.element(page.getByText('本当に削除しますか？')).toBeInTheDocument();
	});

	it('shows description when provided', async () => {
		render(ConfirmDialog, {
			props: { triggerLabel: '削除', title: '確認', description: 'この操作は取り消せません' }
		});
		await page.getByRole('button', { name: '削除' }).click();
		await expect.element(page.getByText('この操作は取り消せません')).toBeInTheDocument();
	});

	it('closes dialog when cancel is clicked', async () => {
		render(ConfirmDialog, {
			props: { triggerLabel: '削除', title: '確認' }
		});
		await page.getByRole('button', { name: '削除' }).click();
		await expect.element(page.getByText('確認')).toBeInTheDocument();

		await page.getByRole('button', { name: 'キャンセル' }).click();
		await expect.element(page.getByText('確認')).not.toBeInTheDocument();
	});

	it('calls onConfirm and closes when confirm button is clicked', async () => {
		const onConfirm = vi.fn();
		render(ConfirmDialog, {
			props: { triggerLabel: '削除', title: '確認', onConfirm }
		});
		await page.getByRole('button', { name: '削除' }).click();
		await page.getByRole('button', { name: '実行する' }).click();

		expect(onConfirm).toHaveBeenCalledOnce();
		await expect.element(page.getByText('確認')).not.toBeInTheDocument();
	});

	it('renders confirm label when provided', async () => {
		render(ConfirmDialog, {
			props: { triggerLabel: '削除', title: '確認', confirmLabel: 'はい、削除します' }
		});
		await page.getByRole('button', { name: '削除' }).click();
		await expect
			.element(page.getByRole('button', { name: 'はい、削除します' }))
			.toBeInTheDocument();
	});

	it('hidden form is rendered when onConfirm is not set', async () => {
		const result = render(ConfirmDialog, {
			props: { triggerLabel: '削除', title: '確認', formAction: '/ties/delete' }
		});
		const form = result.container.querySelector('form');
		expect(form).not.toBeNull();
		expect(form).toHaveAttribute('method', 'POST');
		expect(form).toHaveAttribute('action', '/ties/delete');
		expect(form!.className).toContain('hidden');
	});

	it('hidden form has hidden field inputs', async () => {
		const result = render(ConfirmDialog, {
			props: {
				triggerLabel: '削除',
				title: '確認',
				formAction: '/ties/delete',
				hiddenFields: [
					{ name: 'tieId', value: '123' },
					{ name: 'reason', value: 'cancel' }
				]
			}
		});
		const tieInput = result.container.querySelector('input[name="tieId"]');
		expect(tieInput).not.toBeNull();
		expect(tieInput).toHaveAttribute('value', '123');

		const reasonInput = result.container.querySelector('input[name="reason"]');
		expect(reasonInput).not.toBeNull();
		expect(reasonInput).toHaveAttribute('value', 'cancel');
	});

	it('no hidden form when onConfirm is provided', async () => {
		const result = render(ConfirmDialog, {
			props: { triggerLabel: '削除', title: '確認', onConfirm: () => {} }
		});
		const form = result.container.querySelector('form');
		expect(form).toBeNull();
	});

	it('disabled trigger does not open dialog', async () => {
		render(ConfirmDialog, {
			props: { triggerLabel: '削除', title: '確認', disabled: true }
		});
		const trigger = page.getByRole('button', { name: '削除' });
		await trigger.click({ force: true });
		await expect.element(page.getByText('確認')).not.toBeInTheDocument();
	});
});
