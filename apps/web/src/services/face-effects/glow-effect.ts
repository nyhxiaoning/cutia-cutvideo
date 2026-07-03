import type { FaceLandmarkPoint, GlowType } from "@/types/face-effect";
import { FACE_LANDMARK_INDICES } from "@/types/face-effect";

interface GlowOptions {
	source: CanvasImageSource;
	landmarks: FaceLandmarkPoint[];
	color: string;
	intensity: number;
	radius: number;
	glowType: GlowType;
	imageWidth: number;
	imageHeight: number;
	canvas: HTMLCanvasElement;
}

function hexToRgba(hex: string, alpha: number): string {
	const r = Number.parseInt(hex.slice(1, 3), 16) || 255;
	const g = Number.parseInt(hex.slice(3, 5), 16) || 255;
	const b = Number.parseInt(hex.slice(5, 7), 16) || 255;
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getGlowRegionIndices(
	glowType: GlowType,
): number[] {
	switch (glowType) {
		case "head":
			return [
				...FACE_LANDMARK_INDICES.HEAD_TOP,
				...FACE_LANDMARK_INDICES.FACE_CONTOUR,
				...FACE_LANDMARK_INDICES.LEFT_EYEBROW,
				...FACE_LANDMARK_INDICES.RIGHT_EYEBROW,
			];
		case "face":
			return [
				...FACE_LANDMARK_INDICES.FACE_CONTOUR,
				...FACE_LANDMARK_INDICES.LEFT_CHEEK,
				...FACE_LANDMARK_INDICES.RIGHT_CHEEK,
			];
		case "body":
			return FACE_LANDMARK_INDICES.FACE_CONTOUR;
	}
}

export function applyGlow(options: GlowOptions): HTMLCanvasElement {
	const {
		source,
		landmarks,
		color,
		intensity,
		radius,
		glowType,
		imageWidth,
		imageHeight,
		canvas,
	} = options;

	canvas.width = imageWidth;
	canvas.height = imageHeight;

	const ctx = canvas.getContext("2d");
	if (!ctx) return canvas;

	// Step 1: Draw the source image
	ctx.drawImage(source, 0, 0, imageWidth, imageHeight);

	if (intensity < 0.01) return canvas;

	// Step 2: Create an offscreen canvas for the glow mask
	const maskCanvas = document.createElement("canvas");
	maskCanvas.width = imageWidth;
	maskCanvas.height = imageHeight;
	const maskCtx = maskCanvas.getContext("2d");
	if (!maskCtx) return canvas;

	// Step 3: Draw glow region as a filled path
	const glowIndices = getGlowRegionIndices(glowType);
	const validIndices = glowIndices.filter((i) => i < landmarks.length);

	if (validIndices.length < 3) return canvas;

	maskCtx.beginPath();

	const firstIdx = validIndices[0];
	maskCtx.moveTo(
		landmarks[firstIdx].x * imageWidth,
		landmarks[firstIdx].y * imageHeight,
	);

	for (let i = 1; i < validIndices.length; i++) {
		maskCtx.lineTo(
			landmarks[validIndices[i]].x * imageWidth,
			landmarks[validIndices[i]].y * imageHeight,
		);
	}

	maskCtx.closePath();
	maskCtx.fillStyle = "white";
	maskCtx.fill();

	// Step 4: Apply blur to the mask to create glow spread
	maskCtx.globalCompositeOperation = "source-over";

	// For the glow effect, apply shadow blur
	ctx.save();

	// Draw the mask with shadow blur onto the main canvas
	ctx.shadowBlur = radius * intensity;
	ctx.shadowColor = hexToRgba(color, intensity);

	// Use source-atop to only apply glow where the source image exists
	ctx.globalCompositeOperation = "source-atop";
	ctx.drawImage(maskCanvas, 0, 0);

	ctx.restore();

	// Step 5: Add an additional glow overlay for stronger effect
	if (intensity > 0.3) {
		ctx.save();
		ctx.globalAlpha = intensity * 0.4;
		ctx.drawImage(maskCanvas, 0, 0);
		ctx.restore();
	}

	return canvas;
}

export function applyHeadGlow(options: Omit<GlowOptions, "glowType">): HTMLCanvasElement {
	return applyGlow({ ...options, glowType: "head" });
}

export function applyBodyGlow(options: Omit<GlowOptions, "glowType">): HTMLCanvasElement {
	return applyGlow({ ...options, glowType: "body" });
}
