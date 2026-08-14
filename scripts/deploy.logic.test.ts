import { beforeEach, describe, expect, test, vi } from 'vitest';
import { provisionD1, runDeploy, TARGETS } from './deploy.mjs';

const STAGING_CONFIG_PATH = TARGETS.staging.config;
const PROD_CONFIG_PATH = TARGETS.prod.config;

const STAGING_DATABASE_NAME = TARGETS.staging.databaseName;
const PROD_DATABASE_NAME = TARGETS.prod.databaseName;

const STAGING_BASE_CONFIG = `{
	// staging D1 binding (database_id populated by scripts/deploy.mjs)
	"$schema": "./node_modules/wrangler/config-schema.json",
	"name": "todai-league-staging",
	"d1_databases": [
		{
			"binding": "DB",
			"database_name": "${STAGING_DATABASE_NAME}",
			"migrations_dir": "drizzle"
		}
	]
}
`;

const STAGING_WITH_ID_CONFIG = `{
	"$schema": "./node_modules/wrangler/config-schema.json",
	"name": "todai-league-staging",
	"d1_databases": [
		{
			"binding": "DB",
			"database_name": "${STAGING_DATABASE_NAME}",
			"database_id": "11111111-1111-1111-1111-111111111111",
			"migrations_dir": "drizzle"
		}
	]
}
`;

function buildProvisionDeps(overrides: {
	configText: string;
	configPath?: string;
	listStdout?: string;
	listOk?: boolean;
	createOk?: boolean;
	createStdout?: string;
	infoStdout?: string;
	infoOk?: boolean;
}) {
	const run = vi.fn(async (_command: string, args: string[]) => {
		if (args[3] === 'list' && args[4] === '--json') {
			return {
				ok: overrides.listOk ?? true,
				code: overrides.listOk === false ? 1 : 0,
				stdout: overrides.listStdout ?? '[]',
				stderr: ''
			};
		}
		if (args[3] === 'create') {
			return {
				ok: overrides.createOk ?? true,
				code: overrides.createOk === false ? 1 : 0,
				stdout: overrides.createStdout ?? '',
				stderr: ''
			};
		}
		if (args[3] === 'info' && args[5] === '--json') {
			return {
				ok: overrides.infoOk ?? true,
				code: overrides.infoOk === false ? 1 : 0,
				stdout: overrides.infoStdout ?? '{}',
				stderr: ''
			};
		}
		return { ok: false, code: 1, stdout: '', stderr: 'unexpected args' };
	});

	const configPath = overrides.configPath ?? STAGING_CONFIG_PATH;
	const readFile = vi.fn(async (path: string) => {
		if (path === configPath) return overrides.configText;
		throw new Error(`unexpected readFile path: ${path}`);
	});

	const writeConfigAtomically = vi.fn(async () => undefined);

	return { run, readFile, writeConfigAtomically, configPath };
}

