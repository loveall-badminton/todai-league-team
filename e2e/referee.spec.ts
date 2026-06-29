import { test, expect, type Page } from '@playwright/test';

test.describe.serial('referee scoring', () => {
	const TEAM_A = `E2E-RefA-${Date.now()}`;
	const TEAM_B = `E2E-RefB-${Date.now()}`;
	const TIE_CODE = `R-${Date.now()}`;
	const PLAYERS_A = [`E2E-RA1-${Date.now()}`, `E2E-RA2-${Date.now()}`, `E2E-RA3-${Date.now()}`];
	const PLAYERS_B = [`E2E-RB1-${Date.now()}`, `E2E-RB2-${Date.now()}`, `E2E-RB3-${Date.now()}`];
	let tieUrl: string;

	async function addPlayer(page: Page, name: string, teamUrl: string) {
		await page.goto(teamUrl);
		const playerForm = page.locator('form').filter({ hasText: '氏名' });
		const input = playerForm.locator('input[name="name"]');
		await input.evaluate((el: HTMLInputElement, value: string) => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, value);
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}, name);
		await playerForm.evaluate((f: HTMLFormElement) => f.requestSubmit());
		await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
	}

	async function selectBitsUiTrigger(page: Page, sectionLabel: string) {
		const section = page.locator('span').filter({ hasText: sectionLabel }).locator('..');
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

	test('creates two teams with players', async ({ page }) => {
		await page.goto('/teams');
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_A);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		const teamAUrl = page.url();

		for (const name of PLAYERS_A) {
			await addPlayer(page, name, teamAUrl);
		}

		await page.goto('/teams');
		await page.getByRole('button', { name: '+ 追加' }).click();
		await page.locator('input[name="name"]').fill(TEAM_B);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		const teamBUrl = page.url();

		for (const name of PLAYERS_B) {
			await addPlayer(page, name, teamBUrl);
		}
	});

	test('creates a tie with teams assigned', async ({ page }) => {
		await page.goto('/ties');
		await page.getByRole('button', { name: '新規作成' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();

		await page.getByPlaceholder('A-1').fill(TIE_CODE);

		// Select team A
		await selectBitsUiTrigger(page, 'A側チーム');
		await page.getByRole('option', { name: TEAM_A }).click();

		// Select team B
		await selectBitsUiTrigger(page, 'B側チーム');
		await page.getByRole('option', { name: TEAM_B }).click();

		await page.getByRole('button', { name: '作成', exact: true }).click();
		await page.waitForTimeout(1000);
		tieUrl = page.url();
		expect(tieUrl).toMatch(/\/ties\/[a-zA-Z0-9-]+$/);
		await expect(page.locator('h1')).toContainText(TIE_CODE);
	});

	test('submits lineup for team A', async ({ page }) => {
		await page.goto(tieUrl);

		const lineupLink = page.getByRole('link', { name: '入力ページ' }).first();
		await lineupLink.click();
		await page.waitForTimeout(500);

		const rubberCodes: [string, 0 | 1, 0 | 1][] = [
			['WD1', 0, 1],
			['XD1', 0, 1],
			['MD3', 0, 1],
			['MD2', 0, 1],
			['MD1', 0, 1]
		];
		for (const [code, slot1, slot2] of rubberCodes) {
			await selectLineupPlayer(page, code, slot1, PLAYERS_A[0]);
			await selectLineupPlayer(page, code, slot2, PLAYERS_A[1]);
		}

		await page.getByRole('button', { name: '提出する' }).click();
		await page.waitForTimeout(1000);
	});

	test('submits lineup for team B', async ({ page }) => {
		await page.goto(tieUrl);

		const lineupLinks = page.getByRole('link', { name: '入力ページ' });
		await lineupLinks.nth(1).click();
		await page.waitForTimeout(500);

		const rubberCodes: [string, 0 | 1, 0 | 1][] = [
			['WD1', 0, 1],
			['XD1', 0, 1],
			['MD3', 0, 1],
			['MD2', 0, 1],
			['MD1', 0, 1]
		];
		for (const [code, slot1, slot2] of rubberCodes) {
			await selectLineupPlayer(page, code, slot1, PLAYERS_B[0]);
			await selectLineupPlayer(page, code, slot2, PLAYERS_B[1]);
		}

		await page.getByRole('button', { name: '提出する' }).click();
		await page.waitForTimeout(1000);
	});

	test('starts the tie', async ({ page }) => {
		await page.goto(tieUrl);
		await page.waitForTimeout(500);

		// Approve lineup A
		const approveBtns = page.getByRole('button', { name: '承認する' });
		const approveCount = await approveBtns.count();
		for (let i = 0; i < approveCount; i++) {
			await approveBtns.first().click();
			await page.waitForTimeout(500);
		}

		// Start the tie
		const startBtn = page.getByRole('button', { name: '対戦を開始' });
		if (await startBtn.isVisible()) {
			await startBtn.click();
			await page.waitForTimeout(1000);
		}

		await expect(page.getByText('スコア入力').first()).toBeVisible({ timeout: 10000 });
	});

	test('scores a match in referee view', async ({ page }) => {
		await page.goto(tieUrl);
		await page.waitForTimeout(500);

		const scoreLink = page.getByRole('link', { name: 'スコア入力' }).first();
		await scoreLink.click();
		await page.waitForTimeout(500);

		await expect(page).toHaveURL(/\/referee\/[a-zA-Z0-9-]+/);
		await expect(page.getByText('試合開始')).toBeVisible({ timeout: 5000 });

		// Click 1st サーバー -> 選択 button and select first player
		await page
			.locator('span')
			.filter({ hasText: '1st サーバー' })
			.locator('..')
			.locator('button[aria-haspopup="listbox"]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option').first().click();

		// Click 1st レシーバー -> 選択 button and select first player
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

		await expect(page.getByText('+1').first()).toBeVisible({ timeout: 5000 });
	});

	test('records a rally and undoes it', async ({ page }) => {
		await page.goto(tieUrl);
		await page.getByRole('link', { name: 'スコア入力' }).first().click();
		await page.waitForTimeout(1500);

		// Wait for hydration to complete — check for the scoring view (+1 buttons)
		const plusOneBtn = page.getByText('+1').first();
		if (!(await plusOneBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
			// Game not started yet — select server/receiver and start
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
		}

		await expect(plusOneBtn).toBeVisible({ timeout: 5000 });

		// Score one rally and verify undo button label updates
		await plusOneBtn.click();
		await page.waitForTimeout(1000);
		await expect(page.getByText('取り消し').first()).toBeVisible();
		// Undo label should include the score (e.g., "チーム名 得点 (1–0)")
		const undoBtn = page.locator('button').filter({ hasText: /得点/ });
		await expect(undoBtn.first()).toBeVisible({ timeout: 5000 });

		// Click undo — button label should revert to "—" after undo
		await undoBtn.first().click();
		await page.waitForTimeout(1000);
		await expect(page.getByText('—').first()).toBeVisible({ timeout: 5000 });
	});

	test('completes a match (2 games) and confirms result', async ({ page }) => {
		test.setTimeout(90_000);
		// Navigate to the referee page — game 1 is already in progress
		await page.goto(tieUrl);
		await page.getByRole('link', { name: 'スコア入力' }).first().click();
		await page.waitForTimeout(1500);

		// Game 1: score until 21 (from current score ~1-0), total ~20 more clicks
		for (let i = 0; i < 25; i++) {
			const btn = page.getByText('+1').first();
			// Wait for any in-flight action to complete before checking enabled state
			await page.waitForTimeout(300);
			if (!(await btn.isEnabled().catch(() => false))) break;
			await btn.click();
		}

		// Game 1 should be over — look for "次ゲーム開始" heading
		await expect(page.getByText('次ゲーム開始')).toBeVisible({ timeout: 5000 });

		// Start game 2: select server/receiver
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

		// Game 2: score 21 points for Team A
		for (let i = 0; i < 25; i++) {
			const btn = page.getByText('+1').first();
			// Wait for any in-flight action to complete before checking enabled state
			await page.waitForTimeout(300);
			if (!(await btn.isEnabled().catch(() => false))) break;
			await btn.click();
		}

		// Match finishes — status becomes 'finished' (admin confirms separately)
		await expect(page.getByText('試合終了')).toBeVisible({ timeout: 10000 });
		await expect(page.getByRole('button', { name: '試合結果を確認' })).toBeDisabled();
		await page.getByPlaceholder('審判の名前を入力').fill('審判 花子');
		await page.getByRole('button', { name: '保存' }).click();
		await expect(page.getByPlaceholder('審判の名前を入力')).toHaveValue('審判 花子');
		await expect(page.getByRole('button', { name: '試合結果を確認' })).toBeEnabled();
		await page.getByRole('button', { name: '試合結果を確認' }).click();
		await expect(page.getByRole('button', { name: '確認を取り消す' })).toBeVisible({
			timeout: 5000
		});
		await page.getByRole('button', { name: '確認を取り消す' }).click();
		await expect(page.getByRole('button', { name: '試合結果を確認' })).toBeVisible({
			timeout: 5000
		});

		// Navigate to tie page and verify rubber shows the completed score
		await page.goto(tieUrl);
		await expect(page.getByText(TIE_CODE).first()).toBeVisible();
		// The first rubber should show the winning team's player name
		await expect(
			page.getByText(PLAYERS_A[0]).or(page.getByText(PLAYERS_B[0])).first()
		).toBeVisible();
	});
});
