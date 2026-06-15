import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, type TestDb } from '$lib/server/testDb';
import {
	authUserProfiles,
	matches,
	officiatingAssignments,
	rubbers,
	scoringRules,
	teams,
	ties,
	tournaments,
	user
} from '$lib/server/db/schema';

const mockState = vi.hoisted(() => ({
	db: null as TestDb['db'] | null,
	event: {
		locals: {} as {
			user?: { id: string; role?: string | null } | null;
			authProfile?: {
				userId: string;
				accountType: 'admin' | 'participant' | 'team';
				teamId: string | null;
				displayName: string | null;
			} | null;
		},
		url: new URL('https://example.test/')
	}
}));

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: () => {
		if (!mockState.db) throw new Error('test db is not initialized');
		return mockState.db;
	}
}));

vi.mock('$app/server', () => ({
	getRequestEvent: () => mockState.event
}));

import {
	canAccessTeamLineup,
	getAssignedOfficiatingTeamId,
	getAssignedOfficiatingTeamIds,
	getAuthProfile,
	invalidateAuthProfile,
	isAdminUser,
	normalizeAppRole,
	requireAdmin,
	requireRefereeMatchAccess,
	requireTeamLineupAccess,
	requireUser
} from './access';

let testDb: TestDb;
const now = '2026-06-15T01:00:00.000Z';

beforeEach(() => {
	testDb = createTestDb();
	mockState.db = testDb.db;
	mockState.event = { locals: {}, url: new URL('https://example.test/protected?x=1') };
});

afterEach(() => {
	mockState.db = null;
	testDb.close();
	invalidateAuthProfile('u-db');
	invalidateAuthProfile('u-fallback');
	invalidateAuthProfile('u-cache');
});

// ─── normalizeAppRole ────────────────────────────────────────────────────────

describe('normalizeAppRole', () => {
	test('returns the role unchanged for valid roles', () => {
		expect(normalizeAppRole('admin')).toBe('admin');
		expect(normalizeAppRole('team')).toBe('team');
		expect(normalizeAppRole('participant')).toBe('participant');
	});

	test('falls back to participant for unknown role strings', () => {
		expect(normalizeAppRole('superuser')).toBe('participant');
		expect(normalizeAppRole('guest')).toBe('participant');
		expect(normalizeAppRole('')).toBe('participant');
	});

	test('falls back to participant for null', () => {
		expect(normalizeAppRole(null)).toBe('participant');
	});

	test('falls back to participant for undefined', () => {
		expect(normalizeAppRole(undefined)).toBe('participant');
	});
});

// ─── isAdminUser ─────────────────────────────────────────────────────────────

describe('isAdminUser', () => {
	test('returns true for an admin user', () => {
		expect(isAdminUser({ id: 'u1', role: 'admin' })).toBe(true);
	});

	test('returns false for a team user', () => {
		expect(isAdminUser({ id: 'u1', role: 'team' })).toBe(false);
	});

	test('returns false for a participant user', () => {
		expect(isAdminUser({ id: 'u1', role: 'participant' })).toBe(false);
	});

	test('returns false for a user with an unrecognised role', () => {
		expect(isAdminUser({ id: 'u1', role: 'manager' })).toBe(false);
	});

	test('returns false for a user with a null role', () => {
		expect(isAdminUser({ id: 'u1', role: null })).toBe(false);
	});

	test('returns false for null user', () => {
		expect(isAdminUser(null)).toBe(false);
	});

	test('returns false for undefined user', () => {
		expect(isAdminUser(undefined)).toBe(false);
	});
});

// ─── canAccessTeamLineup ─────────────────────────────────────────────────────

describe('canAccessTeamLineup', () => {
	test('grants access to admin users regardless of team', () => {
		expect(
			canAccessTeamLineup({
				user: { id: 'u1', role: 'admin' },
				profile: null,
				teamId: 'team-x'
			})
		).toBe(true);
	});

	test('grants access to a team account assigned to the requested team', () => {
		expect(
			canAccessTeamLineup({
				user: { id: 'u1', role: 'team' },
				profile: { userId: 'u1', accountType: 'team', teamId: 'team-a', displayName: null },
				teamId: 'team-a'
			})
		).toBe(true);
	});

	test('denies access to a team account assigned to a different team', () => {
		expect(
			canAccessTeamLineup({
				user: { id: 'u1', role: 'team' },
				profile: { userId: 'u1', accountType: 'team', teamId: 'team-b', displayName: null },
				teamId: 'team-a'
			})
		).toBe(false);
	});

	test('denies access to a participant profile', () => {
		expect(
			canAccessTeamLineup({
				user: { id: 'u1', role: 'participant' },
				profile: { userId: 'u1', accountType: 'participant', teamId: null, displayName: null },
				teamId: 'team-a'
			})
		).toBe(false);
	});

	test('denies access when profile is null and user is not admin', () => {
		expect(
			canAccessTeamLineup({
				user: { id: 'u1', role: 'team' },
				profile: null,
				teamId: 'team-a'
			})
		).toBe(false);
	});

	test('denies access when team account has null teamId', () => {
		expect(
			canAccessTeamLineup({
				user: { id: 'u1', role: 'team' },
				profile: { userId: 'u1', accountType: 'team', teamId: null, displayName: null },
				teamId: 'team-a'
			})
		).toBe(false);
	});
});

