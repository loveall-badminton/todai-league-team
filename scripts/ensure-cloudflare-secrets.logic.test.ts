import { describe, expect, test, vi } from 'vitest';
import {
	ensureCloudflareSecrets,
	generateBetterAuthSecret,
	listSecretNames,
	parseArgs,
	putSecret,
	REQUIRED_SECRETS,
	run
} from './ensure-cloudflare-secrets.mjs';

describe('parseArgs', () => {
	test('defaults to wrangler.jsonc', () => {
		expect(parseArgs([])).toEqual({ config: 'wrangler.jsonc' });
	});

	test('accepts --config value', () => {
		expect(parseArgs(['--config', 'wrangler.staging.jsonc'])).toEqual({
			config: 'wrangler.staging.jsonc'
		});
	});

	test('accepts --config=value', () => {
		expect(parseArgs(['--config=wrangler.custom.jsonc'])).toEqual({
			config: 'wrangler.custom.jsonc'
		});
	});
});

describe('run', () => {
	test('resolves with stdout on success', async () => {
		const result = await run('node', ['-e', 'process.stdout.write("ok")']);
		expect(result.stdout).toBe('ok');
	});

	test('rejects when command exits non-zero', async () => {
		await expect(run('node', ['-e', 'process.exit(1)'])).rejects.toThrow(/failed/);
	});
});

describe('listSecretNames', () => {
	test('parses JSON list into a Set of names', async () => {
		const runFn = vi.fn().mockResolvedValue({
			stdout: JSON.stringify([{ name: 'BETTER_AUTH_SECRET' }, { name: 'OTHER' }])
		});

		const names = await listSecretNames('wrangler.jsonc', runFn);

		expect(runFn).toHaveBeenCalledWith('pnpm', [
			'exec',
			'wrangler',
			'secret',
			'list',
			'--config',
			'wrangler.jsonc',
			'--format',
			'json'
		]);
		expect(names).toEqual(new Set(['BETTER_AUTH_SECRET', 'OTHER']));
	});

	test('throws when output is not an array', async () => {
		const runFn = vi.fn().mockResolvedValue({ stdout: '{}' });
		await expect(listSecretNames('wrangler.jsonc', runFn)).rejects.toThrow(
			/Unexpected wrangler secret list output/
		);
	});
});

describe('putSecret', () => {
	test('sends value to stdin without logging it', async () => {
		const captured: string[] = [];
		const runFn = vi.fn().mockImplementation(async (_command: string, _args: string[], options) => {
			captured.push(options.input);
			return { stdout: '' };
		});

		await putSecret('BETTER_AUTH_SECRET', 'super-secret-value', 'wrangler.jsonc', runFn);

		expect(runFn).toHaveBeenCalledWith(
			'pnpm',
			['exec', 'wrangler', 'secret', 'put', 'BETTER_AUTH_SECRET', '--config', 'wrangler.jsonc'],
			{ input: 'super-secret-value\n' }
		);
		expect(captured).toEqual(['super-secret-value\n']);
	});
});

describe('generateBetterAuthSecret', () => {
	test('produces a non-empty base64url string', () => {
		const value = generateBetterAuthSecret();
		expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(value.length).toBeGreaterThan(0);
	});
});

describe('ensureCloudflareSecrets', () => {
	test('creates only missing secrets and returns created set', async () => {
		const calls: Array<{ name: string; value: string }> = [];
		const runFn = vi.fn(async (_command: string, args: string[], options?: { input?: string }) => {
			if (args[3] === 'list') {
				return { stdout: JSON.stringify([{ name: 'BETTER_AUTH_SECRET' }]) };
			}
			if (args[3] === 'put') {
				calls.push({ name: args[4], value: options?.input ?? '' });
				return { stdout: '' };
			}
			throw new Error('unexpected command');
		});

		const result = await ensureCloudflareSecrets('wrangler.jsonc', { run: runFn });

		expect(result.created).toEqual(new Set());
		expect(calls).toEqual([]);
	});

	test('creates missing secret and never leaks the value', async () => {
		const calls: Array<{ name: string; value: string }> = [];
		const generatedValues: string[] = [];
		const runFn = vi.fn(async (_command: string, args: string[], options?: { input?: string }) => {
			if (args[3] === 'list') {
				return { stdout: '[]' };
			}
			if (args[3] === 'put') {
				calls.push({ name: args[4], value: options?.input ?? '' });
				return { stdout: '' };
			}
			throw new Error('unexpected command');
		});
		const generateFn = vi.fn(() => {
			const value = 'generated-secret-value';
			generatedValues.push(value);
			return value;
		});

		const result = await ensureCloudflareSecrets('wrangler.jsonc', {
			run: runFn,
			generate: generateFn
		});

		expect(result.created).toEqual(new Set(REQUIRED_SECRETS));
		expect(calls).toHaveLength(1);
		expect(calls[0].name).toBe('BETTER_AUTH_SECRET');
		expect(calls[0].value).toBe('generated-secret-value\n');
		expect(generatedValues).toEqual(['generated-secret-value']);
	});

	test('propagates wrangler errors', async () => {
		const runFn = vi.fn().mockRejectedValue(new Error('wrangler secret list failed'));

		await expect(ensureCloudflareSecrets('wrangler.jsonc', { run: runFn })).rejects.toThrow(
			/wrangler secret list failed/
		);
	});
});
