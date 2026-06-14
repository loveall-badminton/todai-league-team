import { error, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { authUserProfiles, matches, officiatingAssignments, rubbers } from '$lib/server/db/schema';
import { getRequestEvent } from '$app/server';
import { getRequestDb } from '$lib/server/db/request';

export type AppRole = 'admin' | 'participant' | 'team';

export type AuthProfile = {
	userId: string;
	accountType: AppRole;
	teamId: string | null;
	displayName: string | null;
};

type RoleCarrier = {
	id: string;
	role?: string | null;
};

export function normalizeAppRole(role: string | null | undefined): AppRole {
	if (role === 'admin' || role === 'team' || role === 'participant') return role;
	return 'participant';
}

export function isAdminUser(user: RoleCarrier | null | undefined): boolean {
	return normalizeAppRole(user?.role) === 'admin';
}

export function canAccessTeamLineup(params: {
	user: RoleCarrier | null | undefined;
	profile: AuthProfile | null | undefined;
	teamId: string;
}): boolean {
	if (isAdminUser(params.user)) return true;
	return params.profile?.accountType === 'team' && params.profile.teamId === params.teamId;
}

// Per-isolate cache: shared across requests within the same Cloudflare Workers instance
const _profileCache = new Map<string, { profile: AuthProfile; expiresAt: number }>();
const PROFILE_CACHE_TTL_MS = 60_000;

export function invalidateAuthProfile(userId: string): void {
	_profileCache.delete(userId);
}

export async function getAuthProfile(user: RoleCarrier): Promise<AuthProfile> {
	const now = Date.now();
	const cached = _profileCache.get(user.id);
	if (cached && cached.expiresAt > now) return cached.profile;

	const db = getRequestDb();
	const existing = await db.query.authUserProfiles.findFirst({
		where: eq(authUserProfiles.userId, user.id)
	});

	const profile: AuthProfile = existing
		? {
				userId: existing.userId,
				accountType: existing.accountType,
				teamId: existing.teamId,
				displayName: existing.displayName
			}
		: {
				userId: user.id,
				accountType: normalizeAppRole(user.role),
				teamId: null,
				displayName: null
			};

	_profileCache.set(user.id, { profile, expiresAt: now + PROFILE_CACHE_TTL_MS });
	return profile;
}

export function requireUser() {
	const event = getRequestEvent();
	if (event.locals.user) return event.locals.user;
	const redirectTo = `${event.url.pathname}${event.url.search}`;
	redirect(303, `/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`);
}

export function requireAdmin() {
	const user = requireUser();
	if (!isAdminUser(user)) error(403, '運営アカウントでログインしてください');
	return user;
}

export function requireTeamLineupAccess(teamId: string) {
	const event = getRequestEvent();
	const user = requireUser();
	if (!canAccessTeamLineup({ user, profile: event.locals.authProfile, teamId })) {
		error(403, 'このチームのオーダー提出権限がありません');
	}
	return user;
}

export async function getAssignedOfficiatingTeamId(matchId: string): Promise<string | null> {
	const db = getRequestDb();
	const [row] = await db
		.select({
			assignedTeamId: officiatingAssignments.assignedTeamId
		})
		.from(matches)
		.innerJoin(rubbers, eq(rubbers.id, matches.rubberId))
		.leftJoin(
			officiatingAssignments,
			and(
				eq(officiatingAssignments.tieId, rubbers.tieId),
				eq(officiatingAssignments.role, 'umpire_team')
			)
		)
		.where(eq(matches.id, matchId))
		.limit(1);

	return row?.assignedTeamId ?? null;
}

export async function requireRefereeMatchAccess(matchId: string) {
	const event = getRequestEvent();
	const user = requireUser();
	if (isAdminUser(user)) return user;

	const assignedTeamId = await getAssignedOfficiatingTeamId(matchId);
	if (
		!assignedTeamId ||
		!canAccessTeamLineup({ user, profile: event.locals.authProfile, teamId: assignedTeamId })
	) {
		error(403, 'この試合の審判権限がありません');
	}

	return user;
}
