<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { Check } from '@lucide/svelte';

	let {
		currentStep,
		steps = [
			{ label: 'オーダー提出', desc: '各チームが選手を登録' },
			{ label: 'オーダー確認', desc: '運営が内容を確認' },
			{ label: '試合開始', desc: '審判・コートを割り当て' },
			{ label: '試合進行', desc: '審判がスコアを入力' },
			{ label: '結果確定', desc: '運営が結果を承認' }
		]
	}: { currentStep: number; steps?: { label: string; desc: string }[] } = $props();
</script>

<div class="flex items-start gap-0 overflow-x-auto">
	{#each steps as step, i (i)}
		{@const stepNum = i + 1}
		{@const isComplete = currentStep > stepNum}
		{@const isCurrent = currentStep === stepNum}
		<div class="flex min-w-20 flex-1 flex-col items-center gap-1.5 text-center sm:min-w-28">
			<div class="flex w-full items-center">
				<div
					class={cn(
						'mt-1.5 h-px flex-1',
						i === 0 ? 'invisible' : isComplete || isCurrent ? 'bg-zinc-900' : 'bg-zinc-200'
					)}
				></div>
				<div
					class={cn(
						'mt-1.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
						isComplete
							? 'bg-zinc-900 text-white'
							: isCurrent
								? 'bg-zinc-900 text-white ring-4 ring-zinc-200'
								: 'border-2 border-zinc-200 text-zinc-400'
					)}
				>
					{#if isComplete}<Check class="size-4" />{:else}{stepNum}{/if}
				</div>
				<div
					class={cn(
						'mt-1.5 h-px flex-1',
						i === steps.length - 1 ? 'invisible' : isComplete ? 'bg-zinc-900' : 'bg-zinc-200'
					)}
				></div>
			</div>
			<p
				class={cn(
					'text-xs font-medium',
					isCurrent ? 'text-zinc-950' : isComplete ? 'text-zinc-500' : 'text-zinc-300'
				)}
			>
				{step.label}
			</p>
			{#if isCurrent}
				<p class="text-[10px] text-zinc-500">{step.desc}</p>
			{/if}
		</div>
	{/each}
</div>
