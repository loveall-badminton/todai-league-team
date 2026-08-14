import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AppButtonWithLabel from './test-fixtures/AppButtonWithLabel.svelte';

describe('AppButton.svelte', () => {
	it('renders its label and is not busy by default', async () => {
		render(AppButtonWithLabel);
		const button = page.getByRole('button', { name: 'Save' });
		await expect.element(button).toBeInTheDocument();
		await expect.element(button).not.toHaveAttribute('aria-busy', 'true');
	});

	it('shows a loading spinner and aria-busy when loading', async () => {
		render(AppButtonWithLabel, {
			props: { loading: true }
		});
		const button = page.getByRole('button', { name: 'Save' });
		await expect.element(button).toHaveAttribute('aria-busy', 'true');
		await expect.element(button).toBeDisabled();
		expect(document.querySelector('svg')).not.toBeNull();
	});
});
