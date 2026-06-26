import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type { Transform, ElementKeyframes } from "@/types/timeline";
import {
	interpolateKeyframes,
	computeKeyframedTransform,
} from "@/utils/keyframe";

const VISUAL_EPSILON = 1 / 1000;

export interface VisualNodeParams {
	duration: number;
	timeOffset: number;
	trimStart: number;
	trimEnd: number;
	transform: Transform;
	opacity: number;
	playbackRate?: number;
	reversed?: boolean;
	filter?: string;
	filterRange?: { start: number; end: number };
	keyframes?: ElementKeyframes;
}

export abstract class VisualNode<
	Params extends VisualNodeParams = VisualNodeParams,
> extends BaseNode<Params> {
	protected getLocalTime(time: number): number {
		const rate = this.params.playbackRate ?? 1;
		const elapsed = time - this.params.timeOffset;
		if (this.params.reversed) {
			return this.params.trimStart + rate * (this.params.duration - elapsed);
		}
		return this.params.trimStart + elapsed * rate;
	}

	protected isInRange(time: number): boolean {
		const localTime = this.getLocalTime(time);
		const rate = this.params.playbackRate ?? 1;
		return (
			localTime >= this.params.trimStart - VISUAL_EPSILON &&
			localTime < this.params.trimStart + this.params.duration * rate
		);
	}

	protected renderVisual({
		renderer,
		source,
		sourceWidth,
		sourceHeight,
		elementLocalTime,
	}: {
		renderer: CanvasRenderer;
		source: CanvasImageSource;
		sourceWidth: number;
		sourceHeight: number;
		elementLocalTime?: number;
	}): void {
		renderer.context.save();

		const rawTransform = this.params.transform;
		const rawOpacity = this.params.opacity;
		const { filter, filterRange } = this.params;

		// Determine effective transform & opacity via keyframes
		let effectiveTransform = rawTransform;
		let effectiveOpacity = rawOpacity;

		if (elementLocalTime !== undefined && this.params.keyframes) {
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

		if (filter) {
			const isInFilterRange =
				!filterRange ||
				(elementLocalTime !== undefined &&
					elementLocalTime >= filterRange.start &&
					elementLocalTime < filterRange.end);
			if (isInFilterRange) {
				renderer.context.filter = filter;
			}
		}

		const containScale = Math.min(
			renderer.width / sourceWidth,
			renderer.height / sourceHeight,
		);
		const scaledWidth =
			sourceWidth * containScale * effectiveTransform.scale;
		const scaledHeight =
			sourceHeight * containScale * effectiveTransform.scale;
		const x =
			renderer.width / 2 +
			effectiveTransform.position.x -
			scaledWidth / 2;
		const y =
			renderer.height / 2 +
			effectiveTransform.position.y -
			scaledHeight / 2;

		renderer.context.globalAlpha = effectiveOpacity;

		const centerX = x + scaledWidth / 2;
		const centerY = y + scaledHeight / 2;

		const needsFlip =
			effectiveTransform.flipX || effectiveTransform.flipY;
		const needsRotate = effectiveTransform.rotate !== 0;

		if (needsRotate || needsFlip) {
			renderer.context.translate(centerX, centerY);
			if (needsRotate) {
				renderer.context.rotate(
					(effectiveTransform.rotate * Math.PI) / 180,
				);
			}
			if (needsFlip) {
				renderer.context.scale(
					effectiveTransform.flipX ? -1 : 1,
					effectiveTransform.flipY ? -1 : 1,
				);
			}
			renderer.context.translate(-centerX, -centerY);
		}

		renderer.context.drawImage(
			source,
			x,
			y,
			scaledWidth,
			scaledHeight,
		);
		renderer.context.restore();
	}
}
