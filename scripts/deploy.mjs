import { spawn } from 'node:child_process';
import { readFile, writeFile, rename, unlink, stat, chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HELP = `Usage: node scripts/deploy.mjs [--target prod|staging] [--help]

Deploys the Worker to the requested environment with safe ordering:

  preflight -> build -> ensure D1 binding -> apply migrations -> deploy Worker
  -> ensure secrets -> final deploy only if a new secret was created.

First deployment:
  If the target wrangler config omits database_id, the script checks whether the
  remote D1 database (todai-league or todai-league-staging) already exists.
  - If it does not exist, the database is created, its ID is fetched from
    Cloudflare, and the ID is written back to the target wrangler config.
    Commit the updated config file.
  - If it already exists, deployment stops with an error: you must manually add
    the existing database_id to the target wrangler config.

Existing deployment:
  If database_id is already set, no D1 provisioning is performed.`;

export const TARGETS = {
	prod: {
		config: 'wrangler.jsonc',
		databaseName: 'todai-league'
	},
	staging: {
		config: 'wrangler.staging.jsonc',
		databaseName: 'todai-league-staging'
	}
};

/**
 * Spawn a command with argument-array only and capture output.
 * Always resolves; callers inspect ".ok".
 */
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

function parseArgs(argv) {
	let target = 'prod';

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];

		if (arg === '--help' || arg === '-h') {
			console.log(HELP);
			process.exit(0);
		}

		if (arg === '--target') {
			const value = argv[i + 1];
			if (!value || value.startsWith('-')) {
				console.error('Missing value for --target');
				console.error(`\n${HELP}`);
				process.exit(1);
			}
			target = value;
			i += 1;
			continue;
		}

		if (arg.startsWith('--target=')) {
			target = arg.slice('--target='.length);
			if (!target) {
				console.error('Missing value for --target');
				console.error(`\n${HELP}`);
				process.exit(1);
			}
			continue;
		}

		console.error(`Unknown argument: ${arg}`);
		console.error(`\n${HELP}`);
		process.exit(1);
	}

	return { target };
}

/**
 * Minimal JSONC comment stripper. Preserves string contents.
 */
export function stripJsonComments(text) {
	let result = '';
	let inString = false;
	let escape = false;
	let inLineComment = false;
	let inBlockComment = false;

	for (let i = 0; i < text.length; i += 1) {
		const c = text[i];
		const next = text[i + 1];

		if (inLineComment) {
			if (c === '\n') {
				inLineComment = false;
				result += c;
			}
			continue;
		}

		if (inBlockComment) {
			if (c === '*' && next === '/') {
				inBlockComment = false;
				i += 1;
			}
			continue;
		}

		if (inString) {
			if (escape) {
				escape = false;
			} else if (c === '\\') {
				escape = true;
			} else if (c === '"') {
				inString = false;
			}
			result += c;
			continue;
		}

		if (c === '"') {
			inString = true;
			result += c;
			continue;
		}

		if (c === '/' && next === '/') {
			inLineComment = true;
			i += 1;
			continue;
		}

		if (c === '/' && next === '*') {
			inBlockComment = true;
			i += 1;
			continue;
		}

		result += c;
	}

	return result;
}

export function parseJsonc(text) {
	return JSON.parse(stripJsonComments(text));
}

export function validateD1Entry(parsed, databaseName, options = {}) {
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error('Wrangler config is not a JSON object');
	}

	const databases = parsed.d1_databases;
	if (!Array.isArray(databases)) {
		throw new Error('Wrangler config is missing d1_databases array');
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
	if (entry.database_name !== databaseName) {
		throw new Error(
			`Expected d1_databases[0].database_name to be "${databaseName}", got ${JSON.stringify(entry.database_name)}`
		);
	}

	if (options.expectedId !== undefined && entry.database_id !== options.expectedId) {
		throw new Error(
			`Expected d1_databases[0].database_id to be "${options.expectedId}", got ${JSON.stringify(entry.database_id)}`
		);
	}

	if (!options.allowMissingId && entry.database_id === undefined) {
		throw new Error('d1_databases[0].database_id is missing');
	}

	if (entry.database_id !== undefined && typeof entry.database_id !== 'string') {
		throw new Error('d1_databases[0].database_id must be a string');
	}
}

/**
 * Read the target D1 state from wrangler config text.
 */
export function readD1ConfigState(configText, databaseName) {
	const parsed = parseJsonc(configText);
	validateD1Entry(parsed, databaseName, { allowMissingId: true });
	const entry = parsed.d1_databases[0];
	return {
		hasDatabaseId: typeof entry.database_id === 'string',
		databaseId: entry.database_id
	};
}

