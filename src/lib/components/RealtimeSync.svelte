<script lang="ts">
	import { dev } from '$app/environment';
	import { onMount } from 'svelte';
	import AppSwitch from './AppSwitch.svelte';
	import {
		LIVE_BOARD_CHANNEL,
		filterSubscribedTopics,
		isLiveUpdatedMessage,
		type LiveTopic
	} from '$lib/realtime/channels';
	import { createLiveChannel, type LiveChannel } from '$lib/realtime/liveChannel.svelte';
	import type { RealtimeUpdate } from '$lib/realtime/updates';
	import { computePollDelay } from '$lib/realtime/polling';

	interface Props {
		topics: readonly LiveTopic[];
		onUpdate: (update: RealtimeUpdate) => void | Promise<void>;
		pollInterval?: number;
		channel?: string;
	}

	let { topics, onUpdate, pollInterval = 10000, channel = LIVE_BOARD_CHANNEL }: Props = $props();

	let enabled = $state(true);
	let connected = $state(false);
	let fallbackActive = $state(false);
	let liveChannel: LiveChannel | null = null;
	let statusLabel = $derived(
		enabled ? (connected ? '接続中' : fallbackActive ? '自動更新中' : '接続中…') : '自動更新'
	);

	function setAutoUpdateEnabled(next: boolean) {
		enabled = next;
		if (next) {
			startChannel();
		} else {
			connected = false;
			fallbackActive = false;
			liveChannel?.close();
			liveChannel = null;
		}
	}

	function startChannel() {
		if (!enabled || dev) return;
		liveChannel?.close();
		liveChannel = createLiveChannel({
			channel,
			onStatusChange: (status) => {
				connected = status === 'open';
				if (status === 'open') fallbackActive = false;
			},
			onMessage: (message) => {
				if (!isLiveUpdatedMessage(message)) return;
				const matched = filterSubscribedTopics(message.topics, topics);
				if (matched.length === 0) return;
				onUpdate({
					topics: matched,
					data: message.data,
					source: 'live',
					channel,
					at: message.at
				});
			}
		});
	}

	onMount(() => {
		startChannel();
		return () => {
			liveChannel?.close();
			liveChannel = null;
		};
	});

	// 未接続時: フォールバック表示タイマー
	$effect(() => {
		if (!enabled || connected) return;
		fallbackActive = false;
		const id = setTimeout(() => {
			fallbackActive = true;
		}, 5000); //
		return () => clearTimeout(id);
	});

	// 未接続時のみジッター付きポーリング (data なし)
	$effect(() => {
		if (!enabled || connected) return;
		let cancelled = false;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		const scheduleNextPoll = () => {
			if (cancelled || connected || !enabled) return;
			timeoutId = setTimeout(async () => {
				if (cancelled || connected || !enabled) return;
				await onUpdate({
					topics: [...topics],
					source: 'poll',
					channel
				});
				scheduleNextPoll();
			}, computePollDelay(pollInterval));
		};

		scheduleNextPoll();
		return () => {
			cancelled = true;
			if (timeoutId) clearTimeout(timeoutId);
		};
	});
</script>

<AppSwitch checked={enabled} onCheckedChange={setAutoUpdateEnabled} label={statusLabel} />
