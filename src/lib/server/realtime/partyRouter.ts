/**
 * partyserver の routePartykitRequest に対する動的インポートラッパー。
 *
 * partyserver はトップレベルで `import { DurableObject, env } from "cloudflare:workers"`
 * を行っており、Node.js が cloudflare: プロトコルを解決できないため Vite SSR ビルドが
 * 失敗する。動的インポートを使うことで Vite が SSR ビルド時にモジュールを処理するのを
 * 回避し、ランタイム（Cloudflare Workers）では wrangler が正しくバンドルする。
 */
export async function routePartykitRequest(env: Env, request: Request): Promise<Response | null> {
	const mod = await import('partyserver');
	return mod.routePartykitRequest(request, env);
}
