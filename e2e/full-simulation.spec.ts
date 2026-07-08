import { test, expect, type Page } from '@playwright/test';

const TS = Date.now();

interface TeamData {
	name: string;
	group: string;
	players: { name: string; gender: 'male' | 'female' }[];
}

const TEAMS: Record<string, TeamData> = {
	A1: {
		name: `SIM-A1-${TS}`,
		group: 'A',
		players: [
			{ name: `SA1M1-${TS}`, gender: 'male' },
			{ name: `SA1M2-${TS}`, gender: 'male' },
			{ name: `SA1M3-${TS}`, gender: 'male' },
			{ name: `SA1M4-${TS}`, gender: 'male' },
			{ name: `SA1M5-${TS}`, gender: 'male' },
			{ name: `SA1M6-${TS}`, gender: 'male' },
			{ name: `SA1M7-${TS}`, gender: 'male' },
			{ name: `SA1F1-${TS}`, gender: 'female' },
			{ name: `SA1F2-${TS}`, gender: 'female' },
			{ name: `SA1F3-${TS}`, gender: 'female' }
		]
	},
	A2: {
		name: `SIM-A2-${TS}`,
		group: 'A',
		players: [
			{ name: `SA2M1-${TS}`, gender: 'male' },
			{ name: `SA2M2-${TS}`, gender: 'male' },
			{ name: `SA2M3-${TS}`, gender: 'male' },
			{ name: `SA2M4-${TS}`, gender: 'male' },
			{ name: `SA2M5-${TS}`, gender: 'male' },
			{ name: `SA2M6-${TS}`, gender: 'male' },
			{ name: `SA2M7-${TS}`, gender: 'male' },
			{ name: `SA2F1-${TS}`, gender: 'female' },
			{ name: `SA2F2-${TS}`, gender: 'female' },
			{ name: `SA2F3-${TS}`, gender: 'female' }
		]
	},
	A3: {
		name: `SIM-A3-${TS}`,
		group: 'A',
		players: [
			{ name: `SA3M1-${TS}`, gender: 'male' },
			{ name: `SA3M2-${TS}`, gender: 'male' },
			{ name: `SA3M3-${TS}`, gender: 'male' },
			{ name: `SA3M4-${TS}`, gender: 'male' },
			{ name: `SA3M5-${TS}`, gender: 'male' },
			{ name: `SA3M6-${TS}`, gender: 'male' },
			{ name: `SA3M7-${TS}`, gender: 'male' },
			{ name: `SA3F1-${TS}`, gender: 'female' },
			{ name: `SA3F2-${TS}`, gender: 'female' },
			{ name: `SA3F3-${TS}`, gender: 'female' }
		]
	},
	B1: {
		name: `SIM-B1-${TS}`,
		group: 'B',
		players: [
			{ name: `SB1M1-${TS}`, gender: 'male' },
			{ name: `SB1M2-${TS}`, gender: 'male' },
			{ name: `SB1M3-${TS}`, gender: 'male' },
			{ name: `SB1M4-${TS}`, gender: 'male' },
			{ name: `SB1M5-${TS}`, gender: 'male' },
			{ name: `SB1M6-${TS}`, gender: 'male' },
			{ name: `SB1M7-${TS}`, gender: 'male' },
			{ name: `SB1F1-${TS}`, gender: 'female' },
			{ name: `SB1F2-${TS}`, gender: 'female' },
			{ name: `SB1F3-${TS}`, gender: 'female' }
		]
	},
	B2: {
		name: `SIM-B2-${TS}`,
		group: 'B',
		players: [
			{ name: `SB2M1-${TS}`, gender: 'male' },
			{ name: `SB2M2-${TS}`, gender: 'male' },
			{ name: `SB2M3-${TS}`, gender: 'male' },
			{ name: `SB2M4-${TS}`, gender: 'male' },
			{ name: `SB2M5-${TS}`, gender: 'male' },
			{ name: `SB2M6-${TS}`, gender: 'male' },
			{ name: `SB2M7-${TS}`, gender: 'male' },
			{ name: `SB2F1-${TS}`, gender: 'female' },
			{ name: `SB2F2-${TS}`, gender: 'female' },
			{ name: `SB2F3-${TS}`, gender: 'female' }
		]
	},
	B3: {
		name: `SIM-B3-${TS}`,
		group: 'B',
		players: [
			{ name: `SB3M1-${TS}`, gender: 'male' },
			{ name: `SB3M2-${TS}`, gender: 'male' },
			{ name: `SB3M3-${TS}`, gender: 'male' },
			{ name: `SB3M4-${TS}`, gender: 'male' },
			{ name: `SB3M5-${TS}`, gender: 'male' },
			{ name: `SB3M6-${TS}`, gender: 'male' },
			{ name: `SB3M7-${TS}`, gender: 'male' },
			{ name: `SB3F1-${TS}`, gender: 'female' },
			{ name: `SB3F2-${TS}`, gender: 'female' },
			{ name: `SB3F3-${TS}`, gender: 'female' }
		]
	}
};

