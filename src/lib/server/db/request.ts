import { error } from '@sveltejs/kit';
import { getDb } from './client';

export function getRequestDb(platform: App.Platform | undefined) {
	if (!platform?.env.DB) {
		error(500, 'D1 binding DB is not available');
	}
	return getDb(platform.env.DB);
}
