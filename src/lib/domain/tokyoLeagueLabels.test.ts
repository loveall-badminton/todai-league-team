import { describe, expect, test } from 'vitest';
import {
	phaseLabel,
	tieStatusLabel,
	matchStatusLabel,
	rubberStatusLabel,
	submissionStatusLabel,
	tiebreakerStatusLabel,
	venueLabel,
	courtDisplayLabel,
	courtBlockLabel,
	rubberLabel,
	genderLabel,
	venueCourtCount,
	parseCourts
} from './tokyoLeagueLabels';

// ─── phaseLabel ──────────────────────────────────────────────────────────────

describe('phaseLabel', () => {
	test('maps all known phases to Japanese labels', () => {
		expect(phaseLabel('group_a')).toBe('Aリーグ');
		expect(phaseLabel('group_b')).toBe('Bリーグ');
		expect(phaseLabel('semifinal')).toBe('準決勝');
		expect(phaseLabel('final')).toBe('決勝');
		expect(phaseLabel('third_place')).toBe('3位決定戦');
		expect(phaseLabel('fifth_place')).toBe('5位決定戦');
		expect(phaseLabel('ranking_tiebreaker')).toBe('順位決定再試合');
	});

	test('returns raw value for unknown phase', () => {
		expect(phaseLabel('unknown_phase')).toBe('unknown_phase');
	});
});

// ─── tieStatusLabel ──────────────────────────────────────────────────────────

describe('tieStatusLabel', () => {
	test('maps all known tie statuses to Japanese labels', () => {
		expect(tieStatusLabel('scheduled')).toBe('予定');
		expect(tieStatusLabel('lineup_pending')).toBe('オーダー待ち');
		expect(tieStatusLabel('lineup_submitted')).toBe('提出済み');
		expect(tieStatusLabel('called')).toBe('呼出中');
		expect(tieStatusLabel('warmup')).toBe('練習中');
		expect(tieStatusLabel('playing')).toBe('進行中');
		expect(tieStatusLabel('interval')).toBe('インターバル');
		expect(tieStatusLabel('suspended')).toBe('中断中');
		expect(tieStatusLabel('finished')).toBe('結果確認待ち');
		expect(tieStatusLabel('forfeited')).toBe('棄権');
		expect(tieStatusLabel('retired')).toBe('リタイア');
		expect(tieStatusLabel('confirmed')).toBe('確定');
		expect(tieStatusLabel('cancelled')).toBe('中止');
	});

	test('returns raw value for unknown status', () => {
		expect(tieStatusLabel('unknown')).toBe('unknown');
	});
});

// ─── matchStatusLabel ────────────────────────────────────────────────────────

describe('matchStatusLabel', () => {
	test('maps all known match statuses to Japanese labels', () => {
		expect(matchStatusLabel('scheduled')).toBe('開始前');
		expect(matchStatusLabel('called')).toBe('呼出中');
		expect(matchStatusLabel('warmup')).toBe('練習中');
		expect(matchStatusLabel('playing')).toBe('進行中');
		expect(matchStatusLabel('interval')).toBe('インターバル');
		expect(matchStatusLabel('suspended')).toBe('中断中');
		expect(matchStatusLabel('finished')).toBe('終了');
		expect(matchStatusLabel('confirmed')).toBe('確定');
		expect(matchStatusLabel('forfeited')).toBe('棄権');
		expect(matchStatusLabel('retired')).toBe('リタイア');
		expect(matchStatusLabel('cancelled')).toBe('中止');
	});

	test('returns raw value for unknown status', () => {
		expect(matchStatusLabel('some_other')).toBe('some_other');
	});
});

// ─── rubberStatusLabel ───────────────────────────────────────────────────────

