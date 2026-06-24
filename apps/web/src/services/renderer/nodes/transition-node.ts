import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type { TransitionType } from "@/types/timeline";

export interface TransitionNodeParams {
	type: TransitionType;
	duration: number;
	transitionStart: number;
	outgoingNode: BaseNode;
	incomingNode: BaseNode;
	outgoingEndTime: number;
	incomingStartTime: number;
}

export class TransitionNode extends BaseNode<TransitionNodeParams> {
	private outgoing: BaseNode;
	private incoming: BaseNode;
	private offscreenA?: OffscreenCanvas | HTMLCanvasElement;
	private offscreenB?: OffscreenCanvas | HTMLCanvasElement;

	constructor(params: TransitionNodeParams) {
		super(params);
		this.outgoing = params.outgoingNode;
		this.incoming = params.incomingNode;
	}

	private getProgress({ time }: { time: number }): number | null {
		const { transitionStart, duration } = this.params;
		if (time < transitionStart || time >= transitionStart + duration) {
			return null;
		}
		return (time - transitionStart) / duration;
	}

	private ensureOffscreen({
		width,
		height,
	}: {
		width: number;
		height: number;
	}): {
		canvasA: OffscreenCanvas | HTMLCanvasElement;
		canvasB: OffscreenCanvas | HTMLCanvasElement;
	} {
		const needsRecreate =
			!this.offscreenA ||
			!this.offscreenB ||
			(this.offscreenA instanceof OffscreenCanvas
				? this.offscreenA.width !== width || this.offscreenA.height !== height
				: this.offscreenA.width !== width ||
					this.offscreenA.height !== height);

		if (needsRecreate) {
			try {
				this.offscreenA = new OffscreenCanvas(width, height);
				this.offscreenB = new OffscreenCanvas(width, height);
			} catch {
				this.offscreenA = document.createElement("canvas");
				this.offscreenA.width = width;
				this.offscreenA.height = height;
				this.offscreenB = document.createElement("canvas");
				this.offscreenB.width = width;
				this.offscreenB.height = height;
			}
		}

		const canvasA = this.offscreenA;
		const canvasB = this.offscreenB;
		if (!canvasA || !canvasB) {
			throw new Error("Failed to create offscreen canvases");
		}

		return { canvasA, canvasB };
	}

	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		const progress = this.getProgress({ time });

		if (progress === null) {
			await this.outgoing.render({ renderer, time });
			await this.incoming.render({ renderer, time });
			return;
		}

		const { width, height } = renderer;
		const { canvasA, canvasB } = this.ensureOffscreen({ width, height });

		const ctxA = canvasA.getContext("2d");
		const ctxB = canvasB.getContext("2d");
		if (!ctxA || !ctxB) {
			throw new Error("Failed to get offscreen canvas context");
		}

		ctxA.clearRect(0, 0, width, height);
		ctxB.clearRect(0, 0, width, height);

		const originalContext = renderer.context;

		// clamp so each element stays in its valid range during the transition
		const outgoingTime = Math.min(time, this.params.outgoingEndTime - 1 / 1000);
		const incomingTime = Math.max(time, this.params.incomingStartTime);

		renderer.context = ctxA as typeof originalContext;
		await this.outgoing.render({ renderer, time: outgoingTime });

		renderer.context = ctxB as typeof originalContext;
		await this.incoming.render({ renderer, time: incomingTime });

		renderer.context = originalContext;

		applyTransition({
			context: renderer.context,
			canvasA,
			canvasB,
			width,
			height,
			progress,
			type: this.params.type,
		});
	}
}

