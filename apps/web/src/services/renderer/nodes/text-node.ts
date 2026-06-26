import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type { TextElement, ElementKeyframes } from "@/types/timeline";
import {
	interpolateKeyframes,
	computeKeyframedTransform,
} from "@/utils/keyframe";
import { FONT_SIZE_SCALE_REFERENCE } from "@/constants/text-constants";

type RenderContext =
	| CanvasRenderingContext2D
	| OffscreenCanvasRenderingContext2D;

function scaleFontSize({
	fontSize,
	canvasHeight,
}: {
	fontSize: number;
	canvasHeight: number;
}): number {
	return fontSize * (canvasHeight / FONT_SIZE_SCALE_REFERENCE);
}

export function scaleBoxWidth({
	boxWidth,
	canvasHeight,
}: {
	boxWidth: number;
	canvasHeight: number;
}): number {
	return boxWidth * (canvasHeight / FONT_SIZE_SCALE_REFERENCE);
}

function wrapText({
	context,
	text,
	maxWidth,
}: {
	context: RenderContext;
	text: string;
	maxWidth: number;
}): string[] {
	const lines: string[] = [];
	const paragraphs = text.split("\n");

	for (const paragraph of paragraphs) {
		if (paragraph === "") {
			lines.push("");
			continue;
		}

		const chars = Array.from(paragraph);
		let currentLine = "";

		for (const char of chars) {
			const testLine = currentLine + char;
			const metrics = context.measureText(testLine);

			if (metrics.width > maxWidth && currentLine !== "") {
				lines.push(currentLine);
				currentLine = char;
			} else {
				currentLine = testLine;
			}
		}

		if (currentLine !== "") {
			lines.push(currentLine);
		}
	}

	return lines.length > 0 ? lines : [""];
}

export type TextNodeParams = TextElement & {
	canvasCenter: { x: number; y: number };
	canvasHeight: number;
	textBaseline?: CanvasTextBaseline;
	keyframes?: ElementKeyframes;
	crop?: import("@/types/timeline").CropRect;
	maskShape?: import("@/types/timeline").MaskShape;
	maskRadius?: number;
};

export class TextNode extends BaseNode<TextNodeParams> {
	isInRange({ time }: { time: number }) {
		return (
			time >= this.params.startTime &&
			time < this.params.startTime + this.params.duration
		);
	}

	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		if (!this.isInRange({ time })) {
			return;
		}

		renderer.context.save();

		const elementLocalTime = time - this.params.startTime;
		const rawTransform = this.params.transform;
		const rawOpacity = this.params.opacity;
		let effectiveTransform = rawTransform;
		let effectiveOpacity = rawOpacity;

		if (this.params.keyframes) {
			const kfTransform = computeKeyframedTransform(
				this.params.keyframes,
				elementLocalTime,
			);
			if (kfTransform) {
				effectiveTransform = { ...rawTransform, ...kfTransform };
				if (kfTransform.position) {
					effectiveTransform.position = {
						...rawTransform.position,
						...kfTransform.position,
					};
				}
			}
			const kfOpacity = interpolateKeyframes(
				this.params.keyframes.opacity ?? [],
				elementLocalTime,
			);
			if (kfOpacity !== null) {
				effectiveOpacity = kfOpacity;
			}
		}

		const x = effectiveTransform.position.x + this.params.canvasCenter.x;
		const y = effectiveTransform.position.y + this.params.canvasCenter.y;

		// Apply crop & mask for text elements
		const { crop, maskShape, maskRadius } = this.params;
		const hasMask = maskShape && maskShape !== "none";
		const textW = this.params.boxWidth ?? 200;
		if (hasMask) {
			const ctx = renderer.context;
			ctx.beginPath();
			if (maskShape === "circle") {
				ctx.ellipse(x, y, Math.abs(textW) / 2, 50, 0, 0, Math.PI * 2);
			} else if (maskShape === "rounded-rect") {
				const r = (maskRadius ?? 0.1) * Math.min(textW, 100);
				ctx.roundRect(x - textW / 2, y - 50, textW, 100, r);
			}
			ctx.clip();
		}

		renderer.context.translate(x, y);
		if (effectiveTransform.rotate) {
			renderer.context.rotate((effectiveTransform.rotate * Math.PI) / 180);
		}
		if (effectiveTransform.scale !== 1) {
			renderer.context.scale(
				effectiveTransform.scale,
				effectiveTransform.scale,
			);
		}

		const fontWeight = this.params.fontWeight === "bold" ? "bold" : "normal";
		const fontStyle = this.params.fontStyle === "italic" ? "italic" : "normal";
		const textBaseline = this.params.textBaseline || "middle";
		const scaledFontSize = scaleFontSize({
			fontSize: this.params.fontSize,
			canvasHeight: this.params.canvasHeight,
		});
		renderer.context.font = `${fontStyle} ${fontWeight} ${scaledFontSize}px ${this.params.fontFamily}`;
		renderer.context.textAlign = this.params.textAlign;
		renderer.context.textBaseline = textBaseline;
		renderer.context.fillStyle = this.params.color;

		const prevAlpha = renderer.context.globalAlpha;
		renderer.context.globalAlpha = effectiveOpacity;

		const boxWidth = this.params.boxWidth;
		const hasBoxWidth = boxWidth !== undefined && boxWidth > 0;
		const scaledBoxWidth = hasBoxWidth
			? scaleBoxWidth({
					boxWidth,
					canvasHeight: this.params.canvasHeight,
				})
			: 0;

		if (hasBoxWidth) {
			this.renderMultiline({
				context: renderer.context,
				scaledFontSize,
				scaledBoxWidth,
				textBaseline,
			});
		} else {
			this.renderSingleLine({
				context: renderer.context,
				scaledFontSize,
				textBaseline,
			});
		}

