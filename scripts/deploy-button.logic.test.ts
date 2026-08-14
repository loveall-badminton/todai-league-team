import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
	applyMigrations,
	assertConfigExists,
	deployWorker,
	runDeployButton,
	validateButtonD1Binding
} from './deploy-button.mjs';

const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const OTHER_VALID_UUID = '99999999-9999-9999-9999-999999999999';

function buildConfig(
	overrides: { databaseId?: string; databaseName?: string; binding?: string } = {}
) {
	const includeDatabaseId = overrides.databaseId !== undefined && overrides.databaseId !== null;
	const databaseIdLine = includeDatabaseId ? `"database_id": "${overrides.databaseId}",` : '';
	const databaseName = overrides.databaseName ?? 'todai-league';
	const binding = overrides.binding ?? 'DB';
	return `{
	"$schema": "./node_modules/wrangler/config-schema.json",
	"name": "todai-league",
	"d1_databases": [
		{
			"binding": "${binding}",
			"database_name": "${databaseName}",
			${databaseIdLine}
			"migrations_dir": "drizzle"
		}
	]
}
`;
}

type RunResult = { ok: boolean; stdout: string; stderr: string; code: number };

type SecretResult = { created: Set<string> };

function buildDeps(overrides?: {
	configExists?: boolean;
	configText?: string;
	migrationResult?: RunResult;
	deployResult?: RunResult | RunResult[];
	secretResult?: SecretResult;
	secretError?: Error;
}) {
	const calls: Array<{ command: string; args: string[] }> = [];

	const deployResults = Array.isArray(overrides?.deployResult)
		? overrides.deployResult
		: overrides?.deployResult
			? [overrides.deployResult]
			: [];
	let deployIndex = 0;

	const run = vi.fn(async (command: string, args: string[]) => {
		calls.push({ command, args });

		const isMigration =
			args[2] === 'd1' &&
			args[3] === 'migrations' &&
			args[4] === 'apply' &&
			args[5] === 'todai-league';
		const isDeploy = args[2] === 'deploy';

		if (isMigration) {
			return (
				overrides?.migrationResult ?? {
					ok: true,
					stdout: 'Applied migration',
					stderr: '',
					code: 0
				}
			);
		}
		if (isDeploy) {
			return deployResults[deployIndex++] ?? { ok: true, stdout: 'Deployed', stderr: '', code: 0 };
		}
		return { ok: false, code: 1, stdout: '', stderr: 'unexpected command' };
	});

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const stat = vi.fn(async (_path: string) => {
		if (overrides?.configExists === false) {
			const error = new Error('ENOENT');
			(error as NodeJS.ErrnoException).code = 'ENOENT';
			throw error;
		}
		return { isFile: () => true };
	});

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const readFile = vi.fn(async (_path: string) => {
		return overrides?.configText ?? buildConfig();
	});

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const ensureCloudflareSecrets = vi.fn(async (_config: string) => {
		if (overrides?.secretError) {
			throw overrides.secretError;
		}
		return overrides?.secretResult ?? { created: new Set<string>() };
	});

	return { deps: { run, stat, readFile, ensureCloudflareSecrets }, calls };
}

function commandName(args: string[]): string {
	if (args[2] === 'd1' && args[3] === 'migrations') return 'migrations';
	if (args[2] === 'deploy') return 'deploy';
	return args[0] ?? 'unknown';
}

describe('assertConfigExists', () => {
	test('resolves when wrangler.jsonc exists', async () => {
		const { deps } = buildDeps({ configExists: true });
		await expect(assertConfigExists(deps)).resolves.toBeUndefined();
		expect(deps.stat).toHaveBeenCalledWith('wrangler.jsonc');
	});

	test('throws actionable error when wrangler.jsonc is missing', async () => {
		const { deps } = buildDeps({ configExists: false });
		await expect(assertConfigExists(deps)).rejects.toThrow(
			/wrangler\.jsonc not found\. This script is only for an already-provisioned Deploy to Cloudflare environment\./
		);
	});
});

