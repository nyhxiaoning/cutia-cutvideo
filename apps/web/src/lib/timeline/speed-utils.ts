export const SPEED_PRESETS = [
	{ label: "0.25x", value: 0.25 },
	{ label: "0.5x", value: 0.5 },
	{ label: "1x", value: 1 },
	{ label: "5x", value: 5 },
	{ label: "10x", value: 10 },
	{ label: "20x", value: 20 },
	{ label: "32x", value: 32 },
	{ label: "64x", value: 64 },
] as const;

export const MIN_PLAYBACK_RATE = 0.25;
export const MAX_PLAYBACK_RATE = 64;

export function formatSpeedLabel({ rate }: { rate: number }): string {
	if (Number.isInteger(rate)) return rate.toString();
	const rounded = Math.round(rate * 100) / 100;
	return rounded.toString();
}

export function computeDurationAfterSpeedChange({
	currentDuration,
	oldRate,
	newRate,
}: {
	currentDuration: number;
	oldRate: number;
	newRate: number;
}): number {
	return currentDuration * (oldRate / newRate);
}
