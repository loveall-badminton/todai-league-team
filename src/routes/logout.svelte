<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { signOut } from './signout.remote';

	let { class: className }: { class?: string } = $props();
	let uid = $props.id();
</script>

<form {...signOut.for(uid)} class="border-t border-border p-3">
	<button
		class={cn(
			'w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-emphasis hover:bg-zinc-100',
			className
		)}
	>
		ログアウト
	</button>
</form>
