<script lang="ts" generics="TTopic extends LiveTopic">
	import { dev } from '$app/environment';
	import { onMount } from 'svelte';
	import { LoaderCircle, RefreshCw } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import {
		LIVE_BOARD_CHANNEL,
		filterSubscribedTopics,
		isLiveUpdatedMessage,
		type LiveTopic,
		type LiveUpdateData
	} from '$lib/realtime/channels';
	import type { LiveChannel } from '$lib/realtime/liveChannel.svelte';
	import { subscribeSharedLiveChannel } from '$lib/realtime/sharedLiveChannel';
	import { getRealtimeConnectionManager } from '$lib/realtime/realtimeConnectionContext';
	import type { RealtimeUpdate } from '$lib/realtime/updates';
	import { computePollDelay } from '$lib/realtime/polling';
	import { createRealtimeQueryFlow, type RealtimeApplyResult } from '$lib/realtime/queryFlow';

	interface Props {
		/** 購読トピック。ここで指定した型がコールバックの update に伝播する */
		topics: readonly TTopic[];
		/**
		 * 標準フロー: refresh を渡すと queryFlow(差分適用 → だめなら
		 * デバウンス付き refresh)をコンポーネント内部で構築する。
		 */
		refresh?: () => unknown | Promise<unknown>;
		applyUpdate?: (update: RealtimeUpdate<TTopic>) => RealtimeApplyResult;
		shouldRefresh?: (update: RealtimeUpdate<TTopic>) => boolean;
		debounceMs?: number;
		/** 複数クエリを個別に制御したいページ向けの低レベルフック */
		onUpdate?: (update: RealtimeUpdate<TTopic>) => void | Promise<void>;
		pollInterval?: number;
		channel?: string;
	}

	let {
		topics,
		refresh,
		applyUpdate,
		shouldRefresh,
		debounceMs,
		onUpdate,
		pollInterval = 10000,
		channel = LIVE_BOARD_CHANNEL
	}: Props = $props();

	const queryFlow = $derived(
		refresh ? createRealtimeQueryFlow({ refresh, applyUpdate, shouldRefresh, debounceMs }) : null
	);

	async function handleUpdate(update: RealtimeUpdate<TTopic>) {
		await Promise.all([onUpdate?.(update), queryFlow?.(update)]);
	}

	let enabled = $state(true);
	let connected = $state(false);
	let fallbackActive = $state(false);
	let liveChannel: LiveChannel | null = null;
	const realtimeConnectionManager = getRealtimeConnectionManager();
	// 接続断(または手動 OFF)の間に流れたイベントは受信できないため、
	// 再接続時に一度だけ全体 refresh してキャッチアップする
	let needsCatchUp = $state(false);

	type StatusTone = 'off' | 'connecting' | 'live' | 'polling';
	let statusTone: StatusTone = $derived(
		!enabled ? 'off' : connected ? 'live' : fallbackActive ? 'polling' : 'connecting'
	);
	const statusLabels: Record<StatusTone, string> = {
		off: '自動更新オフ',
		connecting: '接続中',
		live: 'ライブ更新',
		polling: '定期更新中'
	};
	let statusLabel = $derived(statusLabels[statusTone]);

	const statusToneClasses: Record<StatusTone, string> = {
		off: 'border-border bg-white text-muted hover:bg-zinc-50',
		connecting: 'border-border bg-white text-muted-emphasis',
		live: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
		polling: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
	};

	function setAutoUpdateEnabled(next: boolean) {
		enabled = next;
		if (next) {
			startChannel();
		} else {
			needsCatchUp = true;
			connected = false;
			fallbackActive = false;
			liveChannel?.close();
			liveChannel = null;
		}
	}

	function startChannel() {
		if (!enabled || dev) return;
		liveChannel?.close();
		const subscribe = realtimeConnectionManager?.subscribe ?? subscribeSharedLiveChannel;
		liveChannel = subscribe({
			channel,
			onStatusChange: (status) => {
				if (status !== 'open' && connected) needsCatchUp = true;
				connected = status === 'open';
				if (status === 'open') {
					fallbackActive = false;
					if (needsCatchUp) {
						needsCatchUp = false;
						void handleUpdate({ topics: [...topics], source: 'poll', channel });
					}
				}
			},
			onMessage: (message) => {
				if (!isLiveUpdatedMessage(message)) return;
				const matched = filterSubscribedTopics(message.topics, topics);
				if (matched.length === 0) return;
				void handleUpdate({
					topics: matched,
					// 全トピックの Partial は購読トピックの Partial として常に安全
					data: message.data as LiveUpdateData<TTopic>,
					source: 'live',
					channel,
					at: message.at
				});
			}
		});
	}

	// バックグラウンド中は WS が凍結され、close イベントなしに実質切断されている
	// ことがある(特に iOS)。一定時間隠れていた後に復帰したら、接続状態に
	// かかわらず一度だけ catch-up refresh して取りこぼしを回収する。
	const CATCH_UP_AFTER_HIDDEN_MS = 30_000;
	let hiddenAt: number | null = null;

	function onVisibilityChange() {
		if (document.visibilityState === 'hidden') {
			hiddenAt = Date.now();
			return;
		}
		const hiddenMs = hiddenAt === null ? 0 : Date.now() - hiddenAt;
		hiddenAt = null;
		if (!enabled || hiddenMs < CATCH_UP_AFTER_HIDDEN_MS) return;
		void handleUpdate({ topics: [...topics], source: 'poll', channel });
	}

	onMount(() => {
		startChannel();
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			document.removeEventListener('visibilitychange', onVisibilityChange);
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
				await handleUpdate({
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

<button
	type="button"
	role="switch"
	aria-checked={enabled}
	onclick={() => setAutoUpdateEnabled(!enabled)}
	class={cn(
		'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
		statusToneClasses[statusTone]
	)}
>
	{#if statusTone === 'connecting'}
		<LoaderCircle class="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
	{:else if statusTone === 'polling'}
		<RefreshCw class="size-3.5 shrink-0" aria-hidden="true" />
	{:else}
		<span
			class={cn(
				'size-2 shrink-0 rounded-full',
				statusTone === 'live' ? 'bg-emerald-500' : 'bg-zinc-300'
			)}
			aria-hidden="true"
		></span>
	{/if}
	{statusLabel}
</button>
