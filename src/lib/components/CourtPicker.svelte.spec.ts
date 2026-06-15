import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import CourtPicker from './CourtPicker.svelte';

type CourtPickerProps = {
	initialVenue?: string;
	initialCourts?: string;
};

async function renderCourtPicker(props: CourtPickerProps = {}) {
	const result = await render(CourtPicker, props);

	const getVenueTrigger = () => {
		const trigger = result.container.querySelector<HTMLButtonElement>('[data-select-trigger]');

		if (!trigger) {
			throw new Error('[data-select-trigger] が見つかりません');
		}

		return page.elementLocator(trigger);
	};

	const getHiddenInput = () => {
		const input = result.container.querySelector<HTMLInputElement>('input[name="courtBlockCode"]');

		if (!input) {
			throw new Error('input[name="courtBlockCode"] が見つかりません');
		}

		return page.elementLocator(input);
	};

	return {
		...result,
		getVenueTrigger,
		getHiddenInput
	};
}

// ─── initial render ───────────────────────────────────────────────────────────

describe('CourtPicker.svelte — initial state', () => {
	it('shows guide text when no venue is selected', async () => {
		await renderCourtPicker({ initialVenue: '', initialCourts: '' });

		await expect.element(page.getByText('体育館を選ぶとコートが表示されます')).toBeInTheDocument();
	});

	it('shows no court checkboxes when no venue is set', async () => {
		await renderCourtPicker({ initialVenue: '' });

		const checkboxes = await page.getByRole('checkbox').all();
		expect(checkboxes).toHaveLength(0);
	});

	it('hidden input has empty value when no courts selected', async () => {
		const { getHiddenInput } = await renderCourtPicker({ initialVenue: '' });

		await expect.element(getHiddenInput()).toHaveValue('');
	});
});

// ─── pre-filled venue via initialVenue ───────────────────────────────────────

describe('CourtPicker.svelte — pre-filled venue', () => {
	it('shows 6 court checkboxes for 第一体育館 (first_gym)', async () => {
		await renderCourtPicker({ initialVenue: 'first_gym', initialCourts: '' });

		const checkboxes = await page.getByRole('checkbox').all();
		expect(checkboxes).toHaveLength(6);
	});

	it('shows 8 court checkboxes for 第二体育館 (second_gym)', async () => {
		await renderCourtPicker({ initialVenue: 'second_gym', initialCourts: '' });

		const checkboxes = await page.getByRole('checkbox').all();
		expect(checkboxes).toHaveLength(8);
	});

	it('shows court labels「1面」through「6面」for first_gym', async () => {
		await renderCourtPicker({ initialVenue: 'first_gym', initialCourts: '' });

		for (let n = 1; n <= 6; n++) {
			await expect.element(page.getByText(`${n}面`)).toBeInTheDocument();
		}
	});
});

// ─── pre-filled courts via initialCourts ─────────────────────────────────────

