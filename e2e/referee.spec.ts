import { test, expect, type Page } from '@playwright/test';

test.describe.serial('referee scoring', () => {
	const TS = Date.now();
	const TEAM_A = `E2E-RefA-${TS}`;
	const TEAM_B = `E2E-RefB-${TS}`;
	const TIE_CODE = `R-${TS}`;
	// 10 players each: indices 2 (male) and 3 (female) are used for XD1
	const PLAYERS_A = [
		{ name: `E2E-RA1-${TS}`, gender: 'unknown' as const },
		{ name: `E2E-RA2-${TS}`, gender: 'unknown' as const },
		{ name: `E2E-RA3-${TS}`, gender: 'male' as const },
		{ name: `E2E-RA4-${TS}`, gender: 'female' as const },
		{ name: `E2E-RA5-${TS}`, gender: 'unknown' as const },
		{ name: `E2E-RA6-${TS}`, gender: 'unknown' as const },
		{ name: `E2E-RA7-${TS}`, gender: 'unknown' as const },
		{ name: `E2E-RA8-${TS}`, gender: 'unknown' as const },
		{ name: `E2E-RA9-${TS}`, gender: 'unknown' as const },
		{ name: `E2E-RA10-${TS}`, gender: 'unknown' as const }
	];
	const PLAYERS_B = [
		{ name: `E2E-RB1-${TS}`, gender: 'unknown' as const },
		{ name: `E2E-RB2-${TS}`, gender: 'unknown' as const },
		{ name: `E2E-RB3-${TS}`, gender: 'male' as const },
		{ name: `E2E-RB4-${TS}`, gender: 'female' as const },
		{ name: `E2E-RB5-${TS}`, gender: 'unknown' as const },
		{ name: `E2E-RB6-${TS}`, gender: 'unknown' as const },
		{ name: `E2E-RB7-${TS}`, gender: 'unknown' as const },
		{ name: `E2E-RB8-${TS}`, gender: 'unknown' as const },
		{ name: `E2E-RB9-${TS}`, gender: 'unknown' as const },
		{ name: `E2E-RB10-${TS}`, gender: 'unknown' as const }
	];
	let tieUrl: string;

	async function addPlayer(page: Page, name: string, teamUrl: string, gender = 'unknown') {
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
		if (gender !== 'unknown') {
			await playerForm.locator('button[data-select-trigger]').click();
			await page.waitForTimeout(200);
			await page.getByRole('option', { name: gender === 'male' ? '男性' : '女性' }).click();
			await page.waitForTimeout(200);
		}
		await playerForm.evaluate((f: HTMLFormElement) => f.requestSubmit());
		await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
	}

	async function openTeamCreateForm(page: Page) {
		const input = page.locator('input[name="name"]').first();
		await page.getByRole('button', { name: '+ 追加' }).click();
		if (!(await input.isVisible().catch(() => false))) {
			await page.getByRole('button', { name: '+ 追加' }).click();
		}
		await expect(input).toBeVisible();
		return input;
	}

	async function selectBitsUiTrigger(page: Page, sectionLabel: string) {
		const section = page.locator('span').filter({ hasText: sectionLabel }).locator('..');
		await section.locator('button[data-select-trigger]').click();
		await page.waitForTimeout(200);
	}

	async function openTieCreateDialog(page: Page) {
		const input = page.getByPlaceholder('A-1');
		await page.getByRole('button', { name: '新規作成' }).click();
		if (!(await input.isVisible().catch(() => false))) {
			await page.getByRole('button', { name: '新規作成' }).click();
		}
		await expect(input).toBeVisible();
		return input;
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
		const triggers = rubberSection.locator('button[data-select-trigger]');
		await triggers.nth(slotIndex).click();
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: playerName }).click();
	}

	test('creates two teams with players', async ({ page }) => {
		await page.goto('/teams');
		await page.waitForTimeout(500);
		const teamAInput = await openTeamCreateForm(page);
		await teamAInput.fill(TEAM_A);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		const teamAUrl = page.url();

		for (const p of PLAYERS_A) {
			await addPlayer(page, p.name, teamAUrl, p.gender);
		}

		await page.goto('/teams');
		await page.waitForTimeout(500);
		const teamBInput = await openTeamCreateForm(page);
		await teamBInput.fill(TEAM_B);
		await page.getByRole('button', { name: '追加', exact: true }).click();
		await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
		const teamBUrl = page.url();

		for (const p of PLAYERS_B) {
			await addPlayer(page, p.name, teamBUrl, p.gender);
		}
	});

	test('creates a tie with teams assigned', async ({ page }) => {
		await page.goto('/ties');
		await page.waitForTimeout(500);
		const tieCodeInput = await openTieCreateDialog(page);

		await tieCodeInput.fill(TIE_CODE);

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

		// Each rubber gets unique players; XD1 slot 0 = female (idx 3), slot 1 = male (idx 2)
		const lineupA: [string, number, number][] = [
			['WD1', 0, 1],
			['XD1', 3, 2],
			['MD3', 4, 5],
			['MD2', 6, 7],
			['MD1', 8, 9]
		];
		for (const [code, i1, i2] of lineupA) {
			await selectLineupPlayer(page, code, 0, PLAYERS_A[i1].name);
			await selectLineupPlayer(page, code, 1, PLAYERS_A[i2].name);
		}

		await page.getByRole('button', { name: '提出する' }).click();
		await page.waitForTimeout(1000);
	});

	test('submits lineup for team B', async ({ page }) => {
		await page.goto(tieUrl);

		const lineupLinks = page.getByRole('link', { name: '入力ページ' });
		await lineupLinks.nth(1).click();
		await page.waitForTimeout(500);

		const lineupB: [string, number, number][] = [
			['WD1', 0, 1],
			['XD1', 3, 2],
			['MD3', 4, 5],
			['MD2', 6, 7],
			['MD1', 8, 9]
		];
		for (const [code, i1, i2] of lineupB) {
			await selectLineupPlayer(page, code, 0, PLAYERS_B[i1].name);
			await selectLineupPlayer(page, code, 1, PLAYERS_B[i2].name);
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
			.locator('button[data-select-trigger]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option').first().click();

		// Click 1st レシーバー -> 選択 button and select first player
		await page
			.locator('span')
			.filter({ hasText: '1st レシーバー' })
			.locator('..')
			.locator('button[data-select-trigger]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option').first().click();

		await page.getByRole('button', { name: '開始' }).click();
		await page.waitForTimeout(1000);

		await expect(page.getByText('+1').first()).toBeVisible({ timeout: 5000 });
	});

	test('records a rally and undoes it', async ({ page }) => {
		test.setTimeout(60_000);
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
				.locator('button[data-select-trigger]')
				.click();
			await page.waitForTimeout(200);
			await page.getByRole('option').first().click();

			await page
				.locator('span')
				.filter({ hasText: '1st レシーバー' })
				.locator('..')
				.locator('button[data-select-trigger]')
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
			.locator('button[data-select-trigger]')
			.click();
		await page.waitForTimeout(200);
		await page.getByRole('option').first().click();

		await page
			.locator('span')
			.filter({ hasText: '1st レシーバー' })
			.locator('..')
			.locator('button[data-select-trigger]')
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
			page.getByText(PLAYERS_A[0].name).or(page.getByText(PLAYERS_B[0].name)).first()
		).toBeVisible();
	});
});
