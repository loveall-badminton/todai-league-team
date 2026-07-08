import { browser } from '$app/environment';
import {
	createLiveChannel,
	type LiveChannel,
	type LiveChannelOptions,
	type LiveChannelStatus
} from './liveChannel.svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { LiveMessage } from './channels';
import type { RealtimeConnectionManager } from './realtimeConnectionContext';

type Subscriber = {
	onMessage: (message: LiveMessage) => void;
	onStatusChange?: (status: LiveChannelStatus) => void;
};

type ChannelEntry = {
	channel: LiveChannel | null;
	status: LiveChannelStatus;
	subscribers: SvelteSet<Subscriber>;
	idleCloseTimer: ReturnType<typeof setTimeout> | null;
};

export interface PersistentLiveConnectionManagerOptions {
	idleCloseMs?: number;
}

const DEFAULT_IDLE_CLOSE_MS = 5 * 60 * 1000;

export function createPersistentLiveConnectionManager(
	options: PersistentLiveConnectionManagerOptions = {}
): RealtimeConnectionManager {
	const idleCloseMs = options.idleCloseMs ?? DEFAULT_IDLE_CLOSE_MS;
	const entries = new SvelteMap<string, ChannelEntry>();

	function getEntry(channelName: string): ChannelEntry {
		let entry = entries.get(channelName);
		if (!entry) {
			entry = {
				channel: null,
				status: 'closed',
				subscribers: new SvelteSet(),
				idleCloseTimer: null
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

	function cancelIdleClose(entry: ChannelEntry) {
		if (!entry.idleCloseTimer) return;
		clearTimeout(entry.idleCloseTimer);
		entry.idleCloseTimer = null;
	}

	function scheduleIdleClose(channelName: string, entry: ChannelEntry) {
		if (entry.subscribers.size > 0 || entry.idleCloseTimer) return;
		entry.idleCloseTimer = setTimeout(() => {
			entry.idleCloseTimer = null;
			if (entry.subscribers.size > 0) return;
			entry.channel?.close();
			entries.delete(channelName);
		}, idleCloseMs);
	}

	return {
		subscribe(options: LiveChannelOptions): LiveChannel {
			const entry = getEntry(options.channel);
			const subscriber: Subscriber = {
				onMessage: options.onMessage,
				onStatusChange: options.onStatusChange
			};

			cancelIdleClose(entry);
			entry.subscribers.add(subscriber);
			ensureChannel(options.channel, entry);
			if (entry.status === 'closed') entry.channel?.reconnect();
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
					scheduleIdleClose(options.channel, entry);
				}
			};
		},
		closeAll() {
			for (const entry of entries.values()) {
				cancelIdleClose(entry);
				entry.channel?.close();
			}
			entries.clear();
		}
	};
}
