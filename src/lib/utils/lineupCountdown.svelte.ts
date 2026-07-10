import { toTimestamp, tournamentDateBaseMs } from './timeOfDay';

/**
 * @param getTournamentDate 大会実施日 (YYYY-MM-DD) を返すgetter。未設定なら当日として扱う(従来の挙動)。
 *   $props() の値をリアクティブに読むため、値ではなくgetterで受け取る。
 */
export function useLineupClock(getTournamentDate?: () => string | null | undefined) {
	let now = $state(Date.now());

	$effect(() => {
		const timer = setInterval(() => {
			now = Date.now();
		}, 10_000);
		return () => clearInterval(timer);
	});

	// "08:30" のような HH:mm(大会実施日の時刻)と ISO 文字列の両方を受け付ける。
	// 解釈できない値は null(表示しない)。
	function remainingMin(target: string | null | undefined): number | null {
		if (!target) return null;
		const timestamp = toTimestamp(target, tournamentDateBaseMs(getTournamentDate?.()));
		if (timestamp === null) return null;
		return Math.ceil((timestamp - now) / 60_000);
	}

	return { remainingMin };
}
