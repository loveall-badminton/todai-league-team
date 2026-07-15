import * as v from 'valibot';

const SessionResponseSchema = v.object({
	user: v.optional(v.nullable(v.unknown()))
});

const SESSION_TOKEN_COOKIES = [
	'better-auth.session_token',
	'__Secure-better-auth.session_token'
] as const;

function hasSessionToken(cookieHeader: string): boolean {
	for (const part of cookieHeader.split(';')) {
		const key = part.trim().split('=')[0];
		if ((SESSION_TOKEN_COOKIES as readonly string[]).includes(key)) return true;
	}
	return false;
}

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
	// セッショントークン Cookie が無ければ、SvelteKit ハンドラを起動せず即座に拒否する。
	// (未認証の WS アップグレード試行でアプリを毎回スピンアップさせない)
	if (!hasSessionToken(cookie)) return false;

	try {
		const sessionRequest = new Request(new URL('/api/auth/get-session', request.url), {
			headers: { cookie }
		});
		const response = await appFetch(sessionRequest);
		if (!response.ok) return false;
		const raw = await response.json().catch(() => null);
		const parsed = v.safeParse(SessionResponseSchema, raw);
		return parsed.success && parsed.output.user != null;
	} catch {
		return false;
	}
}
