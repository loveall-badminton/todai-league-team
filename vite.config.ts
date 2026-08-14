import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import contentCollections from '@content-collections/vite';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const isTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
const basePlugins = [tailwindcss(), sveltekit()];

export default defineConfig({
	plugins: isTest ? basePlugins : [tailwindcss(), contentCollections(), sveltekit()],
	test: {
		expect: { requireAssertions: true },
		coverage: {
			provider: 'istanbul',
			exclude: [
				'.svelte-kit/**',
				'src/lib/server/db/schema.ts',
				'src/lib/server/db/*.schema.ts',
				'scripts/**'
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
					exclude: ['src/lib/server/**'],
					setupFiles: ['./src/lib/vitest-browser-setup.ts']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: [
						'src/**/*.{test,spec}.{js,ts}',
						'workers/**/*.{test,spec}.{js,ts}',
						'scripts/**/*.{test,spec}.{js,ts}'
					],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/**/*.cf.{test,spec}.{js,ts}']
				}
			},

			{
				extends: './vite.config.ts',
				plugins: [
					cloudflareTest({
						wrangler: { configPath: './wrangler.jsonc' },
						miniflare: {
							// wrangler.jsonc の BACKUP_WORKER は外部 Worker (todai-league-backup) への
							// Service Binding。テストでは解決できないためスタブする。
							serviceBindings: {
								BACKUP_WORKER: () => new Response('backup worker stub', { status: 503 })
							}
						}
					})
				],
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