describe('rubberStatusLabel', () => {
	test('maps all known rubber statuses to Japanese labels', () => {
		expect(rubberStatusLabel('not_ready')).toBe('未割当');
		expect(rubberStatusLabel('ready')).toBe('準備完了');
		expect(rubberStatusLabel('scheduled')).toBe('予定');
		expect(rubberStatusLabel('playing')).toBe('進行中');
		expect(rubberStatusLabel('finished')).toBe('結果確認待ち');
		expect(rubberStatusLabel('confirmed')).toBe('確定');
		expect(rubberStatusLabel('forfeited')).toBe('棄権');
		expect(rubberStatusLabel('retired')).toBe('リタイア');
		expect(rubberStatusLabel('skipped')).toBe('スキップ');
		expect(rubberStatusLabel('cancelled')).toBe('中止');
	});

	test('returns raw value for unknown status', () => {
		expect(rubberStatusLabel('nope')).toBe('nope');
	});
});

// ─── submissionStatusLabel ───────────────────────────────────────────────────

describe('submissionStatusLabel', () => {
	test('maps known submission statuses', () => {
		expect(submissionStatusLabel('draft')).toBe('下書き');
		expect(submissionStatusLabel('submitted')).toBe('提出済');
		expect(submissionStatusLabel('locked')).toBe('確認済');
		expect(submissionStatusLabel('revealed')).toBe('公開済');
	});

	test('returns 未入力 for null or undefined', () => {
		expect(submissionStatusLabel(null)).toBe('未入力');
		expect(submissionStatusLabel(undefined)).toBe('未入力');
	});

	test('returns raw value for unknown status string', () => {
		expect(submissionStatusLabel('unknown')).toBe('unknown');
	});
});

// ─── tiebreakerStatusLabel ───────────────────────────────────────────────────

describe('tiebreakerStatusLabel', () => {
	test('maps known tiebreaker statuses', () => {
		expect(tiebreakerStatusLabel('scheduled')).toBe('予定');
		expect(tiebreakerStatusLabel('playing')).toBe('進行中');
		expect(tiebreakerStatusLabel('finished')).toBe('終了');
	});

	test('returns raw value for unknown status', () => {
		expect(tiebreakerStatusLabel('other')).toBe('other');
	});
});

// ─── venueLabel ──────────────────────────────────────────────────────────────

describe('venueLabel', () => {
	test('maps known venue codes', () => {
		expect(venueLabel('first_gym')).toBe('第一体育館');
		expect(venueLabel('second_gym')).toBe('第二体育館');
	});

	test('returns 未設定 for null or undefined', () => {
		expect(venueLabel(null)).toBe('未設定');
		expect(venueLabel(undefined)).toBe('未設定');
	});

	test('returns raw value for unknown venue code', () => {
		expect(venueLabel('third_gym')).toBe('third_gym');
	});
});

// ─── courtDisplayLabel ───────────────────────────────────────────────────────

describe('courtDisplayLabel', () => {
	test('returns 未設定 when both venue and courtBlockCode are null', () => {
		expect(courtDisplayLabel(null, null)).toBe('未設定');
	});

	test('returns venue label when courtBlockCode is absent', () => {
		expect(courtDisplayLabel('first_gym', null)).toBe('第一体育館');
		expect(courtDisplayLabel('second_gym', undefined)).toBe('第二体育館');
	});

	test('formats court numbers from JSON array with venue', () => {
		expect(courtDisplayLabel('first_gym', '[1,2,3]')).toBe('第一体育館 1コート・2コート・3コート');
	});

	test('formats court numbers from JSON array without venue', () => {
		expect(courtDisplayLabel(null, '[4,5]')).toBe('4コート・5コート');
	});

	test('falls back to COURT_BLOCKS label for named block code', () => {
		expect(courtDisplayLabel('first_gym', 'first_1_3')).toBe('第一体育館 1-3コート');
	});

	test('returns venue label when block code is unknown', () => {
		expect(courtDisplayLabel('first_gym', 'not_a_block')).toBe('第一体育館');
	});

	test('returns 未設定 for unknown venue and unknown block code', () => {
		expect(courtDisplayLabel(null, 'not_a_block')).toBe('未設定');
	});

	test('returns venue label when JSON array is empty', () => {
		expect(courtDisplayLabel('second_gym', '[]')).toBe('第二体育館');
	});
});

// ─── courtBlockLabel ─────────────────────────────────────────────────────────

