/**
 * リアルタイム同期で使う「チャンネル」とメッセージ型の定義。
 *
 * クライアント・サーバ・Durable Object の三者で共有するため、ブラウザ専用 /
 * サーバ専用の API には依存しない純粋なモジュールに保つ。
 */

/**
 * ライブ表示で更新されうる領域。クライアントは受け取った topic に対応する
 * クエリだけを再取得する。
 */
export type LiveTopic = 'score' | 'standings' | 'schedule' | 'finals';

export const ALL_LIVE_TOPICS: readonly LiveTopic[] = ['score', 'standings', 'schedule', 'finals'];

/** サーバから同一チャンネルの全クライアントへ push されるメッセージ。 */
export type LiveMessage =
	| { type: 'hello'; at: string }
	| { type: 'updated'; topics: LiveTopic[]; at: string };

/** 観客・運営のライブボードが購読する単一のグローバルチャンネル。 */
export const LIVE_BOARD_CHANNEL = 'live-board';

/** 同じ試合を見る審判端末同士が購読する、試合ごとのチャンネル。 */
export function matchChannel(matchId: string): string {
	return `match:${matchId}`;
}

/** PartyServer の prefix（routePartykitRequest のデフォルト）。 */
export const PARTY_PREFIX = 'parties';

/** LiveBoard パーティのkebab-case名。 */
export const LIVE_BOARD_PARTY = 'live-board';
