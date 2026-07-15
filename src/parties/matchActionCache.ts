import type { MatchPlayer } from '$lib/domain/types';

/**
 * MatchActionCoordinator の players キャッシュ更新ロジック。
 * クライアントが players を送ってきた場合は常にキャッシュを更新する
 * (ロースター変更を確実に反映するため)。送ってこない場合(ペイロード削減目的)
 * のみ直近のキャッシュにフォールバックする。DO ランタイムに依存しないため、
 * 通常の vitest プロジェクトでテストできる。
 */
export function resolvePlayersCache(
	clientPlayers: MatchPlayer[] | undefined,
	cachedPlayers: MatchPlayer[] | undefined
): MatchPlayer[] | undefined {
	return clientPlayers ?? cachedPlayers;
}
