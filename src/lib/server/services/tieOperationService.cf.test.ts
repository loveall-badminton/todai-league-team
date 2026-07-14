/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createCfTestDb, type CfTestDb } from '$lib/server/cfTestDb';
import {
	lineupItems,
	lineupSubmissions,
	matches,
	rubbers,
	teamPlayers,
	teams,
	ties
} from '$lib/server/db/schema';

const mockState = vi.hoisted(() => ({
	db: null as CfTestDb['db'] | null
}));

vi.mock('$lib/server/db/request', () => ({
	getRequestDb: () => {
		if (!mockState.db) throw new Error('test db is not initialized');
		return mockState.db;
	}
}));

import {
	cancelMatchRubber,
	confirmTie,
	cutoffTie,
	recalculateTieResult,
	startTie,
	syncRubberResultFromMatch,
	unstartTie
} from './tieOperationService';
import { ensureDefaultSettings, resetTournamentEnsured } from './tokyoLeagueSetupService';

let cfTestDb: CfTestDb;
const now = '2026-06-15T01:00:00.000Z';

const RUBBER_CODES = ['WD1', 'XD1', 'MD3', 'MD2', 'MD1'] as const;

beforeAll(() => {
	cfTestDb = createCfTestDb(env.DB);
});

beforeEach(async () => {
	mockState.db = cfTestDb.db;
	await cfTestDb.reset();
	resetTournamentEnsured();
});

async function seedReadyTie() {
	await ensureDefaultSettings(now);
	await cfTestDb.db.insert(teams).values([
		{ id: 'team-a', name: 'Team A', groupCode: 'A', createdAt: now, updatedAt: now },
		{ id: 'team-b', name: 'Team B', groupCode: 'A', createdAt: now, updatedAt: now }
	]);
	await cfTestDb.db.insert(teamPlayers).values([
		{ id: 'a-p1', teamId: 'team-a', name: 'A P1', createdAt: now, updatedAt: now },
		{ id: 'a-p2', teamId: 'team-a', name: 'A P2', createdAt: now, updatedAt: now },
		{ id: 'b-p1', teamId: 'team-b', name: 'B P1', createdAt: now, updatedAt: now },
		{ id: 'b-p2', teamId: 'team-b', name: 'B P2', createdAt: now, updatedAt: now }
	]);
	await cfTestDb.db.insert(ties).values({
		id: 'tie-1',
		tieCode: 'A-1',
		phase: 'group_a',
		groupCode: 'A',
		teamAId: 'team-a',
		teamBId: 'team-b',
		status: 'lineup_submitted',
		displayOrder: 1,
		createdAt: now,
		updatedAt: now
	});
	await cfTestDb.db.insert(rubbers).values(
		RUBBER_CODES.map((code, i) => ({
			id: `rubber-${code}`,
			tieId: 'tie-1',
			code,
			discipline:
				code === 'WD1' ? ('WD' as const) : code === 'XD1' ? ('XD' as const) : ('MD' as const),
			displayOrder: i + 1,
			scoringRuleId: 'GROUP_15',
			status: 'not_ready' as const,
			createdAt: now,
			updatedAt: now
		}))
	);
	await cfTestDb.db.insert(lineupSubmissions).values([
		{
			id: 'sub-a',
			tieId: 'tie-1',
			teamId: 'team-a',
			side: 'A',
			status: 'locked',
			createdAt: now,
			updatedAt: now
		},
		{
			id: 'sub-b',
			tieId: 'tie-1',
			teamId: 'team-b',
			side: 'B',
			status: 'locked',
			createdAt: now,
			updatedAt: now
		}
	]);
	await cfTestDb.db.insert(lineupItems).values(
		RUBBER_CODES.flatMap((code) => [
			{
				id: `li-a-${code}`,
				submissionId: 'sub-a',
				rubberCode: code,
				player1Id: 'a-p1',
				player2Id: 'a-p2',
				createdAt: now,
				updatedAt: now
			},
			{
				id: `li-b-${code}`,
				submissionId: 'sub-b',
				rubberCode: code,
				player1Id: 'b-p1',
				player2Id: 'b-p2',
				createdAt: now,
				updatedAt: now
			}
		])
	);
}

