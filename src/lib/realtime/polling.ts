export function computePollDelay(baseIntervalMs: number, jitterRatio = 0.5) {
	if (!Number.isFinite(baseIntervalMs) || baseIntervalMs <= 0) return 0;
	const maxJitter = Math.round(baseIntervalMs * jitterRatio);
	const jitter = Math.min(maxJitter, Math.floor(Math.random() * (maxJitter + 1)));
	return baseIntervalMs + jitter;
}
