import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
	applyMigrations,
	assertConfigExists,
	deployWorker,
	readDatabaseId,
	runDeployWorkersBuilds
} from './deploy-workers-builds.mjs';

const VALID_UUID = '11111111-1111-1111-1111-111111111111';

function buildConfig(
	overrides: { databaseId?: string; databaseName?: string; binding?: string } = {}
) {
	const databaseId = overrides.databaseId === undefined ? `"database_id": "${VALID_UUID}",` : '';
	const databaseName = overrides.databaseName ?? 'todai-league';
	const binding = overrides.binding ?? 'DB';
	return `{
	"$schema": "./node_modules/wrangler/config-schema.json",
	"name": "todai-league",
	"d1_databases": [
		{
			"binding": "${binding}",
			"database_name": "${databaseName}",
			${databaseId}
			"migrations_dir": "drizzle"
		}
	]
}
`;
}

type RunResult = { ok: boolean; stdout: string; stderr: string; code: number };

function buildDeps(overrides?: {
	configExists?: boolean;
	configText?: string;
	migrationResult?: RunResult;
	deployResult?: RunResult;
}) {
	const calls: Array<{ command: string; args: string[] }> = [];

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
			return (
				overrides?.deployResult ?? {
					ok: true,
					stdout: 'Deployed',
					stderr: '',
					code: 0
				}
			);
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

	return { deps: { run, stat, readFile }, calls };
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
			/wrangler\.jsonc not found\. This script is only for an already-provisioned environment\./
		);
	});
});

describe('readDatabaseId', () => {
	test('returns database_id for valid config', () => {
		expect(readDatabaseId(buildConfig())).toBe(VALID_UUID);
	});

	test('throws when database_id is missing', () => {
		expect(() => readDatabaseId(buildConfig({ databaseId: '' }))).toThrow(
			/d1_databases\[0\]\.database_id must be a valid UUID/
		);
	});

	test('throws when database_id is not a valid UUID shape', () => {
		const config = buildConfig().replace(VALID_UUID, 'not-a-uuid');
		expect(() => readDatabaseId(config)).toThrow(
			/d1_databases\[0\]\.database_id must be a valid UUID/
		);
	});

	test('throws when database_name is not todai-league', () => {
		expect(() => readDatabaseId(buildConfig({ databaseName: 'wrong-db' }))).toThrow(
			/Expected d1_databases\[0\]\.database_name to be "todai-league"/
		);
	});

	test('throws when binding is not DB', () => {
		expect(() => readDatabaseId(buildConfig({ binding: 'WRONG' }))).toThrow(
			/Expected d1_databases\[0\]\.binding to be "DB"/
		);
	});

	test('throws when config is not valid JSONC', () => {
		expect(() => readDatabaseId('{ invalid json')).toThrow(
			/Could not parse wrangler\.jsonc as JSONC/
		);
	});
});

describe('applyMigrations', () => {
	test('runs migration command and throws on failure', async () => {
		const { deps } = buildDeps({
			migrationResult: { ok: false, stdout: '', stderr: 'migration error', code: 1 }
		});

		await expect(applyMigrations(deps)).rejects.toThrow(/D1 migration failed/);
		expect(deps.run).toHaveBeenCalledWith('pnpm', [
			'exec',
			'wrangler',
			'd1',
			'migrations',
			'apply',
			'todai-league',
			'--config',
			'wrangler.jsonc',
			'--remote'
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

function commandName(args: string[]): string {
	if (args[2] === 'd1' && args[3] === 'migrations') return 'migrations';
	if (args[2] === 'deploy') return 'deploy';
	return args[0] ?? 'unknown';
}

describe('runDeployWorkersBuilds', () => {
	let consoleLogSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	test('runs migration then deploy in order when config is valid', async () => {
		const { deps, calls } = buildDeps();

		await runDeployWorkersBuilds(deps);

		expect(calls.map((c) => commandName(c.args))).toEqual(['migrations', 'deploy']);
		expect(deps.run).toHaveBeenCalledTimes(2);
		expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Deploy complete.'));
	});

	test('does not run any commands when config file is missing', async () => {
		const { deps } = buildDeps({ configExists: false });

		await expect(runDeployWorkersBuilds(deps)).rejects.toThrow(
			/wrangler\.jsonc not found\. This script is only for an already-provisioned environment\./
		);
		expect(deps.run).not.toHaveBeenCalled();
	});

	test('does not run any commands when database_id is missing', async () => {
		const { deps } = buildDeps({ configText: buildConfig({ databaseId: '' }) });

		await expect(runDeployWorkersBuilds(deps)).rejects.toThrow(
			/d1_databases\[0\]\.database_id must be a valid UUID/
		);
		expect(deps.run).not.toHaveBeenCalled();
	});

	test('does not run deploy when migration fails', async () => {
		const { deps, calls } = buildDeps({
			migrationResult: { ok: false, stdout: '', stderr: 'migration error', code: 1 }
		});

		await expect(runDeployWorkersBuilds(deps)).rejects.toThrow(/D1 migration failed/);
		expect(calls.map((c) => commandName(c.args))).toEqual(['migrations']);
		expect(deps.run).toHaveBeenCalledTimes(1);
	});

	test('returns nonzero when deploy fails', async () => {
		const { deps, calls } = buildDeps({
			deployResult: { ok: false, stdout: '', stderr: 'deploy error', code: 1 }
		});

		await expect(runDeployWorkersBuilds(deps)).rejects.toThrow(/Worker deploy failed/);
		expect(calls.map((c) => commandName(c.args))).toEqual(['migrations', 'deploy']);
		expect(deps.run).toHaveBeenCalledTimes(2);
	});
});
