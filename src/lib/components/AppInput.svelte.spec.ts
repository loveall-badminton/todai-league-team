import { tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AppInput from './AppInput.svelte';

describe('AppInput.svelte', () => {
	it('keeps the bound value after the parent form is reset', async () => {
		const form = document.body.appendChild(document.createElement('form'));
		render(AppInput, {
			target: form,
			props: { name: 'teamName', value: '東京大学', defaultValue: '東京大学' }
		});

		form.reset();
		await tick();

		const input = form.querySelector<HTMLInputElement>('input[name="teamName"]');
		expect(input?.value).toBe('東京大学');
		expect(new FormData(form).get('teamName')).toBe('東京大学');
	});
});
