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
	let generation = 0;

	function setStatus(next: LiveChannelStatus) {
		if (status === next) return;
		status = next;
		options.onStatusChange?.(next);
	}

	async function connect() {
		if (!browser) return;

		if (socket) {
			socket.close();
			socket = null;
		}

		closedByUser = false;
		setStatus('connecting');
		generation++;
		const currentGeneration = generation;

		// ジッターで再接続のタイミングを分散
		const jitterMs = 500 + Math.random() * 3000;
		await new Promise((resolve) => setTimeout(resolve, jitterMs));

		if (generation !== currentGeneration) return;

		const ws = new PartySocket({
			host: window.location.host,
			room: options.channel,
			party: 'live-board',
			maxReconnectionDelay: 15000,
			minReconnectionDelay: 2000,
			reconnectionDelayGrowFactor: 1.5,
			maxRetries: 10
		});

		socket = ws;

		ws.addEventListener('open', () => {
			if (generation !== currentGeneration || closedByUser || socket !== ws) return;
			setStatus('open');
		});

		ws.addEventListener('message', (event) => {
			if (generation !== currentGeneration || closedByUser || socket !== ws) return;
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
			if (generation !== currentGeneration) return;
			if (socket === ws) socket = null;
			if (closedByUser || (socket !== null && socket !== ws)) return;
			setStatus('closed');
		});

		ws.addEventListener('error', () => {
			if (generation !== currentGeneration || closedByUser || socket !== ws) return;
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
