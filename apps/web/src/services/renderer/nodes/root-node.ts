import type { GlobalAdjustments } from "@/types/project";
import { BaseNode } from "./base-node";
import type { CanvasRenderer } from "../canvas-renderer";

export type RootNodeParams = {
	duration: number;
	adjustments?: GlobalAdjustments;
};

export class RootNode extends BaseNode<RootNodeParams> {
	get duration() {
		return this.params.duration ?? 0;
	}

	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		// First pass: render all children normally
		await super.render({ renderer, time });

		// Second pass: apply global adjustments as post-processing
		const adj = this.params.adjustments;
		if (!adj) return;

		const hasFilterAdjustments =
			adj.brightness !== 0 ||
			adj.contrast !== 0 ||
			adj.saturation !== 0 ||
			adj.temperature !== 0;

		const hasVignette = adj.vignette > 0;

		if (!hasFilterAdjustments && !hasVignette) return;

		const ctx = renderer.context;
		const width = renderer.width;
		const height = renderer.height;

		// For filter adjustments: capture rendered frame, clear, redraw with CSS filter
		if (hasFilterAdjustments) {
			const tempCanvas = new OffscreenCanvas(width, height);
			const tempCtx = tempCanvas.getContext("2d");
			if (!tempCtx) return;

			tempCtx.drawImage(renderer.canvas, 0, 0);

			const filters: string[] = [];
			if (adj.brightness !== 0) {
				filters.push(`brightness(${1 + adj.brightness / 100})`);
			}
			if (adj.contrast !== 0) {
				filters.push(`contrast(${1 + adj.contrast / 100})`);
			}
			if (adj.saturation !== 0) {
				filters.push(`saturate(${1 + adj.saturation / 100})`);
			}
			if (adj.temperature !== 0) {
				filters.push(`hue-rotate(${adj.temperature * 0.5}deg)`);
			}

			ctx.clearRect(0, 0, width, height);
			ctx.filter = filters.join(" ");
			ctx.drawImage(tempCanvas, 0, 0);
			ctx.filter = "none";
		}

		// Vignette overlay on top of everything
		if (hasVignette) {
			const outerRadius = Math.sqrt(width * width + height * height) / 2;
			const innerRadius =
				outerRadius * (1 - (adj.vignette / 100) * 0.5);
			const centerX = width / 2;
			const centerY = height / 2;

			const gradient = ctx.createRadialGradient(
				centerX,
				centerY,
				innerRadius,
				centerX,
				centerY,
				outerRadius,
			);
			gradient.addColorStop(0, "rgba(0,0,0,0)");
			gradient.addColorStop(
				1,
				`rgba(0,0,0,${(adj.vignette / 100) * 0.7})`,
			);
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, width, height);
		}
	}
}
