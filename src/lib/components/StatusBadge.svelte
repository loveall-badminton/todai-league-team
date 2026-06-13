<script lang="ts">
	import { tieStatusLabel } from '$lib/domain/tokyoLeagueLabels';
	import { tv } from 'tailwind-variants';
	import { cn } from '$lib/utils/cn';

	let { status }: { status: string } = $props();

	const badgeStatuses = {
		scheduled: true,
		lineup_pending: true,
		lineup_submitted: true,
		ready: true,
		playing: true,
		interval: true,
		suspended: true,
		finished: true,
		forfeited: true,
		retired: true,
		confirmed: true,
		cancelled: true
	} as const;

	const badgeStyles = tv({
		base: 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
		variants: {
			status: {
				scheduled: 'bg-zinc-100 text-zinc-700',
				lineup_pending: 'bg-amber-100 text-amber-800',
				lineup_submitted: 'bg-blue-100 text-blue-800',
				ready: 'bg-violet-100 text-violet-800',
				playing: 'bg-green-100 text-green-800',
				interval: 'bg-amber-100 text-amber-800',
				suspended: 'bg-amber-100 text-amber-800',
				finished: 'bg-orange-100 text-orange-800',
				forfeited: 'bg-red-100 text-red-800',
				retired: 'bg-red-100 text-red-800',
				confirmed: 'bg-emerald-100 text-emerald-800',
				cancelled: 'bg-red-100 text-red-800'
			}
		},
		defaultVariants: {
			status: 'scheduled'
		}
	});

	type BadgeStatus = keyof typeof badgeStatuses;
	let badgeStatus = $derived((status in badgeStatuses ? status : 'scheduled') as BadgeStatus);
</script>

<span class={cn(badgeStyles({ status: badgeStatus }))}>
	{tieStatusLabel(status)}
</span>