// ─── getAuthProfile ─────────────────────────────────────────────────────────

describe('getAuthProfile', () => {
	test('returns persisted profile from DB and caches it until invalidated', async () => {
		await testDb.db.insert(teams).values({
			id: 'team-a',
			name: 'Team A',
			groupCode: 'A',
			createdAt: now,
			updatedAt: now
		});
		await testDb.db.insert(user).values({
			id: 'u-db',
			name: 'User DB',
			email: 'db@example.test',
			emailVerified: false
		});
		await testDb.db.insert(authUserProfiles).values({
			userId: 'u-db',
			accountType: 'team',
			teamId: 'team-a',
			displayName: 'Team Account',
			createdAt: now,
			updatedAt: now
		});

		const first = await getAuthProfile({ id: 'u-db', role: 'participant' });
		await testDb.db
			.update(authUserProfiles)
			.set({ displayName: 'Changed', updatedAt: now })
			.where(eq(authUserProfiles.userId, 'u-db'));
		const cached = await getAuthProfile({ id: 'u-db', role: 'participant' });
		invalidateAuthProfile('u-db');
		const refreshed = await getAuthProfile({ id: 'u-db', role: 'participant' });

		expect(first).toEqual({
			userId: 'u-db',
			accountType: 'team',
			teamId: 'team-a',
			displayName: 'Team Account'
		});
		expect(cached.displayName).toBe('Team Account');
		expect(refreshed.displayName).toBe('Changed');
	});

	test('falls back to normalized user role when profile row is missing', async () => {
		const profile = await getAuthProfile({ id: 'u-fallback', role: 'unknown' });

		expect(profile).toEqual({
			userId: 'u-fallback',
			accountType: 'participant',
			teamId: null,
			displayName: null
		});
	});
});

// ─── require helpers ────────────────────────────────────────────────────────

describe('require helpers', () => {
	test('requireUser returns current user or redirects to login with redirectTo', () => {
		mockState.event.locals.user = { id: 'admin', role: 'admin' };
		expect(requireUser()).toEqual({ id: 'admin', role: 'admin' });

		mockState.event.locals.user = null;
		expect(() => requireUser()).toThrow(expect.objectContaining({ status: 303 }));
		expect(() => requireUser()).toThrow(
			expect.objectContaining({
				location: '/auth/login?redirectTo=%2Fprotected%3Fx%3D1'
			})
		);
	});

	test('requireAdmin permits admin users and rejects non-admin users', () => {
		mockState.event.locals.user = { id: 'admin', role: 'admin' };
		expect(requireAdmin()).toEqual({ id: 'admin', role: 'admin' });

		mockState.event.locals.user = { id: 'team-user', role: 'team' };
		expect(() => requireAdmin()).toThrow(expect.objectContaining({ status: 403 }));
	});

	test('requireTeamLineupAccess checks auth profile team assignment', () => {
		mockState.event.locals.user = { id: 'team-user', role: 'team' };
		mockState.event.locals.authProfile = {
			userId: 'team-user',
			accountType: 'team',
			teamId: 'team-a',
			displayName: null
		};

		expect(requireTeamLineupAccess('team-a')).toEqual({ id: 'team-user', role: 'team' });
		expect(() => requireTeamLineupAccess('team-b')).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});
});

// ─── referee access ─────────────────────────────────────────────────────────

