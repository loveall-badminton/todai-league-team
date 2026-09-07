import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseJsonc } from './deploy.mjs';
import { ensureCloudflareSecrets } from './ensure-cloudflare-secrets.mjs';

const HELP = `Usage: node scripts/deploy-button.mjs [--help]

Browser-first initial deployment for Cloudflare's "Deploy to Cloudflare" button.

This script is intended to run inside a Workers Builds environment after the
button has provisioned a fresh D1 database and Durable Objects. It performs:

  1. Verify wrangler.jsonc exists, has the expected D1 binding (DB -> todai-league)
     and d1_databases[0].database_id is omitted (button must provision the binding)
  2. Apply D1 migrations to the fixed database name (todai-league)
  3. Deploy the Worker
  4. Ensure BETTER_AUTH_SECRET exists (create if absent)
  5. Re-deploy only if a new secret was created

It does NOT provision D1, attach an arbitrary pre-existing database, or write
config files. It expects resources that were provisioned by the Deploy to
Cloudflare button. The d1_databases[0] entry must not contain a database_id;
a configured database_id (even a valid UUID) is rejected so the script cannot
attach an arbitrary existing D1 to this isolated environment.

For the developer CLI bootstrap path, use "pnpm run deploy" instead.

If D1 migration or secret creation fails, recover through the Cloudflare
dashboard (see README/docs). Do not run terminal commands inside the button
environment.`;

const CONFIG_PATH = 'wrangler.jsonc';
const DATABASE_BINDING = 'DB';
const DATABASE_NAME = 'todai-league';

function run(command, args, options = {}) {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			stdio: options.input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
			env: process.env
		});

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (chunk) => {
			stdout += chunk;
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk;
		});

		child.on('error', (error) => {
			resolve({ ok: false, code: -1, stdout, stderr, error });
		});
		child.on('close', (code) => {
			resolve({ ok: code === 0, code: code ?? -1, stdout, stderr });
		});

		if (options.input) {
			child.stdin.end(options.input);
		}
	});
}

function logOutput(result) {
	if (result.stdout) console.log(result.stdout.trim());
	if (result.stderr) console.log(result.stderr.trim());
}

export async function assertConfigExists(deps) {
	try {
		await deps.stat(CONFIG_PATH);
	} catch {
		throw new Error(
			`${CONFIG_PATH} not found. This script is only for an already-provisioned Deploy to Cloudflare environment.`
		);
	}
}

export function validateButtonD1Binding(configText) {
	let parsed;
	try {
		parsed = parseJsonc(configText);
	} catch (cause) {
		throw new Error(`Could not parse ${CONFIG_PATH} as JSONC: ${cause.message}`, { cause });
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error(`${CONFIG_PATH} is not a JSON object`);
	}

	const databases = parsed.d1_databases;
	if (!Array.isArray(databases)) {
		throw new Error(`${CONFIG_PATH} is missing d1_databases array`);
	}
	if (databases.length !== 1) {
		throw new Error(`Expected exactly one d1_databases entry, found ${databases.length}`);
	}

	const entry = databases[0];
	if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
		throw new Error('d1_databases[0] is not an object');
	}
	if (entry.binding !== DATABASE_BINDING) {
		throw new Error(
			`Expected d1_databases[0].binding to be "${DATABASE_BINDING}", got ${JSON.stringify(entry.binding)}`
		);
	}
	if (entry.database_name !== DATABASE_NAME) {
		throw new Error(
			`Expected d1_databases[0].database_name to be "${DATABASE_NAME}", got ${JSON.stringify(entry.database_name)}`
		);
	}

	if (entry.database_id !== undefined) {
		throw new Error(
			`d1_databases[0].database_id must be omitted in ${CONFIG_PATH} for the Deploy to Cloudflare ` +
				'button path. This script can only operate with the binding provisioned by the button ' +
				`itself and must not attach an arbitrary existing D1 database.\n\n` +
				'Dashboard recovery (browser-only — do not run terminal commands):\n' +
				`1. Open https://dash.cloudflare.com/ → Workers & Pages → D1 → "${DATABASE_NAME}".\n` +
				`2. In your Git provider's Web UI, remove the "database_id" field from ` +
				`d1_databases[0] in ${CONFIG_PATH}.\n` +
				'3. Commit the change on the branch Workers Builds is watching and trigger a new ' +
				'deploy from the Cloudflare dashboard.'
		);
	}

	return undefined;
}

