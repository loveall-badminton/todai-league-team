#!/usr/bin/env node

/**
 * Staging environment seed script.
 *
 * 1. Creates D1 tables (via migrations)
 * 2. Seeds static data (teams, players, ties, rubbers, matches, lineups)
 * 3. Creates admin user (sign-up API + SQL promotion)
 * 4. Starts all matches (POST ?/start for each match)
 * 5. Outputs match-assignments.json for k6 load tests
 *
 * Usage:
 *   npx tsx scripts/seed-staging-data.ts --db=todai-league-staging --base-url=https://...
 *
 * Prerequisites:
 *   - D1 database already created (wrangler d1 create ...)
 *   - wrangler.jsonc points to the correct DB
 *   - wrangler d1 migrations apply ... --remote already run
 *   - App is deployed and accessible at --base-url
 */

import { execSync, type ExecSyncOptions } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

// ── Config ──────────────────────────────────────────────────────────────────

const DB_NAME = process.argv.find((a) => a.startsWith('--db='))?.slice(5) ?? 'todai-league-staging';
const BASE_URL =
	process.argv.find((a) => a.startsWith('--base-url='))?.slice(11) ?? process.env.BASE_URL;
if (!BASE_URL) {
	console.error('ERROR: --base-url=<url> is required');
	process.exit(1);
}

const ADMIN = { accountId: 'testadmin', password: 'TestAdmin123', name: 'Test Admin' };
const ADMIN_EMAIL = `${ADMIN.accountId}@accounts.local`;

const TEAM_COUNT = parseInt(
	process.argv.find((a) => a.startsWith('--teams='))?.slice(8) ?? '40',
	10
);
const PLAYERS_PER_TEAM = 4;
const TIE_COUNT = TEAM_COUNT / 2; // 2 teams per tie

const RUBBER_CODES = ['WD1', 'XD1', 'MD3', 'MD2', 'MD1'] as const;
const DISCIPLINES: Record<string, string> = {
	WD1: 'WD',
	XD1: 'XD',
	MD3: 'MD',
	MD2: 'MD',
	MD1: 'MD'
};

function pad(n: number, w = 3): string {
	return String(n).padStart(w, '0');
}

function tid(name: string, n: number): string {
	return `${name}-${pad(n)}`;
}

const TEAM_IDS = Array.from({ length: TEAM_COUNT }, (_, i) => tid('team', i + 1));
const PLAYER_IDS = TEAM_IDS.flatMap((tId, ti) =>
	Array.from({ length: PLAYERS_PER_TEAM }, (_, pi) => tid('player', ti * PLAYERS_PER_TEAM + pi + 1))
);
const TIE_IDS = Array.from({ length: TIE_COUNT }, (_, i) => tid('tie', i + 1));
const MATCH_IDS: string[] = [];
const RUBBER_IDS: string[] = [];

let matchIdx = 0;
for (let ti = 0; ti < TIE_COUNT; ti++) {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	for (const code of RUBBER_CODES) {
		matchIdx++;
		MATCH_IDS.push(tid('match', matchIdx));
		RUBBER_IDS.push(tid('rubber', matchIdx));
	}
}

const MATCHES_PER_TIE = RUBBER_CODES.length;

function d1(sql: string) {
	const cmd = `npx wrangler d1 execute ${DB_NAME} -c wrangler.staging.jsonc --remote --command="${sql.replace(/"/g, '\\"')}"`;
	try {
		execSync(cmd, { stdio: 'pipe', timeout: 60_000 } satisfies ExecSyncOptions);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error(`D1 error (truncated): ${msg.slice(0, 200)}`);
		throw e;
	}
}

function d1File(sqlFile: string) {
	const cmd = `npx wrangler d1 execute ${DB_NAME} -c wrangler.staging.jsonc --remote --file="${sqlFile}"`;
	try {
		execSync(cmd, { stdio: 'inherit', timeout: 120_000 } satisfies ExecSyncOptions);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error(`D1 file error: ${msg.slice(0, 200)}`);
		throw e;
	}
}