function applyTransition({
	context,
	canvasA,
	canvasB,
	width,
	height,
	progress,
	type,
}: {
	context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
	canvasA: OffscreenCanvas | HTMLCanvasElement;
	canvasB: OffscreenCanvas | HTMLCanvasElement;
	width: number;
	height: number;
	progress: number;
	type: TransitionType;
}): void {
	const source = { canvasA, canvasB } as const;

	switch (type) {
		case "fade":
			applyFade({ context, ...source, width, height, progress });
			break;
		case "dissolve":
			applyDissolve({ context, ...source, width, height, progress });
			break;
		case "wipe-left":
			applyWipe({ context, ...source, width, height, progress, direction: "left" });
			break;
		case "wipe-right":
			applyWipe({ context, ...source, width, height, progress, direction: "right" });
			break;
		case "wipe-up":
			applyWipe({ context, ...source, width, height, progress, direction: "up" });
			break;
		case "wipe-down":
			applyWipe({ context, ...source, width, height, progress, direction: "down" });
			break;
		case "slide-left":
			applySlide({ context, ...source, width, height, progress, direction: "left" });
			break;
		case "slide-right":
			applySlide({ context, ...source, width, height, progress, direction: "right" });
			break;
		case "slide-up":
			applySlide({ context, ...source, width, height, progress, direction: "up" });
			break;
		case "slide-down":
			applySlide({ context, ...source, width, height, progress, direction: "down" });
			break;
		case "zoom-in":
			applyZoom({ context, ...source, width, height, progress, direction: "in" });
			break;
		case "zoom-out":
			applyZoom({ context, ...source, width, height, progress, direction: "out" });
			break;
		case "push-left":
			applyPush({ context, ...source, width, height, progress, direction: "left" });
			break;
		case "push-right":
			applyPush({ context, ...source, width, height, progress, direction: "right" });
			break;
		case "flash-black":
			applyFlashBlack({ context, ...source, width, height, progress });
			break;
		case "blur-dissolve":
			applyBlurDissolve({ context, ...source, width, height, progress });
			break;
		default:
			applyFade({ context, ...source, width, height, progress });
	}
}

type TransitionContext = {
	context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
	canvasA: OffscreenCanvas | HTMLCanvasElement;
	canvasB: OffscreenCanvas | HTMLCanvasElement;
	width: number;
	height: number;
	progress: number;
};

function applyFade({ context, canvasA, canvasB, width, height, progress }: TransitionContext): void {
	context.save();
	context.globalAlpha = 1 - progress;
	context.drawImage(canvasA as CanvasImageSource, 0, 0, width, height);
	context.globalAlpha = progress;
	context.drawImage(canvasB as CanvasImageSource, 0, 0, width, height);
	context.restore();
}

function applyDissolve({ context, canvasA, canvasB, width, height, progress }: TransitionContext): void {
	// smooth dissolve with eased alpha
	const eased = progress * progress * (3 - 2 * progress);
	context.save();
	context.globalAlpha = 1;
	context.drawImage(canvasA as CanvasImageSource, 0, 0, width, height);
	context.globalAlpha = eased;
	context.drawImage(canvasB as CanvasImageSource, 0, 0, width, height);
	context.restore();
}

function applyWipe({
	context,
	canvasA,
	canvasB,
	width,
	height,
	progress,
	direction,
}: TransitionContext & { direction: "left" | "right" | "up" | "down" }): void {
	context.save();
	context.drawImage(canvasA as CanvasImageSource, 0, 0, width, height);

	context.save();
	context.beginPath();

	switch (direction) {
		case "left":
			context.rect(width * (1 - progress), 0, width * progress, height);
			break;
		case "right":
			context.rect(0, 0, width * progress, height);
			break;
		case "up":
			context.rect(0, height * (1 - progress), width, height * progress);
			break;
		case "down":
			context.rect(0, 0, width, height * progress);
			break;
	}

	context.clip();
	context.drawImage(canvasB as CanvasImageSource, 0, 0, width, height);
	context.restore();
	context.restore();
}

function applySlide({
	context,
	canvasA,
	canvasB,
	width,
	height,
	progress,
	direction,
}: TransitionContext & { direction: "left" | "right" | "up" | "down" }): void {
	context.save();

	let offsetX = 0;
	let offsetY = 0;

	switch (direction) {
		case "left":
			offsetX = -width * progress;
			break;
		case "right":
			offsetX = width * progress;
			break;
		case "up":
			offsetY = -height * progress;
			break;
		case "down":
			offsetY = height * progress;
			break;
	}

	context.drawImage(canvasA as CanvasImageSource, offsetX, offsetY, width, height);

	switch (direction) {
		case "left":
			context.drawImage(canvasB as CanvasImageSource, width + offsetX, offsetY, width, height);
			break;
		case "right":
			context.drawImage(canvasB as CanvasImageSource, -width + offsetX, offsetY, width, height);
			break;
		case "up":
			context.drawImage(canvasB as CanvasImageSource, offsetX, height + offsetY, width, height);
			break;
		case "down":
			context.drawImage(canvasB as CanvasImageSource, offsetX, -height + offsetY, width, height);
			break;
	}

	context.restore();
}

