<script lang="ts">
	import { toast } from 'svelte-sonner';

	let {
		result,
		variant = 'success'
	}: {
		result: { message?: string } | null | undefined;
		variant?: 'success' | 'error' | 'warning';
	} = $props();

	$effect(() => {
		const msg = result?.message;
		if (!msg) return;
		if (variant === 'error') toast.error(msg);
		else if (variant === 'warning') toast.warning(msg);
		else toast.success(msg);
	});
</script>
