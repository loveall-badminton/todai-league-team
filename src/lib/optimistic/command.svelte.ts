import { toast } from 'svelte-sonner';
import type { ApplyResult } from './overlay.svelte';

/**
 * コマンド実行 + エラーハンドリング + OptimisticOverlay/PatchCollection への
 * payload 適用を 1 つの呼び出しにまとめるラッパー。
 *
 * - エラー時は svelte-sonner の toast.error を表示
 * - applyPayload が 'refresh' を返した場合は onRefresh() を同期的に呼ぶ
 */
export async function executeOptimistic<TPayload>(
	commandFn: () => Promise<{ error?: string; payload?: TPayload }>,
	applyPayload: (payload: TPayload) => ApplyResult,
	onRefresh: () => void
): Promise<void> {
	try {
		const result = await commandFn();
		if (result.error) {
			toast.error(result.error);
			return;
		}
		if (result.payload !== undefined) {
			const r = applyPayload(result.payload);
			if (r === 'refresh') onRefresh();
		}
	} catch (err) {
		toast.error(err instanceof Error ? err.message : '操作に失敗しました');
	}
}
