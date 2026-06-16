import sveltekitWorker from 'sveltekit-worker';
import { routePartykitRequest } from 'partyserver';
import { LiveBoard } from './parties/LiveBoard';

export { LiveBoard };

export default {
	async fetch(request, env, ctx) {
		const partyResponse = await routePartykitRequest(request, env);
		if (partyResponse) return partyResponse;
		return sveltekitWorker.fetch(request, env, ctx);
	}
} satisfies ExportedHandler<Env>;
