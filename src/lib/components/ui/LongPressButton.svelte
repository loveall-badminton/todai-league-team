<script lang="ts">
	import { cn } from '$lib/utils/cn';

	let {
		class: className = '',
		disabled = false,
		threshold = 450,
		onShortPress,
		onLongPress,
		onclick,
		children,
		type = 'submit'
	}: {
		class?: string;
		disabled?: boolean;
		threshold?: number;
		onShortPress?: () => void;
		onLongPress?: () => void;
		onclick?: (event: MouseEvent) => void;
		children: import('svelte').Snippet;
		type?: 'submit' | 'button';
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

	function onPointerDown(e: PointerEvent) {
		if (disabled) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		e.preventDefault();
		const form = (e.currentTarget as HTMLButtonElement).closest('form');
		pressing = true;
		startTime = Date.now();
		progress = 0;
		rafId = requestAnimationFrame(tickProgress);
		timerId = setTimeout(() => {
			cancelPress();
			if (onLongPress) onLongPress();
			else form?.requestSubmit();
		}, threshold);
	}

	function onPointerUp(e: PointerEvent) {
		e.preventDefault();
		const wasPressing = pressing;
		cancelPress();
		if (wasPressing) onShortPress?.();
	}

	function onPointerCancel() {
		cancelPress();
	}

	// Pointer events cover the long-press gesture for touch, pen, and mouse.
	// A `click` only reaches here from keyboard activation (Enter/Space), which
	// the browser reports with detail === 0 — real pointer clicks are handled above.
	function onClick(e: MouseEvent) {
		if (e.detail !== 0) return;
		onclick?.(e);
	}

	const r = 18;
	const circ = 2 * Math.PI * r;
</script>

<button
	class={cn('relative touch-none select-none', className)}
	{disabled}
	{type}
	onclick={onClick}
	onpointerdown={onPointerDown}
	onpointerup={onPointerUp}
	onpointercancel={onPointerCancel}
	onpointerleave={onPointerCancel}
>
	{@render children()}

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
