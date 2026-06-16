import { browser } from '$app/environment';
import PartySocket from 'partysocket';
import { parseLiveMessage, type LiveMessage } from './channels';

export type LiveChannelStatus = 'connecting' | 'open' | 'closed';

export interface LiveChannelOptions {
	channel: string;
	onMessage: (message: LiveMessage) => void;
	onStatusChange?: (status: LiveChannelStatus) => void;
}

export interface LiveChannel {
	readonly status: LiveChannelStatus;
	close(): void;
}

export function createLiveChannel(options: LiveChannelOptions): LiveChannel {
	let status = $state<LiveChannelStatus>('closed');
	let socket: PartySocket | null = null;

	function setStatus(next: LiveChannelStatus) {
		if (status === next) return;
		status = next;
		options.onStatusChange?.(next);
	}

	function connect() {
		if (!browser) return;
		setStatus('connecting');

		const ws = new PartySocket({
			host: window.location.host,
			room: options.channel,
			party: 'live-board',
			maxReconnectionDelay: 10000,
			minReconnectionDelay: 3000,
			reconnectionDelayGrowFactor: 1.3,
			maxRetries: 10
		});

		socket = ws;

		ws.addEventListener('open', () => {
			setStatus('open');
		});

		ws.addEventListener('message', (event) => {
			try {
				const parsed = JSON.parse(event.data);
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
			setStatus('closed');
		});

		ws.addEventListener('error', () => {});
	}

	function onVisibilityChange() {
		if (document.visibilityState !== 'visible' || status === 'open') return;
		socket?.reconnect();
	}

	if (browser) {
		document.addEventListener('visibilitychange', onVisibilityChange);
		connect();
	}

	return {
		get status() {
			return status;
		},
		close() {
			if (browser) document.removeEventListener('visibilitychange', onVisibilityChange);
			if (socket) {
				socket.close();
				socket = null;
			}
			setStatus('closed');
		}
	};
}
