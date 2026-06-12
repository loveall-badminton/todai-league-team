import { requireAdmin } from '$lib/server/auth/access';
import { listManagedAccounts } from '$lib/server/auth/accountManagement';
import { getRequestDb } from '$lib/server/db/request';
import { listTeams } from '$lib/server/repositories/tokyoLeagueRepository';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const db = getRequestDb(event.platform);
	const [teams, accounts] = await Promise.all([
		listTeams(db),
		listManagedAccounts({ db, headers: event.request.headers, auth: event.locals.auth })
	]);

	return { teams, accounts };
};
