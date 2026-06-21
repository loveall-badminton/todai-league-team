import { APIError } from 'better-auth/api';

export function actionErrorMessage(err: unknown, fallback = '処理に失敗しました'): string {
	if (err instanceof APIError) return err.message || fallback;
	return err instanceof Error ? err.message : fallback;
}
