import { displayAccountId, type AuthUserWithAccountId } from '$lib/server/auth/accountIds';
import { getCachedAppSettings } from '$lib/server/services/tokyoLeagueSetupService';
import type { LayoutServerLoad } from './$types';

const userRole = (user: App.Locals['user']) => {
	if (user && 'role' in user && typeof user.role === 'string') return user.role;
	return 'participant';
};

export const load: LayoutServerLoad = async ({ locals }) => ({
	user: locals.user
		? {
				id: locals.user.id,
				name: locals.user.name,
				accountId: displayAccountId(locals.user as AuthUserWithAccountId),
				role: userRole(locals.user)
			}
		: null,
	authProfile: locals.authProfile ?? null,
	tournamentDate: (await getCachedAppSettings()).tournamentDate
});