function nowISO(): string {
	return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

// ── 1. Seed static data ─────────────────────────────────────────────────────

function seedSql(): string {
	const lines: string[] = [];
	const now = nowISO();
	const tournamentId = 'tournament-001';
	const eventName = '負荷テスト大会';

	// Temporarily disable FK checks for bulk seed/reset
	lines.push('PRAGMA foreign_keys=OFF;');

	// Clear existing test data
	lines.push(`DELETE FROM lineup_items;`);
	lines.push(`DELETE FROM lineup_submissions;`);
	lines.push(`DELETE FROM score_event_undo_links;`);
	lines.push(`DELETE FROM score_events;`);
	lines.push(`DELETE FROM match_service_states;`);
	lines.push(`DELETE FROM match_snapshots;`);
	lines.push(`DELETE FROM match_side_players;`);
	lines.push(`DELETE FROM match_sides;`);
	lines.push(`DELETE FROM officiating_assignments;`);
	lines.push(`DELETE FROM rubbers;`);
	lines.push(`DELETE FROM matches;`);
	lines.push(`DELETE FROM ties;`);
	lines.push(`DELETE FROM ranking_tiebreakers;`);
	lines.push(`DELETE FROM group_standing_overrides;`);
	lines.push(`DELETE FROM team_players;`);
	lines.push(`DELETE FROM teams;`);

	// Scoring rule
	const groupScoringRuleId = 'sr-bwf-15';
	const knockoutScoringRuleId = 'sr-bwf-21';
	lines.push(
		`INSERT OR IGNORE INTO scoring_rules (id, code, name, max_games, games_to_win, points_to_win, win_by, max_points, mid_game_interval_point, created_at, updated_at) VALUES ('${groupScoringRuleId}', 'bwf_15', '予選 15点制', 3, 2, 15, 2, 21, 8, '${now}', '${now}');`
	);
	lines.push(
		`INSERT OR IGNORE INTO scoring_rules (id, code, name, max_games, games_to_win, points_to_win, win_by, max_points, mid_game_interval_point, created_at, updated_at) VALUES ('${knockoutScoringRuleId}', 'bwf_21', '決勝 21点制', 3, 2, 21, 2, 30, 11, '${now}', '${now}');`
	);

	// App settings
	lines.push(
		`INSERT OR IGNORE INTO app_settings (id, event_name, group_stage_scoring_rule_id, knockout_scoring_rule_id, tiebreaker_scoring_rule_id, lineup_reveal_policy, default_lineup_due_minutes_before, created_at, updated_at) VALUES ('settings-001', '${eventName}', '${groupScoringRuleId}', '${knockoutScoringRuleId}', '${knockoutScoringRuleId}', 'on_tie_start', 10, '${now}', '${now}');`
	);

	// Tournament (required for matches FK)
	lines.push(
		`INSERT OR IGNORE INTO tournaments (id, name, status, created_at, updated_at) VALUES ('${tournamentId}', '${eventName}', 'running', '${now}', '${now}');`
	);

	// Teams
	for (let ti = 0; ti < TEAM_COUNT; ti++) {
		const id = TEAM_IDS[ti];
		const groupCode = ti < TEAM_COUNT / 2 ? 'A' : 'B';
		lines.push(
			`INSERT INTO teams (id, name, short_name, group_code, display_order, status, created_at, updated_at) VALUES ('${id}', 'Team ${pad(ti + 1)}', 'T${pad(ti + 1)}', '${groupCode}', ${ti + 1}, 'active', '${now}', '${now}');`
		);
	}

	// Players
	for (let pi = 0; pi < PLAYER_IDS.length; pi++) {
		const id = PLAYER_IDS[pi];
		const teamIdx = Math.floor(pi / PLAYERS_PER_TEAM);
		const teamId = TEAM_IDS[teamIdx];
		const playerIdx = pi + 1;
		lines.push(
			`INSERT INTO team_players (id, team_id, name, gender, display_order, status, created_at, updated_at) VALUES ('${id}', '${teamId}', 'Player ${pad(playerIdx)}', 'male', ${playerIdx}, 'active', '${now}', '${now}');`
		);
	}

	// Ties
	for (let ti = 0; ti < TIE_COUNT; ti++) {
		const id = TIE_IDS[ti];
		const teamAIdx = ti * 2;
		const teamBIdx = ti * 2 + 1;
		const teamAId = TEAM_IDS[teamAIdx];
		const teamBId = TEAM_IDS[teamBIdx];
		const phase = tiePhase(ti);
		const groupCode = ti < TIE_COUNT / 2 ? 'A' : 'B';
		lines.push(
			`INSERT INTO ties (id, tie_code, phase, group_code, team_a_id, team_b_id, status, team_score_a, team_score_b, display_order, created_at, updated_at) VALUES ('${id}', 'TIE-${pad(ti + 1)}', '${phase}', '${groupCode}', '${teamAId}', '${teamBId}', 'playing', 0, 0, ${ti + 1}, '${now}', '${now}');`
		);
	}

	function scoringRuleForPhase(phase: string): string {
		return phase.startsWith('group') ? groupScoringRuleId : knockoutScoringRuleId;
	}

	function tiePhase(ti: number): string {
		return ti < TIE_COUNT / 2 ? 'group_a' : 'group_b';
	}

	// Collect match metadata for phased inserts (avoids circular FK: matches↔rubbers)
	const matchData: Array<{
		matchId: string;
		rubberId: string;
		tieId: string;
		code: string;
		discipline: string;
		teamAIdx: number;
		teamBIdx: number;
		phase: string;
	}> = [];

	// Phase 1: matches (rubber_id = NULL, FK-safe)
	matchIdx = 0;
	for (let ti = 0; ti < TIE_COUNT; ti++) {
		const phase = tiePhase(ti);
		const srId = scoringRuleForPhase(phase);
		for (let ri = 0; ri < MATCHES_PER_TIE; ri++) {
			matchIdx++;
			const matchId = tid('match', matchIdx);
			const rubberId = tid('rubber', matchIdx);
			const code = RUBBER_CODES[ri];
			const discipline = DISCIPLINES[code];
			const teamAIdx = ti * 2;
			const teamBIdx = ti * 2 + 1;

			matchData.push({
				matchId,
				rubberId,
				tieId: TIE_IDS[ti],
				code,
				discipline,
				teamAIdx,
				teamBIdx,
				phase
			});

			lines.push(
				`INSERT INTO matches (id, tournament_id, court_id, discipline, match_no, display_order, scoring_mode, scoring_rule_id, status, current_game_no, current_score_a, current_score_b, games_won_a, games_won_b, last_seq_no, created_at, updated_at) VALUES ('${matchId}', '${tournamentId}', NULL, '${discipline}', ${matchIdx}, ${matchIdx}, 'best_of_3_21', '${srId}', 'scheduled', 1, 0, 0, 0, 0, 0, '${now}', '${now}');`
			);
		}
	}

	// Phase 2: rubbers (match_id references existing match)
	for (const md of matchData) {
		const srId = scoringRuleForPhase(md.phase);
		lines.push(
			`INSERT INTO rubbers (id, tie_id, code, discipline, display_order, scoring_rule_id, match_id, status, created_at, updated_at) VALUES ('${md.rubberId}', '${md.tieId}', '${md.code}', '${md.discipline}', 1, '${srId}', '${md.matchId}', 'ready', '${now}', '${now}');`
		);
	}

	// Phase 3: set rubber_id on matches
	for (const md of matchData) {
		lines.push(`UPDATE matches SET rubber_id = '${md.rubberId}' WHERE id = '${md.matchId}';`);
	}

	// Phase 4: match_sides, match_side_players, snapshots
	for (const md of matchData) {
		const msAId = `ms-${md.matchId}-A`;
		const msBId = `ms-${md.matchId}-B`;
		lines.push(
			`INSERT INTO match_sides (id, match_id, side, display_name, created_at, updated_at) VALUES ('${msAId}', '${md.matchId}', 'A', 'Team ${pad(md.teamAIdx + 1)}', '${now}', '${now}');`
		);
		lines.push(
			`INSERT INTO match_sides (id, match_id, side, display_name, created_at, updated_at) VALUES ('${msBId}', '${md.matchId}', 'B', 'Team ${pad(md.teamBIdx + 1)}', '${now}', '${now}');`
		);

		for (let order = 0; order < 2; order++) {
			lines.push(
				`INSERT INTO match_side_players (id, match_id, match_side_id, side, player_order, name, team_name, created_at, updated_at) VALUES ('msp-${md.matchId}-A-${order + 1}', '${md.matchId}', '${msAId}', 'A', ${order + 1}, 'Player ${pad(md.teamAIdx * PLAYERS_PER_TEAM + order + 1)}', 'Team ${pad(md.teamAIdx + 1)}', '${now}', '${now}');`
			);
			lines.push(
				`INSERT INTO match_side_players (id, match_id, match_side_id, side, player_order, name, team_name, created_at, updated_at) VALUES ('msp-${md.matchId}-B-${order + 1}', '${md.matchId}', '${msBId}', 'B', ${order + 1}, 'Player ${pad(md.teamBIdx * PLAYERS_PER_TEAM + order + 1)}', 'Team ${pad(md.teamBIdx + 1)}', '${now}', '${now}');`
			);
		}

		const isGroup = md.phase.startsWith('group');
		const initialState = {
			schemaVersion: 1,
			matchId: md.matchId,
			tournamentId,
			courtId: null,
			discipline: md.discipline,
			status: 'scheduled',
			scoring: {
				maxGames: 3,
				gamesToWin: 2,
				pointsToWin: isGroup ? 15 : 21,
				winBy: 2,
				maxPoints: isGroup ? 21 : 30,
				midGameIntervalPoint: isGroup ? 8 : 11
			},
			currentGameNo: 1,
			games: [
				{
					gameNo: 1,
					score: { A: 0, B: 0 },
					winnerSide: null,
					midGameIntervalTaken: false,
					changeEndsRequired: false,
					changeEndsCompleted: false
				}
			],
			gamesWon: { A: 0, B: 0 },
			winnerSide: null,
			terminalReason: null,
			service: null,
			lastSeqNo: 0,
			createdAt: now,
			updatedAt: now
		};
		const escapedJson = JSON.stringify(initialState).replace(/'/g, "''");
		lines.push(
			`INSERT INTO match_snapshots (match_id, seq_no, state_json, updated_at) VALUES ('${md.matchId}', 0, '${escapedJson}', '${now}');`
		);
		lines.push(
			`INSERT INTO match_service_states (match_id, seq_no, game_no, serving_side, server_player_id, receiver_player_id, server_position, receiver_position, service_side, service_number, is_first_servers_game, service_over, updated_at) VALUES ('${md.matchId}', 0, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '${now}');`
		);
	}

	// Lineup submissions and items
	// Each tie has 2 lineups (A side and B side), each lineup has 5 rubber assignments
	let lineupIdx = 0;
	for (let ti = 0; ti < TIE_COUNT; ti++) {
		const tieId = TIE_IDS[ti];
		const teamAIdx = ti * 2;
		const teamBIdx = ti * 2 + 1;
		const teamAId = TEAM_IDS[teamAIdx];
		const teamBId = TEAM_IDS[teamBIdx];

		for (const [side, teamId, teamIdx] of [
			['A', teamAId, teamAIdx] as const,
			['B', teamBId, teamBIdx] as const
		]) {
			lineupIdx++;
			const lsId = tid('ls', lineupIdx);
			const sidePlayers = PLAYER_IDS.slice(
				teamIdx * PLAYERS_PER_TEAM,
				teamIdx * PLAYERS_PER_TEAM + PLAYERS_PER_TEAM
			);

			lines.push(
				`INSERT INTO lineup_submissions (id, tie_id, team_id, side, status, submitted_at, locked_at, revealed_at, created_at, updated_at) VALUES ('${lsId}', '${tieId}', '${teamId}', '${side}', 'revealed', '${now}', '${now}', '${now}', '${now}', '${now}');`
			);

			for (let ri = 0; ri < MATCHES_PER_TIE; ri++) {
				const code = RUBBER_CODES[ri];
				// Use players 0,1 for first rubber, 0,2 for second, etc.
				// This creates variety but reuses players across rubbers
				const p1 = sidePlayers[ri % PLAYERS_PER_TEAM];
				const p2 = sidePlayers[(ri + 1) % PLAYERS_PER_TEAM];
				lines.push(
					`INSERT INTO lineup_items (id, submission_id, rubber_code, player1_id, player2_id, created_at, updated_at) VALUES ('li-${lsId}-${code}', '${lsId}', '${code}', '${p1}', '${p2}', '${now}', '${now}');`
				);
			}
		}
	}

	lines.push('PRAGMA foreign_keys=ON;');
	return lines.join('\n');
}

// ── 2. Get admin session token ──────────────────────────────────────────────

async function ensureAdmin(): Promise<string> {
	// Step 1: try sign-up
	const signupUrl = `${BASE_URL}/api/auth/sign-up/email`;
	console.log(`[SEED] Sign-up at ${signupUrl} ...`);
	const signupRes = await fetch(signupUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
		body: JSON.stringify({
			email: ADMIN_EMAIL,
			password: ADMIN.password,
			name: ADMIN.name,
			username: ADMIN.accountId,
			data: { displayUsername: ADMIN.accountId }
		})
	});

	const signupText = await signupRes.text();
	let signupBody: Record<string, unknown> | null;
	try {
		signupBody = JSON.parse(signupText);
	} catch {
		console.error(`[SEED] Sign-up response (${signupRes.status}): ${signupText.slice(0, 300)}`);
		throw new Error(
			`Sign-up API returned non-JSON (status ${signupRes.status}). ` +
				`Check that the app is deployed and BETTER_AUTH_URL is correctly set in wrangler.staging.jsonc.`
		);
	}

	if (signupRes.ok) {
		console.log(`[SEED] Admin user created: ${signupBody.user?.id}`);
	} else if (
		signupBody?.code === 'USERNAME_IS_ALREADY_TAKEN' ||
		signupBody?.code === 'EMAIL_ALREADY_EXISTS'
	) {
		console.log('[SEED] Admin user already exists');
	} else {
		console.error('[SEED] Sign-up failed:', JSON.stringify(signupBody));
		throw new Error('Sign-up failed: ' + JSON.stringify(signupBody));
	}

	// Step 2: promote to admin role
	d1(`UPDATE user SET role = 'admin' WHERE username = '${ADMIN.accountId}';`);
	d1(
		`INSERT OR IGNORE INTO auth_user_profiles (user_id, account_type, team_id, display_name, created_at, updated_at) SELECT id, 'admin', NULL, '${ADMIN.name}', datetime('now'), datetime('now') FROM user WHERE username = '${ADMIN.accountId}';`
	);
	console.log('[SEED] Admin role set');

	// Step 3: sign in to get session cookie
	const signinRes = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
		body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN.password })
	});

	if (!signinRes.ok) {
		const body = await signinRes.text();
		throw new Error(`Sign-in failed (${signinRes.status}): ${body.slice(0, 200)}`);
	}

	const setCookie = signinRes.headers.get('set-cookie');
	if (!setCookie) {
		const body = await signinRes.text();
		throw new Error(
			`No Set-Cookie header in sign-in response (${signinRes.status}). ` +
				`Body: ${body.slice(0, 200)}. ` +
				`Check BETTER_AUTH_URL in wrangler.staging.jsonc.`
		);
	}

	const match = setCookie.match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/);
	if (!match) {
		throw new Error(`Could not extract session token from Set-Cookie: ${setCookie.slice(0, 200)}`);
	}

	console.log('[SEED] Admin session obtained');
	return match[1];
}

