import { APIError } from 'better-auth/api';

export function apiErrorMessage(err: unknown, fallback: string): string {
	if (err instanceof APIError) return err.message || fallback;
	return err instanceof Error ? err.message : fallback;
}

export function actionErrorMessage(err: unknown, fallback = '処理に失敗しました'): string {
	return err instanceof Error ? err.message : fallback;
}
