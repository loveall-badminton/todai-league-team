import { chromium, type FullConfig } from '@playwright/test';

const ADMIN = { accountId: 'testadmin', password: 'TestAdmin123', name: 'Test Admin' };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function globalSetup(_config: FullConfig) {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
	const page = await context.newPage();

	page.on('pageerror', (err) => console.error(`[PAGE ERROR] ${err.message}`));
	page.on('console', (msg) => {
		if (msg.type() === 'error') console.error(`[PAGE console.error] ${msg.text()}`);
	});

	// ── 2. Navigate to bootstrap page and submit via enhanced form ──
	await page.goto('/auth/bootstrap', { waitUntil: 'networkidle' });
	console.log('[SETUP] Bootstrap page load URL:', page.url());

	const form = page.locator('form');
	if (!(await form.isVisible({ timeout: 5000 }).catch(() => false))) {
		const text = await page.locator('body').innerText();
		console.error(`[SETUP] FAILED — no bootstrap form.`, text.substring(0, 300));
		await browser.close();
		throw new Error('Bootstrap form not visible on fresh DB.');
	}

	// Fill form and click submit (uses enhanced form action)
	await page.fill('input[name="accountId"]', ADMIN.accountId);
	await page.fill('input[name="name"]', ADMIN.name);
	await page.fill('input[name="password"]', ADMIN.password);

	await page.locator('button[type="submit"]').click();

	// Wait for navigation — the enhanced form handles the redirect
	await page.waitForTimeout(3000);
	await page.waitForLoadState('networkidle');

	console.log('[SETUP] After submit URL:', page.url());

	if (page.url().includes('/auth/login')) {
		console.log('[SETUP] On login page — signing in…');
		await page.waitForSelector('input[name="accountId"]', { timeout: 5000 });
		await page.fill('input[name="accountId"]', ADMIN.accountId);
		await page.fill('input[name="password"]', ADMIN.password);
		await page.locator('button[type="submit"]').click();
		await page.waitForTimeout(3000);
		await page.waitForLoadState('networkidle');
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