function applyZoom({
	context,
	canvasA,
	canvasB,
	width,
	height,
	progress,
	direction,
}: TransitionContext & { direction: "in" | "out" }): void {
	context.save();

	if (direction === "in") {
		const scale = 1 + progress * 0.5;
		const scaledWidth = width * scale;
		const scaledHeight = height * scale;
		const offsetX = (width - scaledWidth) / 2;
		const offsetY = (height - scaledHeight) / 2;

		context.globalAlpha = 1 - progress;
		context.drawImage(canvasA as CanvasImageSource, offsetX, offsetY, scaledWidth, scaledHeight);
		context.globalAlpha = progress;
		context.drawImage(canvasB as CanvasImageSource, 0, 0, width, height);
	} else {
		const scale = 1 - progress * 0.5;
		const scaledWidth = width * scale;
		const scaledHeight = height * scale;
		const offsetX = (width - scaledWidth) / 2;
		const offsetY = (height - scaledHeight) / 2;

		context.globalAlpha = 1 - progress;
		context.drawImage(canvasA as CanvasImageSource, 0, 0, width, height);
		context.globalAlpha = progress;
		context.drawImage(canvasB as CanvasImageSource, offsetX, offsetY, scaledWidth, scaledHeight);
	}

	context.restore();
}

/**
 * Push transition: incoming pushes outgoing off screen.
 * direction "left" = incoming slides in from right, pushing outgoing out to the left.
 * direction "right" = incoming slides in from left, pushing outgoing out to the right.
 */
function applyPush({
	context,
	canvasA,
	canvasB,
	width,
	height,
	progress,
	direction,
}: TransitionContext & { direction: "left" | "right" }): void {
	context.save();

	const offsetX = direction === "left" ? -width * progress : width * progress;

	// Outgoing moves off screen in opposite direction
	context.drawImage(canvasA as CanvasImageSource, offsetX, 0, width, height);

	// Incoming follows from the opposite side
	const incomingOffsetX = direction === "left" ? width + offsetX : -width + offsetX;
	context.drawImage(canvasB as CanvasImageSource, incomingOffsetX, 0, width, height);

	context.restore();
}

/**
 * Flash Black transition: screen flashes to black, then fades in next clip.
 * First half: fade outgoing to black (progress 0-0.5)
 * Second half: fade from black to incoming (progress 0.5-1)
 */
function applyFlashBlack({
	context,
	canvasA,
	canvasB,
	width,
	height,
	progress,
}: TransitionContext): void {
	context.save();

	if (progress < 0.5) {
		// Fade outgoing to black
		const blackAlpha = progress * 2; // 0 -> 1 in first half
		context.drawImage(canvasA as CanvasImageSource, 0, 0, width, height);
		context.fillStyle = `rgba(0, 0, 0, ${blackAlpha})`;
		context.fillRect(0, 0, width, height);
	} else {
		// Fade from black to incoming
		const blackAlpha = 1 - (progress - 0.5) * 2; // 1 -> 0 in second half
		context.drawImage(canvasB as CanvasImageSource, 0, 0, width, height);
		context.fillStyle = `rgba(0, 0, 0, ${blackAlpha})`;
		context.fillRect(0, 0, width, height);
	}

	context.restore();
}

/**
 * Blur Dissolve transition: increasing blur on outgoing, then incoming fades in.
 * progress 0-0.5: blur outgoing up to max
 * progress 0.5-1: dissolve from blurred outgoing to incoming
 */
function applyBlurDissolve({
	context,
	canvasA,
	canvasB,
	width,
	height,
	progress,
}: TransitionContext): void {
	context.save();

	const maxBlur = 10;
	const eased = progress * progress * (3 - 2 * progress);

	if (progress < 0.5) {
		// Blur outgoing increasingly, then fade
		const blurAmount = Math.min(eased * maxBlur * 2, maxBlur);
		context.filter = `blur(${blurAmount}px)`;
		context.drawImage(canvasA as CanvasImageSource, 0, 0, width, height);
	} else {
		// Cross-fade from blurred outgoing to incoming
		const dissolveProgress = (progress - 0.5) * 2;
		const blurAmount = Math.max((1 - dissolveProgress) * maxBlur, 0);

		if (blurAmount > 1) {
			context.filter = `blur(${blurAmount}px)`;
			context.drawImage(canvasA as CanvasImageSource, 0, 0, width, height);

			context.filter = "none";
			context.globalAlpha = dissolveProgress;
			context.drawImage(canvasB as CanvasImageSource, 0, 0, width, height);
		} else {
			context.filter = "none";
			context.globalAlpha = 1 - dissolveProgress * 0.5;
			context.drawImage(canvasA as CanvasImageSource, 0, 0, width, height);

			context.globalAlpha = dissolveProgress;
			context.drawImage(canvasB as CanvasImageSource, 0, 0, width, height);
		}
	}

	context.restore();
}
