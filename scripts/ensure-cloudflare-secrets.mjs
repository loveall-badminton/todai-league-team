import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

const REQUIRED_SECRETS = ['BETTER_AUTH_SECRET'];
const WRANGLER_CONFIG = 'wrangler.jsonc';

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

async function listSecretNames() {
	const { stdout } = await run('wrangler', [
		'secret',
		'list',
		'--config',
		WRANGLER_CONFIG,
		'--format',
		'json'
	]);
	const secrets = JSON.parse(stdout);
	if (!Array.isArray(secrets)) {
		throw new Error('Unexpected wrangler secret list output');
	}
	return new Set(secrets.map((secret) => secret.name).filter(Boolean));
}

async function putSecret(name, value) {
	await run('wrangler', ['secret', 'put', name, '--config', WRANGLER_CONFIG], {
		input: `${value}\n`
	});
}

const existingSecretNames = await listSecretNames();

for (const name of REQUIRED_SECRETS) {
	if (existingSecretNames.has(name)) {
		console.log(`${name} already exists`);
		continue;
	}

	const value = randomBytes(32).toString('base64url');
	await putSecret(name, value);
	console.log(`${name} created`);
}
