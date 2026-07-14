/**
 * `/parties/*` (LiveBoard WebSocket / 内部キャッシュ API) は wrangler.jsonc の
 * main エントリ (src/worker.ts) 内で routePartykitRequest により SvelteKit の
 * ルーティングより手前で処理されるため、hooks.server.ts のセッション検証を
 * 一切通らない。アプリ全体が「ログイン必須」という前提(hooks.server.ts の
 * PUBLIC_PATHS は /auth/login, /auth/bootstrap のみ)に反してここだけ未認証で
 * 到達可能になっていたため、SvelteKit 側の /api/auth/get-session に内部リクエストを
 * 投げて認証状態を確認する。
 */
export async function checkPartySessionAuthorized(
	request: Request,
	appFetch: (req: Request) => Promise<Response>
): Promise<boolean> {
	const cookie = request.headers.get('cookie');
	if (!cookie) return false;

	try {
		const sessionRequest = new Request(new URL('/api/auth/get-session', request.url), {
			headers: { cookie }
		});
		const response = await appFetch(sessionRequest);
		if (!response.ok) return false;
		const body = (await response.json().catch(() => null)) as { user?: unknown } | null;
		return !!body && typeof body === 'object' && body.user != null;
	} catch {
		return false;
	}
}
