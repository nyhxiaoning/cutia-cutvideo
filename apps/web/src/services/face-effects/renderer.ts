import type { FaceDetectResult, FaceEffectParams, FaceEffectType } from "@/types/face-effect";
import { applyGlow } from "./glow-effect";
import { warpImage } from "./webgl-mesh-warp";

interface ProcessOptions {
	source: TexImageSource;
	landmarks: FaceDetectResult;
	params: FaceEffectParams;
	outputCanvas: HTMLCanvasElement;
}

const WARP_TYPES: Array<{ key: FaceEffectType; type: "big-head" | "left-cheek" | "right-cheek" | "eyes" | "nose" | "mouth"; intensityKey: keyof FaceEffectParams }> = [
	{ key: "big-head", type: "big-head", intensityKey: "bigHeadIntensity" },
	{ key: "left-cheek", type: "left-cheek", intensityKey: "leftCheekIntensity" },
	{ key: "right-cheek", type: "right-cheek", intensityKey: "rightCheekIntensity" },
	{ key: "eyes", type: "eyes", intensityKey: "eyesIntensity" },
	{ key: "nose", type: "nose", intensityKey: "noseIntensity" },
	{ key: "mouth", type: "mouth", intensityKey: "mouthIntensity" },
];

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

		const hasGlow =
			params.enabledEffects.includes("glow") &&
			params.glowIntensity > 0.01;

		let currentSource: CanvasImageSource = source;

		// Run enabled warps sequentially (each one builds on the previous result)
		for (const warp of WARP_TYPES) {
			const enabled = params.enabledEffects.includes(warp.key);
			const intensity = params[warp.intensityKey] as number;
			if (enabled && intensity > 0.01) {
				const warpCanvas = this.getWarpCanvas(imageWidth, imageHeight);
				warpImage({
					source: currentSource,
					landmarks: landmarks.landmarks,
					type: warp.type,
					intensity,
					canvas: warpCanvas,
				});
				currentSource = warpCanvas;
			}
		}

		// Glow (if enabled)
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