describe('provisionD1', () => {
	let consoleLogSpy: ReturnType<typeof vi.spyOn>;
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	test('skips list/create/write when database_id is already configured', async () => {
		const deps = buildProvisionDeps({
			configText: STAGING_WITH_ID_CONFIG,
			configPath: STAGING_CONFIG_PATH
		});

		const result = await provisionD1('staging', deps);

		expect(result).toEqual({
			created: false,
			databaseId: '11111111-1111-1111-1111-111111111111'
		});
		expect(deps.readFile).toHaveBeenCalledTimes(1);
		expect(deps.readFile).toHaveBeenCalledWith(STAGING_CONFIG_PATH, 'utf8');
		expect(deps.run).not.toHaveBeenCalled();
		expect(deps.writeConfigAtomically).not.toHaveBeenCalled();
	});

	test('throws recovery error when database_id is missing but remote D1 already exists', async () => {
		const existingId = '22222222-2222-2222-2222-222222222222';
		const deps = buildProvisionDeps({
			configText: STAGING_BASE_CONFIG,
			configPath: STAGING_CONFIG_PATH,
			listStdout: JSON.stringify([{ name: STAGING_DATABASE_NAME, uuid: existingId }])
		});

		await expect(provisionD1('staging', deps)).rejects.toThrow(
			/D1 database "todai-league-staging" already exists \(uuid: 22222222-2222-2222-2222-222222222222\) but database_id is missing from wrangler\.staging\.jsonc/
		);

		expect(deps.run).toHaveBeenCalledTimes(1);
		expect(deps.run).toHaveBeenCalledWith('pnpm', ['exec', 'wrangler', 'd1', 'list', '--json']);
		expect(deps.writeConfigAtomically).not.toHaveBeenCalled();

		expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Config lacks database_id'));
		expect(consoleWarnSpy).not.toHaveBeenCalled();
	});

	test('lists, creates, fetches info and writes staging config when remote D1 is absent', async () => {
		const newId = '33333333-3333-3333-3333-333333333333';
		const deps = buildProvisionDeps({
			configText: STAGING_BASE_CONFIG,
			configPath: STAGING_CONFIG_PATH,
			listStdout: '[]',
			createOk: true,
			createStdout: `✅ Successfully created DB '${STAGING_DATABASE_NAME}'`,
			infoStdout: JSON.stringify({ uuid: newId })
		});

		const result = await provisionD1('staging', deps);

		expect(result).toEqual({ created: true, databaseId: newId });

		const calls = deps.run.mock.calls.map((c) => c[1] as string[]);
		expect(calls).toEqual([
			['exec', 'wrangler', 'd1', 'list', '--json'],
			['exec', 'wrangler', 'd1', 'create', STAGING_DATABASE_NAME],
			['exec', 'wrangler', 'd1', 'info', STAGING_DATABASE_NAME, '--json']
		]);

		expect(deps.writeConfigAtomically).toHaveBeenCalledTimes(1);
		const [writtenPath, writtenContent] = deps.writeConfigAtomically.mock.calls[0] as [
			string,
			string
		];
		expect(writtenPath).toBe(STAGING_CONFIG_PATH);
		expect(writtenContent).toContain(`"database_id": "${newId}"`);
		expect(writtenContent).toContain(`"database_name": "${STAGING_DATABASE_NAME}"`);

		const parsed = JSON.parse(writtenContent.replace(/\/\/[^\n]*/g, ''));
		expect(parsed.d1_databases[0]).toMatchObject({
			binding: 'DB',
			database_name: STAGING_DATABASE_NAME,
			database_id: newId
		});

		expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[BOOTSTRAP]'));
	});

	test('does not read, mutate or write the prod config fixture when targeting staging', async () => {
		const newId = '44444444-4444-4444-4444-444444444444';
		const deps = buildProvisionDeps({
			configText: STAGING_BASE_CONFIG,
			configPath: STAGING_CONFIG_PATH,
			listStdout: '[]',
			infoStdout: JSON.stringify({ uuid: newId })
		});

		await provisionD1('staging', deps);

		const readPaths = deps.readFile.mock.calls.map((c) => c[0] as string);
		expect(readPaths).toEqual([STAGING_CONFIG_PATH]);
		expect(readPaths).not.toContain(PROD_CONFIG_PATH);

		const writePaths = deps.writeConfigAtomically.mock.calls.map((c) => c[0] as string);
		expect(writePaths).toEqual([STAGING_CONFIG_PATH]);
		expect(writePaths).not.toContain(PROD_CONFIG_PATH);

		const writtenContent = deps.writeConfigAtomically.mock.calls[0]?.[1] as string;
		expect(writtenContent).not.toContain(`"database_name": "${PROD_DATABASE_NAME}"`);
	});
});

type RunResult = { ok: boolean; stdout: string; stderr: string; code: number };

