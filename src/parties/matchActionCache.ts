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
): { players: MatchPlayer[] | undefined; nextCache: MatchPlayer[] | undefined } {
	if (clientPlayers) {
		return { players: clientPlayers, nextCache: clientPlayers };
	}
	return { players: cachedPlayers, nextCache: cachedPlayers };
}
