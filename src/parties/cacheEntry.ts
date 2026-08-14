export type CacheEntryFreshness = { expiresAt: number; epoch: number };

/**
 * L2 エントリキャッシュの期限切れ判定。TTL 切れに加え、DO storage から復元した
 * エントリの epoch が現在の epoch より古い(=hibernation 復帰前に invalidation が
 * 走っていた)場合も期限切れとして扱う。
 * DO ランタイムに依存しない純粋関数として、通常の vitest プロジェクトでテストできる。
 */
export function isCacheEntryStale(
	entry: CacheEntryFreshness,
	now: number,
	currentEpoch: number
): boolean {
	return entry.expiresAt <= now || entry.epoch < currentEpoch;
}
