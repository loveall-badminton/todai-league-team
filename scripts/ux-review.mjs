import { chromium } from '@playwright/test';
const BASE = 'http://localhost:4173';
const ADMIN = { accountId: 'testadmin', password: 'TestAdmin123' };
const OUT = '/tmp/ux-screenshots';

import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

async function shot(name) {
	await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
	console.log(`✓ ${name}`);
}

// Login
await page.goto(`${BASE}/auth/login`);
await page.fill('input[name="accountId"]', ADMIN.accountId);
await page.fill('input[name="password"]', ADMIN.password);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 10000 });
await shot('00-dashboard');

// Live board
await page.goto(`${BASE}/live`);
await page.waitForLoadState('networkidle');
await shot('01-live-board');

// Live tasks (team task page)
await page.goto(`${BASE}/live/tasks`);
await page.waitForLoadState('networkidle');
await shot('02-live-tasks');

// Groups page
await page.goto(`${BASE}/groups`);
await page.waitForLoadState('networkidle');
await shot('03-groups');

// Group detail
const groupLinks = await page.locator('a[href^="/groups/"]').all();
if (groupLinks.length > 0) {
	await groupLinks[0].click();
	await page.waitForLoadState('networkidle');
	await shot('04-group-detail');
}

// Finals page
await page.goto(`${BASE}/finals`);
await page.waitForLoadState('networkidle');
await shot('05-finals');

// Teams page
await page.goto(`${BASE}/teams`);
await page.waitForLoadState('networkidle');
await shot('06-teams');

// Team detail (first team)
const teamLinks = await page.locator('a[href^="/teams/"]').all();
if (teamLinks.length > 0) {
	await teamLinks[0].click();
	await page.waitForLoadState('networkidle');
	await shot('07-team-detail');
}

// Ties page
await page.goto(`${BASE}/ties`);
await page.waitForLoadState('networkidle');
await shot('08-ties');

// Tie detail (first tie with a link)
const tieLinks = await page.locator('a[href^="/ties/"]').all();
if (tieLinks.length > 0) {
	await tieLinks[0].click();
	await page.waitForLoadState('networkidle');
	await shot('09-tie-detail');
}

// Settings
await page.goto(`${BASE}/settings`);
await page.waitForLoadState('networkidle');
await shot('10-settings');

// Mobile view - key pages
const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mobilePage = await mobileCtx.newPage();
await mobilePage.goto(`${BASE}/auth/login`);
await mobilePage.fill('input[name="accountId"]', ADMIN.accountId);
await mobilePage.fill('input[name="password"]', ADMIN.password);
await mobilePage.click('button[type="submit"]');
await mobilePage.waitForURL(`${BASE}/`, { timeout: 10000 });

await mobilePage.goto(`${BASE}/live`);
await mobilePage.waitForLoadState('networkidle');
await mobilePage.screenshot({ path: `${OUT}/11-mobile-live.png`, fullPage: true });
console.log('✓ 11-mobile-live');

await mobilePage.goto(`${BASE}/live/tasks`);
await mobilePage.waitForLoadState('networkidle');
await mobilePage.screenshot({ path: `${OUT}/12-mobile-tasks.png`, fullPage: true });
console.log('✓ 12-mobile-tasks');

await mobilePage.goto(`${BASE}/ties`);
await mobilePage.waitForLoadState('networkidle');
await mobilePage.screenshot({ path: `${OUT}/13-mobile-ties.png`, fullPage: true });
console.log('✓ 13-mobile-ties');

await browser.close();
console.log('\nAll screenshots saved to', OUT);
