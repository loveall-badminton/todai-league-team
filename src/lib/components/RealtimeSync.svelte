<script lang="ts">
	import { dev } from '$app/environment';
	import { onMount } from 'svelte';
	import AppSwitch from './AppSwitch.svelte';
	import { LIVE_BOARD_CHANNEL, type LiveTopic } from '$lib/realtime/channels';
	import { createLiveChannel } from '$lib/realtime/liveChannel.svelte';

	interface Props {
		topics: readonly LiveTopic[];
		onUpdate: (topics: LiveTopic[]) => void;
		pollInterval?: number;
		channel?: string;
	}

	let { topics, onUpdate, pollInterval = 10000, channel = LIVE_BOARD_CHANNEL }: Props = $props();

	let enabled = $state(true);
	let connected = $state(false);
	let fallbackActive = $state(false);
	let liveChannel: ReturnType<typeof createLiveChannel> | null = null;
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
				if (message.type !== 'updated') return;
				const matched = message.topics.filter((t) => (topics as LiveTopic[]).includes(t));
				if (matched.length > 0) onUpdate(matched);
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
		}, 3000);
		return () => clearTimeout(id);
	});

	// 未接続時のみポーリング
	$effect(() => {
		if (!enabled || connected) return;
		const id = setInterval(() => onUpdate([...topics]), pollInterval);
		return () => clearInterval(id);
	});
</script>

<div class="flex items-center gap-2">
	<AppSwitch checked={enabled} onCheckedChange={setAutoUpdateEnabled} label={statusLabel} />
</div>
