import { command, getRequestEvent } from '$app/server';
import { RUBBER_DEFINITIONS, type RubberCode } from '$lib/domain/tokyoLeague';
import { requireTeamLineupAccess } from '$lib/server/auth/access';
import { saveLineupDraft, submitLineup } from '$lib/server/services/lineupService';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

const itemsSchema = v.record(v.string(), v.string());

export const saveDraft = command(itemsSchema, async (formData) => {
	const event = getRequestEvent();
	const { params } = event;
	requireTeamLineupAccess(params.teamId!);
	const items = RUBBER_DEFINITIONS.map((r) => ({
		rubberCode: r.code as RubberCode,
		player1Id: formData[`${r.code}_1`] ?? '',
		player2Id: formData[`${r.code}_2`] ?? ''
	}));
	try {
		const validation = await saveLineupDraft({
			tieId: params.tieId!,
			teamId: params.teamId!,
			items
		});
		return { message: '下書きを保存しました', warnings: validation.warnings };
	} catch (err) {
		error(400, err instanceof Error ? err.message : '失敗');
	}
});

export const submit = command(itemsSchema, async (formData) => {
	const event = getRequestEvent();
	const { params } = event;
	requireTeamLineupAccess(params.teamId!);
	const items = RUBBER_DEFINITIONS.map((r) => ({
		rubberCode: r.code as RubberCode,
		player1Id: formData[`${r.code}_1`] ?? '',
		player2Id: formData[`${r.code}_2`] ?? ''
	}));
	try {
		await saveLineupDraft({ tieId: params.tieId!, teamId: params.teamId!, items });
		const validation = await submitLineup({
			tieId: params.tieId!,
			teamId: params.teamId!
		});
		return { message: 'オーダーを提出しました', warnings: validation.warnings };
	} catch (err) {
		error(400, err instanceof Error ? err.message : '失敗');
	}
});
