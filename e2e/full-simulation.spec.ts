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
	await page.waitForTimeout(500);
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
	await page.waitForTimeout(1000);
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
	await link.click();
	await page.waitForURL(/\/ties\/.+\/lineups\/.+/, { timeout: 10000 });
	console.log(`    Lineup page URL: ${page.url()}`);
	await page.waitForTimeout(1000);
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
		await page.waitForTimeout(200);
		await page.getByRole('option', { name: playerName }).click();
		await page.waitForTimeout(200);
	}

	await page.getByRole('button', { name: '提出する' }).click();
	await page.waitForTimeout(2000);

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

	// Select server via UI (triggers Svelte reactive state properly)
	const triggers = page.locator('button[data-select-trigger]');
	await triggers.first().click();
	await page.waitForTimeout(300);
	const options = page.getByRole('option');
	const optCount = await options.count();
	if (optCount === 0) {
		console.log(`    WARNING: no options for server`);
		return true;
	}
	await options.first().click();
	await page.waitForTimeout(200);

	// Select receiver (pick a different player — last option)
	await triggers.last().click();
	await page.waitForTimeout(300);
	const optCount2 = await page.getByRole('option').count();
	if (optCount2 === 0) {
		console.log(`    WARNING: no options for receiver`);
		return true;
	}
	await page.getByRole('option').last().click();
	await page.waitForTimeout(200);

	// Click start
	await startBtn.click();
	await page.waitForTimeout(1500);
	return true;
}

async function scoreGameViaFetch(page: Page, winningSide: 'A' | 'B', maxRallies = 35) {
	await page.waitForTimeout(500);
	await page.waitForTimeout(200);

	for (let i = 0; i < maxRallies; i++) {
		if (i > 0 && i % 20 === 0) console.log(`        rally ${i}...`);
		// Find the +1 button for the winning side using Playwright locator
		const sideInput = page.locator(`input[name="side"][value="${winningSide}"]`);
		if ((await sideInput.count()) === 0) {
			const inputs = await page.evaluate(() => {
				return Array.from(document.querySelectorAll('input')).map((i) => ({
					name: i.name,
					value: i.value,
					type: i.type
				}));
			});
			console.log(`        side_input_not_found. Page inputs: ${JSON.stringify(inputs)}`);
			const btns = await page.evaluate(() => {
				return Array.from(document.querySelectorAll('button')).map((b) => ({
					text: (b.textContent || '').substring(0, 30),
					disabled: (b as HTMLButtonElement).disabled,
					type: b.getAttribute('type')
				}));
			});
			console.log(`        Page buttons: ${JSON.stringify(btns.slice(0, 10))}`);
			return { stopped: true, reason: 'side_input_not_found' };
		}
		const btn = sideInput.first().locator('xpath=..').locator('button[type="submit"]');
		const disabled = await btn.isDisabled().catch(() => true);
		if (disabled) {
			const btns = await page.evaluate(() => {
				return Array.from(document.querySelectorAll('button')).map((b) => ({
					text: (b.textContent || '').substring(0, 30),
					disabled: (b as HTMLButtonElement).disabled,
					type: b.getAttribute('type')
				}));
			});
			console.log(
				`        Scoring buttons disabled. Page buttons: ${JSON.stringify(btns.slice(0, 10))}`
			);
			return { stopped: true, reason: 'button_disabled' };
		}
		await btn.click();
		// Wait for button to be re-enabled (SvelteKit form submission complete)
		try {
			await btn.evaluate((b, enabledTimeout) => {
				const btn = b as HTMLButtonElement;
				return new Promise<void>((resolve) => {
					let elapsed = 0;
					const check = () => {
						if (!btn.disabled || elapsed > enabledTimeout) {
							resolve();
							return;
						}
						elapsed += 50;
						setTimeout(check, 50);
					};
					setTimeout(check, 50);
				});
			}, 5000);
		} catch {
			// ignore timeout waiting for button re-enable
		}
		await page.waitForTimeout(50);
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
	await page.waitForTimeout(150);
	await page.getByRole('option').first().click();
	await page.waitForTimeout(150);
	const receiverCtl = page
		.locator('span')
		.filter({ hasText: 'レシーバー' })
		.first()
		.locator('..')
		.locator('button[data-select-trigger]');
	await receiverCtl.click();
	await page.waitForTimeout(150);
	await page.getByRole('option').first().click();
	await page.waitForTimeout(150);
	await gameBtn.click();
	await page.waitForTimeout(800);
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
			await page.waitForTimeout(500);
		}
	}
	// Confirm winner
	const confirmBtn = page.getByRole('button', { name: '勝者確認' });
	if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
		await confirmBtn.click();
		await page.waitForTimeout(500);
	}
}

