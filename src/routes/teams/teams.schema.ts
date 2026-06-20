import * as v from 'valibot';

export const importTeamsSchema = v.object({
	file: v.pipe(
		v.file('CSVファイルを選択してください'),
		v.mimeType(['text/csv'], 'CSVファイル（.csv）を選択してください'),
		v.maxSize(5 * 1024 * 1024, 'ファイルサイズは5MB以下にしてください')
	)
});

export const createTeamSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.nonEmpty('チーム名は必須です')),
	shortName: v.optional(v.string()),
	groupCode: v.optional(v.picklist(['', 'A', 'B'] as const))
});