describe('startTie', () => {
	test('creates matches for every rubber and moves the tie to playing', async () => {
		await seedReadyTie();

		await startTie('tie-1', { now });

		const tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, 'tie-1') });
		expect(tie?.status).toBe('playing');
		expect(tie?.actualStartAt).toBe(now);

		const rubberRows = await cfTestDb.db.select().from(rubbers).where(eq(rubbers.tieId, 'tie-1'));
		expect(rubberRows).toHaveLength(5);
		for (const rubber of rubberRows) {
			expect(rubber.status).toBe('scheduled');
			expect(rubber.matchId).not.toBeNull();
		}

		const matchRows = await cfTestDb.db.select().from(matches);
		expect(matchRows).toHaveLength(5);
	});

	test('throws when lineups are not ready and force is not set', async () => {
		await seedReadyTie();
		await cfTestDb.db
			.update(lineupSubmissions)
			.set({ status: 'submitted' })
			.where(eq(lineupSubmissions.id, 'sub-a'));

		await expect(startTie('tie-1', { now })).rejects.toThrow('両チームのオーダー承認が必要です');
	});
});

describe('unstartTie', () => {
	test('reverts a started tie back to lineup_submitted and deletes created matches', async () => {
		await seedReadyTie();
		await startTie('tie-1', { now });

		await unstartTie('tie-1', now);

		const tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, 'tie-1') });
		expect(tie?.status).toBe('lineup_submitted');
		expect(tie?.actualStartAt).toBeNull();

		const rubberRows = await cfTestDb.db.select().from(rubbers).where(eq(rubbers.tieId, 'tie-1'));
		for (const rubber of rubberRows) {
			expect(rubber.status).toBe('not_ready');
			expect(rubber.matchId).toBeNull();
		}

		const matchRows = await cfTestDb.db.select().from(matches);
		expect(matchRows).toHaveLength(0);

		const submissions = await cfTestDb.db
			.select()
			.from(lineupSubmissions)
			.where(eq(lineupSubmissions.tieId, 'tie-1'));
		for (const submission of submissions) {
			expect(submission.status).toBe('locked');
		}
	});

	test('throws when the tie has not been started', async () => {
		await seedReadyTie();

		await expect(unstartTie('tie-1', now)).rejects.toThrow('開始済みの対戦のみ取り消せます');
	});

	test('throws when a rubber already has a score', async () => {
		await seedReadyTie();
		await startTie('tie-1', { now });
		await cfTestDb.db
			.update(rubbers)
			.set({ status: 'playing' })
			.where(eq(rubbers.id, 'rubber-WD1'));

		await expect(unstartTie('tie-1', now)).rejects.toThrow(
			'スコアが入力された種目があるため開始を取り消せません'
		);
	});
});

describe('syncRubberResultFromMatch / recalculateTieResult', () => {
	test('reflects a finished match result onto the rubber and tie score', async () => {
		await seedReadyTie();
		await startTie('tie-1', { now });
		const rubber = await cfTestDb.db.query.rubbers.findFirst({
			where: eq(rubbers.id, 'rubber-WD1')
		});

		await cfTestDb.db
			.update(matches)
			.set({ status: 'finished', winnerSide: 'A' })
			.where(eq(matches.id, rubber!.matchId!));

		await syncRubberResultFromMatch(rubber!.matchId!, now);

		const updatedRubber = await cfTestDb.db.query.rubbers.findFirst({
			where: eq(rubbers.id, 'rubber-WD1')
		});
		expect(updatedRubber?.status).toBe('finished');
		expect(updatedRubber?.winnerSide).toBe('A');

		const tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, 'tie-1') });
		expect(tie?.teamScoreA).toBe(1);
		expect(tie?.teamScoreB).toBe(0);
	});
});

