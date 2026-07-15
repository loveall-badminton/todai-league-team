import { browser } from '$app/environment';
import PartySocket from 'partysocket';
import {
	createLivePingMessage,
	createLiveResyncMessage,
	parseLiveMessage,
	type LiveMessage
} from './channels';

// バックグラウンド凍結等で TCP レベルでは切れているのに WS の close/error が
// 発火しない("open" のまま実質死んでいる)ケースを検知するためのハートビート。
// 生存確認は受信全般(pong に限らず hello/updated も含む)を対象にする。
const HEARTBEAT_INTERVAL_MS = 20_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;

export type LiveChannelStatus = 'connecting' | 'open' | 'closed';

export interface LiveChannelOptions {
	channel: string;
	onMessage: (message: LiveMessage) => void;
	onStatusChange?: (status: LiveChannelStatus) => void;
}

export interface LiveChannel {
	readonly status: LiveChannelStatus;
	/** バックオフをリセットして再接続を試みる(既に open なら何もしない) */
	reconnect(): void;
	close(): void;
}

export function createLiveChannel(options: LiveChannelOptions): LiveChannel {
	let status: LiveChannelStatus = $state('closed');
	let socket: PartySocket | null = null;
	let closedByUser = false;
	let connectTimer: ReturnType<typeof setTimeout> | null = null;
	let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	let lastActivityAt = 0;
	// 最後に受信した updated の seqNo。再接続時にこの値以降の再送を DO に要求する。
	// null は「まだ何も受け取っていない(初回接続)」で、その場合は resync 不要。
	let lastSeqNo: number | null = null;

	function setStatus(next: LiveChannelStatus) {
		if (status === next) return;
		status = next;
		options.onStatusChange?.(next);
	}

	function stopHeartbeat() {
		if (heartbeatTimer) {
			clearInterval(heartbeatTimer);
			heartbeatTimer = null;
		}
	}

	function startHeartbeat(ws: PartySocket) {
		stopHeartbeat();
		lastActivityAt = Date.now();
		heartbeatTimer = setInterval(() => {
			if (socket !== ws) {
				stopHeartbeat();
				return;
			}
			if (Date.now() - lastActivityAt > HEARTBEAT_TIMEOUT_MS) {
				// pong はおろか hello/updated すら一定時間来ていない = 凍結ソケットとみなし、
				// close イベントを待たずに能動的に再接続する。
				stopHeartbeat();
				setStatus('connecting');
				ws.reconnect();
				return;
			}
			try {
				ws.send(JSON.stringify(createLivePingMessage()));
			} catch {
				// send 失敗は次の close/error イベントに委ねる
			}
		}, HEARTBEAT_INTERVAL_MS);
	}

	function connect() {
		if (!browser || closedByUser || socket || connectTimer) return;

		setStatus('connecting');
		// ジッターで再接続のタイミングを分散
		const jitterMs = 500 + Math.random() * 3000;
		connectTimer = setTimeout(() => {
			connectTimer = null;
			if (closedByUser) return;

			const ws = new PartySocket({
				host: window.location.host,
				room: options.channel,
				party: 'live-board',
				// リトライは打ち切らない(上限到達後に復帰手段がなくなるため)。
				// バックオフ上限 30 秒なので、サーバー不達時の試行は 30 秒に 1 回で頭打ち。
				maxReconnectionDelay: 30000,
				minReconnectionDelay: 2000,
				reconnectionDelayGrowFactor: 1.5
			});

			// PartySocket は内部で自動再接続する。close が来てもソケットは破棄せず、
			// 同じインスタンスの open / close イベントで status だけ追従させる
			// (破棄すると内部再接続後のイベントが宙に浮き、幽霊接続が残る)。
			socket = ws;

			ws.addEventListener('open', () => {
				if (closedByUser || socket !== ws) return;
				setStatus('open');
				startHeartbeat(ws);
			});

			ws.addEventListener('message', (event) => {
				if (closedByUser || socket !== ws) return;
				lastActivityAt = Date.now();
				try {
					const raw = typeof event.data === 'string' ? event.data : String(event.data);
					const parsed = JSON.parse(raw);
					const message = parseLiveMessage(parsed);
					if (!message) {
						console.warn('[LiveChannel] invalid message', parsed);
						return;
					}
					// pong はハートビートの生存確認だけが目的で、購読者に転送する情報はない
					if (message.type === 'pong') return;

					if (message.type === 'updated' && typeof message.seqNo === 'number') {
						lastSeqNo = message.seqNo;
					}
					if (message.type === 'hello') {
						if (lastSeqNo === null) {
							// 初回接続: 現在の seqNo を基準にするだけ(取りこぼしは無いので resync 不要)
							if (typeof message.seqNo === 'number') lastSeqNo = message.seqNo;
						} else {
							// 再接続。hello.seqNo が lastSeqNo より小さい = DO 再起動で
							// カウンタが巻き戻ったので、古い値で resync せず基準を合わせる。
							if (typeof message.seqNo === 'number' && message.seqNo < lastSeqNo) {
								lastSeqNo = message.seqNo;
							}
							// 切断中に取りこぼした updated があれば再送してもらう
							try {
								ws.send(JSON.stringify(createLiveResyncMessage(lastSeqNo)));
							} catch {
								// send 失敗は次の close/error イベントに委ねる
							}
						}
					}
					options.onMessage(message);
				} catch (err) {
					console.warn('[LiveChannel] parse error', String(err));
				}
			});

			ws.addEventListener('close', () => {
				if (closedByUser || socket !== ws) return;
				stopHeartbeat();
				setStatus('closed');
			});

			ws.addEventListener('error', () => {
				if (closedByUser || socket !== ws) return;
				stopHeartbeat();
				setStatus('closed');
			});
		}, jitterMs);
	}

	function reconnect() {
		if (closedByUser || status === 'open') return;
		if (socket) {
			// reconnect() はバックオフをリセットして即時再接続する
			// (画面復帰時に最大 30 秒のバックオフを待たせないため)
			setStatus('connecting');
			socket.reconnect();
		} else {
			connect();
		}
	}

	function onVisibilityChange() {
		if (document.visibilityState !== 'visible') return;
		reconnect();
	}

	if (browser) {
		document.addEventListener('visibilitychange', onVisibilityChange);
		connect();
	}

	return {
		get status() {
			return status;
		},
		reconnect,
		close() {
			closedByUser = true;
			if (browser) document.removeEventListener('visibilitychange', onVisibilityChange);
			if (connectTimer) {
				clearTimeout(connectTimer);
				connectTimer = null;
			}
			stopHeartbeat();
			if (socket) {
				socket.close();
				socket = null;
			}
			setStatus('closed');
		}
	};
}
