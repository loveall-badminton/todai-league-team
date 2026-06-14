import { asc, eq, sql } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { getRequestDb } from '$lib/server/db/request';
import { authUserProfiles, teams } from '$lib/server/db/schema';
import { user } from '$lib/server/db/auth.schema';
import {
	accountIdToInternalEmail,
	displayAccountId,
	normalizeAccountId,
	type AuthUserWithAccountId
} from './accountIds';

export type AccountType = 'admin' | 'participant' | 'team';

export type ManagedAccount = {
	id: string;
	accountId: string;
	name: string;
	role: string;
	profile: typeof authUserProfiles.$inferSelect | null;
};

export function roleForAccountType(accountType: AccountType): 'admin' | 'user' {
	return accountType === 'admin' ? 'admin' : 'user';
}

export function readAccountType(formData: FormData): AccountType {
	const value = String(formData.get('accountType') ?? '').trim();
	if (value === 'admin' || value === 'participant' || value === 'team') return value;
	throw new Error('アカウント種別が不正です。');
}

async function listAuthUsers() {
	const { locals, request } = getRequestEvent();
	const result = await locals.auth.api.listUsers({
		headers: request.headers,
		query: { limit: 200, offset: 0, sortBy: 'name', sortDirection: 'asc' }
	});
	return (result.users as AuthUserWithAccountId[]) ?? [];
}

export async function listManagedAccounts(): Promise<ManagedAccount[]> {
	const db = getRequestDb();
	const [profiles, users] = await Promise.all([
		db.select().from(authUserProfiles).orderBy(asc(authUserProfiles.accountType)),
		listAuthUsers()
	]);

	const profilesByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));

	return users.map((u) => ({
		id: u.id,
		accountId: displayAccountId(u),
		name: u.name ?? '',
		role: u.role ?? 'user',
		profile: profilesByUserId.get(u.id) ?? null
	}));
}

export async function assertTeamExists(teamId: string | null) {
	if (!teamId) return;
	const db = getRequestDb();
	const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
	if (!team) throw new Error('チームが見つかりません。');
}

export async function upsertAuthProfile(params: {
	userId: string;
	accountType: AccountType;
	teamId: string | null;
	displayName: string;
	now: string;
}) {
	const db = getRequestDb();
	await db
		.insert(authUserProfiles)
		.values({
			userId: params.userId,
			accountType: params.accountType,
			teamId: params.teamId,
			displayName: params.displayName,
			createdAt: params.now,
			updatedAt: params.now
		})
		.onConflictDoUpdate({
			target: authUserProfiles.userId,
			set: {
				accountType: params.accountType,
				teamId: params.teamId,
				displayName: params.displayName,
				updatedAt: sql`excluded.updated_at`
			}
		});
}

export async function createManagedAccount(params: {
	accountId: string;
	name: string;
	password: string;
	accountType: AccountType;
	teamId: string | null;
	now: string;
}) {
	const { locals, request } = getRequestEvent();
	const accountId = normalizeAccountId(params.accountId);
	await assertTeamExists(params.teamId);

	const created = await locals.auth.api.createUser({
		headers: request.headers,
		body: {
			email: accountIdToInternalEmail(accountId),
			password: params.password,
			name: params.name,
			role: roleForAccountType(params.accountType),
			data: {
				username: accountId,
				displayUsername: accountId
			}
		}
	});

	await upsertAuthProfile({
		userId: created.user.id,
		accountType: params.accountType,
		teamId: params.teamId,
		displayName: params.name,
		now: params.now
	});
}

/**
 * Bootstrap the very first admin account.
 *
 * `auth.api.createUser` (admin plugin) requires the caller to already be an
 * authenticated admin, which is impossible when zero users exist.
 * Instead we use the public `signUpEmail` endpoint and then patch `role` to
 * 'admin' directly in the DB.
 */
export async function deleteAuthProfile(userId: string) {
	const db = getRequestDb();
	await db.delete(authUserProfiles).where(eq(authUserProfiles.userId, userId));
}

export async function bootstrapAdminAccount(params: {
	accountId: string;
	name: string;
	password: string;
	now: string;
}) {
	const { locals } = getRequestEvent();
	const db = getRequestDb();
	const accountId = normalizeAccountId(params.accountId);

	const result = await locals.auth.api.signUpEmail({
		body: {
			email: accountIdToInternalEmail(accountId),
			password: params.password,
			name: params.name,
			username: accountId,
			displayUsername: accountId
		}
	});

	const userId = result.user.id;

	// signUpEmail does not accept `role`, so patch it directly.
	await db.update(user).set({ role: 'admin' }).where(eq(user.id, userId));

	await upsertAuthProfile({
		userId,
		accountType: 'admin',
		teamId: null,
		displayName: params.name,
		now: params.now
	});
}