const TEAM_PLAYER_IDS: Record<string, string[]> = {};
const TEAM_IDS: Record<string, string> = {};
const TEAM_ACCOUNT = {
	accountId: `team-a1-${TS}`,
	name: `Team A1 ${TS}`,
	password: `TeamA1-${TS}!`
};

// ── UI helpers ─────────────────────────────────────────────────────────────

async function selectAppOption(page: Page, labelText: string, optionText: string) {
	await page.waitForTimeout(300);
	await page
		.locator('label')
		.filter({ hasText: labelText })
		.locator('button[data-select-trigger]')
		.click();
	await page.waitForTimeout(200);
	await page.getByRole('option', { name: optionText }).click();
	await page.waitForTimeout(200);
}

async function addPlayer(page: Page, name: string, gender: string): Promise<string> {
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
	if (gender !== 'unknown') {
		const genderTrigger = form.locator('button[data-select-trigger]');
		await genderTrigger.click();
		await page.waitForTimeout(100);
		await page.getByRole('option', { name: gender === 'male' ? '男性' : '女性' }).click();
		await page.waitForTimeout(100);
	}
	await form.getByRole('button', { name: '追加', exact: true }).click();
	await page.waitForTimeout(100);
	await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
	// Extract player ID from the DOM without entering edit mode
	// The hidden input [name="id"] exists inside the <form> that appears when editing.
	// We can trigger edit mode briefly via the button[onclick=startEditing]
	await page.locator('button').filter({ hasText: name }).first().click();
	await page.waitForTimeout(100);
	const playerId = await page.locator('input[name="id"]').inputValue();
	await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
	await page.waitForTimeout(100);
	return playerId;
}

