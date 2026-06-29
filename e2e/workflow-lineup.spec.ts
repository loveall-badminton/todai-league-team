import { test, expect, type Page } from '@playwright/test';

const TS = Date.now();
const TEAM_A = `WF-A-${TS}`;
const TEAM_B = `WF-B-${TS}`;
const TIE_CODE = `W-${TS}`;
const PLAYERS_A = [`WF-A1-${TS}`, `WF-A2-${TS}`];
const PLAYERS_B = [`WF-B1-${TS}`, `WF-B2-${TS}`];

const RUBBER_LABELS = [
	'女子ダブルス',
	'ミックスダブルス',
	'男子ダブルス3',
	'男子ダブルス2',
	'男子ダブルス1'
];

test.describe.serial('lineup full workflow', () => {
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

	async function selectPlayersForRubbers(page: Page, players: string[]) {
		for (const label of RUBBER_LABELS) {
			const section = page.locator('p').filter({ hasText: label }).first().locator('..');
			const triggers = section.locator('button[aria-haspopup="listbox"]');
			await triggers.nth(0).click();
			await page.waitForTimeout(200);
			await page.getByRole('option', { name: players[0] }).click();
			await page.waitForTimeout(200);
			await triggers.nth(1).click();
			await page.waitForTimeout(200);
			await page.getByRole('option', { name: players[1] }).click();
			await page.waitForTimeout(200);
		}
	}

	async function clickTeamLineupLink(page: Page, teamName: string) {
		const headerRow = page
			.locator('h2')
			.filter({ hasText: teamName })
			.first()
			.locator('..')
			.locator('..');
		await headerRow.getByRole('link', { name: '入力ページ' }).click();
		await page.waitForURL(/\/ties\/.+\/lineups\/.+/, { timeout: 5000 });
		await page.waitForTimeout(1000);
	}

	async function fillAndSubmitLineup(page: Page, teamName: string, players: string[]) {
		await page.goto(tieUrl);
		await page.waitForTimeout(1500);
		await clickTeamLineupLink(page, teamName);
		await selectPlayersForRubbers(page, players);
		await page.getByRole('button', { name: '提出する' }).click();
		await page.waitForTimeout(1500);
		await expect(page.getByText('オーダーを提出しました').first()).toBeVisible({ timeout: 5000 });
	}

	test('setup: create teams, players, tie', async ({ page }) => {
		await page.goto('/teams');
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_A);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		const urlA = page.url();
		for (const name of PLAYERS_A) await addPlayer(page, name, urlA);

		await page.goto('/teams');
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_B);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		const urlB = page.url();
		for (const name of PLAYERS_B) await addPlayer(page, name, urlB);

		await page.goto('/ties');
		await page.getByRole('button', { name: '新規作成' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.getByPlaceholder('A-1').fill(TIE_CODE);

		await page
			.locator('span')
			.filter({ hasText: 'A側チーム' })
			.locator('..')
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: TEAM_A }).click();
		await page
			.locator('span')
			.filter({ hasText: 'B側チーム' })
			.locator('..')
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: TEAM_B }).click();

		await page.getByRole('button', { name: '作成', exact: true }).click();
		await page.waitForTimeout(1000);
		tieUrl = page.url();
		expect(tieUrl).toMatch(/\/ties\/[a-zA-Z0-9-]+$/);
	});

	test('submit lineup for team A', async ({ page }) => {
		await fillAndSubmitLineup(page, TEAM_A, PLAYERS_A);
	});

	test('submit lineup for team B', async ({ page }) => {
		await fillAndSubmitLineup(page, TEAM_B, PLAYERS_B);
	});

	test('approve lineups, reveal, start tie', async ({ page }) => {
		await page.goto(tieUrl);
		await page.waitForTimeout(1500);

		await page.getByText('承認する').first().click();
		await page.waitForTimeout(500);
		await page.getByText('承認する').last().click();
		await page.waitForTimeout(500);

		await page.getByText('オーダー公開').click();
		await page.waitForTimeout(500);

		await page.getByText('対戦を開始').click();
		await page.waitForTimeout(1500);

		await expect(page.getByText('進行中').first()).toBeVisible({ timeout: 3000 });
	});

	test('complete a match and confirm result', async ({ page }) => {
		test.setTimeout(90_000);
		await page.goto(tieUrl);
		await page.waitForTimeout(2000);

		// Navigate to first match referee page
		await page.getByText('スコア入力').first().click();
		await page.waitForURL(/\/referee\/.+/, { timeout: 5000 });
		await page.waitForTimeout(2000);

		// Start game if needed
		const plusOne = page.getByText('+1').first();
		if (!(await plusOne.isEnabled({ timeout: 3000 }).catch(() => false))) {
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
			await page.waitForTimeout(2000);
		}

		// Score game 1
		for (let i = 0; i < 25; i++) {
			const btn = page.getByText('+1').first();
			await page.waitForTimeout(300);
			if (!(await btn.isEnabled().catch(() => false))) break;
			await btn.click();
		}

		// Start game 2 if needed
		if (
			await page
				.getByText('次ゲーム開始')
				.isVisible({ timeout: 3000 })
				.catch(() => false)
		) {
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
			await page.waitForTimeout(1000);

			for (let i = 0; i < 25; i++) {
				const btn = page.getByText('+1').first();
				await page.waitForTimeout(300);
				if (!(await btn.isEnabled().catch(() => false))) break;
				await btn.click();
			}
		}

		// Match finishes — status becomes 'finished' (admin confirms separately)
		await expect(page.getByText('試合終了')).toBeVisible({ timeout: 10000 });
		await page.getByPlaceholder('審判の名前を入力').fill('審判 太郎');
		await page.getByRole('button', { name: '保存' }).click();
		await expect(page.getByText('審判名を保存しました')).toBeVisible({ timeout: 5000 });
		await expect(page.getByPlaceholder('審判の名前を入力')).toHaveValue('審判 太郎');
		await page.getByRole('button', { name: '試合結果を確認' }).click();
		await expect(page.getByRole('button', { name: '確認を取り消す' })).toBeVisible({
			timeout: 5000
		});

		// Verify on tie page: rubber shows '結果確認待ち' until admin confirms
		await page.goto(tieUrl);
		await expect(page.getByText('審判: 審判 太郎').first()).toBeVisible({ timeout: 5000 });
		await expect(page.getByText('審判署名済 / 勝者確認済').first()).toBeVisible({ timeout: 5000 });
		await expect(page.getByRole('button', { name: '運営承認' }).first()).toBeVisible({
			timeout: 5000
		});
	});
});