function buildDeployDeps(overrides?: {
	secretResult?: RunResult;
	migrationResult?: RunResult;
	deployResult?: RunResult | RunResult[];
	provisionResult?: { created: boolean; databaseId: string };
}) {
	const calls: Array<{ name: string; args: unknown[] }> = [];

	const runPreflight = vi.fn(async (target: string) => {
		calls.push({ name: 'runPreflight', args: [target] });
		return undefined;
	});
	const runBuild = vi.fn(async () => {
		calls.push({ name: 'runBuild', args: [] });
		return undefined;
	});
	const provisionD1Fn = vi.fn(async (target: string) => {
		calls.push({ name: 'provisionD1', args: [target] });
		return (
			overrides?.provisionResult ?? {
				created: false,
				databaseId: '99999999-9999-9999-9999-999999999999'
			}
		);
	});
	const applyMigrations = vi.fn(async (databaseName: string, config: string) => {
		calls.push({ name: 'applyMigrations', args: [databaseName, config] });
		return (
			overrides?.migrationResult ?? {
				ok: true,
				stdout: '',
				stderr: '',
				code: 0
			}
		);
	});

	const deployResults = Array.isArray(overrides?.deployResult)
		? overrides.deployResult
		: overrides?.deployResult
			? [overrides.deployResult]
			: [];
	let deployIndex = 0;
	const deployWorker = vi.fn(async (config: string) => {
		calls.push({ name: 'deployWorker', args: [config] });
		return deployResults[deployIndex++] ?? { ok: true, stdout: '', stderr: '', code: 0 };
	});

	const ensureSecrets = vi.fn(async (config: string) => {
		calls.push({ name: 'ensureSecrets', args: [config] });
		return (
			overrides?.secretResult ?? {
				ok: true,
				stdout: 'BETTER_AUTH_SECRET already exists',
				stderr: '',
				code: 0
			}
		);
	});
	const secretWasCreated = vi.fn((result: { stdout: string }) => {
		return result.stdout.includes(' created');
	});

	return {
		deps: {
			runPreflight,
			runBuild,
			provisionD1: provisionD1Fn,
			applyMigrations,
			deployWorker,
			ensureSecrets,
			secretWasCreated
		},
		spies: {
			runPreflight,
			runBuild,
			provisionD1: provisionD1Fn,
			applyMigrations,
			deployWorker,
			ensureSecrets,
			secretWasCreated
		},
		calls
	};
}

describe('runDeploy ordering', () => {
	let consoleLogSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	test('runs target-aware preflight before build, provision, migrate, deploy and secrets', async () => {
		const { deps, calls, spies } = buildDeployDeps();

		await runDeploy('staging', deps);

		expect(calls.map((c) => c.name)).toEqual([
			'runPreflight',
			'runBuild',
			'provisionD1',
			'applyMigrations',
			'deployWorker',
			'ensureSecrets'
		]);

		expect(spies.runPreflight).toHaveBeenCalledTimes(1);
		expect(spies.runPreflight).toHaveBeenCalledWith('staging');
		expect(spies.runBuild).toHaveBeenCalledTimes(1);
		expect(spies.provisionD1).toHaveBeenCalledWith('staging');
		expect(spies.applyMigrations).toHaveBeenCalledWith(
			TARGETS.staging.databaseName,
			TARGETS.staging.config
		);
		expect(spies.deployWorker).toHaveBeenCalledTimes(1);
		expect(spies.deployWorker).toHaveBeenCalledWith(TARGETS.staging.config);
		expect(spies.ensureSecrets).toHaveBeenCalledWith(TARGETS.staging.config);
	});

	test('does not perform a final deploy when no new secret was created', async () => {
		const { deps, spies } = buildDeployDeps({
			secretResult: {
				ok: true,
				stdout: 'BETTER_AUTH_SECRET already exists',
				stderr: '',
				code: 0
			}
		});

		await runDeploy('prod', deps);

		expect(spies.runPreflight).toHaveBeenCalledWith('prod');
		expect(spies.deployWorker).toHaveBeenCalledTimes(1);
		expect(spies.secretWasCreated).toHaveBeenCalledTimes(1);
		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringContaining('No new secrets created; skipping final redeploy.')
		);
	});
});

