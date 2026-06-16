import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
		experimental: {
			async: true
		}
	},
	kit: {
		// ビルド書き出し先のみ wrangler.adapter.jsonc を使う。
		// deploy / types / dev は本番の wrangler.jsonc（main = src/worker.ts）を使う。
		adapter: adapter({ config: 'wrangler.adapter.jsonc' }),
		experimental: {
			remoteFunctions: true
		},
		version: {
			pollInterval: 30_000
		},
		typescript: {
			config: (config) => ({
				...config,
				include: [...config.include, '../drizzle.config.ts']
			})
		}
	},
	vitePlugin: {
		inspector: {
			showToggleButton: 'always'
		}
	}
};

export default config;
