import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		expect: { requireAssertions: true },
		coverage: {
			exclude: [
				'.svelte-kit/**',
				'src/lib/vitest-examples/**',
				'src/lib/server/db/schema.ts',
				'src/lib/server/db/*.schema.ts'
			],
			thresholds: {
				statements: 90,
				branches: 80,
				functions: 90,
				lines: 90
			}
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/**/*.cf.{test,spec}.{js,ts}']
				}
			},

			{
				extends: './vite.config.ts',
				plugins: [
					cloudflareTest({
						wrangler: { configPath: './wrangler.jsonc' }
					})
				],
				resolve: {
					alias: {
						'sveltekit-worker': './src/__mocks__/sveltekit-worker.ts'
					}
				},
				test: {
					name: 'cloudflare',
					include: ['src/**/*.cf.{test,spec}.{js,ts}']
				}
			}
		]
	},
	ssr: {
		noExternal: ['@lucide/svelte', '@dnd-kit/svelte', 'svelte-sonner']
	}
});
