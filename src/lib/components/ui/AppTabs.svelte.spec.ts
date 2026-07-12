import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AppTabs from './AppTabs.svelte';

const items = [
	{ value: 'all', label: 'すべて' },
	{ value: 'playing', label: '進行中' },
	{ value: 'finished', label: '終了' }
];

// ─── rendering ───────────────────────────────────────────────────────────────

describe('AppTabs.svelte — rendering', () => {
	it('renders all tab trigger labels', async () => {
		render(AppTabs, { items, value: 'all' });
		await expect.element(page.getByText('すべて')).toBeInTheDocument();
		await expect.element(page.getByText('進行中')).toBeInTheDocument();
		await expect.element(page.getByText('終了')).toBeInTheDocument();
	});

	it('renders three tab triggers', async () => {
		render(AppTabs, { items, value: 'all' });
		const tabs = page.getByRole('tab');
		const all = await tabs.all();
		expect(all).toHaveLength(3);
	});

	it('active tab has dark background class', async () => {
		render(AppTabs, { items, value: 'playing' });
		// The active trigger gets bg-zinc-900 text-white
		const activeTab = page.getByRole('tab', { name: '進行中' });
		await expect.element(activeTab).toHaveClass('bg-zinc-900');
	});

	it('inactive tabs have border style (not dark background)', async () => {
		render(AppTabs, { items, value: 'all' });
		// Inactive tabs get border border-zinc-200 bg-white
		const inactiveTab = page.getByRole('tab', { name: '進行中' });
		await expect.element(inactiveTab).toHaveClass('bg-white');
	});

	it('renders count badge when item has count property', async () => {
		const itemsWithCount = [
			{ value: 'a', label: 'タブA', count: 3 },
			{ value: 'b', label: 'タブB', count: 0 }
		];
		render(AppTabs, { items: itemsWithCount, value: 'a' });
		await expect.element(page.getByText('3')).toBeInTheDocument();
		await expect.element(page.getByText('0')).toBeInTheDocument();
	});

	it('does not render count badge when count is undefined', async () => {
		render(AppTabs, { items, value: 'all' });
		// items have no count property → no numeric-only badge text
		// getByText with regex matches elements whose full text is only digits
		await expect.element(page.getByText(/^\d+$/)).not.toBeInTheDocument();
	});
});

// ─── interaction ─────────────────────────────────────────────────────────────

describe('AppTabs.svelte — click interaction', () => {
	it('clicking a different tab makes it appear active', async () => {
		render(AppTabs, { items, value: 'all' });

		const playingTab = page.getByRole('tab', { name: '進行中' });
		// Initially inactive
		await expect.element(playingTab).toHaveClass('bg-white');

		await playingTab.click();

		// After click, '進行中' tab is now active
		await expect.element(playingTab).toHaveClass('bg-zinc-900');
	});

	it('clicking a tab deactivates the previously active tab', async () => {
		render(AppTabs, { items, value: 'all' });

		const allTab = page.getByRole('tab', { name: 'すべて' });
		await expect.element(allTab).toHaveClass('bg-zinc-900');

		// Click a different tab
		await page.getByRole('tab', { name: '終了' }).click();

		// Original active tab is now inactive
		await expect.element(allTab).toHaveClass('bg-white');
	});

	it('calls onValueChange callback with the new value', async () => {
		const onValueChange = vi.fn();
		render(AppTabs, { items, value: 'all', onValueChange });

		await page.getByRole('tab', { name: '進行中' }).click();

		expect(onValueChange).toHaveBeenCalledWith('playing');
	});

	it('clicking already-active tab does not toggle it off', async () => {
		const onValueChange = vi.fn();
		render(AppTabs, { items, value: 'all', onValueChange });

		await page.getByRole('tab', { name: 'すべて' }).click();

		// Clicking the already-active tab may still fire, but the value stays the same
		const allTab = page.getByRole('tab', { name: 'すべて' });
		// The tab remains styled as active (it's a Tabs component, not a toggle)
		await expect.element(allTab).toHaveClass('bg-zinc-900');
	});
});

// ─── empty items ──────────────────────────────────────────────────────────────

describe('AppTabs.svelte — edge cases', () => {
	it('renders no tabs when items is empty', async () => {
		render(AppTabs, { items: [], value: '' });
		const tabs = page.getByRole('tab');
		await expect.element(tabs).not.toBeInTheDocument();
	});

	it('single tab is rendered and active', async () => {
		render(AppTabs, { items: [{ value: 'only', label: '唯一' }], value: 'only' });
		const tab = page.getByRole('tab', { name: '唯一' });
		await expect.element(tab).toHaveClass('bg-zinc-900');
	});
});