describe('referee match access', () => {
	async function seedAssignedMatch() {
		await testDb.db
			.insert(scoringRules)
			.values({
				id: 'GROUP_15',
				code: 'GROUP_15',
				name: 'Group 15',
				maxGames: 3,
				gamesToWin: 2,
				pointsToWin: 15,
				winBy: 2,
				maxPoints: 21,
				midGameIntervalPoint: 8,
				createdAt: now,
				updatedAt: now
			})
			.onConflictDoNothing();
		await testDb.db
			.insert(teams)
			.values([
				{ id: 'team-a', name: 'Team A', groupCode: 'A', createdAt: now, updatedAt: now },
				{ id: 'team-b', name: 'Team B', groupCode: 'A', createdAt: now, updatedAt: now }
			])
			.onConflictDoNothing();
		await testDb.db.insert(tournaments).values({
			id: 'tournament-1',
			name: 'Tournament',
			createdAt: now,
			updatedAt: now
		});
		await testDb.db.insert(ties).values({
			id: 'tie-1',
			tieCode: 'A-1',
			phase: 'group_a',
			groupCode: 'A',
			teamAId: 'team-a',
			teamBId: 'team-b',
			createdAt: now,
			updatedAt: now
		});
		await testDb.db.insert(rubbers).values({
			id: 'rubber-1',
			tieId: 'tie-1',
			code: 'WD1',
			discipline: 'WD',
			displayOrder: 1,
			scoringRuleId: 'GROUP_15',
			createdAt: now,
			updatedAt: now
		});
		await testDb.db.insert(matches).values({
			id: 'match-1',
			tournamentId: 'tournament-1',
			discipline: 'WD',
			rubberId: 'rubber-1',
			createdAt: now,
			updatedAt: now
		});
		await testDb.db.insert(officiatingAssignments).values({
			id: 'assignment-1',
			tieId: 'tie-1',
			assignedTeamId: 'team-b',
			role: 'umpire_team',
			createdAt: now,
			updatedAt: now
		});
	}

	test('getAssignedOfficiatingTeamId returns assigned umpire team or null', async () => {
		await testDb.db
			.insert(teams)
			.values({ id: 'team-a', name: 'Team A', createdAt: now, updatedAt: now });
		await testDb.db.insert(tournaments).values({
			id: 'tournament-empty',
			name: 'Tournament',
			createdAt: now,
			updatedAt: now
		});
		await testDb.db.insert(matches).values({
			id: 'match-without-rubber',
			tournamentId: 'tournament-empty',
			discipline: 'MS',
			createdAt: now,
			updatedAt: now
		});
		expect(await getAssignedOfficiatingTeamId('match-without-rubber')).toBeNull();

		await seedAssignedMatch();
		expect(await getAssignedOfficiatingTeamId('match-1')).toBe('team-b');
	});

	test('getAssignedOfficiatingTeamIds returns every assigned umpire team', async () => {
		await seedAssignedMatch();
		await testDb.db.insert(teams).values({
			id: 'team-c',
			name: 'Team C',
			groupCode: 'A',
			createdAt: now,
			updatedAt: now
		});
		await testDb.db.insert(officiatingAssignments).values({
			id: 'assignment-2',
			tieId: 'tie-1',
			assignedTeamId: 'team-c',
			role: 'umpire_team',
			createdAt: now,
			updatedAt: now
		});

		expect(await getAssignedOfficiatingTeamIds('match-1')).toEqual(['team-b', 'team-c']);
	});

	test('requireRefereeMatchAccess allows admins and assigned team accounts', async () => {
		mockState.event.locals.user = { id: 'admin', role: 'admin' };
		await expect(requireRefereeMatchAccess('missing-match')).resolves.toEqual({
			id: 'admin',
			role: 'admin'
		});

		await seedAssignedMatch();
		mockState.event.locals.user = { id: 'team-user', role: 'team' };
		mockState.event.locals.authProfile = {
			userId: 'team-user',
			accountType: 'team',
			teamId: 'team-b',
			displayName: null
		};

		await expect(requireRefereeMatchAccess('match-1')).resolves.toEqual({
			id: 'team-user',
			role: 'team'
		});
	});

	test('requireRefereeMatchAccess allows any assigned umpire team account', async () => {
		await seedAssignedMatch();
		await testDb.db.insert(teams).values({
			id: 'team-c',
			name: 'Team C',
			groupCode: 'A',
			createdAt: now,
			updatedAt: now
		});
		await testDb.db.insert(officiatingAssignments).values({
			id: 'assignment-2',
			tieId: 'tie-1',
			assignedTeamId: 'team-c',
			role: 'umpire_team',
			createdAt: now,
			updatedAt: now
		});
		mockState.event.locals.user = { id: 'team-user', role: 'team' };
		mockState.event.locals.authProfile = {
			userId: 'team-user',
			accountType: 'team',
			teamId: 'team-c',
			displayName: null
		};

		await expect(requireRefereeMatchAccess('match-1')).resolves.toEqual({
			id: 'team-user',
			role: 'team'
		});
	});

	test('requireRefereeMatchAccess rejects unassigned users', async () => {
		await seedAssignedMatch();
		mockState.event.locals.user = { id: 'team-user', role: 'team' };
		mockState.event.locals.authProfile = {
			userId: 'team-user',
			accountType: 'team',
			teamId: 'team-a',
			displayName: null
		};

		await expect(requireRefereeMatchAccess('match-1')).rejects.toMatchObject({ status: 403 });
		await expect(requireRefereeMatchAccess('missing-match')).rejects.toMatchObject({ status: 403 });
	});
});
