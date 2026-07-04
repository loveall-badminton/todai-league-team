import { toTimestamp } from './timeOfDay';

export function useLineupClock() {
	let now = $state(Date.now());

	$effect(() => {
		const timer = setInterval(() => {
			now = Date.now();
		}, 10_000);
		return () => clearInterval(timer);
	});

	// "08:30" のような HH:mm(当日の時刻)と ISO 文字列の両方を受け付ける。
	// 解釈できない値は null(表示しない)。
	function remainingMin(target: string | null | undefined): number | null {
		if (!target) return null;
		const timestamp = toTimestamp(target, now);
		if (timestamp === null) return null;
		return Math.ceil((timestamp - now) / 60_000);
	}

	return { remainingMin };
}