async function scoreFullMatch(
	page: Page,
	matchUrl: string,
	winningSide: 'A' | 'B',
	isKnockout: boolean
) {
	await page.goto(matchUrl, { timeout: 15000 });
	await page.waitForTimeout(1000);
	// Start match
	await startMatchViaUI(page);
	// Score game 1
	const maxRallies = isKnockout ? 35 : 25;
	const g1Result = await scoreGameViaFetch(page, winningSide, maxRallies);
	if (g1Result?.stopped) {
		console.log(
			`    Game 1 stopped: ${g1Result.reason}${g1Result.message ? ': ' + g1Result.message : ''}`
		);
		// If game couldn't be scored (match finished etc.), skip rest
		return;
	}
	// Reload to see updated state
	await page.reload({ timeout: 15000 });
	await page.waitForTimeout(500);
	// Start game 2 if needed
	if (await startNextGameViaUI(page)) {
		await scoreGameViaFetch(page, winningSide, maxRallies);
		await page.reload({ timeout: 15000 });
		await page.waitForTimeout(500);
	}
	// Confirm match result
	await confirmMatch(page);
}

// ── Tie helpers ────────────────────────────────────────────────────────────

async function getTieCode(page: Page): Promise<string> {
	const title = await page.title();
	const code = title.split(' | ')[0];
	if (/^(x-[1-5]|[AB]-[1-3])$/.test(code)) return code;
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
	await page.waitForTimeout(800);
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
	await page.waitForTimeout(500);
	const approveBtns = page.getByRole('button', { name: '承認する' });
	const approveCount = await approveBtns.count();
	for (let i = 0; i < approveCount; i++) {
		await approveBtns.first().click();
		await page.waitForTimeout(300);
	}

	// Start tie
	await page.waitForTimeout(300);
	const startTieBtn = page.getByRole('button', { name: '対戦を開始' });
	if (await startTieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
		await startTieBtn.click();
		await page.waitForTimeout(1500);
	}

	// Get match URLs
	await page.goto(tieUrl);
	await page.waitForTimeout(800);
	const matchUrls = await getMatchUrlsFromTie(page);
	const ws = winningSide(tieCode);
	console.log(`  Scoring ${matchUrls.length} rubbers (winning side: ${ws})`);

	// Score each rubber
	for (let i = 0; i < matchUrls.length; i++) {
		const url = matchUrls[i];
		console.log(`    Rubber ${i + 1}/${matchUrls.length}...`);
		await scoreFullMatch(page, url, ws, isKnockout);
	}
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
			await page.waitForTimeout(500);
			await page.getByRole('button', { name: '+ 追加' }).click();
			await page.locator('input[name="name"]').fill(team.name);
			await selectAppOption(page, 'リーグ', team.group === 'A' ? 'Aリーグ' : 'Bリーグ');
			await page.getByRole('button', { name: '追加', exact: true }).click();
			await expect(page).toHaveURL(/\/teams\/[a-zA-Z0-9-]+$/);
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
		const regex = teamNameRegex();
		let found = true;
		while (found) {
			found = false;
			await page.goto('/ties');
			await page.waitForTimeout(500);
			const cards = page
				.locator('div.overflow-hidden.rounded-xl.border')
				.filter({ hasText: regex });
			const count = await cards.count();
			if (count === 0) break;
			const detailLink = cards.first().locator('a').filter({ hasText: '詳細' });
			if (!(await detailLink.isVisible({ timeout: 500 }).catch(() => false))) break;
			await detailLink.click();
			await page.waitForURL(/\/ties\/[a-zA-Z0-9-]+$/, { timeout: 5000 });
			await page.waitForTimeout(300);
			const deleteBtn = page.getByText('対戦を削除');
			if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
				await deleteBtn.click();
				const cb = page.getByRole('checkbox', { name: '強制削除する' });
				if (await cb.isVisible({ timeout: 1000 }).catch(() => false)) await cb.click();
				await page.getByRole('button', { name: '削除する' }).click();
				await page.waitForTimeout(500);
				found = true;
			}
		}
		console.log(`Cleaned up existing ties for our teams`);

		for (const group of ['A', 'B']) {
			await page.goto(`/groups/${group}`);
			await page.waitForTimeout(500);
			const genBtn = page.getByRole('button', { name: '総当たり生成' });
			if (await genBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
				await genBtn.click();
				await page.waitForTimeout(1500);
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
		test.setTimeout(900_000);
		// Get tie IDs filtered to our teams only
		await page.goto('/ties');
		await page.waitForTimeout(1500);
		const tieCards = findOurTieCards(page);
		const count = await tieCards.count();
		console.log(`Found ${count} ties for our teams in group stage`);

		for (let i = 0; i < count; i++) {
			await page.goto('/ties');
			await page.waitForTimeout(500);
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
		test.setTimeout(900_000);

		// Delete any unscored group ties from other test runs (e.g. finals.spec.ts)
		// that would prevent the semifinals button from becoming enabled.
		const simTeamNames = Object.values(TEAMS).map((t) => t.name);
		let foundForeign = true;
		while (foundForeign) {
			foundForeign = false;
			await page.goto('/ties');
			await page.waitForTimeout(300);
			const cards = page.locator('div.overflow-hidden.rounded-xl.border');
			const count = await cards.count();
			for (let i = 0; i < count; i++) {
				const text = (await cards.nth(i).textContent()) ?? '';
				if (simTeamNames.some((n) => text.includes(n))) continue;
				const detailLink = cards.nth(i).locator('a').filter({ hasText: '詳細' });
				if (!(await detailLink.isVisible({ timeout: 500 }).catch(() => false))) continue;
				await detailLink.click();
				await page.waitForTimeout(300);
				const deleteBtn = page.getByText('対戦を削除');
				if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
					await deleteBtn.click();
					const cb = page.getByRole('checkbox', { name: '強制削除する' });
					if (await cb.isVisible({ timeout: 1000 }).catch(() => false)) await cb.click();
					await page.getByRole('button', { name: '削除する' }).click();
					await page.waitForTimeout(500);
					foundForeign = true;
				}
				break;
			}
		}

		// Generate semifinals + 5th place
		await page.goto('/finals');
		await page.waitForTimeout(1000);
		const genSemisBtn = page.getByRole('button', { name: '準決勝' });
		await expect(genSemisBtn).toBeVisible({ timeout: 5000 });
		await expect(genSemisBtn).toBeEnabled({ timeout: 10000 });
		console.log('Generating semifinals and 5th place...');
		await genSemisBtn.click();
		await page.waitForTimeout(2000);
		// Find knockout ties by our team names
		await page.goto('/ties');
		await page.waitForTimeout(1000);
		const semisCards = findOurTieCards(page);
		const semisCount = await semisCards.count();
		const ties: { tieId: string; code: string }[] = [];
		for (let i = 0; i < semisCount; i++) {
			await page.goto('/ties');
			await page.waitForTimeout(500);
			const card = findOurTieCards(page).nth(i);
			const detailLink = card.locator('a').filter({ hasText: '詳細' });
			await detailLink.click();
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
		// Generate finals + 3rd place
		await page.goto('/finals');
		await page.waitForTimeout(1000);
		const genFinalsBtn = page.getByRole('button', { name: '決勝' });
		if (await genFinalsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
			await expect(genFinalsBtn).toBeEnabled({ timeout: 15000 });
			console.log('Generating finals and 3rd place...');
			await genFinalsBtn.click();
			await page.waitForTimeout(2000);
		} else {
			console.log('Finals button not visible — skipping finals generation');
		}
		// Play finals (x-4 and x-5)
		const finalTies: { tieId: string; code: string }[] = [];
		const finalCards = findOurTieCards(page);
		const finalCount = await finalCards.count();
		for (let i = 0; i < finalCount; i++) {
			await page.goto('/ties');
			await page.waitForTimeout(500);
			const card = findOurTieCards(page).nth(i);
			const detailLink = card.locator('a').filter({ hasText: '詳細' });
			await detailLink.click();
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
		// Final screenshot
		await page.goto('/finals');
		await page.waitForTimeout(1000);
		await page.screenshot({ path: 'test-results/finals-result.png', fullPage: true });
		console.log('\n=== Tournament complete! ===');
		console.log('Video saved in test-results/ directory');
	});
});