function escapeRegex(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Insert database_id into the first d1_databases entry using a narrowly scoped
 * JSONC text replacement. Preserves surrounding formatting and comments.
 */
export function setD1DatabaseId(configText, databaseName, databaseId) {
	const parsed = parseJsonc(configText);
	validateD1Entry(parsed, databaseName, { allowMissingId: true });

	if (parsed.d1_databases[0].database_id === databaseId) {
		return configText;
	}

	if (parsed.d1_databases[0].database_id !== undefined) {
		throw new Error(
			`d1_databases[0].database_id already exists with a different value: ${parsed.d1_databases[0].database_id}`
		);
	}

	const escapedName = escapeRegex(databaseName);
	const lineRegex = new RegExp(
		`^(\\s*)("database_name"\\s*:\\s*"${escapedName}"\\s*,?\\s*(?://[^\\n]*)?)$`,
		'm'
	);
	const match = configText.match(lineRegex);
	if (!match) {
		throw new Error(`Could not locate "database_name": "${databaseName}" line for editing`);
	}

	const indent = match[1];
	const updated = configText.replace(lineRegex, `$1$2\n${indent}"database_id": "${databaseId}",`);

	const reparsed = parseJsonc(updated);
	validateD1Entry(reparsed, databaseName, { expectedId: databaseId });

	return updated;
}

/**
 * Write a config file atomically: write to a unique temp file in the same
 * directory, preserve the original file mode, then rename into place.
 * Cleans up the temp file on any failure.
 */
export async function writeConfigAtomically(filePath, content) {
	const dir = path.dirname(filePath);
	const tmpName = `.${path.basename(filePath)}.tmp-${randomBytes(8).toString('hex')}`;
	const tmpPath = path.join(dir, tmpName);
	let originalMode;
	try {
		originalMode = (await stat(filePath)).mode;
	} catch {
		// original file may not exist; proceed without preserving mode
	}
	try {
		await writeFile(tmpPath, content, 'utf8');
		if (originalMode !== undefined) {
			await chmod(tmpPath, originalMode);
		}
		await rename(tmpPath, filePath);
	} catch (error) {
		try {
			await unlink(tmpPath);
		} catch {
			// ignore cleanup errors
		}
		throw error;
	}
}

/**
 * Parse `wrangler d1 list --json` output and return the uuid for databaseName,
 * or null if absent.
 */
export function parseDatabaseListForId(stdout, databaseName) {
	const trimmed = stdout.trim();
	if (!trimmed) return null;
	let parsed;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		throw new Error('Could not parse wrangler d1 list --json output as JSON');
	}
	if (!Array.isArray(parsed)) {
		throw new Error('wrangler d1 list --json did not return an array');
	}
	const match = parsed.find((db) => db && typeof db === 'object' && db.name === databaseName);
	if (!match) return null;
	if (typeof match.uuid !== 'string') {
		throw new Error(`Database list entry for "${databaseName}" is missing uuid`);
	}
	return match.uuid;
}

/**
 * Parse `wrangler d1 info <name> --json` output and return the uuid.
 */
export function parseDatabaseInfoUuid(stdout) {
	const trimmed = stdout.trim();
	if (!trimmed) return null;
	let parsed;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		throw new Error('Could not parse wrangler d1 info --json output as JSON');
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('wrangler d1 info --json did not return an object');
	}
	if (typeof parsed.uuid !== 'string') {
		throw new Error('wrangler d1 info --json output is missing uuid');
	}
	return parsed.uuid;
}

function secretWasCreated(result) {
	return result.stdout.includes(' created');
}

function logOutput(result) {
	if (result.stdout) console.log(result.stdout.trim());
	if (result.stderr) console.log(result.stderr.trim());
}

async function applyMigrations(databaseName, config) {
	console.log(`Applying D1 migrations to ${databaseName}...`);
	return run('pnpm', [
		'exec',
		'wrangler',
		'd1',
		'migrations',
		'apply',
		databaseName,
		'--config',
		config,
		'--remote'
	]);
}

async function deployWorker(config) {
	console.log('Deploying Worker...');
	return run('pnpm', ['exec', 'wrangler', 'deploy', '--config', config]);
}

async function ensureSecrets(config) {
	console.log('Ensuring Worker secrets...');
	return run('node', ['scripts/ensure-cloudflare-secrets.mjs', '--config', config]);
}

async function runPreflight(target) {
	console.log('Running preflight checks...');
	const result = await run('pnpm', ['run', 'preflight', '--', '--target', target]);
	if (!result.ok) {
		logOutput(result);
		throw new Error('Preflight checks failed');
	}
	logOutput(result);
}

async function runBuild() {
	console.log('Building...');
	const result = await run('pnpm', ['run', 'build']);
	if (!result.ok) {
		logOutput(result);
		throw new Error('Build failed');
	}
	logOutput(result);
}

