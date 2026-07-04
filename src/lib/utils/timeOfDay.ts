/**
 * 開始予定時刻・オーダー提出期限は "08:30" のような HH:mm 文字列で保存される。
 * Date コンストラクタは HH:mm を解釈できないため、ここで明示的に扱う。
 */

const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function parseHhMm(value: string): { hours: number; minutes: number } | null {
	const match = HHMM_RE.exec(value.trim());
	if (!match) return null;
	return { hours: Number(match[1]), minutes: Number(match[2]) };
}

/**
 * HH:mm または Date が解釈できる文字列を、エポックミリ秒に変換する。
 * HH:mm は「基準時刻と同じ日のその時刻(ローカル)」として解釈する。
 * どちらでも解釈できない場合は null。
 */
export function toTimestamp(value: string, baseMs: number = Date.now()): number | null {
	const hhMm = parseHhMm(value);
	if (hhMm) {
		const date = new Date(baseMs);
		date.setHours(hhMm.hours, hhMm.minutes, 0, 0);
		return date.getTime();
	}
	const parsed = new Date(value).getTime();
	return Number.isNaN(parsed) ? null : parsed;
}

/**
 * 残り分数を「n分」「n時間」「n時間n分」の形式にする。
 * 60 分未満はそのまま分表記。0 以下の扱いは呼び出し側の責務。
 */
export function formatDurationMin(min: number): string {
	if (min < 60) return `${min}分`;
	const hours = Math.floor(min / 60);
	const mins = min % 60;
	return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
}

/** HH:mm から分数を引いた HH:mm を返す(日をまたぐ場合は 24 時間で折り返す)。 */
export function subtractMinutesFromHhMm(value: string, minutes: number): string | null {
	const hhMm = parseHhMm(value);
	if (!hhMm) return null;
	const total = (hhMm.hours * 60 + hhMm.minutes - minutes + 24 * 60) % (24 * 60);
	const hours = Math.floor(total / 60);
	const mins = total % 60;
	return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