describe('runDeploy failure handling and final redeploy', () => {
	beforeEach(() => {
		vi.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	test('performs a second final deploy in order when a new secret was created', async () => {
		const { deps, calls, spies } = buildDeployDeps({
			secretResult: { ok: true, stdout: 'BETTER_AUTH_SECRET created', stderr: '', code: 0 }
		});

		await runDeploy('staging', deps);

		expect(calls.map((c) => c.name)).toEqual([
			'runPreflight',
			'runBuild',
			'provisionD1',
			'applyMigrations',
			'deployWorker',
			'ensureSecrets',
			'deployWorker'
		]);
		expect(spies.deployWorker).toHaveBeenCalledTimes(2);
		expect(spies.deployWorker).toHaveBeenNthCalledWith(1, TARGETS.staging.config);
		expect(spies.deployWorker).toHaveBeenNthCalledWith(2, TARGETS.staging.config);
		expect(spies.ensureSecrets).toHaveBeenCalledTimes(1);
		expect(spies.ensureSecrets).toHaveBeenCalledWith(TARGETS.staging.config);
		expect(spies.secretWasCreated).toHaveBeenCalledTimes(1);
	});

	const failureResult = { ok: false, stdout: '', stderr: 'failure', code: 1 };

	type FailureCase = {
		name: string;
		overrides: Parameters<typeof buildDeployDeps>[0];
		expectedError: RegExp;
		expectedCalls: string[];
		expectedDeployCalls: number;
		expectedEnsureSecretsCalls: number;
	};

	const failureCases: FailureCase[] = [
		{
			name: 'migration failure rejects and never deploys or ensures secrets',
			overrides: { migrationResult: failureResult },
			expectedError: /Migration failed/,
			expectedCalls: ['runPreflight', 'runBuild', 'provisionD1', 'applyMigrations'],
			expectedDeployCalls: 0,
			expectedEnsureSecretsCalls: 0
		},
		{
			name: 'initial deploy failure rejects and never ensures secrets or final deploys',
			overrides: { deployResult: failureResult },
			expectedError: /Worker deploy failed/,
			expectedCalls: ['runPreflight', 'runBuild', 'provisionD1', 'applyMigrations', 'deployWorker'],
			expectedDeployCalls: 1,
			expectedEnsureSecretsCalls: 0
		},
		{
			name: 'secret provisioning failure rejects and never final-deploys',
			overrides: { secretResult: failureResult },
			expectedError: /Secret provisioning failed/,
			expectedCalls: [
				'runPreflight',
				'runBuild',
				'provisionD1',
				'applyMigrations',
				'deployWorker',
				'ensureSecrets'
			],
			expectedDeployCalls: 1,
			expectedEnsureSecretsCalls: 1
		},
		{
			name: 'final redeploy failure after a newly created secret rejects with clear failure',
			overrides: {
				secretResult: { ok: true, stdout: 'BETTER_AUTH_SECRET created', stderr: '', code: 0 },
				deployResult: [{ ok: true, stdout: '', stderr: '', code: 0 }, failureResult]
			},
			expectedError: /Final Worker deploy failed/,
			expectedCalls: [
				'runPreflight',
				'runBuild',
				'provisionD1',
				'applyMigrations',
				'deployWorker',
				'ensureSecrets',
				'deployWorker'
			],
			expectedDeployCalls: 2,
			expectedEnsureSecretsCalls: 1
		}
	];

	test.each(failureCases)('$name', async (testCase) => {
		const { deps, calls, spies } = buildDeployDeps(testCase.overrides);

		await expect(runDeploy('staging', deps)).rejects.toThrow(testCase.expectedError);

		expect(calls.map((c) => c.name)).toEqual(testCase.expectedCalls);
		expect(spies.deployWorker).toHaveBeenCalledTimes(testCase.expectedDeployCalls);
		expect(spies.ensureSecrets).toHaveBeenCalledTimes(testCase.expectedEnsureSecretsCalls);
	});
});
