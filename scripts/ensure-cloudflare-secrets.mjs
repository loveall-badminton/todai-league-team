import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

const REQUIRED_SECRETS = ['BETTER_AUTH_SECRET'];
const DEFAULT_WRANGLER_CONFIG = 'wrangler.jsonc';

const HELP = `Usage: node scripts/ensure-cloudflare-secrets.mjs [--config <wrangler-config>]

Ensures required Cloudflare Worker secrets exist. Creates missing secrets safely
without printing their values. Defaults to --config ${DEFAULT_WRANGLER_CONFIG}.`;

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
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
		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) {
				resolve({ stdout, stderr });
			} else {
				const message = stderr.trim() || stdout.trim() || `${command} ${args.join(' ')} failed`;
				reject(new Error(message));
			}
		});

		if (options.input) {
			child.stdin.end(options.input);
		}
	});
}

function parseArgs(argv) {
	let config = DEFAULT_WRANGLER_CONFIG;
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--help' || arg === '-h') {
			console.log(HELP);
			process.exit(0);
		}
		if (arg === '--config') {
			const value = argv[i + 1];
			if (!value || value.startsWith('-')) {
				console.error('Missing value for --config');
				console.error(`\n${HELP}`);
				process.exit(1);
			}
			config = value;
			i += 1;
			continue;
		}
		if (arg.startsWith('--config=')) {
			config = arg.slice('--config='.length);
			if (!config) {
				console.error('Missing value for --config');
				console.error(`\n${HELP}`);
				process.exit(1);
			}
			continue;
		}
		console.error(`Unknown argument: ${arg}`);
		console.error(`\n${HELP}`);
		process.exit(1);
	}
	return { config };
}

async function listSecretNames(wranglerConfig) {
	const { stdout } = await run('pnpm', [
		'exec',
		'wrangler',
		'secret',
		'list',
		'--config',
		wranglerConfig,
		'--format',
		'json'
	]);
	const secrets = JSON.parse(stdout);
	if (!Array.isArray(secrets)) {
		throw new Error('Unexpected wrangler secret list output');
	}
	return new Set(secrets.map((secret) => secret.name).filter(Boolean));
}

async function putSecret(name, value, wranglerConfig) {
	await run('pnpm', ['exec', 'wrangler', 'secret', 'put', name, '--config', wranglerConfig], {
		input: `${value}\n`
	});
}

const { config: WRANGLER_CONFIG } = parseArgs(process.argv.slice(2));

const existingSecretNames = await listSecretNames(WRANGLER_CONFIG);

for (const name of REQUIRED_SECRETS) {
	if (existingSecretNames.has(name)) {
		console.log(`${name} already exists`);
		continue;
	}

	const value = randomBytes(32).toString('base64url');
	await putSecret(name, value, WRANGLER_CONFIG);
	console.log(`${name} created`);
}
