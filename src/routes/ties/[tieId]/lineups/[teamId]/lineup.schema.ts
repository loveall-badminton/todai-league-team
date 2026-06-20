import * as v from 'valibot';

const playerIdField = v.optional(v.string(), '');
const lineupItemSchema = v.object({
	rubberCode: v.picklist(['WD1', 'XD1', 'MD3', 'MD2', 'MD1']),
	player1Id: playerIdField,
	player2Id: playerIdField
});

export const submitLineupSchema = v.object({
	items: v.pipe(v.array(lineupItemSchema), v.length(5))
});
