import { routePartykitRequest } from '$lib/server/realtime/partyRouter';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, platform }) => {
	const response = await routePartykitRequest(platform!.env, request);
	if (response) return response;
	return new Response('Not found', { status: 404 });
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const response = await routePartykitRequest(platform!.env, request);
	if (response) return response;
	return new Response('Not found', { status: 404 });
};
