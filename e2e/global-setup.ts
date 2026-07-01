import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'fs';

const ADMIN = { accountId: 'testadmin', password: 'TestAdmin123', name: 'Test Admin' };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function globalSetup(_config: FullConfig) {
	// Ensure the auth directory exists (it's gitignored, so not committed)
	mkdirSync('e2e/.auth', { recursive: true });

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
	const page = await context.newPage();

	page.on('pageerror', (err) => console.error(`[PAGE ERROR] ${err.message}`));
	page.on('console', (msg) => {
		if (msg.type() === 'error') console.error(`[PAGE console.error] ${msg.text()}`);
	});

	// Navigate to bootstrap page
	await page.goto('/auth/bootstrap', { waitUntil: 'load' });
	console.log('[SETUP] Bootstrap page load URL:', page.url());

	const bootstrapInput = page.locator('input[name="accountId"]');
	const formVisible = await bootstrapInput.isVisible({ timeout: 5000 }).catch(() => false);

	if (formVisible) {
		// Fresh DB — fill and submit the bootstrap form
		console.log('[SETUP] Bootstrap form visible — creating admin…');
		await page.fill('input[name="accountId"]', ADMIN.accountId);
		await page.fill('input[name="name"]', ADMIN.name);
		await page.fill('input[name="password"]', ADMIN.password);
		await page.locator('button[type="submit"]').click();
		await page.waitForTimeout(3000);
		await page.waitForLoadState('load');
		console.log('[SETUP] After bootstrap submit URL:', page.url());
	} else {
		// Admin already exists (server reuse) — skip bootstrap
		console.log('[SETUP] Bootstrap form not visible — admin already exists, going to login…');
	}

	// Navigate to login if not already there
	if (!page.url().includes('/auth/login')) {
		console.log('[SETUP] Navigating to login…');
		await page.goto('/auth/login', { waitUntil: 'load' });
	}

	if (page.url().includes('/auth/login')) {
		console.log('[SETUP] On login page — signing in…');
		await page.waitForSelector('input[name="accountId"]', { timeout: 5000 });
		await page.fill('input[name="accountId"]', ADMIN.accountId);
		await page.fill('input[name="password"]', ADMIN.password);
		await page.locator('button[type="submit"]').click();
		await page.waitForTimeout(3000);
		await page.waitForLoadState('load');
		console.log('[SETUP] After login URL:', page.url());
	}

	if (page.url().includes('/auth/login')) {
		const text = await page.locator('body').innerText();
		console.error(`[SETUP] FAILED.`, text.substring(0, 300));
		await browser.close();
		throw new Error('Could not authenticate testadmin.');
	}

	// Save storage state
	const authCookies = await context.cookies();
	console.log(
		'[SETUP] Cookies:',
		authCookies.map((c) => `${c.name}=${c.value.substring(0, 20)}...`).join(', ')
	);
	await context.storageState({ path: 'e2e/.auth/user.json' });
	console.log('[SETUP] Storage state saved.');
	await browser.close();
}

export default globalSetup;
