<script lang="ts">
	import { cn } from '$lib/utils/cn';

	let {
		class: className = '',
		disabled = false,
		threshold = 450,
		onclick,
		onShortPress,
		children
	}: {
		class?: string;
		disabled?: boolean;
		threshold?: number;
		onclick?: () => void;
		onShortPress?: () => void;
		children: import('svelte').Snippet;
	} = $props();

	let pressing = $state(false);
	let progress = $state(0);
	let timerId: ReturnType<typeof setTimeout> | null = null;
	let rafId: number | null = null;
	let startTime = 0;

	function cancelPress() {
		if (timerId != null) {
			clearTimeout(timerId);
			timerId = null;
		}
		if (rafId != null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
		pressing = false;
		progress = 0;
	}

	function tickProgress() {
		if (!pressing) return;
		progress = Math.min(1, (Date.now() - startTime) / threshold);
		rafId = requestAnimationFrame(tickProgress);
	}

	function onTouchStart(e: TouchEvent) {
		if (disabled) return;
		e.preventDefault(); // prevent synthetic click
		pressing = true;
		startTime = Date.now();
		progress = 0;
		rafId = requestAnimationFrame(tickProgress);
		timerId = setTimeout(() => {
			cancelPress();
			onclick?.();
		}, threshold);
	}

	function onTouchEnd(e: TouchEvent) {
		e.preventDefault();
		const wasPressing = pressing;
		cancelPress();
		if (wasPressing) onShortPress?.();
	}

	function onClick() {
		// desktop click
		if (!disabled) onclick?.();
	}

	// radius and circumference for SVG ring
	const r = 18;
	const circ = 2 * Math.PI * r;
</script>

<button
	class={cn('relative touch-none select-none', className)}
	{disabled}
	type="button"
	onclick={onClick}
	ontouchstart={onTouchStart}
	ontouchend={onTouchEnd}
	ontouchcancel={onTouchEnd}
>
	{@render children()}

	<!-- long-press progress ring (touch only) -->
	{#if pressing}
		<span class="pointer-events-none absolute inset-0 flex items-center justify-center">
			<svg class="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 40 40">
				<circle
					cx="20"
					cy="20"
					{r}
					fill="none"
					stroke="rgba(255,255,255,0.5)"
					stroke-width="3"
					stroke-dasharray={circ}
					stroke-dashoffset={circ * (1 - progress)}
					stroke-linecap="round"
				/>
			</svg>
		</span>
	{/if}
</button>
