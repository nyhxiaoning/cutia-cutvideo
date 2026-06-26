import type { EasingType } from "@/types/timeline";

/**
 * Apply easing to a normalized progress value t ∈ [0, 1].
 * Returns the eased value in [0, 1].
 */
export function applyEasing(t: number, type: EasingType): number {
	const x = Math.max(0, Math.min(1, t));
	switch (type) {
		case "linear":
			return x;
		case "ease-in":
			return x * x;
		case "ease-out":
			return x * (2 - x);
		case "ease-in-out":
			return x < 0.5 ? 2 * x * x : -1 + (4 - 2 * x) * x;
	}
}