describe('cutoffTie', () => {
	async function winThreeRubbersForTeamA() {
		const winningCodes = ['WD1', 'XD1', 'MD3'] as const;
		for (const code of winningCodes) {
			await cfTestDb.db
				.update(rubbers)
				.set({ status: 'finished', winnerSide: 'A' })
				.where(eq(rubbers.id, `rubber-${code}`));
		}
	}

	test('cancels the remaining rubbers and matches once a team reaches three wins', async () => {
		await seedReadyTie();
		await startTie('tie-1', { now });
		await winThreeRubbersForTeamA();

		const { affectedMatchIds } = await cutoffTie('tie-1', now);
		expect(affectedMatchIds).toHaveLength(2);

		const rubberRows = await cfTestDb.db.select().from(rubbers).where(eq(rubbers.tieId, 'tie-1'));
		const remaining = rubberRows.filter((r) => ['MD2', 'MD1'].includes(r.code));
		for (const rubber of remaining) {
			expect(rubber.status).toBe('cancelled');
		}

		const cancelledMatches = await cfTestDb.db
			.select()
			.from(matches)
			.where(eq(matches.id, affectedMatchIds[0]));
		expect(cancelledMatches[0]?.status).toBe('cancelled');

		const tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, 'tie-1') });
		expect(tie?.status).toBe('finished');
		expect(tie?.winnerTeamId).toBe('team-a');
	});

	test('throws when no team has reached three wins yet', async () => {
		await seedReadyTie();
		await startTie('tie-1', { now });

		await expect(cutoffTie('tie-1', now)).rejects.toThrow('3勝到達後にのみ打ち切りできます');
	});

	test('throws when the tie is already confirmed', async () => {
		await seedReadyTie();
		await startTie('tie-1', { now });
		await winThreeRubbersForTeamA();
		await cutoffTie('tie-1', now);
		await confirmTie('tie-1', now);

		await expect(cutoffTie('tie-1', now)).rejects.toThrow('確定済みの対戦は打ち切りできません');
	});
});

describe('confirmTie', () => {
	test('marks a decided tie as confirmed', async () => {
		await seedReadyTie();
		await startTie('tie-1', { now });
		await cfTestDb.db
			.update(rubbers)
			.set({ status: 'finished', winnerSide: 'A' })
			.where(eq(rubbers.id, 'rubber-WD1'));

		await confirmTie('tie-1', now);

		const tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, 'tie-1') });
		expect(tie?.status).toBe('confirmed');
	});
});

describe('cancelMatchRubber', () => {
	test('cancels a single scheduled match and recalculates the tie', async () => {
		await seedReadyTie();
		await startTie('tie-1', { now });
		const rubber = await cfTestDb.db.query.rubbers.findFirst({
			where: eq(rubbers.id, 'rubber-MD1')
		});

		await cancelMatchRubber(rubber!.matchId!, now);

		const updatedRubber = await cfTestDb.db.query.rubbers.findFirst({
			where: eq(rubbers.id, 'rubber-MD1')
		});
		expect(updatedRubber?.status).toBe('cancelled');

		const match = await cfTestDb.db.query.matches.findFirst({
			where: eq(matches.id, rubber!.matchId!)
		});
		expect(match?.status).toBe('cancelled');
	});
});

describe('recalculateTieResult', () => {
	test('recomputes scores directly from rubber rows', async () => {
		await seedReadyTie();
		await startTie('tie-1', { now });
		await cfTestDb.db
			.update(rubbers)
			.set({ status: 'finished', winnerSide: 'B' })
			.where(eq(rubbers.id, 'rubber-WD1'));
		await cfTestDb.db
			.update(rubbers)
			.set({ status: 'finished', winnerSide: 'B' })
			.where(eq(rubbers.id, 'rubber-XD1'));

		await recalculateTieResult('tie-1', now);

		const tie = await cfTestDb.db.query.ties.findFirst({ where: eq(ties.id, 'tie-1') });
		expect(tie?.teamScoreB).toBe(2);
		expect(tie?.winnerTeamId).toBeNull();
	});
});
