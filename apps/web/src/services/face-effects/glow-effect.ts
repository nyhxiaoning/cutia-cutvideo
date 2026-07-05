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

function getGlowRegionIndices(glowType: GlowType): number[] {
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

	// Step 2: Build a glow mask on an offscreen canvas.
	// The mask is filled with the glow colour so the blur picks it up.
	const maskCanvas = document.createElement("canvas");
	maskCanvas.width = imageWidth;
	maskCanvas.height = imageHeight;
	const maskCtx = maskCanvas.getContext("2d");
	if (!maskCtx) return canvas;

	const glowIndices = getGlowRegionIndices(glowType);
	const validIndices = glowIndices.filter((i) => i < landmarks.length);
	if (validIndices.length < 3) return canvas;

	// Draw face contour path filled with the glow colour (full opacity)
	maskCtx.beginPath();
	maskCtx.moveTo(
		landmarks[validIndices[0]].x * imageWidth,
		landmarks[validIndices[0]].y * imageHeight,
	);
	for (let i = 1; i < validIndices.length; i++) {
		maskCtx.lineTo(
			landmarks[validIndices[i]].x * imageWidth,
			landmarks[validIndices[i]].y * imageHeight,
		);
	}
	maskCtx.closePath();
	maskCtx.fillStyle = color;
	maskCtx.fill();

	// Step 3: Blur the mask to create the glow spread.
	// A larger radius = wider, softer glow.
	if (radius > 1) {
		maskCtx.save();
		maskCtx.filter = `blur(${radius}px)`;
		maskCtx.clearRect(0, 0, imageWidth, imageHeight);
		// Redraw the same path with blur to create a soft glow field
		maskCtx.beginPath();
		maskCtx.moveTo(
			landmarks[validIndices[0]].x * imageWidth,
			landmarks[validIndices[0]].y * imageHeight,
		);
		for (let i = 1; i < validIndices.length; i++) {
			maskCtx.lineTo(
				landmarks[validIndices[i]].x * imageWidth,
				landmarks[validIndices[i]].y * imageHeight,
			);
		}
		maskCtx.closePath();
		maskCtx.fillStyle = color;
		maskCtx.fill();
		maskCtx.restore();
	}

	// Step 4: Composite the glow over the source image using "lighter" (additive)
	// so it feels like a real light bloom rather than a transparent overlay.
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	ctx.globalAlpha = intensity;
	ctx.drawImage(maskCanvas, 0, 0);
	ctx.restore();

	return canvas;
}