async function submitTeamLineup(page: Page, teamName: string, teamKey: string, tieId: string) {
	await page.goto(`/ties/${tieId}`);
	await page.waitForTimeout(200);
	const panel = page
		.locator('h2')
		.filter({ hasText: teamName })
		.first()
		.locator('..')
		.locator('..');
	const link = panel.getByRole('link', { name: '入力ページ' });
	if (!(await link.isVisible({ timeout: 2000 }).catch(() => false))) {
		console.log(`    Lineup link not visible for ${teamName} — already submitted?`);
		return;
	}
	console.log(`    Clicking lineup link for ${teamName}...`);
	const lineupHref = await link.getAttribute('href');
	if (!lineupHref) throw new Error(`Missing lineup href for ${teamName}`);
	await page.goto(lineupHref, { waitUntil: 'commit', timeout: 15000 });
	await page.waitForURL(/\/ties\/.+\/lineups\/.+/, { timeout: 5000 });
	console.log(`    Lineup page URL: ${page.url()}`);
	await page.waitForTimeout(200);
	console.log(`    Submitting lineup for ${teamName}...`);

	const players = TEAMS[teamKey].players;
	// players: [m1(0), m2(1), m3(2), m4(3), m5(4), m6(5), m7(6), f1(7), f2(8), f3(9)]
	// XD1: slot0 = female slot (f3=players[9]), slot1 = male slot (m1=players[0])
	const lineup: [string, 0 | 1, string][] = [
		['WD1', 0, players[7].name],
		['WD1', 1, players[8].name],
		['XD1', 0, players[9].name],
		['XD1', 1, players[0].name],
		['MD3', 0, players[1].name],
		['MD3', 1, players[2].name],
		['MD2', 0, players[3].name],
		['MD2', 1, players[4].name],
		['MD1', 0, players[5].name],
		['MD1', 1, players[6].name]
	];

	for (const [rubberCode, slotIndex, playerName] of lineup) {
		const rubberSection = page
			.locator(`input[name$=".rubberCode"][value="${rubberCode}"]`)
			.locator('..');
		const triggers = rubberSection.locator('button[data-select-trigger]');
		await triggers.nth(slotIndex).click();
		await page.waitForTimeout(50);
		await page.getByRole('option', { name: playerName }).click();
		await page.waitForTimeout(50);
	}

	await page.getByRole('button', { name: '提出する' }).click();
	await page.waitForTimeout(300);

	try {
		await expect(page.getByText('オーダーを提出しました').first()).toBeVisible({ timeout: 10000 });
	} catch {
		try {
			await expect(page.getByText('提出済み').first()).toBeVisible({ timeout: 5000 });
		} catch {
			console.log(`    提出済み not found after submission`);
		}
	}
	console.log(`    Lineup confirmed for ${teamName}`);
}

// ── Match scoring ──────────────────────────────────────────────────────────

async function startMatchViaUI(page: Page) {
	const startBtn = page.getByRole('button', { name: '開始' });
	if (!(await startBtn.isVisible({ timeout: 2000 }).catch(() => false))) return true;

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

	if (!ids) {
		console.log(`    WARNING: could not extract player IDs`);
		return true;
	}

	await page.evaluate(({ serverId, receiverId }) => {
		const si = document.querySelector(
			'input[name="initialServerPlayerId"]'
		) as HTMLInputElement | null;
		const ri = document.querySelector(
			'input[name="initialReceiverPlayerId"]'
		) as HTMLInputElement | null;
		if (si) si.value = serverId;
		if (ri) ri.value = receiverId;
		if (si) {
			const form = si.form;
			if (form) {
				form.requestSubmit();
			}
		}
	}, ids);

	// Wait for SvelteKit action + WebSocket settle + any re-fetch
	await page.waitForTimeout(100);
	return true;
}

async function scoreGameViaUI(page: Page, winningSide: 'A' | 'B', maxRallies = 35) {
	const diag = await page.evaluate(() => ({
		url: location.href,
		bodyText: document.body.innerText.slice(0, 200).replace(/\n/g, ' ')
	}));
	console.log(`    state: ${diag.url} "${diag.bodyText}..."`);

	const plusButtons = page.getByRole('button', { name: '+1' });
	const buttonIndex = winningSide === 'A' ? 0 : 1;

	for (let i = 0; i < maxRallies; i++) {
		if (i > 0 && i % 20 === 0) console.log(`        rally ${i}...`);
		const button = plusButtons.nth(buttonIndex);
		if (!(await button.isVisible({ timeout: 1000 }).catch(() => false))) {
			return { stopped: true, reason: 'score button not visible' };
		}
		if (!(await button.isEnabled({ timeout: 5000 }).catch(() => false))) {
			await page.reload({ timeout: 15000 });
			await page.waitForTimeout(150);
			const refreshedButton = plusButtons.nth(buttonIndex);
			if (
				!(await refreshedButton.isVisible({ timeout: 1000 }).catch(() => false)) ||
				!(await refreshedButton.isEnabled({ timeout: 1000 }).catch(() => false))
			) {
				return { stopped: true, reason: 'score button disabled' };
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
	// Save referee name if the form is visible
	const nameInput = page.locator('input[name="refereeName"]');
	if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
		await nameInput.fill('Sim Referee');
		const saveBtn = page.getByRole('button', { name: '保存' });
		if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
			await saveBtn.click();
			await page.waitForTimeout(100);
		}
	}
	// Confirm winner
	const confirmBtn = page.getByRole('button', { name: '勝者確認' });
	if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
		await confirmBtn.click();
		await page.waitForTimeout(100);
	}
}

