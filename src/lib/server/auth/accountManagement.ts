import { asc, eq, sql } from 'drizzle-orm';
import { authUserProfiles, teams } from '$lib/server/db/schema';
import type { AppDb } from '$lib/server/db/client';
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

export async function listAuthUsers(headers: Headers, auth: App.Locals['auth']) {
	const result = await auth.api.listUsers({
		headers,
		query: { limit: 200, offset: 0, sortBy: 'name', sortDirection: 'asc' }
	});
	return (result.users as AuthUserWithAccountId[]) ?? [];
}

export async function listManagedAccounts(params: {
	db: AppDb;
	headers: Headers;
	auth: App.Locals['auth'];
}): Promise<ManagedAccount[]> {
	const [profiles, users] = await Promise.all([
		params.db.select().from(authUserProfiles).orderBy(asc(authUserProfiles.accountType)),
		listAuthUsers(params.headers, params.auth)
	]);

	const profilesByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));

	return users.map((user) => ({
		id: user.id,
		accountId: displayAccountId(user),
		name: user.name ?? '',
		role: user.role ?? 'user',
		profile: profilesByUserId.get(user.id) ?? null
	}));
}

export async function assertTeamExists(db: AppDb, teamId: string | null) {
	if (!teamId) return;
	const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
	if (!team) throw new Error('チームが見つかりません。');
}

export async function upsertAuthProfile(
	db: AppDb,
	params: {
		userId: string;
		accountType: AccountType;
		teamId: string | null;
		displayName: string;
		now: string;
	}
) {
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
	db: AppDb;
	auth: App.Locals['auth'];
	headers: Headers;
	accountId: string;
	name: string;
	password: string;
	accountType: AccountType;
	teamId: string | null;
	now: string;
}) {
	const accountId = normalizeAccountId(params.accountId);
	await assertTeamExists(params.db, params.teamId);

	const created = await params.auth.api.createUser({
		headers: params.headers,
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

	await upsertAuthProfile(params.db, {
		userId: created.user.id,
		accountType: params.accountType,
		teamId: params.teamId,
		displayName: params.name,
		now: params.now
	});
}
