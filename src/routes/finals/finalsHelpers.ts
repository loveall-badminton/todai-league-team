export type SemifinalsReadinessParams = {
	x1TeamAId: string;
	x1TeamBId: string;
	x2TeamAId: string;
	x2TeamBId: string;
};

export type FifthPlaceReadinessParams = {
	x3TeamAId: string;
	x3TeamBId: string;
};

/**
 * 準決勝・5位決定戦を生成できるかどうかを返す。
 */
export function canGenerateSemifinals(params: SemifinalsReadinessParams): boolean {
	return getSemifinalsHint(params) === null;
}

/**
 * 準決勝生成ボタンを無効化する理由を人間が読める文字列で返す。
 * 生成可能な場合は null を返す。
 */
export function getSemifinalsHint(params: SemifinalsReadinessParams): string | null {
	const selected = [params.x1TeamAId, params.x1TeamBId, params.x2TeamAId, params.x2TeamBId].filter(
		Boolean
	);
	if (selected.length < 4) return '準決勝の全チームを選択してください';
	if (new Set(selected).size !== selected.length) {
		return '同じチームを複数の枠に選択することはできません';
	}
	return null;
}

export function canGenerateFifthPlace(params: FifthPlaceReadinessParams): boolean {
	return getFifthPlaceHint(params) === null;
}

export function getFifthPlaceHint(params: FifthPlaceReadinessParams): string | null {
	const selected = [params.x3TeamAId, params.x3TeamBId].filter(Boolean);
	if (selected.length < 2) return '5位決定戦の両チームを選択してください';
	if (new Set(selected).size !== selected.length) {
		return '同じチームを複数の枠に選択することはできません';
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
	if (!semi1 || !semi2) return '先に準決勝を生成してください';
	if (!isSemiDone(semi1) || !isSemiDone(semi2)) return '準決勝1・準決勝2の結果確定後に生成できます';
	return null;
}
