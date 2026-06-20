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
	close(): void;
}

export function createLiveChannel(options: LiveChannelOptions): LiveChannel {
	let status = $state<LiveChannelStatus>('closed');
	let socket: PartySocket | null = null;
	let closedByUser = false;

	function setStatus(next: LiveChannelStatus) {
		if (status === next) return;
		status = next;
		options.onStatusChange?.(next);
	}

	function connect() {
		if (!browser) return;
		closedByUser = false;
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
			if (socket === ws) socket = null;
			if (closedByUser || (socket !== null && socket !== ws)) return;
			setStatus('closed');
		});

		ws.addEventListener('error', () => {
			if (closedByUser || socket !== ws) return;
			setStatus('closed');
		});
	}

	function onVisibilityChange() {
		if (document.visibilityState !== 'visible' || status === 'open') return;
		if (socket) socket.reconnect();
		else connect();
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
			closedByUser = true;
			if (browser) document.removeEventListener('visibilitychange', onVisibilityChange);
			if (socket) {
				socket.close();
				socket = null;
			}
			setStatus('closed');
		}
	};
}
