import sveltekitWorker from 'sveltekit-worker';
import { routePartykitRequest } from 'partyserver';
import { LiveBoard } from './parties/LiveBoard';
import { MatchActionCoordinator } from './parties/MatchActionCoordinator';
import { checkPartySessionAuthorized } from '$lib/server/realtime/wsAuth';

export { LiveBoard, MatchActionCoordinator };

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		if (url.pathname.startsWith('/parties/')) {
			// routePartykitRequest は SvelteKit のルーティング(および hooks.server.ts の
			// セッション検証)より手前でハンドルされるため、ここで明示的に認証する。
			const authorized = await checkPartySessionAuthorized(request, async (req) =>
				sveltekitWorker.fetch(req as Parameters<typeof sveltekitWorker.fetch>[0], env, ctx)
			);
			if (!authorized) return new Response('Unauthorized', { status: 401 });
		}
		const partyResponse = await routePartykitRequest(request, env);
		if (partyResponse) return partyResponse;

		return sveltekitWorker.fetch(request, env, ctx);
	}
} satisfies ExportedHandler<Env>;
