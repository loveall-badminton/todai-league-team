import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { TARGETS, parseJsonc, validateD1Entry } from './deploy.mjs';

const HELP = `Usage: node scripts/doctor.mjs [--target prod|staging] [--help]

Environment health check for local development and deploy readiness.
Non-mutating. Prints [OK], [WARN], or [BLOCKER] and exits 1 on blockers.

--target prod|staging   Check the wrangler config for the requested environment (default: prod).`;

function buildChecks(target) {
	return [
		{ name: 'Node.js >= 22', type: 'blocker', run: checkNodeVersion },
		{ name: 'pnpm available', type: 'blocker', run: checkPnpm },
		{ name: 'node_modules installed', type: 'blocker', run: checkNodeModules },
		{ name: 'Wrangler CLI available', type: 'blocker', run: checkWrangler },
		{
			name: `${target} wrangler config exists and has valid D1 entry`,
			type: 'blocker',
			run: () => checkWranglerConfig(target)
		},
		{ name: 'Cloudflare authentication', type: 'blocker', run: checkCloudflareAuth },
		{ name: 'Local Better Auth secret present', type: 'warn', run: checkLocalAuthSecret }
	];
}

function printResult(status, message) {
	console.log(`${status} ${message}`);
}

function run(command, args) {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			stdio: ['ignore', 'pipe', 'pipe']
		});
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk) => {
			stdout += chunk;
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk;
		});
		child.on('error', () => {
			resolve({ ok: false, code: -1, stdout, stderr });
		});
		child.on('close', (code) => {
			resolve({ ok: code === 0, code: code ?? -1, stdout, stderr });
		});
	});
}

async function checkNodeVersion() {
	const major = Number(process.versions.node.split('.')[0]);
	if (Number.isNaN(major) || major < 22) {
		return { ok: false, detail: `found Node ${process.version}, require >= 22` };
	}
	return { ok: true, detail: `Node ${process.version}` };
}

async function checkPnpm() {
	const result = await run('pnpm', ['--version']);
	if (!result.ok) {
		return { ok: false, detail: 'pnpm not found' };
	}
	return { ok: true, detail: `pnpm ${result.stdout.trim()}` };
}

async function checkNodeModules() {
	const root = path.resolve(import.meta.dirname, '..');
	const hasModules = existsSync(path.join(root, 'node_modules'));
	if (!hasModules) {
		return { ok: false, detail: 'node_modules/ not found' };
	}
	return { ok: true, detail: 'node_modules/ exists' };
}

async function checkWrangler() {
	const result = await run('pnpm', ['exec', 'wrangler', '--version']);
	if (!result.ok) {
		return { ok: false, detail: 'wrangler CLI not available' };
	}
	return { ok: true, detail: `wrangler ${result.stdout.trim()}` };
}

async function checkWranglerConfig(target) {
	const { config, databaseName } = TARGETS[target];
	const configPath = path.resolve(import.meta.dirname, '..', config);
	if (!existsSync(configPath)) {
		return { ok: false, detail: `${config} not found` };
	}
	try {
		const text = readFileSync(configPath, 'utf8');
		const parsed = parseJsonc(text);
		validateD1Entry(parsed, databaseName, { allowMissingId: true });
	} catch (error) {
		return { ok: false, detail: `${config} D1 entry invalid: ${error.message}` };
	}
	return {
		ok: true,
		detail: `${config} found with valid D1 entry (database_name: ${databaseName})`
	};
}

async function checkCloudflareAuth() {
	const result = await run('pnpm', ['exec', 'wrangler', 'whoami']);
	if (!result.ok) {
		return { ok: false, detail: 'not authenticated (run wrangler login)' };
	}
	const firstLine = result.stdout.split('\n')[0]?.trim();
	return { ok: true, detail: firstLine || 'authenticated' };
}

async function checkLocalAuthSecret() {
	const root = path.resolve(import.meta.dirname, '..');
	const devVarsPath = path.join(root, '.dev.vars');
	const readValue = (file) => {
		if (!existsSync(file)) return null;
		for (const line of readFileSync(file, 'utf8').split('\n')) {
			const match = line.match(/^\s*BETTER_AUTH_SECRET\s*=\s*(.*?)\s*$/);
			if (match) {
				const value = match[1].replace(/^['"]|['"]$/g, '').trim();
				return value || null;
			}
		}
		return null;
	};
	const devVarsValue = readValue(devVarsPath);
	if (devVarsValue) {
		return { ok: true, detail: 'BETTER_AUTH_SECRET present in .dev.vars' };
	}
	return {
		ok: false,
		detail:
			'BETTER_AUTH_SECRET missing in .dev.vars — `pnpm preview` (wrangler dev) will not work until it is set. `pnpm dev` (Vite only) does not need it.'
	};
}

function parseArgs(argv) {
	let target = 'prod';

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];

		if (arg === '--help' || arg === '-h') {
			return { help: true };
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

		console.error(`Unknown argument: ${arg}\n\n${HELP}`);
		process.exit(1);
	}

	if (!TARGETS[target]) {
		console.error(`Unknown target: ${target}\n\n${HELP}`);
		process.exit(1);
	}

	return { target, help: false };
}

async function main() {
	const { target, help } = parseArgs(process.argv.slice(2));
	if (help) {
		console.log(HELP);
		process.exit(0);
	}

	let blockers = 0;
	let warnings = 0;

	for (const check of buildChecks(target)) {
		const result = await check.run();
		if (result.ok) {
			printResult('[OK]', `${check.name}: ${result.detail}`);
		} else if (check.type === 'warn') {
			printResult('[WARN]', `${check.name}: ${result.detail}`);
			warnings += 1;
		} else {
			printResult('[BLOCKER]', `${check.name}: ${result.detail}`);
			blockers += 1;
		}
	}

	if (blockers > 0) {
		console.log(
			`\n${blockers} blocker(s) found. Fix before deploying or running full local preview.`
		);
		process.exit(1);
	}
	if (warnings > 0) {
		console.log(`\n${warnings} warning(s). Ready for deploy; local preview may need attention.`);
	}
	process.exit(0);
}

main().catch((error) => {
	console.error('[BLOCKER] Unexpected error:', error.message);
	process.exit(1);
});
