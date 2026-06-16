import { Server, type Connection, type ConnectionContext } from 'partyserver';

export class LiveBoard extends Server<Env> {
	static options = { hibernate: true };

	async onConnect(connection: Connection, ctx: ConnectionContext) {
		console.log('[LiveBoard] onConnect', {
			connectionId: connection.id,
			name: this.name,
			url: ctx.request.url,
			at: new Date().toISOString()
		});
		connection.send(JSON.stringify({ type: 'hello', at: new Date().toISOString() }));
	}

	async onRequest(request: Request): Promise<Response> {
		console.log('[LiveBoard] onRequest', {
			method: request.method,
			name: this.name,
			url: request.url,
			at: new Date().toISOString()
		});
		if (request.method === 'POST') {
			const message = await request.json();
			const count = [...this.getConnections()].length;
			console.log('[LiveBoard] broadcast', {
				name: this.name,
				message,
				clientCount: count,
				at: new Date().toISOString()
			});
			this.broadcast(JSON.stringify(message));
			return Response.json({ ok: true, clients: count });
		}
		return new Response('Not found', { status: 404 });
	}

	async onClose(connection: Connection, code: number, reason: string, wasClean: boolean) {
		console.log('[LiveBoard] onClose', {
			connectionId: connection.id,
			name: this.name,
			code,
			reason,
			wasClean,
			remaining: [...this.getConnections()].length,
			at: new Date().toISOString()
		});
	}

	async onError(connection: Connection, error: unknown) {
		console.log('[LiveBoard] onError', {
			connectionId: connection.id,
			name: this.name,
			error: String(error),
			at: new Date().toISOString()
		});
	}
}