describe('validateButtonD1Binding', () => {
	test('returns undefined when database_id is omitted', () => {
		expect(validateButtonD1Binding(buildConfig())).toBeUndefined();
	});

	test('throws with dashboard-only instructions when database_id is present and valid (must be omitted)', () => {
		expect(() => validateButtonD1Binding(buildConfig({ databaseId: VALID_UUID }))).toThrow(
			/d1_databases\[0\]\.database_id must be omitted in wrangler\.jsonc for the Deploy to Cloudflare button path/
		);
		expect(() => validateButtonD1Binding(buildConfig({ databaseId: VALID_UUID }))).toThrow(
			/must not attach an arbitrary existing D1 database/
		);
		expect(() => validateButtonD1Binding(buildConfig({ databaseId: VALID_UUID }))).toThrow(
			/Dashboard recovery \(browser-only — do not run terminal commands\)/
		);
		expect(() => validateButtonD1Binding(buildConfig({ databaseId: VALID_UUID }))).toThrow(
			/https:\/\/dash\.cloudflare\.com\/ → Workers & Pages → D1 → "todai-league"/
		);
	});

	test('rejects arbitrary valid UUID that differs from a button-known id', () => {
		expect(() => validateButtonD1Binding(buildConfig({ databaseId: OTHER_VALID_UUID }))).toThrow(
			/must be omitted/
		);
	});

	test('throws when database_id is present but not a UUID', () => {
		const config = buildConfig({ databaseId: 'not-a-uuid' });
		expect(() => validateButtonD1Binding(config)).toThrow(
			/d1_databases\[0\]\.database_id must be omitted/
		);
	});

	test('throws when database_name is not todai-league', () => {
		expect(() => validateButtonD1Binding(buildConfig({ databaseName: 'wrong-db' }))).toThrow(
			/Expected d1_databases\[0\]\.database_name to be "todai-league"/
		);
	});

	test('throws when binding is not DB', () => {
		expect(() => validateButtonD1Binding(buildConfig({ binding: 'WRONG' }))).toThrow(
			/Expected d1_databases\[0\]\.binding to be "DB"/
		);
	});

	test('throws when config is not valid JSONC', () => {
		expect(() => validateButtonD1Binding('{ invalid json')).toThrow(
			/Could not parse wrangler\.jsonc as JSONC/
		);
	});
});

describe('applyMigrations', () => {
	test('invokes wrangler with the fixed database name "todai-league" and throws with dashboard recovery on failure', async () => {
		const { deps } = buildDeps({
			migrationResult: { ok: false, stdout: '', stderr: 'migration error', code: 1 }
		});

		await expect(applyMigrations(deps)).rejects.toThrow(/D1 migration failed/);
		await expect(applyMigrations(deps)).rejects.toThrow(/Do not run terminal commands/);
		expect(deps.run).toHaveBeenCalledWith('pnpm', [
			'exec',
			'wrangler',
			'd1',
			'migrations',
			'apply',
			'todai-league',
			'--remote',
			'--config',
			'wrangler.jsonc'
		]);
	});
});

describe('deployWorker', () => {
	test('runs deploy command and throws on failure', async () => {
		const { deps } = buildDeps({
			deployResult: { ok: false, stdout: '', stderr: 'deploy error', code: 1 }
		});

		await expect(deployWorker(deps)).rejects.toThrow(/Worker deploy failed/);
		expect(deps.run).toHaveBeenCalledWith('pnpm', [
			'exec',
			'wrangler',
			'deploy',
			'--config',
			'wrangler.jsonc'
		]);
	});
});

