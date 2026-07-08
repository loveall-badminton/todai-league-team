import { getContext, hasContext, setContext } from 'svelte';
import type { LiveChannel, LiveChannelOptions } from './liveChannel.svelte';

export interface RealtimeConnectionManager {
	subscribe(options: LiveChannelOptions): LiveChannel;
	closeAll(): void;
}

const realtimeConnectionManagerKey = Symbol('realtimeConnectionManager');

export function setRealtimeConnectionManager(manager: RealtimeConnectionManager) {
	setContext(realtimeConnectionManagerKey, manager);
}

export function getRealtimeConnectionManager(): RealtimeConnectionManager | null {
	if (!hasContext(realtimeConnectionManagerKey)) return null;
	return getContext<RealtimeConnectionManager>(realtimeConnectionManagerKey);
}