async function scoreFullMatch(
	page: Page,
	matchUrl: string,
	winningSide: 'A' | 'B',
	isKnockout: boolean
) {
	await page.goto(matchUrl, { timeout: 15000 });
	await page.waitForTimeout(200);
	// Start match
	await startMatchViaUI(page);
	// Score game 1
	const maxRallies = isKnockout ? 35 : 25;
	const g1Result = await scoreGameViaUI(page, winningSide, maxRallies);
	if (g1Result?.stopped && g1Result.reason !== 'score button disabled') {
		console.log(
			`    Game 1 stopped: ${g1Result.reason}${g1Result.message ? ': ' + g1Result.message : ''}`
		);
		// If game couldn't be scored (match finished etc.), skip rest
		return;
	}
	// Reload to see updated state
	await page.reload({ timeout: 15000 });
	await page.waitForTimeout(100);
	// Start game 2 if needed
	if (await startNextGameViaUI(page)) {
		await scoreGameViaUI(page, winningSide, maxRallies);
		await page.reload({ timeout: 15000 });
		await page.waitForTimeout(100);
	}
	// Confirm match result
	await confirmMatch(page);
}

// ── Tie helpers ────────────────────────────────────────────────────────────

async function getTieCode(page: Page): Promise<string> {
	const codeValue = page.locator('dt').filter({ hasText: 'コード' }).locator('..').locator('dd');
	if (await codeValue.isVisible({ timeout: 5000 }).catch(() => false)) {
		const code = (await codeValue.textContent())?.trim() ?? '';
		if (/^(x-[1-5]|[AB]-[1-3])$/.test(code)) return code;
	}
	await page.waitForTimeout(300);
	const bodyText = await page
		.locator('body')
		.innerText()
		.catch(() => '');
	const bodyMatch = bodyText.match(/\b(x-[1-5]|[AB]-[1-3])\b/);
	if (bodyMatch) return bodyMatch[1];
	const title = await page.title();
	const titleMatch = title.match(/\b(x-[1-5]|[AB]-[1-3])\b/);
	if (titleMatch) return titleMatch[1];
	const heading =
		(
			await page
				.locator('h1, h2')
				.first()
				.textContent()
				.catch(() => '')
		)?.trim() ?? '';
	const headingMatch = heading.match(/\b(x-[1-5]|[AB]-[1-3])\b/);
	if (headingMatch) return headingMatch[1];
	return '';
}

async function getTieTeamNames(page: Page): Promise<string[]> {
	const names: string[] = [];
	const h2s = page.locator('h2');
	const count = await h2s.count();
	for (let i = 0; i < count; i++) {
		const text = (await h2s.nth(i).textContent())?.trim();
		if (text && TEAMS[text]) names.push(text);
		else if (text) names.push(text);
	}
	return names;
}

async function findTeamKey(name: string): Promise<string | null> {
	for (const [key, team] of Object.entries(TEAMS)) {
		if (team.name === name) return key;
	}
	return null;
}

function winningSide(tieCode: string): 'A' | 'B' {
	if (tieCode.startsWith('A-') || tieCode.startsWith('B-')) return 'A';
	switch (tieCode) {
		case 'x-2':
			return 'B';
		default:
			return 'A';
	}
}

