import { COURT_BLOCKS, RUBBER_DEFINITIONS, VENUES, type TiePhase, type VenueCode } from './tokyoLeague';

export const phaseLabel = (phase: string) => {
	const labels: Record<TiePhase, string> = {
		group_a: 'Aリーグ',
		group_b: 'Bリーグ',
		semifinal: '準決勝',
		final: '決勝',
		third_place: '3位決定戦',
		fifth_place: '5位決定戦',
		ranking_tiebreaker: '順位決定再試合'
	};
	return labels[phase as TiePhase] ?? phase;
};

export const tieStatusLabel = (status: string) => {
	const labels: Record<string, string> = {
		scheduled: '予定',
		lineup_pending: 'オーダー待ち',
		lineup_submitted: '提出済み',
		ready: '開始可',
		playing: '進行中',
		finished: '結果確認待ち',
		confirmed: '確定',
		cancelled: '中止'
	};
	return labels[status] ?? status;
};

export const rubberStatusLabel = (status: string) => {
	const labels: Record<string, string> = {
		not_ready: '未割当',
		ready: '準備完了',
		scheduled: '予定',
		playing: '進行中',
		finished: '終了',
		confirmed: '確定',
		skipped: 'スキップ',
		cancelled: '中止'
	};
	return labels[status] ?? status;
};

export const submissionStatusLabel = (status: string | null | undefined) => {
	const labels: Record<string, string> = {
		draft: '下書き',
		submitted: '提出済',
		locked: '確認済',
		revealed: '公開済'
	};
	return status ? (labels[status] ?? status) : '未入力';
};

export const tiebreakerStatusLabel = (status: string) => {
	const labels: Record<string, string> = {
		scheduled: '予定',
		playing: '進行中',
		finished: '終了'
	};
	return labels[status] ?? status;
};

export const venueLabel = (venue: string | null | undefined) => {
	const labels: Record<VenueCode, string> = {
		first_gym: '第一体育館',
		second_gym: '第二体育館'
	};
	return venue ? (labels[venue as VenueCode] ?? venue) : '未設定';
};

export const courtDisplayLabel = (
	venue: string | null | undefined,
	courtBlockCode: string | null | undefined
): string => {
	const vLabel = venue ? venueLabel(venue) : null;
	if (!courtBlockCode) return vLabel ?? '未設定';
	try {
		const courts: number[] = JSON.parse(courtBlockCode);
		if (Array.isArray(courts) && courts.length > 0) {
			return `${vLabel ?? ''} ${courts.map((c) => `${c}面`).join('・')}`.trim();
		}
	} catch {
		const block = COURT_BLOCKS.find((b) => b.code === courtBlockCode);
		if (block) return block.label;
	}
	return vLabel ?? '未設定';
};

export const courtBlockLabel = (code: string | null | undefined) => {
	if (!code) return '未設定';
	try {
		const courts: number[] = JSON.parse(code);
		if (Array.isArray(courts) && courts.length > 0) {
			return `コート${courts.map((c) => `${c}面`).join('・')}`;
		}
	} catch {
		// ignore
	}
	return COURT_BLOCKS.find((block) => block.code === code)?.label ?? '未設定';
};

export const rubberLabel = (code: string) =>
	RUBBER_DEFINITIONS.find((rubber) => rubber.code === code)?.label ?? code;

export const genderLabel = (gender: string) => {
	const labels: Record<string, string> = {
		male: '男性',
		female: '女性',
		unknown: '未設定'
	};
	return labels[gender] ?? gender;
};

export const venueCourtCount = (venue: string | null | undefined): number =>
	VENUES.find((v) => v.code === venue)?.courtCount ?? 0;

export const parseCourts = (courtBlockCode: string | null | undefined): number[] => {
	if (!courtBlockCode) return [];
	try {
		const parsed = JSON.parse(courtBlockCode);
		if (Array.isArray(parsed)) return parsed.map(Number).filter((n) => n > 0);
	} catch {
		const block = COURT_BLOCKS.find((b) => b.code === courtBlockCode);
		if (block) return [...block.courtNumbers];
	}
	return [];
};
