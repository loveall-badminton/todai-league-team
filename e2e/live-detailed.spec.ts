import { test, expect, type Page } from '@playwright/test';

const TS = Date.now();
const TEAM_A = `Live-A-${TS}`;
const TEAM_B = `Live-B-${TS}`;
const TIE_CODE = `L-${TS}`;
const PLAYERS_A = [`Live-A1-${TS}`, `Live-A2-${TS}`];
const PLAYERS_B = [`Live-B1-${TS}`, `Live-B2-${TS}`];

test.describe.serial('live page with real data', () => {
	let tieUrl: string;

	async function addPlayer(page: Page, name: string, teamUrl: string) {
		await page.goto(teamUrl);
		const form = page.locator('form').filter({ hasText: '氏名' });
		const input = form.locator('input[name="name"]');
		await input.evaluate((el: HTMLInputElement, value: string) => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, value);
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}, name);
		await form.evaluate((f: HTMLFormElement) => f.requestSubmit());
		await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
	}

	async function selectBitsUiTrigger(page: Page, labelText: string) {
		const section = page.locator('span').filter({ hasText: labelText }).locator('..');
		await section.locator('button[aria-haspopup="listbox"]').click();
		await page.waitForTimeout(200);
	}

	async function selectLineupPlayer(
		page: Page,
		rubberCode: string,
		slotIndex: 0 | 1,
		playerName: string
	) {
		const rubberSection = page
			.locator(`input[name$=".rubberCode"][value="${rubberCode}"]`)
			.locator('..');
		const triggers = rubberSection.locator('button[aria-haspopup="listbox"]');
		await triggers.nth(slotIndex).click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: playerName }).click();
	}

	test('setup: create teams, players, tie, and start match', async ({ page }) => {
		test.setTimeout(120_000);

		// Create team A
		await page.goto('/teams');
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_A);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		const teamAUrl = page.url();
		for (const name of PLAYERS_A) await addPlayer(page, name, teamAUrl);

		// Create team B
		await page.goto('/teams');
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_B);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		const teamBUrl = page.url();
		for (const name of PLAYERS_B) await addPlayer(page, name, teamBUrl);

		// Create tie
		await page.goto('/ties');
		await page.getByRole('button', { name: '新規作成' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.getByPlaceholder('A-1').fill(TIE_CODE);
		await selectBitsUiTrigger(page, 'A側チーム');
		await page.getByRole('option', { name: TEAM_A }).click();
		await selectBitsUiTrigger(page, 'B側チーム');
		await page.getByRole('option', { name: TEAM_B }).click();
		await page.getByRole('button', { name: '作成', exact: true }).click();
		await page.waitForTimeout(1000);
		tieUrl = page.url();
		expect(tieUrl).toMatch(/\/ties\/[a-zA-Z0-9-]+$/);

		// Submit lineup for team A
		await page.goto(tieUrl);
		await page.getByRole('link', { name: '入力ページ' }).first().click();
		await page.waitForTimeout(500);
		const codes = [
			['WD1', 0, 1],
			['XD1', 0, 1],
			['MD3', 0, 1],
			['MD2', 0, 1],
			['MD1', 0, 1]
		] as const;
		for (const [code, s1, s2] of codes) {
			await selectLineupPlayer(page, code, s1, PLAYERS_A[0]);
			await selectLineupPlayer(page, code, s2, PLAYERS_A[1]);
		}
		await page.getByRole('button', { name: '提出する' }).click();
		await page.waitForTimeout(1000);

		// Submit lineup for team B
		await page.goto(tieUrl);
		await page.getByRole('link', { name: '入力ページ' }).last().click();
		await page.waitForTimeout(500);
		for (const [code, s1, s2] of codes) {
			await selectLineupPlayer(page, code, s1, PLAYERS_B[0]);
			await selectLineupPlayer(page, code, s2, PLAYERS_B[1]);
		}
		await page.getByRole('button', { name: '提出する' }).click();
		await page.waitForTimeout(1000);

		// Approve lineups
		await page.goto(tieUrl);
		await page.waitForTimeout(500);
		const approveBtns = page.getByRole('button', { name: '承認する' });
		const count = await approveBtns.count();
		for (let i = 0; i < count; i++) {
			await approveBtns.first().click();
			await page.waitForTimeout(500);
		}

		// Start tie
		await page.getByRole('button', { name: '対戦を開始' }).click();
		await page.waitForTimeout(1000);
		await expect(page.getByText('スコア入力').first()).toBeVisible({ timeout: 5000 });

		// Start first match on referee page
		await page.getByRole('link', { name: 'スコア入力' }).first().click();
		await page.waitForURL(/\/referee\/.+/, { timeout: 5000 });
		await page.waitForTimeout(1000);
		await page
			.locator('span')
			.filter({ hasText: '1st サーバー' })
			.locator('..')
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option').first().click();
		await page
			.locator('span')
			.filter({ hasText: '1st レシーバー' })
			.locator('..')
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option').first().click();
		await page.getByRole('button', { name: '開始' }).click();
		await page.waitForTimeout(1500);
		await expect(page.getByText('+1').first()).toBeVisible({ timeout: 3000 });

		// Score a few points so match is clearly "playing"
		for (let i = 0; i < 5; i++) {
			const btn = page.getByText('+1').first();
			if (!(await btn.isEnabled().catch(() => false))) break;
			await btn.click();
			await page.waitForTimeout(150);
		}
	});

	test('live page loads without console errors with real data', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') errors.push(msg.text());
		});

		await page.goto('/live');
		await page.waitForTimeout(3000);

		// Header is always visible
		await expect(page.getByText('ライブ表示')).toBeVisible({ timeout: 10000 });

		expect(errors).toHaveLength(0);
	});
});
