import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseJsonc } from './deploy.mjs';

const HELP = `Usage: node scripts/deploy-workers-builds.mjs [--help]

No-terminal production deployment for Cloudflare Workers Builds.

Prerequisites (one-time, already provisioned environment only):
  - wrangler.jsonc exists and d1_databases[0] has a valid database_id
  - BETTER_AUTH_SECRET is configured as a Cloudflare dashboard secret
  - Cloudflare Workers Builds is connected to this repository

This script is intended as the Workers Builds Deploy command. It runs:
  1. wrangler d1 migrations apply todai-league --config wrangler.jsonc --remote
  2. wrangler deploy --config wrangler.jsonc

It does NOT build, provision D1, create secrets, or write config files.
`;

const CONFIG_PATH = 'wrangler.jsonc';
const DATABASE_NAME = 'todai-league';

/**
 * Spawn a command with argument-array only and capture output.
 * Always resolves; callers inspect ".ok".
 */
function run(command, args) {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			stdio: ['ignore', 'pipe', 'pipe'],
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
	});
}

function isUuidLike(value) {
	if (typeof value !== 'string') return false;
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function logOutput(result) {
	if (result.stdout) console.log(result.stdout.trim());
	if (result.stderr) console.log(result.stderr.trim());
}

function parseArgs(argv) {
	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') {
			console.log(HELP);
			process.exit(0);
		}
		console.error(`Unknown argument: ${arg}`);
		console.error(`\n${HELP}`);
		process.exit(1);
	}
}

export async function assertConfigExists(deps) {
	try {
		await deps.stat(CONFIG_PATH);
	} catch {
		throw new Error(
			`${CONFIG_PATH} not found. This script is only for an already-provisioned environment.`
		);
	}
}

export function readDatabaseId(configText) {
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
	if (entry.binding !== 'DB') {
		throw new Error(
			`Expected d1_databases[0].binding to be "DB", got ${JSON.stringify(entry.binding)}`
		);
	}
	if (entry.database_name !== DATABASE_NAME) {
		throw new Error(
			`Expected d1_databases[0].database_name to be "${DATABASE_NAME}", got ${JSON.stringify(entry.database_name)}`
		);
	}

	const databaseId = entry.database_id;
	if (typeof databaseId !== 'string' || !isUuidLike(databaseId)) {
		throw new Error(
			`d1_databases[0].database_id must be a valid UUID (e.g. "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx") in ${CONFIG_PATH}.\n\n` +
				`This script only deploys to an already-provisioned environment. ` +
				`Run the initial bootstrap with a privileged developer using "pnpm deploy" first, ` +
				`then commit the resulting ${CONFIG_PATH} with database_id included.`
		);
	}

	return databaseId;
}

export async function applyMigrations(deps) {
	console.log(`Applying D1 migrations to ${DATABASE_NAME}...`);
	const result = await deps.run('pnpm', [
		'exec',
		'wrangler',
		'd1',
		'migrations',
		'apply',
		DATABASE_NAME,
		'--config',
		CONFIG_PATH,
		'--remote'
	]);
	if (!result.ok) {
		logOutput(result);
		throw new Error('D1 migration failed');
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
}

const defaultDeps = {
	readFile: (path, encoding) => readFile(path, encoding),
	stat: (path) => stat(path),
	run
};

export async function runDeployWorkersBuilds(deps = defaultDeps) {
	await assertConfigExists(deps);

	const configText = await deps.readFile(CONFIG_PATH, 'utf8');
	const databaseId = readDatabaseId(configText);

	console.log(`Verified D1 database_id: ${databaseId}`);
	console.log(
		'Running no-terminal deploy for an already-provisioned environment. No D1 provisioning or secret generation will be performed.'
	);

	await applyMigrations(deps);
	await deployWorker(deps);

	console.log('Deploy complete.');
}

async function main() {
	parseArgs(process.argv.slice(2));
	await runDeployWorkersBuilds();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(`[ERROR] ${error.message}`);
		process.exit(1);
	});
}
