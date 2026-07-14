import { describe, expect, test, vi } from 'vitest';
import { checkPartySessionAuthorized } from './wsAuth';

function makeRequest(headers: Record<string, string> = {}): Request {
	return new Request('https://example.com/parties/live-board/live-board', { headers });
}

describe('checkPartySessionAuthorized', () => {
	test('rejects requests with no cookie header at all', async () => {
		const appFetch = vi.fn();
		const authorized = await checkPartySessionAuthorized(makeRequest(), appFetch);

		expect(authorized).toBe(false);
		expect(appFetch).not.toHaveBeenCalled();
	});

	test('authorizes when the internal get-session call returns a user', async () => {
		const appFetch = vi.fn(async (req: Request) => {
			expect(new URL(req.url).pathname).toBe('/api/auth/get-session');
			expect(req.headers.get('cookie')).toBe('better-auth.session_token=abc');
			return Response.json({ session: { id: 's1' }, user: { id: 'u1' } });
		});

		const authorized = await checkPartySessionAuthorized(
			makeRequest({ cookie: 'better-auth.session_token=abc' }),
			appFetch
		);

		expect(authorized).toBe(true);
	});

	test('rejects when get-session responds with no user (unauthenticated)', async () => {
		const appFetch = vi.fn(async () => Response.json(null));

		const authorized = await checkPartySessionAuthorized(
			makeRequest({ cookie: 'better-auth.session_token=expired' }),
			appFetch
		);

		expect(authorized).toBe(false);
	});

	test('rejects when the internal call fails or errors', async () => {
		const failing = vi.fn(async () => new Response('error', { status: 500 }));
		const throwing = vi.fn(async () => {
			throw new Error('network error');
		});

		expect(await checkPartySessionAuthorized(makeRequest({ cookie: 'x=1' }), failing)).toBe(false);
		expect(await checkPartySessionAuthorized(makeRequest({ cookie: 'x=1' }), throwing)).toBe(false);
	});
});