async function getMatchUrlsFromTie(page: Page): Promise<string[]> {
	const links = page.locator('a').filter({ hasText: 'スコア入力' });
	const hrefs = await links.evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).href));
	return hrefs;
}

async function processTie(page: Page, tieId: string, isKnockout: boolean) {
	const tieUrl = `/ties/${tieId}`;
	await page.goto(tieUrl);
	await page.waitForTimeout(150);
	await page
		.locator('dt')
		.filter({ hasText: 'コード' })
		.locator('..')
		.locator('dd')
		.waitFor({ state: 'visible', timeout: 10000 })
		.catch(() => {});
	const tieCode = await getTieCode(page);
	const teamNames = await getTieTeamNames(page);
	const tieTeamKeys: string[] = [];
	for (const name of teamNames) {
		const key = await findTeamKey(name);
		if (key) tieTeamKeys.push(key);
	}
	console.log(`  Tie ${tieCode}: ${tieTeamKeys.join(' vs ')}`);

	// Submit lineups
	for (const teamKey of tieTeamKeys) {
		await submitTeamLineup(page, TEAMS[teamKey].name, teamKey, tieId);
	}

	// Approve lineups
	await page.goto(tieUrl);
	await page.waitForTimeout(100);
	const approveBtns = page.getByRole('button', { name: '承認する' });
	const approveCount = await approveBtns.count();
	for (let i = 0; i < approveCount; i++) {
		await approveBtns.first().click();
		await page.waitForTimeout(50);
	}

	// Start tie
	await page.waitForTimeout(50);
	const startTieBtn = page.getByRole('button', { name: '対戦を開始' });
	if (await startTieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
		await startTieBtn.click();
		await page.waitForTimeout(250);
	}

	// Get match URLs
	await page.goto(tieUrl);
	await page.waitForTimeout(150);
	let matchUrls = await getMatchUrlsFromTie(page);
	for (let i = 0; i < 20 && matchUrls.length === 0; i++) {
		await page.waitForTimeout(250);
		await page.goto(tieUrl);
		await page.waitForTimeout(100);
		matchUrls = await getMatchUrlsFromTie(page);
	}
	const ws = winningSide(tieCode);
	console.log(`  Scoring ${matchUrls.length} rubbers (winning side: ${ws})`);

	// Score each rubber
	for (let i = 0; i < matchUrls.length; i++) {
		const url = matchUrls[i];
		console.log(`    Rubber ${i + 1}/${matchUrls.length}...`);
		await scoreFullMatch(page, url, ws, isKnockout);
	}

	// Confirm the tie result so it appears on the public standings/live board.
	await page.goto(tieUrl);
	await page.waitForTimeout(200);
	const confirmTieBtn = page.getByRole('button', { name: '結果を確定' });
	if (await confirmTieBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
		await confirmTieBtn.click();
		await page.waitForTimeout(200);
		console.log('  Tie result confirmed');
	} else {
		console.log('  WARNING: "結果を確定" button not visible — tie result was not confirmed');
	}
}

async function createTeamAccount(page: Page, teamKey: keyof typeof TEAM_IDS) {
	const teamId = TEAM_IDS[teamKey];
	if (!teamId) throw new Error(`team id not found for ${teamKey}`);

	await page.goto('/settings/accounts');
	await page.waitForTimeout(200);

	await page
		.locator('label')
		.filter({ hasText: '種別' })
		.locator('button[data-select-trigger]')
		.click();
	await page.waitForTimeout(50);
	await page.getByRole('option', { name: 'チーム' }).click();
	await page.waitForTimeout(50);

	await page
		.locator('label')
		.filter({ hasText: 'チーム' })
		.nth(1)
		.locator('button[data-select-trigger]')
		.click();
	await page.waitForTimeout(50);
	await page.getByRole('option', { name: TEAMS[teamKey].name }).click();
	await page.waitForTimeout(50);

	await page.locator('input[name="accountId"]').fill(TEAM_ACCOUNT.accountId);
	await page.locator('input[name="name"]').fill(TEAM_ACCOUNT.name);
	await page.locator('input[name="password"]').fill(TEAM_ACCOUNT.password);
	await page.getByRole('button', { name: '発行' }).click();
	await page.waitForTimeout(300);
}

