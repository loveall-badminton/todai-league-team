<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { FormActionResult } from '$lib/types/forms';

	let {
		result,
		variant = 'success'
	}: {
		result: FormActionResult | null | undefined;
		variant?: 'success' | 'error' | 'warning';
	} = $props();

	$effect(() => {
		const msg = result?.message;
		if (!msg) return;
		untrack(() => {
			if (variant === 'error') toast.error(msg);
			else if (variant === 'warning') toast.warning(msg);
			else toast.success(msg);
		});
	});
</script>
