import { test, expect, type Page } from '@playwright/test';

// Regression test for the "playing" status getting stuck once a tie is
// already decided (3 rubber wins) while the remaining rubbers are still
// untouched. It also verifies that those remaining rubbers can still be
// played afterward, and that the tie correctly flips back to "playing"
// while one of them is in progress.

const TS = Date.now();
const TEAM_A_NAME = `E2E-EarlyDecA-${TS}`;
const TEAM_B_NAME = `E2E-EarlyDecB-${TS}`;

type PlayerEntry = { name: string; gender: 'male' | 'female' };

function makePlayers(prefix: string): PlayerEntry[] {
	return [
		{ name: `${prefix}-F1-${TS}`, gender: 'female' },
		{ name: `${prefix}-F2-${TS}`, gender: 'female' },
		{ name: `${prefix}-F3-${TS}`, gender: 'female' },
		{ name: `${prefix}-M1-${TS}`, gender: 'male' },
		{ name: `${prefix}-M2-${TS}`, gender: 'male' },
		{ name: `${prefix}-M3-${TS}`, gender: 'male' },
		{ name: `${prefix}-M4-${TS}`, gender: 'male' },
		{ name: `${prefix}-M5-${TS}`, gender: 'male' },
		{ name: `${prefix}-M6-${TS}`, gender: 'male' },
		{ name: `${prefix}-M7-${TS}`, gender: 'male' }
	];
}

const TEAM_A_PLAYERS = makePlayers('EDA');
const TEAM_B_PLAYERS = makePlayers('EDB');

// WD1: two females, XD1: female+male, MD3/MD2/MD1: male pairs
function makeLineup(players: PlayerEntry[]): [string, string][] {
	return [
		[players[0].name, players[1].name],
		[players[2].name, players[3].name],
		[players[4].name, players[5].name],
		[players[6].name, players[7].name],
		[players[8].name, players[9].name]
	];
}

const RUBBER_LABELS = [
	'女子ダブルス',
	'ミックスダブルス',
	'男子ダブルス3',
	'男子ダブルス2',
	'男子ダブルス1'
];

let tieId = '';
let matchUrls: string[] = [];

