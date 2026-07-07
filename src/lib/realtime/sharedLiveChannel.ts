import { browser } from '$app/environment';
import {
	createLiveChannel,
	type LiveChannel,
	type LiveChannelOptions,
	type LiveChannelStatus
} from './liveChannel.svelte';
import type { LiveMessage } from './channels';

type Subscriber = {
	onMessage: (message: LiveMessage) => void;
	onStatusChange?: (status: LiveChannelStatus) => void;
};

type ChannelEntry = {
	channel: LiveChannel | null;
	status: LiveChannelStatus;
	subscribers: Set<Subscriber>;
	closeTimer: ReturnType<typeof setTimeout> | null;
};

const entries = new Map<string, ChannelEntry>();

function getEntry(channelName: string): ChannelEntry {
	let entry = entries.get(channelName);
	if (!entry) {
		entry = {
			channel: null,
			status: 'closed',
			subscribers: new Set(),
			closeTimer: null
		};
		entries.set(channelName, entry);
	}
	return entry;
}

function notifyStatus(entry: ChannelEntry, status: LiveChannelStatus) {
	entry.status = status;
	for (const subscriber of entry.subscribers) {
		subscriber.onStatusChange?.(status);
	}
}

function notifyMessage(entry: ChannelEntry, message: LiveMessage) {
	for (const subscriber of entry.subscribers) {
		subscriber.onMessage(message);
	}
}

function ensureChannel(channelName: string, entry: ChannelEntry) {
	if (!browser || entry.channel) return;
	entry.channel = createLiveChannel({
		channel: channelName,
		onMessage: (message) => notifyMessage(entry, message),
		onStatusChange: (status) => notifyStatus(entry, status)
	});
}

function scheduleClose(channelName: string, entry: ChannelEntry) {
	if (entry.closeTimer) return;
	entry.closeTimer = setTimeout(() => {
		entry.closeTimer = null;
		if (entry.subscribers.size > 0) return;
		entry.channel?.close();
		entries.delete(channelName);
	}, 1000);
}

export function subscribeSharedLiveChannel(options: LiveChannelOptions): LiveChannel {
	const entry = getEntry(options.channel);
	const subscriber: Subscriber = {
		onMessage: options.onMessage,
		onStatusChange: options.onStatusChange
	};

	if (entry.closeTimer) {
		clearTimeout(entry.closeTimer);
		entry.closeTimer = null;
	}

	entry.subscribers.add(subscriber);
	ensureChannel(options.channel, entry);
	options.onStatusChange?.(entry.status);

	return {
		get status() {
			return entry.status;
		},
		reconnect() {
			entry.channel?.reconnect();
		},
		close() {
			entry.subscribers.delete(subscriber);
			if (entry.subscribers.size === 0) {
				scheduleClose(options.channel, entry);
			}
		}
	};
}