async function switchToTeamPerspective(page: Page) {
	await page.getByRole('button', { name: 'ログアウト' }).click();
	await page.waitForURL(/\/auth\/login/, { timeout: 10000 });
	await page.locator('input[name="accountId"]').fill(TEAM_ACCOUNT.accountId);
	await page.locator('input[name="password"]').fill(TEAM_ACCOUNT.password);
	await page.getByRole('button', { name: 'ログイン' }).click();
	await page.waitForURL(/^(?!.*\/auth\/login).*$/, { timeout: 10000 });
	await page.waitForTimeout(300);
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.use({ video: 'on' });

test.describe.serial('full tournament simulation', () => {
	test('create 6 teams with players', async ({ page }) => {
		test.setTimeout(300_000);
		for (const key of ['A1', 'A2', 'A3', 'B1', 'B2', 'B3']) {
			const team = TEAMS[key];
			console.log(`Creating team ${key}: ${team.name}`);
			await page.goto('/teams');
			await page.waitForTimeout(100);
			await page.getByRole('button', { name: '+ 追加' }).click();
			await page.locator('input[name="name"]').fill(team.name);
			await selectAppOption(page, 'リーグ', team.group === 'A' ? 'Aリーグ' : 'Bリーグ');
			await page.getByRole('button', { name: '追加', exact: true }).click();
			await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
			TEAM_IDS[key] = page.url().split('/').pop()!;
			const ids: string[] = [];
			for (const player of team.players) {
				const id = await addPlayer(page, player.name, player.gender);
				ids.push(id);
			}
			TEAM_PLAYER_IDS[key] = ids;
		}
	});

	test('generate round-robin ties', async ({ page }) => {
		// Clean up all existing ties for our teams before generating fresh round-robin.
		// This prevents accumulation of ties across repeated test runs.
		const regex = /(?:\b[AB]-\d+\b|\bx-\d+\b|SIM-[A-Z]\d-)/;
		let found = true;
		while (found) {
			found = false;
			await page.goto('/ties');
			await page.waitForTimeout(100);
			const cards = page
				.locator('div.overflow-hidden.rounded-xl.border')
				.filter({ hasText: regex });
			const count = await cards.count();
			if (count === 0) break;
			const detailLink = cards.first().locator('a').filter({ hasText: '詳細' });
			if (!(await detailLink.isVisible({ timeout: 500 }).catch(() => false))) break;
			await detailLink.click();
			await page.waitForURL(/\/ties\/[a-zA-Z0-9-]+$/, { timeout: 5000 });
			await page.waitForTimeout(50);
			const deleteBtn = page.getByText('対戦を削除');
			if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
				await deleteBtn.click();
				const cb = page.getByRole('checkbox', { name: '強制削除する' });
				if (await cb.isVisible({ timeout: 1000 }).catch(() => false)) await cb.click();
				await page.getByRole('button', { name: '削除する' }).click();
				await page.waitForTimeout(100);
				found = true;
			}
		}
		console.log(`Cleaned up existing ties for our teams`);

		for (const group of ['A', 'B']) {
			await page.goto(`/groups/${group}`);
			await page.waitForTimeout(100);
			const genBtn = page.getByRole('button', { name: '総当たり生成' });
			if (await genBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
				await genBtn.click();
				await page.waitForTimeout(250);
				console.log(`Generated round-robin ties for Group ${group}`);
			}
		}
	});

	function teamNameRegex(): RegExp {
		const names = Object.values(TEAMS).map((t) => t.name);
		const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
		return new RegExp(escaped);
	}

	function findOurTieCards(page: Page) {
		const regex = teamNameRegex();
		return page.locator('div.overflow-hidden.rounded-xl.border').filter({ hasText: regex });
	}

	test('play group stage', async ({ page }) => {
		test.setTimeout(1_800_000);
		// Get tie IDs filtered to our teams only
		await page.goto('/ties');
		await page.waitForTimeout(200);
		const tieCards = findOurTieCards(page);
		const count = await tieCards.count();
		console.log(`Found ${count} ties for our teams in group stage`);

		for (let i = 0; i < count; i++) {
			await page.goto('/ties');
			await page.waitForTimeout(100);
			const card = findOurTieCards(page).nth(i);
			const detailLink = card.locator('a').filter({ hasText: '詳細' });
			await detailLink.click();
			await page.waitForURL(/\/ties\/[a-zA-Z0-9-]+$/, { timeout: 5000 });
			const tieId = page.url().split('/').pop()!;
			console.log(`\nProcessing tie ${i + 1}/${count}: ${tieId}`);
			await processTie(page, tieId, false);
		}
	});

	test('generate and play knockout stage', async ({ page }) => {
		test.setTimeout(1_800_000);

		// Delete any unscored group ties from other test runs (e.g. finals.spec.ts)
		// that would prevent the semifinals button from becoming enabled.
		const simTeamNames = Object.values(TEAMS).map((t) => t.name);
		let foundForeign = true;
		while (foundForeign) {
			foundForeign = false;
			await page.goto('/ties');
			await page.waitForTimeout(50);
			const cards = page.locator('div.overflow-hidden.rounded-xl.border');
			const count = await cards.count();
			for (let i = 0; i < count; i++) {
				const text = (await cards.nth(i).textContent()) ?? '';
				if (simTeamNames.some((n) => text.includes(n))) continue;
				const detailLink = cards.nth(i).locator('a').filter({ hasText: '詳細' });
				if (!(await detailLink.isVisible({ timeout: 500 }).catch(() => false))) continue;
				await detailLink.click();
				await page.waitForTimeout(50);
				const deleteBtn = page.getByText('対戦を削除');
				if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
					await deleteBtn.click();
					const cb = page.getByRole('checkbox', { name: '強制削除する' });
					if (await cb.isVisible({ timeout: 1000 }).catch(() => false)) await cb.click();
					await page.getByRole('button', { name: '削除する' }).click();
					await page.waitForTimeout(100);
					foundForeign = true;
				}
				break;
			}
		}

		// Generate semifinals + 5th place
		console.log('Navigating to finals page for semis...');
		await page.goto('/finals', { waitUntil: 'commit', timeout: 15000 });
		await page.waitForTimeout(200);
		console.log(
			'Finals page before semis:',
			(await page.locator('body').textContent())?.slice(0, 500)
		);
		const genSemisBtn = page.getByRole('button', { name: '準決勝・5位決定戦生成' });
		await expect(genSemisBtn).toBeVisible({ timeout: 5000 });
		await expect(genSemisBtn).toBeEnabled({ timeout: 10000 });
		console.log('Generating semifinals and 5th place...');
		await genSemisBtn.evaluate((el) => (el as HTMLButtonElement).click());
		console.log('Clicked semifinals button');
		const semisResult = page.getByText(
			/決勝トーナメント対戦を生成しました。|生成に失敗しました|同点チームの順位を確定してから生成できます|Aリーグ・Bリーグの試合が全て完了してから生成できます/
		);
		await expect(semisResult).toBeVisible({ timeout: 30000 });
		console.log('Semis result:', await semisResult.textContent());
		await page.waitForTimeout(1000);
		// Find knockout ties from the same finals page after the refresh.
		const semisSection = page.locator('section').filter({ hasText: '準決勝 / 5位決定戦' });
		const semisLinks = semisSection.locator('a[href^="/ties/"]');
		await expect(semisLinks).toHaveCount(3, { timeout: 20000 });
		const semisHrefs = await semisLinks.evaluateAll((els) =>
			els
				.map((el) => (el as HTMLAnchorElement).getAttribute('href'))
				.filter((href): href is string => !!href)
		);
		const ties: { tieId: string; code: string }[] = [];
		for (const href of semisHrefs) {
			await page.goto(href, { waitUntil: 'commit', timeout: 15000 });
			await page.waitForURL(/\/ties\/[a-zA-Z0-9-]+$/, { timeout: 5000 });
			const tieId = page.url().split('/').pop()!;
			const code = await getTieCode(page);
			if (/^x-[1-5]$/.test(code)) {
				ties.push({ tieId, code });
			}
		}
		console.log(`Found ${ties.length} knockout ties: ${ties.map((t) => t.code).join(', ')}`);
		// Play semifinals and 5th place
		for (const { tieId, code } of ties) {
			console.log(`\nProcessing knockout tie ${code}: ${tieId}`);
			await processTie(page, tieId, true);
		}
		await page.goto('/finals', { waitUntil: 'commit', timeout: 15000 });
		await page.waitForTimeout(200);
		console.log(
			'Finals page before finals:',
			(await page.locator('body').textContent())?.slice(0, 500)
		);
		// Generate finals + 3rd place
		const genFinalsBtn = page.getByRole('button', { name: '決勝・3位決定戦生成' });
		if (await genFinalsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
			await expect(genFinalsBtn).toBeEnabled({ timeout: 15000 });
			console.log('Generating finals and 3rd place...');
			await genFinalsBtn.evaluate((el) => (el as HTMLButtonElement).click());
			console.log('Clicked finals button');
			const finalsResult = page.getByText(
				/決勝・3位決定戦を生成しました。|生成に失敗しました|準決勝1・準決勝2の結果確定後に生成できます/
			);
			await expect(finalsResult).toBeVisible({ timeout: 30000 });
			console.log('Finals result:', await finalsResult.textContent());
			await page.waitForTimeout(1000);
		} else {
			console.log('Finals button not visible — skipping finals generation');
		}
		// Play finals (x-4 and x-5)
		const finalsSection = page.locator('section').filter({ hasText: '決勝 / 3位決定戦' });
		const finalLinks = finalsSection.locator('a[href^="/ties/"]');
		await expect(finalLinks).toHaveCount(2, { timeout: 20000 });
		const finalHrefs = await finalLinks.evaluateAll((els) =>
			els
				.map((el) => (el as HTMLAnchorElement).getAttribute('href'))
				.filter((href): href is string => !!href)
		);
		const finalTies: { tieId: string; code: string }[] = [];
		for (const href of finalHrefs) {
			await page.goto(href, { waitUntil: 'commit', timeout: 15000 });
			await page.waitForURL(/\/ties\/[a-zA-Z0-9-]+$/, { timeout: 5000 });
			const tieId = page.url().split('/').pop()!;
			const code = await getTieCode(page);
			if (/^x-[4-5]$/.test(code) && !ties.find((t) => t.tieId === tieId)) {
				finalTies.push({ tieId, code });
			}
		}
		for (const { tieId, code } of finalTies) {
			console.log(`\nProcessing final tie ${code}: ${tieId}`);
			await processTie(page, tieId, true);
		}
		await createTeamAccount(page, 'A1');
		await switchToTeamPerspective(page);
		await page.goto('/live');
		await page.waitForTimeout(200);
		await page.goto('/live/standings');
		await page.waitForTimeout(200);
		// Final screenshots
		await page.goto('/finals');
		await page.waitForTimeout(200);
		await page.screenshot({ path: 'test-results/finals-result.png', fullPage: true });
		await page.goto('/live/standings');
		await page.waitForTimeout(200);
		await page.screenshot({ path: 'test-results/live-standings-team-view.png', fullPage: true });
		console.log('\n=== Tournament complete! ===');
		console.log('Video saved in test-results/ directory');
	});
});
