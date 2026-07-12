export const SPEED_PRESETS = [
	{ label: "0.25x", value: 0.25 },
	{ label: "0.5x", value: 0.5 },
	{ label: "1x", value: 1 },
	{ label: "2x", value: 2 },
	{ label: "3x", value: 3 },
	{ label: "6x", value: 6 },
	{ label: "10x", value: 10 },
	{ label: "20x", value: 20 },
	{ label: "50x", value: 50 },
] as const;

export const MIN_PLAYBACK_RATE = 0.25;
export const MAX_PLAYBACK_RATE = 50;

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
