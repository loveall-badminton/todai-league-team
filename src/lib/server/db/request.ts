import { error } from '@sveltejs/kit';
import { getDb } from './client';
import { getRequestEvent } from '$app/server';

export function getRequestDb() {
	const { platform } = getRequestEvent();
	if (!platform?.env.DB) {
		error(500, 'D1 binding DB is not available');
	}
	return getDb(platform.env.DB);
}