describe('courtBlockLabel', () => {
	test('returns 未設定 for null or undefined', () => {
		expect(courtBlockLabel(null)).toBe('未設定');
		expect(courtBlockLabel(undefined)).toBe('未設定');
	});

	test('formats JSON court array as コートN面 list', () => {
		expect(courtBlockLabel('[2,3,4]')).toBe('2コート・3コート・4コート');
	});

	test('formats single court JSON array', () => {
		expect(courtBlockLabel('[6]')).toBe('6コート');
	});

	test('maps named block code to its label', () => {
		expect(courtBlockLabel('second_6_8')).toBe('第二体育館 6-8コート');
		expect(courtBlockLabel('first_4_6')).toBe('第一体育館 4-6コート');
		expect(courtBlockLabel('second_1_5')).toBe('第二体育館 1,5コート');
	});

	test('returns 未設定 for unknown block code', () => {
		expect(courtBlockLabel('mystery_block')).toBe('未設定');
	});

	test('returns 未設定 for empty JSON array', () => {
		expect(courtBlockLabel('[]')).toBe('未設定');
	});
});

// ─── rubberLabel ─────────────────────────────────────────────────────────────

describe('rubberLabel', () => {
	test('maps rubber codes to display labels', () => {
		expect(rubberLabel('WD1')).toBe('女子ダブルス');
		expect(rubberLabel('XD1')).toBe('ミックスダブルス');
		expect(rubberLabel('MD3')).toBe('男子ダブルス3');
		expect(rubberLabel('MD2')).toBe('男子ダブルス2');
		expect(rubberLabel('MD1')).toBe('男子ダブルス1');
	});

	test('returns raw code for unknown rubber code', () => {
		expect(rubberLabel('UNKNOWN')).toBe('UNKNOWN');
	});
});

// ─── genderLabel ─────────────────────────────────────────────────────────────

describe('genderLabel', () => {
	test('maps known gender values', () => {
		expect(genderLabel('male')).toBe('男性');
		expect(genderLabel('female')).toBe('女性');
		expect(genderLabel('unknown')).toBe('未設定');
	});

	test('returns raw value for unrecognised gender string', () => {
		expect(genderLabel('other')).toBe('other');
	});
});

// ─── venueCourtCount ─────────────────────────────────────────────────────────

describe('venueCourtCount', () => {
	test('returns court count for known venues', () => {
		expect(venueCourtCount('first_gym')).toBe(6);
		expect(venueCourtCount('second_gym')).toBe(8);
	});

	test('returns 0 for null, undefined, or unknown venue', () => {
		expect(venueCourtCount(null)).toBe(0);
		expect(venueCourtCount(undefined)).toBe(0);
		expect(venueCourtCount('third_gym')).toBe(0);
	});
});

// ─── parseCourts ─────────────────────────────────────────────────────────────

describe('parseCourts', () => {
	test('returns empty array for null or undefined', () => {
		expect(parseCourts(null)).toEqual([]);
		expect(parseCourts(undefined)).toEqual([]);
	});

	test('parses valid JSON court array', () => {
		expect(parseCourts('[1,2,3]')).toEqual([1, 2, 3]);
	});

	test('filters out non-positive values from JSON array', () => {
		expect(parseCourts('[0,-1,2,3]')).toEqual([2, 3]);
	});

	test('resolves a named COURT_BLOCKS code', () => {
		expect(parseCourts('first_1_3')).toEqual([1, 2, 3]);
		expect(parseCourts('second_2_4')).toEqual([2, 3, 4]);
		expect(parseCourts('second_1_5')).toEqual([1, 5]);
		expect(parseCourts('second_6_8')).toEqual([6, 7, 8]);
	});

	test('returns empty array for unrecognised code', () => {
		expect(parseCourts('unknown_block')).toEqual([]);
	});

	test('returns empty array for empty JSON array', () => {
		expect(parseCourts('[]')).toEqual([]);
	});

	test('returns empty array for non-JSON that is not a valid block code', () => {
		expect(parseCourts('not_json_at_all')).toEqual([]);
	});
});
