import { Server, type Connection } from 'partyserver';
import { liveMessageSchema, type LiveMessage } from '$lib/realtime/channels';
import * as v from 'valibot';

export class LiveBoard extends Server<Env> {
	static options = { hibernate: true };

	async onConnect(connection: Connection) {
		const hello: LiveMessage = { type: 'hello', at: new Date().toISOString() };
		connection.send(JSON.stringify(hello));
	}

	async onRequest(request: Request): Promise<Response> {
		if (request.method === 'POST') {
			let raw: unknown;
			try {
				raw = await request.json();
			} catch {
				return Response.json({ ok: false, error: 'invalid json' }, { status: 400 });
			}
			const parsed = v.safeParse(liveMessageSchema, raw);
			if (!parsed.success) {
				return Response.json({ ok: false, error: 'invalid message' }, { status: 400 });
			}
			this.broadcast(JSON.stringify(parsed.output));
			return Response.json({ ok: true });
		}
		return new Response('Not found', { status: 404 });
	}

	async onClose() {
		// no-op
	}

	async onError() {
		// no-op
	}
}
