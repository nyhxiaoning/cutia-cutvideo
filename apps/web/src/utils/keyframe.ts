import type { ElementKeyframes, KeyframeDef, Transform } from "@/types/timeline";
import { applyEasing } from "./easing";

/**
 * Given a sorted keyframe list and a local time, interpolate to find the value.
 * Returns null when there are no keyframes (caller should use static value).
 */
export function interpolateKeyframes(
	keyframes: KeyframeDef[],
	time: number,
): number | null {
	if (keyframes.length === 0) return null;
	if (time <= keyframes[0].time) return keyframes[0].value;
	if (time >= keyframes[keyframes.length - 1].time)
		return keyframes[keyframes.length - 1].value;

	// Find surrounding keyframes
	for (let i = 0; i < keyframes.length - 1; i++) {
		const a = keyframes[i];
		const b = keyframes[i + 1];
		if (time >= a.time && time < b.time) {
			const t = (time - a.time) / (b.time - a.time);
			const eased = applyEasing(t, a.easing ?? "linear");
			return a.value + eased * (b.value - a.value);
		}
	}

	return null;
}

/**
 * Given ElementKeyframes and a local time, compute override values for
 * scale, positionX/Y, and rotate. Returns null when nothing is interpolated.
 */
export function computeKeyframedTransform(
	keyframes: ElementKeyframes,
	time: number,
): Partial<Transform> | null {
	const result: Partial<Transform> = {};
	let hasAny = false;

	const scale = interpolateKeyframes(keyframes.scale ?? [], time);
	if (scale !== null) {
		result.scale = scale;
		hasAny = true;
	}

	const posX = interpolateKeyframes(keyframes.positionX ?? [], time);
	const posY = interpolateKeyframes(keyframes.positionY ?? [], time);
	if (posX !== null || posY !== null) {
		result.position = {};
		if (posX !== null) result.position.x = posX;
		if (posY !== null) result.position.y = posY;
		hasAny = true;
	}

	const rotate = interpolateKeyframes(keyframes.rotate ?? [], time);
	if (rotate !== null) {
		result.rotate = rotate;
		hasAny = true;
	}

	return hasAny ? result : null;
}