function existingDatabaseRecoveryError(databaseName, config, existingId) {
	return new Error(
		`D1 database "${databaseName}" already exists (uuid: ${existingId}) but database_id is missing from ${config}.\n\n` +
			`Record the database ID in ${config} before deploying. Recovery options:\n` +
			`  1. Cloudflare dashboard: https://dash.cloudflare.com/ → Workers & Pages → D1 → ${databaseName} → copy the database ID\n` +
			`  2. CLI: pnpm exec wrangler d1 info ${databaseName} --json\n\n` +
			`Then add this field inside d1_databases[0] in ${config}:\n` +
			`  "database_id": "${existingId}"\n\n` +
			`Commit the updated config file.`
	);
}

const defaultProvisionDeps = {
	readFile: (file, encoding) => readFile(file, encoding),
	run,
	writeConfigAtomically
};

export async function provisionD1(target, deps = defaultProvisionDeps) {
	const { config, databaseName } = TARGETS[target];
	const configText = await deps.readFile(config, 'utf8');
	const state = readD1ConfigState(configText, databaseName);

	if (state.hasDatabaseId) {
		console.log(`D1 database_id already configured (${state.databaseId}); skipping provisioning.`);
		return { created: false, databaseId: state.databaseId };
	}

	console.log(`Config lacks database_id. Checking remote D1 database "${databaseName}"...`);
	const listResult = await deps.run('pnpm', ['exec', 'wrangler', 'd1', 'list', '--json']);
	if (!listResult.ok) {
		logOutput(listResult);
		throw new Error('Failed to list D1 databases');
	}

	const existingId = parseDatabaseListForId(listResult.stdout, databaseName);
	if (existingId) {
		throw existingDatabaseRecoveryError(databaseName, config, existingId);
	}

	console.log(`Remote D1 database "${databaseName}" not found. Creating...`);
	const createResult = await deps.run('pnpm', ['exec', 'wrangler', 'd1', 'create', databaseName]);
	if (!createResult.ok) {
		logOutput(createResult);
		throw new Error(`Failed to create D1 database "${databaseName}"`);
	}
	logOutput(createResult);

	console.log(`Fetching database ID for "${databaseName}"...`);
	const infoResult = await deps.run('pnpm', [
		'exec',
		'wrangler',
		'd1',
		'info',
		databaseName,
		'--json'
	]);
	if (!infoResult.ok) {
		logOutput(infoResult);
		throw new Error(`Failed to fetch info for D1 database "${databaseName}"`);
	}

	const databaseId = parseDatabaseInfoUuid(infoResult.stdout);
	if (!databaseId) {
		logOutput(infoResult);
		throw new Error('Could not parse database ID from wrangler d1 info --json output');
	}

	console.log(`Recording database_id ${databaseId} in ${config}...`);
	const updatedConfigText = setD1DatabaseId(configText, databaseName, databaseId);
	await deps.writeConfigAtomically(config, updatedConfigText);

	console.warn(
		`[BOOTSTRAP] Created D1 database "${databaseName}" and recorded its ID in ${config}. Commit this change.`
	);

	return { created: true, databaseId };
}

const defaultDeployDeps = {
	runPreflight: (target) => runPreflight(target),
	runBuild: () => runBuild(),
	provisionD1: (target) => provisionD1(target),
	applyMigrations,
	deployWorker,
	ensureSecrets,
	secretWasCreated
};

export async function runDeploy(target, deps = defaultDeployDeps) {
	console.log(`Deployment target: ${target}`);

	await deps.runPreflight(target);
	await deps.runBuild();

	await deps.provisionD1(target);

	const { config, databaseName } = TARGETS[target];

	const migration = await deps.applyMigrations(databaseName, config);
	if (!migration.ok) {
		logOutput(migration);
		throw new Error('Migration failed');
	}
	logOutput(migration);

	const deploy = await deps.deployWorker(config);
	if (!deploy.ok) {
		logOutput(deploy);
		throw new Error('Worker deploy failed');
	}
	logOutput(deploy);

	const secrets = await deps.ensureSecrets(config);
	if (!secrets.ok) {
		logOutput(secrets);
		throw new Error('Secret provisioning failed');
	}
	logOutput(secrets);

	if (deps.secretWasCreated(secrets)) {
		console.log('A new secret was created; performing final Worker deploy...');
		const finalDeploy = await deps.deployWorker(config);
		if (!finalDeploy.ok) {
			logOutput(finalDeploy);
			throw new Error('Final Worker deploy failed');
		}
		logOutput(finalDeploy);
	} else {
		console.log('No new secrets created; skipping final redeploy.');
	}

	console.log(`Deployment to ${target} complete.`);
}

async function main() {
	const { target } = parseArgs(process.argv.slice(2));

	if (!TARGETS[target]) {
		console.error(`Unknown target: ${target}`);
		console.error(`\n${HELP}`);
		process.exit(1);
	}

	await runDeploy(target);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(`[ERROR] ${error.message}`);
		process.exit(1);
	});
}
