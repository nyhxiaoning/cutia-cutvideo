import type { FaceDetectResult, FaceEffectParams } from "@/types/face-effect";
import { applyGlow } from "./glow-effect";
import { warpImage } from "./webgl-mesh-warp";

interface ProcessOptions {
	source: TexImageSource;
	landmarks: FaceDetectResult;
	params: FaceEffectParams;
	outputCanvas: HTMLCanvasElement;
}

/**
 * FaceEffectRenderer combines warp and glow effects.
 *
 * Pipeline order:
 * 1. If big-head or big-face enabled: do WebGL warp on source
 * 2. If glow enabled: apply glow on (warped) result
 */
export class FaceEffectRenderer {
	private warpCanvas: HTMLCanvasElement | null = null;

	private getWarpCanvas(width: number, height: number): HTMLCanvasElement {
		if (!this.warpCanvas) {
			this.warpCanvas = document.createElement("canvas");
		}
		this.warpCanvas.width = width;
		this.warpCanvas.height = height;
		return this.warpCanvas;
	}

	process(options: ProcessOptions): HTMLCanvasElement {
		const { source, landmarks, params, outputCanvas } = options;

		const imageWidth = landmarks.imageWidth;
		const imageHeight = landmarks.imageHeight;

		const hasBigHead =
			params.enabledEffects.includes("big-head") &&
			params.bigHeadIntensity > 0.01;

		const hasBigFace =
			params.enabledEffects.includes("big-face") &&
			params.bigFaceIntensity > 0.01;

		const hasGlow =
			params.enabledEffects.includes("glow") &&
			params.glowIntensity > 0.01;

		// Determine the input for the pipeline
		let currentSource: CanvasImageSource = source;

		// Step 1: Warp (if enabled)
		if (hasBigHead || hasBigFace) {
			const warpCanvas = this.getWarpCanvas(imageWidth, imageHeight);
			warpImage({
				source: currentSource,
				landmarks: landmarks.landmarks,
				type: hasBigHead ? "big-head" : "big-face",
				intensity: hasBigHead
					? params.bigHeadIntensity
					: params.bigFaceIntensity,
				canvas: warpCanvas,
			});
			currentSource = warpCanvas;
		}

		// Step 2: Glow (if enabled)
		if (hasGlow) {
			applyGlow({
				source: currentSource,
				landmarks: landmarks.landmarks,
				color: params.glowColor,
				intensity: params.glowIntensity,
				radius: params.glowRadius,
				glowType: "head",
				imageWidth,
				imageHeight,
				canvas: outputCanvas,
			});
		} else {
			// No glow: just copy the current source to output
			const ctx = outputCanvas.getContext("2d");
			if (ctx) {
				outputCanvas.width = imageWidth;
				outputCanvas.height = imageHeight;
				ctx.drawImage(currentSource, 0, 0, imageWidth, imageHeight);
			}
		}

		return outputCanvas;
	}

	destroy(): void {
		this.warpCanvas = null;
	}
}