test.describe
	.serial('tie leaves "playing" once decided, and remaining rubbers can still be played', () => {
	test.setTimeout(300_000);

	async function addPlayer(page: Page, name: string, gender: 'male' | 'female') {
		const form = page.locator('form').filter({ hasText: '氏名' });
		await expect(form).toBeVisible({ timeout: 5000 });
		const input = form.locator('input[name="name"]');
		await input.evaluate((el: HTMLInputElement, value: string) => {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value'
			)!.set!;
			setter.call(el, value);
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}, name);
		await form.locator('button[data-select-trigger]').click();
		await page.waitForTimeout(150);
		await page.getByRole('option', { name: gender === 'male' ? '男性' : '女性' }).click();
		await page.waitForTimeout(150);
		await form.getByRole('button', { name: '追加', exact: true }).click();
		await page.waitForTimeout(150);
		await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
	}

	test('creates two teams with players', async ({ page }) => {
		for (const [name, players] of [
			[TEAM_A_NAME, TEAM_A_PLAYERS],
			[TEAM_B_NAME, TEAM_B_PLAYERS]
		] as const) {
			await page.goto('/teams');
			await page.waitForTimeout(300);
			await page.getByRole('button', { name: '+ 追加' }).click();
			await page.locator('input[name="name"]').fill(name);
			await page.getByRole('button', { name: '追加', exact: true }).click();
			await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
			for (const p of players) await addPlayer(page, p.name, p.gender);
		}
	});

	test('creates a manual tie between the two teams', async ({ page }) => {
		await page.goto('/ties');
		await page.waitForTimeout(300);
		await page.getByRole('button', { name: '新規作成' }).click();
		await expect(page.getByPlaceholder('A-1')).toBeVisible();
		await page.getByPlaceholder('A-1').fill(`ED-${TS}`);

		await page
			.locator('span')
			.filter({ hasText: 'A側チーム' })
			.locator('..')
			.locator('button[data-select-trigger]')
			.click();
		await page.waitForTimeout(150);
		await page.getByRole('option', { name: TEAM_A_NAME }).click();

		await page
			.locator('span')
			.filter({ hasText: 'B側チーム' })
			.locator('..')
			.locator('button[data-select-trigger]')
			.click();
		await page.waitForTimeout(150);
		await page.getByRole('option', { name: TEAM_B_NAME }).click();

		await page.getByRole('button', { name: '作成', exact: true }).click();
		await page.waitForURL(/\/ties\/[a-zA-Z0-9-]+$/, { timeout: 5000 });
		tieId = page.url().split('/').pop()!;
	});

	async function submitLineup(page: Page, teamName: string, lineup: [string, string][]) {
		await page.goto(`/ties/${tieId}`);
		await page.waitForTimeout(300);
		const panel = page
			.locator('h2')
			.filter({ hasText: teamName })
			.first()
			.locator('..')
			.locator('..');
		await panel.getByRole('link', { name: '入力ページ' }).click();
		await page.waitForURL(/\/ties\/.+\/lineups\/.+/, { timeout: 5000 });
		await page.waitForTimeout(300);
		for (let i = 0; i < RUBBER_LABELS.length; i++) {
			const label = RUBBER_LABELS[i];
			const [p1, p2] = lineup[i];
			const section = page.locator('p').filter({ hasText: label }).first().locator('..');
			const triggers = section.locator('button[data-select-trigger]');
			await triggers.nth(0).click();
			await page.waitForTimeout(150);
			await page.getByRole('option', { name: p1 }).click();
			await page.waitForTimeout(150);
			await triggers.nth(1).click();
			await page.waitForTimeout(150);
			await page.getByRole('option', { name: p2 }).click();
			await page.waitForTimeout(150);
		}
		await page.getByRole('button', { name: '提出する' }).click();
		await page.waitForTimeout(300);
		await expect(page.getByText('オーダーを提出しました').first()).toBeVisible({ timeout: 10000 });
	}

	test('submits and approves lineups, then starts the tie', async ({ page }) => {
		await submitLineup(page, TEAM_A_NAME, makeLineup(TEAM_A_PLAYERS));
		await submitLineup(page, TEAM_B_NAME, makeLineup(TEAM_B_PLAYERS));

		await page.goto(`/ties/${tieId}`);
		await page.waitForTimeout(300);
		const approveBtns = page.getByRole('button', { name: '承認する' });
		const count = await approveBtns.count();
		for (let i = 0; i < count; i++) {
			await approveBtns.first().click();
			await page.waitForTimeout(200);
		}
		await page.waitForTimeout(200);
		await page.getByRole('button', { name: '対戦を開始' }).click();
		await page.waitForTimeout(400);
		await expect(page.getByText('スコア入力').first()).toBeVisible({ timeout: 10000 });

		const links = page.locator('a').filter({ hasText: 'スコア入力' });
		matchUrls = await links.evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).href));
		expect(matchUrls).toHaveLength(5);
	});

	// ── Scoring helpers (generic, no team-name dependency) ──────────────────

	async function startMatchViaUI(page: Page) {
		const startBtn = page.getByRole('button', { name: '開始' });
		if (!(await startBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;

		await page.locator('button[data-select-trigger]').first().click();
		await page.waitForTimeout(100);
		const ids = await page.evaluate(() => {
			const options = document.querySelectorAll('[role="option"]');
			const allValues: string[] = [];
			options.forEach((o) => {
				const v = o.getAttribute('data-value');
				if (v) allValues.push(v);
			});
			if (allValues.length < 2) return null;
			return { serverId: allValues[0], receiverId: allValues[allValues.length - 1] };
		});
		if (!ids) return;
		await page.evaluate(({ serverId, receiverId }) => {
			const si = document.querySelector(
				'input[name="initialServerPlayerId"]'
			) as HTMLInputElement | null;
			const ri = document.querySelector(
				'input[name="initialReceiverPlayerId"]'
			) as HTMLInputElement | null;
			if (si) si.value = serverId;
			if (ri) ri.value = receiverId;
			si?.form?.requestSubmit();
		}, ids);
		await page.waitForTimeout(150);
	}

	async function scoreGameViaUI(page: Page, winningSide: 'A' | 'B', maxRallies = 40) {
		const plusButtons = page.getByRole('button', { name: '+1' });
		const buttonIndex = winningSide === 'A' ? 0 : 1;
		for (let i = 0; i < maxRallies; i++) {
			const button = plusButtons.nth(buttonIndex);
			if (!(await button.isVisible({ timeout: 1000 }).catch(() => false))) return { stopped: true };
			if (!(await button.isEnabled({ timeout: 5000 }).catch(() => false))) {
				await page.reload({ timeout: 15000 });
				await page.waitForTimeout(150);
				const refreshedButton = plusButtons.nth(buttonIndex);
				if (
					!(await refreshedButton.isVisible({ timeout: 1000 }).catch(() => false)) ||
					!(await refreshedButton.isEnabled({ timeout: 1000 }).catch(() => false))
				) {
					return { stopped: true };
				}
				await refreshedButton.click();
				await page.waitForTimeout(10);
				continue;
			}
			await button.click();
			await page.waitForTimeout(10);
		}
		return { stopped: false };
	}

	async function startNextGameViaUI(page: Page) {
		const gameBtn = page.getByRole('button', { name: '開始' });
		if (!(await gameBtn.isVisible({ timeout: 2000 }).catch(() => false))) return false;
		const text = page.locator('h2').filter({ hasText: '次ゲーム' });
		if (!(await text.isVisible({ timeout: 1000 }).catch(() => false))) return false;
		const serverCtl = page
			.locator('span')
			.filter({ hasText: 'サーバー' })
			.first()
			.locator('..')
			.locator('button[data-select-trigger]');
		await serverCtl.click();
		await page.waitForTimeout(50);
		await page.getByRole('option').first().click();
		await page.waitForTimeout(50);
		const receiverCtl = page
			.locator('span')
			.filter({ hasText: 'レシーバー' })
			.first()
			.locator('..')
			.locator('button[data-select-trigger]');
		await receiverCtl.click();
		await page.waitForTimeout(50);
		await page.getByRole('option').first().click();
		await page.waitForTimeout(50);
		await gameBtn.click();
		await page.waitForTimeout(150);
		return true;
	}

	async function confirmMatch(page: Page) {
		const nameInput = page.locator('input[name="refereeName"]');
		if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
			await nameInput.fill('E2E Referee');
			const saveBtn = page.getByRole('button', { name: '保存' });
			if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
				await saveBtn.click();
				await page.waitForTimeout(100);
			}
		}
		const confirmBtn = page.getByRole('button', { name: '勝者確認' });
		if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
			await confirmBtn.click();
			await page.waitForTimeout(100);
		}
	}

	async function scoreFullMatch(page: Page, matchUrl: string, winningSide: 'A' | 'B') {
		await page.goto(matchUrl, { timeout: 15000 });
		await page.waitForTimeout(200);
		await startMatchViaUI(page);
		await scoreGameViaUI(page, winningSide);
		await page.reload({ timeout: 15000 });
		await page.waitForTimeout(150);
		if (await startNextGameViaUI(page)) {
			await scoreGameViaUI(page, winningSide);
			await page.reload({ timeout: 15000 });
			await page.waitForTimeout(150);
		}
		await confirmMatch(page);
	}

	async function tieStatusText(page: Page): Promise<string> {
		await page.goto(`/ties/${tieId}`);
		await page.waitForTimeout(250);
		const dd = page.locator('dt').filter({ hasText: '状態' }).locator('..').locator('dd');
		return (await dd.textContent())?.trim() ?? '';
	}

	async function rubberStatusText(page: Page, rubberLabelText: string): Promise<string> {
		await page.goto(`/ties/${tieId}`);
		await page.waitForTimeout(250);
		const row = page.locator('tr').filter({ hasText: rubberLabelText });
		return (await row.textContent())?.trim() ?? '';
	}

	test('team A wins the first three rubbers 3-0 and the tie leaves "playing" right away', async ({
		page
	}) => {
		for (let i = 0; i < 3; i++) {
			await scoreFullMatch(page, matchUrls[i], 'A');
		}

		const status = await tieStatusText(page);
		expect(status).toBe('結果確認待ち');
		await expect(page.getByRole('button', { name: '結果を確定' })).toBeVisible({ timeout: 5000 });

		// The remaining two rubbers are still untouched, not cancelled.
		const fourthRubber = await rubberStatusText(page, '男子ダブルス2');
		const fifthRubber = await rubberStatusText(page, '男子ダブルス1');
		expect(fourthRubber).toContain('予定');
		expect(fifthRubber).toContain('予定');
	});

	test('playing the 4th rubber flips the tie back to "playing", then back to "finished" once it ends', async ({
		page
	}) => {
		const matchUrl = matchUrls[3];
		await page.goto(matchUrl, { timeout: 15000 });
		await page.waitForTimeout(200);
		await startMatchViaUI(page);
		// A few rallies only — not enough to finish the game yet.
		await scoreGameViaUI(page, 'B', 3);

		const statusWhilePlaying = await tieStatusText(page);
		expect(statusWhilePlaying).toBe('進行中');

		// Finish the 4th rubber.
		await page.goto(matchUrl, { timeout: 15000 });
		await page.waitForTimeout(150);
		await scoreGameViaUI(page, 'B');
		await page.reload({ timeout: 15000 });
		await page.waitForTimeout(150);
		if (await startNextGameViaUI(page)) {
			await scoreGameViaUI(page, 'B');
			await page.reload({ timeout: 15000 });
			await page.waitForTimeout(150);
		}
		await confirmMatch(page);

		const statusAfter = await tieStatusText(page);
		expect(statusAfter).toBe('結果確認待ち');

		// 5th rubber was never touched.
		const fifthRubber = await rubberStatusText(page, '男子ダブルス1');
		expect(fifthRubber).toContain('予定');
	});
});
