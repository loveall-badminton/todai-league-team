import { RUBBER_DEFINITIONS, type RubberCode } from '$lib/domain/tokyoLeague';
import {
	loadJsonFromLocalStorage,
	removeLocalStorageItem,
	saveJsonToLocalStorage
} from '$lib/utils/localStorage';
import * as v from 'valibot';

const playerIdSchema = v.string();
const localLineupDraftItemSchema = <const TRubberCode extends RubberCode>(
	rubberCode: TRubberCode
) =>
	v.object({
		rubberCode: v.literal(rubberCode),
		player1Id: playerIdSchema,
		player2Id: playerIdSchema
	});
const localLineupDraftSchema = v.tuple([
	localLineupDraftItemSchema('WD1'),
	localLineupDraftItemSchema('XD1'),
	localLineupDraftItemSchema('MD3'),
	localLineupDraftItemSchema('MD2'),
	localLineupDraftItemSchema('MD1')
]);

export type LocalLineupDraft = v.InferOutput<typeof localLineupDraftSchema>;
export type LocalLineupDraftItem = LocalLineupDraft[number];

const storagePrefix = 'todai-league:lineup-draft';

function storageKey(tieId: string, teamId: string) {
	return `${storagePrefix}:${tieId}:${teamId}`;
}

function formDataString(formData: FormData, key: string) {
	const value = formData.get(key);
	return typeof value === 'string' ? value : '';
}

export function lineupDraftItemsFromFormData(formData: FormData): LocalLineupDraft {
	const items = RUBBER_DEFINITIONS.map((rubber, index) => ({
		rubberCode: rubber.code,
		player1Id: formDataString(formData, `items[${index}].player1Id`),
		player2Id: formDataString(formData, `items[${index}].player2Id`)
	}));

	return v.parse(localLineupDraftSchema, items);
}

export function loadLocalLineupDraft(tieId: string, teamId: string): LocalLineupDraft | null {
	const parsed = loadJsonFromLocalStorage(storageKey(tieId, teamId), localLineupDraftSchema);
	if (!parsed) return null;

	const byCode = new Map(parsed.map((item) => [item.rubberCode, item]));
	return v.parse(
		localLineupDraftSchema,
		RUBBER_DEFINITIONS.map((rubber) => {
			const item = byCode.get(rubber.code);
			return {
				rubberCode: rubber.code,
				player1Id: item?.player1Id ?? '',
				player2Id: item?.player2Id ?? ''
			};
		})
	);
}

export function saveLocalLineupDraft(tieId: string, teamId: string, items: LocalLineupDraft) {
	saveJsonToLocalStorage(storageKey(tieId, teamId), localLineupDraftSchema, items);
}

export function clearLocalLineupDraft(tieId: string, teamId: string) {
	removeLocalStorageItem(storageKey(tieId, teamId));
}
