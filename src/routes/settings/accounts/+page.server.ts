import { requireAdmin } from '$lib/server/auth/access';
import { listManagedAccounts } from '$lib/server/auth/accountManagement';
import { listTeams } from '$lib/server/repositories/tokyoLeagueRepository';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	requireAdmin();
	const [teams, accounts] = await Promise.all([listTeams(), listManagedAccounts()]);
	return { teams, accounts };
};