// ── 3. Start all matches ────────────────────────────────────────────────────

interface MatchAssignment {
	matchId: string;
	serverPlayerId: string;
	receiverPlayerId: string;
}

async function startMatches(token: string): Promise<MatchAssignment[]> {
	const assignments: MatchAssignment[] = [];
	const cookie = `__Secure-better-auth.session_token=${token}`;

	matchIdx = 0;
	for (let ti = 0; ti < TIE_COUNT; ti++) {
		for (let ri = 0; ri < MATCHES_PER_TIE; ri++) {
			matchIdx++;
			const matchId = tid('match', matchIdx);
			const serverPlayerId = `msp-${matchId}-A-1`;
			const receiverPlayerId = `msp-${matchId}-B-1`;

			const url = `${BASE_URL}/referee/${matchId}?/remote=ards3a/start`;
			const body = `initialServerPlayerId=${encodeURIComponent(serverPlayerId)}&initialReceiverPlayerId=${encodeURIComponent(receiverPlayerId)}`;

			const res = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'text/html',
					Origin: BASE_URL,
					Cookie: cookie
				},
				body,
				redirect: 'manual'
			});

			if (res.status === 200 || res.status === 204) {
				assignments.push({ matchId, serverPlayerId, receiverPlayerId });
				if (matchIdx % 10 === 0) {
					console.log(`[SEED] Started match ${matchIdx}/${MATCH_IDS.length}: ${matchId}`);
				}
			} else {
				const text = await res.text();
				console.error(
					`[SEED] Failed to start match ${matchId}: ${res.status} ${text.slice(0, 200)}`
				);
			}
		}
	}

	console.log(`[SEED] Started ${assignments.length}/${MATCH_IDS.length} matches`);
	return assignments;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
	console.log(`[SEED] DB: ${DB_NAME}, Base URL: ${BASE_URL}`);

	// 1. Run migrations
	console.log('[SEED] Running D1 migrations...');
	try {
		execSync(`npx wrangler d1 migrations apply ${DB_NAME} -c wrangler.staging.jsonc --remote`, {
			stdio: 'inherit',
			timeout: 120_000
		} satisfies ExecSyncOptions);
	} catch {
		console.log('[SEED] Migrations may have already been applied, continuing...');
	}

	// 2. Seed data via SQL
	console.log('[SEED] Seeding static data...');
	const sql = seedSql();
	const sqlFile = resolve('/tmp/seed-staging-data.sql');
	writeFileSync(sqlFile, sql, 'utf-8');
	d1File(sqlFile);
	console.log('[SEED] Static data seeded');

	// 3. Ensure admin user
	const token = await ensureAdmin();

	// 4. Start matches
	console.log('[SEED] Starting matches...');
	const assignments = await startMatches(token);

	// 5. Write match assignments for k6
	const outPath = resolve(__dirname, '..', 'load-tests', 'match-assignments.json');
	writeFileSync(outPath, JSON.stringify(assignments, null, 2), 'utf-8');
	console.log(`[SEED] Match assignments written to ${outPath}`);

	console.log('[SEED] Done!');
}

main().catch((e) => {
	console.error('[SEED] Fatal error:', e);
	process.exit(1);
});