export async function applyMigrations(deps) {
	console.log(`Applying D1 migrations to database "${DATABASE_NAME}"...`);
	const result = await deps.run('pnpm', [
		'exec',
		'wrangler',
		'd1',
		'migrations',
		'apply',
		DATABASE_NAME,
		'--remote',
		'--config',
		CONFIG_PATH
	]);
	if (!result.ok) {
		logOutput(result);
		throw new Error(
			'D1 migration failed. The Deploy to Cloudflare button should have provisioned a D1 database ' +
				`named "${DATABASE_NAME}" bound as "${DATABASE_BINDING}".\n\n` +
				'Dashboard recovery (browser-only — do not run terminal commands):\n' +
				'1. Open https://dash.cloudflare.com/ → Workers & Pages → D1 → todai-league\n' +
				'2. Verify the database exists and the binding is provisioned; trigger a new deploy ' +
				'from the dashboard once any blocker is resolved.\n' +
				'3. If the configuration drift includes an unexpected database_id, remove it from ' +
				"wrangler.jsonc via your Git provider's Web UI and commit.\n\n" +
				'Do not run terminal commands inside the button environment.'
		);
	}
	logOutput(result);
}

export async function deployWorker(deps) {
	console.log('Deploying Worker...');
	const result = await deps.run('pnpm', ['exec', 'wrangler', 'deploy', '--config', CONFIG_PATH]);
	if (!result.ok) {
		logOutput(result);
		throw new Error('Worker deploy failed');
	}
	logOutput(result);
	return result;
}

const defaultDeps = {
	readFile: (path, encoding) => readFile(path, encoding),
	stat: (path) => stat(path),
	run,
	ensureCloudflareSecrets: (config) => ensureCloudflareSecrets(config)
};

export async function runDeployButton(deps = defaultDeps) {
	await assertConfigExists(deps);

	const configText = await deps.readFile(CONFIG_PATH, 'utf8');
	validateButtonD1Binding(configText);

	console.log(
		`Verified D1 binding ${DATABASE_BINDING} -> ${DATABASE_NAME} (database_id omitted; ` +
			'expected to be provisioned by the Deploy to Cloudflare button)'
	);
	console.log(
		'Running browser-first initial deploy for an isolated environment. No existing database will be attached.'
	);

	await applyMigrations(deps);
	await deployWorker(deps);

	let secretsResult;
	try {
		secretsResult = await deps.ensureCloudflareSecrets(CONFIG_PATH);
	} catch (error) {
		throw new Error(
			`Could not ensure BETTER_AUTH_SECRET: ${error instanceof Error ? error.message : String(error)}\n\n` +
				'Recover through the Cloudflare dashboard:\n' +
				'1. Open https://dash.cloudflare.com/ → Workers & Pages → your Worker → Secrets\n' +
				'2. Add a secret named BETTER_AUTH_SECRET with a strong random value generated safely\n' +
				'3. Trigger a new deploy from the dashboard.\n\n' +
				'Do not run terminal commands inside the button environment.',
			{ cause: error }
		);
	}

	const createdBetterAuth = secretsResult.created.has('BETTER_AUTH_SECRET');

	if (createdBetterAuth) {
		console.log('BETTER_AUTH_SECRET was created safely; performing final Worker deploy...');
		await deployWorker(deps);
	} else {
		console.log('BETTER_AUTH_SECRET already exists; skipping final redeploy.');
	}

	console.log('Initial deploy complete.');
}

async function main() {
	for (const arg of process.argv.slice(2)) {
		if (arg === '--help' || arg === '-h') {
			console.log(HELP);
			process.exit(0);
		}
		console.error(`Unknown argument: ${arg}`);
		console.error(`\n${HELP}`);
		process.exit(1);
	}

	await runDeployButton();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(`[ERROR] ${error.message}`);
		process.exit(1);
	});
}
