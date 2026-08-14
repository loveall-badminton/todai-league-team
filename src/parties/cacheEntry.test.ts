import { describe, expect, it } from 'vitest';
import { isCacheEntryStale } from './cacheEntry';

describe('isCacheEntryStale', () => {
	it('is fresh when not expired and epoch matches', () => {
		expect(isCacheEntryStale({ expiresAt: 1000, epoch: 3 }, 500, 3)).toBe(false);
	});

	it('is stale once past expiresAt', () => {
		expect(isCacheEntryStale({ expiresAt: 1000, epoch: 3 }, 1000, 3)).toBe(true);
	});

	it('is stale when a storage-restored entry has an older epoch than current', () => {
		// hibernation 復帰直後、entryCache が空で storage 由来のエントリだけが
		// 残っている状況を想定: TTL はまだ切れていないが epoch が古い。
		expect(isCacheEntryStale({ expiresAt: 999_999, epoch: 0 }, 500, 1)).toBe(true);
	});

	it('is fresh when entry epoch is newer than or equal to current epoch', () => {
		expect(isCacheEntryStale({ expiresAt: 999_999, epoch: 5 }, 500, 5)).toBe(false);
	});
});