describe('runDeployButton', () => {
	let consoleLogSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	test('runs migration, deploy, and secret check in order', async () => {
		const { deps, calls } = buildDeps();

		await runDeployButton(deps);

		expect(calls.map((c) => commandName(c.args))).toEqual(['migrations', 'deploy']);
		expect(deps.run).toHaveBeenCalledTimes(2);
		expect(deps.ensureCloudflareSecrets).toHaveBeenCalledWith('wrangler.jsonc');
		expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Initial deploy complete.'));
	});

	test('accepts missing database_id and still runs all steps', async () => {
		const { deps, calls } = buildDeps();

		await runDeployButton(deps);

		expect(calls.map((c) => commandName(c.args))).toEqual(['migrations', 'deploy']);
		expect(deps.run).toHaveBeenCalledTimes(2);
		expect(deps.ensureCloudflareSecrets).toHaveBeenCalledWith('wrangler.jsonc');
		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringContaining('database_id omitted; expected to be provisioned')
		);
	});

	test('rejects a valid arbitrary UUID and never runs migration, deploy, or secrets', async () => {
		const { deps, calls } = buildDeps({
			configText: buildConfig({ databaseId: OTHER_VALID_UUID })
		});

		await expect(runDeployButton(deps)).rejects.toThrow(
			/d1_databases\[0\]\.database_id must be omitted/
		);
		await expect(runDeployButton(deps)).rejects.toThrow(
			/Dashboard recovery \(browser-only — do not run terminal commands\)/
		);
		expect(calls).toEqual([]);
		expect(deps.run).not.toHaveBeenCalled();
		expect(deps.ensureCloudflareSecrets).not.toHaveBeenCalled();
	});

	test('does not run any commands when config file is missing', async () => {
		const { deps } = buildDeps({ configExists: false });

		await expect(runDeployButton(deps)).rejects.toThrow(
			/wrangler\.jsonc not found\. This script is only for an already-provisioned Deploy to Cloudflare environment\./
		);
		expect(deps.run).not.toHaveBeenCalled();
		expect(deps.ensureCloudflareSecrets).not.toHaveBeenCalled();
	});

	test('does not run any commands when binding is wrong', async () => {
		const { deps } = buildDeps({ configText: buildConfig({ binding: 'WRONG' }) });

		await expect(runDeployButton(deps)).rejects.toThrow(
			/Expected d1_databases\[0\]\.binding to be "DB"/
		);
		expect(deps.run).not.toHaveBeenCalled();
		expect(deps.ensureCloudflareSecrets).not.toHaveBeenCalled();
	});

	test('does not run deploy when migration fails', async () => {
		const { deps, calls } = buildDeps({
			migrationResult: { ok: false, stdout: '', stderr: 'migration error', code: 1 }
		});

		await expect(runDeployButton(deps)).rejects.toThrow(/D1 migration failed/);
		expect(calls.map((c) => commandName(c.args))).toEqual(['migrations']);
		expect(deps.run).toHaveBeenCalledTimes(1);
		expect(deps.ensureCloudflareSecrets).not.toHaveBeenCalled();
	});

	test('does not ensure secrets when deploy fails', async () => {
		const { deps, calls } = buildDeps({
			deployResult: { ok: false, stdout: '', stderr: 'deploy error', code: 1 }
		});

		await expect(runDeployButton(deps)).rejects.toThrow(/Worker deploy failed/);
		expect(calls.map((c) => commandName(c.args))).toEqual(['migrations', 'deploy']);
		expect(deps.run).toHaveBeenCalledTimes(2);
		expect(deps.ensureCloudflareSecrets).not.toHaveBeenCalled();
	});

	test('performs final deploy when BETTER_AUTH_SECRET is created', async () => {
		const { deps, calls } = buildDeps({
			secretResult: { created: new Set(['BETTER_AUTH_SECRET']) }
		});

		await runDeployButton(deps);

		expect(calls.map((c) => commandName(c.args))).toEqual(['migrations', 'deploy', 'deploy']);
		expect(deps.run).toHaveBeenCalledTimes(3);
		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				'BETTER_AUTH_SECRET was created safely; performing final Worker deploy...'
			)
		);
	});

	test('skips final deploy when BETTER_AUTH_SECRET already exists', async () => {
		const { deps, calls } = buildDeps({
			secretResult: { created: new Set<string>() }
		});

		await runDeployButton(deps);

		expect(calls.map((c) => commandName(c.args))).toEqual(['migrations', 'deploy']);
		expect(deps.run).toHaveBeenCalledTimes(2);
		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringContaining('BETTER_AUTH_SECRET already exists; skipping final redeploy.')
		);
	});

	test('throws with dashboard-only instructions when secret provisioning fails', async () => {
		const { deps, calls } = buildDeps({
			secretError: new Error('wrangler secret list failed')
		});

		await expect(runDeployButton(deps)).rejects.toThrow(
			/Could not ensure BETTER_AUTH_SECRET: wrangler secret list failed[\s\S]*Do not run terminal commands/
		);
		expect(calls.map((c) => commandName(c.args))).toEqual(['migrations', 'deploy']);
		expect(deps.run).toHaveBeenCalledTimes(2);
	});

	test('throws when final deploy fails after creating secret', async () => {
		const { deps, calls } = buildDeps({
			secretResult: { created: new Set(['BETTER_AUTH_SECRET']) },
			deployResult: [
				{ ok: true, stdout: 'Deployed', stderr: '', code: 0 },
				{ ok: false, stdout: '', stderr: 'final deploy error', code: 1 }
			]
		});

		await expect(runDeployButton(deps)).rejects.toThrow(/Worker deploy failed/);
		expect(calls.map((c) => commandName(c.args))).toEqual(['migrations', 'deploy', 'deploy']);
		expect(deps.run).toHaveBeenCalledTimes(3);
	});
});