describe('CourtPicker.svelte — pre-filled courts', () => {
	it('pre-checks the courts specified in initialCourts', async () => {
		await renderCourtPicker({
			initialVenue: 'first_gym',
			initialCourts: '[1,3]'
		});

		const cb1 = page.getByRole('checkbox', { name: '1面' });
		const cb3 = page.getByRole('checkbox', { name: '3面' });

		await expect.element(cb1).toHaveAttribute('aria-checked', 'true');
		await expect.element(cb3).toHaveAttribute('aria-checked', 'true');
	});

	it('leaves other courts unchecked', async () => {
		await renderCourtPicker({
			initialVenue: 'first_gym',
			initialCourts: '[1,3]'
		});

		const cb2 = page.getByRole('checkbox', { name: '2面' });

		await expect.element(cb2).toHaveAttribute('aria-checked', 'false');
	});

	it('hidden input reflects pre-filled selection as JSON', async () => {
		const { getHiddenInput } = await renderCourtPicker({
			initialVenue: 'first_gym',
			initialCourts: '[2,4]'
		});

		await expect.element(getHiddenInput()).toHaveValue('[2,4]');
	});

	it('empty JSON array initialCourts → no checkboxes checked', async () => {
		await renderCourtPicker({
			initialVenue: 'first_gym',
			initialCourts: '[]'
		});

		const checkboxes = await page.getByRole('checkbox').all();

		for (const checkbox of checkboxes) {
			await expect.element(checkbox).toHaveAttribute('aria-checked', 'false');
		}
	});

	it('named court block initialCourts pre-checks its courts', async () => {
		await renderCourtPicker({
			initialVenue: 'first_gym',
			initialCourts: 'first_1_3'
		});

		await expect
			.element(page.getByRole('checkbox', { name: '1面' }))
			.toHaveAttribute('aria-checked', 'true');
		await expect
			.element(page.getByRole('checkbox', { name: '2面' }))
			.toHaveAttribute('aria-checked', 'true');
		await expect
			.element(page.getByRole('checkbox', { name: '3面' }))
			.toHaveAttribute('aria-checked', 'true');
		await expect
			.element(page.getByRole('checkbox', { name: '4面' }))
			.toHaveAttribute('aria-checked', 'false');
	});

	it('invalid initialCourts leaves all courts unchecked and hidden input empty', async () => {
		const { getHiddenInput } = await renderCourtPicker({
			initialVenue: 'first_gym',
			initialCourts: 'not-json-or-block'
		});

		await expect
			.element(page.getByRole('checkbox', { name: '1面' }))
			.toHaveAttribute('aria-checked', 'false');
		await expect.element(getHiddenInput()).toHaveValue('');
	});

	it('filters invalid court values from JSON initialCourts', async () => {
		const { getHiddenInput } = await renderCourtPicker({
			initialVenue: 'first_gym',
			initialCourts: '[0,-1,"2","bad"]'
		});

		await expect
			.element(page.getByRole('checkbox', { name: '2面' }))
			.toHaveAttribute('aria-checked', 'true');
		await expect.element(getHiddenInput()).toHaveValue('[2]');
	});
});

// ─── court toggle interaction ─────────────────────────────────────────────────

describe('CourtPicker.svelte — checkbox interaction', () => {
	it('clicking an unchecked court checkbox checks it', async () => {
		await renderCourtPicker({
			initialVenue: 'first_gym',
			initialCourts: ''
		});

		const cb1 = page.getByRole('checkbox', { name: '1面' });

		await expect.element(cb1).toHaveAttribute('aria-checked', 'false');

		await cb1.click();

		await expect.element(cb1).toHaveAttribute('aria-checked', 'true');
	});

	it('clicking a checked court checkbox unchecks it', async () => {
		await renderCourtPicker({
			initialVenue: 'first_gym',
			initialCourts: '[2]'
		});

		const cb2 = page.getByRole('checkbox', { name: '2面' });

		await expect.element(cb2).toHaveAttribute('aria-checked', 'true');

		await cb2.click();

		await expect.element(cb2).toHaveAttribute('aria-checked', 'false');
	});

	it('hidden input updates to reflect new selection after click', async () => {
		const { getHiddenInput } = await renderCourtPicker({
			initialVenue: 'first_gym',
			initialCourts: ''
		});

		await page.getByRole('checkbox', { name: '3面' }).click();

		await expect.element(getHiddenInput()).toHaveValue('[3]');
	});

	it('selecting multiple courts produces sorted JSON array', async () => {
		const { getHiddenInput } = await renderCourtPicker({
			initialVenue: 'first_gym',
			initialCourts: ''
		});

		await page.getByRole('checkbox', { name: '3面' }).click();
		await page.getByRole('checkbox', { name: '1面' }).click();

		await expect.element(getHiddenInput()).toHaveValue('[1,3]');
	});

	it('deselecting all courts empties the hidden input', async () => {
		const { getHiddenInput } = await renderCourtPicker({
			initialVenue: 'first_gym',
			initialCourts: '[1]'
		});

		await page.getByRole('checkbox', { name: '1面' }).click();

		await expect.element(getHiddenInput()).toHaveValue('');
	});

	it('changing venue clears selected courts and renders the new venue court count', async () => {
		const { getHiddenInput, getVenueTrigger } = await renderCourtPicker({
			initialVenue: 'first_gym',
			initialCourts: '[1,3]'
		});

		await expect.element(getHiddenInput()).toHaveValue('[1,3]');

		await getVenueTrigger().click();
		await page.getByRole('option', { name: '第二体育館' }).click();

		await expect.element(getHiddenInput()).toHaveValue('');
		const checkboxes = await page.getByRole('checkbox').all();
		expect(checkboxes).toHaveLength(8);
	});
});
