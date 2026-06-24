import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CollapsibleSection from './CollapsibleSection.svelte';

describe('CollapsibleSection.svelte', () => {
	it('renders the title', async () => {
		render(CollapsibleSection, {
			props: { title: 'スコア訂正' }
		});
		await expect.element(page.getByText('スコア訂正')).toBeInTheDocument();
	});

	it('starts closed by default', async () => {
		render(CollapsibleSection, {
			props: { title: '詳細' }
		});
		const trigger = page.getByRole('button', { name: '詳細' });
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	it('toggles open when trigger is clicked', async () => {
		render(CollapsibleSection, {
			props: { title: '詳細' }
		});
		const trigger = page.getByRole('button', { name: '詳細' });
		await trigger.click();
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');
	});

	it('toggles closed when trigger is clicked twice', async () => {
		render(CollapsibleSection, {
			props: { title: '詳細' }
		});
		const trigger = page.getByRole('button', { name: '詳細' });
		await trigger.click();
		await trigger.click();
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	it('toggles data-state on content element', async () => {
		const result = render(CollapsibleSection, {
			props: { title: '詳細' }
		});
		const contentEl = result.container.querySelector('[data-collapsible-content]');

		expect(contentEl).not.toBeNull();
		expect(contentEl).toHaveAttribute('data-state', 'closed');

		await page.getByRole('button', { name: '詳細' }).click();
		expect(contentEl).toHaveAttribute('data-state', 'open');
	});

	it('renders app class on trigger', async () => {
		render(CollapsibleSection, {
			props: { title: '詳細', class: 'rounded-xl bg-zinc-100 p-4' }
		});
		const trigger = page.getByRole('button', { name: '詳細' });
		await expect.element(trigger).toHaveClass('rounded-xl');
	});
});
