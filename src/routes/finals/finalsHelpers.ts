export type SemifinalsReadinessParams = {
	groupAAllDone: boolean;
	groupBAllDone: boolean;
	noTiebreakerA: boolean;
	noTiebreakerB: boolean;
};

/**
 * 準決勝・5位決定戦を生成できるかどうかを返す。
 */
export function canGenerateSemifinals(params: SemifinalsReadinessParams): boolean {
	return (
		params.groupAAllDone && params.groupBAllDone && params.noTiebreakerA && params.noTiebreakerB
	);
}

/**
 * 準決勝生成ボタンを無効化する理由を人間が読める文字列で返す。
 * 生成可能な場合は null を返す。
 */
export function getSemifinalsHint(params: SemifinalsReadinessParams): string | null {
	if (!params.groupAAllDone || !params.groupBAllDone) {
		const incomplete = (
			[!params.groupAAllDone && 'Aリーグ', !params.groupBAllDone && 'Bリーグ'] as (string | false)[]
		)
			.filter(Boolean)
			.join('・');
		return `${incomplete}の試合が全て完了してから生成できます`;
	}
	if (!params.noTiebreakerA || !params.noTiebreakerB) {
		return '同点チームの順位を確定してから生成できます';
	}
	return null;
}

type SemiResult = { tieCode: string; status: string } | null | undefined;

function isSemiDone(t: SemiResult): boolean {
	return t?.status === 'finished' || t?.status === 'confirmed';
}

/**
 * 決勝・3位決定戦を生成できるかどうかを返す。
 * 両準決勝が finished/confirmed の場合のみ true。
 */
export function canGenerateFinals(semi1: SemiResult, semi2: SemiResult): boolean {
	return !!semi1 && !!semi2 && isSemiDone(semi1) && isSemiDone(semi2);
}

/**
 * 決勝生成ボタンを無効化する理由を返す。生成可能な場合は null を返す。
 */
export function getFinalsHint(semi1: SemiResult, semi2: SemiResult): string | null {
	if (!semi1 || !semi2) return '先に準決勝・5位決定戦を生成してください';
	if (!isSemiDone(semi1) || !isSemiDone(semi2)) return '準決勝1・準決勝2の結果確定後に生成できます';
	return null;
}
