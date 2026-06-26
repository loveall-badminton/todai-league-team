/// <reference types="@types/node" />

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	timeout: 30000,
	expect: { timeout: 10000 },
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: 'list',
	globalSetup: './e2e/global-setup.ts',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			name: 'setup',
			testMatch: '**/*.setup.ts',
			testDir: './e2e'
		},
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				storageState: 'e2e/.auth/user.json'
			},
			dependencies: ['setup']
		}
	],
	webServer: {
		// Build + init isolated E2E DB → start wrangler dev
		command: 'bash scripts/start-e2e-server.sh',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 120000
	}
});
