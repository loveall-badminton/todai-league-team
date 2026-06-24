/**
 * Seed the test admin user for E2E tests.
 *
 * This script:
 * 1. Checks if testadmin already exists (via a simple API call)
 * 2. If not, creates the user via better-auth sign-up API
 * 3. Promotes the user to admin role via wrangler d1 execute
 *
 * Usage: npx tsx e2e/seed-admin.ts
 */

const ADMIN = { accountId: 'testadmin', password: 'TestAdmin123', name: 'Test Admin' };
const BASE = 'http://localhost:4173';
const EMAIL = `${ADMIN.accountId}@accounts.local`;

async function seed() {
	// Step 1: Try sign-up
	console.log(`[SEED] Creating user "${ADMIN.accountId}"...`);
	const signupResp = await fetch(`${BASE}/api/auth/sign-up/email`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: EMAIL,
			password: ADMIN.password,
			name: ADMIN.name,
			username: ADMIN.accountId,
			data: { displayUsername: ADMIN.accountId }
		})
	});
	const signupBody = await signupResp.json();

	if (!signupResp.ok && signupBody?.status === 422) {
		console.log(`[SEED] User "${ADMIN.accountId}" already exists. Checking role...`);
	} else if (!signupResp.ok) {
		console.error(`[SEED] Sign-up failed:`, JSON.stringify(signupBody, null, 2));
		process.exit(1);
	} else {
		console.log(`[SEED] User created via sign-up. User ID: ${signupBody.user?.id}`);
	}

	// Step 2: Promote to admin
	// The user was created with role 'user', we need to change it to 'admin'.
	// We use wrangler d1 execute to run a raw SQL update.
	console.log(`[SEED] Promoting user to admin role...`);

	const execResult = await execCommand(
		`npx wrangler d1 execute todai-league --command "UPDATE user SET role = 'admin' WHERE username = '${ADMIN.accountId}';" --remote=false`
	);
	console.log(`[SEED] ${execResult}`);

	// Also create the auth profile if not exists
	const profileResult = await execCommand(
		`npx wrangler d1 execute todai-league --command "INSERT OR IGNORE INTO auth_user_profile (user_id, account_type, team_id, display_name, created_at, updated_at) SELECT id, 'admin', NULL, '${ADMIN.name}', datetime('now'), datetime('now') FROM user WHERE username = '${ADMIN.accountId}';" --remote=false`
	);
	console.log(`[SEED] ${profileResult}`);

	console.log(`[SEED] Done. User "${ADMIN.accountId}" is ready for E2E tests.`);
}

async function execCommand(cmd: string): Promise<string> {
	const { execSync } = await import('child_process');
	try {
		return execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
	} catch (e: unknown) {
		const err = e as { stdout?: string; stderr?: string; message?: string };
		return err.stdout || err.stderr || err.message || String(e);
	}
}

seed().catch((e) => {
	console.error(e);
	process.exit(1);
});
