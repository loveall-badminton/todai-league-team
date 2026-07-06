import { browser } from '$app/environment';
import PartySocket from 'partysocket';
import { parseLiveMessage, type LiveMessage } from './channels';

type LiveChannelStatus = 'connecting' | 'open' | 'closed';

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
	let status = $state<LiveChannelStatus>('closed');
	let socket: PartySocket | null = null;
	let closedByUser = false;
	let connectTimer: ReturnType<typeof setTimeout> | null = null;

	function setStatus(next: LiveChannelStatus) {
		if (status === next) return;
		status = next;
		options.onStatusChange?.(next);
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
			});

			ws.addEventListener('message', (event) => {
				if (closedByUser || socket !== ws) return;
				try {
					const raw = typeof event.data === 'string' ? event.data : String(event.data);
					const parsed = JSON.parse(raw);
					const message = parseLiveMessage(parsed);
					if (message) {
						options.onMessage(message);
					} else {
						console.warn('[LiveChannel] invalid message', parsed);
					}
				} catch (err) {
					console.warn('[LiveChannel] parse error', String(err));
				}
			});

			ws.addEventListener('close', () => {
				if (closedByUser || socket !== ws) return;
				setStatus('closed');
			});

			ws.addEventListener('error', () => {
				if (closedByUser || socket !== ws) return;
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
			if (socket) {
				socket.close();
				socket = null;
			}
			setStatus('closed');
		}
	};
}
