import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { RUBBER_DEFINITIONS, type RubberCode } from '$lib/domain/tokyoLeague';
import { getRequestDb } from '$lib/server/db/request';
import { lineupItems, lineupSubmissions, teamPlayers, ties } from '$lib/server/db/schema';

type LineupItemInput = {
	rubberCode: RubberCode;
	player1Id: string;
	player2Id: string;
};

type LineupValidation = {
	errors: string[];
	warnings: string[];
};

export type LineupPlayerForValidation = {
	id: string;
	teamId: string;
	gender: 'male' | 'female' | 'unknown';
};

const lockedStatuses = new Set(['locked', 'revealed']);

export async function validateLineup(params: {
	tieId: string;
	teamId: string;
	items: LineupItemInput[];
	now?: string;
}): Promise<LineupValidation> {
	const db = getRequestDb();
	const errors: string[] = [];
	const warnings: string[] = [];
	const expectedCodes = RUBBER_DEFINITIONS.map((rubber) => rubber.code);
	const itemsByCode = new Map(params.items.map((item) => [item.rubberCode, item]));

	for (const code of expectedCodes) {
		const item = itemsByCode.get(code);
		const label = RUBBER_DEFINITIONS.find((r) => r.code === code)?.label ?? code;
		if (!item?.player1Id || !item.player2Id) errors.push(`${label}: 未入力です`);
		if (item?.player1Id && item.player1Id === item.player2Id) {
			errors.push(`${label}: 同一種目内で同じ選手は選べません`);
		}
	}

	const ids = [
		...new Set(params.items.flatMap((item) => [item.player1Id, item.player2Id]).filter(Boolean))
	];
	const players =
		ids.length > 0 ? await db.select().from(teamPlayers).where(inArray(teamPlayers.id, ids)) : [];
	const playerMap = new Map(players.map((player) => [player.id, player]));

	for (const id of ids) {
		const player = playerMap.get(id);
		if (!player || player.teamId !== params.teamId) {
			errors.push('チーム外の選手が含まれています');
			break;
		}
	}

	warnings.push(...validateLineupWarnings(params.items, players));

	const tie = await db.query.ties.findFirst({ where: eq(ties.id, params.tieId) });
	if (tie?.lineupDueAt) {
		const now = new Date(params.now ?? new Date().toISOString()).getTime();
		const due = new Date(tie.lineupDueAt).getTime();
		if (Number.isFinite(due) && now > due) warnings.push('提出期限を過ぎています');
	}

	return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

export function validateLineupWarnings(
	items: LineupItemInput[],
	players: LineupPlayerForValidation[]
) {
	const warnings: string[] = [];
	const playerMap = new Map(players.map((player) => [player.id, player]));

	for (const item of items) {
		const player1 = playerMap.get(item.player1Id);
		const player2 = playerMap.get(item.player2Id);
		if (!player1 || !player2) continue;

		const labelOf = (code: string) =>
			RUBBER_DEFINITIONS.find((r) => r.code === code)?.label ?? code;

		if (item.rubberCode === 'WD1' && [player1.gender, player2.gender].includes('male')) {
			warnings.push(`${labelOf('WD1')}に男性が含まれています`);
		}
		if (item.rubberCode.startsWith('MD') && [player1.gender, player2.gender].includes('female')) {
			warnings.push(`${labelOf(item.rubberCode)}に女性が含まれています`);
		}
		if (item.rubberCode === 'XD1') {
			const genders = new Set([player1.gender, player2.gender]);
			if (!genders.has('male') || !genders.has('female')) {
				warnings.push(`${labelOf('XD1')}が男女ペアではありません`);
			}
		}
	}

	const appearances = new Map<string, number>();
	for (const item of items) {
		for (const id of [item.player1Id, item.player2Id]) {
			if (!id) continue;
			appearances.set(id, (appearances.get(id) ?? 0) + 1);
		}
	}
	if ([...appearances.values()].some((count) => count > 1)) {
		warnings.push('同一選手が複数種目に出場しています');
	}

	return [...new Set(warnings)];
}

export async function saveLineupDraft(params: {
	tieId: string;
	teamId: string;
	items: LineupItemInput[];
	now?: string;
}) {
	const db = getRequestDb();
	const now = params.now ?? new Date().toISOString();
	const validation = await validateLineup({ ...params, now });
	if (validation.errors.length > 0) {
		throw new Error(validation.errors.join('\n'));
	}

	const tie = await db.query.ties.findFirst({ where: eq(ties.id, params.tieId) });
	if (!tie) throw new Error('Tie not found');
	const side = tie.teamAId === params.teamId ? 'A' : tie.teamBId === params.teamId ? 'B' : null;
	if (!side) throw new Error('Team is not assigned to this tie');

	const existing = await db.query.lineupSubmissions.findFirst({
		where: and(
			eq(lineupSubmissions.tieId, params.tieId),
			eq(lineupSubmissions.teamId, params.teamId)
		)
	});
	if (existing && lockedStatuses.has(existing.status)) {
		throw new Error('提出済みまたは公開済みのオーダーは編集できません');
	}

	const submissionId = existing?.id ?? crypto.randomUUID();
	if (!existing) {
		await db.insert(lineupSubmissions).values({
			id: submissionId,
			tieId: params.tieId,
			teamId: params.teamId,
			side,
			status: 'draft',
			createdAt: now,
			updatedAt: now
		});
	} else {
		await db
			.update(lineupSubmissions)
			.set({ status: 'draft', updatedAt: now })
			.where(eq(lineupSubmissions.id, submissionId));
	}

	await db
		.insert(lineupItems)
		.values(
			params.items.map((item) => ({
				id: crypto.randomUUID(),
				submissionId,
				rubberCode: item.rubberCode,
				player1Id: item.player1Id,
				player2Id: item.player2Id,
				createdAt: now,
				updatedAt: now
			}))
		)
		.onConflictDoUpdate({
			target: [lineupItems.submissionId, lineupItems.rubberCode],
			set: {
				player1Id: sql`excluded.player1_id`,
				player2Id: sql`excluded.player2_id`,
				updatedAt: now
			}
		});

	return validation;
}

export async function submitLineup(params: { tieId: string; teamId: string; now?: string }) {
	const db = getRequestDb();
	const now = params.now ?? new Date().toISOString();
	const submission = await getSubmission(params.tieId, params.teamId);
	const items = await getSubmissionItems(submission.id);
	const validation = await validateLineup({
		tieId: params.tieId,
		teamId: params.teamId,
		items,
		now
	});
	if (validation.errors.length > 0) throw new Error(validation.errors.join('\n'));
	if (submission.status === 'locked' || submission.status === 'revealed') {
		throw new Error('ロック済みまたは公開済みのオーダーです');
	}
	await db
		.update(lineupSubmissions)
		.set({ status: 'submitted', submittedAt: now, updatedAt: now })
		.where(eq(lineupSubmissions.id, submission.id));
	await updateTieLineupStatus(params.tieId, now);
	return validation;
}

export async function lockLineup(params: { tieId: string; teamId: string; now?: string }) {
	const db = getRequestDb();
	const now = params.now ?? new Date().toISOString();
	const submission = await getSubmission(params.tieId, params.teamId);
	await db
		.update(lineupSubmissions)
		.set({ status: 'locked', lockedAt: now, updatedAt: now })
		.where(eq(lineupSubmissions.id, submission.id));
	await updateTieLineupStatus(params.tieId, now);
}

export async function unlockLineup(params: { tieId: string; teamId: string; now?: string }) {
	const db = getRequestDb();
	const now = params.now ?? new Date().toISOString();
	const submission = await getSubmission(params.tieId, params.teamId);
	await db
		.update(lineupSubmissions)
		.set({ status: 'submitted', lockedAt: null, updatedAt: now })
		.where(eq(lineupSubmissions.id, submission.id));
	await updateTieLineupStatus(params.tieId, now);
}

export async function revealLineups(tieId: string, now = new Date().toISOString()) {
	const db = getRequestDb();
	const submissions = await db
		.select()
		.from(lineupSubmissions)
		.where(eq(lineupSubmissions.tieId, tieId));
	if (submissions.length < 2) throw new Error('両チームのオーダーが提出されていません');
	for (const s of submissions) {
		if (s.status === 'draft')
			throw new Error('下書き状態のオーダーがあります。先に提出してください');
	}
	for (const submission of submissions) {
		await db
			.update(lineupSubmissions)
			.set({ status: 'revealed', revealedAt: now, updatedAt: now })
			.where(eq(lineupSubmissions.id, submission.id));
	}
	await db
		.update(ties)
		.set({ lineupsRevealedAt: now, status: 'ready', updatedAt: now })
		.where(eq(ties.id, tieId));
}

export async function unrevealLineups(tieId: string, now = new Date().toISOString()) {
	const db = getRequestDb();
	const submissions = await db
		.select()
		.from(lineupSubmissions)
		.where(eq(lineupSubmissions.tieId, tieId));
	for (const submission of submissions) {
		await db
			.update(lineupSubmissions)
			.set({ status: 'submitted', revealedAt: null, updatedAt: now })
			.where(eq(lineupSubmissions.id, submission.id));
	}
	await db
		.update(ties)
		.set({ lineupsRevealedAt: null, status: 'lineup_submitted', updatedAt: now })
		.where(eq(ties.id, tieId));
}

export async function getLineupsForTie(tieId: string) {
	const db = getRequestDb();
	const submissions = await db
		.select()
		.from(lineupSubmissions)
		.where(eq(lineupSubmissions.tieId, tieId))
		.orderBy(asc(lineupSubmissions.side));
	const items = await Promise.all(
		submissions.map(async (submission) => ({
			submission,
			items: await getSubmissionItems(submission.id)
		}))
	);
	return items;
}

async function getSubmission(tieId: string, teamId: string) {
	const db = getRequestDb();
	const submission = await db.query.lineupSubmissions.findFirst({
		where: and(eq(lineupSubmissions.tieId, tieId), eq(lineupSubmissions.teamId, teamId))
	});
	if (!submission) throw new Error('オーダー下書きがありません');
	return submission;
}

async function getSubmissionItems(submissionId: string): Promise<LineupItemInput[]> {
	const db = getRequestDb();
	const rows = await db
		.select()
		.from(lineupItems)
		.where(eq(lineupItems.submissionId, submissionId))
		.orderBy(asc(lineupItems.rubberCode));
	return rows.map((row) => ({
		rubberCode: row.rubberCode,
		player1Id: row.player1Id,
		player2Id: row.player2Id
	}));
}

export async function getLineupItemsForTeam(tieId: string, teamId: string) {
	const db = getRequestDb();
	const submission = await db.query.lineupSubmissions.findFirst({
		where: and(eq(lineupSubmissions.tieId, tieId), eq(lineupSubmissions.teamId, teamId))
	});
	const items = submission
		? await db
				.select()
				.from(lineupItems)
				.where(eq(lineupItems.submissionId, submission.id))
				.orderBy(asc(lineupItems.rubberCode))
		: [];
	return { submission: submission ?? null, items };
}

async function updateTieLineupStatus(tieId: string, now: string) {
	const db = getRequestDb();
	const submissions = await db
		.select()
		.from(lineupSubmissions)
		.where(eq(lineupSubmissions.tieId, tieId));
	const ready =
		submissions.length >= 2 && submissions.every((submission) => submission.status !== 'draft');
	await db
		.update(ties)
		.set({ status: ready ? 'lineup_submitted' : 'lineup_pending', updatedAt: now })
		.where(eq(ties.id, tieId));
}