		renderer.context.globalAlpha = prevAlpha;
		renderer.context.restore();
	}

	private renderSingleLine({
		context,
		scaledFontSize,
		textBaseline,
	}: {
		context: RenderContext;
		scaledFontSize: number;
		textBaseline: CanvasTextBaseline;
	}) {
		if (this.params.backgroundColor && this.params.backgroundColor !== "transparent") {
			const metrics = context.measureText(this.params.content);
			const ascent = metrics.actualBoundingBoxAscent ?? scaledFontSize * 0.8;
			const descent =
				metrics.actualBoundingBoxDescent ?? scaledFontSize * 0.2;
			const textW = metrics.width;
			const textH = ascent + descent;
			const padX = this.params.backgroundPaddingX ?? 8;
			const padY = this.params.backgroundPaddingY ?? 4;
			const borderRadius = this.params.backgroundBorderRadius ?? 0;

			const prevAlpha = context.globalAlpha;
			const bgOpacity = this.params.backgroundOpacity ?? 1;
			context.globalAlpha = prevAlpha * bgOpacity;

			context.fillStyle = this.params.backgroundColor;
			let bgLeft = -textW / 2;
			if (context.textAlign === "left") bgLeft = 0;
			if (context.textAlign === "right") bgLeft = -textW;

			const backgroundTop =
				textBaseline === "bottom" ? -textH - padY : -textH / 2 - padY;
			const bgW = textW + padX * 2;
			const bgH = textH + padY * 2;
			const bgX = bgLeft - padX;

			if (borderRadius > 0 && context.roundRect) {
				context.beginPath();
				context.roundRect(bgX, backgroundTop, bgW, bgH, borderRadius);
				context.fill();
			} else {
				context.fillRect(bgX, backgroundTop, bgW, bgH);
			}

			context.globalAlpha = prevAlpha;
			context.fillStyle = this.params.color;
		}

		if (this.params.shadow) {
			context.shadowColor = this.params.shadow.color;
			context.shadowOffsetX = this.params.shadow.offsetX;
			context.shadowOffsetY = this.params.shadow.offsetY;
			context.shadowBlur = this.params.shadow.blur;
		}

		if (this.params.stroke && this.params.stroke.width > 0) {
			context.strokeStyle = this.params.stroke.color;
			context.lineWidth = this.params.stroke.width * 2;
			context.lineJoin = "round";
			context.strokeText(this.params.content, 0, 0);
		}

		if (this.params.shadow) {
			context.shadowColor = "transparent";
			context.shadowBlur = 0;
			context.shadowOffsetX = 0;
			context.shadowOffsetY = 0;
		}

		context.fillText(this.params.content, 0, 0);
	}

	private renderMultiline({
		context,
		scaledFontSize,
		scaledBoxWidth,
		textBaseline,
	}: {
		context: RenderContext;
		scaledFontSize: number;
		scaledBoxWidth: number;
		textBaseline: CanvasTextBaseline;
	}) {
		const lines = wrapText({
			context,
			text: this.params.content,
			maxWidth: scaledBoxWidth,
		});

		const lineHeight = scaledFontSize * 1.3;
		const totalHeight = lines.length * lineHeight;

		let startY: number;
		if (textBaseline === "bottom") {
			startY = -totalHeight;
		} else {
			startY = -totalHeight / 2 + lineHeight / 2;
		}

		context.textBaseline = "middle";

		let textX = 0;
		if (context.textAlign === "left") {
			textX = -scaledBoxWidth / 2;
		} else if (context.textAlign === "right") {
			textX = scaledBoxWidth / 2;
		}

		if (this.params.backgroundColor && this.params.backgroundColor !== "transparent") {
			const padX = this.params.backgroundPaddingX ?? 8;
			const padY = this.params.backgroundPaddingY ?? 4;
			const borderRadius = this.params.backgroundBorderRadius ?? 0;

			const prevAlpha = context.globalAlpha;
			const bgOpacity = this.params.backgroundOpacity ?? 1;
			context.globalAlpha = prevAlpha * bgOpacity;

			context.fillStyle = this.params.backgroundColor;
			const bgX = -scaledBoxWidth / 2 - padX;
			const bgY = startY - lineHeight / 2 - padY;
			const bgW = scaledBoxWidth + padX * 2;
			const bgH = totalHeight + padY * 2;

			if (borderRadius > 0 && context.roundRect) {
				context.beginPath();
				context.roundRect(bgX, bgY, bgW, bgH, borderRadius);
				context.fill();
			} else {
				context.fillRect(bgX, bgY, bgW, bgH);
			}

			context.globalAlpha = prevAlpha;
			context.fillStyle = this.params.color;
		}

		for (let i = 0; i < lines.length; i++) {
			const lineY = startY + i * lineHeight;

			if (this.params.shadow) {
				context.shadowColor = this.params.shadow.color;
				context.shadowOffsetX = this.params.shadow.offsetX;
				context.shadowOffsetY = this.params.shadow.offsetY;
				context.shadowBlur = this.params.shadow.blur;
			}

			if (this.params.stroke && this.params.stroke.width > 0) {
				context.strokeStyle = this.params.stroke.color;
				context.lineWidth = this.params.stroke.width * 2;
				context.lineJoin = "round";
				context.strokeText(lines[i], textX, lineY);
			}

			if (this.params.shadow) {
				context.shadowColor = "transparent";
				context.shadowBlur = 0;
				context.shadowOffsetX = 0;
				context.shadowOffsetY = 0;
			}

			context.fillText(lines[i], textX, lineY);
		}
	}
}
